import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { traceMattersTable } from "@workspace/db";
import { requireTraceAccess } from "../../auth/entra-guard";
import { logger } from "../../lib/logger";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(txt|md|csv|pdf)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Upload PDF, TXT, or MD files."));
    }
  },
});

async function extractText(file: Express.Multer.File): Promise<string> {
  const isPdf = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    const { default: pdfParse } = await import("pdf-parse");
    const result = await pdfParse(file.buffer);
    return result.text?.trim() ?? "";
  }
  return file.buffer.toString("utf-8").trim();
}

router.post(
  "/upload",
  requireTraceAccess,
  upload.single("file"),
  async (req, res, next) => {
    try {
      const createdBy = req.user?.dbId;
      if (!createdBy) {
        res.status(401).json({ error: "User must be registered to upload matters" });
        return;
      }

      let title: string | undefined;
      let extractedText: string | undefined;
      let sourceRef: string | undefined;
      let matterType: string | undefined;
      let niacPathway: boolean | undefined;
      let niacReviewType: string | undefined;
      let deadlineAt: string | undefined;

      if (req.file) {
        const body = req.body as Record<string, string>;
        title = body.title;
        sourceRef = req.file.originalname;
        matterType = body.matterType;
        niacPathway = body.niacPathway === "true";
        niacReviewType = body.niacReviewType;
        deadlineAt = body.deadlineAt;

        try {
          extractedText = await extractText(req.file);
        } catch (err) {
          logger.warn({ file: req.file.originalname, err }, "TRACE upload text extraction failed");
          res.status(422).json({ error: "Failed to extract text from uploaded file. Try pasting the text manually." });
          return;
        }

        if (!extractedText) {
          res.status(422).json({ error: "Could not extract readable text from this file." });
          return;
        }
      } else {
        const body = req.body as {
          title?: string;
          extractedText?: string;
          sourceRef?: string;
          matterType?: string;
          niacPathway?: boolean;
          niacReviewType?: string;
          deadlineAt?: string;
        };
        title = body.title;
        extractedText = body.extractedText;
        sourceRef = body.sourceRef;
        matterType = body.matterType;
        niacPathway = body.niacPathway ?? false;
        niacReviewType = body.niacReviewType;
        deadlineAt = body.deadlineAt;
      }

      if (!title?.trim()) {
        res.status(400).json({ error: "title is required" });
        return;
      }
      if (!extractedText?.trim()) {
        res.status(400).json({ error: "File content or extractedText is required" });
        return;
      }

      const [matter] = await db
        .insert(traceMattersTable)
        .values({
          title: title.trim(),
          description: extractedText.trim(),
          createdBy,
          sourceType: "upload",
          sourceRef: sourceRef ?? null,
          matterType: matterType ?? "general",
          niacReviewType: niacReviewType ?? null,
          status: "pending",
          riskLevel: "low",
          niacPathway: niacPathway ?? false,
          deadlineAt: deadlineAt ? new Date(deadlineAt) : null,
        })
        .returning();

      logger.info({ matterId: matter.id, userId: createdBy, hasFile: !!req.file, sourceRef }, "TRACE matter created via upload");
      res.status(201).json(matter);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
