import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { processIntake } from "../../engines/intake-pipeline";
import { appendIntakeFact } from "../../lib/redis-memory";

const router = Router();

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { text, context } = req.body as {
      text: string;
      context?: {
        caseType?: string;
        actorType?: string;
        landStatus?: string;
        actionType?: string;
        childInvolved?: boolean;
        tribe?: string;
        court?: string;
        role?: string;
      };
    };

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "text field is required" });
      return;
    }

    const user = req.user;
    const userId = user?.dbId;

    const { report, meta } = await processIntake({ text, userId, context });

    // Fire-and-forget: persist this intake into the user's long-term memory
    if (userId) {
      const r = report as unknown as Record<string, unknown>;
      const riskLevel = (r.riskLevel as string)
        ?? (r.tier as string)
        ?? "standard";
      const summary = (r.summary as string)
        ?? (r.factSummary as string)
        ?? text.substring(0, 80);
      const docType = context?.caseType;
      const name = user?.name ?? user?.email?.split("@")[0];
      const role = (user as Record<string, unknown>)?.activeRole as string ?? undefined;
      appendIntakeFact(userId, { riskLevel, summary, docType, name, role }).catch(() => {});
    }

    res.status(200).json({ ...report, _meta: meta });
  } catch (err) {
    next(err);
  }
});

router.get("/status", requireAuth, async (_req, res) => {
  const { callAzureOpenAI } = await import("../../lib/azure-openai");
  const azureConfigured = !!process.env.AZURE_OPENAI_API_KEY && !!process.env.AZURE_OPENAI_ENDPOINT && !!process.env.AZURE_OPENAI_DEPLOYMENT;
  const entraConfigured = !!process.env.AZURE_ENTRA_TENANT_ID && !!process.env.AZURE_ENTRA_CLIENT_ID;

  let azureDeploymentReachable = false;
  let azureError: string | null = null;
  if (azureConfigured) {
    try {
      await callAzureOpenAI("You are a health check.", "Respond with OK.", { maxTokens: 3, timeoutMs: 8000 });
      azureDeploymentReachable = true;
    } catch (e) {
      azureError = (e as Error).message.substring(0, 120);
    }
  }

  res.json({
    tiers: [
      {
        tier: 1,
        name: "Azure OpenAI",
        status: azureDeploymentReachable ? "ready" : azureConfigured ? "deployment_not_found" : "not_configured",
        model: process.env.AZURE_OPENAI_DEPLOYMENT ?? null,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT ?? null,
        error: azureError,
        action: !azureDeploymentReachable
          ? "In Azure Portal → tribal-openai-service → Model deployments → Deploy model → Choose gpt-4o (2024-11-20) → Set deployment name to 'tribal-gpt4o'"
          : null,
      },
      {
        tier: 2,
        name: "Rule-Based AI Intake Agent",
        status: "ready",
        description: "Pattern-matching intake filter with 10 violation categories",
      },
      {
        tier: 3,
        name: "Legal-Logic + Delegated Authority Engine",
        status: "ready",
        description: "Law-DB cross-referencing + authority computation",
      },
      {
        tier: 4,
        name: "Hard Sovereign Defaults",
        status: "ready",
        description: "ICWA, Trust, Tribal Medical Authority — always active fallback",
      },
    ],
    entra: {
      configured: entraConfigured,
      tenantId: process.env.AZURE_ENTRA_TENANT_ID ? `${process.env.AZURE_ENTRA_TENANT_ID.substring(0, 8)}…` : null,
      clientId: process.env.AZURE_ENTRA_CLIENT_ID ? `${process.env.AZURE_ENTRA_CLIENT_ID.substring(0, 8)}…` : null,
      jwtValidation: entraConfigured ? "active" : "disabled",
    },
    sovereignty: "PRESERVED — fallback chain ensures zero downtime",
  });
});

