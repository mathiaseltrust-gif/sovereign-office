/**
 * AAMVA Driver's License / ID Barcode Parser
 * Parses raw AAMVA-format strings extracted from PDF417 barcodes on the back of US driver's licenses.
 * Spec: AAMVA DL/ID 2016 Standard
 */

export interface AamvaFields {
  documentType: "dl" | "id";
  issuingJurisdictionCode: string;
  issuingJurisdictionName: string;
  lastName: string;
  firstName: string;
  middleName: string;
  fullName: string;
  dateOfBirth: string;
  expiryDate: string;
  issueDate: string;
  sex: "M" | "F" | "U";
  eyeColor: string;
  height: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  fullAddress: string;
  idNumber: string;
  idNumberType: string;
  vehicleClass?: string;
  endorsements?: string;
  restrictions?: string;
  raw: Record<string, string>;
}

const AAMVA_FIELD_MAP: Record<string, keyof AamvaFields | string> = {
  DCS: "lastName",
  DAC: "firstName",
  DAD: "middleName",
  DAG: "streetAddress",
  DAI: "city",
  DAJ: "state",
  DAK: "postalCode",
  DAQ: "idNumber",
  DBB: "dateOfBirth",
  DBA: "expiryDate",
  DBD: "issueDate",
  DBC: "sex",
  DAY: "eyeColor",
  DAU: "height",
  DCF: "documentDiscriminator",
  DCG: "countryId",
  DCH: "hazmatEndorsementExpiry",
  DCT: "firstNameAlias",
  DBN: "aliasLastName",
  DBO: "aliasFirstName",
  DBP: "aliasMiddleName",
  DCA: "vehicleClass",
  DCB: "restrictions",
  DCD: "endorsements",
};

const STATE_CODES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};

function parseAamvaDate(raw: string): string {
  if (!raw || raw.length < 8) return raw ?? "";
  const cleaned = raw.trim().replace(/\D/g, "");
  if (cleaned.length === 8) {
    const mmddyyyy = /^(\d{2})(\d{2})(\d{4})$/;
    const m = cleaned.match(mmddyyyy);
    if (m) return `${m[1]}/${m[2]}/${m[3]}`;
  }
  return raw.trim();
}

function parseSex(code: string): "M" | "F" | "U" {
  const c = code?.trim();
  if (c === "1" || c?.toUpperCase() === "M") return "M";
  if (c === "2" || c?.toUpperCase() === "F") return "F";
  return "U";
}

/**
 * Parse a raw AAMVA PDF417 barcode string into structured fields.
 * Returns null if the string doesn't appear to be a valid AAMVA barcode.
 */
export function parseAamvaString(raw: string): AamvaFields | null {
  if (!raw || typeof raw !== "string") return null;

  const str = raw.trim();
  if (!str.includes("ANSI ") && !str.includes("@\n") && !str.startsWith("@")) {
    return null;
  }

  const fieldRe = /([A-Z]{2}[A-Z0-9])(.*?)(?=[A-Z]{2}[A-Z0-9]|\n|$)/g;
  const extracted: Record<string, string> = {};

  let match: RegExpExecArray | null;
  while ((match = fieldRe.exec(str)) !== null) {
    const code = match[1];
    const value = match[2].replace(/\r/g, "").trim();
    if (code && value) extracted[code] = value;
  }

  if (Object.keys(extracted).length < 3) {
    return null;
  }

  const lastName = extracted["DCS"] ?? extracted["DAB"] ?? "";
  const firstName = extracted["DAC"] ?? "";
  const middleName = extracted["DAD"] ?? "";
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim() || (extracted["DAA"] ?? "");

  const state = extracted["DAJ"]?.trim().toUpperCase() ?? "";
  const issuingJurisdictionCode = state ? `US-${state}` : "US-??";
  const issuingJurisdictionName = state ? (STATE_CODES[state] ?? state) : "Unknown";

  const postalRaw = extracted["DAK"]?.trim() ?? "";
  const postalCode = postalRaw.replace(/^(\d{5}).*/, "$1");

  const streetAddress = extracted["DAG"]?.trim() ?? "";
  const city = extracted["DAI"]?.trim() ?? "";
  const fullAddress = [streetAddress, city, state, postalCode].filter(Boolean).join(", ");

  const docTypeCode = extracted["DBA"]?.trim();
  const documentType: "dl" | "id" = extracted["DCA"] ? "dl" : "id";

  return {
    documentType,
    issuingJurisdictionCode,
    issuingJurisdictionName,
    lastName: lastName.trim(),
    firstName: firstName.trim(),
    middleName: middleName.trim(),
    fullName,
    dateOfBirth: parseAamvaDate(extracted["DBB"] ?? ""),
    expiryDate: parseAamvaDate(extracted["DBA"] ?? ""),
    issueDate: parseAamvaDate(extracted["DBD"] ?? ""),
    sex: parseSex(extracted["DBC"] ?? ""),
    eyeColor: extracted["DAY"]?.trim() ?? "",
    height: extracted["DAU"]?.trim() ?? "",
    streetAddress,
    city,
    state,
    postalCode,
    fullAddress,
    idNumber: extracted["DAQ"]?.trim() ?? "",
    idNumberType: extracted["DCA"] ? "Driver License" : "State ID",
    vehicleClass: extracted["DCA"]?.trim(),
    restrictions: extracted["DCB"]?.trim(),
    endorsements: extracted["DCD"]?.trim(),
    raw: extracted,
  };
}
