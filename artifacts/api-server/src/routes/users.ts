import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, profileVaultTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAnyRole } from "../auth/entra-guard";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireAnyRole(["officer", "trustee", "admin"]),
  async (_req, res, next) => {
    try {
      const users = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          role: usersTable.role,
          entraId: usersTable.entraId,
          createdAt: usersTable.createdAt,
          idDocumentType: profileVaultTable.idDocumentType,
          idDocumentUploadedAt: profileVaultTable.idDocumentUploadedAt,
          idJurisdictionCode: profileVaultTable.idJurisdictionCode,
        })
        .from(usersTable)
        .leftJoin(profileVaultTable, eq(profileVaultTable.userId, usersTable.id))
        .orderBy(usersTable.createdAt);

      res.json(users);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
