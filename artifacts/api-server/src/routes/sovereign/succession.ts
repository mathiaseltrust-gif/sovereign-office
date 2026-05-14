/**
 * Sovereign Succession Vault
 * Pre-delegation safety mechanism — separate from all regular delegation systems.
 * The Chief Justice pre-designates a trustee + sets a private passcode.
 * In an emergency, the designated trustee activates succession using the passcode.
 */
import { Router } from "express";
import { createHash } from "crypto";
import { db } from "@workspace/db";
import { sovereignSuccessionTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { logger } from "../../lib/logger";

const router = Router();

function hashPasscode(passcode: string): string {
  return createHash("sha256").update(`sovereign-vault-${passcode}-mathias-el`).digest("hex");
}

// ── GET /status — Chief Justice checks vault status ───────────────────────────
router.get("/status", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const userId = req.user ? Number(req.user.id) : undefined;
    const [vault] = await db
      .select({
        id: sovereignSuccessionTable.id,
        delegateName: sovereignSuccessionTable.delegateName,
        delegateNotes: sovereignSuccessionTable.delegateNotes,
        instructions: sovereignSuccessionTable.instructions,
        isConfigured: sovereignSuccessionTable.isConfigured,
        isActivated: sovereignSuccessionTable.isActivated,
        activatedAt: sovereignSuccessionTable.activatedAt,
        createdAt: sovereignSuccessionTable.createdAt,
        updatedAt: sovereignSuccessionTable.updatedAt,
      })
      .from(sovereignSuccessionTable)
      .where(eq(sovereignSuccessionTable.createdByUserId, userId ?? 0));

    res.json(vault ?? null);
  } catch (err) {
    next(err);
  }
});

// ── POST / — Create or update the vault ──────────────────────────────────────
router.post("/", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const userId = req.user ? Number(req.user.id) : undefined;
    const { delegateName, delegateNotes, passcode, instructions } = req.body as {
      delegateName?: string;
      delegateNotes?: string;
      passcode?: string;
      instructions?: string;
    };

    if (!delegateName?.trim() || !passcode?.trim()) {
      res.status(400).json({ error: "Delegate name and passcode are required." });
      return;
    }

    if (passcode.length < 8) {
      res.status(400).json({ error: "Passcode must be at least 8 characters." });
      return;
    }

    const passcodeHash = hashPasscode(passcode);
    const now = new Date();

    // Delete any existing vault for this user before creating a new one
    await db
      .delete(sovereignSuccessionTable)
      .where(eq(sovereignSuccessionTable.createdByUserId, userId ?? 0));

    const [vault] = await db
      .insert(sovereignSuccessionTable)
      .values({
        createdByUserId: userId ?? 0,
        delegateName: delegateName.trim(),
        delegateNotes: delegateNotes?.trim(),
        passcodeHash,
        instructions: instructions?.trim(),
        isConfigured: true,
        isActivated: false,
      })
      .returning({
        id: sovereignSuccessionTable.id,
        delegateName: sovereignSuccessionTable.delegateName,
        delegateNotes: sovereignSuccessionTable.delegateNotes,
        instructions: sovereignSuccessionTable.instructions,
        isConfigured: sovereignSuccessionTable.isConfigured,
        isActivated: sovereignSuccessionTable.isActivated,
        createdAt: sovereignSuccessionTable.createdAt,
      });

    logger.info({ userId, delegateName }, "Sovereign succession vault configured");
    res.status(201).json(vault);
  } catch (err) {
    next(err);
  }
});

// ── DELETE / — Revoke the vault ───────────────────────────────────────────────
router.delete("/", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const userId = req.user ? Number(req.user.id) : undefined;
    await db
      .delete(sovereignSuccessionTable)
      .where(eq(sovereignSuccessionTable.createdByUserId, userId ?? 0));
    logger.info({ userId }, "Sovereign succession vault revoked");
    res.json({ revoked: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /activate — Emergency activation via passcode ────────────────────────
// Lower auth: only requires a valid login (any officer level), not CJ
router.post("/activate", requireAuth, async (req, res, next) => {
  try {
    const { passcode, activatedByEntry } = req.body as {
      passcode?: string;
      activatedByEntry?: string;
    };

    if (!passcode?.trim()) {
      res.status(400).json({ error: "Passcode is required." });
      return;
    }

    const testHash = hashPasscode(passcode);

    // Find any matching configured vault
    const vaults = await db.select().from(sovereignSuccessionTable);
    const matching = vaults.find(v => v.passcodeHash === testHash && v.isConfigured && !v.isActivated);

    if (!matching) {
      // Deliberate vague message for security
      logger.warn({ attempt: activatedByEntry }, "Succession vault: passcode attempt failed");
      res.status(401).json({ error: "Passcode not recognized or vault not available." });
      return;
    }

    const [activated] = await db
      .update(sovereignSuccessionTable)
      .set({
        isActivated: true,
        activatedAt: new Date(),
        activatedByEntry: activatedByEntry?.trim() ?? "ANONYMOUS",
        updatedAt: new Date(),
      })
      .where(eq(sovereignSuccessionTable.id, matching.id))
      .returning({
        id: sovereignSuccessionTable.id,
        delegateName: sovereignSuccessionTable.delegateName,
        instructions: sovereignSuccessionTable.instructions,
        activatedAt: sovereignSuccessionTable.activatedAt,
      });

    logger.warn({ vaultId: matching.id, activatedByEntry }, "SOVEREIGN SUCCESSION VAULT ACTIVATED");
    res.json({
      activated: true,
      delegateName: activated?.delegateName,
      instructions: activated?.instructions,
      activatedAt: activated?.activatedAt,
      message: "Authority succession has been activated. The designated trustee now carries sovereign authority as pre-established by the Chief Justice.",
    });
  } catch (err) {
    next(err);
  }
});

export default router;
