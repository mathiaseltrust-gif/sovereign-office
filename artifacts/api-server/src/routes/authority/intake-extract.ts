/**
 * POST /api/authority/intake-extract
 *
 * AI-powered document intake analysis. Extracts:
 *   - Entity names, addresses, deadlines, reference numbers
 *   - Matter type, action type, state/county/APN
 *   - Tribal land, ICWA, Indian law, trust land, federal review flags
 *   - A routing recommendation (always flagged suggestedPendingReview: true)
 *
 * Safety rule: all routing recommendations set suggestedPendingReview: true.
 * The engine flags but NEVER concludes — human review always required.
 */
import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import {
  authorityIntakeExtractionsTable,
  authorityMatterRoutingTable,
  authorityAgenciesTable,
} from "@workspace/db";
import { eq, ilike, and } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

// ── Regex-based extraction fallback ──────────────────────────────────────────

function extractByRegex(text: string): Record<string, unknown> {
  const apn = text.match(/(?:APN|Assessor.{0,15}Parcel|Parcel\s*(?:No\.?|Number))[:\s#]*([A-Z0-9\-\.]+)/i)?.[1] ?? null;
  const address = text.match(/(\d{3,6}\s+[A-Z][A-Za-z ]+(?:Rd|Road|Ave|Avenue|Blvd|Boulevard|Dr|Drive|St|Street|Ln|Lane|Way|Ct|Court|Pkwy)[^\n\r,]{0,80})/i)?.[1]?.trim() ?? null;
  const deadline = text.match(/(?:due|deadline|respond by|response due|must respond)[:\s]+([^\n\r]{5,60})/i)?.[1]?.trim() ?? null;
  const refNum = text.match(/(?:Account|Case|Reference|File|Receipt)\s*(?:No\.?|Number|#)[:\s]*([A-Z0-9\-\/]+)/i)?.[1] ?? null;
  const stateMatch = text.match(/\b(California|Michigan|Arizona|New Mexico|Oklahoma|Washington|Montana|North Dakota|South Dakota|Minnesota|Wisconsin|New York|Florida|Texas|Oregon|Idaho|Nevada|Alaska|Hawaii|Colorado|Kansas|Nebraska|Iowa|Missouri|Arkansas|Louisiana|Mississippi|Alabama|Georgia|North Carolina|South Carolina|Virginia|West Virginia|Pennsylvania|New Jersey|Connecticut|Rhode Island|Massachusetts|Vermont|New Hampshire|Maine|Delaware|Maryland|Indiana|Illinois|Ohio|Kentucky|Tennessee)\b/i)?.[1] ?? null;
  const stateAbbrev = !stateMatch ? text.match(/\b(CA|MI|AZ|NM|OK|WA|MT|ND|SD|MN|WI|NY|FL|TX|OR|ID|NV|AK|HI|CO|KS|NE|IA|MO|AR|LA|MS|AL|GA|NC|SC|VA|WV|PA|NJ|CT|RI|MA|VT|NH|ME|DE|MD|IN|IL|OH|KY|TN)\b/)?.[1] ?? null : null;
  const county = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+County/i)?.[1]?.trim() ?? null;
  const entityName = text.match(/(?:Owner|Grantor|Grantee|Petitioner|Respondent|Plaintiff|Defendant|Filed by|Issued to|Addressed to)[:\s]+([A-Z][A-Za-z\s,\.]+?)(?:\n|,|and|dated|v\.|vs\.)/i)?.[1]?.trim() ?? null;

  return {
    detectedEntityName: entityName,
    detectedAddress: address,
    detectedDeadline: deadline,
    detectedAccountOrReferenceNumber: refNum,
    detectedApn: apn,
    detectedState: stateMatch ?? stateAbbrev,
    detectedCounty: county,
    tribalLandFlag: /tribal\s+trust|tribal\s+land|indian\s+trust|allotment|restricted\s+fee|indian\s+country/i.test(text),
    icwaFlag: /\b(icwa|indian\s+child\s+welfare|foster|adoption\s+of|removal\s+of\s+(?:an?\s+)?(?:indian|native)|placement\s+of\s+(?:an?\s+)?(?:indian|native))\b/i.test(text),
    indianLawFlag: /\b(25\s+u\.s\.c|indian\s+reorganization\s+act|tribal\s+sovereignty|federal\s+trust|bureau\s+of\s+indian|bia\b|trust\s+responsibility|indian\s+country|federal\s+indian\s+law)\b/i.test(text),
    trustLandFlag: /\b(trust\s+land|in\s+trust|held\s+in\s+trust|tribal\s+trust|individual\s+(?:indian\s+)?trust|allotment|restricted\s+fee)\b/i.test(text),
    federalReviewFlag: /\b(federal\s+review|department\s+of\s+interior|bia\b|bureau\s+of\s+indian|united\s+states\s+v\.|federal\s+court|federal\s+law\s+applies)\b/i.test(text),
    source: "regex",
  };
}

function detectMatterType(text: string): string {
  const t = text.toLowerCase();
  if (/icwa|indian\s+child\s+welfare|foster|removal\s+of\s+(?:an?\s+)?(?:indian|native)|adoption\s+of/.test(t)) return "icwa_violation";
  if (/tax\s+lien|notice\s+of\s+lien|lien\s+certificate/.test(t)) return "tax_lien";
  if (/property\s+tax|tax\s+notice|notice\s+of\s+assessment|assessed\s+value|taxable\s+value/.test(t)) return "tax_assessment";
  if (/foreclos/.test(t)) return "foreclosure";
  if (/court\s+order|judgment|order\s+of\s+court/.test(t)) return "court_order";
  if (/zoning|permit|ordinance|building\s+code/.test(t)) return "zoning";
  if (/state\s+(?:law|jurisdiction|authority|court)|county\s+(?:ordinance|jurisdiction)/.test(t) && /tribal|tribe|indian|sovereign/.test(t)) return "jurisdictional_overreach";
  if (/warranty\s+deed|quitclaim|grant\s+deed|deed\s+of\s+trust/.test(t)) return "deed";
  if (/enrollment|tribal\s+id|cdib|degree\s+of\s+indian\s+blood/.test(t)) return "identity_verification";
  if (/trust\s+declaration|irrevocable\s+trust|declaration\s+of\s+trust/.test(t)) return "trust_declaration";
  return "general";
}

function detectActionType(text: string): string {
  const t = text.toLowerCase();
  if (/demand|comply|pay\s+now|must\s+pay|cease\s+and\s+desist|you\s+are\s+ordered/.test(t)) return "demand";
  if (/notice|notif/.test(t)) return "notice";
  if (/complaint|formal\s+complaint|grievance/.test(t)) return "complaint";
  if (/petition|request|motion/.test(t)) return "petition";
  if (/order|decree|judgment/.test(t)) return "order";
  return "informational";
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const {
      text,
      contextHints,
    } = req.body as {
      text: string;
      contextHints?: Record<string, unknown>;
    };

    if (!text || typeof text !== "string" || text.trim().length < 20) {
      res.status(400).json({ error: "text field is required (min 20 characters)" });
      return;
    }

    const userId = req.user?.dbId ?? null;
    const truncated = text.substring(0, 8000);

    let extracted: Record<string, unknown> = {};
    let extractionSource = "ai";

    // ── Try Azure OpenAI first ────────────────────────────────────────────────
    try {
      const { callAzureOpenAI } = await import("../../lib/azure-openai");
      const system = `You are a sovereign tribal legal office document analyst. Extract structured fields from legal, government, and administrative documents. Focus on details relevant to tribal law, Indian country, and sovereign rights.

Respond ONLY with valid JSON. Use null for fields not found. Shape:
{
  "detectedEntityName": "primary person or organization the document is about or null",
  "detectedAddress": "property or mailing address or null",
  "detectedDeadline": "response deadline or action-required date or null",
  "detectedAccountOrReferenceNumber": "account, case, file, or reference number or null",
  "detectedMatterType": "one of: icwa_violation | tax_lien | tax_assessment | foreclosure | court_order | zoning | jurisdictional_overreach | deed | identity_verification | trust_declaration | general",
  "detectedActionType": "one of: demand | notice | complaint | petition | order | informational",
  "detectedState": "2-letter state code or null",
  "detectedCounty": "county name without the word County or null",
  "detectedApn": "Assessor Parcel Number or null",
  "tribalLandFlag": false,
  "icwaFlag": false,
  "indianLawFlag": false,
  "trustLandFlag": false,
  "federalReviewFlag": false,
  "legalFlags": ["list of specific legal concerns detected, e.g. ICWA applies, Trust land assertion, State overreach"]
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
      if (!extracted.detectedMatterType) {
        extracted.detectedMatterType = detectMatterType(truncated);
      }
      if (!extracted.detectedActionType) {
        extracted.detectedActionType = detectActionType(truncated);
      }
    }

    const matterType = (extracted.detectedMatterType as string | null) ?? detectMatterType(truncated);
    const actionType = (extracted.detectedActionType as string | null) ?? detectActionType(truncated);

    // ── Look up routing rule ──────────────────────────────────────────────────
    const [routingRule] = await db
      .select()
      .from(authorityMatterRoutingTable)
      .where(eq(authorityMatterRoutingTable.matterType, matterType))
      .limit(1);

    // ── Look up matched agency if state/county present ────────────────────────
    let matchedAgencyId: number | null = null;
    const detectedState = extracted.detectedState as string | null;
    const detectedCounty = extracted.detectedCounty as string | null;

    if (detectedState && routingRule?.primaryEntityType) {
      const conditions = [ilike(authorityAgenciesTable.stateCode, detectedState.toUpperCase())];
      if (detectedCounty) conditions.push(ilike(authorityAgenciesTable.county, `%${detectedCounty}%`));
      const [matchedAgency] = await db
        .select({ id: authorityAgenciesTable.id })
        .from(authorityAgenciesTable)
        .where(and(...conditions))
        .limit(1);
      matchedAgencyId = matchedAgency?.id ?? null;
    }

    // ── Build routing recommendation (always pending review) ─────────────────
    const legalFlags = (extracted.legalFlags as string[] | null) ?? [];
    const routingRecommendation = {
      matterType,
      actionType,
      routingRule: routingRule ?? null,
      matchedAgencyId,
      suggestedPendingReview: true,
      disclaimer: "System flagged — human review required before any action.",
    };

    // ── Persist extraction to DB ──────────────────────────────────────────────
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
        detectedState: (extracted.detectedState as string | null) ?? null,
        detectedCounty: (extracted.detectedCounty as string | null) ?? null,
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

    logger.info({ id: saved?.id, matterType, extractionSource }, "authority.intake-extract saved");

    res.status(201).json({
      id: saved?.id ?? null,
      extractionSource,
      ...extracted,
      detectedMatterType: matterType,
      detectedActionType: actionType,
      routingRecommendation,
      suggestedPendingReview: true,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/authority/intake-extract — list recent extractions ───────────────
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
    const { db: drizzleDb } = await import("@workspace/db");
    const { desc } = await import("drizzle-orm");
    const results = await drizzleDb
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

// ── GET /api/authority/intake-extract/:id — get single extraction ─────────────
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
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
