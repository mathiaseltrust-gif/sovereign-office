import { logger } from "./logger";
import crypto from "crypto";

export interface PdfGenerationRequest {
  documentType: string;
  title: string;
  content: string;
  entityId: string | number;
  jurisdiction?: string;
}

export interface PdfGenerationResult {
  success: boolean;
  pdfUrl: string;
  checksum: string;
  generatedAt: string;
  note: string;
}

export function buildPdf(req: PdfGenerationRequest): PdfGenerationResult {
  const checksum = crypto.createHash("sha256").update(req.content).digest("hex").substring(0, 16);
  const timestamp = Date.now();
  const pdfUrl = `/api/documents/${req.documentType}/${req.entityId}/pdf?t=${timestamp}&cs=${checksum}`;

  logger.info(
    { documentType: req.documentType, entityId: req.entityId, title: req.title },
    "PDF generation intent recorded",
  );

  return {
    success: true,
    pdfUrl,
    checksum,
    generatedAt: new Date().toISOString(),
    note: "PDF generation is stubbed. Integrate a PDF library (e.g., PDFKit, Puppeteer) to produce real binaries.",
  };
}

export function buildNfrPdf(nfrId: number, content: string): PdfGenerationResult {
  return buildPdf({
    documentType: "nfr",
    title: `NFR Document #${nfrId}`,
    content,
    entityId: nfrId,
  });
}

export function buildInstrumentPdf(instrumentId: number, content: string, jurisdiction: string): PdfGenerationResult {
  return buildPdf({
    documentType: "instrument",
    title: `Trust Instrument #${instrumentId}`,
    content,
    entityId: instrumentId,
    jurisdiction,
  });
}
