import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../auth/entra-guard";
import { callAzureOpenAI, getAzureOpenAIClient, getDeployment } from "../../lib/azure-openai";
import { logger } from "../../lib/logger";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const name = (file.originalname ?? "").toLowerCase();
    const ext = "." + (name.split(".").pop() ?? "");
    const allowed = [".pdf", ".txt", ".png", ".jpg", ".jpeg", ".webp", ".doc", ".docx"];
    if (
      allowed.includes(ext) ||
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf" ||
      file.mimetype === "text/plain"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Accepted: PDF, TXT, PNG, JPG, WEBP, DOC"));
    }
  },
});

const EXTRACT_SYSTEM = `You are an archivist for the Mathias El Tribe Ancestral Memory Bank.

Given spoken notes (a voice transcription) and/or an uploaded document (letter, photograph, scanned record, journal page, legal document), extract a single structured memory to be preserved in the tribal archive.

Write the body field in the voice of the person speaking — warm, personal, specific. Preserve their words where possible. Capture the people, place, time, and emotional truth. If the material is from a document rather than a personal account, write the body as a summary that reads like a first-person recollection.

Return ONLY valid JSON with no markdown fences and no extra commentary:
{
  "title": "brief evocative title for the memory (10 words or fewer)",
  "body": "full narrative in the speaker's voice — preserve personal details, names, places; at least 2-3 paragraphs",
  "memoryDate": "specific date or period like 'Summer 1987' or 'Early 1960s', or null if unknown",
  "memoryEra": "one of exactly: Childhood | Young Adult | Adult | Elder Years | Pre-1900s | 1900–1950 | 1950–1980 | 1980–2000 | 2000s–Present | Historical",
  "location": "city/state/country or null",
  "emotionalTone": "one of exactly: joy | pride | gratitude | grief | warning | neutral",
  "topics": ["array drawn only from: Family, Business, Sovereignty, Culture, Health, Education, Land, Spirituality, Justice, Resistance, Love, Loss"],
  "taggedPeople": [{"name": "full name as mentioned", "relation": "relationship to speaker e.g. grandmother, cousin, friend"}],
  "isHistoricalEvent": false
}`;

function isImage(filename: string, mimetype: string): boolean {
  const imgExts = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
  const ext = "." + (filename.toLowerCase().split(".").pop() ?? "");
  return imgExts.includes(ext) || mimetype.startsWith("image/");
}

function isPdf(filename: string, mimetype: string): boolean {
  return mimetype === "application/pdf" || filename.toLowerCase().endsWith(".pdf");
}

router.post("/", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    const spokenNotes = String(req.body.spokenNotes ?? "").trim();
    const contextNote = String(req.body.contextNote ?? "").trim();

    if (!spokenNotes && !req.file) {
      res.status(400).json({ error: "Provide spoken notes, an uploaded document, or both." });
      return;
    }

    let documentText = "";
    let isImageFile = false;
    let imageBase64 = "";
    let imageMime = "image/jpeg";

    if (req.file) {
      const { originalname, mimetype, buffer } = req.file;

      if (isPdf(originalname, mimetype)) {
        const { default: pdfParse } = await import("pdf-parse") as unknown as { default: (buf: Buffer) => Promise<{ text: string; numpages: number }> };
        const parsed = await pdfParse(buffer);
        documentText = parsed.text ?? "";
        logger.info({ filename: originalname, chars: documentText.length, pages: parsed.numpages }, "PDF extracted for memory intake");
      } else if (isImage(originalname, mimetype)) {
        isImageFile = true;
        imageBase64 = buffer.toString("base64");
        imageMime = mimetype.startsWith("image/") ? mimetype : "image/jpeg";
        logger.info({ filename: originalname, mimetype }, "Image received for memory intake");
      } else {
        documentText = buffer.toString("utf-8");
        logger.info({ filename: originalname, chars: documentText.length }, "Text file received for memory intake");
      }
    }

    let rawJson = "";

    if (isImageFile) {
      const client = getAzureOpenAIClient();
      if (!client) {
        res.status(503).json({ error: "AI extraction is not available right now." });
        return;
      }
      const deployment = getDeployment();

      const textPart = [
        contextNote ? `Context from the speaker: ${contextNote}` : null,
        spokenNotes ? `Voice transcription:\n${spokenNotes}` : null,
        "Also extract memory details visible in the attached document image:",
      ]
        .filter(Boolean)
        .join("\n\n");

      const response = await client.chat.completions.create({
        model: deployment,
        messages: [
          { role: "system", content: EXTRACT_SYSTEM },
          {
            role: "user",
            content: [
              { type: "text" as const, text: textPart },
              {
                type: "image_url" as const,
                image_url: { url: `data:${imageMime};base64,${imageBase64}`, detail: "high" as const },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      });

      rawJson = response.choices[0]?.message?.content ?? "{}";
    } else {
      const userPrompt = [
        contextNote ? `Context: ${contextNote}` : null,
        spokenNotes ? `Voice transcription:\n${spokenNotes}` : null,
        documentText ? `Document content:\n${documentText.substring(0, 24000)}` : null,
      ]
        .filter(Boolean)
        .join("\n\n---\n\n");

      const result = await callAzureOpenAI(EXTRACT_SYSTEM, userPrompt, {
        maxTokens: 2000,
        temperature: 0.3,
      });
      rawJson = result.content;
    }

    let cleaned = rawJson.trim();
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) cleaned = fence[1].trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1) cleaned = cleaned.slice(start, end + 1);

    const extracted = JSON.parse(cleaned) as Record<string, unknown>;

    logger.info(
      { hasSpoken: !!spokenNotes, hasFile: !!req.file, isImage: isImageFile },
      "Ancestral memory extraction complete",
    );

    res.json({
      title: String(extracted.title ?? ""),
      body: String(extracted.body ?? ""),
      memoryDate: extracted.memoryDate ? String(extracted.memoryDate) : "",
      memoryEra: String(extracted.memoryEra ?? ""),
      location: extracted.location ? String(extracted.location) : "",
      emotionalTone: String(extracted.emotionalTone ?? "neutral"),
      topics: Array.isArray(extracted.topics)
        ? (extracted.topics as unknown[]).filter((t): t is string => typeof t === "string")
        : [],
      taggedPeople: Array.isArray(extracted.taggedPeople) ? extracted.taggedPeople : [],
      isHistoricalEvent: Boolean(extracted.isHistoricalEvent),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
