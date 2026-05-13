import { Router } from "express";
import { createHash, createHmac, randomBytes } from "crypto";
import { db } from "@workspace/db";
import { usersTable, familyLineageTable, profilesTable, notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { logger } from "../../lib/logger";

const router = Router();

const SESSION_SECRET = () => process.env.SESSION_SECRET ?? "dev-secret-change-me";

function hashPassword(password: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${password}:${SESSION_SECRET()}`).digest("hex");
}

const VALID_ROLES = ["member", "elder", "officer", "trustee", "medical_provider", "visitor_media", "sovereign_admin"];

function deriveRoleFromNode(node: {
  isAncestor?: boolean | null;
  generationalPosition?: number | null;
  membershipStatus?: string | null;
  protectionLevel?: string | null;
}): string {
  if (node.isAncestor && (node.generationalPosition ?? 0) >= 2) return "elder";
  if (node.membershipStatus === "verified" || node.membershipStatus === "confirmed") return "member";
  return "member";
}

// POST /api/lineage/nodes/:id/enroll
// Trustees only — create or link a user account for a family tree member
router.post("/:id/enroll", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const nodeId = parseInt(String(req.params.id), 10);
    if (isNaN(nodeId)) { res.status(400).json({ error: "Invalid lineage node ID" }); return; }

    const [node] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, nodeId)).limit(1);
    if (!node) { res.status(404).json({ error: "Lineage node not found" }); return; }

    const body = req.body as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : null;
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : node.fullName;
    const requestedRole = typeof body.role === "string" && VALID_ROLES.includes(body.role) ? body.role : null;
    const role = requestedRole ?? deriveRoleFromNode(node);
    const temporaryPassword = typeof body.temporaryPassword === "string" && body.temporaryPassword.length >= 8
      ? body.temporaryPassword : null;

    if (!email) { res.status(400).json({ error: "email is required" }); return; }

    // Check if a user already exists with this email
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    let user = existing;
    let created = false;

    if (!user) {
      // Create a new user account
      const insertValues: {
        email: string;
        name: string;
        role: string;
        entraRequired: boolean;
        passwordHash?: string;
        passwordSalt?: string;
      } = {
        email,
        name,
        role,
        entraRequired: false,
      };

      if (temporaryPassword) {
        const salt = randomBytes(16).toString("hex");
        insertValues.passwordHash = hashPassword(temporaryPassword, salt);
        insertValues.passwordSalt = salt;
      }

      const [created_user] = await db.insert(usersTable).values(insertValues).returning();
      user = created_user;
      created = true;
      logger.info({ userId: user.id, email, role, nodeId }, "Created user account from lineage enrollment");
    } else {
      // Update the role if it was explicitly requested and different
      if (requestedRole && existing.role !== requestedRole) {
        const [updated] = await db.update(usersTable)
          .set({ role, updatedAt: new Date() })
          .where(eq(usersTable.id, existing.id))
          .returning();
        user = updated;
      }
      // Optionally update the password if provided
      if (temporaryPassword) {
        const salt = randomBytes(16).toString("hex");
        const hash = hashPassword(temporaryPassword, salt);
        const [updated] = await db.update(usersTable)
          .set({ passwordHash: hash, passwordSalt: salt, updatedAt: new Date() })
          .where(eq(usersTable.id, existing.id))
          .returning();
        user = updated;
      }
      logger.info({ userId: user.id, email, role, nodeId }, "Linked existing user to lineage node");
    }

    // Link the lineage node to the user
    const [updatedNode] = await db.update(familyLineageTable)
      .set({
        linkedProfileUserId: user.id,
        membershipStatus: node.membershipStatus === "pending" ? "confirmed" : (node.membershipStatus ?? "confirmed"),
        protectionLevel: node.protectionLevel === "pending" ? "descendant" : (node.protectionLevel ?? "descendant"),
        pendingReview: false,
        updatedAt: new Date(),
      })
      .where(eq(familyLineageTable.id, nodeId))
      .returning();

    // Ensure a profile record exists for the user
    await db.insert(profilesTable)
      .values({
        userId: user.id,
        membershipVerified: true,
        lineageVerified: true,
        familyGroup: (Array.isArray(node.lineageTags) ? (node.lineageTags as string[])[0] : null) ?? node.tribalNation ?? "",
      })
      .onConflictDoUpdate({
        target: profilesTable.userId,
        set: {
          membershipVerified: true,
          lineageVerified: true,
          updatedAt: new Date(),
        },
      });

    // Send a welcome notification to the user's dashboard
    await db.insert(notificationsTable).values({
      userId: user.id,
      channel: "dashboard",
      category: "enrollment_granted",
      title: "Membership Access Granted",
      message: `Your tribal membership access has been granted by the Office of the Chief Justice. You may now log in with your email (${email})${temporaryPassword ? " and the temporary password provided to you" : " via Microsoft"}.`,
      severity: "info",
      relatedId: nodeId,
      relatedType: "family_lineage",
      read: false,
    });

    res.status(created ? 201 : 200).json({
      success: true,
      created,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      node: { id: updatedNode.id, membershipStatus: updatedNode.membershipStatus, linkedProfileUserId: updatedNode.linkedProfileUserId },
      loginMethod: temporaryPassword ? "email_password" : "microsoft",
      message: created
        ? `Account created for ${name}. They can now log in at the Sovereign Office Dashboard.`
        : `Existing account for ${email} linked to this lineage record. Role updated to ${role}.`,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/lineage/nodes/:id/enroll — update role or email of already-linked user
router.patch("/:id/enroll", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const nodeId = parseInt(String(req.params.id), 10);
    if (isNaN(nodeId)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [node] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, nodeId)).limit(1);
    if (!node) { res.status(404).json({ error: "Lineage node not found" }); return; }
    if (!node.linkedProfileUserId) { res.status(400).json({ error: "No user account linked to this node. Use POST to enroll first." }); return; }

    const body = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.role === "string" && VALID_ROLES.includes(body.role)) updates.role = body.role;
    if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();

    const [updated] = await db.update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, node.linkedProfileUserId))
      .returning();

    if (!updated) { res.status(404).json({ error: "Linked user not found" }); return; }

    logger.info({ userId: updated.id, nodeId, updates }, "Updated enrolled user from lineage panel");
    res.json({ success: true, user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role } });
  } catch (err) {
    next(err);
  }
});

export default router;
