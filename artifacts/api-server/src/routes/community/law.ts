import { Router, type Request, type Response } from "express";
import multer from "multer";
import { requireAuth } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { tribalLawTable, federalIndianLawTable, doctrineSourcesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ensureLawDbSeeded } from "../../sovereign/law-db";
import { callAzureOpenAI } from "../../lib/azure-openai";
import { logger } from "../../lib/logger";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain", "text/html"];
    cb(null, allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|doc|docx|txt)$/i) !== null);
  },
});

async function extractTextFromBuffer(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
  if (mimetype === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
    const { default: pdfParse } = await import("pdf-parse") as unknown as { default: (buf: Buffer) => Promise<{ text: string }> };
    const parsed = await pdfParse(buffer);
    return parsed.text;
  }
  if (
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    filename.toLowerCase().endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  // plain text / html / doc fallback
  return buffer.toString("utf-8");
}

interface ExtractedLawFields {
  type: "tribal" | "federal" | "doctrine";
  title: string;
  citation: string;
  body: string;
  tags: string[];
  caseName?: string;
  confidence: "high" | "medium" | "low";
  extractedFrom: "ai" | "pattern";
}

function patternExtract(text: string): ExtractedLawFields {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const citationMatch = text.match(/(\d+\s+U\.S\.C\.[\s§]+[\d\w\-–.]+|25\s+U\.S\.C\.[\s§]+[\d\w\-–.]+|18\s+U\.S\.C\.[\s§]+[\d\w\-–.]+|\d+\s+U\.S\.\s+\d+[^)]*\(\d{4}\)|Tribal Code[^,\n]{0,60}|MET[^,\n]{0,60}|CFR[^,\n]{0,60}|\d{1,3}\s+C\.F\.R\.[^,\n]{0,60})/i);
  const citation = citationMatch ? citationMatch[0].trim() : "";

  const isFederal = /U\.S\.C\.|U\.S\. \d+|C\.F\.R\.|federal|congress|act of \d{4}/i.test(text);
  const isDoctrine = /v\.\s+[A-Z]|\d+\s+U\.S\.\s+\d+|Supreme Court|court held|doctrine/i.test(text) && !isFederal;
  const type: ExtractedLawFields["type"] = isDoctrine ? "doctrine" : isFederal ? "federal" : "tribal";

  const title = lines[0]?.slice(0, 200) ?? "Untitled";
  const body = lines.slice(1).join("\n").slice(0, 3000);
  const tags: string[] = [];
  if (/icwa/i.test(text)) tags.push("icwa");
  if (/sovereignty/i.test(text)) tags.push("sovereignty");
  if (/trust/i.test(text)) tags.push("trust");
  if (/health/i.test(text)) tags.push("health");
  if (/welfare/i.test(text)) tags.push("welfare");
  if (/child|juvenile/i.test(text)) tags.push("child-welfare");

  return { type, title, citation, body, tags, confidence: "low", extractedFrom: "pattern" };
}

