import { Router } from "express";
import { db } from "@workspace/db";
import { profileVaultTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const dbId = req.user!.dbId;
    if (!dbId) {
      res.status(400).json({ error: "User must be registered to access vault" });
      return;
    }
    const [row] = await db
      .select()
      .from(profileVaultTable)
      .where(eq(profileVaultTable.userId, dbId))
      .limit(1);

    res.json({
      hasData: !!row,
      hasDob: !!(row?.dateOfBirth),
      hasAddress: !!(row?.address),
      hasEmail: !!(row?.contactEmail),
      hasSsn: !!(row?.ssn),
      preferredContact: row?.preferredContact ?? null,
    });
  } catch (err) {
    next(err);
  }
});

router.put("/", requireAuth, async (req, res, next) => {
  try {
    const dbId = req.user!.dbId;
    if (!dbId) {
      res.status(400).json({ error: "User must be registered to update vault" });
      return;
    }

    const { dateOfBirth, address, preferredContact, contactEmail, ssn } = req.body as {
      dateOfBirth?: string;
      address?: string;
      preferredContact?: string;
      contactEmail?: string;
      ssn?: string;
    };

    if (contactEmail !== undefined && contactEmail !== "") {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(contactEmail)) {
        res.status(400).json({ error: "A valid email address is required" });
        return;
      }
    }

    if (ssn !== undefined && ssn !== "") {
      const ssnClean = ssn.replace(/\D/g, "");
      if (ssnClean.length !== 9) {
        res.status(400).json({ error: "SSN must be 9 digits" });
        return;
      }
    }

    const [existing] = await db
      .select()
      .from(profileVaultTable)
      .where(eq(profileVaultTable.userId, dbId))
      .limit(1);

    const updates = {
      dateOfBirth: dateOfBirth !== undefined ? (dateOfBirth || null) : existing?.dateOfBirth,
      address: address !== undefined ? (address || null) : existing?.address,
      preferredContact: preferredContact !== undefined ? (preferredContact || null) : existing?.preferredContact,
      contactEmail: contactEmail !== undefined ? (contactEmail || null) : existing?.contactEmail,
      ssn: ssn !== undefined ? (ssn ? ssn.replace(/\D/g, "") : null) : existing?.ssn,
      updatedAt: new Date(),
    };

    let vault;
    if (existing) {
      [vault] = await db
        .update(profileVaultTable)
        .set(updates)
        .where(eq(profileVaultTable.userId, dbId))
        .returning();
    } else {
      [vault] = await db
        .insert(profileVaultTable)
        .values({ userId: dbId, ...updates })
        .returning();
    }

    res.json({
      hasData: true,
      hasDob: !!(vault?.dateOfBirth),
      hasAddress: !!(vault?.address),
      hasEmail: !!(vault?.contactEmail),
      hasSsn: !!(vault?.ssn),
      preferredContact: vault?.preferredContact ?? null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
