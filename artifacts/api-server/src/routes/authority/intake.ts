/**
 * POST /api/authority/intake/analyze
 *   Accepts { documentText, contextHints? } — AI-powered extraction + routing recommendation.
 *   Always sets suggestedPendingReview: true. Engine flags, never concludes.
 *
 * GET /api/authority/intake/:id
 *   Retrieve a saved intake extraction by ID.
 *
 * GET /api/authority/intake
 *   List recent extractions (last N).
 */
import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import {
  authorityIntakeExtractionsTable,
  authorityMatterRoutingTable,
  authorityAgenciesTable,
  authorityLegalMapTable,
} from "@workspace/db";
import { eq, ilike, and, desc, asc, SQL, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

// ── Regex-based extraction fallback ──────────────────────────────────────────

function extractByRegex(text: string): Record<string, unknown> {
  const apn = text.match(/(?:APN|Assessor.{0,15}Parcel|Parcel\s*(?:No\.?|Number))[:\s#]*([A-Z0-9\-\.]+)/i)?.[1] ?? null;
  const address = text.match(/(\d{3,6}\s+[A-Z][A-Za-z ]+(?:Rd|Road|Ave|Avenue|Blvd|Boulevard|Dr|Drive|St|Street|Ln|Lane|Way|Ct|Court|Pkwy)[^\n\r,]{0,80})/i)?.[1]?.trim() ?? null;
  const deadline = text.match(/(?:due|deadline|respond by|response due|must respond|pay by|payment due)[:\s]+([^\n\r]{5,60})/i)?.[1]?.trim() ?? null;
  const refNum = text.match(/(?:Account|Case|Reference|File|Receipt|Customer)\s*(?:No\.?|Number|#|ID)[:\s]*([A-Z0-9\-\/]+)/i)?.[1] ?? null;
  const stateMatch = text.match(/\b(California|Michigan|Arizona|New Mexico|Oklahoma|Washington|Montana|North Dakota|South Dakota|Minnesota|Wisconsin|New York|Florida|Texas|Oregon|Idaho|Nevada|Alaska|Hawaii|Colorado|Kansas|Nebraska|Iowa|Missouri|Arkansas|Louisiana|Mississippi|Alabama|Georgia|North Carolina|South Carolina|Virginia|West Virginia|Pennsylvania|New Jersey|Connecticut|Rhode Island|Massachusetts|Vermont|New Hampshire|Maine|Delaware|Maryland|Indiana|Illinois|Ohio|Kentucky|Tennessee)\b/i)?.[1] ?? null;
  const stateAbbrev = !stateMatch ? (text.match(/\b(CA|MI|AZ|NM|OK|WA|MT|ND|SD|MN|WI|NY|FL|TX|OR|ID|NV|AK|HI|CO|KS|NE|IA|MO|AR|LA|MS|AL|GA|NC|SC|VA|WV|PA|NJ|CT|RI|MA|VT|NH|ME|DE|MD|IN|IL|OH|KY|TN)\b/)?.[1] ?? null) : null;
  const county = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+County/i)?.[1]?.trim() ?? null;
  const entityName = text.match(/(?:Owner|Grantor|Grantee|Petitioner|Respondent|Plaintiff|Defendant|Filed by|Issued to|Addressed to|Customer|Account\s+(?:holder|name))[:\s]+([A-Z][A-Za-z\s,\.]+?)(?:\n|,|and|dated|v\.|vs\.|\s{2,})/i)?.[1]?.trim() ?? null;

  return {
    detectedEntityName: entityName,
    detectedAddress: address,
    detectedDeadline: deadline,
    detectedAccountOrReferenceNumber: refNum,
    detectedApn: apn,
    detectedState: stateMatch ?? stateAbbrev,
    detectedCounty: county,
    tribalLandFlag: /tribal\s+trust|tribal\s+land|indian\s+trust|allotment|restricted\s+fee|indian\s+country/i.test(text),
    icwaFlag: /\b(icwa|indian\s+child\s+welfare|foster\s+care|adoption\s+of|removal\s+of\s+(?:an?\s+)?(?:indian|native)|placement\s+of\s+(?:an?\s+)?(?:indian|native))\b/i.test(text),
    indianLawFlag: /\b(25\s+u\.s\.c|indian\s+reorganization\s+act|tribal\s+sovereignty|federal\s+trust|bureau\s+of\s+indian|bia\b|trust\s+responsibility|indian\s+country|federal\s+indian\s+law)\b/i.test(text),
    trustLandFlag: /\b(trust\s+land|in\s+trust|held\s+in\s+trust|tribal\s+trust|individual\s+(?:indian\s+)?trust|allotment|restricted\s+fee)\b/i.test(text),
    federalReviewFlag: /\b(federal\s+review|department\s+of\s+interior|bia\b|bureau\s+of\s+indian|united\s+states\s+v\.|federal\s+court|federal\s+law\s+applies)\b/i.test(text),
    legalFlags: [] as string[],
  };
}

function detectMatterType(text: string): string {
  const t = text.toLowerCase();
  if (/icwa|indian\s+child\s+welfare|foster\s+care|removal\s+of\s+(?:an?\s+)?(?:indian|native)|adoption\s+of/.test(t)) return "icwa_violation";
  if (/shut.?off|disconnection|termination.*service|service.*termination/.test(t)) return "utility_shutoff";
  if (/tax\s+lien|notice\s+of\s+lien|lien\s+certificate/.test(t)) return "tax_lien";
  if (/property\s+tax|tax\s+notice|notice\s+of\s+assessment|assessed\s+value|taxable\s+value/.test(t)) return "tax_assessment";
  if (/foreclos|trustee.?s?\s+sale|notice\s+of\s+default/.test(t)) return "foreclosure";
  if (/court\s+order|judgment|order\s+of\s+court/.test(t)) return "court_order";
  if (/recorder|recording\s+rejected|refused.*record|record.*refused/.test(t)) return "recorder_refusal";
  if (/zoning|permit|ordinance|building\s+code/.test(t)) return "zoning";
  if (/state\s+(?:law|jurisdiction|authority|court)|county\s+(?:ordinance|jurisdiction)/.test(t) && /tribal|tribe|indian|sovereign/.test(t)) return "jurisdictional_overreach";
  if (/medi.?cal|medicare|medicaid|health\s+plan|managed\s+care|cms|dhcs/.test(t)) return "health_plan_denial";
  if (/warranty\s+deed|quitclaim|grant\s+deed|deed\s+of\s+trust/.test(t)) return "deed";
  if (/enrollment|tribal\s+id|cdib|degree\s+of\s+indian\s+blood/.test(t)) return "identity_verification";
  if (/trust\s+declaration|irrevocable\s+trust|declaration\s+of\s+trust/.test(t)) return "trust_declaration";
  if (/agency.*denied|denial.*benefit|denied.*application|benefit.*denial/.test(t)) return "agency_denial";
  if (/code\s+enforcement|violation\s+notice|inspection.*notice|unsafe.*structure/.test(t)) return "code_enforcement";
  return "general";
}

function detectActionType(text: string): string {
  const t = text.toLowerCase();
  if (/demand|comply|pay\s+now|must\s+pay|cease\s+and\s+desist|you\s+are\s+ordered|final\s+notice/.test(t)) return "demand";
  if (/shut.?off|disconnect|terminat/.test(t)) return "shutoff_notice";
  if (/notice|notif/.test(t)) return "notice";
  if (/complaint|formal\s+complaint|grievance/.test(t)) return "complaint";
  if (/petition|request|motion/.test(t)) return "petition";
  if (/order|decree|judgment/.test(t)) return "order";
  return "informational";
}

// ── POST /analyze ─────────────────────────────────────────────────────────────

router.post("/analyze", requireAuth, async (req, res, next) => {
  try {
    const { documentText, contextHints } = req.body as {
      documentText: string;
      contextHints?: { state?: string; county?: string; matterType?: string };
    };

    if (!documentText || typeof documentText !== "string" || documentText.trim().length < 20) {
      res.status(400).json({ error: "documentText field is required (min 20 characters)" });
      return;
    }

    const userId = req.user?.dbId ?? null;
    const truncated = documentText.substring(0, 8000);

    let extracted: Record<string, unknown> = {};
    let extractionSource = "ai";

    try {
      const { callAzureOpenAI } = await import("../../lib/azure-openai");
      const system = `You are a sovereign tribal legal office document analyst specializing in Indian law, sovereign rights, and government agency matters. Extract structured fields from legal, government, administrative, and utility documents.

Respond ONLY with valid JSON. Use null for fields not found. Shape:
{
  "detectedEntityName": "primary person, organization, or issuing agency or null",
  "detectedAddress": "property or mailing address or null",
  "detectedDeadline": "response deadline or action-required date or null",
  "detectedAccountOrReferenceNumber": "account, case, file, customer, or reference number or null",
  "detectedMatterType": "one of: icwa_violation | utility_shutoff | tax_lien | tax_assessment | foreclosure | court_order | recorder_refusal | zoning | jurisdictional_overreach | health_plan_denial | deed | identity_verification | trust_declaration | agency_denial | code_enforcement | general",
  "detectedActionType": "one of: demand | shutoff_notice | notice | complaint | petition | order | informational",
  "detectedState": "2-letter state code or null",
  "detectedCounty": "county name without the word County or null",
  "detectedApn": "Assessor Parcel Number or null",
  "tribalLandFlag": false,
  "icwaFlag": false,
  "indianLawFlag": false,
  "trustLandFlag": false,
  "federalReviewFlag": false,
  "legalFlags": ["list of specific legal concerns detected, e.g. ICWA applies, Trust land assertion, State overreach, Utility shutoff on Indian land"]
}`;
      const prompt = `Analyze this document and extract structured authority fields:\n\n${truncated}`;
      const raw = await callAzureOpenAI(system, prompt, { maxTokens: 900, temperature: 0 });
      const jsonMatch = raw.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        extractionSource = "ai";
      } else {
        throw new Error("No JSON in AI response");
      }
    } catch {
      extracted = extractByRegex(truncated);
      extractionSource = "regex";
    }

    // Apply contextHints overrides
    const matterType = contextHints?.matterType ?? (extracted.detectedMatterType as string | null) ?? detectMatterType(truncated);
    const actionType = (extracted.detectedActionType as string | null) ?? detectActionType(truncated);
    const detectedState = contextHints?.state ?? (extracted.detectedState as string | null);
    const detectedCounty = contextHints?.county ?? (extracted.detectedCounty as string | null);

    // ── Look up routing rule ──────────────────────────────────────────────────
    const [routingRule] = await db
      .select()
      .from(authorityMatterRoutingTable)
      .where(eq(authorityMatterRoutingTable.matterType, matterType))
      .limit(1);

    // ── Legal authorities ─────────────────────────────────────────────────────
    const legalAuthorities = await db
      .select()
      .from(authorityLegalMapTable)
      .where(ilike(authorityLegalMapTable.issueType, `%${matterType}%`));

    // ── Fuzzy agency lookup ───────────────────────────────────────────────────
    let matchedAgencies: (typeof authorityAgenciesTable.$inferSelect)[] = [];
    let matchedAgencyId: number | null = null;

    if (detectedState || (extracted.detectedEntityName as string | null)) {
      const conditions: SQL<unknown>[] = [];
      if (detectedState) conditions.push(eq(authorityAgenciesTable.stateCode, detectedState.toUpperCase()));
      if (detectedCounty) conditions.push(ilike(authorityAgenciesTable.county, `%${detectedCounty}%`));
      if (extracted.detectedEntityName) {
        const entityQ = (extracted.detectedEntityName as string).split(/\s+/).slice(0, 3).join(" ");
        conditions.push(ilike(authorityAgenciesTable.agencyName, `%${entityQ}%`) as SQL<unknown>);
      }

      if (conditions.length > 0) {
        matchedAgencies = await db
          .select()
          .from(authorityAgenciesTable)
          .where(conditions.length === 1 ? conditions[0] : and(...(conditions as [SQL<unknown>, ...SQL<unknown>[]])))
          .limit(5)
          .orderBy(asc(authorityAgenciesTable.confidenceScore));
        matchedAgencyId = matchedAgencies[0]?.id ?? null;
      }
    }

    // ── Build routing recommendation ──────────────────────────────────────────
    const legalFlags = (extracted.legalFlags as string[] | null) ?? [];
    const legalFlagSummary = [
      ...legalFlags,
      ...legalAuthorities.map(la => la.warningOrLimit ?? la.appliesWhen ?? "").filter(Boolean),
    ].slice(0, 8);

    const primaryRecipient = matchedAgencies[0] ?? null;
    const oversightAgency = matchedAgencies.find(a => a.id !== primaryRecipient?.id) ?? null;

    const routingRecommendation = {
      matterType,
      actionType,
      primaryRecipient: primaryRecipient ? {
        id: primaryRecipient.id,
        name: primaryRecipient.agencyName,
        mailingAddress: primaryRecipient.mailingAddress ?? primaryRecipient.physicalAddress ?? null,
        phone: primaryRecipient.phone ?? null,
        contact: primaryRecipient.contactEmail ?? null,
        website: primaryRecipient.website ?? null,
      } : null,
      oversightRecipient: oversightAgency ? {
        id: oversightAgency.id,
        name: oversightAgency.agencyName,
        mailingAddress: oversightAgency.mailingAddress ?? oversightAgency.physicalAddress ?? null,
      } : routingRule?.oversightEntityType ? { name: routingRule.oversightEntityType } : null,
      ccList: routingRule ? [routingRule.oversightEntityType, routingRule.primaryRecipientNote].filter(Boolean) : [],
      legalFlagSummary,
      suggestedTemplateKey: routingRule?.requiredNoticeTemplate ?? null,
      escalationPath: routingRule?.escalationPath ?? null,
      tribalLawApplicable: routingRule?.tribalLawApplicable ?? null,
      legalAuthorities: legalAuthorities.map(la => ({
        authorityName: la.authorityName,
        uscReference: la.uscReference,
        cfrReference: la.cfrReference,
        caseLawReference: la.caseLawReference,
        warningOrLimit: la.warningOrLimit,
        templateSnippet: la.templateLanguageSnippet,
      })),
      suggestedPendingReview: true,
      disclaimer: "System flagged — human review required before any action. This engine flags but does not conclude.",
    };

    // ── Persist extraction ────────────────────────────────────────────────────
    const [saved] = await db
      .insert(authorityIntakeExtractionsTable)
      .values({
        submittedByUserId: userId,
        rawDocumentText: truncated,
        detectedEntityName: (extracted.detectedEntityName as string | null) ?? null,
        detectedAddress: (extracted.detectedAddress as string | null) ?? null,
        detectedDeadline: (extracted.detectedDeadline as string | null) ?? null,
        detectedAccountOrReferenceNumber: (extracted.detectedAccountOrReferenceNumber as string | null) ?? null,
        detectedMatterType: matterType,
        detectedActionType: actionType,
        detectedState,
        detectedCounty,
        detectedApn: (extracted.detectedApn as string | null) ?? null,
        tribalLandFlag: Boolean(extracted.tribalLandFlag),
        icwaFlag: Boolean(extracted.icwaFlag),
        indianLawFlag: Boolean(extracted.indianLawFlag),
        trustLandFlag: Boolean(extracted.trustLandFlag),
        federalReviewFlag: Boolean(extracted.federalReviewFlag),
        legalFlags,
        routingRecommendation,
        suggestedPendingReview: true,
        matchedAgencyId,
        extractionSource,
        contextHints: contextHints ?? {},
      })
      .returning({ id: authorityIntakeExtractionsTable.id });

    logger.info({ id: saved?.id, matterType, extractionSource }, "authority.intake.analyze saved");

    res.status(201).json({
      id: saved?.id ?? null,
      extractionSource,
      detectedEntityName: extracted.detectedEntityName ?? null,
      detectedAddress: extracted.detectedAddress ?? null,
      detectedDeadline: extracted.detectedDeadline ?? null,
      detectedAccountOrReferenceNumber: extracted.detectedAccountOrReferenceNumber ?? null,
      detectedMatterType: matterType,
      detectedActionType: actionType,
      detectedState,
      detectedCounty,
      detectedApn: extracted.detectedApn ?? null,
      tribalLandFlag: Boolean(extracted.tribalLandFlag),
      icwaFlag: Boolean(extracted.icwaFlag),
      indianLawFlag: Boolean(extracted.indianLawFlag),
      trustLandFlag: Boolean(extracted.trustLandFlag),
      federalReviewFlag: Boolean(extracted.federalReviewFlag),
      legalFlags,
      routingRecommendation,
      suggestedPendingReview: true,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET / — list recent extractions ──────────────────────────────────────────

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
    const results = await db
      .select({
        id: authorityIntakeExtractionsTable.id,
        submittedByUserId: authorityIntakeExtractionsTable.submittedByUserId,
        detectedEntityName: authorityIntakeExtractionsTable.detectedEntityName,
        detectedMatterType: authorityIntakeExtractionsTable.detectedMatterType,
        detectedActionType: authorityIntakeExtractionsTable.detectedActionType,
        detectedState: authorityIntakeExtractionsTable.detectedState,
        detectedCounty: authorityIntakeExtractionsTable.detectedCounty,
        tribalLandFlag: authorityIntakeExtractionsTable.tribalLandFlag,
        icwaFlag: authorityIntakeExtractionsTable.icwaFlag,
        indianLawFlag: authorityIntakeExtractionsTable.indianLawFlag,
        federalReviewFlag: authorityIntakeExtractionsTable.federalReviewFlag,
        extractionSource: authorityIntakeExtractionsTable.extractionSource,
        suggestedPendingReview: authorityIntakeExtractionsTable.suggestedPendingReview,
        createdAt: authorityIntakeExtractionsTable.createdAt,
      })
      .from(authorityIntakeExtractionsTable)
      .orderBy(desc(authorityIntakeExtractionsTable.createdAt))
      .limit(limit);

    res.json({ count: results.length, results });
  } catch (err) {
    next(err);
  }
});

// ── GET /:id — get single extraction ─────────────────────────────────────────

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid extraction ID" });
      return;
    }
    const [record] = await db
      .select()
      .from(authorityIntakeExtractionsTable)
      .where(eq(authorityIntakeExtractionsTable.id, id))
      .limit(1);

    if (!record) {
      res.status(404).json({ error: "Extraction record not found" });
      return;
    }
    res.json(record);
  } catch (err) {
    next(err);
  }
});

export default router;
