import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import { logger } from "./logger";

// -- Tribal seal loader (B&W — for formal/recorder documents) ----------------
let _sealBytes: Uint8Array | null | undefined = undefined;

function getSealBytes(): Uint8Array | null {
  if (_sealBytes !== undefined) return _sealBytes;
  const candidates = [
    join(__dirname, "..", "src", "assets", "seal-bw.png"),
    join(process.cwd(), "src", "assets", "seal-bw.png"),
  ];
  for (const p of candidates) {
    try {
      _sealBytes = new Uint8Array(readFileSync(p));
      return _sealBytes;
    } catch { /* try next */ }
  }
  logger.warn("seal-bw.png not found - PDFs will render without the tribal seal");
  _sealBytes = null;
  return null;
}

// -- Tribal seal loader (full-color — for Tribal ID cards) -------------------
let _colorSealBytes: Uint8Array | null | undefined = undefined;

function getColorSealBytes(): Uint8Array | null {
  if (_colorSealBytes !== undefined) return _colorSealBytes;
  const candidates = [
    join(__dirname, "..", "src", "assets", "tribal-seal-color.png"),
    join(process.cwd(), "src", "assets", "tribal-seal-color.png"),
  ];
  for (const p of candidates) {
    try {
      _colorSealBytes = new Uint8Array(readFileSync(p));
      return _colorSealBytes;
    } catch { /* try next */ }
  }
  logger.warn("tribal-seal-color.png not found — falling back to B&W seal");
  _colorSealBytes = getSealBytes(); // graceful fallback
  return _colorSealBytes;
}

async function embedColorSeal(pdfDoc: PDFDocument): Promise<PDFImage | null> {
  const bytes = getColorSealBytes();
  if (!bytes) return null;
  try { return await pdfDoc.embedPng(bytes); } catch { return null; }
}

async function embedSeal(pdfDoc: PDFDocument): Promise<PDFImage | null> {
  const bytes = getSealBytes();
  if (!bytes) return null;
  try { return await pdfDoc.embedPng(bytes); } catch { return null; }
}

/** Draw the seal centered horizontally, with the bottom edge at `yBottom`. */
function drawSeal(page: PDFPage, seal: PDFImage, size: number, yBottom: number): void {
  const dims = seal.scaleToFit(size, size);
  page.drawImage(seal, {
    x: (PAGE_W - dims.width) / 2,
    y: yBottom,
    width: dims.width,
    height: dims.height,
  });
}

const PT_PER_INCH = 72;
const PAGE_W = 8.5 * PT_PER_INCH;
const PAGE_H = 11 * PT_PER_INCH;

const MARGIN_TOP = 2.5 * PT_PER_INCH;
const MARGIN_BOTTOM = 0.5 * PT_PER_INCH;
const MARGIN_LEFT = 0.5 * PT_PER_INCH;
const MARGIN_RIGHT = 0.5 * PT_PER_INCH;

const CONTENT_WIDTH = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT;
const CONTENT_TOP_Y = PAGE_H - MARGIN_TOP;
const CONTENT_BOTTOM_Y = MARGIN_BOTTOM;

const FONT_TITLE_SIZE = 15;
const FONT_BODY_SIZE = 11;
const FONT_SMALL_SIZE = 9;
const LINE_HEIGHT_BODY = FONT_BODY_SIZE * 1.2;
const LINE_HEIGHT_TITLE = FONT_TITLE_SIZE * 1.2;

export interface RecorderMetadata {
  returnAddress?: string;
  apn?: string;
  county?: string;
  state?: string;
  filingCategory?: string;
  trustStatus?: string;
  landClassification?: string;
  documentType?: string;
  requiresNotary?: boolean;
  filingNumber?: string;
}

export interface PdfBuildInput {
  title: string;
  parties: Record<string, string>;
  land: {
    description?: string;
    apn?: string;
    county?: string;
    state?: string;
    classification?: string;
  };
  provisions: string[];
  trusteeNotes?: string;
  recorderMetadata: RecorderMetadata;
}

export interface PdfResult {
  buffer: Buffer;
  pageCount: number;
  generatedAt: string;
  checksum: string;
}

function drawTextWrapped(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  lineHeight: number,
  color = rgb(0, 0, 0),
): number {
  const safe = text.replace(/[\n\r\t]/g, " ").replace(/[ ]{2,}/g, " ").trim();
  const words = safe.split(" ");
  let line = "";
  let currentY = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, size);
    if (testWidth > maxWidth && line) {
      page.drawText(line, { x, y: currentY, size, font, color });
      currentY -= lineHeight;
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) {
    page.drawText(line, { x, y: currentY, size, font, color });
    currentY -= lineHeight;
  }
  return currentY;
}

function drawCentered(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color = rgb(0, 0, 0),
): void {
  const textWidth = font.widthOfTextAtSize(text, size);
  const x = (PAGE_W - textWidth) / 2;
  page.drawText(text, { x, y, size, font, color });
}

const TRUST_LAND_PROVISIONS = [
  "TRUST STATUS DECLARATION: The land described herein is held in trust by the United States Government for the benefit of an Indian tribe or individual Indian pursuant to the Indian Reorganization Act, 25 U.S.C. § 5108, and is subject to restrictions on alienation imposed by 25 U.S.C. § 177.",
  "INDIAN LAND PROTECTION ACT NOTICE: This instrument involves Indian trust land or restricted Indian land protected under federal law. No transfer, encumbrance, lease, or other disposition of this land may be made without the approval of the Secretary of the Interior or authorized delegate as required by 25 U.S.C. § 177 and 25 C.F.R. Part 152.",
  "FEDERAL PREEMPTION CLAUSE: Federal law expressly preempts any state or local law that would impair the rights of Indian tribes or individual Indians with respect to this trust land transaction. Worcester v. Georgia, 31 U.S. (6 Pet.) 515 (1832); McClanahan v. Arizona State Tax Comm'n, 411 U.S. 164 (1973); White Mountain Apache Tribe v. Bracker, 448 U.S. 136 (1980).",
  "TRIBAL JURISDICTION STATEMENT: This instrument is subject to the laws, regulations, and jurisdiction of the applicable tribal nation. All disputes arising from this instrument shall be subject to tribal court jurisdiction as provided under tribal law and federal Indian law.",
  "NON-WAIVER OF SOVEREIGNTY: Nothing in this instrument shall be construed as a waiver of the sovereign immunity of the United States, any Indian tribe, or tribal government. This instrument is executed under federal trust authority and tribal sovereign authority.",
  "WORCESTER v. GEORGIA DOCTRINE: Pursuant to Worcester v. Georgia, 31 U.S. 515 (1832), state law has no force or effect within Indian Country with respect to Indian tribes and individual Indians on trust land. The rights set forth herein are protected against state interference.",
  "SNYDER ACT REFERENCE: This instrument is issued under the authority of the Snyder Act, 25 U.S.C. § 13, which authorizes the Bureau of Indian Affairs to expend appropriated funds for the benefit, care, and assistance of Indians throughout the United States.",
  "PROTECTED STATUS NOTICE: This document is a recorder-compliant sovereign trust instrument issued under the authority of the Chief Justice and Trustee of the Sovereign Office. It constitutes notice to all parties, including county recorders, state agencies, and third parties, of the protected status of the land described herein.",
];

