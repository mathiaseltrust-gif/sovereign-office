/**
 * Shared ID document extraction helpers.
 * Used by both user (/api/user/id-document) and admin (/api/admin/id-document) routes.
 */

import { getAzureOpenAIClient, getDeployment } from "./azure-openai";
import { parseAamvaString } from "./aamva-parser";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";

const objectStorage = new ObjectStorageService();

export interface ExtractedIdFields {
  documentType: string;
  issuingJurisdictionCode: string;
  issuingJurisdictionName: string;
  fullName: string;
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  expiryDate: string;
  issueDate: string;
  idNumber: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  fullAddress: string;
  sex: string;
  eyeColor: string;
  height: string;
  vehicleClass?: string;
  restrictions?: string;
  endorsements?: string;
  rawBarcodeData?: string;
  extractionMethod: "barcode" | "vision_ocr" | "pdf_text" | "none";
  confidenceScore: number;
}

export interface JurisdictionAdvisory {
  hasAdvisory: boolean;
  level: "info" | "advisory" | "none";
  message: string | null;
  tribalOverlapNote: string | null;
}

const TRIBAL_LAND_CODES: Record<string, string[]> = {
  "US-CA": ["Yurok", "Hoopa Valley", "Karuk", "Tolowa Dee-ni", "Quartz Valley"],
  "US-NM": ["Navajo Nation", "Pueblo", "Jicarilla Apache"],
  "US-AZ": ["Navajo Nation", "Tohono O'odham", "Fort Apache"],
  "US-OK": ["Cherokee", "Choctaw", "Muscogee Creek"],
  "US-WA": ["Colville", "Yakama", "Lummi", "Tulalip"],
  "US-MT": ["Blackfeet", "Crow", "Fort Peck"],
  "US-SD": ["Standing Rock", "Pine Ridge", "Rosebud"],
  "US-ND": ["Standing Rock", "Turtle Mountain"],
  "US-MN": ["Red Lake", "White Earth", "Mille Lacs"],
};

const EMPTY_FIELDS: Omit<ExtractedIdFields, "extractionMethod" | "confidenceScore"> = {
  documentType: "unknown", issuingJurisdictionCode: "", issuingJurisdictionName: "",
  fullName: "", firstName: "", lastName: "", middleName: "",
  dateOfBirth: "", expiryDate: "", issueDate: "", idNumber: "",
  streetAddress: "", city: "", state: "", postalCode: "", fullAddress: "",
  sex: "", eyeColor: "", height: "",
};

const ID_EXTRACTION_JSON_SCHEMA = `{
  "documentType": "dl | state_id | passport | tribal_id | unknown",
  "issuingJurisdictionCode": "US-CA format for US states, TRIBAL-XXX for tribal, PASSPORT for passports",
  "issuingJurisdictionName": "Full state or country name",
  "fullName": "Full legal name",
  "firstName": "First name",
  "lastName": "Last name",
  "middleName": "Middle name or null",
  "dateOfBirth": "MM/DD/YYYY or null",
  "expiryDate": "MM/DD/YYYY or null",
  "issueDate": "MM/DD/YYYY or null",
  "idNumber": "License/ID/Passport number",
  "streetAddress": "Street address or null",
  "city": "City or null",
  "state": "State abbreviation or null",
  "postalCode": "ZIP or null",
  "fullAddress": "Full formatted address or null",
  "sex": "M, F, or null",
  "eyeColor": "BRN, BLU, GRN or null",
  "height": "5'10\" format or null",
  "vehicleClass": "Vehicle class or null",
  "restrictions": "Restriction codes or null",
  "endorsements": "Endorsement codes or null"
}`;

function parseGptJson(content: string): Partial<ExtractedIdFields> {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return {};
  try { return JSON.parse(jsonMatch[0]) as Partial<ExtractedIdFields>; } catch { return {}; }
}

