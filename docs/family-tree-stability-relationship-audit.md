# Family Tree Stability & Relationship Audit

Date: 2026-06-19
Scope: `artifacts/sovereign-dashboard/src/pages/family-tree.tsx`, lineage schema, GEDCOM relationship import, duplicate detection, and relationship inference. Community, Atlas, AI, Gateway, Auth, and unrelated services were not modified.

## 1. Root cause analysis

### Primary cause: the visual tree is no longer using `family_lineage` as its primary data source
`InteractiveTreeTab` fetches `/api/gramps/people?pagesize=5000` and `/api/gramps/families?pagesize=5000`, then synthesizes numeric node IDs from array order (`idx + 1`). This bypasses persisted `family_lineage.id`, `linkedProfileUserId`, GEDCOM lineage IDs, stored `generationalPosition`, and `family_units`. The result is an in-memory Gramps graph that is not ID-compatible with the lineage/family-unit graph.

Consequences:
- `linkedProfileUserId` is absent on synthesized Gramps nodes, so self-resolution falls through to hard-coded IDs/names.
- `familyUnits` fetched from `/api/lineage/family-units` references persisted `family_lineage.id` values, but rendered nodes use transient Gramps array IDs.
- GEDCOM-imported parent/child/spouse relationships written to `family_lineage` are ignored by the default visual data source.
- Any known test case by lineage ID (Mathew #890, Brenda #37, Allen Watson duplicates) cannot be reliably validated in this view because the rendered IDs are not lineage IDs.

### Secondary cause: default depth filtering intentionally hides most nodes
The default `generationDepth` is `2`, so only household plus parents/grandparents-adjacent traversal is visible unless the user changes to full tree. This can make an 802+ person dataset render as a small subset even when relationships are present.

### Secondary cause: connected-node filtering removes isolated or ID-mismatched people
`connectedNodes` filters `filteredNodes` down to nodes with at least one parent, child, spouse, or family-unit membership in the current node ID set. This is reasonable for a clean graph, but harmful when ID spaces are mixed because legitimate lineage nodes/family units do not match synthesized Gramps IDs.

### Secondary cause: paternal/maternal side detection assumes ordered `parentIds`
`computeLayout`, `computePedigreeLayout`, `buildFanEntries`, and relationship inference treat `parentIds[0]` as father/paternal and `parentIds[1]` as mother/maternal. If import order is missing, reversed, adoptive, step, or not normalized by gender/relationship type, branches appear swapped, collapsed, disconnected, or absent.

### Compile/runtime stability finding
`computeLayout.tagSubtree()` currently contains a duplicate `const n = byId.get(cur);` declaration in the same block. TypeScript should reject this file before deployment. If a stale build is running, this is still a red-flag merge artifact in the exact family-tree rendering function.

## 2. Relationship audit report

### Current persistence model
- `family_lineage` supports `parentIds`, `childrenIds`, `spouseIds`, `siblingIds`, `linkedProfileUserId`, and `generationalPosition`.
- `family_units` supports `husbandId`, `wifeId`, additional `spouseIds`, `childIds`, `relationshipType`, and `sourceType`.
- The schema does not distinguish biological/adoptive/step parentage per parent-child edge. `family_units.relationshipType` can describe a family unit, but `parentIds` cannot tell whether each parent edge is biological, adoptive, step, foster, or inferred.

### GEDCOM imports
GEDCOM staging approval links approved records by resolving GEDCOM IDs and merging `parentIds`, `childrenIds`, and `spouseIds` into `family_lineage`. This is the correct canonical path, but the visual tree currently fetches Gramps endpoints instead of `/api/lineage` or `/api/family-tree`, so those persisted links may not render.

### Relationship inference limits
The relationship route can infer self, parent, child, spouse, sibling, aunt/uncle, cousin, niece/nephew, household, and collateral relationships. It does not explicitly model half siblings, step parents, adoptive parents, in-laws beyond spouse/family-unit adjacency, multiple marriage chronology, or duplicate-ancestor collapses.

### Known test cases requiring database-backed verification
These require live SQL/API audit because the repository does not include the production rows:
- Mathew (#890): verify whether #890 exists in `family_lineage`, whether it has `linkedProfileUserId`, and whether rendered self-resolution can find it.
- Brenda (#37): verify `parentIds`, spouse/family-unit membership, and whether #37 appears in the selected focus person's visible neighborhood.
- Cornella gender correction: verify persisted gender and whether paternal/maternal assignment uses gender-aware parent classification instead of array order.
- Steve biological vs adopted parents: current schema cannot safely represent both edge types without edge metadata; using one flat `parentIds` array will blur biological/adoptive parents.
- Allen Watson duplicate review: current duplicate scan is mostly name/birth-year based and does not score GEDCOM IDs, locations, spouses, children, or family units.

## 3. Rendering audit report

### `filteredNodes`
`filteredNodes` applies search, protection, pending-review, depth, and member-access filters. The two important filters for missing branches are:
- `depthVisibleIds`, defaulting to `generationDepth = 2`.
- `memberAccessFilter`, which restricts non-privileged users to their own connected lineage path.

### `connectedNodes`
`connectedNodes` excludes every node that lacks visible parent/child/spouse links or visible family-unit membership. This can drop valid standalone imported ancestors, family members whose reciprocal links are incomplete, and all family-unit records whose IDs do not match the rendered node source.

### `treeNodes`
`treeNodes` is exactly `connectedNodes`, so all downstream layouts inherit the filtered subset rather than the full data source.

### `computeLayout()`
Issues:
- Assumes ordered `parentIds` for paternal/maternal classification.
- Supplements parent lookup from `familyUnits`, but only if family-unit IDs match current node IDs.
- Contains duplicate `const n` declaration in `tagSubtree()`.
- Defaults untagged nodes to paternal, masking unknown/disconnected lines rather than reporting them.

### `computePedigreeLayout()`
Issues:
- Also assumes `parentIds[0]` father and `parentIds[1]` mother.
- Builds only an ancestor chart for one root, so spouses, children, siblings, half siblings, step family, and in-laws are intentionally excluded.
- Uses recursion with a copied `seen` set, which avoids simple cycles per branch, but duplicate ancestor merges can appear in multiple branches.

### `buildFanEntries()`
Issues:
- Uses only `parentIds`; `family_units` parent-child links are ignored.
- Uses a global `seen` set, so a duplicate/collapsed ancestor already seen through one branch can disappear from another branch.
- Same parent-order assumption as above.

### Maximum call stack hypothesis
The current shown functions mostly use BFS or bounded recursion. The likely stack-risk area is `d3.hierarchy()` if the recursive `buildHier()` receives cyclic or duplicate ancestor structures that are not fully guarded, or if a different rendering helper recursively walks `_parents/_children/_spouses`. The immediate compile blocker is the duplicate `const n`; after that is fixed, add cycle diagnostics before calling layout.

## 4. Proposed future architecture: Ancestry-style Focus View

Render a small ego network around a selected person instead of all 802+ people.

### Canonical graph layer
Create a normalized relationship graph from persisted lineage data:
- Node table: people keyed by stable `family_lineage.id` plus GEDCOM metadata.
- Edge table/view: relationship edges with `{fromId, toId, type, subtype, source, confidence, familyUnitId}`.
- Derived indexes: parentsByChild, childrenByParent, spousesByPerson, familyUnitsByPerson, siblingsByPerson.

### Focus expansion API/UI
For selected person, fetch/render configurable relationship groups:
- parents
- spouse(s)
- children
- siblings
- half siblings
- adoptive relationships
- step family
- in-laws
- nieces/nephews

Each group should be expandable/collapsible and paginated/virtualized. The default render should show the selected person and first-degree relationships, with branch chips for maternal, paternal, adoptive, step, and in-law groups.

### Layout strategy
- Pedigree/fan views: ancestors only, with explicit maternal/paternal slots and relationship type labels.
- Family focus view: ego network layout around selected person.
- Full graph/audit view: admin-only, virtualized and diagnostic, not the default member experience.

## 5. Safe patch plan

Phase 0 — diagnostics only:
1. Add an admin-only relationship audit endpoint or SQL script that reports total nodes, connected components, orphan counts, family-unit counts, missing reciprocal links, self-cycles, parent cycles, and family-unit ID mismatches.
2. Add UI debug counters for raw nodes, filtered nodes, connected nodes, family units, selected root, and active filters.

Phase 1 — minimal stability fix:
1. Fix the duplicate `const n` declaration in `computeLayout()`.
2. Stop mixing Gramps transient IDs with persisted lineage/family-unit IDs in the same render path.
3. If Gramps remains the visual source, convert Gramps family records into local family units and do not combine them with `/api/lineage/family-units`.
4. If lineage is canonical, restore `/api/lineage/nodes` or `/api/family-tree` as the visual data source and use `/api/lineage/family-units` with matching IDs.

Phase 2 — relationship correctness:
1. Add relationship-edge metadata for biological/adoptive/step/in-law/guardian links.
2. Classify paternal/maternal parents by explicit edge role or gender metadata, not array position.
3. Add reciprocal-link repair tooling: parentIds ↔ childrenIds and spouseIds ↔ spouseIds.
4. Extend duplicate matching to evidence-based scoring.

Phase 3 — focus view:
1. Build selected-person focus state and neighborhood query.
2. Render expandable relationship groups instead of rendering the whole graph.
3. Keep full-tree rendering as an admin diagnostic view only.

## 6. Exact files requiring modification

Minimal files:
- `artifacts/sovereign-dashboard/src/pages/family-tree.tsx` — fix duplicate declaration, repair data-source mixing, add debug counters, and pass preferred root to pedigree/fan builders consistently.

Likely follow-up files:
- `artifacts/api-server/src/routes/lineage/nodes.ts` — add audit payload or canonical focus-neighborhood response.
- `artifacts/api-server/src/routes/lineage/family-units.ts` — expose normalized family-unit diagnostics if needed.
- `artifacts/api-server/src/routes/lineage/relationships.ts` — expand relationship kinds and edge metadata handling.
- `artifacts/api-server/src/routes/lineage/duplicates.ts` — replace name-first matching with evidence-based scoring.
- `lib/db/src/schema/family-lineage.ts` — add a normalized relationship-edge table if biological/adoptive/step relationships must coexist safely.

## 7. Exact commands to test before deployment

```bash
pnpm --filter @workspace/sovereign-dashboard typecheck
pnpm --filter @workspace/api-server typecheck
pnpm typecheck
pnpm --filter @workspace/sovereign-dashboard build
```

Optional live-data audit SQL once connected to the deployment database:

```sql
select count(*) as total_nodes from family_lineage where coalesce(source_type, '') <> 'archived';
select count(*) as family_unit_count from family_units;
select count(*) as orphan_nodes
from family_lineage n
where coalesce(source_type, '') <> 'archived'
  and jsonb_array_length(coalesce(n.parent_ids, '[]'::jsonb)) = 0
  and jsonb_array_length(coalesce(n.children_ids, '[]'::jsonb)) = 0
  and jsonb_array_length(coalesce(n.spouse_ids, '[]'::jsonb)) = 0;
```
