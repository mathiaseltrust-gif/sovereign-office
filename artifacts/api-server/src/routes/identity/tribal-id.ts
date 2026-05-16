import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../auth/entra-guard";
import { resolveSovereignIdentityGateway } from "../../sovereign/identity-gateway";
import { buildTribalIdPdf, buildVerificationLetterPdf } from "../../lib/pdf-builder";
import { logger } from "../../lib/logger";
import { db } from "@workspace/db";
import { familyLineageTable, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

/**
 * Convert a possibly-relative photo URL to an absolute URL the server can fetch.
 * data: URLs are returned unchanged. Relative paths (starting with /) are
 * prefixed with the Replit dev domain or localhost fallback.
 */
function resolvePhotoUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("/") || url.startsWith("./")) {
    const stripQuery = url.split("?")[0]; // drop cache-busting ?v= param
    const domain = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : `http://localhost:${process.env.PORT ?? 3000}`;
    return `${domain}${stripQuery}`;
  }
  return url;
}

router.post("/tribal-id/generate", requireAuth, async (req, res, next) => {
  try {
    const dbId = req.user!.dbId ?? 0;
    const tokenUser = { email: req.user!.email, name: req.user!.name ?? req.user!.email, roles: req.user!.roles ?? [] };
    const gateway = await resolveSovereignIdentityGateway(dbId, tokenUser);

    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 2);

    const result = await buildTribalIdPdf({
      userId: gateway.identity.userId,
      legalName: gateway.identity.legalName,
      tribalName: gateway.identity.tribalName,
      title: gateway.identity.title,
      familyGroup: gateway.identity.familyGroup,
      membershipStatus: gateway.membershipVerified ? "Verified Member" : "Pending Verification",
      protectionLevel: gateway.protectionLevel,
      lineageSummary: gateway.lineageSummary,
      identityTags: gateway.identity.identityTags,
      isElder: gateway.isElder,
      elderStatus: gateway.elderStatus,
      role: gateway.identity.role,
      orgAffiliations: gateway.orgAffiliations.map((o) => `${o.org} — ${o.role}`),
      expirationDate: expirationDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      profilePhotoUrl: resolvePhotoUrl(gateway.profilePhoto ?? (req.body?.profilePhotoUrl as string | undefined)),
      verificationUrl: `${process.env.APP_URL ?? "https://sovereign.mathiasel.tribe"}/api/identity/verify/${gateway.identity.userId}`,
      tribalEnrollmentNumber: gateway.identity.tribalEnrollmentNumber ?? undefined,
      tribalIdNumber: gateway.identity.tribalIdNumber ?? undefined,
    });

    logger.info({ userId: dbId }, "Tribal ID PDF generated");
    res.json({ success: true, size: result.bytes.length, generatedAt: result.generatedAt });
  } catch (err) {
    next(err);
  }
});

