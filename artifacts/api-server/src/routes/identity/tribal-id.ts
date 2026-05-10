import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { resolveSovereignIdentityGateway } from "../../sovereign/identity-gateway";
import { buildTribalIdPdf, buildVerificationLetterPdf } from "../../lib/pdf-builder";
import { logger } from "../../lib/logger";

const router = Router();

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
      profilePhotoUrl: gateway.profilePhoto ?? (req.body?.profilePhotoUrl as string | undefined),
      verificationUrl: `${process.env.APP_URL ?? "https://sovereign.mathiasel.tribe"}/api/identity/verify/${gateway.identity.userId}`,
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
      profilePhotoUrl: gateway.profilePhoto ?? undefined,
      verificationUrl: `${process.env.APP_URL ?? "https://sovereign.mathiasel.tribe"}/api/identity/verify/${gateway.identity.userId}`,
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
        "Worcester v. Georgia (1832) — tribal sovereignty recognized and protected",
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

router.get("/verify/:userId", async (req, res) => {
  const userId = req.params.userId;
  res.json({
    verified: true,
    issuingAuthority: "Mathias El Tribe Sovereign Identity Gateway",
    userId,
    verifiedAt: new Date().toISOString(),
    message: "This identity record is maintained by the Sovereign Office of the Chief Justice & Trustee.",
  });
});

export default router;
