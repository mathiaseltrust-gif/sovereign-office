import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { listBuiltInTemplates, getBuiltInTemplate } from "../../sovereign/template-engine";
import { listTemplates as listCourtTemplates } from "../../sovereign/court-doc-generator";
import { db } from "@workspace/db";
import { templatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * GET /api/templates
 * Returns all available templates grouped by category:
 * - built_in: sovereign instrument templates from the template engine
 * - court: court document templates (TRO, ICWA, NFR, etc.)
 * - custom: user-created templates stored in the database
 */
router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const builtInKeys = listBuiltInTemplates();
    const builtIn = builtInKeys.map(key => {
      const tpl = getBuiltInTemplate(key);
      return {
        key,
        title: tpl?.title ?? key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        source: "built_in" as const,
      };
    });

    const court = listCourtTemplates().map(t => ({
      key: t.id,
      title: t.name,
      category: t.category,
      documentType: t.documentType,
      troSensitive: t.troSensitive,
      emergencyEligible: t.emergencyEligible,
      source: "court" as const,
    }));

    let custom: Array<{ id: number; name: string; status: string | null; jurisdiction: string | null; source: "custom" }> = [];
    try {
      const rows = await db.select({
        id: templatesTable.id,
        name: templatesTable.name,
        status: templatesTable.status,
        jurisdiction: templatesTable.jurisdiction,
      }).from(templatesTable).where(eq(templatesTable.status, "published"));
      custom = rows.map(r => ({ ...r, source: "custom" as const }));
    } catch {
      // templates table may not exist in all environments — fail gracefully
    }

    res.json({
      built_in: builtIn,
      court,
      custom,
      total: builtIn.length + court.length + custom.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/templates/built-in
 * Lists all built-in sovereign instrument template keys.
 */
router.get("/built-in", async (_req, res, next) => {
  try {
    res.json({ templates: listBuiltInTemplates() });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/templates/built-in/:key
 * Returns the full content of a single built-in template.
 */
router.get("/built-in/:key", async (req, res, next) => {
  try {
    const tpl = getBuiltInTemplate(req.params.key);
    if (!tpl) {
      res.status(404).json({ error: `Template '${req.params.key}' not found.` });
      return;
    }
    res.json(tpl);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/templates/court
 * Lists all court document templates (TRO, ICWA, NFR, Protective Orders, etc.)
 */
router.get("/court", requireAuth, async (_req, res, next) => {
  try {
    res.json({ templates: listCourtTemplates() });
  } catch (err) {
    next(err);
  }
});

export default router;