router.get("/tribal-id/:userId", requireAuth, async (req, res, next) => {
  try {
    const targetId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId) || req.user!.dbId || 0;
    const tokenUser = { email: req.user!.email, name: req.user!.name ?? req.user!.email, roles: req.user!.roles ?? [] };
    const gateway = await resolveSovereignIdentityGateway(targetId, tokenUser);

    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 2);

    const result = await buildTribalIdPdf({
      userId: gateway.identity.userId,
      legalName: gateway.identity.legalName,
      tribalName: gateway.identity.tribalName,
      title: gateway.identity.title,
      familyGroup: gateway.identity.familyGroup,
      membershipStatus: gateway.membershipVerified ? "Verified Member" : "Pending Verification",
      protectionLevel: gateway.protectionLevel,
      lineageSummary: gateway.lineageSummary,
      identityTags: gateway.identity.identityTags,
      isElder: gateway.isElder,
      elderStatus: gateway.elderStatus,
      role: gateway.identity.role,
      orgAffiliations: gateway.orgAffiliations.map((o) => `${o.org} — ${o.role}`),
      expirationDate: expirationDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      profilePhotoUrl: resolvePhotoUrl(gateway.profilePhoto),
      verificationUrl: `${process.env.APP_URL ?? "https://sovereign.mathiasel.tribe"}/api/identity/verify/${gateway.identity.userId}`,
      tribalEnrollmentNumber: gateway.identity.tribalEnrollmentNumber ?? undefined,
      tribalIdNumber: gateway.identity.tribalIdNumber ?? undefined,
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="tribal-id-${gateway.identity.userId}.pdf"`,
      "Content-Length": result.bytes.length,
    });
    res.send(Buffer.from(result.bytes));
  } catch (err) {
    next(err);
  }
});

router.post("/verification-letter/generate", requireAuth, async (req, res, next) => {
  try {
    const dbId = req.user!.dbId ?? 0;
    const tokenUser = { email: req.user!.email, name: req.user!.name ?? req.user!.email, roles: req.user!.roles ?? [] };
    const gateway = await resolveSovereignIdentityGateway(dbId, tokenUser);

    const result = await buildVerificationLetterPdf({
      userId: gateway.identity.userId,
      legalName: gateway.identity.legalName,
      tribalName: gateway.identity.tribalName,
      courtCaption: gateway.identity.courtCaption,
      title: gateway.identity.title,
      familyGroup: gateway.identity.familyGroup,
      membershipVerified: gateway.membershipVerified,
      lineageVerified: gateway.lineageVerified,
      entraVerified: gateway.entraVerified,
      lineageSummary: gateway.lineageSummary,
      ancestorChain: gateway.ancestorChain,
      tribalNations: gateway.tribalNations,
      delegatedAuthorities: Object.entries(gateway.delegatedAuthorities)
        .filter(([, v]) => v === true || (typeof v === "string" && v !== "none" && v !== "no"))
        .map(([k]) => k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())),
      protectionLevel: gateway.protectionLevel,
      jurisdictionalProtections: [
        "Treaty of Dancing Rabbit Creek (1830) — inherent sovereignty retained, never ceded",
        "Federal Trust Responsibility — U.S. fiduciary duty to protect Indian interests",
        "Indian Canons of Construction — ambiguity resolved in favor of tribal member",
        gateway.icwaEligible ? "ICWA (25 U.S.C. §§ 1901–1963) — child welfare protections active" : "",
        gateway.trustInheritance ? "Indian Reorganization Act (25 U.S.C. § 5108) — trust land protections active" : "",
      ].filter(Boolean),
      isElder: gateway.isElder,
      elderStatus: gateway.elderStatus,
      orgAffiliations: gateway.orgAffiliations,
      generatedFor: (req.body?.purpose as string) || "General Identity Verification",
      issueDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="verification-letter-${dbId}.pdf"`,
      "Content-Length": result.bytes.length,
    });
    res.send(Buffer.from(result.bytes));
  } catch (err) {
    next(err);
  }
});

