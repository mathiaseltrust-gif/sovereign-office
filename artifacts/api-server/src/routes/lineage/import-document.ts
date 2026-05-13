import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { familyLineageTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";
import { buildLineageGraph } from "../../sovereign/family-tree-engine";
import type { ParsedPerson } from "../../sovereign/family-tree-engine";
import { callAzureOpenAI } from "../../lib/azure-openai";
import { logger } from "../../lib/logger";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const name = (file.originalname ?? "").toLowerCase();
    const ext = "." + (name.split(".").pop() ?? "");
    const allowedExts = [".pdf", ".csv", ".txt", ".ged", ".gedcom", ".png", ".jpg", ".jpeg", ".webp", ".gif"];
    const allowedMimes = [
      "application/pdf", "text/plain", "text/csv", "application/csv",
      "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif",
      "application/octet-stream",
    ];
    if (allowedExts.includes(ext) || allowedMimes.some((m) => file.mimetype.startsWith(m.split("/")[0]) && allowedMimes.includes(file.mimetype))) {
      cb(null, true);
    } else {
      cb(new Error("Accepted: PDF, CSV, GEDCOM (.ged), TXT, PNG, JPG, WEBP, GIF"));
    }
  },
});

const SYSTEM_PROMPT = `You are a genealogical data extractor for the Mathias El Tribe Sovereign Office family registry.

Parse the provided family tree document (PDF text, Ancestry export, GEDCOM text, handwritten notes, or any genealogical format) and extract ALL people mentioned.

For each person return a JSON object with:
- fullName: full name as written
- firstName: first name only
- lastName: last/family name
- birthYear: 4-digit integer birth year (null if unknown); parse "About 1876", "Abt 1876", "Abt. 1876", "abt 1876", "B: 6 Feb 1985" → extract year only
- deathYear: 4-digit integer death year (null if unknown or still living)
- gender: "male" or "female" or null (infer from name/context)
- parentNames: array of full names of this person's parents (from visual hierarchy, FAMC/FAMS links, or listed relationships)
- spouseNames: array of full names of spouses (from M: marriage entries)
- birthPlace: city/county/state/country of birth if listed
- deathPlace: city/county/state/country of death if listed
- notes: any other relevant info (marriage date, military, tribe, etc.)
- isDeceased: true if death year present or "D:" has a date

Rules:
- Include EVERY person visible, including those in sideline columns
- If the document shows a tree hierarchy, identify parent-child relationships from the visual structure
- For Ancestry horizontal tree views: left-most person is the root, lines going right show parents/grandparents
- For GEDCOM format: use INDI, FAMS, FAMC records to derive relationships
- Return ONLY a valid JSON array — no explanation text, no markdown fences
- If you cannot confidently parse anyone, return []`;

function isImage(filename: string, mimetype: string): boolean {
  const imgExts = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
  const ext = "." + (filename.toLowerCase().split(".").pop() ?? "");
  return imgExts.includes(ext) || mimetype.startsWith("image/");
}

function isPdf(filename: string, mimetype: string): boolean {
  return mimetype === "application/pdf" || filename.toLowerCase().endsWith(".pdf");
}

function isGedcom(filename: string, text: string): boolean {
  const fn = filename.toLowerCase();
  return fn.endsWith(".ged") || fn.endsWith(".gedcom") || text.includes("0 HEAD") || text.includes("1 GEDC");
}

async function extractPeopleWithAI(text: string, filename: string): Promise<ParsedPerson[]> {
  const truncated = text.length > 40000 ? text.substring(0, 40000) + "\n[...document truncated...]" : text;
  const userPrompt = `Family tree document (filename: ${filename}):\n\n${truncated}`;

  const result = await callAzureOpenAI(SYSTEM_PROMPT, userPrompt, {
    maxTokens: 4000,
    temperature: 0.1,
    timeoutMs: 45000,
  });

  let jsonStr = result.content.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();
  const arrStart = jsonStr.indexOf("[");
  const arrEnd = jsonStr.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd !== -1) jsonStr = jsonStr.slice(arrStart, arrEnd + 1);

  const raw = JSON.parse(jsonStr) as Record<string, unknown>[];

  return raw
    .filter((r) => typeof r.fullName === "string" && r.fullName.trim().length > 1)
    .map((r, i) => ({
      fullName: String(r.fullName).trim(),
      firstName: r.firstName ? String(r.firstName).trim() : undefined,
      lastName: r.lastName ? String(r.lastName).trim() : undefined,
      birthYear: typeof r.birthYear === "number" ? r.birthYear : undefined,
      deathYear: typeof r.deathYear === "number" ? r.deathYear : undefined,
      gender: r.gender ? String(r.gender) : undefined,
      parentNames: Array.isArray(r.parentNames) ? (r.parentNames as string[]).map(String).filter(Boolean) : [],
      spouseNames: Array.isArray(r.spouseNames) ? (r.spouseNames as string[]).map(String).filter(Boolean) : [],
      notes: [
        r.birthPlace ? `Birth: ${r.birthPlace}` : null,
        r.deathPlace ? `Death: ${r.deathPlace}` : null,
        r.notes ? String(r.notes) : null,
      ].filter(Boolean).join(". ") || undefined,
      isDeceased: Boolean(r.isDeceased) || (typeof r.deathYear === "number"),
      generationalPosition: i,
    }));
}

