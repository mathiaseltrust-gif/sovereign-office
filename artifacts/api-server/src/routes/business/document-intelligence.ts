import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { callAzureOpenAI, getAzureOpenAIClient } from "../../lib/azure-openai";
import { logger } from "../../lib/logger";

const router = Router();

const DOC_INTEL_SYSTEM_PROMPT = `You are the Sovereign Document Intelligence Engine for the Mathias El Tribe Office of the Chief Justice & Trustee.

Your task: analyze any document uploaded during a tribal intake and return structured intelligence in two layers.

LAYER 1 — DOCUMENT EXTRACTION (facts only, no guessing):
Extract every piece of structured information explicitly present in the document text.

LAYER 2 — TRIBAL LOGIC (apply federal Indian law rules):
Apply these rules to every document you analyze:

RULE 1 — IHS / URBAN INDIAN HEALTH:
If the document references Indian Health Service (IHS), Urban Indian Health Program, or Indian health facility → the member is classified as "Indian" under federal trust responsibility (IHCIA, 25 U.S.C. § 1603; Snyder Act 25 U.S.C. § 13). Flag: TRUST_RESPONSIBILITY_TRIGGERED.

RULE 2 — STATE SECRETARY OF STATE FILING:
If the document is a Statement of Information, Articles of Incorporation, Annual Report, or similar Secretary of State filing → classify as official state business document. Note: existing state-chartered entities may be re-chartered under tribal sovereign authority for additional immunity protections (IRA § 477). Flag: STATE_ENTITY_ON_FILE.

RULE 3 — TRIBAL ARM / SOVEREIGN ENTERPRISE:
If the document references "Tribal Arm," "tribal government," "Mathias El Tribe," or similar → this is a sovereign enterprise. Apply full sovereign immunity doctrine (Santa Clara Pueblo v. Martinez, 436 U.S. 49). Flag: SOVEREIGN_ENTERPRISE.

RULE 4 — THREAT SIGNALS:
If the document references foreclosure, tax lien, eviction, notice of default, or forced removal → trigger PROTECTIVE_ACTION_REQUIRED.
If ICWA, custody, adoption, or child welfare → trigger ICWA_STANDING.
If blood quantum, enrollment denial, or identity challenge → trigger IDENTITY_DEFENSE.

RULE 5 — ENTITY NOT IN TRIBAL SYSTEM:
Any identified business entity not already marked as tribally chartered should be flagged for registration: ENTITY_REGISTRATION_RECOMMENDED.

OUTPUT — respond ONLY with a valid JSON object matching this exact schema (no markdown, no explanation):
{
  "documentClass": "state_filing" | "health_record" | "legal_notice" | "contract" | "identity_document" | "financial" | "other",
  "documentType": "descriptive label e.g. Statement of Information — Corporation",
  "isOfficial": true | false,
  "filingAuthority": "string or null",
  "filingState": "string or null",
  "filingDate": "string or null",
  "filingNumber": "string or null",
  "entityName": "string or null",
  "entityType": "LLC" | "Corporation" | "Partnership" | "Sole Proprietor" | "Other" | null,
  "entityNumber": "string or null",
  "formedIn": "string or null",
  "principalAddress": "string or null",
  "typeOfBusiness": "string or null",
  "parties": [{ "name": "string", "role": "string" }],
  "tribalFlags": ["array of rule labels that were triggered"],
  "tribalLogic": ["array of plain-English legal reasoning sentences — one per triggered rule"],
  "logicSummary": "2-3 sentence plain English: what this document is, what it legally means for the member, and what action the tribe should take",
  "recommendedAction": "upsert_business" | "flag_trust_responsibility" | "store_document" | "note_identity" | "none",
  "intakeAnswers": {
    "businessType": "string or null",
    "businessName": "string or null",
    "targetCommunity": "string or null",
    "existingActivity": "string or null",
    "vision": null
  }
}`;

function extractParties(text: string): Array<{ name: string; role: string }> {
  const parties: Array<{ name: string; role: string }> = [];
  const lines = text.split("\n");
  const roleKeywords = [
    "Chief Executive Officer", "Chief Financial Officer", "Secretary",
    "Director", "Manager", "Member", "Agent", "President", "Treasurer",
    "CEO", "CFO", "COO", "Officer",
  ];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;
    for (const role of roleKeywords) {
      if (trimmed.toLowerCase().includes(role.toLowerCase())) {
        const namePart = trimmed.replace(new RegExp(role, "gi"), "").replace(/[•+,]/g, "").trim();
        if (namePart.length > 2 && namePart.length < 120) {
          const existing = parties.find((p) => p.name === namePart);
          if (existing) {
            existing.role = existing.role.includes(role) ? existing.role : `${existing.role}, ${role}`;
          } else {
            parties.push({ name: namePart, role });
          }
        }
        break;
      }
    }
  }
  return parties.slice(0, 10);
}