router.post("/photo", requireAuth, upload.single("photo"), async (req, res, next) => {
  try {
    const dbId = req.user!.dbId;
    if (!dbId || !req.file) {
      res.status(400).json({ error: "No file provided or user not resolved" });
      return;
    }
    const mimeType = req.file.mimetype.includes("png") ? "image/png" : "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${req.file.buffer.toString("base64")}`;
    // Update linked-profile node first; if none exists fall back to own lineage rows
    const linkedRows = await db.update(familyLineageTable)
      .set({ photoUrl: dataUrl, updatedAt: new Date() })
      .where(eq(familyLineageTable.linkedProfileUserId, dbId))
      .returning({ id: familyLineageTable.id });
    if (linkedRows.length === 0) {
      await db.update(familyLineageTable)
        .set({ photoUrl: dataUrl, updatedAt: new Date() })
        .where(eq(familyLineageTable.userId, dbId));
    }
    logger.info({ dbId }, "Profile photo updated");
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/signature", requireAuth, upload.single("signature"), async (req, res, next) => {
  try {
    const dbId = req.user!.dbId;
    if (!dbId || !req.file) {
      res.status(400).json({ error: "No file provided or user not resolved" });
      return;
    }
    const mimeType = req.file.mimetype.includes("png") ? "image/png" : "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${req.file.buffer.toString("base64")}`;
    const existing = await db.select({ id: profilesTable.id }).from(profilesTable).where(eq(profilesTable.userId, dbId)).limit(1);
    if (existing.length > 0) {
      await db.update(profilesTable).set({ signatureUrl: dataUrl, updatedAt: new Date() }).where(eq(profilesTable.userId, dbId));
    } else {
      await db.insert(profilesTable).values({ userId: dbId, signatureUrl: dataUrl });
    }
    logger.info({ dbId }, "Digital signature updated");
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get("/land", requireAuth, async (req, res, next) => {
  try {
    const dbId = req.user!.dbId ?? 0;
    const rows = await db.select({
      apn: profilesTable.apn,
      mailingAddress: profilesTable.mailingAddress,
      landStatus: profilesTable.landStatus,
      legalDescription: profilesTable.legalDescription,
      hasRecordedInstrument: profilesTable.hasRecordedInstrument,
      tribalLandCode: (profilesTable as any).tribalLandCode,
      docNumbers: (profilesTable as any).docNumbers,
      landRestrictionBasis: (profilesTable as any).landRestrictionBasis,
      landClassification: (profilesTable as any).landClassification,
      selfExecuting: (profilesTable as any).selfExecuting,
    }).from(profilesTable).where(eq(profilesTable.userId, dbId)).limit(1);
    res.json(rows[0] ?? {});
  } catch (err) { next(err); }
});

router.put("/land", requireAuth, async (req, res, next) => {
  try {
    const dbId = req.user!.dbId ?? 0;
    const { apn, mailingAddress, landStatus, legalDescription, hasRecordedInstrument,
            tribalLandCode, docNumbers, landRestrictionBasis, landClassification, selfExecuting } = req.body;
    const existing = await db.select({ id: profilesTable.id }).from(profilesTable).where(eq(profilesTable.userId, dbId)).limit(1);
    const payload: Record<string, unknown> = { updatedAt: new Date() };
    if (apn !== undefined) payload.apn = apn;
    if (mailingAddress !== undefined) payload.mailingAddress = mailingAddress;
    if (landStatus !== undefined) payload.landStatus = landStatus;
    if (legalDescription !== undefined) payload.legalDescription = legalDescription;
    if (hasRecordedInstrument !== undefined) payload.hasRecordedInstrument = hasRecordedInstrument;
    if (tribalLandCode !== undefined) (payload as any).tribalLandCode = tribalLandCode;
    if (docNumbers !== undefined) (payload as any).docNumbers = docNumbers;
    if (landRestrictionBasis !== undefined) (payload as any).landRestrictionBasis = landRestrictionBasis;
    if (landClassification !== undefined) (payload as any).landClassification = landClassification;
    if (selfExecuting !== undefined) (payload as any).selfExecuting = selfExecuting;
    if (existing.length > 0) {
      await db.update(profilesTable).set(payload as any).where(eq(profilesTable.userId, dbId));
    } else {
      await db.insert(profilesTable).values({ userId: dbId, ...payload } as any);
    }
    logger.info({ dbId }, "Land record updated");
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get("/verify/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId) || 0;
  const verifiedAt = new Date().toLocaleString("en-US", { timeZoneName: "short", month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

  let memberName = "Tribal Member";
  let enrollmentNo = "";
  let role = "";
  let protectionLevel = "";
  let membershipVerified = true;

  try {
    if (userId > 0) {
      const tokenUser = { email: "", name: "", roles: [] as string[] };
      const gateway = await resolveSovereignIdentityGateway(userId, tokenUser);
      memberName = gateway.identity.legalName || gateway.identity.displayName || "Tribal Member";
      enrollmentNo = gateway.identity.tribalEnrollmentNumber ?? "";
      role = gateway.identity.role ?? "";
      protectionLevel = gateway.protectionLevel ?? "standard";
      membershipVerified = gateway.membershipVerified;
    }
  } catch { /* graceful — show generic verification */ }

  const roleLabel: Record<string, string> = {
    trustee: "Chief Justice & Trustee", sovereign_admin: "Chief Justice & Trustee",
    admin: "Chief Justice & Trustee", officer: "Officer", elder: "Elder",
    member: "Tribal Member", medical_provider: "Medical Provider",
  };
  const displayRole = (roleLabel[role] ?? role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())) || "Tribal Member";
  const protBadge: Record<string, string> = { critical: "#8B0000", elevated: "#7A5C00", standard: "#1a4d1a" };
  const badgeColor = protBadge[protectionLevel] ?? "#1a4d1a";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Identity Verification — Mathias El Tribe</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, 'Times New Roman', serif; background: #f5f0e8; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; }
    .card { background: #fff; border: 1.5px solid #c8b89a; border-radius: 4px; max-width: 480px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,0.13); overflow: hidden; }
    .header { background: linear-gradient(160deg, #6B0000 0%, #9B1A1A 100%); padding: 28px 24px 20px; text-align: center; }
    .header-title { font-family: Arial, sans-serif; font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: rgba(255,255,255,0.7); margin-bottom: 6px; }
    .header-name { font-size: 22px; font-weight: bold; color: #fff; margin-bottom: 2px; }
    .header-sub { font-size: 12px; color: rgba(255,255,255,0.65); letter-spacing: 1px; }
    .badge-row { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 3px; font-family: Arial, sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
    .badge-verified { background: #1a4d1a; color: #fff; }
    .badge-protection { color: #fff; }
    .checkmark { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.15); font-size: 26px; margin: 0 auto 10px; }
    .body { padding: 24px; }
    .field { margin-bottom: 16px; border-bottom: 1px solid #e8e0d4; padding-bottom: 14px; }
    .field:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .field-label { font-family: Arial, sans-serif; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #888; margin-bottom: 4px; }
    .field-value { font-size: 14px; color: #1a1a1a; font-weight: 600; }
    .field-value.mono { font-family: 'Courier New', monospace; color: #6B0000; }
    .footer { background: #f9f5ee; border-top: 1px solid #e0d4c0; padding: 14px 24px; }
    .footer-authority { font-family: Arial, sans-serif; font-size: 9px; color: #999; text-align: center; line-height: 1.5; letter-spacing: 0.3px; }
    .footer-ts { font-family: 'Courier New', monospace; font-size: 9px; color: #bbb; text-align: center; margin-top: 6px; }
    .seal-row { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 10px; }
    .seal-line { flex: 1; height: 1px; background: rgba(255,255,255,0.2); }
    .not-verified { color: #8B0000; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="header-title">Mathias El Tribe · Sovereign Identity Gateway</div>
      <div class="checkmark">${membershipVerified ? "✓" : "⚠"}</div>
      <div class="header-name">${memberName.replace(/</g, "&lt;")}</div>
      <div class="header-sub">Office of the Chief Justice &amp; Trustee</div>
      <div class="badge-row">
        <span class="badge badge-verified">${membershipVerified ? "✓ Verified Member" : "⚠ Pending Verification"}</span>
        ${protectionLevel ? `<span class="badge badge-protection" style="background:${badgeColor};">${protectionLevel.toUpperCase()} PROTECTION</span>` : ""}
      </div>
    </div>
    <div class="body">
      ${enrollmentNo ? `<div class="field"><div class="field-label">Enrollment Number</div><div class="field-value mono">${enrollmentNo}</div></div>` : ""}
      ${displayRole ? `<div class="field"><div class="field-label">Role / Title</div><div class="field-value">${displayRole.replace(/</g, "&lt;")}</div></div>` : ""}
      <div class="field"><div class="field-label">Membership Status</div><div class="field-value ${membershipVerified ? "" : "not-verified"}">${membershipVerified ? "Active &amp; Verified" : "Pending Verification"}</div></div>
      <div class="field"><div class="field-label">Issuing Authority</div><div class="field-value" style="font-size:12px;">Mathias El Tribe Supreme Court<br><span style="font-weight:400;color:#666;font-size:11px;">Sovereign Identity Gateway · Federal Trust Responsibility Applies</span></div></div>
      <div class="field"><div class="field-label">Legal Basis</div><div class="field-value" style="font-size:11px;font-weight:400;font-style:italic;color:#555;">Worcester v. Georgia, 31 U.S. 515 (1832)</div></div>
    </div>
    <div class="footer">
      <div class="footer-authority">This record is maintained under inherent sovereign authority of the Mathias El Tribe — An Identifiable Group of American Indians. Federal Trust Responsibility applies.</div>
      <div class="footer-ts">Verified: ${verifiedAt}</div>
    </div>
  </div>
</body>
</html>`;

  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store");
  res.send(html);
});

export default router;