router.post("/extract", requireAuth, upload.single("file"), async (req: Request, res: Response, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded. Attach a PDF, DOCX, or TXT file." });
      return;
    }

    const rawText = await extractTextFromBuffer(req.file.buffer, req.file.mimetype, req.file.originalname);
    const truncated = rawText.slice(0, 12000);

    logger.info({ userId: req.user?.dbId, filename: req.file.originalname, chars: truncated.length }, "Law extract: document received");

    let extracted: ExtractedLawFields;

    try {
      const systemPrompt = `You are a tribal law librarian for the Mathias El Tribe Sovereign Office.
Extract structured metadata from the provided legal document text and return ONLY valid JSON — no markdown, no explanation.

The JSON must have exactly these fields:
{
  "type": "tribal" | "federal" | "doctrine",
  "title": "<short descriptive title, max 200 chars>",
  "citation": "<legal citation, e.g. 25 U.S.C. § 1901 or 31 U.S. 515 (1832) or Tribal Code § 400>",
  "body": "<full text or concise accurate summary, max 3000 chars>",
  "tags": ["<keyword1>", "<keyword2>"],
  "caseName": "<party v. party — only for doctrine type, omit otherwise>"
}

Type rules:
- "tribal": Mathias El Tribe codes, tribal ordinances, tribal resolutions, tribal court orders
- "federal": U.S. federal statutes (U.S.C.), federal regulations (C.F.R.), federal acts  
- "doctrine": Case law, court decisions, legal doctrines, Supreme Court rulings (format: Party v. Party)

Tags should be 1–3 word lowercase keywords relevant to this resource (e.g. "icwa", "trust-land", "sovereignty", "health", "welfare", "child-welfare", "jurisdiction").`;

      const aiResult = await callAzureOpenAI(systemPrompt, truncated, { maxTokens: 1200, temperature: 0.1, timeoutMs: 30000 });
      const jsonStr = aiResult.content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(jsonStr) as Partial<ExtractedLawFields>;

      extracted = {
        type: (["tribal", "federal", "doctrine"].includes(parsed.type ?? "") ? parsed.type : "federal") as ExtractedLawFields["type"],
        title: (parsed.title ?? "").slice(0, 200) || "Untitled",
        citation: parsed.citation ?? "",
        body: (parsed.body ?? "").slice(0, 3000),
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 10) : [],
        caseName: parsed.caseName,
        confidence: "high",
        extractedFrom: "ai",
      };
    } catch (aiErr) {
      logger.warn({ err: aiErr }, "Law extract: AI unavailable, falling back to pattern extraction");
      extracted = patternExtract(rawText);
    }

    res.json(extracted);
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    await ensureLawDbSeeded();

    const q = req.query.q as string | undefined;
    const type = req.query.type as string | undefined;

    const results: {
      id: number;
      type: "tribal" | "federal" | "doctrine";
      title: string;
      citation: string;
      body: string;
      tags: string[];
      caseName: string | null;
      summary: string | null;
      updatedAt: string | null;
    }[] = [];

    if (!type || type === "federal") {
      let rows = await db.select().from(federalIndianLawTable);
      if (q) {
        const lower = q.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.title.toLowerCase().includes(lower) ||
            r.citation.toLowerCase().includes(lower) ||
            r.body.toLowerCase().includes(lower) ||
            (r.tags as string[])?.some((t) => t.toLowerCase().includes(lower)),
        );
      }
      results.push(
        ...rows.map((r) => ({
          id: r.id,
          type: "federal" as const,
          title: r.title,
          citation: r.citation,
          body: r.body,
          tags: (r.tags as string[]) ?? [],
          caseName: null,
          summary: null,
          updatedAt: r.updatedAt.toISOString(),
        })),
      );
    }

    if (!type || type === "tribal") {
      let rows = await db.select().from(tribalLawTable);
      if (q) {
        const lower = q.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.title.toLowerCase().includes(lower) ||
            r.citation.toLowerCase().includes(lower) ||
            r.body.toLowerCase().includes(lower) ||
            (r.tags as string[])?.some((t) => t.toLowerCase().includes(lower)),
        );
      }
      results.push(
        ...rows.map((r) => ({
          id: r.id,
          type: "tribal" as const,
          title: r.title,
          citation: r.citation,
          body: r.body,
          tags: (r.tags as string[]) ?? [],
          caseName: null,
          summary: null,
          updatedAt: r.updatedAt.toISOString(),
        })),
      );
    }

    if (!type || type === "doctrine") {
      let rows = await db.select().from(doctrineSourcesTable);
      if (q) {
        const lower = q.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.caseName.toLowerCase().includes(lower) ||
            r.citation.toLowerCase().includes(lower) ||
            r.summary.toLowerCase().includes(lower) ||
            (r.tags as string[])?.some((t) => t.toLowerCase().includes(lower)),
        );
      }
      results.push(
        ...rows.map((r) => ({
          id: r.id,
          type: "doctrine" as const,
          title: r.caseName,
          citation: r.citation,
          body: r.summary,
          tags: (r.tags as string[]) ?? [],
          caseName: r.caseName,
          summary: r.summary,
          updatedAt: null,
        })),
      );
    }

    res.json(results);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { type, title, citation, body, tags } = req.body as {
      type?: string;
      title?: string;
      citation?: string;
      body?: string;
      tags?: string[];
    };

    if (!type || !title || !citation || !body) {
      res.status(400).json({ error: "type, title, citation, and body are required" });
      return;
    }

    const parsedTags = Array.isArray(tags) ? tags : [];

    if (type === "tribal") {
      const [row] = await db.insert(tribalLawTable).values({ title, citation, body, tags: parsedTags }).returning();
      res.status(201).json({ id: row.id, type: "tribal", title: row.title, citation: row.citation });
      return;
    }

    if (type === "federal") {
      const [row] = await db.insert(federalIndianLawTable).values({ title, citation, body, tags: parsedTags }).returning();
      res.status(201).json({ id: row.id, type: "federal", title: row.title, citation: row.citation });
      return;
    }

    res.status(400).json({ error: "type must be 'tribal' or 'federal'" });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [federal] = await db.select().from(federalIndianLawTable).where(eq(federalIndianLawTable.id, id)).limit(1);
    if (federal) {
      res.json({ id: federal.id, type: "federal", title: federal.title, citation: federal.citation, body: federal.body, tags: (federal.tags as string[]) ?? [], caseName: null, summary: null, updatedAt: federal.updatedAt.toISOString() });
      return;
    }

    const [tribal] = await db.select().from(tribalLawTable).where(eq(tribalLawTable.id, id)).limit(1);
    if (tribal) {
      res.json({ id: tribal.id, type: "tribal", title: tribal.title, citation: tribal.citation, body: tribal.body, tags: (tribal.tags as string[]) ?? [], caseName: null, summary: null, updatedAt: tribal.updatedAt.toISOString() });
      return;
    }

    const [doctrine] = await db.select().from(doctrineSourcesTable).where(eq(doctrineSourcesTable.id, id)).limit(1);
    if (doctrine) {
      res.json({ id: doctrine.id, type: "doctrine", title: doctrine.caseName, citation: doctrine.citation, body: doctrine.summary, tags: (doctrine.tags as string[]) ?? [], caseName: doctrine.caseName, summary: doctrine.summary, updatedAt: null });
      return;
    }

    res.status(404).json({ error: "Law resource not found" });
  } catch (err) {
    next(err);
  }
});

export default router;
