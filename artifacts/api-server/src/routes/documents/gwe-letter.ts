import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { gweLettersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";
import { buildGweLetterPdf, type GweLetterInput } from "../../lib/pdf-builder";
import { objectStorageClient } from "../../lib/objectStorage";
import { logger } from "../../lib/logger";
import { randomUUID } from "node:crypto";

const router = Router();

const VALID_BASES = [
  "25 U.S.C. § 117b",
  "IRC § 139E",
  "25 U.S.C. § 117b / IRC § 139E",
] as const;

const ALLOWED_GENERATE_ROLES = ["trustee", "officer", "admin", "sovereign_admin"];
const ALLOWED_VIEW_ROLES = ["trustee", "officer", "admin", "sovereign_admin", "elder"];

function hasAnyRole(req: Request, roles: string[]): boolean {
  const userRoles: string[] = req.user?.roles ?? [];
  return userRoles.some((r) => roles.includes(r));
}

function parsePrivateObjectDir(dir: string): { bucketName: string; prefix: string } | null {
  const clean = dir.startsWith("/") ? dir.slice(1) : dir;
  const parts = clean.split("/");
  if (parts.length < 1 || !parts[0]) return null;
  const bucketName = parts[0];
  const prefix = parts.slice(1).join("/");
  return { bucketName, prefix };
}

async function uploadToStorage(pdfBuffer: Buffer, filename: string): Promise<string | null> {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) return null;

  const parsed = parsePrivateObjectDir(privateDir);
  if (!parsed) {
    throw new Error(`PRIVATE_OBJECT_DIR is set but could not be parsed: "${privateDir}"`);
  }

  const { bucketName, prefix } = parsed;
  const objectId = randomUUID();
  const objectName = prefix
    ? `${prefix}/gwe-letters/${objectId}/${filename}`
    : `gwe-letters/${objectId}/${filename}`;

  const bucket = objectStorageClient.bucket(bucketName);
  await bucket.file(objectName).save(pdfBuffer, {
    metadata: { contentType: "application/pdf" },
  });

  const storageKey = `/objects/gwe-letters/${objectId}/${filename}`;
  logger.info({ bucketName, objectName, storageKey }, "GWE letter PDF uploaded to object storage");
  return storageKey;
}

router.post("/", requireAuth, async (req, res, next) => {
  try {
    if (!hasAnyRole(req, ALLOWED_GENERATE_ROLES)) {
      res.status(403).json({ error: "Only Officers, Trustees, and Admins may generate GWE letters" });
      return;
    }

    const {
      recipientName,
      letterDate,
      programName,
      exclusionBasis,
      amount,
      issuingOfficer,
    } = req.body as {
      recipientName?: string;
      letterDate?: string;
      programName?: string;
      exclusionBasis?: string;
      amount?: string;
      issuingOfficer?: string;
    };

    if (!recipientName || !letterDate || !programName || !exclusionBasis || !amount || !issuingOfficer) {
      res.status(400).json({ error: "All fields are required: recipientName, letterDate, programName, exclusionBasis, amount, issuingOfficer" });
      return;
    }

    if (!VALID_BASES.includes(exclusionBasis as GweLetterInput["exclusionBasis"])) {
      res.status(400).json({ error: `exclusionBasis must be one of: ${VALID_BASES.join(", ")}` });
      return;
    }

    const userId: string = req.user?.id ?? "system";

    const [saved] = await db
      .insert(gweLettersTable)
      .values({
        recipientName,
        letterDate,
        programName,
        exclusionBasis,
        amount,
        issuingOfficer,
        generatedBy: userId,
      })
      .returning();

    const input: GweLetterInput = {
      recipientName,
      letterDate,
      programName,
      exclusionBasis: exclusionBasis as GweLetterInput["exclusionBasis"],
      amount,
      issuingOfficer,
      referenceNumber: String(saved.id).padStart(6, "0"),
    };

    const result = await buildGweLetterPdf(input);
    const safeRecipient = recipientName.replace(/[^a-zA-Z0-9]/g, "-");
    const filename = `gwe-letter-${saved.id}-${safeRecipient}.pdf`;

    const storageKey = await uploadToStorage(result.buffer, filename);

    if (storageKey) {
      await db
        .update(gweLettersTable)
        .set({ storageKey })
        .where(eq(gweLettersTable.id, saved.id));
    }

    logger.info(
      { id: saved.id, recipientName, programName, bytes: result.buffer.length, storageKey },
      "GWE letter generated",
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", result.buffer.length);
    res.setHeader("X-GWE-Letter-Id", String(saved.id));
    res.setHeader("X-GWE-Generated-At", result.generatedAt);
    res.setHeader("X-GWE-Checksum", result.checksum);
    res.send(result.buffer);
  } catch (err) {
    next(err);
  }
});

router.get("/", requireAuth, async (req, res, next) => {
  try {
    if (!hasAnyRole(req, ALLOWED_VIEW_ROLES)) {
      res.status(403).json({ error: "Insufficient privileges to list GWE letters" });
      return;
    }

    const rows = await db
      .select()
      .from(gweLettersTable)
      .orderBy(desc(gweLettersTable.createdAt));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/pdf", requireAuth, async (req, res, next) => {
  try {
    if (!hasAnyRole(req, ALLOWED_VIEW_ROLES)) {
      res.status(403).json({ error: "Insufficient privileges to download GWE letters" });
      return;
    }

    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid letter ID" });
      return;
    }

    const rows = await db
      .select()
      .from(gweLettersTable)
      .where(eq(gweLettersTable.id, id))
      .limit(1);

    if (!rows[0]) {
      res.status(404).json({ error: "GWE letter not found" });
      return;
    }

    const row = rows[0];
    const input: GweLetterInput = {
      recipientName: row.recipientName,
      letterDate: row.letterDate,
      programName: row.programName,
      exclusionBasis: row.exclusionBasis as GweLetterInput["exclusionBasis"],
      amount: row.amount,
      issuingOfficer: row.issuingOfficer,
      referenceNumber: String(row.id).padStart(6, "0"),
    };

    const result = await buildGweLetterPdf(input);
    const safeRecipient = row.recipientName.replace(/[^a-zA-Z0-9]/g, "-");
    const filename = `gwe-letter-${row.id}-${safeRecipient}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", result.buffer.length);
    res.send(result.buffer);
  } catch (err) {
    next(err);
  }
});

export default router;
