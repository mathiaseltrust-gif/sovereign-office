import { Router } from "express";
import { db } from "@workspace/db";
import { businessVotesTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";
import { z } from "zod";

const router = Router();

const ELEVATED = new Set(["trustee", "officer", "sovereign_admin", "admin", "elder"]);

const CreateBody = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(3000).optional().default(""),
  motionType: z.enum(["procedural", "financial", "governance", "officer", "resolution", "amendment"]).optional().default("procedural"),
  conceptId: z.number().int().positive().optional(),
});

const VoteBody = z.object({
  vote: z.enum(["yes", "no", "abstain"]),
});

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const conceptId = req.query.conceptId ? Number(req.query.conceptId) : null;
    const rows = conceptId
      ? await db.select().from(businessVotesTable).where(eq(businessVotesTable.conceptId, conceptId)).orderBy(desc(businessVotesTable.createdAt))
      : await db.select().from(businessVotesTable).orderBy(desc(businessVotesTable.createdAt));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) { res.status(403).json({ error: "Registered account required." }); return; }

    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { title, description, motionType, conceptId } = parsed.data;
    const [row] = await db.insert(businessVotesTable).values({
      title,
      description,
      motionType,
      conceptId: conceptId ?? null,
      createdBy: userId,
      status: "open",
      yesCount: 0,
      noCount: 0,
      abstainCount: 0,
      voteRecords: [],
    }).returning();

    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/vote", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) { res.status(403).json({ error: "Registered account required." }); return; }

    const voteId = Number(req.params.id);
    const parsed = VoteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid vote" });
      return;
    }

    const [current] = await db.select().from(businessVotesTable).where(eq(businessVotesTable.id, voteId));
    if (!current) { res.status(404).json({ error: "Vote not found" }); return; }
    if (current.status !== "open") { res.status(400).json({ error: "This vote is closed" }); return; }

    const records = (current.voteRecords as { userId: number; vote: string }[]) ?? [];
    const existing = records.find(r => r.userId === userId);
    if (existing) { res.status(409).json({ error: "You have already voted on this motion" }); return; }

    records.push({ userId, vote: parsed.data.vote });

    const yesCount = records.filter(r => r.vote === "yes").length;
    const noCount = records.filter(r => r.vote === "no").length;
    const abstainCount = records.filter(r => r.vote === "abstain").length;

    const [updated] = await db.update(businessVotesTable)
      .set({ yesCount, noCount, abstainCount, voteRecords: records })
      .where(eq(businessVotesTable.id, voteId))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/close", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    const isElevated = req.user?.roles?.some(r => ELEVATED.has(r)) ?? false;
    if (!userId || !isElevated) { res.status(403).json({ error: "Elevated role required to close votes." }); return; }

    const voteId = Number(req.params.id);
    const [current] = await db.select().from(businessVotesTable).where(eq(businessVotesTable.id, voteId));
    if (!current) { res.status(404).json({ error: "Vote not found" }); return; }

    const records = (current.voteRecords as { userId: number; vote: string }[]) ?? [];
    const yesCount = records.filter(r => r.vote === "yes").length;
    const noCount = records.filter(r => r.vote === "no").length;
    const finalStatus = yesCount > noCount ? "passed" : yesCount < noCount ? "failed" : "tied";

    const [updated] = await db.update(businessVotesTable)
      .set({ status: finalStatus, yesCount, noCount, closedAt: new Date() })
      .where(eq(businessVotesTable.id, voteId))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const isElevated = req.user?.roles?.some(r => ELEVATED.has(r)) ?? false;
    if (!isElevated) { res.status(403).json({ error: "Elevated role required." }); return; }
    await db.delete(businessVotesTable).where(eq(businessVotesTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
