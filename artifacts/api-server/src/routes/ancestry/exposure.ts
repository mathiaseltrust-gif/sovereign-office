import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";

const router = Router();

// ── helpers ────────────────────────────────────────────────────────────────────
function str(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  return String(v).trim();
}
function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
function strArr(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string") return v.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}
function requireAdminOrTrustee(req: Parameters<typeof requireAuth>[0], res: Parameters<typeof requireAuth>[1], next: Parameters<typeof requireAuth>[2]): void {
  const roles: string[] = (req as { user?: { roles?: string[] } }).user?.roles ?? [];
  const allowed = new Set(["trustee", "sovereign_admin", "admin", "chief_justice"]);
  if (!roles.some(r => allowed.has(r))) {
    res.status(403).json({ error: "Requires admin or trustee role." });
    return;
  }
  next();
}

// ── GET /api/ancestry/exposure/events ─────────────────────────────────────────
// Public — no auth required (reference data)
router.get("/events", async (req, res, next) => {
  try {
    const { category, significance } = req.query as Record<string, string>;
    let q = sql`SELECT * FROM historical_exposure_events WHERE 1=1`;
    if (category && category !== "all") q = sql`${q} AND category = ${category}`;
    if (significance && significance !== "all") q = sql`${q} AND significance = ${significance}`;
    q = sql`${q} ORDER BY significance = 'critical' DESC, significance = 'high' DESC, year_start ASC`;
    const result = await db.execute(q);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ── GET /api/ancestry/exposure/matches ────────────────────────────────────────
// Auth required. Returns flat rows: ancestor × event temporal matches.
// Query params: ancestorId, category, significance, state, impactType, nameSearch
router.get("/matches", requireAuth, async (req, res, next) => {
  try {
    const { ancestorId, category, significance, state, impactType, nameSearch } = req.query as Record<string, string>;

    // Base query — temporal overlap between ancestor lifespan and event
    let q = sql`
      SELECT
        fl.id                AS ancestor_id,
        fl.full_name,
        fl.first_name,
        fl.last_name,
        fl.birth_year,
        fl.death_year,
        fl.tribal_nation,
        fl.membership_status,
        fl.is_ancestor,
        fl.is_deceased,
        hee.id               AS event_id,
        hee.title,
        hee.short_name,
        hee.category,
        hee.year_start,
        hee.year_end,
        hee.affected_states,
        hee.impact_types,
        hee.description,
        hee.significance,
        hee.legal_citation,
        hee.source_url,
        hee.is_custom,
        (
          array_length(hee.affected_states, 1) IS NULL
          OR array_length(hee.affected_states, 1) = 0
          OR 'ALL' = ANY(hee.affected_states)
          OR (
            fl.tribal_nation IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM unnest(hee.affected_states) s
              WHERE fl.tribal_nation ILIKE '%' || s || '%'
            )
          )
        ) AS location_match
      FROM family_lineage fl
      CROSS JOIN historical_exposure_events hee
      WHERE
        (fl.is_ancestor = TRUE OR fl.is_deceased = TRUE OR fl.death_year IS NOT NULL)
        AND (fl.birth_year IS NOT NULL OR fl.death_year IS NOT NULL)
        AND (
          (fl.birth_year IS NULL OR fl.birth_year <= COALESCE(hee.year_end, hee.year_start))
          AND (fl.death_year IS NULL OR fl.death_year >= hee.year_start)
        )
    `;

    // Optional filters
    if (ancestorId) q = sql`${q} AND fl.id = ${Number(ancestorId)}`;
    if (category && category !== "all") q = sql`${q} AND hee.category = ${category}`;
    if (significance && significance !== "all") q = sql`${q} AND hee.significance = ${significance}`;
    if (state && state.trim()) {
      const s = state.trim().toUpperCase();
      q = sql`${q} AND (${s} = ANY(hee.affected_states) OR 'ALL' = ANY(hee.affected_states))`;
    }
    if (impactType && impactType !== "all") {
      q = sql`${q} AND ${impactType} = ANY(hee.impact_types)`;
    }
    if (nameSearch && nameSearch.trim()) {
      const like = `%${nameSearch.trim()}%`;
      q = sql`${q} AND (fl.full_name ILIKE ${like} OR fl.first_name ILIKE ${like} OR fl.last_name ILIKE ${like})`;
    }

    q = sql`${q} ORDER BY
      fl.last_name NULLS LAST, fl.first_name NULLS LAST,
      CASE hee.significance WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
      hee.year_start`;

    const result = await db.execute(q);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ── GET /api/ancestry/exposure/matches/:ancestorId ───────────────────────────
// Public — used by community dashboard (no auth)
router.get("/matches/:ancestorId", async (req, res, next) => {
  try {
    const ancestorId = Number(req.params.ancestorId);
    const result = await db.execute(sql`
      SELECT
        fl.id AS ancestor_id, fl.full_name, fl.first_name, fl.last_name,
        fl.birth_year, fl.death_year, fl.tribal_nation,
        hee.id AS event_id, hee.title, hee.short_name, hee.category,
        hee.year_start, hee.year_end, hee.affected_states, hee.impact_types,
        hee.description, hee.significance, hee.legal_citation,
        (
          array_length(hee.affected_states, 1) IS NULL
          OR array_length(hee.affected_states, 1) = 0
          OR 'ALL' = ANY(hee.affected_states)
        ) AS location_match
      FROM family_lineage fl
      CROSS JOIN historical_exposure_events hee
      WHERE fl.id = ${ancestorId}
        AND (fl.birth_year IS NOT NULL OR fl.death_year IS NOT NULL)
        AND (
          (fl.birth_year IS NULL OR fl.birth_year <= COALESCE(hee.year_end, hee.year_start))
          AND (fl.death_year IS NULL OR fl.death_year >= hee.year_start)
        )
      ORDER BY
        CASE hee.significance WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
        hee.year_start
    `);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ── GET /api/ancestry/exposure/stats ─────────────────────────────────────────
router.get("/stats", requireAuth, async (_req, res, next) => {
  try {
    const [ancestorCount, eventCount, matchCount] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as n FROM family_lineage WHERE is_ancestor = TRUE OR is_deceased = TRUE OR death_year IS NOT NULL`),
      db.execute(sql`SELECT COUNT(*) as n FROM historical_exposure_events`),
      db.execute(sql`
        SELECT COUNT(DISTINCT fl.id) as n
        FROM family_lineage fl
        CROSS JOIN historical_exposure_events hee
        WHERE (fl.is_ancestor = TRUE OR fl.is_deceased = TRUE OR fl.death_year IS NOT NULL)
          AND (fl.birth_year IS NOT NULL OR fl.death_year IS NOT NULL)
          AND (
            (fl.birth_year IS NULL OR fl.birth_year <= COALESCE(hee.year_end, hee.year_start))
            AND (fl.death_year IS NULL OR fl.death_year >= hee.year_start)
          )
      `),
    ]);
    res.json({
      ancestorCount: Number(ancestorCount.rows[0]?.n ?? 0),
      eventCount: Number(eventCount.rows[0]?.n ?? 0),
      matchedAncestorCount: Number(matchCount.rows[0]?.n ?? 0),
    });
  } catch (err) { next(err); }
});

// ── POST /api/ancestry/exposure/events ───────────────────────────────────────
router.post("/events", requireAuth, requireAdminOrTrustee, async (req, res, next) => {
  try {
    const { title, shortName, category, yearStart, yearEnd, affectedStates, impactTypes, description, legalCitation, sourceUrl, significance } = req.body as Record<string, unknown>;
    const states = strArr(affectedStates);
    const impacts = strArr(impactTypes);
    const result = await db.execute(sql`
      INSERT INTO historical_exposure_events
        (title, short_name, category, year_start, year_end, affected_states, impact_types, description, legal_citation, source_url, significance, is_custom)
      VALUES (
        ${str(title)}, ${str(shortName)}, ${str(category) ?? "federal_law"},
        ${num(yearStart)}, ${num(yearEnd)},
        ${sql`ARRAY[${sql.raw(states.map(s => `'${s.replace(/'/g, "''")}'`).join(",") || "")}]::text[]`},
        ${sql`ARRAY[${sql.raw(impacts.map(s => `'${s.replace(/'/g, "''")}'`).join(",") || "")}]::text[]`},
        ${str(description)}, ${str(legalCitation)}, ${str(sourceUrl)},
        ${str(significance) ?? "high"}, TRUE
      ) RETURNING *
    `);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// ── PUT /api/ancestry/exposure/events/:id ────────────────────────────────────
router.put("/events/:id", requireAuth, requireAdminOrTrustee, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { title, shortName, category, yearStart, yearEnd, affectedStates, impactTypes, description, legalCitation, sourceUrl, significance } = req.body as Record<string, unknown>;
    const states = strArr(affectedStates);
    const impacts = strArr(impactTypes);
    await db.execute(sql`
      UPDATE historical_exposure_events SET
        title = ${str(title)},
        short_name = ${str(shortName)},
        category = ${str(category)},
        year_start = ${num(yearStart)},
        year_end = ${num(yearEnd)},
        affected_states = ${sql`ARRAY[${sql.raw(states.map(s => `'${s.replace(/'/g, "''")}'`).join(",") || "")}]::text[]`},
        impact_types = ${sql`ARRAY[${sql.raw(impacts.map(s => `'${s.replace(/'/g, "''")}'`).join(",") || "")}]::text[]`},
        description = ${str(description)},
        legal_citation = ${str(legalCitation)},
        source_url = ${str(sourceUrl)},
        significance = ${str(significance)},
        updated_at = NOW()
      WHERE id = ${id}
    `);
    const updated = await db.execute(sql`SELECT * FROM historical_exposure_events WHERE id = ${id}`);
    res.json(updated.rows[0]);
  } catch (err) { next(err); }
});

// ── DELETE /api/ancestry/exposure/events/:id ─────────────────────────────────
router.delete("/events/:id", requireAuth, requireAdminOrTrustee, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const check = await db.execute(sql`SELECT is_custom FROM historical_exposure_events WHERE id = ${id}`);
    if (!check.rows[0]) { res.status(404).json({ error: "Event not found." }); return; }
    if (!(check.rows[0] as { is_custom: boolean }).is_custom) {
      res.status(403).json({ error: "Cannot delete built-in historical events. Only custom events can be deleted." });
      return;
    }
    await db.execute(sql`DELETE FROM historical_exposure_events WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
