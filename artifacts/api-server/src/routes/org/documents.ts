import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { orgProfilesTable, orgDocumentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";
import { logger } from "../../lib/logger";
import { claimUpload } from "../../lib/pendingUploads";
import { ObjectStorageService, ObjectNotFoundError } from "../../lib/objectStorage";
import { Readable } from "stream";
import { z } from "zod";
import { SOVEREIGN_ORGS } from "../../sovereign/organizations";

const router = Router();
const objectStorageService = new ObjectStorageService();

const ELEVATED_ROLES = ["trustee", "officer", "sovereign_admin"];
const VALID_ORG_IDS = new Set(SOVEREIGN_ORGS.map((o) => o.id));

const ProfilePatchBody = z.object({
  ein: z.string().max(20).optional(),
  legalName: z.string().max(200).optional(),
  exemptType: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

const DocumentCreateBody = z.object({
  filename: z.string().min(1).max(500),
  fileKey: z.string().max(500).optional(),
  label: z.string().min(1).max(200),
  docType: z.enum(["ein_letter", "tax_exempt_cert", "527_reg", "501c3_cert", "tribal_license", "articles", "general"]).default("general"),
  description: z.string().max(1000).optional(),
});

function isElevated(req: Request): boolean {
  return req.user?.roles?.some((r) => ELEVATED_ROLES.includes(r)) ?? false;
}

router.get("/:orgId/profile", requireAuth, async (req: Request, res: Response, next) => {
  try {
    const { orgId } = req.params;
    if (!VALID_ORG_IDS.has(orgId as string)) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }
    const [profile] = await db
      .select()
      .from(orgProfilesTable)
      .where(eq(orgProfilesTable.orgId, orgId as string))
      .limit(1);
    res.json(profile ?? { orgId, ein: null, legalName: null, exemptType: null, notes: null });
  } catch (err) {
    next(err);
  }
});

router.patch("/:orgId/profile", requireAuth, async (req: Request, res: Response, next) => {
  try {
    const { orgId } = req.params;
    if (!VALID_ORG_IDS.has(orgId as string)) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }
    if (!isElevated(req)) {
      res.status(403).json({ error: "Trustee or officer access required." });
      return;
    }
    const parsed = ProfilePatchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid fields", details: parsed.error.flatten().fieldErrors });
      return;
    }
    const userId = req.user!.dbId;
    const updates = { ...parsed.data, updatedBy: userId, updatedAt: new Date() };

    const existing = await db.select({ id: orgProfilesTable.id }).from(orgProfilesTable)
      .where(eq(orgProfilesTable.orgId, orgId as string)).limit(1);

    let result;
    if (existing.length > 0) {
      [result] = await db.update(orgProfilesTable).set(updates)
        .where(eq(orgProfilesTable.orgId, orgId as string)).returning();
    } else {
      [result] = await db.insert(orgProfilesTable).values({ orgId: orgId as string, ...updates }).returning();
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/:orgId/documents", requireAuth, async (req: Request, res: Response, next) => {
  try {
    const { orgId } = req.params;
    if (!VALID_ORG_IDS.has(orgId as string)) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }
    const docs = await db.select().from(orgDocumentsTable)
      .where(eq(orgDocumentsTable.orgId, orgId as string));
    res.json(docs);
  } catch (err) {
    next(err);
  }
});

router.post("/:orgId/documents", requireAuth, async (req: Request, res: Response, next) => {
  try {
    const { orgId } = req.params;
    if (!VALID_ORG_IDS.has(orgId as string)) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }
    if (!isElevated(req)) {
      res.status(403).json({ error: "Trustee or officer access required to upload documents." });
      return;
    }
    const parsed = DocumentCreateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid fields", details: parsed.error.flatten().fieldErrors });
      return;
    }
    const userId = req.user!.dbId;
    const { filename, fileKey, label, docType, description } = parsed.data;

    if (fileKey) {
      const claimed = claimUpload(fileKey, String(userId));
      if (!claimed) {
        logger.warn({ userId, fileKey }, "Org document: upload claim failed");
        res.status(400).json({ error: "Upload not found or expired. Please re-upload the file." });
        return;
      }
    }

    const [doc] = await db.insert(orgDocumentsTable).values({
      orgId: orgId as string,
      docType,
      label,
      filename,
      fileKey: fileKey ?? null,
      description: description ?? null,
      uploadedBy: userId,
    }).returning();

    logger.info({ orgId, docId: doc.id, filename, userId }, "Org document registered");
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

router.delete("/:orgId/documents/:docId", requireAuth, async (req: Request, res: Response, next) => {
  try {
    const { orgId, docId } = req.params;
    if (!isElevated(req)) {
      res.status(403).json({ error: "Trustee or officer access required." });
      return;
    }
    const id = parseInt(String(docId), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid document id" }); return; }

    await db.delete(orgDocumentsTable).where(
      and(eq(orgDocumentsTable.id, id), eq(orgDocumentsTable.orgId, orgId as string))
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/:orgId/documents/:docId/download", requireAuth, async (req: Request, res: Response, next) => {
  try {
    const { orgId, docId } = req.params;
    const id = parseInt(String(docId), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid document id" }); return; }

    const [doc] = await db.select().from(orgDocumentsTable).where(
      and(eq(orgDocumentsTable.id, id), eq(orgDocumentsTable.orgId, orgId as string))
    ).limit(1);

    if (!doc) { res.status(404).json({ error: "Document not found" }); return; }
    if (!doc.fileKey) { res.status(404).json({ error: "No file stored for this document" }); return; }

    const objectFile = await objectStorageService.getObjectEntityFile(doc.fileKey);
    const response = await objectStorageService.downloadObject(objectFile);

    res.setHeader("Content-Disposition", `inline; filename="${doc.filename}"`);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.status(response.status);

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "File not found in storage" });
      return;
    }
    next(err);
  }
});

export default router;
