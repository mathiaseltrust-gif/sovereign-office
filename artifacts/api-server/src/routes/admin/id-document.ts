import { Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { profileVaultTable, profilesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRegisteredUser, requireAnyRole } from "../../auth/entra-guard";
import { ObjectStorageService, ObjectNotFoundError } from "../../lib/objectStorage";
import { parseAamvaString } from "../../lib/aamva-parser";
import {
  tryDecodePdf417,
  extractWithVision,
  extractFromPdfText,
  buildJurisdictionAdvisory,
  tryUploadToStorage,
  ExtractedIdFields,
} from "../../lib/id-extractor";
import { createIdScanSession, claimIdScanSession } from "../../lib/id-scan-sessions";
import { writeIdToVault } from "../user/id-document";
import { logger } from "../../lib/logger";

const router = Router();
const objectStorage = new ObjectStorageService();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Accepted formats: JPG, PNG, WEBP, HEIC, or a single-page PDF."));
    }
  },
});

router.get(
  "/:userId",
  requireAuth,
  requireRegisteredUser,
  requireAnyRole(["officer", "trustee", "admin"]),
  async (req, res, next) => {
    try {
      const targetUserId = parseInt(String(req.params.userId), 10);
      if (isNaN(targetUserId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

      const [vault] = await db
        .select({
          idDocumentType: profileVaultTable.idDocumentType,
          idDocumentUploadedAt: profileVaultTable.idDocumentUploadedAt,
          idJurisdictionCode: profileVaultTable.idJurisdictionCode,
          idDocumentUrlFront: profileVaultTable.idDocumentUrlFront,
          idDocumentUrlBack: profileVaultTable.idDocumentUrlBack,
        })
        .from(profileVaultTable)
        .where(eq(profileVaultTable.userId, targetUserId))
        .limit(1);

      if (!vault) { res.json({ hasIdDocument: false }); return; }

      const requesterRoles = req.user?.roles ?? [];
      const isTrustee = requesterRoles.some((r) =>
        ["trustee", "admin", "sovereign_admin", "chief_justice"].includes(r.toLowerCase()),
      );

      let signedFrontUrl: string | null = null;
      let signedBackUrl: string | null = null;

      if (isTrustee) {
        if (vault.idDocumentUrlFront) {
          try { signedFrontUrl = await objectStorage.getSignedDownloadUrl(vault.idDocumentUrlFront, 600); }
          catch (err) { if (!(err instanceof ObjectNotFoundError)) logger.warn({ err: (err as Error).message }, "Signed front URL failed"); }
        }
        if (vault.idDocumentUrlBack) {
          try { signedBackUrl = await objectStorage.getSignedDownloadUrl(vault.idDocumentUrlBack, 600); }
          catch (err) { if (!(err instanceof ObjectNotFoundError)) logger.warn({ err: (err as Error).message }, "Signed back URL failed"); }
        }
      }

      res.json({
        hasIdDocument: !!(vault.idDocumentType),
        idDocumentType: vault.idDocumentType ?? null,
        idDocumentUploadedAt: vault.idDocumentUploadedAt ?? null,
        idJurisdictionCode: vault.idJurisdictionCode ?? null,
        signedFrontUrl: isTrustee ? signedFrontUrl : undefined,
        signedBackUrl: isTrustee ? signedBackUrl : undefined,
        canViewImages: isTrustee,
      });
    } catch (err) { next(err); }
  },
);

router.post(
  "/extract/:userId",
  requireAuth,
  requireRegisteredUser,
  requireAnyRole(["officer", "trustee", "admin"]),
  upload.fields([{ name: "front", maxCount: 1 }, { name: "back", maxCount: 1 }]),
  async (req, res, next) => {
    try {
      const officerDbId = req.user!.dbId!;
      const targetUserId = parseInt(String(req.params.userId), 10);
      if (isNaN(targetUserId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

      const [targetUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, targetUserId)).limit(1);
      if (!targetUser) { res.status(404).json({ error: "Member not found" }); return; }

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const docType = (req.body.docType as "auto" | "dl" | "passport" | "tribal") ?? "auto";
      const frontFile = files?.["front"]?.[0];
      const backFile = files?.["back"]?.[0];

      if (!frontFile && !backFile) { res.status(400).json({ error: "Upload at least one side." }); return; }

      let fields: ExtractedIdFields | null = null;
      let extractionMethod: ExtractedIdFields["extractionMethod"] = "none";
      let confidenceScore = 0;
      let rawBarcodeData: string | undefined;

      const backIsPdf = backFile?.mimetype === "application/pdf";
      const frontIsPdf = frontFile?.mimetype === "application/pdf";

      if (backFile && !backIsPdf && (docType === "dl" || docType === "auto")) {
        const decoded = await tryDecodePdf417(backFile.buffer);
        if (decoded) {
          const aamva = parseAamvaString(decoded);
          if (aamva) {
            extractionMethod = "barcode";
            confidenceScore = 0.97;
            rawBarcodeData = decoded;
            fields = { ...aamva, extractionMethod, confidenceScore, rawBarcodeData };
          }
        }
      }

      if (!fields && backFile && !backIsPdf) {
        const vf = await extractWithVision(backFile.buffer, backFile.mimetype, "back", docType);
        extractionMethod = "vision_ocr"; confidenceScore = 0.82;
        fields = { ...vf, extractionMethod, confidenceScore };
      }

      if (!fields && frontFile && !frontIsPdf) {
        const vf = await extractWithVision(frontFile.buffer, frontFile.mimetype, "front", docType);
        extractionMethod = "vision_ocr"; confidenceScore = 0.85;
        fields = { ...vf, extractionMethod, confidenceScore };
      }

      if (!fields && (backIsPdf || frontIsPdf)) {
        const pdfFile = backIsPdf ? backFile! : frontFile!;
        const { fields: pdfFields, textFound } = await extractFromPdfText(pdfFile.buffer, docType);
        if (!textFound) {
          res.status(422).json({ error: "PDF appears image-only. Please take a photo of the ID instead." });
          return;
        }
        extractionMethod = "pdf_text"; confidenceScore = 0.75;
        fields = { ...pdfFields, extractionMethod, confidenceScore };
      }

      if (!fields) { res.status(422).json({ error: "Could not extract data from the provided image(s)." }); return; }

      const [frontObjectPath, backObjectPath] = await Promise.all([
        frontFile ? tryUploadToStorage(frontFile.buffer, frontFile.mimetype, "front") : Promise.resolve(null),
        backFile ? tryUploadToStorage(backFile.buffer, backFile.mimetype, "back") : Promise.resolve(null),
      ]);

      const sessionId = randomUUID();
      createIdScanSession(sessionId, officerDbId, frontObjectPath, backObjectPath, targetUserId);

      const [profile] = await db
        .select({ preferredJurisdiction: profilesTable.preferredJurisdiction, jurisdictionTags: profilesTable.jurisdictionTags })
        .from(profilesTable)
        .where(eq(profilesTable.userId, targetUserId))
        .limit(1);

      const jurisdictionAdvisory = buildJurisdictionAdvisory(
        fields.issuingJurisdictionCode,
        profile?.preferredJurisdiction ?? null,
        profile?.jurisdictionTags,
      );

      logger.info({ officerDbId, targetUserId, docType: fields.documentType, jurisdiction: fields.issuingJurisdictionCode }, "Officer ID extraction completed for member");
      res.json({ fields, jurisdictionAdvisory, extractionMethod, confidenceScore, scanSessionId: sessionId });
    } catch (err) { next(err); }
  },
);

router.post(
  "/confirm/:userId",
  requireAuth,
  requireRegisteredUser,
  requireAnyRole(["officer", "trustee", "admin"]),
  async (req, res, next) => {
    try {
      const officerDbId = req.user!.dbId!;
      const targetUserId = parseInt(String(req.params.userId), 10);
      if (isNaN(targetUserId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

      const { fields, scanSessionId, idDocumentType, idJurisdictionCode, updateVault } = req.body as {
        fields: ExtractedIdFields;
        scanSessionId?: string;
        idDocumentType?: string;
        idJurisdictionCode?: string;
        updateVault?: boolean;
      };

      if (!fields) { res.status(400).json({ error: "fields are required" }); return; }

      if (!scanSessionId) {
        res.status(400).json({ error: "A scan session ID is required." });
        return;
      }

      const session = claimIdScanSession(scanSessionId, officerDbId, targetUserId);
      if (!session || (!session.frontObjectPath && !session.backObjectPath)) {
        res.status(400).json({ error: "Scan session not found, expired, mismatched member, or has no stored images. Please re-extract." });
        return;
      }

      await writeIdToVault({
        targetUserId,
        fields,
        idDocumentType,
        idJurisdictionCode,
        updateAddress: updateVault,
        updateProfile: true,
        frontObjectPath: session.frontObjectPath,
        backObjectPath: session.backObjectPath,
      });

      const docType = idDocumentType ?? fields.documentType ?? "unknown";
      const jurisdictionCode = idJurisdictionCode ?? fields.issuingJurisdictionCode ?? "";
      const now = new Date();

      logger.info({ officerDbId, targetUserId, docType, jurisdictionCode }, "Officer confirmed ID for member");
      res.json({ success: true, idDocumentType: docType, idDocumentUploadedAt: now.toISOString(), idJurisdictionCode: jurisdictionCode });
    } catch (err) { next(err); }
  },
);

router.post(
  "/request-scan/:userId",
  requireAuth,
  requireRegisteredUser,
  requireAnyRole(["officer", "trustee", "admin"]),
  async (req, res, next) => {
    try {
      const targetUserId = parseInt(String(req.params.userId), 10);
      if (isNaN(targetUserId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

      const requestingUserId = req.user!.dbId!;
      const now = new Date();

      const [targetUser] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, targetUserId)).limit(1);
      if (!targetUser) { res.status(404).json({ error: "Member not found" }); return; }

      const [existingVault] = await db.select({ id: profileVaultTable.id }).from(profileVaultTable).where(eq(profileVaultTable.userId, targetUserId)).limit(1);

      if (existingVault) {
        await db.update(profileVaultTable).set({ idScanRequestedAt: now, idScanRequestedBy: requestingUserId, updatedAt: now }).where(eq(profileVaultTable.userId, targetUserId));
      } else {
        await db.insert(profileVaultTable).values({ userId: targetUserId, idScanRequestedAt: now, idScanRequestedBy: requestingUserId });
      }

      logger.info({ targetUserId, requestingUserId }, "ID scan requested for member by officer");
      res.json({ success: true, message: `Scan request sent to ${targetUser.name ?? targetUser.email ?? "member"}. They will see a prompt when they log in.`, requestedAt: now.toISOString() });
    } catch (err) { next(err); }
  },
);

export default router;
