import { Router } from "express";
import { db } from "@workspace/db";
import {
  nfrDocumentsTable,
  trustInstrumentsTable,
  profilesTable,
  profileVaultTable,
  familyLineageTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";
import {
  buildNfrPdfBuffer,
  buildInstrumentPdfBuffer,
  type PdfBuildInput,
  type MemberContext,
} from "../../lib/pdf-builder";
import { buildDocRef } from "../../lib/doc-ref";
import { logger } from "../../lib/logger";

const router = Router();

/** Resolve member context for stamping: profile name/title + vault address + protection level. */
async function resolveMemberContext(
  userId: number,
  docType: string,
  docId: number,
): Promise<MemberContext> {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  const [vault] = await db
    .select()
    .from(profileVaultTable)
    .where(eq(profileVaultTable.userId, userId))
    .limit(1);

  const [lineage] = await db
    .select()
    .from(familyLineageTable)
    .where(eq(familyLineageTable.linkedProfileUserId, userId))
    .limit(1);

  const protectionLevel = (lineage as any)?.protectionLevel ?? "standard";
  const trustLandProtected =
    protectionLevel === "elevated" || protectionLevel === "critical";

  const legalName =
    profile?.legalName ??
    profile?.tribalName ??
    `Member #${userId}`;

  const docRef = buildDocRef(docType, userId, docId);

  return {
    userId,
    legalName,
    title: profile?.title ?? undefined,
    address: vault?.address ?? undefined,
    protectionLevel,
    trustLandProtected,
    docRef,
  };
}

router.get("/nfr/:id/pdf", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid document ID" });
      return;
    }

    const results = await db
      .select()
      .from(nfrDocumentsTable)
      .where(eq(nfrDocumentsTable.id, id))
      .limit(1);

    if (!results[0]) {
      res.status(404).json({ error: "NFR document not found" });
      return;
    }

    const doc = results[0];
    const memberId = req.user!.dbId ?? 0;

    logger.info({ nfrId: id, memberId }, "Generating NFR PDF");

    const memberCtx = memberId
      ? await resolveMemberContext(memberId, "NFR", id).catch(() => undefined)
      : undefined;

    const pdfBuffer = await buildNfrPdfBuffer(id, doc.content, memberCtx);

    const filename = memberCtx?.docRef
      ? `${memberCtx.docRef}.pdf`
      : `nfr-document-${id}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    if (memberCtx?.docRef) {
      res.setHeader("X-Document-Ref", memberCtx.docRef);
      res.setHeader("X-Member-Id", String(memberId));
    }
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

router.get("/instrument/:id/pdf", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid instrument ID" });
      return;
    }

    const results = await db
      .select({
        id: trustInstrumentsTable.id,
        content: trustInstrumentsTable.content,
        title: trustInstrumentsTable.title,
        jurisdiction: trustInstrumentsTable.jurisdiction,
        landJson: trustInstrumentsTable.landJson,
        partiesJson: trustInstrumentsTable.partiesJson,
        provisionsJson: trustInstrumentsTable.provisionsJson,
        recorderMetadata: trustInstrumentsTable.recorderMetadata,
        trusteeNotes: trustInstrumentsTable.trusteeNotes,
        userId: trustInstrumentsTable.userId,
      })
      .from(trustInstrumentsTable)
      .where(eq(trustInstrumentsTable.id, id))
      .limit(1);

    if (!results[0]) {
      res.status(404).json({ error: "Trust instrument not found" });
      return;
    }

    const inst = results[0];
    /* Use the instrument's owner if set; otherwise fall back to requesting user */
    const memberId = inst.userId ?? req.user!.dbId ?? 0;

    logger.info({ instrumentId: id, memberId }, "Generating instrument PDF");

    const memberCtx = memberId
      ? await resolveMemberContext(memberId, "INST", id).catch(() => undefined)
      : undefined;

    const inputOverride: Partial<PdfBuildInput> = {
      title: inst.title,
      parties: (inst.partiesJson ?? {}) as Record<string, string>,
      land: (inst.landJson ?? {}) as PdfBuildInput["land"],
      provisions: (inst.provisionsJson as unknown as string[]) ?? [],
      trusteeNotes: inst.trusteeNotes ?? undefined,
      recorderMetadata: (inst.recorderMetadata ?? {}) as PdfBuildInput["recorderMetadata"],
    };

    /* If member has an address on file, add it as the instrument's return address */
    if (memberCtx?.address) {
      inputOverride.recorderMetadata = {
        ...((inst.recorderMetadata ?? {}) as PdfBuildInput["recorderMetadata"]),
        returnAddress: `${memberCtx.legalName}\n${memberCtx.address}`,
      };
    }

    const pdfBuffer = await buildInstrumentPdfBuffer(
      id,
      inst.content,
      inst.jurisdiction ?? "",
      inputOverride,
      memberCtx,
    );

    const filename = memberCtx?.docRef
      ? `${memberCtx.docRef}.pdf`
      : `trust-instrument-${id}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    if (memberCtx?.docRef) {
      res.setHeader("X-Document-Ref", memberCtx.docRef);
      res.setHeader("X-Member-Id", String(memberId));
    }
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

export default router;
