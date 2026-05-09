import { Router } from "express";
import { db } from "@workspace/db";
import { searchIndexTable } from "@workspace/db";
import { requireAuth } from "../../auth/entra-guard";

const router = Router();

interface Filing {
  id: number;
  type: string;
  description: string;
  jurisdiction: string;
  state: string;
  county?: string;
  status: string;
  submittedBy?: string;
  documentUrl?: string;
  createdAt: string;
  updatedAt: string;
}

const filings: Filing[] = [];
let nextId = 1;

router.get("/", async (_req, res, next) => {
  try {
    res.json(filings);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const filing = filings.find((f) => f.id === id);
    if (!filing) {
      res.status(404).json({ error: "Filing not found" });
      return;
    }
    res.json(filing);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { type, description, jurisdiction, state, county } = req.body as {
      type: string;
      description: string;
      jurisdiction: string;
      state: string;
      county?: string;
    };

    if (!type || !description || !jurisdiction || !state) {
      res.status(400).json({ error: "type, description, jurisdiction, and state are required" });
      return;
    }

    const id = nextId++;
    const now = new Date().toISOString();
    const filing: Filing = {
      id,
      type,
      description,
      jurisdiction,
      state,
      county,
      status: "submitted",
      submittedBy: req.user?.id,
      createdAt: now,
      updatedAt: now,
    };
    filings.push(filing);

    await db.insert(searchIndexTable).values({
      entityType: "filing",
      entityId: String(id),
      content: `${type} ${description} ${jurisdiction} ${state}`,
      metadata: { type, state, county, status: filing.status },
    });

    res.status(201).json(filing);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const filing = filings.find((f) => f.id === id);
    if (!filing) {
      res.status(404).json({ error: "Filing not found" });
      return;
    }
    const { status, documentUrl } = req.body as { status?: string; documentUrl?: string };
    if (status) filing.status = status;
    if (documentUrl) filing.documentUrl = documentUrl;
    filing.updatedAt = new Date().toISOString();
    res.json(filing);
  } catch (err) {
    next(err);
  }
});

export default router;
