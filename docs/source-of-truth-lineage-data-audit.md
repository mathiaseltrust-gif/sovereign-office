# Source-of-Truth Lineage Data Audit

Date: 2026-06-19
Scope: data preservation and exposure only. UI rendering work is paused. The prior visual-tree implementation patch was reverted so this PR contains audit documentation only.

## 1. Data flow map: GEDCOM → staging → lineage node → family unit → UI/API consumers

### A. Staged GEDCOM import path (`/api/ancestry/gedcom/*`)
1. `artifacts/api-server/src/lib/gedcom-parser.ts` parses GEDCOM into `GedcomIndividual` and `GedcomFamily` records. It extracts names, birth/death date/year/place, gender, notes, source strings, census labels, life events (`BIRT`, `CHR`, `RESI`, `MARR`, `DEAT`, `BURI`), media references (`OBJE`), and FAM husband/wife/children with marriage date/place.
2. `artifacts/api-server/src/routes/ancestry/gedcom.ts` stages individuals into `gedcom_staging`, including `lifeEvents`, `mediaRefs`, `sourceRecords`, GEDCOM parent/spouse/child IDs, and duplicate-match metadata.
3. On single approval, `mergeIntoExisting()` enriches an existing `family_lineage` row or the insert branch creates a new row. It preserves core vital fields on `family_lineage`, writes `ancestor_life_events`, writes `ancestor_media`, and then calls `linkRelationshipsForBatch()`.
4. `linkRelationshipsForBatch()` maps staged GEDCOM IDs to approved lineage IDs and updates `family_lineage.parentIds`, `childrenIds`, and `spouseIds`.
5. Gap: this staged GEDCOM path does **not** insert `family_units`, so FAM-level marriage date/place and membership are preserved only indirectly through flat spouse/parent/child arrays plus individual `marriage` life events when present.

### B. Direct lineage import path (`/api/lineage/import`)
1. `artifacts/api-server/src/engines/family-tree-engine.ts` has a simpler `parseGedcom()` and `parseGedcomFamilies()` parser used by `artifacts/api-server/src/routes/lineage/import.ts`.
2. This path inserts/merges `family_lineage` people and then inserts `family_units` from GEDCOM FAM records.
3. It patches `parentIds`, `childrenIds`, and `siblingIds` from each FAM record.
4. Gap: this path preserves fewer GEDCOM event/media/source details than the staged GEDCOM path; FAM marriage date/place are parsed by the newer parser but not represented in `family_units` schema.

### C. Canonical persistence layer
- `family_lineage` is the current person node table for names, vital dates/places, relationship arrays, profile links, photo URL/filename, location, visibility, and membership/protection flags.
- `family_units` is the current family group table for husband/wife/spouse IDs, child IDs, GEDCOM family IDs, relationship type, and source type.
- `gedcom_staging` is the richest import-review table; it stores source records, life events, media refs, and GEDCOM IDs before approval.
- `ancestor_life_events` and `ancestor_media` preserve event and media details after staged GEDCOM approval.
- `ancestral_records` and `identity_narratives` support Knowledge-of-Self links but are not a full citation/event graph.

