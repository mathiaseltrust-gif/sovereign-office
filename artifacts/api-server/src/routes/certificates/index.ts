import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  membershipCertificatesTable,
  officeSignaturesTable,
  familyLineageTable,
} from "@workspace/db";
import { eq, desc, max } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../../auth/entra-guard";
import { logger } from "../../lib/logger";
import { ObjectStorageService } from "../../lib/objectStorage";
import { generateCertificatePDF, type CertMember, type SignatureSlot } from "../../lib/generateCertificate";
import { Readable } from "stream";

const router: IRouter = Router();
const storage = new ObjectStorageService();

const OFFICER_ROLES = ["chief_justice", "chief_justice_trustee", "admin", "sovereign_admin", "trustee", "officer"];

function requireOfficer(req: Request, res: Response, next: () => void) {
  const roles = req.user?.roles ?? [];
  if (!roles.some((r) => OFFICER_ROLES.includes(r))) {
    res.status(403).json({ error: "Officer role required" });
    return;
  }
  next();
}

function buildCertNumber(year: number, seq: number): string {
  return `METCERT-${year}-${String(seq).padStart(4, "0")}`;
}

async function nextSeq(year: number): Promise<number> {
  const [row] = await db
    .select({ maxSeq: max(membershipCertificatesTable.seq) })
    .from(membershipCertificatesTable)
    .where(eq(membershipCertificatesTable.year, year));
  return (row?.maxSeq ?? 0) + 1;
}

async function loadSignatures(): Promise<SignatureSlot[]> {
  const rows = await db
    .select()
    .from(officeSignaturesTable)
    .where(eq(officeSignaturesTable.isActive, true));

  const slots: SignatureSlot[] = [];
  for (const row of rows) {
    let imageBuffer: Buffer | undefined;
    if (row.storageObjectPath) {
      try {
        const file = await storage.getObjectEntityFile(row.storageObjectPath);
        const resp = await storage.downloadObject(file);
        if (resp.body) {
          const arr = await new Response(resp.body).arrayBuffer();
          imageBuffer = Buffer.from(arr);
        }
      } catch {
        // signature image unavailable — use blank line
      }
    }
    slots.push({
      slot: row.slot as "chief_justice" | "trustee",
      signerName: row.signerName,
      signerTitle: row.signerTitle,
      imageBuffer,
    });
  }
  return slots;
}

// ── POST /certificates/membership ─────────────────────────────────────────────
// Issue one or more membership certificates
const IssueCertBody = z.object({
  memberIds: z.array(z.number()).min(1).max(20),
  notes: z.string().optional(),
  applySignatures: z.array(z.enum(["chief_justice", "trustee"])).optional(),
});

router.post("/membership", requireAuth, requireOfficer, async (req: Request, res: Response) => {
  const parsed = IssueCertBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { memberIds, notes, applySignatures } = parsed.data;
  const year = new Date().getFullYear();
  const issueDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  try {
    // Load member records
    const members = await db
      .select()
      .from(familyLineageTable)
      .where(
        memberIds.length === 1
          ? eq(familyLineageTable.id, memberIds[0])
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (familyLineageTable.id as any).in(memberIds),
      );

    if (members.length === 0) {
      res.status(404).json({ error: "No matching members found" });
      return;
    }

    // Load signature slots
    const allSigs = await loadSignatures();
    const sigs = applySignatures && applySignatures.length > 0
      ? allSigs.filter((s) => applySignatures.includes(s.slot))
      : allSigs;

    const certMembers: CertMember[] = [];
    const issuedCerts: { certNumber: string; memberId: number; memberName: string }[] = [];

    for (const m of members) {
      const seq = await nextSeq(year);
      const certNumber = buildCertNumber(year, seq);

      const memberType = m.isAncestor && !m.membershipStatus?.includes("adopted")
        ? "lineal_descendant"
        : "adoptive_descendant";

      certMembers.push({
        name: m.fullName,
        dob: m.birthDate ?? (m.birthYear ? String(m.birthYear) : ""),
        age: m.birthYear ? new Date().getFullYear() - m.birthYear : null,
        enrollment: m.tribalEnrollmentNumber ?? "",
        address: m.locationAddress ?? "",
        membershipType: memberType,
        certNumber,
      });

      // Save DB record (without PDF path yet)
      await db.insert(membershipCertificatesTable).values({
        certNumber,
        year,
        seq,
        memberId: m.id,
        memberName: m.fullName,
        memberDob: m.birthDate ?? (m.birthYear ? String(m.birthYear) : null),
        memberAge: m.birthYear ? new Date().getFullYear() - m.birthYear : null,
        memberEnrollment: m.tribalEnrollmentNumber,
        memberAddress: m.locationAddress,
        membershipType: memberType,
        signaturesApplied: sigs.map((s) => s.slot),
        issuedByUserId: req.user?.dbId ?? null,
        notes: notes ?? null,
        status: "active",
      });

      issuedCerts.push({ certNumber, memberId: m.id, memberName: m.fullName });
    }

    // Generate PDF
    const pdfBuffer = await generateCertificatePDF(certMembers, sigs, issueDate);

    // Store in object storage
    const objectPath = await storage.uploadBuffer(pdfBuffer, "application/pdf", "certificates");

    // Update all certs with storage path
    for (const cert of issuedCerts) {
      await db
        .update(membershipCertificatesTable)
        .set({ storageObjectPath: objectPath })
        .where(eq(membershipCertificatesTable.certNumber, cert.certNumber));
    }

    logger.info({ issuedCerts, objectPath }, "Membership certificates issued");

    res.json({
      issued: issuedCerts,
      storageObjectPath: objectPath,
      signaturesApplied: sigs.map((s) => s.slot),
    });
  } catch (err) {
    logger.error({ err }, "Failed to issue membership certificate");
    res.status(500).json({ error: "Failed to generate certificate" });
  }
});

