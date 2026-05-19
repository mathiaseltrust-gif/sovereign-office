import { Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { profileVaultTable, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRegisteredUser } from "../../auth/entra-guard";
import { parseAamvaString } from "../../lib/aamva-parser";
import {
  ExtractedIdFields,
  tryDecodePdf417,
  extractWithVision,
  extractFromPdfText,
  buildJurisdictionAdvisory,
  tryUploadToStorage,
} from "../../lib/id-extractor";
import { createIdScanSession, claimIdScanSession } from "../../lib/id-scan-sessions";
import { logger } from "../../lib/logger";

export type { ExtractedIdFields };

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Accepted formats: JPG, PNG, WEBP, HEIC, or a single-page PDF photo of your ID."));
    }
  },
});

router.post(
  "/",
  requireAuth,
  requireRegisteredUser,
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const dbId = req.user!.dbId!;
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const docType = (req.body.docType as "auto" | "dl" | "passport" | "tribal") ?? "auto";

      const frontFile = files?.["front"]?.[0];
      const backFile = files?.["back"]?.[0];

      if (!frontFile && !backFile) {
        res.status(400).json({ error: "Upload at least one side of the ID (front or back)." });
        return;
      }

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
            logger.info({ dbId, jurisdiction: aamva.issuingJurisdictionCode }, "AAMVA barcode decoded from back image (PDF417)");
          }
        }
      }

      if (!fields && backFile && !backIsPdf) {
        const visionFields = await extractWithVision(backFile.buffer, backFile.mimetype, "back", docType);
        extractionMethod = "vision_ocr";
        confidenceScore = 0.82;
        fields = { ...visionFields, extractionMethod, confidenceScore };
        logger.info({ dbId, method: "vision_back" }, "Vision OCR for back");
      }

      if (!fields && frontFile && !frontIsPdf) {
        const visionFields = await extractWithVision(frontFile.buffer, frontFile.mimetype, "front", docType);
        extractionMethod = "vision_ocr";
        confidenceScore = 0.85;
        fields = { ...visionFields, extractionMethod, confidenceScore };
        logger.info({ dbId, method: "vision_front" }, "Vision OCR for front");
      }

      if (!fields && (backIsPdf || frontIsPdf)) {
        const pdfFile = backIsPdf ? backFile! : frontFile!;
        const { fields: pdfFields, textFound } = await extractFromPdfText(pdfFile.buffer, docType);
        if (!textFound) {
          res.status(422).json({ error: "The uploaded PDF appears to contain only scanned images. Please take a photo of your ID with your phone instead and upload as JPG or PNG." });
          return;
        }
        extractionMethod = "pdf_text";
        confidenceScore = 0.75;
        fields = { ...pdfFields, extractionMethod, confidenceScore };
        logger.info({ dbId, method: "pdf_text" }, "PDF text extraction completed");
      }

      if (!fields) {
        res.status(422).json({ error: "Could not extract data from the provided image(s)." });
        return;
      }

      const [frontObjectPath, backObjectPath] = await Promise.all([
        frontFile ? tryUploadToStorage(frontFile.buffer, frontFile.mimetype, "front") : Promise.resolve(null),
        backFile ? tryUploadToStorage(backFile.buffer, backFile.mimetype, "back") : Promise.resolve(null),
      ]);

      const sessionId = randomUUID();
      createIdScanSession(sessionId, dbId, frontObjectPath, backObjectPath);

      const [profile] = await db
        .select({ preferredJurisdiction: profilesTable.preferredJurisdiction, jurisdictionTags: profilesTable.jurisdictionTags })
        .from(profilesTable)
        .where(eq(profilesTable.userId, dbId))
        .limit(1);

      const jurisdictionAdvisory = buildJurisdictionAdvisory(
        fields.issuingJurisdictionCode,
        profile?.preferredJurisdiction ?? null,
        profile?.jurisdictionTags,
      );

      logger.info({ dbId, docType: fields.documentType, jurisdiction: fields.issuingJurisdictionCode, advisoryLevel: jurisdictionAdvisory.level }, "ID document extracted");

      res.json({ fields, jurisdictionAdvisory, extractionMethod, confidenceScore, scanSessionId: sessionId });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/confirm",
  requireAuth,
  requireRegisteredUser,
  async (req, res, next) => {
    try {
      const dbId = req.user!.dbId!;
      const { fields, scanSessionId, idDocumentType, idJurisdictionCode, updateVault, updateProfile } = req.body as {
        fields: ExtractedIdFields;
        scanSessionId?: string;
        idDocumentType?: string;
        idJurisdictionCode?: string;
        updateVault?: boolean;
        updateProfile?: boolean;
      };

      if (!fields) { res.status(400).json({ error: "fields are required" }); return; }

      if (!scanSessionId) {
        res.status(400).json({ error: "A scan session ID is required. Please re-upload your ID to begin a new session." });
        return;
      }

      const session = claimIdScanSession(scanSessionId, dbId);
      if (!session || (!session.frontObjectPath && !session.backObjectPath)) {
        res.status(400).json({ error: "Scan session not found, expired, or no ID images were stored. Please re-upload your ID." });
        return;
      }

      await writeIdToVault({
        targetUserId: dbId,
        fields,
        idDocumentType,
        idJurisdictionCode,
        updateAddress: updateVault,
        updateProfile,
        frontObjectPath: session.frontObjectPath,
        backObjectPath: session.backObjectPath,
      });

      const docType = idDocumentType ?? fields.documentType ?? "unknown";
      const jurisdictionCode = idJurisdictionCode ?? fields.issuingJurisdictionCode ?? "";
      const now = new Date();

      logger.info({ dbId, docType, jurisdictionCode }, "User confirmed ID document");
      res.json({ success: true, idDocumentType: docType, idDocumentUploadedAt: now.toISOString(), idJurisdictionCode: jurisdictionCode });
    } catch (err) {
      next(err);
    }
  },
);

