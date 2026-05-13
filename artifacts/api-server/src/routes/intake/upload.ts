import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../auth/entra-guard";
import { logger } from "../../lib/logger";
import { randomUUID } from "crypto";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "text/plain", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith(".pdf") || file.originalname.endsWith(".txt")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, TXT, and Word documents are accepted."));
    }
  },
});

router.post("/upload", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded. Send a PDF or text file as 'file' field." });
      return;
    }

    const { originalname, mimetype, buffer, size } = req.file;
    let text = "";
    let pageCount = 1;

    if (mimetype === "application/pdf" || originalname.endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse")).default;
      const parsed = await pdfParse(buffer);
      text = parsed.text;
      pageCount = parsed.numpages;
    } else {
      text = buffer.toString("utf-8");
    }

    const cleanText = text.replace(/\s+/g, " ").trim();

    if (cleanText.length < 20) {
      res.status(422).json({ error: "Could not extract readable text from the document." });
      return;
    }

    const sessionId = randomUUID();
    const docId = randomUUID();

    logger.info({ filename: originalname, chars: cleanText.length, pages: pageCount, sessionId }, "Document uploaded for intake");

    res.json({
      session_id: sessionId,
      doc_id: docId,
      filename: originalname,
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
