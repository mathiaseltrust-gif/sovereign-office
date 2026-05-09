import crypto from "node:crypto";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

let bootstrapToken: string | null = null;

export function getBootstrapToken(): string | null {
  return bootstrapToken;
}

export function consumeBootstrapToken(): void {
  bootstrapToken = null;
}

export async function initBootstrapToken(): Promise<void> {
  try {
    const admins = await db.select().from(usersTable).where(eq(usersTable.role, "admin")).limit(1);
    if (admins.length > 0) {
      return;
    }
    bootstrapToken = crypto.randomBytes(24).toString("hex");
    logger.warn(
      { bootstrapToken },
      "⚠️  NO ADMIN ACCOUNT EXISTS. Use this one-time token to bootstrap the first admin via POST /api/admin/bootstrap. It expires on next restart.",
    );
  } catch (err) {
    logger.error({ err }, "Failed to initialise bootstrap token");
  }
}
