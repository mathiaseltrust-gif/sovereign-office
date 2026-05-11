import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { familyLineageTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { parseLineageCsv, parseGedcom, buildLineageGraph } from "../../sovereign/family-tree-engine";
import { logger } from "../../lib/logger";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const name = (file.originalname ?? "").toLowerCase();
    if (name.endsWith(".ged") || name.endsWith(".gedcom") || name.endsWith(".csv") || name.endsWith(".txt") || file.mimetype.startsWith("text/")) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported. Upload a .ged (GEDCOM) or .csv file.`));
    }
  },
});

router.post("/", requireAuth, requireRole("trustee"), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded. Include a 'file' field." });
      return;
    }

    const text = req.file.buffer.toString("utf-8");
    const filename = req.file.originalname?.toLowerCase() ?? "";
    const isGedcom = filename.endsWith(".ged") || filename.endsWith(".gedcom") || text.includes("0 HEAD") || text.includes("1 GEDC");
    const format = isGedcom ? "gedcom" : "csv";

    const people = isGedcom ? parseGedcom(text) : parseLineageCsv(text);

    if (people.length === 0) {
      res.status(400).json({
        error: `No valid records found in ${format.toUpperCase()} file.`,
        format,
        hint: isGedcom
          ? "Ensure the file is a valid GEDCOM export containing INDI records."
          : "Ensure the CSV has headers: name (or full_name), birth_year, parent_names (semicolon-separated).",
      });
      return;
    }

    const graph = buildLineageGraph(people);

    let created = 0;
    let merged = 0;
    let skipped = 0;
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
          const newVariants = [...new Set([...existingVariants])];
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
            tribalNation: person.tribalNation ?? undefined,
            tribalEnrollmentNumber: person.tribalEnrollmentNumber ?? undefined,
            notes: person.notes ?? undefined,
            isDeceased: person.isDeceased ?? (person.deathYear !== undefined),
            isAncestor: (person.generationalPosition ?? i) <= Math.floor(people.length / 2),
            generationalPosition: person.generationalPosition ?? i,
            sourceType: format,
            lineageTags: graph.lineageTags,
            icwaEligible: graph.icwaEligible,
            welfareEligible: graph.welfareEligible,
            trustBeneficiary: graph.trustInheritance,
            parentIds: [],
            childrenIds: [],
            spouseIds: [],
            protectionLevel: "ancestor",
            membershipStatus: "pending",
            nameVariants: [],
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

    for (let i = 0; i < people.length; i++) {
      const person = people[i];
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

    logger.info({ format, created, merged, skipped, total: people.length }, "Lineage registry import complete");

    res.json({
      format,
      total: people.length,
      created,
      merged,
      skipped,
      errors: errors.slice(0, 20),
      lineageIds,
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
