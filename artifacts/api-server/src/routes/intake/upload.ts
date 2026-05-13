import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../auth/entra-guard";
import { logger } from "../../lib/logger";
import { randomUUID } from "crypto";

const router = Router();

const ALLOWED_MIME = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
];

const ALLOWED_EXT = [".pdf", ".txt", ".csv", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".gif", ".webp"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = "." + (file.originalname.split(".").pop() ?? "").toLowerCase();
    if (ALLOWED_MIME.includes(file.mimetype) || ALLOWED_EXT.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Accepted file types: PDF, CSV, PNG, JPG, GIF, WEBP, TXT, DOC, DOCX."));
    }
  },
});

function isImage(mimetype: string, filename: string): boolean {
  const imageTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
  const imageExts = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
  const ext = "." + (filename.split(".").pop() ?? "").toLowerCase();
  return imageTypes.includes(mimetype) || imageExts.includes(ext);
}

function isCsv(mimetype: string, filename: string): boolean {
  const csvMimes = ["text/csv", "application/csv", "application/vnd.ms-excel"];
  const ext = "." + (filename.split(".").pop() ?? "").toLowerCase();
  return csvMimes.includes(mimetype) || ext === ".csv";
}

router.post("/upload", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded. Send a PDF, CSV, image, or text file as 'file' field." });
      return;
    }

    const { originalname, mimetype, buffer, size } = req.file;
    let text = "";
    let pageCount = 1;
    let fileType = "document";

    if (mimetype === "application/pdf" || originalname.toLowerCase().endsWith(".pdf")) {
      fileType = "pdf";
      const pdfParse = (await import("pdf-parse")).default;
      const parsed = await pdfParse(buffer);
      text = parsed.text;
      pageCount = parsed.numpages;
    } else if (isImage(mimetype, originalname)) {
      fileType = "image";
      // For images, build a descriptive prompt for the AI engine
      // Azure OpenAI vision would be the ideal path; for now we extract metadata
      // and prompt the AI to analyze what we know about the document
      const sizeKb = Math.round(size / 1024);
      text = `[IMAGE DOCUMENT UPLOADED]
Filename: ${originalname}
File size: ${sizeKb} KB
File type: ${mimetype}

This is a scanned or photographed document. Please perform intake analysis based on the document name and any available context.
If this is a notice of foreclosure, shutoff notice, demand letter, or similar legal document, identify the document type from the filename and apply the appropriate sovereign review framework.
If this is a photo containing a person's name, date of birth, and family connection information, flag it for family lineage processing.

Document filename analysis: "${originalname}"`;
      pageCount = 1;
    } else if (isCsv(mimetype, originalname)) {
      fileType = "csv";
      text = buffer.toString("utf-8");
      pageCount = 1;
    } else {
      fileType = "text";
      text = buffer.toString("utf-8");
      pageCount = 1;
    }

    const cleanText = text.replace(/\s+/g, " ").trim();

    if (cleanText.length < 10) {
      res.status(422).json({ error: "Could not extract readable content from the file." });
      return;
    }

    const sessionId = randomUUID();
    const docId = randomUUID();

    logger.info({ filename: originalname, chars: cleanText.length, pages: pageCount, fileType, sessionId }, "Document uploaded for intake");

    res.json({
      session_id: sessionId,
      doc_id: docId,
      filename: originalname,
      file_type: fileType,
      page_count: pageCount,
      char_count: cleanText.length,
      size_bytes: size,
      text: cleanText.substring(0, 50000),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
