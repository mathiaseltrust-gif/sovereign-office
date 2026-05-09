export interface RecorderFormattingRules {
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  fontSize: number;
  fontFamily: string;
  captionRequired: boolean;
}

export const DEFAULT_RECORDER_FORMAT: RecorderFormattingRules = {
  marginTop: 2.5,
  marginBottom: 0.5,
  marginLeft: 0.5,
  marginRight: 0.5,
  fontSize: 11,
  fontFamily: "Times New Roman",
  captionRequired: true,
};

export interface InstrumentOptions {
  type: string;
  parties: string[];
  landDescription: string;
  jurisdiction: string;
  indianLandProtection?: boolean;
  trustStatus?: boolean;
  federalPreemption?: boolean;
  tribalJurisdiction?: boolean;
  title?: string;
  land?: {
    description?: string;
    apn?: string;
    county?: string;
    state?: string;
    classification?: string;
  };
  partiesMap?: Record<string, string>;
  provisions?: string[];
  trusteeNotes?: string;
  recorderMetadata?: {
    returnAddress?: string;
    apn?: string;
    county?: string;
    state?: string;
    documentType?: string;
    filingCategory?: string;
    trustStatus?: string;
    landClassification?: string;
    requiresNotary?: boolean;
  };
}

export function buildInstrumentContent(opts: InstrumentOptions): string {
  const lines: string[] = [];

  lines.push(`INSTRUMENT TYPE: ${opts.type.toUpperCase()}`);
  lines.push(`PARTIES: ${opts.parties.join(", ")}`);
  lines.push(`LEGAL DESCRIPTION: ${opts.landDescription}`);
  lines.push(`JURISDICTION: ${opts.jurisdiction}`);
  lines.push("");

  if (opts.indianLandProtection ?? true) {
    lines.push(
      "INDIAN LAND PROTECTION NOTICE: This instrument involves Indian trust land or restricted Indian land and is subject to applicable federal laws governing Indian land transactions, including but not limited to 25 U.S.C. § 177 and related statutes.",
    );
  }

  if (opts.trustStatus) {
    lines.push(
      "TRUST STATUS PROVISION: The land described herein is held in trust by the United States for the benefit of [Tribe/Individual]. No transfer, encumbrance, or alienation of this land may occur without the approval of the Secretary of the Interior.",
    );
  }

  if (opts.federalPreemption ?? true) {
    lines.push(
      "FEDERAL PREEMPTION NOTICE: Federal law preempts any state law that would impair the rights of Indian tribes or individual Indians in this transaction. Worcester v. Georgia, 31 U.S. 515 (1832); McClanahan v. Arizona State Tax Comm'n, 411 U.S. 164 (1973).",
    );
  }

  if (opts.tribalJurisdiction) {
    lines.push(
      "TRIBAL JURISDICTION STATEMENT: This instrument is subject to the laws and jurisdiction of [Tribal Nation]. The tribal court retains jurisdiction over disputes arising from this instrument.",
    );
  }

  lines.push("");
  lines.push("PROTECTED STATUS NOTICE: This document is a recorder-compliant instrument issued under sovereign authority.");

  return lines.join("\n");
}

export function validateInstrumentForRecorder(
  content: string,
  _format: RecorderFormattingRules,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!content.includes("INSTRUMENT TYPE:")) errors.push("Missing instrument type declaration");
  if (!content.includes("LEGAL DESCRIPTION:")) errors.push("Missing legal description");
  if (!content.includes("JURISDICTION:") && !content.includes("jurisdiction")) errors.push("Missing jurisdiction statement");

  return { valid: errors.length === 0, errors };
}