function applyParsed(parsed: Partial<ExtractedIdFields>): Omit<ExtractedIdFields, "extractionMethod" | "confidenceScore"> {
  return {
    documentType: parsed.documentType ?? "unknown",
    issuingJurisdictionCode: parsed.issuingJurisdictionCode ?? "",
    issuingJurisdictionName: parsed.issuingJurisdictionName ?? "",
    fullName: parsed.fullName ?? "",
    firstName: parsed.firstName ?? "",
    lastName: parsed.lastName ?? "",
    middleName: parsed.middleName ?? "",
    dateOfBirth: parsed.dateOfBirth ?? "",
    expiryDate: parsed.expiryDate ?? "",
    issueDate: parsed.issueDate ?? "",
    idNumber: parsed.idNumber ?? "",
    streetAddress: parsed.streetAddress ?? "",
    city: parsed.city ?? "",
    state: parsed.state ?? "",
    postalCode: parsed.postalCode ?? "",
    fullAddress: parsed.fullAddress ?? "",
    sex: parsed.sex ?? "",
    eyeColor: parsed.eyeColor ?? "",
    height: parsed.height ?? "",
    vehicleClass: parsed.vehicleClass ?? undefined,
    restrictions: parsed.restrictions ?? undefined,
    endorsements: parsed.endorsements ?? undefined,
  };
}

export async function tryDecodePdf417(buffer: Buffer): Promise<string | null> {
  try {
    const { Jimp } = await import("jimp");
    const { scanImageData } = await import("@undecaf/zbar-wasm");

    const image = await Jimp.read(buffer);
    const { width, height, data } = image.bitmap;
    type ImageDataLike = { data: Uint8ClampedArray; width: number; height: number };
    const results = await scanImageData({ data: new Uint8ClampedArray(data), width, height } as unknown as ImageDataLike);
    if (results?.length) {
      for (const r of results) {
        const text = r.decode();
        if (text && (text.startsWith("@") || text.length > 100)) {
          logger.info({ barcodeType: r.typeName, textLength: text.length }, "PDF417 AAMVA barcode decoded from image");
          return text;
        }
      }
    }
    return null;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "PDF417 decode attempt failed (non-fatal)");
    return null;
  }
}

export async function extractWithVision(
  buffer: Buffer,
  mimetype: string,
  side: "front" | "back",
  docType: "auto" | "dl" | "passport" | "tribal",
): Promise<Omit<ExtractedIdFields, "extractionMethod" | "confidenceScore">> {
  const client = getAzureOpenAIClient();
  if (!client) return { ...EMPTY_FIELDS, documentType: docType === "auto" ? "unknown" : docType };

  const mimeToUse = mimetype.startsWith("image/") ? mimetype : "image/jpeg";
  const base64 = buffer.toString("base64");

  const sidePrompt = side === "back"
    ? "This is the BACK of a government-issued ID."
    : "This is the FRONT of a government-issued ID card or passport.";
  const docPrompt = docType === "passport" ? "This is a passport." : docType === "tribal" ? "This is a Tribal Nation ID." : "This appears to be a driver's license or state ID.";

  try {
    const response = await client.chat.completions.create({
      model: getDeployment(),
      messages: [
        { role: "system", content: `You are a government ID extraction specialist. Return ONLY valid JSON matching this schema:\n${ID_EXTRACTION_JSON_SCHEMA}` },
        { role: "user", content: [
          { type: "text", text: `${sidePrompt} ${docPrompt} Extract all visible identity fields precisely.` },
          { type: "image_url", image_url: { url: `data:${mimeToUse};base64,${base64}`, detail: "high" } },
        ]},
      ],
      max_tokens: 800,
      temperature: 0.1,
    });
    return applyParsed(parseGptJson(response.choices[0]?.message?.content ?? ""));
  } catch (err) {
    logger.error({ err: (err as Error).message }, "Vision OCR extraction failed");
    return { ...EMPTY_FIELDS };
  }
}

