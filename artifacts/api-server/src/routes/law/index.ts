import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { requireAuth } from "../../auth/entra-guard";
import {
  listAllFederalLaw,
  listAllTribalLaw,
  listAllDoctrines,
  searchLaw,
  queryLawDb,
  addFederalLaw,
  addTribalLaw,
  addDoctrine,
  ensureLawDbSeeded,
} from "../../engines/law-db";

const router = Router();

function requireLawAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) { res.status(401).json({ error: "Authentication required." }); return; }
  const allowed = req.user.roles.some(r =>
    ["chief_justice", "sovereign_admin", "admin", "trustee"].includes(r)
  );
  if (!allowed) {
    res.status(403).json({ error: "Law Library writes require Sovereign Admin, Chief Justice, Trustee, or Admin access." });
    return;
  }
  next();
}

router.get("/", requireAuth, async (_req, res, next) => {
  try {
    await ensureLawDbSeeded();
    const [federal, tribal, doctrines] = await Promise.all([
      listAllFederalLaw(),
      listAllTribalLaw(),
      listAllDoctrines(),
    ]);
    res.json({ federal, tribal, doctrines });
  } catch (err) {
    next(err);
  }
});

router.get("/search", requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "");
    if (!q) {
      res.status(400).json({ error: "Query parameter 'q' is required" });
      return;
    }
    const results = await searchLaw(q);
    res.json({ federal: results.federalLaws, tribal: results.tribalLaws, doctrines: results.doctrines });
  } catch (err) {
    next(err);
  }
});

router.get("/query", requireAuth, async (req, res, next) => {
  try {
    const tagsRaw = req.query.tags as string | undefined;
    const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];
    const results = await queryLawDb(tags);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

router.get("/federal", requireAuth, async (_req, res, next) => {
  try {
    const laws = await listAllFederalLaw();
    res.json(laws);
  } catch (err) {
    next(err);
  }
});

router.get("/tribal", requireAuth, async (_req, res, next) => {
  try {
    const laws = await listAllTribalLaw();
    res.json(laws);
  } catch (err) {
    next(err);
  }
});

router.get("/doctrines", requireAuth, async (_req, res, next) => {
  try {
    const doctrines = await listAllDoctrines();
    res.json(doctrines);
  } catch (err) {
    next(err);
  }
});

router.post("/federal", requireAuth, requireLawAdmin, async (req, res, next) => {
  try {
    const { title, citation, body, tags } = req.body as {
      title: string; citation: string; body: string; tags?: string[];
    };
    if (!title || !citation || !body) {
      res.status(400).json({ error: "title, citation, and body are required" });
      return;
    }
    const entry = await addFederalLaw({ title, citation, body, tags });
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

router.post("/tribal", requireAuth, requireLawAdmin, async (req, res, next) => {
  try {
    const { title, citation, body, tags } = req.body as {
      title: string; citation: string; body: string; tags?: string[];
    };
    if (!title || !citation || !body) {
      res.status(400).json({ error: "title, citation, and body are required" });
      return;
    }
    const entry = await addTribalLaw({ title, citation, body, tags });
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

router.post("/doctrines", requireAuth, requireLawAdmin, async (req, res, next) => {
  try {
    const { caseName, citation, summary, tags } = req.body as {
      caseName: string; citation: string; summary: string; tags?: string[];
    };
    if (!caseName || !citation || !summary) {
      res.status(400).json({ error: "caseName, citation, and summary are required" });
      return;
    }
    const entry = await addDoctrine({ caseName, citation, summary, tags });
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

export default router;
