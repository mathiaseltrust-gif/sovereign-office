import { Router, type Request } from "express";
import { createHmac } from "crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, trusteeAgreementAcceptancesTable } from "@workspace/db";
import { requireAuth } from "../../auth/entra-guard";
import { hasRole } from "../../engines/authority";
import { getCurrentTrusteeAgreement, TRUSTEE_AGREEMENT_KEY, TRUSTEE_AGREEMENT_VERSION } from "../../engines/trustee-agreement";

const router = Router();

function trusteeIdentityAllowed(req: Request): boolean {
  return Boolean(req.user && hasRole(req.user.roles ?? [], "trustee"));
}
function microsoftAuthenticated(req: Request): boolean {
  return req.user?.authMethod === "microsoft" && Boolean(req.user.entraId);
}

router.get("/current", requireAuth, async (req, res, next) => {
  try {
    if (!trusteeIdentityAllowed(req)) { res.status(403).json({ error: "Trustee authority is required to view this agreement." }); return; }
    if (!req.user?.dbId) { res.status(403).json({ error: "A registered Sovereign Office identity is required." }); return; }
    const { agreement, contentHash } = getCurrentTrusteeAgreement();
    const [acceptance] = await db.select().from(trusteeAgreementAcceptancesTable).where(and(
      eq(trusteeAgreementAcceptancesTable.userId, req.user.dbId),
      eq(trusteeAgreementAcceptancesTable.agreementKey, TRUSTEE_AGREEMENT_KEY),
      eq(trusteeAgreementAcceptancesTable.agreementVersion, TRUSTEE_AGREEMENT_VERSION),
      eq(trusteeAgreementAcceptancesTable.contentHash, contentHash),
      isNull(trusteeAgreementAcceptancesTable.revokedAt),
    )).orderBy(desc(trusteeAgreementAcceptancesTable.signedAt)).limit(1);
    res.json({
      agreement, contentHash, requiresSignature: !acceptance, microsoftAuthenticated: microsoftAuthenticated(req),
      authenticatedIdentity: { name: req.user.name ?? "", email: req.user.email, role: req.user.roles?.[0] ?? "trustee" },
      acceptance: acceptance ? {
        id: acceptance.id, signedName: acceptance.signedName, signedEmail: acceptance.signedEmail,
        roleAtSigning: acceptance.roleAtSigning, signatureMethod: acceptance.signatureMethod,
        signatureReceipt: acceptance.signatureReceipt, agreementVersion: acceptance.agreementVersion,
        contentHash: acceptance.contentHash, signedAt: acceptance.signedAt,
      } : null,
    });
  } catch (err) { next(err); }
});

router.get("/history", requireAuth, async (req, res, next) => {
  try {
    if (!trusteeIdentityAllowed(req) || !req.user?.dbId) { res.status(403).json({ error: "Trustee authority is required." }); return; }
    const rows = await db.select({
      id: trusteeAgreementAcceptancesTable.id, agreementVersion: trusteeAgreementAcceptancesTable.agreementVersion,
      contentHash: trusteeAgreementAcceptancesTable.contentHash, signedName: trusteeAgreementAcceptancesTable.signedName,
      signedEmail: trusteeAgreementAcceptancesTable.signedEmail, roleAtSigning: trusteeAgreementAcceptancesTable.roleAtSigning,
      signatureMethod: trusteeAgreementAcceptancesTable.signatureMethod, signatureReceipt: trusteeAgreementAcceptancesTable.signatureReceipt,
      signedAt: trusteeAgreementAcceptancesTable.signedAt, revokedAt: trusteeAgreementAcceptancesTable.revokedAt,
      revocationReason: trusteeAgreementAcceptancesTable.revocationReason,
    }).from(trusteeAgreementAcceptancesTable).where(eq(trusteeAgreementAcceptancesTable.userId, req.user.dbId))
      .orderBy(desc(trusteeAgreementAcceptancesTable.signedAt)).limit(25);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post("/accept", requireAuth, async (req, res, next) => {
  try {
    if (!trusteeIdentityAllowed(req)) { res.status(403).json({ error: "Trustee authority is required to execute this agreement." }); return; }
    if (!req.user?.dbId || !req.user.entraId) { res.status(403).json({ error: "A registered Microsoft-linked Trustee identity is required.", code: "MICROSOFT_IDENTITY_REQUIRED" }); return; }
    if (!microsoftAuthenticated(req)) { res.status(403).json({ error: "Re-authenticate through Microsoft before signing the Trustee Agreement.", code: "MICROSOFT_REAUTH_REQUIRED" }); return; }

    const { signedName, acknowledgedDuties, acknowledgedRemoval, acknowledgedElectronicSignature } = req.body ?? {};
    const cleanName = String(signedName ?? "").trim();
    if (cleanName.length < 2) { res.status(400).json({ error: "Enter the name you intend to use as your electronic signature." }); return; }
    if (!acknowledgedDuties || !acknowledgedRemoval || !acknowledgedElectronicSignature) {
      res.status(400).json({ error: "All Trustee acknowledgments must be affirmatively accepted before signing." }); return;
    }

    const { agreement, snapshotText, contentHash } = getCurrentTrusteeAgreement();
    const [existing] = await db.select().from(trusteeAgreementAcceptancesTable).where(and(
      eq(trusteeAgreementAcceptancesTable.userId, req.user.dbId),
      eq(trusteeAgreementAcceptancesTable.agreementKey, TRUSTEE_AGREEMENT_KEY),
      eq(trusteeAgreementAcceptancesTable.agreementVersion, TRUSTEE_AGREEMENT_VERSION),
      eq(trusteeAgreementAcceptancesTable.contentHash, contentHash),
      isNull(trusteeAgreementAcceptancesTable.revokedAt),
    )).limit(1);
    if (existing) { res.json({ acceptance: existing, agreement, alreadySigned: true }); return; }

    const signedAt = new Date();
    const receiptPayload = [req.user.dbId, req.user.entraId, TRUSTEE_AGREEMENT_KEY, TRUSTEE_AGREEMENT_VERSION, contentHash, cleanName, signedAt.toISOString()].join("|");
    const signatureReceipt = createHmac("sha256", process.env.SESSION_SECRET ?? "dev-secret-change-me").update(receiptPayload).digest("hex");
    const [acceptance] = await db.insert(trusteeAgreementAcceptancesTable).values({
      userId: req.user.dbId, entraId: req.user.entraId, agreementKey: TRUSTEE_AGREEMENT_KEY,
      agreementVersion: TRUSTEE_AGREEMENT_VERSION, contentHash, agreementText: snapshotText,
      signedName: cleanName, signedEmail: req.user.email, roleAtSigning: req.user.roles?.[0] ?? "trustee",
      signatureMethod: "microsoft_entra_authenticated_electronic_signature", signatureReceipt,
      acknowledgedDuties: true, acknowledgedRemoval: true, acknowledgedElectronicSignature: true,
      userAgent: req.headers["user-agent"] ?? null, signedAt,
    }).returning();
    res.status(201).json({ acceptance, agreement, message: "Trustee Agreement signed and activated." });
  } catch (err) { next(err); }
});

export default router;
