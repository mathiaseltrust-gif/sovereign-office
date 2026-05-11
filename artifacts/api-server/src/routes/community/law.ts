import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { tribalLawTable, federalIndianLawTable, doctrineSourcesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ensureLawDbSeeded } from "../../sovereign/law-db";

const router = Router();

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
