import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { logger } from "./logger";

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
  const words = text.split(" ");
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

  page.drawLine({
    start: { x: MARGIN_LEFT, y: MARGIN_TOP - 4 },
    end: { x: PAGE_W - MARGIN_RIGHT, y: MARGIN_TOP - 4 },
    thickness: 0.75,
    color: rgb(0, 0, 0),
  });

  const docTypeLine = meta.documentType ?? "TRUST INSTRUMENT";
  const titleY = CONTENT_TOP_Y + (MARGIN_TOP - CONTENT_TOP_Y + MARGIN_TOP) / 2;

  drawCentered(page, "SOVEREIGN OFFICE OF THE CHIEF JUSTICE & TRUSTEE", CONTENT_TOP_Y + 40, timesBold, FONT_SMALL_SIZE + 1, rgb(0.1, 0.1, 0.4));
  drawCentered(page, docTypeLine.toUpperCase(), CONTENT_TOP_Y + 22, timesBold, FONT_TITLE_SIZE + 1);
  drawCentered(page, input.title.toUpperCase(), CONTENT_TOP_Y + 4, timesBold, FONT_TITLE_SIZE - 1);

  const noticeText = "NOTICE AFFECTING REAL PROPERTY — RECORD IN CHAIN OF TITLE";
  drawCentered(page, noticeText, CONTENT_TOP_Y - 14, timesItalic, FONT_SMALL_SIZE + 1, rgb(0.3, 0.1, 0.1));

  currentY = CONTENT_TOP_Y - 36;

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

    const firstLine = provision.indexOf(":");
    if (firstLine > 0 && firstLine < 60) {
      const heading = provision.substring(0, firstLine + 1);
      const rest = provision.substring(firstLine + 1).trim();
      page.drawText(heading, { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
      currentY -= LINE_HEIGHT_BODY;
      if (rest) {
        currentY = drawTextWrapped(page, rest, MARGIN_LEFT + 12, currentY, CONTENT_WIDTH - 12, timesRoman, FONT_BODY_SIZE, LINE_HEIGHT_BODY);
      }
    } else {
      currentY = drawTextWrapped(page, provision, MARGIN_LEFT, currentY, CONTENT_WIDTH, timesRoman, FONT_BODY_SIZE, LINE_HEIGHT_BODY);
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
    const alertText = input.emergencyOrder ? "⚑ EMERGENCY ORDER — IMMEDIATE ACTION REQUIRED" : "⚑ TRO-SENSITIVE INSTRUMENT";
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

  drawCentered(page, input.title.toUpperCase(), CONTENT_TOP_Y + 26, timesBold, FONT_TITLE_SIZE);
  drawCentered(page, `Welfare Act: ${input.welfareAct}`, CONTENT_TOP_Y + 8, timesItalic, FONT_BODY_SIZE, rgb(0.3, 0.1, 0.1));

  const sealArea = `[ TRIBAL COURT SEAL — ${input.welfareAct} AUTHORITY ]`;
  drawCentered(page, sealArea, CONTENT_TOP_Y - 8, timesRoman, FONT_SMALL_SIZE, rgb(0.4, 0.4, 0.4));

  currentY = CONTENT_TOP_Y - 28;

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
      const truncated = d.length > 120 ? d.substring(0, 117) + "…" : d;
      page.drawText(`• ${truncated}`, { x: MARGIN_LEFT + 12, y: currentY, size: FONT_SMALL_SIZE, font: timesRoman });
      currentY -= LINE_HEIGHT_BODY - 2;
    }
    currentY -= 6;
  }

  const contentLines = input.content.split("\n");
  for (const line of contentLines) {
    if (currentY < CONTENT_BOTTOM_Y + 80) { page = addNewPage(); currentY = CONTENT_TOP_Y; }
    const trimmed = line.trim();
    if (!trimmed) { currentY -= LINE_HEIGHT_BODY * 0.4; continue; }
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 0 && !trimmed.startsWith("•")) {
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
  page.drawText("SIGNATURE BLOCK — SOVEREIGN OFFICE OF THE CHIEF JUSTICE & TRUSTEE", { x: MARGIN_LEFT, y: currentY, size: FONT_SMALL_SIZE, font: timesBold, color: rgb(0.3, 0.3, 0.3) });
  currentY -= LINE_HEIGHT_BODY + 6;

  const midX = PAGE_W / 2;
  page.drawText(input.emergencyOrder ? "Emergency Order — Chief Justice Signature:" : "Chief Justice & Trustee Signature:", { x: MARGIN_LEFT, y: currentY, size: FONT_BODY_SIZE, font: timesBold });
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

export async function buildNfrRecorderPdf(nfrId: number, content: string, classificationData?: Record<string, string>): Promise<PdfResult> {
  return buildRecorderPdf({
    title: `Notice of Fault and Remedies — NFR #${nfrId}`,
    parties: {
      "Issuing Authority": "Sovereign Office of the Chief Justice & Trustee",
      "Subject": classificationData?.actorType ?? "Respondent",
    },
    land: {
      description: classificationData?.rawText ?? "See attached legal description",
      classification: classificationData?.landStatus ?? "Indian Trust Land",
    },
    provisions: [content],
    recorderMetadata: {
      documentType: "NOTICE OF FAULT AND REMEDIES",
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
  page.drawText("Court Documents Division — Legacy Court Document Generator", {
    x: MARGIN_LEFT, y: currentY, size: FONT_SMALL_SIZE, font: timesRoman, color: rgb(0.3, 0.3, 0.3),
  });

  if (input.troSensitive || input.emergencyOrder) {
    const alertText = input.emergencyOrder ? "⚑ EMERGENCY ORDER — IMMEDIATE ACTION REQUIRED" : "⚑ TRO-SENSITIVE DOCUMENT";
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

  drawCentered(page, input.documentType.toUpperCase().replace(/_/g, " "), CONTENT_TOP_Y + 30, timesBold, FONT_SMALL_SIZE + 1, rgb(0.1, 0.1, 0.4));
  drawCentered(page, input.title.toUpperCase(), CONTENT_TOP_Y + 12, timesBold, FONT_TITLE_SIZE);
  drawCentered(page, `[ ${input.templateName} ]`, CONTENT_TOP_Y - 6, timesItalic, FONT_SMALL_SIZE, rgb(0.4, 0.4, 0.4));

  currentY = CONTENT_TOP_Y - 26;

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
    if (line === line.toUpperCase() && line.trim().length > 2 && !line.startsWith("•")) {
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
      const truncated = d.length > 110 ? d.substring(0, 107) + "…" : d;
      page.drawText(`• ${truncated}`, { x: MARGIN_LEFT + 12, y: currentY, size: FONT_SMALL_SIZE, font: timesRoman });
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
      page.drawText(`• ${ref.citation} — ${ref.title}`, { x: MARGIN_LEFT + 12, y: currentY, size: FONT_SMALL_SIZE, font: timesRoman });
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
      filingCategory: "Real Property — Indian Trust Land",
      trustStatus: "Federal Trust",
      requiresNotary: true,
      ...inputOverride?.recorderMetadata,
      ...(jurisdiction ? { county: jurisdiction } : {}),
    },
  });
}