export async function extractFromPdfText(
  pdfBuffer: Buffer,
  docType: "auto" | "dl" | "passport" | "tribal",
): Promise<{ fields: Omit<ExtractedIdFields, "extractionMethod" | "confidenceScore">; textFound: boolean }> {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(pdfBuffer);
    const text = (data.text ?? "").trim();

    if (!text || text.length < 20) {
      return { fields: { ...EMPTY_FIELDS }, textFound: false };
    }

    const client = getAzureOpenAIClient();
    if (!client) {
      return { fields: { ...EMPTY_FIELDS }, textFound: true };
    }

    const response = await client.chat.completions.create({
      model: getDeployment(),
      messages: [
        { role: "system", content: `You are a government ID extraction specialist. Given text extracted from a PDF version of a government ID document, extract the identity fields. Return ONLY valid JSON matching this schema:\n${ID_EXTRACTION_JSON_SCHEMA}` },
        { role: "user", content: `PDF text content:\n${text.slice(0, 3000)}\n\nExtract all identity fields visible in this text.` },
      ],
      max_tokens: 600,
      temperature: 0.1,
    });

    const parsed = parseGptJson(response.choices[0]?.message?.content ?? "");
    logger.info({ docType, textLength: text.length }, "PDF text extraction completed");
    return { fields: applyParsed(parsed), textFound: true };
  } catch (err) {
    logger.error({ err: (err as Error).message }, "PDF text extraction failed");
    return { fields: { ...EMPTY_FIELDS }, textFound: false };
  }
}

export function buildJurisdictionAdvisory(
  issuingCode: string,
  preferredJurisdiction: string | null,
  jurisdictionTags: unknown,
): JurisdictionAdvisory {
  const tags: string[] = Array.isArray(jurisdictionTags) ? jurisdictionTags as string[] : [];
  const preferred = preferredJurisdiction ?? "";
  const stateCode = issuingCode.replace("US-", "");

  const tribalOverlap = TRIBAL_LAND_CODES[issuingCode];
  let tribalOverlapNote: string | null = null;
  if (tribalOverlap?.length) {
    tribalOverlapNote = `${stateCode} has tribal territories including: ${tribalOverlap.join(", ")}. If you reside on or near these lands, your tribal land record may also apply.`;
  }

  const isTribalId = issuingCode.toUpperCase().startsWith("TRIBAL");

  const claimsFederalIndianLand = tags.some(t =>
    typeof t === "string" && (t.toLowerCase().includes("federal indian land") || t.toLowerCase().includes("reservation") || t.toLowerCase().includes("trust land"))
  );

  if (claimsFederalIndianLand && !isTribalId) {
    return { hasAdvisory: true, level: "advisory", message: `Your profile lists federal Indian land or reservation jurisdiction, but this ID was issued by a state (${stateCode}). An officer has been notified. This does not block your submission.`, tribalOverlapNote };
  }

  if (isTribalId) {
    return { hasAdvisory: false, level: "none", message: null, tribalOverlapNote: null };
  }

  if (preferred && !preferred.toUpperCase().includes(stateCode) && preferred.toLowerCase() !== "federal") {
    return { hasAdvisory: true, level: "info", message: `Your declared jurisdiction is "${preferred}" but this ID was issued by ${issuingCode}. Informational only.`, tribalOverlapNote };
  }

  return { hasAdvisory: !!tribalOverlapNote, level: tribalOverlapNote ? "info" : "none", message: null, tribalOverlapNote };
}

export async function tryUploadToStorage(buffer: Buffer, mimetype: string, label: string): Promise<string | null> {
  try {
    return await objectStorage.uploadBuffer(buffer, mimetype, `id-documents/${label}`);
  } catch (err) {
    logger.warn({ err: (err as Error).message, label }, "ID document upload to object storage failed (non-fatal)");
    return null;
  }
}