// ── GET /certificates ─────────────────────────────────────────────────────────
router.get("/", requireAuth, requireOfficer, async (_req: Request, res: Response) => {
  try {
    const certs = await db
      .select()
      .from(membershipCertificatesTable)
      .orderBy(desc(membershipCertificatesTable.issuedAt))
      .limit(200);
    res.json({ certificates: certs });
  } catch (err) {
    logger.error({ err }, "Failed to list certificates");
    res.status(500).json({ error: "Failed to list certificates" });
  }
});

// ── GET /certificates/:certNumber ─────────────────────────────────────────────
router.get("/:certNumber", requireAuth, async (req: Request, res: Response) => {
  try {
    const [cert] = await db
      .select()
      .from(membershipCertificatesTable)
      .where(eq(membershipCertificatesTable.certNumber, req.params.certNumber));
    if (!cert) {
      res.status(404).json({ error: "Certificate not found" });
      return;
    }

    let downloadUrl: string | null = null;
    if (cert.storageObjectPath) {
      try {
        downloadUrl = await storage.getSignedDownloadUrl(cert.storageObjectPath, 3600);
      } catch { /* unavailable */ }
    }

    res.json({ certificate: cert, downloadUrl });
  } catch (err) {
    logger.error({ err }, "Failed to fetch certificate");
    res.status(500).json({ error: "Failed to fetch certificate" });
  }
});

// ── GET /certificates/:certNumber/pdf ─────────────────────────────────────────
// Stream the PDF directly
router.get("/:certNumber/pdf", requireAuth, async (req: Request, res: Response) => {
  try {
    const [cert] = await db
      .select()
      .from(membershipCertificatesTable)
      .where(eq(membershipCertificatesTable.certNumber, req.params.certNumber));
    if (!cert || !cert.storageObjectPath) {
      res.status(404).json({ error: "Certificate PDF not found" });
      return;
    }

    const file = await storage.getObjectEntityFile(cert.storageObjectPath);
    const resp = await storage.downloadObject(file, 0);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${cert.certNumber}.pdf"`);

    if (resp.body) {
      const nodeStream = Readable.fromWeb(resp.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    logger.error({ err }, "Failed to stream certificate PDF");
    res.status(500).json({ error: "Failed to stream PDF" });
  }
});

// ── GET /certificates/signatures/slots ───────────────────────────────────────
router.get("/signatures/slots", requireAuth, async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(officeSignaturesTable);
    res.json({
      signatures: rows.map((r) => ({
        id: r.id,
        slot: r.slot,
        signerName: r.signerName,
        signerTitle: r.signerTitle,
        hasImage: !!r.storageObjectPath,
        isActive: r.isActive,
        uploadedAt: r.uploadedAt,
      })),
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch signature slots");
    res.status(500).json({ error: "Failed to fetch signature slots" });
  }
});

// ── POST /certificates/signatures/:slot ───────────────────────────────────────
// Set/update a signature slot (name, title, optional image object path)
const SaveSignatureBody = z.object({
  signerName: z.string().min(1),
  signerTitle: z.string().min(1),
  storageObjectPath: z.string().optional(),
});

router.post("/signatures/:slot", requireAuth, requireOfficer, async (req: Request, res: Response) => {
  const slot = req.params.slot;
  if (!["chief_justice", "trustee"].includes(slot)) {
    res.status(400).json({ error: "Slot must be 'chief_justice' or 'trustee'" });
    return;
  }

  const parsed = SaveSignatureBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { signerName, signerTitle, storageObjectPath } = parsed.data;

  try {
    const [existing] = await db
      .select()
      .from(officeSignaturesTable)
      .where(eq(officeSignaturesTable.slot, slot));

    if (existing) {
      await db
        .update(officeSignaturesTable)
        .set({
          signerName,
          signerTitle,
          ...(storageObjectPath ? { storageObjectPath } : {}),
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(officeSignaturesTable.slot, slot));
    } else {
      await db.insert(officeSignaturesTable).values({
        slot,
        signerName,
        signerTitle,
        storageObjectPath: storageObjectPath ?? null,
        isActive: true,
        uploadedByUserId: req.user?.dbId ?? null,
        uploadedAt: new Date(),
        updatedAt: new Date(),
      });
    }

    res.json({ ok: true, slot, signerName, signerTitle });
  } catch (err) {
    logger.error({ err }, "Failed to save signature slot");
    res.status(500).json({ error: "Failed to save signature slot" });
  }
});

export default router;