async function importPeople(people: ParsedPerson[], sourceType: string): Promise<{
  created: number; merged: number; skipped: number; errors: string[];
  lineageIds: number[]; nameToId: Map<string, number>;
}> {
  const graph = buildLineageGraph(people);
  let created = 0, merged = 0, skipped = 0;
  const errors: string[] = [];
  const lineageIds: number[] = [];
  const nameToId = new Map<string, number>();

  for (let i = 0; i < people.length; i++) {
    const person = people[i];
    try {
      const existing = await db
        .select({ id: familyLineageTable.id, nameVariants: familyLineageTable.nameVariants })
        .from(familyLineageTable)
        .where(
          person.birthYear
            ? and(eq(familyLineageTable.fullName, person.fullName), eq(familyLineageTable.birthYear, person.birthYear))
            : eq(familyLineageTable.fullName, person.fullName)
        )
        .limit(1);

      if (existing.length > 0) {
        const existingId = existing[0].id;
        const existingVariants = Array.isArray(existing[0].nameVariants) ? (existing[0].nameVariants as string[]) : [];
        const incomingVariants = [person.fullName, ...(person.nameVariants ?? [])].map((v) => v.trim()).filter(Boolean);
        const newVariants = [...new Set([...existingVariants, ...incomingVariants])];
        await db.update(familyLineageTable).set({ nameVariants: newVariants, updatedAt: new Date() }).where(eq(familyLineageTable.id, existingId));
        nameToId.set(person.fullName.toLowerCase(), existingId);
        lineageIds.push(existingId);
        merged++;
        continue;
      }

      const [row] = await db
        .insert(familyLineageTable)
        .values({
          fullName: person.fullName,
          firstName: person.firstName ?? undefined,
          lastName: person.lastName ?? undefined,
          birthYear: person.birthYear ?? undefined,
          deathYear: person.deathYear ?? undefined,
          gender: person.gender ?? undefined,
          notes: person.notes ?? undefined,
          isDeceased: person.isDeceased ?? (person.deathYear !== undefined),
          isAncestor: (person.generationalPosition ?? i) <= Math.floor(people.length / 2),
          generationalPosition: person.generationalPosition ?? i,
          sourceType,
          lineageTags: graph.lineageTags,
          icwaEligible: graph.icwaEligible,
          welfareEligible: graph.welfareEligible,
          trustBeneficiary: graph.trustInheritance,
          parentIds: [],
          childrenIds: [],
          spouseIds: [],
          protectionLevel: "ancestor",
          membershipStatus: "pending",
          nameVariants: person.nameVariants ?? [],
        })
        .returning();

      nameToId.set(person.fullName.toLowerCase(), row.id);
      lineageIds.push(row.id);
      created++;
    } catch (err) {
      errors.push(`${person.fullName}: ${err instanceof Error ? err.message : String(err)}`);
      skipped++;
    }
  }

  for (const person of people) {
    const personId = nameToId.get(person.fullName.toLowerCase());
    if (!personId) continue;

    const parentIds = (person.parentNames ?? [])
      .map((n) => nameToId.get(n.toLowerCase()))
      .filter((id): id is number => id !== undefined);
    const spouseIds = (person.spouseNames ?? [])
      .map((n) => nameToId.get(n.toLowerCase()))
      .filter((id): id is number => id !== undefined);

    for (const parentId of parentIds) {
      const [parent] = await db.select({ childrenIds: familyLineageTable.childrenIds }).from(familyLineageTable).where(eq(familyLineageTable.id, parentId)).limit(1);
      if (parent) {
        const existing = Array.isArray(parent.childrenIds) ? (parent.childrenIds as number[]) : [];
        if (!existing.includes(personId)) {
          await db.update(familyLineageTable).set({ childrenIds: [...existing, personId] }).where(eq(familyLineageTable.id, parentId));
        }
      }
    }

    if (parentIds.length > 0 || spouseIds.length > 0) {
      await db.update(familyLineageTable).set({ parentIds, spouseIds }).where(eq(familyLineageTable.id, personId));
    }
  }

  return { created, merged, skipped, errors, lineageIds, nameToId };
}