export async function buildRecorderPdf(input: PdfBuildInput): Promise<PdfResult> {
  const pdfDoc = await PDFDocument.create();
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const sealImage = await embedSeal(pdfDoc);

  const meta = input.recorderMetadata;
  const allProvisions = [...TRUST_LAND_PROVISIONS, ...input.provisions];

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let pageNum = 1;
  const totalPagesPlaceholder = "XX";

  function addNewPage(): PDFPage {
    const p = pdfDoc.addPage([PAGE_W, PAGE_H]);
    pageNum++;
    drawPageFooter(p, pageNum, totalPagesPlaceholder, timesRoman);
    return p;
  }

  function drawPageFooter(p: PDFPage, num: number, total: string, font: PDFFont): void {
    drawCentered(p, `Page ${num} of ${total}`, MARGIN_BOTTOM - 4, font, FONT_SMALL_SIZE, rgb(0.3, 0.3, 0.3));
  }

  let currentY = PAGE_H - 12;

  if (meta.returnAddress) {
    page.drawText("AFTER RECORDING RETURN TO:", { x: MARGIN_LEFT, y: currentY, size: FONT_SMALL_SIZE, font: timesBold });
    currentY -= 12;
    for (const line of meta.returnAddress.split("\n")) {
      page.drawText(line.trim(), { x: MARGIN_LEFT, y: currentY, size: FONT_SMALL_SIZE, font: timesRoman });
      currentY -= 11;
    }
  }

  const apn = meta.apn ?? input.land.apn;
  if (apn) {
    const apnLabel = "APN:";
    const apnText = `${apnLabel} ${apn}`;
    const apnX = PAGE_W - MARGIN_RIGHT - timesBold.widthOfTextAtSize(apnText, FONT_SMALL_SIZE) - 4;
    page.drawText("APN:", { x: apnX, y: PAGE_H - 12, size: FONT_SMALL_SIZE, font: timesBold });
    page.drawText(apn, { x: apnX + timesBold.widthOfTextAtSize("APN: ", FONT_SMALL_SIZE), y: PAGE_H - 12, size: FONT_SMALL_SIZE, font: timesRoman });
  }

  if (meta.county || meta.state) {
    const countyState = [meta.county, meta.state].filter(Boolean).join(", ");
    const csWidth = timesRoman.widthOfTextAtSize(`County of ${countyState}`, FONT_SMALL_SIZE);
    page.drawText(`County of ${countyState}`, {
      x: PAGE_W - MARGIN_RIGHT - csWidth,
      y: PAGE_H - 22,
      size: FONT_SMALL_SIZE,
      font: timesRoman,
    });
  }

  if (meta.filingNumber) {
    const fnLabel = "Filing No.: ";
    const fnText = meta.filingNumber;
    const fnLabelW = timesBold.widthOfTextAtSize(fnLabel, FONT_SMALL_SIZE);
    const fnTextW = timesRoman.widthOfTextAtSize(fnText, FONT_SMALL_SIZE);
    const fnX = PAGE_W - MARGIN_RIGHT - fnLabelW - fnTextW;
    page.drawText(fnLabel, { x: fnX, y: PAGE_H - 32, size: FONT_SMALL_SIZE, font: timesBold });
    page.drawText(fnText, { x: fnX + fnLabelW, y: PAGE_H - 32, size: FONT_SMALL_SIZE, font: timesRoman });
  }

  page.drawLine({
    start: { x: MARGIN_LEFT, y: MARGIN_TOP - 4 },
    end: { x: PAGE_W - MARGIN_RIGHT, y: MARGIN_TOP - 4 },
    thickness: 0.75,
    color: rgb(0, 0, 0),
  });

  const docTypeLine = meta.documentType ?? "TRUST INSTRUMENT";
  const titleY = CONTENT_TOP_Y + (MARGIN_TOP - CONTENT_TOP_Y + MARGIN_TOP) / 2;

  // Tribal seal - centered in the recorder header area above the document title
  if (sealImage) drawSeal(page, sealImage, 56, CONTENT_TOP_Y + 58);

  drawCentered(page, "SOVEREIGN OFFICE OF THE CHIEF JUSTICE & TRUSTEE", CONTENT_TOP_Y + 50, timesBold, FONT_SMALL_SIZE + 1, rgb(0.1, 0.1, 0.4));
  drawCentered(page, docTypeLine.toUpperCase(), CONTENT_TOP_Y + 32, timesBold, FONT_TITLE_SIZE + 1);
  drawCentered(page, input.title.toUpperCase(), CONTENT_TOP_Y + 14, timesBold, FONT_TITLE_SIZE - 1);

  const noticeText = "NOTICE AFFECTING REAL PROPERTY - RECORD IN CHAIN OF TITLE";
  drawCentered(page, noticeText, CONTENT_TOP_Y - 4, timesItalic, FONT_SMALL_SIZE + 1, rgb(0.3, 0.1, 0.1));

  currentY = CONTENT_TOP_Y - 26;

  page.drawLine({
    start: { x: MARGIN_LEFT, y: currentY + 2 },
    end: { x: PAGE_W - MARGIN_RIGHT, y: currentY + 2 },
    thickness: 0.5,
    color: rgb(0, 0, 0),
  });
  currentY -= 18;

  page.drawText("PARTIES:", { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
  currentY -= LINE_HEIGHT_BODY;

  for (const [role, name] of Object.entries(input.parties)) {
    const label = `${role.toUpperCase()}: `;
    const labelW = timesBold.widthOfTextAtSize(label, FONT_BODY_SIZE);
    page.drawText(label, { x: MARGIN_LEFT + 12, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
    page.drawText(name, { x: MARGIN_LEFT + 12 + labelW, y: currentY, size: FONT_BODY_SIZE, font: timesRoman });
    currentY -= LINE_HEIGHT_BODY;
    if (currentY < CONTENT_BOTTOM_Y + 72) {
      page = addNewPage();
      currentY = CONTENT_TOP_Y;
    }
  }

  currentY -= 6;
  page.drawText("LEGAL DESCRIPTION OF LAND:", { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
  currentY -= LINE_HEIGHT_BODY;

  if (input.land.description) {
    currentY = drawTextWrapped(page, input.land.description, MARGIN_LEFT + 12, currentY, CONTENT_WIDTH - 12, timesRoman, FONT_BODY_SIZE, LINE_HEIGHT_BODY);
  }
  if (input.land.classification) {
    currentY -= 4;
    page.drawText(`Land Classification: ${input.land.classification}`, { x: MARGIN_LEFT + 12, y: currentY, size: FONT_BODY_SIZE, font: timesItalic });
    currentY -= LINE_HEIGHT_BODY;
  }
  currentY -= 8;

  for (const provision of allProvisions) {
    if (currentY < CONTENT_BOTTOM_Y + 100) {
      page = addNewPage();
      currentY = CONTENT_TOP_Y;
    }

    const subLines = provision.split(/\n/);
    for (let si = 0; si < subLines.length; si++) {
      const subLine = subLines[si].trim();
      if (!subLine) {
        currentY -= LINE_HEIGHT_BODY * 0.5;
        continue;
      }
      if (currentY < CONTENT_BOTTOM_Y + 60) {
        page = addNewPage();
        currentY = CONTENT_TOP_Y;
      }
      const colonIdx = subLine.indexOf(":");
      if (si === 0 && colonIdx > 0 && colonIdx < 60) {
        const heading = subLine.substring(0, colonIdx + 1);
        const rest = subLine.substring(colonIdx + 1).trim();
        page.drawText(heading, { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
        currentY -= LINE_HEIGHT_BODY;
        if (rest) {
          currentY = drawTextWrapped(page, rest, MARGIN_LEFT + 12, currentY, CONTENT_WIDTH - 12, timesRoman, FONT_BODY_SIZE, LINE_HEIGHT_BODY);
        }
      } else {
        const indent = subLine.startsWith("-") || subLine.startsWith("*") ? MARGIN_LEFT + 12 : MARGIN_LEFT;
        currentY = drawTextWrapped(page, subLine, indent, currentY, CONTENT_WIDTH - (indent - MARGIN_LEFT), timesRoman, FONT_BODY_SIZE, LINE_HEIGHT_BODY);
      }
    }
    currentY -= 6;
  }

  if (input.trusteeNotes) {
    if (currentY < CONTENT_BOTTOM_Y + 120) {
      page = addNewPage();
      currentY = CONTENT_TOP_Y;
    }
    currentY -= 6;
    page.drawText("TRUSTEE NOTES:", { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
    currentY -= LINE_HEIGHT_BODY;
    currentY = drawTextWrapped(page, input.trusteeNotes, MARGIN_LEFT + 12, currentY, CONTENT_WIDTH - 12, timesItalic, FONT_BODY_SIZE, LINE_HEIGHT_BODY);
    currentY -= 8;
  }

  const SIG_BLOCK_HEIGHT = 1.5 * PT_PER_INCH;
  const sigY = CONTENT_BOTTOM_Y + SIG_BLOCK_HEIGHT;

  if (currentY < sigY + 60) {
    page = addNewPage();
    currentY = CONTENT_TOP_Y;
  }

  currentY = sigY + 48;
  page.drawLine({
    start: { x: MARGIN_LEFT, y: currentY - 12 },
    end: { x: PAGE_W - MARGIN_RIGHT, y: currentY - 12 },
    thickness: 0.5,
    color: rgb(0.3, 0.3, 0.3),
  });

  page.drawText("SIGNATURE BLOCK", { x: MARGIN_LEFT, y: currentY, size: FONT_SMALL_SIZE, font: timesBold, color: rgb(0.3, 0.3, 0.3) });
  currentY -= LINE_HEIGHT_BODY + 4;

  const midX = PAGE_W / 2;
  page.drawText("Trustee Signature:", { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
  page.drawText("Date:", { x: midX + 18, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
  currentY -= 4;
  page.drawLine({ start: { x: MARGIN_LEFT, y: currentY - 16 }, end: { x: midX - 18, y: currentY - 16 }, thickness: 0.5, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: midX + 48, y: currentY - 16 }, end: { x: PAGE_W - MARGIN_RIGHT, y: currentY - 16 }, thickness: 0.5, color: rgb(0, 0, 0) });
  currentY -= 28;

  page.drawText("Print Name:", { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
  page.drawText("Title:", { x: midX + 18, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
  currentY -= 4;
  page.drawLine({ start: { x: MARGIN_LEFT, y: currentY - 16 }, end: { x: midX - 18, y: currentY - 16 }, thickness: 0.5, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: midX + 48, y: currentY - 16 }, end: { x: PAGE_W - MARGIN_RIGHT, y: currentY - 16 }, thickness: 0.5, color: rgb(0, 0, 0) });

  if (meta.requiresNotary) {
    currentY -= 36;
    page.drawText("NOTARY ACKNOWLEDGMENT", { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
    currentY -= LINE_HEIGHT_BODY;
    const stateStr = meta.state ?? "_______________";
    const countyStr = meta.county ?? "_______________";
    page.drawText(`State of ${stateStr}, County of ${countyStr}`, { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesRoman });
    currentY -= LINE_HEIGHT_BODY;
    page.drawText("Before me, the undersigned notary, personally appeared ___________________________, known to me to be the", {
      x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesRoman,
    });
    currentY -= LINE_HEIGHT_BODY;
    page.drawText("person whose name is subscribed to the foregoing instrument and acknowledged to me that they executed the same.", {
      x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesRoman,
    });
    currentY -= LINE_HEIGHT_BODY * 2;
    page.drawText("Notary Signature:", { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
    page.drawText("My Commission Expires:", { x: midX + 18, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
    currentY -= 4;
    page.drawLine({ start: { x: MARGIN_LEFT, y: currentY - 16 }, end: { x: midX - 18, y: currentY - 16 }, thickness: 0.5, color: rgb(0, 0, 0) });
    page.drawLine({ start: { x: midX + 120, y: currentY - 16 }, end: { x: PAGE_W - MARGIN_RIGHT, y: currentY - 16 }, thickness: 0.5, color: rgb(0, 0, 0) });
  }

  drawPageFooter(page, 1, totalPagesPlaceholder, timesRoman);

  const pdfBytes = await pdfDoc.save();

  const crypto = await import("node:crypto");
  const checksum = crypto.createHash("sha256").update(pdfBytes).digest("hex").substring(0, 16);

  logger.info({ title: input.title, pages: pageNum, bytes: pdfBytes.length }, "Recorder-compliant PDF generated");

  return {
    buffer: Buffer.from(pdfBytes),
    pageCount: pageNum,
    generatedAt: new Date().toISOString(),
    checksum,
  };
}

export interface WelfarePdfInput {
  id: number;
  title: string;
  welfareAct: string;
  troSensitive: boolean;
  emergencyOrder: boolean;
  parties: Record<string, string>;
  content: string;
  doctrinesApplied: string[];
}

export async function buildWelfarePdf(input: WelfarePdfInput): Promise<PdfResult> {
  const pdfDoc = await PDFDocument.create();
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const sealImage = await embedSeal(pdfDoc);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let pageNum = 1;

  function addNewPage(): PDFPage {
    const p = pdfDoc.addPage([PAGE_W, PAGE_H]);
    pageNum++;
    drawCentered(p, `Page ${pageNum} of XX`, MARGIN_BOTTOM - 4, timesRoman, FONT_SMALL_SIZE, rgb(0.3, 0.3, 0.3));
    return p;
  }

  let currentY = PAGE_H - 12;

  page.drawText("SOVEREIGN OFFICE OF THE CHIEF JUSTICE & TRUSTEE", { x: MARGIN_LEFT, y: currentY, size: FONT_SMALL_SIZE, font: timesBold, color: rgb(0.1, 0.1, 0.4) });
  currentY -= 12;
  page.drawText("Office of Tribal Welfare Instruments & Protective Orders", { x: MARGIN_LEFT, y: currentY, size: FONT_SMALL_SIZE, font: timesRoman, color: rgb(0.3, 0.3, 0.3) });

  if (input.troSensitive || input.emergencyOrder) {
    const alertText = input.emergencyOrder ? "** EMERGENCY ORDER -- IMMEDIATE ACTION REQUIRED **" : "** TRO-SENSITIVE INSTRUMENT **";
    const alertColor = rgb(0.65, 0.1, 0.1);
    const alertW = timesBold.widthOfTextAtSize(alertText, FONT_BODY_SIZE + 1);
    const alertX = (PAGE_W - alertW) / 2;
    page.drawRectangle({ x: alertX - 8, y: PAGE_H - 44, width: alertW + 16, height: 16, color: rgb(0.97, 0.93, 0.93) });
    page.drawText(alertText, { x: alertX, y: PAGE_H - 42, size: FONT_BODY_SIZE + 1, font: timesBold, color: alertColor });
  }

  page.drawLine({
    start: { x: MARGIN_LEFT, y: MARGIN_TOP - 4 },
    end: { x: PAGE_W - MARGIN_RIGHT, y: MARGIN_TOP - 4 },
    thickness: 1.5,
    color: input.emergencyOrder ? rgb(0.65, 0.1, 0.1) : rgb(0.1, 0.1, 0.4),
  });

  // Tribal seal - centered above the document title
  if (sealImage) {
    drawSeal(page, sealImage, 52, CONTENT_TOP_Y + 46);
  }
  drawCentered(page, input.title.toUpperCase(), CONTENT_TOP_Y + 38, timesBold, FONT_TITLE_SIZE);
  drawCentered(page, `Welfare Act: ${input.welfareAct}`, CONTENT_TOP_Y + 20, timesItalic, FONT_BODY_SIZE, rgb(0.3, 0.1, 0.1));
  // Authority line (replaces old text placeholder)
  drawCentered(page, `MATHIAS EL TRIBE - SEAT OF THE TRIBAL GOVERNMENT`, CONTENT_TOP_Y + 4, timesRoman, FONT_SMALL_SIZE - 1, rgb(0.35, 0.35, 0.35));

  currentY = CONTENT_TOP_Y - 16;

  page.drawLine({
    start: { x: MARGIN_LEFT, y: currentY + 2 },
    end: { x: PAGE_W - MARGIN_RIGHT, y: currentY + 2 },
    thickness: 0.5,
    color: rgb(0, 0, 0),
  });
  currentY -= 16;

  if (Object.keys(input.parties).length > 0) {
    page.drawText("PARTIES:", { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
    currentY -= LINE_HEIGHT_BODY;
    for (const [role, name] of Object.entries(input.parties)) {
      const label = `${role.toUpperCase()}: `;
      const labelW = timesBold.widthOfTextAtSize(label, FONT_BODY_SIZE);
      page.drawText(label, { x: MARGIN_LEFT + 12, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
      page.drawText(name, { x: MARGIN_LEFT + 12 + labelW, y: currentY, size: FONT_BODY_SIZE, font: timesRoman });
      currentY -= LINE_HEIGHT_BODY;
      if (currentY < CONTENT_BOTTOM_Y + 72) { page = addNewPage(); currentY = CONTENT_TOP_Y; }
    }
    currentY -= 6;
  }

  if (input.doctrinesApplied.length > 0) {
    page.drawText("DOCTRINES APPLIED:", { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
    currentY -= LINE_HEIGHT_BODY;
    for (const d of input.doctrinesApplied) {
      if (currentY < CONTENT_BOTTOM_Y + 72) { page = addNewPage(); currentY = CONTENT_TOP_Y; }
      const truncated = d.length > 120 ? d.substring(0, 117) + "..." : d;
      page.drawText(`* ${truncated}`, { x: MARGIN_LEFT + 12, y: currentY, size: FONT_SMALL_SIZE, font: timesRoman });
      currentY -= LINE_HEIGHT_BODY - 2;
    }
    currentY -= 6;
  }

  const contentLines = input.content.split("\n");
  for (const line of contentLines) {
    if (currentY < CONTENT_BOTTOM_Y + 80) { page = addNewPage(); currentY = CONTENT_TOP_Y; }
    const trimmed = line.trim();
    if (!trimmed) { currentY -= LINE_HEIGHT_BODY * 0.4; continue; }
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 0 && !trimmed.startsWith("*")) {
      if (currentY < CONTENT_BOTTOM_Y + 100) { page = addNewPage(); currentY = CONTENT_TOP_Y; }
      currentY = drawTextWrapped(page, trimmed, MARGIN_LEFT, currentY, CONTENT_WIDTH, timesBold, FONT_BODY_SIZE, LINE_HEIGHT_BODY);
    } else {
      currentY = drawTextWrapped(page, trimmed, MARGIN_LEFT, currentY, CONTENT_WIDTH, timesRoman, FONT_BODY_SIZE, LINE_HEIGHT_BODY);
    }
  }

  const sigY = CONTENT_BOTTOM_Y + 1.8 * PT_PER_INCH;
  if (currentY < sigY + 60) { page = addNewPage(); currentY = CONTENT_TOP_Y; }

  currentY = sigY + 52;
  page.drawLine({ start: { x: MARGIN_LEFT, y: currentY - 10 }, end: { x: PAGE_W - MARGIN_RIGHT, y: currentY - 10 }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) });
  page.drawText("SIGNATURE BLOCK - SOVEREIGN OFFICE OF THE CHIEF JUSTICE & TRUSTEE", { x: MARGIN_LEFT, y: currentY, size: FONT_SMALL_SIZE, font: timesBold, color: rgb(0.3, 0.3, 0.3) });
  currentY -= LINE_HEIGHT_BODY + 6;

  const midX = PAGE_W / 2;
  page.drawText(input.emergencyOrder ? "Emergency Order - Chief Justice Signature:" : "Chief Justice & Trustee Signature:", { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
  page.drawText("Date:", { x: midX + 18, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
  currentY -= 4;
  page.drawLine({ start: { x: MARGIN_LEFT, y: currentY - 16 }, end: { x: midX - 18, y: currentY - 16 }, thickness: 0.5, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: midX + 48, y: currentY - 16 }, end: { x: PAGE_W - MARGIN_RIGHT, y: currentY - 16 }, thickness: 0.5, color: rgb(0, 0, 0) });
  currentY -= 30;

  page.drawText("Intake Officer Signature:", { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
  page.drawText("Badge/ID:", { x: midX + 18, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
  currentY -= 4;
  page.drawLine({ start: { x: MARGIN_LEFT, y: currentY - 16 }, end: { x: midX - 18, y: currentY - 16 }, thickness: 0.5, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: midX + 70, y: currentY - 16 }, end: { x: PAGE_W - MARGIN_RIGHT, y: currentY - 16 }, thickness: 0.5, color: rgb(0, 0, 0) });

  drawCentered(page, `Page 1 of XX`, MARGIN_BOTTOM - 4, timesRoman, FONT_SMALL_SIZE, rgb(0.3, 0.3, 0.3));

  const pdfBytes = await pdfDoc.save();
  const crypto = await import("node:crypto");
  const checksum = crypto.createHash("sha256").update(pdfBytes).digest("hex").substring(0, 16);

  logger.info({ id: input.id, welfareAct: input.welfareAct, troSensitive: input.troSensitive, pages: pageNum }, "Welfare instrument PDF generated");

  return {
    buffer: Buffer.from(pdfBytes),
    pageCount: pageNum,
    generatedAt: new Date().toISOString(),
    checksum,
  };
}

/** Strip control characters (newlines, tabs, etc.) that WinAnsi cannot encode. */
function sanitizeForPdf(text: string): string {
  return text
    .replace(/\r\n/g, " ")
    .replace(/[\n\r\t]/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

/** Split multi-line text into clean, PDF-safe paragraphs. */
function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map(p => p.replace(/[\n\r\t]/g, " ").replace(/[ ]{2,}/g, " ").trim())
    .filter(Boolean);
}

export async function buildNfrRecorderPdf(nfrId: number, content: string, classificationData?: Record<string, string>): Promise<PdfResult> {
  const paragraphs = splitIntoParagraphs(content);
  return buildRecorderPdf({
    title: `Notice of Federal Review - NFR #${nfrId}`,
    parties: {
      "Issuing Authority": "Sovereign Office of the Chief Justice & Trustee",
      "Subject": sanitizeForPdf(classificationData?.actorType ?? "Respondent"),
    },
    land: {
      description: sanitizeForPdf(classificationData?.rawText ?? "See attached legal description"),
      classification: sanitizeForPdf(classificationData?.landStatus ?? "Indian Trust Land"),
    },
    provisions: paragraphs.length > 0 ? paragraphs : [sanitizeForPdf(content)],
    recorderMetadata: {
      documentType: "NOTICE OF FEDERAL REVIEW",
      filingCategory: "Court Document",
      trustStatus: "Federal Trust Land",
      requiresNotary: false,
    },
  });
}

export interface CourtDocumentPdfInput {
  id: number;
  title: string;
  documentType: string;
  templateName: string;
  parties: Record<string, string>;
  content: string;
  signatureBlock: string;
  troSensitive: boolean;
  emergencyOrder: boolean;
  doctrinesApplied: string[];
  lawRefs: Array<{ citation: string; title: string }>;
  caseDetails?: Record<string, string>;
}

export async function buildCourtDocumentPdf(input: CourtDocumentPdfInput): Promise<PdfResult> {
  const pdfDoc = await PDFDocument.create();
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const sealImage = await embedSeal(pdfDoc);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let pageNum = 1;

  function addNewPage(): PDFPage {
    const p = pdfDoc.addPage([PAGE_W, PAGE_H]);
    pageNum++;
    drawCentered(p, `Page ${pageNum} of XX`, MARGIN_BOTTOM - 4, timesRoman, FONT_SMALL_SIZE, rgb(0.3, 0.3, 0.3));
    return p;
  }

  let currentY = PAGE_H - 12;

  page.drawText("SOVEREIGN OFFICE OF THE CHIEF JUSTICE & TRUSTEE", {
    x: MARGIN_LEFT, y: currentY, size: FONT_SMALL_SIZE, font: timesBold, color: rgb(0.1, 0.1, 0.4),
  });
  currentY -= 12;
  page.drawText("Court Documents Division - Legacy Court Document Generator", {
    x: MARGIN_LEFT, y: currentY, size: FONT_SMALL_SIZE, font: timesRoman, color: rgb(0.3, 0.3, 0.3),
  });

  if (input.troSensitive || input.emergencyOrder) {
    const alertText = input.emergencyOrder ? "** EMERGENCY ORDER -- IMMEDIATE ACTION REQUIRED **" : "** TRO-SENSITIVE DOCUMENT **";
    const alertColor = rgb(0.65, 0.1, 0.1);
    const alertW = timesBold.widthOfTextAtSize(alertText, FONT_BODY_SIZE + 1);
    const alertX = (PAGE_W - alertW) / 2;
    page.drawRectangle({ x: alertX - 8, y: PAGE_H - 44, width: alertW + 16, height: 16, color: rgb(0.97, 0.93, 0.93) });
    page.drawText(alertText, { x: alertX, y: PAGE_H - 42, size: FONT_BODY_SIZE + 1, font: timesBold, color: alertColor });
  }

  page.drawLine({
    start: { x: MARGIN_LEFT, y: MARGIN_TOP - 4 },
    end: { x: PAGE_W - MARGIN_RIGHT, y: MARGIN_TOP - 4 },
    thickness: 1.5,
    color: input.emergencyOrder ? rgb(0.65, 0.1, 0.1) : rgb(0.1, 0.1, 0.4),
  });

  // Tribal seal - centered in the court document header
  if (sealImage) drawSeal(page, sealImage, 52, CONTENT_TOP_Y + 46);

  drawCentered(page, input.documentType.toUpperCase().replace(/_/g, " "), CONTENT_TOP_Y + 40, timesBold, FONT_SMALL_SIZE + 1, rgb(0.1, 0.1, 0.4));
  drawCentered(page, input.title.toUpperCase(), CONTENT_TOP_Y + 22, timesBold, FONT_TITLE_SIZE);
  drawCentered(page, `[ ${input.templateName} ]`, CONTENT_TOP_Y + 4, timesItalic, FONT_SMALL_SIZE, rgb(0.4, 0.4, 0.4));

  currentY = CONTENT_TOP_Y - 16;

  page.drawLine({ start: { x: MARGIN_LEFT, y: currentY + 2 }, end: { x: PAGE_W - MARGIN_RIGHT, y: currentY + 2 }, thickness: 0.5, color: rgb(0, 0, 0) });
  currentY -= 16;

  if (Object.keys(input.parties).length > 0) {
    page.drawText("PARTIES:", { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
    currentY -= LINE_HEIGHT_BODY;
    for (const [role, name] of Object.entries(input.parties)) {
      const label = `${role.toUpperCase()}: `;
      const labelW = timesBold.widthOfTextAtSize(label, FONT_BODY_SIZE);
      page.drawText(label, { x: MARGIN_LEFT + 12, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
      page.drawText(name, { x: MARGIN_LEFT + 12 + labelW, y: currentY, size: FONT_BODY_SIZE, font: timesRoman });
      currentY -= LINE_HEIGHT_BODY;
      if (currentY < CONTENT_BOTTOM_Y + 72) { page = addNewPage(); currentY = CONTENT_TOP_Y; }
    }
    currentY -= 6;
  }

  if (input.caseDetails && Object.keys(input.caseDetails).length > 0) {
    page.drawText("CASE DETAILS:", { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
    currentY -= LINE_HEIGHT_BODY;
    for (const [k, v] of Object.entries(input.caseDetails)) {
      if (!v) continue;
      if (currentY < CONTENT_BOTTOM_Y + 60) { page = addNewPage(); currentY = CONTENT_TOP_Y; }
      const label = `${k}: `;
      const labelW = timesBold.widthOfTextAtSize(label, FONT_SMALL_SIZE);
      page.drawText(label, { x: MARGIN_LEFT + 12, y: currentY, size: FONT_SMALL_SIZE, font: timesBold });
      page.drawText(String(v), { x: MARGIN_LEFT + 12 + labelW, y: currentY, size: FONT_SMALL_SIZE, font: timesRoman });
      currentY -= LINE_HEIGHT_BODY - 2;
    }
    currentY -= 4;
  }

  const contentLines = input.content.split("\n");
  for (const rawLine of contentLines) {
    if (currentY < CONTENT_BOTTOM_Y + 80) { page = addNewPage(); currentY = CONTENT_TOP_Y; }
    const line = rawLine.trimEnd();
    if (!line.trim()) { currentY -= LINE_HEIGHT_BODY * 0.4; continue; }
    if (line === line.toUpperCase() && line.trim().length > 2 && !line.startsWith("*")) {
      if (currentY < CONTENT_BOTTOM_Y + 100) { page = addNewPage(); currentY = CONTENT_TOP_Y; }
      currentY = drawTextWrapped(page, line.trim(), MARGIN_LEFT, currentY, CONTENT_WIDTH, timesBold, FONT_BODY_SIZE, LINE_HEIGHT_BODY);
    } else {
      currentY = drawTextWrapped(page, line.trim(), MARGIN_LEFT, currentY, CONTENT_WIDTH, timesRoman, FONT_BODY_SIZE, LINE_HEIGHT_BODY);
    }
  }

  if (input.doctrinesApplied.length > 0) {
    if (currentY < CONTENT_BOTTOM_Y + 120) { page = addNewPage(); currentY = CONTENT_TOP_Y; }
    currentY -= 8;
    page.drawText("DOCTRINES APPLIED:", { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
    currentY -= LINE_HEIGHT_BODY;
    for (const d of input.doctrinesApplied.slice(0, 8)) {
      if (currentY < CONTENT_BOTTOM_Y + 60) { page = addNewPage(); currentY = CONTENT_TOP_Y; }
      const truncated = d.length > 110 ? d.substring(0, 107) + "..." : d;
      page.drawText(`* ${truncated}`, { x: MARGIN_LEFT + 12, y: currentY, size: FONT_SMALL_SIZE, font: timesRoman });
      currentY -= LINE_HEIGHT_BODY - 2;
    }
  }

  if (input.lawRefs.length > 0) {
    if (currentY < CONTENT_BOTTOM_Y + 100) { page = addNewPage(); currentY = CONTENT_TOP_Y; }
    currentY -= 8;
    page.drawText("FEDERAL LAW REFERENCES:", { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
    currentY -= LINE_HEIGHT_BODY;
    for (const ref of input.lawRefs.slice(0, 6)) {
      if (currentY < CONTENT_BOTTOM_Y + 60) { page = addNewPage(); currentY = CONTENT_TOP_Y; }
      page.drawText(`* ${ref.citation} - ${ref.title}`, { x: MARGIN_LEFT + 12, y: currentY, size: FONT_SMALL_SIZE, font: timesRoman });
      currentY -= LINE_HEIGHT_BODY - 2;
    }
  }

  const sigY = CONTENT_BOTTOM_Y + 1.8 * PT_PER_INCH;
  if (currentY < sigY + 80) { page = addNewPage(); currentY = CONTENT_TOP_Y; }
  currentY = sigY + 60;

  page.drawLine({ start: { x: MARGIN_LEFT, y: currentY - 8 }, end: { x: PAGE_W - MARGIN_RIGHT, y: currentY - 8 }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) });
  page.drawText("SIGNATURE BLOCK", { x: MARGIN_LEFT, y: currentY, size: FONT_SMALL_SIZE, font: timesBold, color: rgb(0.3, 0.3, 0.3) });
  currentY -= LINE_HEIGHT_BODY + 4;

  const sigLines = input.signatureBlock.split("\n");
  for (const line of sigLines) {
    if (currentY < CONTENT_BOTTOM_Y + 12) break;
    const trimmed = line.trim();
    if (!trimmed) { currentY -= 8; continue; }
    if (trimmed.startsWith("___")) {
      page.drawLine({ start: { x: MARGIN_LEFT, y: currentY - 2 }, end: { x: MARGIN_LEFT + 200, y: currentY - 2 }, thickness: 0.5, color: rgb(0, 0, 0) });
      currentY -= LINE_HEIGHT_BODY;
    } else {
      page.drawText(trimmed, { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE - 1, font: timesRoman });
      currentY -= LINE_HEIGHT_BODY;
    }
  }

  drawCentered(page, `Page 1 of XX`, MARGIN_BOTTOM - 4, timesRoman, FONT_SMALL_SIZE, rgb(0.3, 0.3, 0.3));

  const pdfBytes = await pdfDoc.save();
  const crypto = await import("node:crypto");
  const checksum = crypto.createHash("sha256").update(pdfBytes).digest("hex").substring(0, 16);
  logger.info({ id: input.id, documentType: input.documentType, troSensitive: input.troSensitive, pages: pageNum }, "Court document PDF generated");
  return { buffer: Buffer.from(pdfBytes), pageCount: pageNum, generatedAt: new Date().toISOString(), checksum };
}

// -- Tribal ID PDF -------------------------------------------------------------
export interface TribalIdPdfInput {
  userId: number;
  legalName: string;
  tribalName?: string;
  title?: string;
  familyGroup?: string;
  membershipStatus: string;
  protectionLevel: string;
  lineageSummary: string;
  identityTags: string[];
  isElder: boolean;
  elderStatus: string | null;
  role: string;
  orgAffiliations: string[];
  expirationDate: string;
  profilePhotoUrl?: string;
  verificationUrl: string;
  tribalEnrollmentNumber?: string;
  tribalIdNumber?: string;
}

export interface TribalIdPdfResult {
  bytes: Uint8Array;
  generatedAt: string;
}

export async function buildTribalIdPdf(input: TribalIdPdfInput): Promise<TribalIdPdfResult> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 396]); // ID card landscape - 8.5 x 5.5 inches
  const { width, height } = page.getSize();
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Background — deep navy so the full-color tribal seal reads true
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.08, 0.11, 0.22) });

  // Subtle inner card area (lighter navy stripe)
  page.drawRectangle({ x: 8, y: 8, width: width - 16, height: height - 16,
    borderColor: rgb(0.6, 0.5, 0.2), borderWidth: 0.8, color: rgb(0.10, 0.14, 0.28) });

  // -- Logo panel (left 130pt wide) -----------------------------------------
  const LOGO_PANEL_W = 130;
  page.drawRectangle({ x: 8, y: 8, width: LOGO_PANEL_W, height: height - 16, color: rgb(0.06, 0.09, 0.18) });

  // Full-color tribal seal — centered in logo panel, fills most of it
  const seal = await embedColorSeal(pdfDoc);
  if (seal) {
    const sealSize = 100;
    const sealX = 8 + (LOGO_PANEL_W - sealSize) / 2;
    const sealY = (height - sealSize) / 2 + 10;
    page.drawImage(seal, { x: sealX, y: sealY, width: sealSize, height: sealSize });
  }

  page.drawText("MATHIAS EL", { x: 8 + (LOGO_PANEL_W - helveticaBold.widthOfTextAtSize("MATHIAS EL", 7)) / 2, y: height - 32, size: 7, font: helveticaBold, color: rgb(0.9, 0.82, 0.4) });
  page.drawText("TRIBE", { x: 8 + (LOGO_PANEL_W - helveticaBold.widthOfTextAtSize("TRIBE", 7)) / 2, y: height - 42, size: 7, font: helveticaBold, color: rgb(0.9, 0.82, 0.4) });

  // SSML enrollment number at bottom of logo panel
  const ssmEl = input.tribalEnrollmentNumber ?? `SSMEL${String(input.userId).padStart(2, "0")}`;
  const ssmElW = helveticaBold.widthOfTextAtSize(ssmEl, 8);
  page.drawText(ssmEl, { x: 8 + (LOGO_PANEL_W - ssmElW) / 2, y: 22, size: 8, font: helveticaBold, color: rgb(0.9, 0.82, 0.4) });
  page.drawText("ENROLLMENT NO.", { x: 8 + (LOGO_PANEL_W - helvetica.widthOfTextAtSize("ENROLLMENT NO.", 5.5)) / 2, y: 14, size: 5.5, font: helvetica, color: rgb(0.65, 0.60, 0.40) });

  // Profile photo area (above SSMEL, below seal)
  if (input.profilePhotoUrl) {
    try {
      let photoBytes: Uint8Array | null = null;
      if (input.profilePhotoUrl.startsWith("data:")) {
        const base64 = input.profilePhotoUrl.split(",")[1];
        if (base64) photoBytes = new Uint8Array(Buffer.from(base64, "base64"));
      } else {
        const resp = await fetch(input.profilePhotoUrl);
        const buf = await resp.arrayBuffer();
        photoBytes = new Uint8Array(buf);
      }
      if (photoBytes) {
        const photoImg = await pdfDoc.embedPng(photoBytes).catch(() => pdfDoc.embedJpg(photoBytes!));
        const phW = 50; const phH = 55;
        const phX = 8 + (LOGO_PANEL_W - phW) / 2;
        const phY = 42;
        page.drawRectangle({ x: phX - 1, y: phY - 1, width: phW + 2, height: phH + 2, color: rgb(0.9, 0.82, 0.4) });
        page.drawImage(photoImg, { x: phX, y: phY, width: phW, height: phH });
      }
    } catch { /* no photo, skip */ }
  } else {
    // Photo placeholder
    const phW = 50; const phH = 55;
    const phX = 8 + (LOGO_PANEL_W - phW) / 2;
    const phY = 42;
    page.drawRectangle({ x: phX, y: phY, width: phW, height: phH, borderColor: rgb(0.5, 0.45, 0.25), borderWidth: 0.6, color: rgb(0.12, 0.16, 0.30) });
    page.drawText("PHOTO", { x: phX + (phW - helvetica.widthOfTextAtSize("PHOTO", 6)) / 2, y: phY + phH / 2 - 3, size: 6, font: helvetica, color: rgb(0.5, 0.5, 0.5) });
  }

  // -- Right main content area ----------------------------------------------
  const cx = LOGO_PANEL_W + 20;
  const cw = width - cx - 14;
  const GOLD = rgb(0.9, 0.82, 0.4);
  const WHITE = rgb(1, 1, 1);
  const MUTED = rgb(0.65, 0.65, 0.75);
  const LINE_H = 20;

  // Header strip
  page.drawText("SOVEREIGN IDENTITY DOCUMENT", { x: cx, y: height - 30, size: 7.5, font: helveticaBold, color: GOLD });
  page.drawText("Office of the Chief Justice & Trustee  |  Mathias El Tribe", { x: cx, y: height - 42, size: 6, font: helvetica, color: MUTED });

  // Tribal ID Number badge
  const idDisplay = input.tribalIdNumber ? `NO. ${input.tribalIdNumber}` : `ID-${String(input.userId).padStart(6, "0")}`;
  const idW = helveticaBold.widthOfTextAtSize(idDisplay, 14);
  const idX = width - idW - 18;
  page.drawText(idDisplay, { x: idX, y: height - 28, size: 14, font: helveticaBold, color: GOLD });
  page.drawText(`Exp: ${input.expirationDate}`, { x: idX, y: height - 41, size: 6, font: helvetica, color: MUTED });

  page.drawLine({ start: { x: cx, y: height - 48 }, end: { x: width - 14, y: height - 48 }, thickness: 0.5, color: rgb(0.6, 0.5, 0.2) });

  // Identity fields
  let fy = height - 66;
  function drawIdField(label: string, value: string, size = 9.5, bold = false) {
    if (!value) return;
    page.drawText(label.toUpperCase(), { x: cx, y: fy, size: 5.5, font: helvetica, color: MUTED });
    fy -= 10;
    page.drawText(value.substring(0, 52), { x: cx, y: fy, size, font: bold ? timesBold : timesRoman, color: bold ? WHITE : rgb(0.9, 0.9, 0.95) });
    fy -= LINE_H;
  }

  drawIdField("Legal Name", input.legalName, 12, true);
  if (input.tribalName) drawIdField("Tribal Name", input.tribalName, 9.5, false);
  if (input.title) drawIdField("Title / Office", input.title, 9, false);
  drawIdField("Membership Status", input.membershipStatus, 9, false);
  drawIdField("Role", input.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), 9, false);

  // Protection level badge
  const plColors: Record<string, [number,number,number]> = {
    critical: [0.8, 0.1, 0.1], elevated: [0.8, 0.5, 0.1], standard: [0.1, 0.5, 0.2],
  };
  const [pr, pg, pb] = plColors[input.protectionLevel] ?? [0.1, 0.5, 0.2];
  const plLabel = `${input.protectionLevel.toUpperCase()} PROTECTION`;
  const plW = helveticaBold.widthOfTextAtSize(plLabel, 6.5) + 10;
  page.drawRectangle({ x: cx, y: fy - 4, width: plW, height: 14, color: rgb(pr, pg, pb) });
  page.drawText(plLabel, { x: cx + 5, y: fy - 1, size: 6.5, font: helveticaBold, color: rgb(1,1,1) });

  // -- Right sub-column (lineage + QR) --------------------------------------
  const rx2 = cx + cw / 2 + 4;
  let ry = height - 66;

  page.drawText("LINEAGE SUMMARY", { x: rx2, y: ry, size: 5.5, font: helvetica, color: MUTED });
  ry -= 10;
  const linWords = input.lineageSummary.substring(0, 120);
  page.drawText(linWords, { x: rx2, y: ry, size: 7.5, font: timesRoman, color: rgb(0.85, 0.85, 0.92), maxWidth: cw / 2 - 10, lineHeight: 11 });
  ry -= Math.ceil(linWords.length / 22) * 11 + 8;

  if (input.orgAffiliations.length > 0) {
    page.drawText("AFFILIATIONS", { x: rx2, y: ry, size: 5.5, font: helvetica, color: MUTED });
    ry -= 10;
    for (const aff of input.orgAffiliations.slice(0, 4)) {
      page.drawText(`• ${aff.substring(0, 32)}`, { x: rx2, y: ry, size: 7, font: timesRoman, color: rgb(0.85, 0.85, 0.92) });
      ry -= 10;
    }
  }

  // QR code
  const qrSize = 62;
  const qrX = width - qrSize - 14;
  const qrY = 24;
  page.drawRectangle({ x: qrX - 2, y: qrY - 2, width: qrSize + 4, height: qrSize + 4, color: rgb(1,1,1) });
  try {
    const QRCode = (await import("qrcode")).default;
    const qrBuf = await QRCode.toBuffer(input.verificationUrl, { type: "png", width: 130, margin: 1 });
    const qrImg = await pdfDoc.embedPng(new Uint8Array(qrBuf));
    page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  } catch {
    page.drawText("VERIFY", { x: qrX + 12, y: qrY + qrSize / 2 - 4, size: 7, font: helveticaBold, color: rgb(0.3,0.3,0.3) });
  }
  page.drawText("scan to verify", { x: qrX + 4, y: qrY - 10, size: 5.5, font: helvetica, color: MUTED });

  // Bottom bar
  page.drawRectangle({ x: 8, y: 8, width: width - 16, height: 14, color: rgb(0.04, 0.06, 0.14) });
  page.drawText(
    "Issued under inherent sovereign authority of the Mathias El Tribe  |  Federal Trust Responsibility applies  |  Worcester v. Georgia, 31 U.S. 515 (1832)",
    { x: LOGO_PANEL_W + 16, y: 12, size: 4.8, font: helvetica, color: rgb(0.55, 0.55, 0.65) }
  );

  const pdfBytes = await pdfDoc.save();
  return { bytes: new Uint8Array(pdfBytes), generatedAt: new Date().toISOString() };
}

// -- Verification Letter PDF ---------------------------------------------------
export interface VerificationLetterInput {
  userId: number;
  legalName: string;
  tribalName?: string;
  courtCaption: string;
  title?: string;
  familyGroup?: string;
  membershipVerified: boolean;
  lineageVerified: boolean;
  entraVerified: boolean;
  lineageSummary: string;
  ancestorChain: string[];
  tribalNations: string[];
  delegatedAuthorities: string[];
  protectionLevel: string;
  jurisdictionalProtections: string[];
  isElder: boolean;
  elderStatus: string | null;
  orgAffiliations: Array<{ org: string; role: string; active: boolean }>;
  generatedFor: string;
  issueDate: string;
}

export interface VerificationLetterResult {
  bytes: Uint8Array;
  generatedAt: string;
}

export async function buildVerificationLetterPdf(input: VerificationLetterInput): Promise<VerificationLetterResult> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const { width } = page.getSize();
  const MARGIN = 60;
  const BODY_W = width - MARGIN * 2;
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({ x: 0, y: 0, width, height: 792, color: rgb(0.99, 0.98, 0.96) });

  // Seal header
  const seal = await embedSeal(pdfDoc);
  let y = 752;
  if (seal) {
    const sealSize = 60;
    page.drawImage(seal, { x: width / 2 - sealSize / 2, y: y - sealSize + 10, width: sealSize, height: sealSize });
    y -= sealSize + 8;
  } else {
    y -= 20;
  }

  const drawCenteredText = (text: string, cy: number, size: number, font: PDFFont, color = rgb(0, 0, 0)) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - w) / 2, y: cy, size, font, color });
  };

  drawCenteredText("MATHIAS EL TRIBE", y, 13, timesBold, rgb(0.1, 0.1, 0.35));
  y -= 16;
  drawCenteredText("Sovereign Office of the Chief Justice & Trustee", y, 9, timesRoman, rgb(0.3, 0.3, 0.3));
  y -= 12;
  drawCenteredText("Identity Verification Letter", y, 10, timesBold, rgb(0.1, 0.1, 0.35));
  y -= 8;

  page.drawLine({ start: { x: MARGIN, y }, end: { x: width - MARGIN, y }, thickness: 1, color: rgb(0.3, 0.3, 0.5) });
  y -= 18;

  // Date + purpose
  page.drawText(`Date: ${input.issueDate}`, { x: MARGIN, y, size: 9, font: timesRoman });
  y -= 13;
  page.drawText(`Purpose: ${input.generatedFor}`, { x: MARGIN, y, size: 9, font: timesRoman, color: rgb(0.2, 0.2, 0.2) });
  y -= 20;

  // Body opener
  const opener = `This letter is issued under the inherent sovereign authority of the Mathias El Tribe to certify and verify the identity, lineage, and delegated authorities of the following tribal member or official:`;
  page.drawText(opener, { x: MARGIN, y, size: 9, font: timesRoman, maxWidth: BODY_W, lineHeight: 13 });
  y -= 38;

  // Identity block
  page.drawRectangle({ x: MARGIN, y: y - 90, width: BODY_W, height: 95, color: rgb(0.94, 0.94, 1), borderColor: rgb(0.5, 0.5, 0.8), borderWidth: 0.5 });

  const idFields: [string, string][] = [
    ["Legal Name / Court Caption", input.courtCaption],
    ...(input.tribalName ? [["Tribal Name", input.tribalName] as [string, string]] : []),
    ...(input.title ? [["Title", input.title] as [string, string]] : []),
    ["Family Group", input.familyGroup || "On file with the Office"],
  ];
  let iy = y - 10;
  for (const [label, value] of idFields) {
    page.drawText(`${label}: `, { x: MARGIN + 10, y: iy, size: 8.5, font: timesBold });
    const lw = timesBold.widthOfTextAtSize(`${label}: `, 8.5);
    page.drawText(value, { x: MARGIN + 10 + lw, y: iy, size: 8.5, font: timesRoman });
    iy -= 13;
  }
  y -= 100;

  // Verification status
  const statusItems: [string, boolean][] = [
    ["Membership Verified", input.membershipVerified],
    ["Lineage Verified", input.lineageVerified],
    ["Entra ID Verified", input.entraVerified],
    ...(input.isElder ? [["Elder Status Recognized", true] as [string, boolean]] : []),
  ];

  page.drawText("VERIFICATION STATUS", { x: MARGIN, y, size: 8, font: timesBold, color: rgb(0.2, 0.2, 0.5) });
  y -= 12;
  for (const [label, status] of statusItems) {
    const mark = status ? "+" : "-";
    const col = status ? rgb(0, 0.5, 0) : rgb(0.6, 0.1, 0.1);
    page.drawText(`${mark}  ${label}`, { x: MARGIN + 10, y, size: 9, font: status ? timesBold : timesRoman, color: col });
    y -= 12;
  }
  y -= 6;

  // Lineage
  if (input.lineageSummary) {
    page.drawText("LINEAGE SUMMARY", { x: MARGIN, y, size: 8, font: timesBold, color: rgb(0.2, 0.2, 0.5) });
    y -= 12;
    page.drawText(input.lineageSummary.substring(0, 120), { x: MARGIN + 10, y, size: 9, font: timesRoman, maxWidth: BODY_W - 10, lineHeight: 12 });
    y -= 22;
  }

  if (input.ancestorChain.length > 0) {
    page.drawText("Lineage Chain: " + input.ancestorChain.slice(0, 5).join(" > "), { x: MARGIN + 10, y, size: 8, font: timesItalic, color: rgb(0.3, 0.3, 0.3) });
    y -= 14;
  }
  if (input.tribalNations.length > 0) {
    page.drawText("Tribal Nations: " + input.tribalNations.join(", "), { x: MARGIN + 10, y, size: 8, font: timesRoman, color: rgb(0.3, 0.3, 0.3) });
    y -= 14;
  }
  y -= 4;

  // Delegated authorities
  if (input.delegatedAuthorities.length > 0) {
    page.drawText("DELEGATED AUTHORITIES", { x: MARGIN, y, size: 8, font: timesBold, color: rgb(0.2, 0.2, 0.5) });
    y -= 12;
    for (const auth of input.delegatedAuthorities.slice(0, 8)) {
      page.drawText(`* ${auth}`, { x: MARGIN + 10, y, size: 8.5, font: timesRoman });
      y -= 11;
    }
    y -= 4;
  }

  // Org affiliations
  if (input.orgAffiliations.length > 0) {
    page.drawText("ORGANIZATIONAL AFFILIATIONS", { x: MARGIN, y, size: 8, font: timesBold, color: rgb(0.2, 0.2, 0.5) });
    y -= 12;
    for (const aff of input.orgAffiliations.slice(0, 6)) {
      page.drawText(`* ${aff.org} - ${aff.role}${aff.active ? "" : " (inactive)"}`, { x: MARGIN + 10, y, size: 8.5, font: timesRoman });
      y -= 11;
    }
    y -= 4;
  }

  // Jurisdictional protections
  if (input.jurisdictionalProtections.length > 0) {
    page.drawText("JURISDICTIONAL PROTECTIONS", { x: MARGIN, y, size: 8, font: timesBold, color: rgb(0.2, 0.2, 0.5) });
    y -= 12;
    for (const prot of input.jurisdictionalProtections.slice(0, 6)) {
      page.drawText(`*  ${prot.substring(0, 85)}`, { x: MARGIN + 10, y, size: 8, font: timesRoman, color: rgb(0.25, 0.25, 0.25) });
      y -= 11;
    }
    y -= 6;
  }

  // Closing paragraph
  page.drawLine({ start: { x: MARGIN, y }, end: { x: width - MARGIN, y }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
  y -= 14;
  page.drawText(
    `This letter is issued by the Sovereign Office of the Chief Justice & Trustee of the Mathias El Tribe under the Federal Trust Responsibility and inherent tribal sovereignty recognized in Worcester v. Georgia, 31 U.S. 515 (1832). Any person, agency, or court receiving this letter is placed on notice of the federal trust relationship and applicable Indian law protections.`,
    { x: MARGIN, y, size: 8, font: timesItalic, maxWidth: BODY_W, lineHeight: 12, color: rgb(0.3, 0.3, 0.3) }
  );
  y -= 46;

  // Signature block
  page.drawText("_______________________________________________", { x: MARGIN, y, size: 9, font: timesRoman });
  y -= 13;
  page.drawText("Chief Justice & Trustee - Mathias El Tribe", { x: MARGIN, y, size: 9, font: timesBold });
  y -= 11;
  page.drawText("Sovereign Office of the Chief Justice & Trustee", { x: MARGIN, y, size: 8, font: timesRoman, color: rgb(0.3, 0.3, 0.3) });
  y -= 10;
  page.drawText(`Protection Level: ${input.protectionLevel.toUpperCase()}  |  Document Date: ${input.issueDate}`, { x: MARGIN, y, size: 7.5, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

  const pdfBytes = await pdfDoc.save();
  return { bytes: new Uint8Array(pdfBytes), generatedAt: new Date().toISOString() };
}

export async function buildInstrumentRecorderPdf(
  instrumentId: number,
  content: string,
  jurisdiction: string,
  inputOverride?: Partial<PdfBuildInput>,
): Promise<PdfResult> {
  return buildRecorderPdf({
    title: inputOverride?.title ?? `Trust Instrument #${instrumentId}`,
    parties: inputOverride?.parties ?? { "Trustee": "Sovereign Office of the Chief Justice", "Beneficiary": "[Tribe / Individual Allottee]" },
    land: inputOverride?.land ?? { description: content.substring(0, 400), classification: "Indian Trust Land" },
    provisions: inputOverride?.provisions ?? [],
    trusteeNotes: inputOverride?.trusteeNotes,
    recorderMetadata: {
      documentType: "TRUST INSTRUMENT",
      filingCategory: "Real Property - Indian Trust Land",
      trustStatus: "Federal Trust",
      requiresNotary: true,
      ...inputOverride?.recorderMetadata,
      ...(jurisdiction ? { county: jurisdiction } : {}),
    },
  });
}

// -- Compatibility wrappers for /api/documents/* download endpoints -----------
// These adapt HEAD's rich pdf-lib builders to the Buffer-returning API
// expected by the documents router.

export async function buildNfrPdfBuffer(nfrId: number, content: string): Promise<Buffer> {
  const result = await buildNfrRecorderPdf(nfrId, content);
  return result.buffer;
}

export async function buildInstrumentPdfBuffer(
  instrumentId: number,
  content: string,
  jurisdiction: string,
  inputOverride?: Partial<PdfBuildInput>,
): Promise<Buffer> {
  const result = await buildInstrumentRecorderPdf(instrumentId, content, jurisdiction, inputOverride);
  return result.buffer;
}

// ---------------------------------------------------------------------------
// General Welfare Exclusion (GWE) Letter
// ---------------------------------------------------------------------------

export interface GweLetterInput {
  recipientName: string;
  letterDate: string;
  programName: string;
  exclusionBasis: "25 U.S.C. § 117b" | "IRC § 139E" | "25 U.S.C. § 117b / IRC § 139E";
  amount: string;
  issuingOfficer: string;
  referenceNumber?: string;
}

export async function buildGweLetterPdf(input: GweLetterInput): Promise<PdfResult> {
  const pdfDoc = await PDFDocument.create();
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const sealImage = await embedSeal(pdfDoc);

  const allPages: PDFPage[] = [];

  function addNewPage(): PDFPage {
    const p = pdfDoc.addPage([PAGE_W, PAGE_H]);
    allPages.push(p);
    return p;
  }

  let page = addNewPage();

  let currentY = PAGE_H - 12;

  // Header: office name
  page.drawText("SOVEREIGN OFFICE OF THE CHIEF JUSTICE & TRUSTEE", {
    x: MARGIN_LEFT, y: currentY, size: FONT_SMALL_SIZE, font: timesBold, color: rgb(0.1, 0.1, 0.4),
  });
  currentY -= 12;
  page.drawText("Mathias El Tribe — General Welfare Exclusion Program", {
    x: MARGIN_LEFT, y: currentY, size: FONT_SMALL_SIZE, font: timesRoman, color: rgb(0.3, 0.3, 0.3),
  });

  // Separator line below 2.5" margin area
  page.drawLine({
    start: { x: MARGIN_LEFT, y: MARGIN_TOP - 4 },
    end: { x: PAGE_W - MARGIN_RIGHT, y: MARGIN_TOP - 4 },
    thickness: 1.5,
    color: rgb(0.1, 0.1, 0.4),
  });

  // Tribal seal
  if (sealImage) drawSeal(page, sealImage, 52, CONTENT_TOP_Y + 46);

  drawCentered(page, "GENERAL WELFARE EXCLUSION LETTER", CONTENT_TOP_Y + 38, timesBold, FONT_TITLE_SIZE);
  drawCentered(page, `${input.exclusionBasis}`, CONTENT_TOP_Y + 20, timesItalic, FONT_BODY_SIZE, rgb(0.3, 0.1, 0.1));
  drawCentered(page, "MATHIAS EL TRIBE — SEAT OF THE TRIBAL GOVERNMENT", CONTENT_TOP_Y + 4, timesRoman, FONT_SMALL_SIZE - 1, rgb(0.35, 0.35, 0.35));

  currentY = CONTENT_TOP_Y - 16;

  page.drawLine({
    start: { x: MARGIN_LEFT, y: currentY + 2 },
    end: { x: PAGE_W - MARGIN_RIGHT, y: currentY + 2 },
    thickness: 0.5,
    color: rgb(0, 0, 0),
  });
  currentY -= 20;

  // Date and reference
  const refLine = input.referenceNumber ? `Ref: GWE-${input.referenceNumber}` : `Date: ${input.letterDate}`;
  page.drawText(`Date: ${input.letterDate}`, { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesRoman });
  if (input.referenceNumber) {
    const refW = timesRoman.widthOfTextAtSize(refLine, FONT_BODY_SIZE);
    page.drawText(refLine, { x: PAGE_W - MARGIN_RIGHT - refW, y: currentY, size: FONT_BODY_SIZE, font: timesRoman });
  }
  currentY -= LINE_HEIGHT_BODY * 1.5;

  // Recipient
  page.drawText("TO:", { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
  const toLabelW = timesBold.widthOfTextAtSize("TO: ", FONT_BODY_SIZE);
  page.drawText(input.recipientName, { x: MARGIN_LEFT + toLabelW, y: currentY, size: FONT_BODY_SIZE, font: timesRoman });
  currentY -= LINE_HEIGHT_BODY * 2;

  // Subject line
  page.drawText("RE:", { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
  const reLabelW = timesBold.widthOfTextAtSize("RE: ", FONT_BODY_SIZE);
  const subjectText = `General Welfare Exclusion — ${input.programName}`;
  page.drawText(subjectText, { x: MARGIN_LEFT + reLabelW, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
  currentY -= LINE_HEIGHT_BODY * 2;

  // Body paragraphs
  const bodyParagraphs = [
    `Dear ${input.recipientName},`,

    `This letter serves as official notification from the Sovereign Office of the Chief Justice & Trustee, Mathias El Tribe, that the payment or distribution described herein qualifies for exclusion from gross income under the General Welfare Exclusion doctrine codified at ${input.exclusionBasis}.`,

    `PROGRAM: ${input.programName}`,

    `EXCLUSION AMOUNT: ${input.amount}`,

    `LEGAL BASIS: Pursuant to ${input.exclusionBasis}, amounts paid under a tribal government program for the promotion of the general welfare of the members of the Indian tribe are excluded from the gross income of the recipients. This program meets all applicable requirements, including that (1) it is administered under specific Indian tribal government programs, (2) it is based on need, and (3) the excluded amounts are not compensation for services.`,

    `FEDERAL AUTHORITY: The General Welfare Exclusion reflects longstanding federal policy recognizing the unique government-to-government relationship between Indian tribes and the United States. Distributions made pursuant to tribal programs established for the general welfare of tribal members are not treated as income under applicable provisions of the Internal Revenue Code and federal Indian law.`,

    `This letter may be retained for your records and presented to any federal, state, or local agency as documentation that the referenced distribution is excluded from gross income under the applicable federal statutes. This Office assumes no responsibility for any independent tax obligations the recipient may have arising from other sources.`,

    `Questions regarding this exclusion determination may be directed to the Sovereign Office of the Chief Justice & Trustee.`,
  ];

  for (const para of bodyParagraphs) {
    if (currentY < CONTENT_BOTTOM_Y + 120) {
      page = addNewPage();
      currentY = CONTENT_TOP_Y;
    }
    if (para.startsWith("PROGRAM:") || para.startsWith("EXCLUSION AMOUNT:") || para.startsWith("LEGAL BASIS:") || para.startsWith("FEDERAL AUTHORITY:")) {
      const colonIdx = para.indexOf(":");
      const heading = para.substring(0, colonIdx + 1);
      const rest = para.substring(colonIdx + 1).trim();
      page.drawText(heading, { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
      currentY -= LINE_HEIGHT_BODY;
      if (rest) {
        currentY = drawTextWrapped(page, rest, MARGIN_LEFT + 12, currentY, CONTENT_WIDTH - 12, timesRoman, FONT_BODY_SIZE, LINE_HEIGHT_BODY);
      }
    } else {
      currentY = drawTextWrapped(page, para, MARGIN_LEFT, currentY, CONTENT_WIDTH, timesRoman, FONT_BODY_SIZE, LINE_HEIGHT_BODY);
    }
    currentY -= LINE_HEIGHT_BODY * 0.6;
  }

  // Signature block
  const sigY = CONTENT_BOTTOM_Y + 2.0 * PT_PER_INCH;
  if (currentY < sigY + 80) {
    page = addNewPage();
    currentY = CONTENT_TOP_Y;
  }

  currentY = sigY + 60;
  page.drawLine({ start: { x: MARGIN_LEFT, y: currentY - 8 }, end: { x: PAGE_W - MARGIN_RIGHT, y: currentY - 8 }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) });
  page.drawText("SIGNATURE BLOCK — SOVEREIGN OFFICE OF THE CHIEF JUSTICE & TRUSTEE", {
    x: MARGIN_LEFT, y: currentY, size: FONT_SMALL_SIZE, font: timesBold, color: rgb(0.3, 0.3, 0.3),
  });
  currentY -= LINE_HEIGHT_BODY + 8;

  page.drawText("Respectfully issued by:", { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesRoman });
  currentY -= LINE_HEIGHT_BODY + 4;

  page.drawText(input.issuingOfficer, { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
  currentY -= LINE_HEIGHT_BODY;
  page.drawText("Issuing Officer — Sovereign Office of the Chief Justice & Trustee", {
    x: MARGIN_LEFT, y: currentY, size: FONT_SMALL_SIZE, font: timesItalic, color: rgb(0.35, 0.35, 0.35),
  });
  currentY -= LINE_HEIGHT_BODY * 1.5;

  page.drawText("Signature:", { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
  page.drawText("Date:", { x: PAGE_W / 2 + 18, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
  currentY -= 4;
  page.drawLine({ start: { x: MARGIN_LEFT, y: currentY - 16 }, end: { x: PAGE_W / 2 - 18, y: currentY - 16 }, thickness: 0.5, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: PAGE_W / 2 + 48, y: currentY - 16 }, end: { x: PAGE_W - MARGIN_RIGHT, y: currentY - 16 }, thickness: 0.5, color: rgb(0, 0, 0) });

  // Post-pass: draw page footers on every page now that total is known
  const totalPages = allPages.length;
  allPages.forEach((p, idx) => {
    drawCentered(p, `Page ${idx + 1} of ${totalPages}`, MARGIN_BOTTOM - 4, timesRoman, FONT_SMALL_SIZE, rgb(0.3, 0.3, 0.3));
    p.drawText(
      `This document is issued under tribal sovereign authority. ${input.exclusionBasis}. Not valid as legal advice.`,
      { x: MARGIN_LEFT, y: MARGIN_BOTTOM + 6, size: FONT_SMALL_SIZE - 1, font: timesItalic, color: rgb(0.5, 0.5, 0.5) },
    );
  });

  const pdfBytes = await pdfDoc.save();
  const crypto = await import("node:crypto");
  const checksum = crypto.createHash("sha256").update(pdfBytes).digest("hex").substring(0, 16);

  logger.info({ recipientName: input.recipientName, programName: input.programName, pages: totalPages }, "GWE letter PDF generated");

  return {
    buffer: Buffer.from(pdfBytes),
    pageCount: totalPages,
    generatedAt: new Date().toISOString(),
    checksum,
  };
}
