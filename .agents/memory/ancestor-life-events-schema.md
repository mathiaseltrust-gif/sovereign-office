---
name: ancestor_life_events schema column mismatch
description: The Drizzle schema personId field was mapped to wrong DB column name; root cause of all ancestor_life_events 500 errors
---

# Rule
`lib/db/src/schema/ancestor-life-events.ts` must map `personId` to `"person_id"` (not `"ancestor_id"`).

**Why:** The original schema had `personId: integer("ancestor_id")` — the column alias was wrong. Every Drizzle ORM query using `ancestorLifeEventsTable.personId` generated `WHERE ancestor_id = $1` which failed with "column does not exist". Raw SQL patches were applied as workarounds in atlas/index.ts, family-tree/index.ts, and lineage/nodes.ts — those patches remain valid but the schema fix is the authoritative correction.

**How to apply:** If ancestor_life_events Drizzle queries start failing again, check this schema file first. The fix is: `personId: integer("person_id").notNull()`.