### D. API/UI consumers audited
- Family tree UI: `artifacts/sovereign-dashboard/src/pages/family-tree.tsx` consumes `/api/family-tree`, `/api/family-tree/knowledge-of-self`, `/api/lineage/nodes/self`, `/api/lineage/family-units`, `/api/lineage/import`, `/api/lineage/duplicates`, and edit/link endpoints.
- Lineage node APIs: `artifacts/api-server/src/routes/lineage/nodes.ts` expose a broad `family_lineage` projection, self/immediate-family data, member-added records, CRUD, household status, and family-unit listing.
- Relationship APIs: `artifacts/api-server/src/routes/lineage/relationships.ts` derives relationships from `parentIds`, `childrenIds`, `spouseIds`, `siblingIds`, and `family_units`.
- Knowledge-of-Self: `artifacts/api-server/src/routes/family-tree/index.ts` returns narratives, linked ancestors, ancestral records, and historical context from `family_lineage` plus `atlas_events`.
- Profile/member cards: `artifacts/sovereign-dashboard/src/pages/profile.tsx`, `artifacts/sovereign-dashboard/src/pages/family-governance.tsx`, and the family-tree node cards consume member/profile photos and lineage summaries, not the full GEDCOM source/event graph.
- Community directory / member status: current lineage coupling is mainly through linked profile/user fields and household/member status endpoints; it does not expose GEDCOM events/citations directly.
- Atlas/person map links: `family_lineage.birthPlace`, `deathPlace`, and `locationAddress` plus `ancestor_life_events` can drive map/location views, but `family_tree` historical context currently cross-joins `family_lineage` to `atlas_events` by years and broad location/tribal hints.
- Duplicate detection: `artifacts/api-server/src/routes/lineage/duplicates.ts` scans `family_lineage` and merges relationship arrays, but does not consult `gedcom_staging`, `family_units`, `ancestor_life_events`, `ancestor_media`, or source citations.

## 2. Field coverage table

| Field | Parsed from GEDCOM | Staged | Persisted to `family_lineage` | Dedicated table | Exposed to consumers | Status |
|---|---:|---:|---:|---:|---:|---|
| Full name | Yes | Yes | Yes | No | Yes | Preserved |
| Given/surname | Yes | Yes | Yes (`firstName`/`lastName`) | No | Partial | Preserved |
| Birth date | Yes | Yes | Single approve yes; direct import yes; bulk staged insert currently omits `birthDate` | `ancestor_life_events` yes | Family-tree card yes | Partially lost in bulk staged insert |
| Birth year | Yes | Yes | Yes | `ancestor_life_events` yes | Yes | Preserved |
| Birth location | Yes | Yes | Single approve/direct import yes; bulk staged insert only writes into notes/locationAddress, not `birthPlace` | `ancestor_life_events` yes | Family tree/KOS/Atlas partial | Partially lost in bulk staged insert |
| Death date | Yes | Yes | Single approve yes; direct import yes; bulk staged insert omits `deathDate` | `ancestor_life_events` yes | Family-tree card yes | Partially lost in bulk staged insert |
| Death year | Yes | Yes | Yes | `ancestor_life_events` yes | Yes | Preserved |
| Death location | Yes | Yes | Single approve/direct import yes; bulk staged insert only writes notes/locationAddress, not `deathPlace` | `ancestor_life_events` yes | Family tree/KOS/Atlas partial | Partially lost in bulk staged insert |
| Burial place | Yes | Via `lifeEvents` | Single approve yes; direct import yes; bulk staged insert omits | `ancestor_life_events` yes | Limited | Partially lost in bulk staged insert |
| Gender | Yes | Yes | Yes | No | Relationship/UI partial | Preserved |
| Notes | Yes | Yes | Yes, merged into `notes` | No | Some consumers | Preserved but unstructured |
| Source citations | Text SOUR only | Yes (`sourceRecords`) | Flattened into `notes` on lineage row | No source table | Not queryable as citations | Transformed/lost structurally |
| Media/photo refs | Yes (`OBJE`) | Yes (`mediaRefs`) | `photoFilename` only for profile-ish/default ref | `ancestor_media` yes | Family tree uses `photoUrl`, not `photoFilename`; profile uses member photo | Partially disconnected |
| Residence events | Yes | Yes | Only best place becomes `locationAddress` if empty | `ancestor_life_events` yes | Atlas/event consumers partial | Preserved but under-exposed |
| Marriage event date/place | Individual MARR and FAM MARR parsed | Individual events staged; FAM marriage parsed in parser | Not on `family_lineage`; not in `family_units` schema | Individual `ancestor_life_events` only | Not fully exposed | Partially lost |
| GEDCOM individual ID | Yes | Yes | Not stored on `family_lineage` | No | Not exposed after approval except staging | Lost after approval |
| GEDCOM family ID | Yes | Direct import family_units yes | No person field | `family_units.gedcomFamId` only in direct import | Family-unit API yes | Path-dependent |
| Family-unit membership | FAM records | Direct import only | Flat arrays yes | `family_units` direct import only | Family tree/relationship APIs | Missing in staged approval |

