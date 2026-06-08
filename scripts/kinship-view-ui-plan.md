# Kinship View UI Plan

Purpose: evolve the family tree from a strict pedigree display into an Ancestry-style kinship view using the Office data model.

## View modes

- Parent View: root person plus parents.
- Household View: root person, spouse or partner, children, and confirmed household members.
- Sibling View: root person and people sharing the same confirmed parent set.
- Aunts and Uncles View: siblings of each parent, grouped by paternal and maternal side.
- Cousins View: children of aunts and uncles.
- Direct Line View: root person and direct ancestors only.
- Fan View: direct ancestor fan, with repeated ancestors deduped where possible.
- Full Kinship View: combined view of direct line, household, siblings, aunts, uncles, cousins, nieces, nephews, and extended kin.

## Person card additions

Each person card should show compact relationship chips when data exists:

- Parent
- Child
- Spouse
- Sibling
- Uncle
- Aunt
- Cousin
- Household
- Ancestor
- Descendant

## Detail panel additions

When a person is selected, show relationship sections:

- Parents
- Spouse / Partner
- Children
- Siblings
- Aunts / Uncles
- Cousins
- Nieces / Nephews
- Household Links
- Source / Confidence

## Data source priority

1. Manually confirmed family_lineage links.
2. family_units household and GEDCOM family records.
3. GEDCOM / Ancestry import records.
4. Inferred relationship graph.

## Display safety

- Do not show source_type test records.
- Do not show visibility hidden records.
- Do not overwrite existing direct-line views.
- Add kinship views as optional toggles first.
