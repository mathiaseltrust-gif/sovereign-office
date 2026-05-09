import { db } from "@workspace/db";
import { templatesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";
import type { PdfBuildInput, RecorderMetadata } from "../lib/pdf-builder";

export interface TemplateVariable {
  key: string;
  value: string;
}

export interface RenderedTemplate {
  title: string;
  content: string;
  pdfInput: PdfBuildInput;
}

const BUILT_IN_TEMPLATES: Record<string, Omit<PdfBuildInput, "recorderMetadata">> = {
  trust_deed: {
    title: "DEED OF TRUST — INDIAN TRUST LAND",
    parties: {
      Grantor: "[GRANTOR FULL NAME]",
      Grantee: "[GRANTEE FULL NAME]",
      Trustee: "Sovereign Office of the Chief Justice & Trustee",
      Beneficiary: "[BENEFICIARY NAME / TRIBE]",
    },
    land: {
      description: "[INSERT FULL LEGAL DESCRIPTION OF TRUST LAND HERE]",
      classification: "Indian Trust Land",
    },
    provisions: [
      "CONVEYANCE: The Grantor hereby conveys and warrants to the Grantee, subject to all conditions and restrictions of this instrument, the real property described herein.",
      "TRUST LAND RESTRICTION: This conveyance is subject to all restrictions on alienation imposed by federal law on Indian trust land, including 25 U.S.C. § 177.",
    ],
    trusteeNotes: "Review with tribal legal counsel prior to execution. Secretary of Interior approval may be required.",
  },
  allotment_lease: {
    title: "LEASE OF INDIVIDUAL INDIAN ALLOTMENT",
    parties: {
      Lessor: "[ALLOTTEE FULL NAME]",
      Lessee: "[LESSEE FULL NAME]",
      "BIA Approving Officer": "Bureau of Indian Affairs, [Agency Name]",
    },
    land: {
      description: "[INSERT ALLOTMENT LEGAL DESCRIPTION]",
      classification: "Individual Indian Allotment",
    },
    provisions: [
      "LEASE TERM: This lease shall commence on [START DATE] and expire on [END DATE], unless earlier terminated pursuant to the provisions herein.",
      "RENTAL RATE: Lessee shall pay to Lessor, through the Bureau of Indian Affairs, the sum of $[AMOUNT] per [PERIOD].",
      "BIA APPROVAL: This lease is subject to approval by the Bureau of Indian Affairs pursuant to 25 U.S.C. § 415 and 25 C.F.R. Part 162.",
    ],
    trusteeNotes: "BIA approval required per 25 U.S.C. § 415.",
  },
  trust_transfer: {
    title: "TRUST LAND TRANSFER INSTRUMENT",
    parties: {
      Transferor: "[TRANSFEROR NAME / TRIBE]",
      Transferee: "[TRANSFEREE NAME / TRIBE]",
      Trustee: "United States of America, by and through the Secretary of the Interior",
    },
    land: {
      description: "[INSERT TRUST LAND LEGAL DESCRIPTION]",
      classification: "Federal Trust Land",
    },
    provisions: [
      "SECRETARIAL APPROVAL: This transfer is conditioned upon approval of the Secretary of the Interior pursuant to 25 U.S.C. § 177 and applicable regulations.",
      "TITLE STATUS: Title shall remain in trust upon completion of this transfer. No state real property transfer tax applies.",
    ],
    trusteeNotes: "File with BIA Land Records Office. Obtain Title Status Report prior to execution.",
  },
  nfr: {
    title: "NOTICE OF FAULT AND REMEDIES",
    parties: {
      "Issuing Authority": "Sovereign Office of the Chief Justice & Trustee",
      Respondent: "[RESPONDENT FULL NAME]",
      "Affected Party": "[TRIBE / INDIVIDUAL ALLOTTEE]",
    },
    land: {
      description: "[INSERT DESCRIPTION OF AFFECTED TRUST LAND]",
      classification: "Indian Trust Land",
    },
    provisions: [
      "NOTICE OF FAULT: You are hereby notified that your actions, described herein, constitute a violation of federal Indian law, tribal law, and/or the terms of the trust described herein.",
      "REMEDY REQUIRED: You are required to cure the fault described herein within [NUMBER] days of service of this notice.",
      "CONSEQUENCE OF NON-COMPLIANCE: Failure to comply with the terms of this notice may result in further legal action under tribal and federal law.",
    ],
    trusteeNotes: "Serve via certified mail, return receipt requested. File proof of service.",
  },
};

function applyVariables(text: string, variables: TemplateVariable[]): string {
  let result = text;
  for (const v of variables) {
    result = result.replaceAll(`[${v.key}]`, v.value);
  }
  return result;
}

function applyVariablesToInput(input: Omit<PdfBuildInput, "recorderMetadata">, variables: TemplateVariable[]): Omit<PdfBuildInput, "recorderMetadata"> {
  return {
    title: applyVariables(input.title, variables),
    parties: Object.fromEntries(
      Object.entries(input.parties).map(([k, v]) => [k, applyVariables(v, variables)]),
    ),
    land: {
      ...input.land,
      description: input.land.description ? applyVariables(input.land.description, variables) : undefined,
    },
    provisions: input.provisions.map((p) => applyVariables(p, variables)),
    trusteeNotes: input.trusteeNotes ? applyVariables(input.trusteeNotes, variables) : undefined,
  };
}

export async function renderTemplate(
  templateKey: string,
  variables: TemplateVariable[],
  recorderMetadata: RecorderMetadata,
): Promise<RenderedTemplate | null> {
  let base: Omit<PdfBuildInput, "recorderMetadata"> | undefined;

  if (BUILT_IN_TEMPLATES[templateKey]) {
    base = BUILT_IN_TEMPLATES[templateKey];
  } else {
    try {
      const dbTemplates = await db.select().from(templatesTable).where(and(eq(templatesTable.name, templateKey))).limit(1);
      if (dbTemplates[0]) {
        const t = dbTemplates[0];
        base = {
          title: t.name,
          parties: {},
          land: { description: t.content },
          provisions: [],
        };
      }
    } catch (err) {
      logger.error({ err, templateKey }, "Failed to load template from DB");
    }
  }

  if (!base) return null;

  const resolved = applyVariablesToInput(base, variables);
  const content = [
    `INSTRUMENT TYPE: ${resolved.title}`,
    `PARTIES: ${Object.entries(resolved.parties).map(([k, v]) => `${k}: ${v}`).join("; ")}`,
    `LEGAL DESCRIPTION: ${resolved.land.description ?? ""}`,
    resolved.land.classification ? `Land Classification: ${resolved.land.classification}` : "",
    ...resolved.provisions,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    title: resolved.title,
    content,
    pdfInput: { ...resolved, recorderMetadata },
  };
}

export function listBuiltInTemplates(): string[] {
  return Object.keys(BUILT_IN_TEMPLATES);
}

export function getBuiltInTemplate(key: string): Omit<PdfBuildInput, "recorderMetadata"> | null {
  return BUILT_IN_TEMPLATES[key] ?? null;
}