// ── extract-fields: pull structured data from document text ───────────────────
// mode=reference (default): case numbers, parties, dates, amounts
// mode=identity-status: identity earmarks, land status, rights triggers
router.post("/extract-fields", requireAuth, async (req, res, next) => {
  try {
    const { text, mode } = req.body as { text: string; mode?: string };
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "text field is required" });
      return;
    }
    const truncated = text.substring(0, 8000);

    // ── identity-status mode: extract legally meaningful earmarks ─────────────
    if (mode === "identity-status") {
      try {
        const { callAzureOpenAI } = await import("../../lib/azure-openai");
        const { IDENTITY_STATUS_EXTRACTION_SCHEMA } = await import("../../engines/rights-engine");
        const system = `You are a sovereign tribal legal office identity analyst. Your function is to extract legally significant identity, land status, and rights trigger markers from legal and government documents. These earmarks determine a member's sovereign standing, land protections, and which federal Indian law rights apply to them.

Do NOT extract biographical details (nickname, preferred name, social media handles, etc.). Extract ONLY the legally significant signals.

Respond ONLY with valid JSON. Use null for fields not found. JSON shape:
{
  "identityMarkers": {
    "namesFound": ["legal names and formal aliases only"],
    "tribalAffiliation": "tribe/nation name or null",
    "enrollmentNumber": "enrollment or roll number or null",
    "cdbNumber": "CDIB Certificate of Degree of Indian Blood number or null",
    "biaNumber": "BIA agency or case number or null",
    "allotmentNumber": "allotment number or null",
    "membershipEvidence": "direct text asserting tribal membership or Indian status or null",
    "lineageEvidence": "text referencing ancestry, descendancy, or blood quantum or null"
  },
  "landStatusMarkers": {
    "apn": "Assessor Parcel Number or null",
    "trustStatus": "one of: individual_trust | tribal_trust | allotment | restricted_fee | fee | indian_country | unknown | null",
    "indianCountryDesignation": "explicit reference to Indian country or reservation or null",
    "biaFieldOffice": "BIA agency or field office name or null",
    "recordedInstruments": ["deed, trust declaration, or instrument references"],
    "propertyAddress": "physical address of land or null"
  },
  "rightsTriggered": {
    "icwaApplies": false,
    "trustResponsibility": false,
    "worcesterApplies": false,
    "treatyRightsMentioned": ["treaty rights cited"],
    "federalProtectionsCited": ["federal Indian law citations found"]
  },
  "sovereignStanding": {
    "partyIdentifiedAsIndian": false,
    "jurisdictionAsserted": "claimed jurisdiction or null",
    "courtCaptionFound": "formal caption if present or null",
    "governmentActorInvolved": "state/county/federal agency as party or null"
  }
}`;
        const prompt = `Extract identity status, land status, and rights earmarks from this document:\n\n${truncated}`;
        const raw = await callAzureOpenAI(system, prompt, { maxTokens: 1200 });
        const jsonMatch = raw.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          res.json({ source: "ai", mode: "identity-status", ...JSON.parse(jsonMatch[0]) });
          return;
        }
      } catch { /* fall through to regex */ }

      // Regex fallback for identity-status mode
      const lower = truncated.toLowerCase();
      const apnMatch = truncated.match(/(?:APN|Assessor.{0,15}Parcel|Parcel\s*(?:No\.?|Number)|Property\s*(?:No\.?|Number))[:\s#]*([A-Z0-9\-\.]+)/i);
      const enrollMatch = truncated.match(/(?:enrollment\s*(?:no\.?|number|#)|roll\s*(?:no\.?|number)|membership\s*(?:no\.?|number))[:\s]*([A-Z0-9\-]+)/i);
      const allotMatch = truncated.match(/(?:allotment\s*(?:no\.?|number|#))[:\s]*([A-Z0-9\-]+)/i);
      const biaMatch = truncated.match(/(?:BIA|Bureau of Indian Affairs)\s*(?:No\.?|#|case)?\s*([A-Z0-9\-\/]+)/i);
      const trustStatus =
        /tribal\s+trust/i.test(truncated) ? "tribal_trust" :
        /individual\s+trust|individual\s+indian\s+trust/i.test(truncated) ? "individual_trust" :
        /allotment|allotted/i.test(truncated) ? "allotment" :
        /restricted\s+(?:fee|land)/i.test(truncated) ? "restricted_fee" :
        /indian\s+country/i.test(truncated) ? "indian_country" :
        /trust\s+land|in\s+trust/i.test(truncated) ? "individual_trust" :
        /fee\s+land|in\s+fee/i.test(truncated) ? "fee" : null;
      const icwaApplies = /\b(icwa|child welfare|foster|adoption|removal|custody|placement|wardship)\b/i.test(truncated);
      const trustResp = /\b(trust\s+responsibility|fiduciary|federal\s+trust)\b/i.test(truncated);
      const worcesterApplies = /\b(state\s+law|county|local\s+jurisdiction|state\s+court)\b/i.test(truncated) && /\b(tribe|tribal|indian\s+land|reservation)\b/i.test(truncated);
      const membershipEvidence = /\b(member\s+of|tribal\s+member|enrolled\s+member|indian\s+status|indian\s+person)\b/i.test(truncated)
        ? "Membership or Indian status assertion found in document" : null;
      const names: string[] = [];
      const namePattern = /\b([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/g;
      let m: RegExpExecArray | null;
      while ((m = namePattern.exec(truncated)) !== null && names.length < 6) {
        names.push(m[1]);
      }

      res.json({
        source: "regex",
        mode: "identity-status",
        identityMarkers: {
          namesFound: [...new Set(names)],
          tribalAffiliation: lower.includes("mathias el tribe") ? "Mathias El Tribe" : lower.includes("moors") ? "Moorish" : null,
          enrollmentNumber: enrollMatch?.[1] ?? null,
          cdbNumber: null,
          biaNumber: biaMatch?.[1] ?? null,
          allotmentNumber: allotMatch?.[1] ?? null,
          membershipEvidence,
          lineageEvidence: /\b(descendant|lineage|ancestry|blood\s+quantum|born\s+of)\b/i.test(truncated) ? "Lineage reference detected" : null,
        },
        landStatusMarkers: {
          apn: apnMatch?.[1] ?? null,
          trustStatus,
          indianCountryDesignation: /indian\s+country|reservation|pueblo/i.test(truncated) ? "Indian land reference detected" : null,
          biaFieldOffice: biaMatch ? `BIA reference: ${biaMatch[0]}` : null,
          recordedInstruments: [],
          propertyAddress: null,
        },
        rightsTriggered: {
          icwaApplies,
          trustResponsibility: trustResp,
          worcesterApplies,
          treatyRightsMentioned: [],
          federalProtectionsCited: icwaApplies ? ["25 U.S.C. §§ 1901–1963 (ICWA)"] : [],
        },
        sovereignStanding: {
          partyIdentifiedAsIndian: !!membershipEvidence || /\bindian\b/i.test(truncated),
          jurisdictionAsserted: /tribal\s+court/i.test(truncated) ? "Tribal court jurisdiction" : /federal\s+court/i.test(truncated) ? "Federal court" : null,
          courtCaptionFound: null,
          governmentActorInvolved: /\b(CPS|DCFS|DHS|Department of Health|Child Protective|Social Services|State of|County of|City of)\b/i.exec(truncated)?.[0] ?? null,
        },
      });
      return;
    }

    // ── reference mode (default): case numbers, parties, dates, amounts ───────
    try {
      const { callAzureOpenAI } = await import("../../lib/azure-openai");
      const system = `You are a legal document reference extractor for a sovereign tribal legal office. Extract structured reference fields from legal and government documents. Respond ONLY with valid JSON — no explanation, no markdown. Use null for fields not found in the text. JSON shape: { "documentType", "caseNumber", "docketNumber", "propertyNumber", "propertyAddress", "receiptNumber", "court", "judge", "parties": { "plaintiffs":[], "defendants":[], "petitioners":[], "respondents":[], "agencies":[] }, "dates":[], "amounts":[], "allegations":[] }`;
      const prompt = `Extract reference fields from this legal document and return JSON only:\n\n${truncated}`;

      const raw = await callAzureOpenAI(system, prompt, { maxTokens: 1000 });
      const jsonMatch = raw.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        res.json({ source: "ai", ...parsed });
        return;
      }
    } catch { /* fall through to regex */ }

    // Regex fallback for reference mode
    const caseMatch = truncated.match(/(?:Case\s*(?:No\.?|Number|#)\s*|Cause\s*(?:No\.?|Number|#)\s*)([A-Z0-9\-:\/]+)/i);
    const docketMatch = truncated.match(/Docket\s*(?:No\.?|Number|#)\s*([A-Z0-9\-:\/]+)/i);
    const propertyAddrMatch = truncated.match(/(?:property\s+address|premises\s+(?:at|located)|located\s+at|situate[d]?\s+at)[:\s]+([^\n\r]{10,100})/i);
    const apnRefMatch = truncated.match(/(?:APN|Assessor.{0,15}Parcel|Parcel\s*(?:No\.?|Number)|Property\s*(?:No\.?|Number))[:\s#]*([A-Z0-9\-\.]+)/i);
    const receiptMatch = truncated.match(/(?:Receipt\s*(?:No\.?|Number|#)|Reference\s*(?:No\.?|#)|Account\s*(?:No\.?|Number|#))[:\s]*([A-Z0-9\-]+)/i);
    const amounts = (truncated.match(/\$[\d,]+(?:\.\d{2})?/g) ?? []).slice(0, 8);
    const dates = (truncated.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g) ?? []).slice(0, 8);
    const plaintiffMatch = truncated.match(/(?:Plaintiff|Petitioner)[:\s,]+([A-Z][A-Za-z\s,\.]+?)(?:\n|vs?\.|defendant|respondent)/i);
    const defendantMatch = truncated.match(/(?:Defendant|Respondent)[:\s,]+([A-Z][A-Za-z\s,\.]+?)(?:\n|,|\.|and)/i);

    res.json({
      source: "regex",
      caseNumber: caseMatch?.[1] ?? null,
      docketNumber: docketMatch?.[1] ?? null,
      propertyAddress: propertyAddrMatch?.[1]?.trim() ?? null,
      propertyNumber: apnRefMatch?.[1] ?? null,
      receiptNumber: receiptMatch?.[1] ?? null,
      parties: {
        plaintiffs: plaintiffMatch?.[1] ? [plaintiffMatch[1].trim()] : [],
        defendants: defendantMatch?.[1] ? [defendantMatch[1].trim()] : [],
      },
      amounts,
      dates,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