## 3. Relationship coverage table

| Relationship | Current storage | Current inference/exposure | Coverage | Gap |
|---|---|---|---|---|
| Biological parent/child | `parentIds`/`childrenIds`; direct import `family_units.relationshipType = biological` | Family tree and relationship API | Partial | Staged GEDCOM does not create `family_units`; edge has no per-parent type |
| Spouse/marriage | `spouseIds`; `family_units` husband/wife/spouse IDs in direct import | Family tree edges mostly parent-child; relationship API spouse | Partial | No marriage date/place on family unit; multiple marriages lack chronology/status |
| Children | `childrenIds`; FAM `childIds` direct import | Family tree and relationship API | Partial | Reciprocal integrity depends on importer/path |
| Full siblings | `siblingIds` direct import; inferred from same full parent set or FAM child list | Relationship API | Partial | Staged GEDCOM parses siblingGedcomIds but does not write `siblingIds` |
| Half siblings | Not explicit | Sometimes inferred incorrectly/omitted | Weak | `sameIdSet()` requires identical parent sets, so half siblings are not represented |
| Adoptive parents | No edge subtype | Not represented | Missing | GEDCOM ADOP/FAMC PEDI not parsed/stored |
| Step parents | No edge subtype | Not represented | Missing | No relationship edge table or step-family semantics |
| Raised-by/guardian | No edge subtype | Not represented | Missing | No GEDCOM/custom event mapping |
| In-law | Protection badges have in-law/affiliate levels; no relationship edge | Relationship API does not derive in-law graph except spouse/children | Weak | In-laws need spouse-family expansion rules |
| Duplicate ancestor merges | Duplicate routes merge arrays and archive/delete | UI supports merge | Risky | No source-aware/confidence-aware merge history; family_units not rewritten in duplicate merge |

## 4. Event coverage table

| Event/source/media type | Parser support | Staging support | Canonical storage | Consumer exposure | Status |
|---|---:|---:|---:|---:|---|
| Birth | Yes | Yes | `family_lineage` + `ancestor_life_events` | Tree cards, KOS, Atlas context | Mostly preserved |
| Christening | Yes | Yes | `ancestor_life_events` only | Limited | Under-exposed |
| Death | Yes | Yes | `family_lineage` + `ancestor_life_events` | Tree cards, KOS, Atlas context | Mostly preserved |
| Burial | Yes | Yes | `burialPlace` in single/direct; `ancestor_life_events` | Limited | Partially preserved |
| Residence | Yes | Yes | `ancestor_life_events`; sometimes `locationAddress` | Atlas/location partial | Preserved but under-exposed |
| Marriage | Yes | Yes for individual MARR; FAM MARR parsed but not stored in family_units | `ancestor_life_events` for individual MARR only | Limited | Partially lost |
| Census labels | Heuristic from notes/residence/source text | Yes | `lineageTags` | KOS/eligibility partial | Transformed |
| Sources/citations | SOUR text only, no source record graph | Yes | Flattened into notes | Not separately queryable | Structurally lost |
| Media/photos | OBJE FILE/FORM/TITL | Yes | `ancestor_media`; profile-ish filename in `family_lineage.photoFilename` | Not broadly surfaced from `ancestor_media` | Disconnected |
| Latitude/longitude | Not GEDCOM parsed | No | `family_lineage.locationLat/Lng` can exist manually | Map consumers | Missing from import |

## 5. Known gaps and exact files/functions causing them

1. Two GEDCOM import paths preserve different data.
   - Rich staged path: `parseGedcom()` and `writeLifeEventsAndMedia()` preserve events/media but do not create family units.
   - Direct path: `parseGedcomFamilies()` and `/api/lineage/import` create family units/siblings but do not preserve rich source/media/event data.