function ruleBasedExtract(text: string, filename: string): object {
  const lower = text.toLowerCase();

  let documentClass = "other";
  let documentType = "Document";
  let isOfficial = false;
  let filingAuthority: string | null = null;
  let filingState: string | null = null;

  const stateNames: Record<string, string> = {
    california: "California", texas: "Texas", florida: "Florida",
    "new york": "New York", nevada: "Nevada", arizona: "Arizona",
    washington: "Washington", oregon: "Oregon", colorado: "Colorado",
  };
  for (const [key, val] of Object.entries(stateNames)) {
    if (lower.includes(key)) { filingState = val; break; }
  }

  if (lower.includes("secretary of state") || lower.includes("statement of information") ||
      lower.includes("articles of incorporation") || lower.includes("annual report") ||
      lower.includes("articles of organization")) {
    documentClass = "state_filing";
    isOfficial = true;
    filingAuthority = filingState ? `${filingState} Secretary of State` : "Secretary of State";
    if (lower.includes("statement of information")) {
      documentType = lower.includes("limited liability") || lower.includes("llc")
        ? "Statement of Information — LLC"
        : lower.includes("corporation") ? "Statement of Information — Corporation"
        : "Statement of Information";
    } else if (lower.includes("articles of incorporation")) {
      documentType = "Articles of Incorporation";
    } else if (lower.includes("articles of organization")) {
      documentType = "Articles of Organization — LLC";
    } else if (lower.includes("annual report")) {
      documentType = "Annual Report";
    } else {
      documentType = "State Business Filing";
    }
  } else if (lower.includes("ihs") || lower.includes("indian health") || lower.includes("urban indian")) {
    documentClass = "health_record";
    documentType = "Indian Health Service / Urban Indian Health Document";
    filingAuthority = "Indian Health Service";
  } else if (lower.includes("foreclosure") || lower.includes("eviction") || lower.includes("tax lien") || lower.includes("notice of default")) {
    documentClass = "legal_notice";
    documentType = "Legal Threat Notice";
    isOfficial = true;
  }

  const entityNameMatch = text.match(/(?:Corporation Name|Limited Liability Company Name|LLC Name|Entity Name)[:\s]+([A-Z][A-Z0-9\s,'&.()-]+?)(?:\n|Entity No|$)/m);
  const entityName = entityNameMatch ? entityNameMatch[1].trim().replace(/\s+/g, " ") : null;

  let entityType: "LLC" | "Corporation" | "Partnership" | "Sole Proprietor" | "Other" | null = null;
  if (lower.includes("limited liability company") || lower.includes("llc")) entityType = "LLC";
  else if (lower.includes("corporation")) entityType = "Corporation";
  else if (lower.includes("partnership")) entityType = "Partnership";

  const entityNumMatch = text.match(/Entity No[\.:\s]+(\w[\w-]+)/i);
  const entityNumber = entityNumMatch ? entityNumMatch[1].trim() : null;

  const fileDateMatch = text.match(/Date Filed[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const filingDate = fileDateMatch ? fileDateMatch[1] : null;

  const fileNumMatch = text.match(/File No[\.:\s]+([A-Z0-9]+)/i);
  const filingNumber = fileNumMatch ? fileNumMatch[1] : null;

  const formedMatch = text.match(/Formed In[:\s]+([A-Z][A-Za-z ]+?)(?:\n|$)/im);
  const formedIn = formedMatch ? formedMatch[1].trim() : null;

  const addrMatch = text.match(/Principal Address[:\s]+([^\n]+(?:\n[^\n]+)?)/i);
  const principalAddress = addrMatch ? addrMatch[1].trim().replace(/\s{2,}/g, " ") : null;

  const bizTypeMatch = text.match(/Type of Business[:\s]+([^\n]+(?:\n[^\n]+)?)/i);
  const typeOfBusiness = bizTypeMatch ? bizTypeMatch[1].trim().replace(/\s{2,}/g, " ") : null;

  const parties = extractParties(text);

  const tribalFlags: string[] = [];
  const tribalLogic: string[] = [];

  if (lower.includes("ihs") || lower.includes("indian health") || lower.includes("urban indian")) {
    tribalFlags.push("TRUST_RESPONSIBILITY_TRIGGERED");
    tribalLogic.push(
      "This document references IHS or Urban Indian Health services. Under IHCIA (25 U.S.C. § 1603) and Snyder Act (25 U.S.C. § 13), any person who receives IHS or Urban Indian Health services is classified as Indian under federal trust responsibility — regardless of enrollment status or BIA list placement."
    );
  }
  if (documentClass === "state_filing") {
    tribalFlags.push("STATE_ENTITY_ON_FILE");
    tribalLogic.push(
      `This is an official ${filingState ?? "state"} Secretary of State filing. The entity can be re-chartered under tribal sovereign authority under IRA § 477, gaining full sovereign immunity protections not available to state-chartered entities.`
    );
  }
  if (lower.includes("tribal arm") || lower.includes("tribal government") || lower.includes("mathias el tribe")) {
    tribalFlags.push("SOVEREIGN_ENTERPRISE");
    tribalLogic.push(
      "This entity is identified as a Tribal Arm or sovereign enterprise. Under the doctrine of tribal sovereign immunity (Santa Clara Pueblo v. Martinez, 436 U.S. 49), this entity is immune from suit in state courts without an express tribal waiver."
    );
  }
  if (entityName) {
    tribalFlags.push("ENTITY_REGISTRATION_RECOMMENDED");
    tribalLogic.push(
      `${entityName} (${entityType ?? "entity"}) can be registered in the tribal system and issued a Tribal Business License, adding sovereign protections, tax-exemption on tribal operations, and Buy Indian Act contracting preference (25 U.S.C. § 47).`
    );
  }
  if (lower.includes("foreclosure") || lower.includes("tax lien") || lower.includes("notice of default")) {
    tribalFlags.push("PROTECTIVE_ACTION_REQUIRED");
    tribalLogic.push(
      "This document contains legal threat signals (foreclosure, tax lien, or notice of default). Immediate sovereign review is required. Trust land protections and federal court jurisdiction under 28 U.S.C. § 1505 may apply."
    );
  }
  if (lower.includes("icwa") || lower.includes("custody") || lower.includes("adoption")) {
    tribalFlags.push("ICWA_STANDING");
    tribalLogic.push(
      "This document triggers ICWA jurisdiction (25 U.S.C. § 1901 et seq.). The tribe has the right to intervene in any custody or adoption proceeding involving a member child."
    );
  }

  const recommendedAction = entityName
    ? "upsert_business"
    : tribalFlags.includes("TRUST_RESPONSIBILITY_TRIGGERED")
    ? "flag_trust_responsibility"
    : "store_document";

  const logicSummary = entityName
    ? `This is an official ${documentType} for ${entityName}${entityType ? ` (${entityType})` : ""}${filingState ? `, registered in ${filingState}` : ""}${filingDate ? `, filed ${filingDate}` : ""}. ${tribalFlags.includes("SOVEREIGN_ENTERPRISE") ? "It is identified as a Tribal Arm with sovereign immunity protections. " : ""}This entity can be registered in the tribal system and issued sovereign business protections under federal Indian law.`
    : tribalFlags.includes("TRUST_RESPONSIBILITY_TRIGGERED")
    ? "This document references Indian Health Service or Urban Indian Health services, triggering federal trust responsibility classification for the member. No tribal enrollment list is required — IHS service receipt alone establishes Indian status under 25 U.S.C. § 1603."
    : `This is a ${documentType}. The document has been logged. Review the extracted details and apply any applicable tribal protections.`;

  return {
    documentClass,
    documentType,
    isOfficial,
    filingAuthority,
    filingState,
    filingDate,
    filingNumber,
    entityName,
    entityType,
    entityNumber,
    formedIn,
    principalAddress,
    typeOfBusiness,
    parties,
    tribalFlags,
    tribalLogic,
    logicSummary,
    recommendedAction,
    intakeAnswers: {
      businessType: typeOfBusiness ?? (entityType ? `${entityType} — existing entity` : null),
      businessName: entityName,
      targetCommunity: null,
      existingActivity: entityName
        ? `Yes — ${entityType ?? "entity"} already established: ${entityName}${entityNumber ? ` (No. ${entityNumber})` : ""}${filingDate ? `, filed ${filingDate}` : ""}`
        : null,
      vision: null,
    },
  };
}

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { text, filename } = req.body as { text?: string; filename?: string };

    if (!text || text.trim().length < 10) {
      res.status(400).json({ error: "text is required (minimum 10 characters)" });
      return;
    }

    const truncatedText = text.slice(0, 8000);
    logger.info({ userId: req.user?.dbId, filename, chars: text.length }, "Document intelligence request");

    const azureAvailable = !!getAzureOpenAIClient();

    if (!azureAvailable) {
      logger.warn("Azure OpenAI not available — returning rule-based document intelligence");
      return void res.json({ ...ruleBasedExtract(truncatedText, filename ?? ""), _tier: "rule_based" });
    }

    const userPrompt =
      `FILENAME: ${filename ?? "unknown"}\n\n` +
      `DOCUMENT TEXT:\n---\n${truncatedText}\n---\n\n` +
      `Analyze this document. Extract all structured fields. Apply all tribal logic rules. Return ONLY the JSON object.`;

    try {
      const result = await callAzureOpenAI(DOC_INTEL_SYSTEM_PROMPT, userPrompt, {
        maxTokens: 2000,
        temperature: 0.1,
        timeoutMs: 20000,
      });

      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in AI response");
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      if (!parsed.documentClass) throw new Error("Invalid response shape");

      logger.info({ tokens: result.usage?.totalTokens, documentClass: parsed.documentClass }, "Document intelligence succeeded");
      return void res.json({ ...parsed, _tier: "azure_openai" });
    } catch (aiErr) {
      logger.warn({ err: (aiErr as Error).message }, "Azure OpenAI document intelligence failed — using rule-based fallback");
      return void res.json({ ...ruleBasedExtract(truncatedText, filename ?? ""), _tier: "rule_based_fallback" });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