router.post("/", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded. Send a PDF, image, CSV, GEDCOM, or TXT file as the 'file' field." });
      return;
    }

    const { originalname, mimetype, buffer } = req.file;
    let people: ParsedPerson[] = [];
    let sourceType = "document";
    let extractionMethod = "ai";

    if (isPdf(originalname, mimetype)) {
      sourceType = "pdf";
      const pdfParse = (await import("pdf-parse")).default;
      const parsed = await pdfParse(buffer);
      const text = parsed.text;
      if (!text || text.trim().length < 20) {
        res.status(422).json({ error: "Could not extract text from PDF. The file may be image-only — please upload a JPG/PNG scan instead." });
        return;
      }
      logger.info({ filename: originalname, chars: text.length, pages: parsed.numpages }, "PDF text extracted for lineage import");
      people = await extractPeopleWithAI(text, originalname);

    } else if (isImage(originalname, mimetype)) {
      sourceType = "image";
      const base64 = buffer.toString("base64");
      const mimeForVision = mimetype.startsWith("image/") ? mimetype : "image/jpeg";

      const client = (await import("../../lib/azure-openai")).getAzureOpenAIClient();
      if (!client) {
        res.status(503).json({ error: "AI extraction not available. Please upload a CSV or GEDCOM file instead." });
        return;
      }

      const deployment = (await import("../../lib/azure-openai")).getDeployment();
      const visionResponse = await client.chat.completions.create({
        model: deployment,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: `Extract all people from this family tree image (filename: ${originalname}):` },
              { type: "image_url", image_url: { url: `data:${mimeForVision};base64,${base64}`, detail: "high" } },
            ],
          },
        ],
        max_tokens: 4000,
        temperature: 0.1,
      });

      const content = visionResponse.choices[0]?.message?.content ?? "[]";
      let jsonStr = content.trim();
      const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) jsonStr = fence[1].trim();
      const arrStart = jsonStr.indexOf("[");
      const arrEnd = jsonStr.lastIndexOf("]");
      if (arrStart !== -1 && arrEnd !== -1) jsonStr = jsonStr.slice(arrStart, arrEnd + 1);

      const raw = JSON.parse(jsonStr) as Record<string, unknown>[];
      people = raw
        .filter((r) => typeof r.fullName === "string" && r.fullName.trim().length > 1)
        .map((r, i) => ({
          fullName: String(r.fullName).trim(),
          firstName: r.firstName ? String(r.firstName).trim() : undefined,
          lastName: r.lastName ? String(r.lastName).trim() : undefined,
          birthYear: typeof r.birthYear === "number" ? r.birthYear : undefined,
          deathYear: typeof r.deathYear === "number" ? r.deathYear : undefined,
          gender: r.gender ? String(r.gender) : undefined,
          parentNames: Array.isArray(r.parentNames) ? (r.parentNames as string[]).map(String) : [],
          spouseNames: Array.isArray(r.spouseNames) ? (r.spouseNames as string[]).map(String) : [],
          notes: r.notes ? String(r.notes) : undefined,
          isDeceased: Boolean(r.isDeceased),
          generationalPosition: i,
        }));

    } else {
      const text = buffer.toString("utf-8");
      if (isGedcom(originalname, text)) {
        sourceType = "gedcom";
        extractionMethod = "parser";
        const { parseGedcom } = await import("../../sovereign/family-tree-engine");
        people = parseGedcom(text);
      } else {
        sourceType = "csv";
        extractionMethod = "ai";
        if (text.trim().toLowerCase().startsWith("name") || text.includes(",")) {
          const { parseLineageCsv } = await import("../../sovereign/family-tree-engine");
          try {
            people = parseLineageCsv(text);
            extractionMethod = "parser";
          } catch {
            people = await extractPeopleWithAI(text, originalname);
          }
        } else {
          people = await extractPeopleWithAI(text, originalname);
        }
      }
    }

    if (people.length === 0) {
      res.status(422).json({
        error: "No family members could be extracted from this document.",
        hint: "For best results: PDF exports from Ancestry/FamilySearch, GEDCOM files (.ged), or a CSV with name, birth_year, parent_names columns.",
      });
      return;
    }

    const { created, merged, skipped, errors, lineageIds } = await importPeople(people, sourceType);
    const graph = buildLineageGraph(people);

    logger.info({ filename: originalname, sourceType, extractionMethod, total: people.length, created, merged, skipped }, "Document lineage import complete");

    res.json({
      sourceType,
      extractionMethod,
      filename: originalname,
      total: people.length,
      created,
      merged,
      skipped,
      errors: errors.slice(0, 20),
      lineageIds,
      people: people.slice(0, 100).map((p) => ({
        fullName: p.fullName,
        birthYear: p.birthYear,
        deathYear: p.deathYear,
        gender: p.gender,
        parentNames: p.parentNames,
        spouseNames: p.spouseNames,
        notes: p.notes,
      })),
      graph: {
        totalGenerations: graph.totalGenerations,
        tribalNations: graph.tribalNations,
        familyGroups: graph.familyGroups,
        lineageTags: graph.lineageTags,
        icwaEligible: graph.icwaEligible,
        welfareEligible: graph.welfareEligible,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