2. Bulk staged approval loses vital date/place columns that single approval preserves.
   - In `artifacts/api-server/src/routes/ancestry/gedcom.ts`, the single insert branch writes `birthDate`, `birthPlace`, `deathDate`, `deathPlace`, and `burialPlace`; the bulk insert branch writes only years and note/location fallbacks.

3. GEDCOM individual IDs do not survive into `family_lineage`.
   - `gedcom_staging.gedcomId` exists, but `family_lineage` has no `gedcomId`/metadata field. After approval, dedupe/link repair cannot prove source identity without staging rows.

4. Family units are path-dependent.
   - `/api/lineage/import` inserts `family_units` and sibling IDs; `/api/ancestry/gedcom/staging/*/approve` only patches flat relationship arrays.

5. Relationship arrays lack edge semantics.
   - `family_lineage.parentIds`, `childrenIds`, `spouseIds`, and `siblingIds` cannot encode biological/adoptive/step/raised-by/in-law/confidence/source/family-unit membership per edge.

6. Relationship inference assumes ordered parents and complete reciprocal arrays.
   - `lineage/relationships.ts` treats `rootParents[0]` as father/paternal and `rootParents[1]` as mother/maternal, and full-sibling inference requires identical parent sets.

7. Duplicate detection is not evidence-based enough.
   - `lineage/duplicates.ts` groups by normalized name and birth year and merges flat arrays, but does not score sources, locations, family units, GEDCOM IDs, events, spouses, children, or media, and does not rewrite `family_units` references.

8. Source citations are flattened into notes.
   - Staged `sourceRecords` become prose inside `family_lineage.notes`; this prevents evidence-grade citation filtering, display, and duplicate scoring.

9. Media is stored but not consistently exposed.
   - `ancestor_media` is written by staged approval, while tree/profile cards mainly use `photoUrl`/member profile photo fields. GEDCOM `photoFilename` is not equivalent to a web-displayable URL.

10. Knowledge-of-Self sees curated lineage/historical context, not the full GEDCOM event/source/media graph.
    - `family-tree/index.ts` joins lineage rows to historical events and returns `ancestral_records`/narratives, but not `ancestor_life_events`, `ancestor_media`, or structured citations.

## 6. Safe patch plan before Focus View

Phase 0 — keep rendering frozen:
- Do not implement Focus View or change visual layout until source data is canonicalized.
- Keep Gramps/reference renderers separate from lineage/family-unit renderers.

Phase 1 — data preservation fixes, no schema migration if possible:
1. Make staged bulk approval write the same `family_lineage` vital fields as single approval: `birthDate`, `birthPlace`, `deathDate`, `deathPlace`, `burialPlace`, and `photoFilename`.
2. Make staged approval create/update `family_units` from staged GEDCOM family relationships, or route staged approvals through the same family-unit creation helper used by `/api/lineage/import`.
3. Ensure staged approval writes `siblingIds` from `siblingGedcomIds` or from FAM child groups.
4. Preserve `sourceRecords` in a structured place available to consumers, even if temporarily duplicated in `ancestral_records.metadata` before a dedicated citation table exists.
5. Expose `ancestor_life_events` and `ancestor_media` through lineage/person detail APIs used by Knowledge-of-Self and person cards.

Phase 2 — integrity audit tooling:
1. Add a read-only admin audit endpoint/script that reports missing reciprocal links, family-unit references to missing nodes, approved staging rows with no family unit, staged source/media rows not written to dedicated tables, and duplicate rows with conflicting evidence.
2. Add SQL checks for named problem cases after live data access is available.
3. Do not auto-merge or auto-repair until reports are reviewed.

Phase 3 — schema migration proposal only after preservation fixes:
1. Add a relationship-edge table for `{personId, relatedPersonId, relationshipType, subtype, familyUnitId, sourceType, sourceRef, confidence}`.
2. Add structured source/citation records tied to lineage nodes/events/family units.
3. Add GEDCOM external identifiers at person and family levels.

Phase 4 — Focus View after data is reliable:
- Build Focus View against canonical node + edge + family-unit APIs, with expandable relationship groups and no all-person render by default.
