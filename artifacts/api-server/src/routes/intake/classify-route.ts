/**
 * Document Classify-and-Route Engine
 *
 * Accepts document text + filename, classifies the document type, extracts
 * structured fields, and determines which records to create (land parcel,
 * court document, NFR investigation, encumbrance).
 *
 * Endpoints:
 *   POST /api/intake/classify-and-route  — classify + extract only (no DB writes)
 *   POST /api/intake/apply-filing        — take a routing result and persist records
 */

import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { courtDocumentsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { triggerReviewEngine, auditLog, type ReviewSignalType } from "../../engines/nfr-review-engine";
import { nextDocRef } from "../../lib/doc-ref";

const router = Router();

// ── Document type registry ────────────────────────────────────────────────────

export const DOC_TYPE_LABELS: Record<string, string> = {
  board_of_review_petition:  "Board of Review Petition / Written Protest",
  received_stamp:            "Receipt / Filing Confirmation",
  certificate_of_record:     "Certificate of Copy of Record",
  tax_notice:                "Property Tax Notice / Assessment",
  tax_lien:                  "Tax Lien Notice",
  foreclosure:               "Foreclosure Notice",
  deed:                      "Property Deed",
  deed_of_trust:              "Deed of Trust",
  trust_instrument:           "Trust Instrument",
  grant_deed:                 "Grant Deed",
  correction_deed:            "Correction Deed",
  quitclaim_deed:             "Quitclaim Deed",
  mortgage_security_instrument:"Mortgage / Security Instrument",
  recorder_notice:            "Recorder Notice",
  ancestry_record:            "Ancestry / Lineage Record",
  household_record:           "Household Record",
  court_order:               "Court Order",
  complaint:                 "Formal Complaint",
  icwa_notice:               "ICWA Notice",
  identity_document:         "Identity / Enrollment Document",
  trust_declaration:         "Trust Declaration",
  nfr:                       "Notice of Federal Review",
  jurisdictional_statement:  "Jurisdictional Statement",
  other:                     "Document",
};

const DOC_TYPE_SIGNAL: Record<string, ReviewSignalType | null> = {
  board_of_review_petition:  "TAX_OR_LIEN_ASSERTION",
  tax_notice:                "TAX_OR_LIEN_ASSERTION",
  tax_lien:                  "TAX_OR_LIEN_ASSERTION",
  foreclosure:               "FORECLOSURE_ACTIVITY",
  court_order:               "JURISDICTIONAL_OVERREACH",
  complaint:                 "PROTECTED_RIGHTS_VIOLATION",
  icwa_notice:               "ICWA_PROCEEDING_DETECTED",
  identity_document:         "IDENTITY_CHALLENGED",
  received_stamp:            null,
  certificate_of_record:     null,
  deed:                      null,
  deed_of_trust:              "UNAUTHORIZED_LAND_ENCUMBRANCE",
  trust_instrument:           "TRUST_RESPONSIBILITY_BREACH",
  grant_deed:                 null,
  correction_deed:            null,
  quitclaim_deed:             null,
  mortgage_security_instrument:"UNAUTHORIZED_LAND_ENCUMBRANCE",
  recorder_notice:            "RECORDER_REFUSAL",
  ancestry_record:            null,
  household_record:           null,
  trust_declaration:         null,
  nfr:                       null,
  jurisdictional_statement:  null,
  other:                     null,
};

const DOC_TYPE_TARGETS: Record<string, string[]> = {
  board_of_review_petition:  ["court_document", "land_parcel", "nfr_investigation"],
  received_stamp:            ["court_document"],
  certificate_of_record:     ["court_document"],
  tax_notice:                ["land_parcel", "nfr_investigation", "encumbrance"],
  tax_lien:                  ["land_parcel", "nfr_investigation", "encumbrance"],
  foreclosure:               ["land_parcel", "nfr_investigation", "encumbrance"],
  deed:                      ["land_parcel", "court_document"],
  deed_of_trust:              ["land_parcel", "encumbrance", "trust_instrument", "nfr_investigation", "court_document"],
  trust_instrument:           ["trust_instrument", "court_document"],
  trust_declaration:          ["trust_instrument", "court_document"],
  grant_deed:                 ["land_parcel", "court_document"],
  correction_deed:            ["land_parcel", "court_document"],
  quitclaim_deed:             ["land_parcel", "court_document"],
  mortgage_security_instrument:["land_parcel", "encumbrance", "nfr_investigation", "court_document"],
  recorder_notice:            ["land_parcel", "nfr_investigation", "court_document"],
  ancestry_record:            ["lineage_record", "court_document"],
  household_record:           ["lineage_record", "court_document"],
  court_order:               ["court_document", "nfr_investigation"],
  complaint:                 ["court_document", "nfr_investigation"],
  icwa_notice:               ["court_document", "nfr_investigation"],
  identity_document:         ["court_document"],
  nfr:                       ["court_document"],
  jurisdictional_statement:  ["court_document"],
  other:                     ["court_document"],
};

// ── Rule-based classifier ─────────────────────────────────────────────────────

function classifyByRules(text: string, filename: string): string {
  const probe = (filename + " " + text.substring(0, 800)).toLowerCase();

  if (probe.includes("board of review") || probe.includes("written protest") ||
      (probe.includes("petition") && (probe.includes("uncap") || probe.includes("taxable value") || probe.includes("assessment"))))
    return "board_of_review_petition";

  if (probe.includes("certificate of copy") || probe.includes("certified copy of record") ||
      probe.includes("certificate_of_copy") || probe.includes("certification of record"))
    return "certificate_of_record";

  if ((probe.includes("received") || probe.includes("receipt")) &&
      (probe.includes("filed") || probe.includes("recording") || probe.includes("stamp") || probe.includes("confirm")))
    return "received_stamp";

  if (probe.includes("tax lien") || probe.includes("notice of lien") || probe.includes("lien certificate"))
    return "tax_lien";

  if (probe.includes("foreclos"))
    return "foreclosure";

  if (probe.includes("property tax") || probe.includes("notice of assessment") ||
      probe.includes("assessed value") || probe.includes("taxable value") ||
      probe.includes("state equalized value"))
    return "tax_notice";

  if (probe.includes("deed of trust") || probe.includes("trust deed"))
    return "deed_of_trust";
  if (probe.includes("declaration of trust") || probe.includes("trust instrument") || probe.includes("trust agreement"))
    return "trust_instrument";
  if (probe.includes("correction deed") || probe.includes("corrective deed"))
    return "correction_deed";
  if (probe.includes("quitclaim"))
    return "quitclaim_deed";
  if (probe.includes("grant deed"))
    return "grant_deed";
  if (probe.includes("mortgage") && (probe.includes("security instrument") || probe.includes("lien")))
    return "mortgage_security_instrument";
  if (probe.includes("warranty deed") || probe.includes("special warranty"))
    return "deed";

  if (probe.includes("icwa") || probe.includes("indian child welfare"))
    return "icwa_notice";

  if (probe.includes("enrollment") || probe.includes("cdib") ||
      probe.includes("tribal id") || probe.includes("degree of indian blood") ||
      probe.includes("certificate of degree"))
    return "identity_document";

  if (probe.includes("declaration of trust") || probe.includes("trust agreement") ||
      probe.includes("trust declaration") || probe.includes("irrevocable trust"))
    return "trust_declaration";

  if (probe.includes("notice of federal review") || probe.includes("nfr"))
    return "nfr";

  if (probe.includes("jurisdictional statement") || probe.includes("assertion of jurisdiction"))
    return "jurisdictional_statement";

  if (probe.includes("court order") || probe.includes("judgment") || probe.includes("order of court"))
    return "court_order";

  if (probe.includes("complaint") || probe.includes("formal complaint"))
    return "complaint";

  return "other";
}

// ── Rule-based field extractor ────────────────────────────────────────────────

function extractFieldsByRules(text: string, filename: string): Record<string, unknown> {
  const parcelMatch = text.match(
    /(?:Parcel\s*(?:ID|No\.?|Number|#)\s*:|APN[:\s#]|Assessor\s*Parcel[:\s#])\s*([0-9A-Z][0-9A-Z\-\.]+)/i
  );
  const addressMatch =
    text.match(/(\d{4,6}\s+[A-Z][A-Za-z ]+(?:Rd|Road|Ave|Avenue|Blvd|Boulevard|Dr|Drive|St|Street|Ln|Lane|Way|Ct|Court|Pkwy)[^\n\r,]{0,60})/i);
  const taxYearMatch = text.match(/Tax\s*Year[:\s]+(\d{4})/i);
  const ownerMatch = text.match(
    /(?:Owner\s+on\s+(?:Assessment\s+)?Roll|Owner|Titled)[:\s]+([A-Z][A-Za-z ]+(?:Trust|LLC|Inc|Corp|Nation|Tribe)?)/i
  );
  const petitionerMatch = text.match(
    /(?:Submitted\s+by|Filed\s+by|Office\s+of\s+the|Petitioner)[:\s]+([A-Z][A-Za-z &]+(?:Trust|Office|Tribe|Nation|Justice)?)/i
  );
  const filingBodyMatch = text.match(
    /(?:filed\s+(?:with|before)|submitted\s+to)[:\s]+([A-Z][A-Za-z &,]+(?:Board|Commission|Court|Office|County|Department)?)/i
  ) ?? text.match(/(Board\s+of\s+Review|State\s+Tax\s+Tribunal|Oakland\s+County[^,\n]{0,40})/i);
  const countyMatch = text.match(/([A-Z][a-z]+)\s+County/i);
  const michiganMatch = /\bMichigan\b|\bMI\b/.test(text);
  const reliefMatch = text.match(/Relief\s+requested?[:\s\-]+([^\n\r.]{20,300})/i);
  const tribalEntityMatch = text.match(
    /(Mathias El Tribe(?:\s+Trust)?|[A-Z][a-z]+\s+(?:Nation|Tribe|Band|Pueblo|Rancheria)(?:\s+Trust)?)/i
  );
  const amounts = (text.match(/\$[\d,]+(?:\.\d{2})?/g) ?? []).slice(0, 5);
  const dates = (text.match(
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{4}\b/g
  ) ?? []).slice(0, 6);
  const federalCitations = (text.match(
    /(?:25\s+U\.S\.C\.\s*§\s*\d+[\w\s()]+|MCL\s+[\d.]+|Pub\.\s*L\.\s*\d+[^\n\r]{0,60}|U\.S\.\s*at\s*\d+)[^\n\r]{0,80}/gi
  ) ?? []).slice(0, 8);

  return {
    parcelId: parcelMatch?.[1]?.trim() ?? null,
    propertyAddress: addressMatch?.[1]?.trim() ?? null,
    taxYear: taxYearMatch?.[1] ?? null,
    ownerOnRecord: ownerMatch?.[1]?.trim() ?? null,
    petitioner: petitionerMatch?.[1]?.trim() ?? null,
    filingBody: filingBodyMatch?.[1]?.trim() ?? null,
    county: countyMatch?.[1]?.trim() ?? null,
    state: michiganMatch ? "MI" : null,
    reliefRequested: reliefMatch?.[1]?.trim() ?? null,
    tribalEntity: tribalEntityMatch?.[1]?.trim() ?? null,
    amounts,
    dates,
    federalCitationsFound: [...new Set(federalCitations.map(c => c.trim()))],
    sourceFilename: filename,
  };
}

// ── POST /api/intake/classify-and-route ──────────────────────────────────────

router.post("/classify-and-route", requireAuth, async (req, res, next) => {
  try {
    const { text, filename } = req.body as { text?: string; filename?: string };
    if (!text || typeof text !== "string" || text.length < 10) {
      res.status(400).json({ error: "text field is required" });
      return;
    }
    const name = filename ?? "document";
    const truncated = text.substring(0, 8000);

    let docType = "other";
    let confidence: "high" | "medium" | "low" = "medium";
    let extractedFields: Record<string, unknown> = {};
    let source = "rule";

    // Try Azure OpenAI first
    try {
      const { callAzureOpenAI } = await import("../../lib/azure-openai");
      const system = `You are a sovereign tribal legal office document classifier. Classify the document type and extract key structured fields. Respond ONLY with valid JSON in this exact shape — no markdown, no explanation:
{
  "documentType": "one of: board_of_review_petition | received_stamp | certificate_of_record | tax_notice | tax_lien | foreclosure | deed | deed_of_trust | trust_instrument | trust_declaration | grant_deed | correction_deed | quitclaim_deed | mortgage_security_instrument | recorder_notice | court_order | complaint | icwa_notice | identity_document | ancestry_record | household_record | nfr | jurisdictional_statement | other",
  "confidence": "high | medium | low",
  "extractedFields": {
    "apn": "string|null",
    "atn": "string|null",
    "parcelId": "string|null",
    "propertyAddress": "string|null",
    "legalDescription": "string|null",
    "recordingNumber": "string|null",
    "recordingDate": "string|null",
    "instrumentNumber": "string|null",
    "county": "string|null",
    "grantor": "string|null",
    "grantee": "string|null",
    "trustor": "string|null",
    "trustee": "string|null",
    "beneficiary": "string|null",
    "lender": "string|null",
    "servicer": "string|null",
    "trustName": "string|null",
    "encumbranceIndicators": [],
    "parcelId": "assessor parcel number or null",
    "propertyAddress": "full property address or null",
    "taxYear": "4-digit year or null",
    "ownerOnRecord": "name of owner on assessment/title record or null",
    "petitioner": "petitioner or filer name or null",
    "filingBody": "body this is filed with (e.g. Oakland County Board of Review) or null",
    "county": "county name only (no 'County') or null",
    "state": "2-letter state code or null",
    "reliefRequested": "brief summary of relief sought or null",
    "tribalEntity": "tribal trust or nation name if mentioned or null",
    "federalCitationsFound": ["federal law citations found"],
    "amounts": ["dollar amounts found"],
    "dates": ["key dates found"]
  }
}`;
      const prompt = `Filename: "${name}"\n\nDocument text:\n${truncated}`;
      const raw = await callAzureOpenAI(system, prompt, { maxTokens: 900, temperature: 0 });
      const match = raw.content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as Record<string, unknown>;
        docType = (parsed.documentType as string) ?? "other";
        confidence = (parsed.confidence as "high" | "medium" | "low") ?? "medium";
        extractedFields = (parsed.extractedFields as Record<string, unknown>) ?? {};
        source = "ai";
      }
    } catch {
      // Fall back to rule-based
    }

    // If AI failed or returned 'other' with low confidence, use rules to cross-check
    if (source !== "ai" || docType === "other") {
      const ruleType = classifyByRules(truncated, name);
      if (source !== "ai") {
        docType = ruleType;
        confidence = ruleType !== "other" ? "high" : "low";
        extractedFields = extractFieldsByRules(truncated, name);
        source = "rule";
      } else if (docType === "other" && ruleType !== "other") {
        docType = ruleType;
        confidence = "medium";
        if (Object.keys(extractedFields).length === 0) {
          extractedFields = extractFieldsByRules(truncated, name);
        }
      }
    }

    const signalType = DOC_TYPE_SIGNAL[docType] ?? null;
    const routingTargets = DOC_TYPE_TARGETS[docType] ?? ["court_document"];
    const label = DOC_TYPE_LABELS[docType] ?? "Document";

    res.json({
      source,
      documentType: docType,
      documentTypeLabel: label,
      confidence,
      extractedFields,
      signalType,
      routingTargets,
      filename: name,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/intake/apply-filing ─────────────────────────────────────────────
// Takes a classification result and creates the appropriate DB records.
// Returns refs to all created records.

router.post("/apply-filing", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    const {
      documentType,
      documentTypeLabel,
      extractedFields,
      signalType,
      routingTargets,
      text,
      filename,
    } = req.body as {
      documentType: string;
      documentTypeLabel?: string;
      extractedFields?: Record<string, unknown>;
      signalType?: string | null;
      routingTargets?: string[];
      text?: string;
      filename?: string;
    };

    if (!documentType) {
      res.status(400).json({ error: "documentType is required" });
      return;
    }

    const targets = routingTargets ?? DOC_TYPE_TARGETS[documentType] ?? ["court_document"];
    const fields = extractedFields ?? {};
    const label = documentTypeLabel ?? DOC_TYPE_LABELS[documentType] ?? "Document";
    const sig = (signalType ?? DOC_TYPE_SIGNAL[documentType]) as ReviewSignalType | null;
    const created: Record<string, unknown> = {};

    // ── 1. Upsert land parcel ─────────────────────────────────────────────────
    let parcelDbId: number | null = null;
    if (targets.includes("land_parcel") && fields.parcelId) {
      try {
        const existing = await db.execute(sql`
          SELECT id FROM land_parcels WHERE parcel_id = ${String(fields.parcelId)} LIMIT 1
        `);
        if (existing.rows.length > 0) {
          parcelDbId = (existing.rows[0] as Record<string, unknown>).id as number;
          created.parcel = { action: "found", id: parcelDbId, parcelId: fields.parcelId };
        } else {
          const tribalRef = await nextDocRef("land_parcel");
          const legalDesc = [
            fields.propertyAddress,
            fields.county ? `${String(fields.county)} County` : null,
            fields.state,
          ].filter(Boolean).join(", ");

          const ins = await db.execute(sql`
            INSERT INTO land_parcels (
              tract_number, parcel_id, legal_description, classification,
              status, county, state, internal_tribal_status, jurisdictional_status,
              owner_type, stewardship_purpose, tribal_code_ref
            ) VALUES (
              ${String(fields.parcelId)},
              ${String(fields.parcelId)},
              ${legalDesc || null},
              'tribal_trust',
              'active',
              ${fields.county ? String(fields.county) : null},
              ${fields.state ? String(fields.state) : null},
              'tribal_trust_stewardship',
              'contested',
              'tribal',
              'Tribal trust property — see attached filing documents',
              ${tribalRef}
            ) RETURNING id, tract_number, parcel_id, tribal_code_ref
          `);
          const row = ins.rows[0] as Record<string, unknown>;
          parcelDbId = row.id as number;
          created.parcel = { action: "created", id: parcelDbId, parcelId: fields.parcelId, tribalRef };
        }
      } catch (e) {
        logger.warn({ err: e }, "apply-filing: parcel upsert failed");
        created.parcelError = String(e);
      }
    }

    // ── 2. Create encumbrance ─────────────────────────────────────────────────
    if (targets.includes("encumbrance") && parcelDbId) {
      try {
        const encType =
          documentType === "tax_lien"    ? "tax_lien"
          : documentType === "foreclosure" ? "foreclosure_notice"
          : "tax_lien";

        const encRow = await db.execute(sql`
          INSERT INTO land_encumbrances (
            parcel_id, encumbrance_type, title, description, source,
            date_identified, void_ab_initio, federal_law_implicated, status
          ) VALUES (
            ${parcelDbId},
            ${encType},
            ${label},
            ${text ? text.substring(0, 600) : label},
            ${String(filename ?? "uploaded_document")},
            NOW(),
            true,
            '25 U.S.C. § 5108; 25 U.S.C. § 177; McClanahan v. Arizona State Tax Comm''n (411 U.S. 164); Oklahoma Tax Comm''n v. Chickasaw Nation',
            'disputed'
          ) RETURNING id
        `);
        created.encumbrance = { id: (encRow.rows[0] as Record<string, unknown>).id };
      } catch (e) {
        logger.warn({ err: e }, "apply-filing: encumbrance insert failed");
        created.encumbranceError = String(e);
      }
    }

    // ── 3. Create court document ──────────────────────────────────────────────
    if (targets.includes("court_document")) {
      try {
        const tribalRef = await nextDocRef("court_document");
        const docTitle = [
          label,
          fields.parcelId ? `— Parcel ${fields.parcelId}` : null,
          fields.taxYear ? `(Tax Year ${fields.taxYear})` : null,
        ].filter(Boolean).join(" ");

        const parties = {
          petitioner: fields.petitioner ?? fields.ownerOnRecord ?? null,
          filingBody: fields.filingBody ?? null,
          county: fields.county ? `${String(fields.county)} County` : null,
          tribalEntity: fields.tribalEntity ?? null,
        };
        const caseDetails = {
          parcelId: fields.parcelId ?? null,
          propertyAddress: fields.propertyAddress ?? null,
          taxYear: fields.taxYear ?? null,
          reliefRequested: fields.reliefRequested ?? null,
          federalCitationsFound: fields.federalCitationsFound ?? [],
          parcelLinked: parcelDbId ?? null,
          sourceFilename: filename ?? null,
        };

        const docRow = await db.execute(sql`
          INSERT INTO court_documents (
            template_id, template_name, document_type, title, content,
            parties, case_details, status, tribal_ref, generated_by,
            intake_flags, law_refs, audit_log
          ) VALUES (
            ${documentType},
            ${label},
            ${documentType},
            ${docTitle},
            ${text ? text.substring(0, 60000) : `[Document: ${label}]`},
            ${JSON.stringify(parties)}::jsonb,
            ${JSON.stringify(caseDetails)}::jsonb,
            'active',
            ${tribalRef},
            ${userId ?? null},
            ${JSON.stringify({
              documentType,
              classificationSource: "intake_pipeline",
              parcelLinked: !!parcelDbId,
              signalType: sig,
              filename: filename ?? null,
            })}::jsonb,
            ${JSON.stringify(fields.federalCitationsFound ?? [])}::jsonb,
            ${JSON.stringify([{
              action: "created",
              by: "intake_pipeline",
              ts: new Date().toISOString(),
              source: "classify-and-route",
            }])}::jsonb
          ) RETURNING id, tribal_ref
        `);
        const r = docRow.rows[0] as Record<string, unknown>;
        created.courtDocument = { id: r.id, tribalRef: r.tribal_ref };
      } catch (e) {
        logger.warn({ err: e }, "apply-filing: court_document insert failed");
        created.courtDocumentError = String(e);
      }
    }

    // ── 4. Trigger NFR investigation ──────────────────────────────────────────
    if (targets.includes("nfr_investigation") && sig) {
      try {
        await triggerReviewEngine({
          signalType: sig,
          eventType: "document_upload",
          affectedUserId: userId,
          affectedParcelId: parcelDbId ?? undefined,
          affectedMatter: [
            label,
            fields.parcelId ? `Parcel ${fields.parcelId}` : null,
            fields.propertyAddress ?? null,
          ].filter(Boolean).join(" — "),
          triggeringEntity: "document_intake",
          evidenceSource: `document:${filename ?? "uploaded"}`,
          context: text ? text.substring(0, 1200) : label,
        });
        created.nfrSignal = { signalType: sig };
      } catch (e) {
        logger.warn({ err: e }, "apply-filing: NFR trigger failed");
        created.nfrError = String(e);
      }
    }

    // ── 5. Audit ──────────────────────────────────────────────────────────────
    auditLog({
      userId: userId ?? null,
      action: "document.apply_filing",
      resourceType: "court_document",
      resourceRef: String((created.courtDocument as Record<string, unknown> | undefined)?.tribalRef ?? filename ?? documentType),
      metadata: { documentType, parcelDbId, filename, created },
    }).catch(() => {});

    logger.info({ userId, documentType, filename, created }, "apply-filing completed");
    res.status(201).json({ success: true, documentType, label, created });
  } catch (err) {
    next(err);
  }
});

export default router;
