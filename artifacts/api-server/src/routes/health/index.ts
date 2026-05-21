import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

async function checkDb(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

router.get(["/health", "/healthz"], async (_req, res) => {
  const dbOk = await checkDb();

  if (dbOk) {
    res.status(200).json({
      status: "ok",
      db: "ok",
      uptime: Math.floor(process.uptime()),
    });
  } else {
    res.status(503).json({
      status: "degraded",
      db: "error",
    });
  }
});

export default router;