export async function writeIdToVault({
  targetUserId,
  fields,
  idDocumentType,
  idJurisdictionCode,
  updateAddress,
  updateProfile,
  frontObjectPath,
  backObjectPath,
}: {
  targetUserId: number;
  fields: ExtractedIdFields;
  idDocumentType?: string;
  idJurisdictionCode?: string;
  updateAddress?: boolean;
  updateProfile?: boolean;
  frontObjectPath: string | null;
  backObjectPath: string | null;
}): Promise<void> {
  const now = new Date();
  const docType = idDocumentType ?? fields.documentType ?? "unknown";
  const jurisdictionCode = idJurisdictionCode ?? fields.issuingJurisdictionCode ?? "";

  const [existingVault] = await db.select().from(profileVaultTable).where(eq(profileVaultTable.userId, targetUserId)).limit(1);

  const vaultUpdates: Record<string, unknown> = {
    idDocumentType: docType,
    idDocumentUploadedAt: now,
    idJurisdictionCode: jurisdictionCode,
    idScanRequestedAt: null,
    idScanRequestedBy: null,
    updatedAt: now,
  };

  if (frontObjectPath) vaultUpdates.idDocumentUrlFront = frontObjectPath;
  if (backObjectPath) vaultUpdates.idDocumentUrlBack = backObjectPath;
  if (fields.dateOfBirth) vaultUpdates.dateOfBirth = fields.dateOfBirth;
  if (updateAddress === true && fields.fullAddress) vaultUpdates.address = fields.fullAddress;

  if (existingVault) {
    await db.update(profileVaultTable).set(vaultUpdates).where(eq(profileVaultTable.userId, targetUserId));
  } else {
    await db.insert(profileVaultTable).values({ userId: targetUserId, ...vaultUpdates });
  }

  if (updateProfile !== false) {
    const idTag = `id_doc|jurisdiction:${jurisdictionCode}|type:${docType}|source:id_document`;
    const [existingProfile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, targetUserId)).limit(1);
    if (existingProfile) {
      const existingTags: string[] = Array.isArray(existingProfile.jurisdictionTags) ? existingProfile.jurisdictionTags as string[] : [];
      const newTags = existingTags.filter((t) => !String(t).startsWith("id_doc|"));
      newTags.push(idTag);
      await db.update(profilesTable).set({
        ...(fields.fullName ? { legalName: fields.fullName } : {}),
        jurisdictionTags: newTags,
        updatedAt: now,
      }).where(eq(profilesTable.userId, targetUserId));
    } else {
      await db.insert(profilesTable).values({
        userId: targetUserId,
        legalName: fields.fullName ?? "",
        jurisdictionTags: [idTag],
        updatedAt: now,
      });
    }
  }
}

export default router;
