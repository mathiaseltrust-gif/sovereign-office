---
name: Atlas events endpoint
description: /api/atlas/events auth requirements and DB column quirks
---

**Rule:** `/api/atlas/events` must remain a **public** endpoint (no requireAuth). Historical Atlas events are shown to all visitors. Personal life-event rows are injected only when a valid auth token is present (soft-auth pattern: call requireAuth as middleware, ignore failure, proceed with userId=null).

**Why:** A prior security pass added requireAuth to this endpoint by mistake. The endpoint serves public historical data (Congressional acts, treaties, court decisions). Making it auth-only breaks the Atlas for logged-out users and breaks the atlas.tsx fetchAtlasEvents() which runs before the user activates Atlas Mode.

**How to apply:** When adding security to atlas routes, scope it to /ancestors, /ancestors/context, /timeline-events — NOT /events.

---

**Rule:** The `ancestor_life_events` table does NOT have a `place_normalized` column. Use `NULL::text AS "placeNormalized"` in all raw SQL queries that select from this table.

**Why:** The TypeScript type `LifeEventAtlasRow` includes `placeNormalized` (populated by the `enrichLifeEventPlace()` helper at runtime), but the actual DB column was never created. Using `place_normalized` in SQL causes a 500 error.

**How to apply:** All three query sites in atlas/index.ts use the NULL::text alias. Any future query against ancestor_life_events must avoid this column name.
