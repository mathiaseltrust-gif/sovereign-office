# Ancestry Bridge Plan

Purpose: bridge Ancestry/GEDCOM data into the existing Sovereign Office lineage system without copying Ancestry proprietary code.

## Safe principle

This plan mirrors observable behavior using owned/exported data:

- GEDCOM records
- Ancestry export data
- screenshots/PDFs as visual references
- existing family_lineage, family_units, ancestor tables

Do not scrape private Ancestry pages. Use user-provided exports and uploaded documents.

## Current database reality

The production lineage table contains family_lineage records, but the dedicated Ancestry staging tables may be empty until a GEDCOM/export is imported:

- gedcom_staging
- ancestors
- ancestor_relationships
- ancestor_life_events
- ancestor_media
- gedcom_import_batches

## Target pipeline

1. Import GEDCOM/Ancestry export into staging tables.
2. Normalize person records into ancestors.
3. Normalize FAM/spouse/child relationships into ancestor_relationships.
4. Bridge ancestors into family_lineage.
5. Bridge relationships into parent_ids, children_ids, sibling_ids, spouse_ids, and family_units.
6. Run relationship inference for collateral kin.
7. Render Ancestry-style views from normalized relationship graph.

## Target views

- Direct Line View: self and direct ancestors only.
- Parent View: self and parents.
- Household View: self, spouse, children, household members.
- Sibling View: self and sibling group.
- Collateral Kin View: aunts, uncles, cousins, nieces, nephews.
- Full Kinship View: all known relationship clusters.
- Fan View: ancestor fan with deduped repeated ancestors.
- Ancestry-style Vertical View: expanded branch view with siblings and spouse/child clusters.

## Relationship categories

- direct_ancestor
- descendant
- spouse
- sibling
- half_sibling
- parent_sibling
- paternal_aunt
- paternal_uncle
- maternal_aunt
- maternal_uncle
- cousin
- niece_nephew
- household_member
- collateral_relative
- extended_kin

## Safety rules

- Never overwrite manually confirmed family_lineage records without review.
- Prefer merge candidates with confidence scores.
- Keep source attribution from GEDCOM/Ancestry import.
- Mark inferred relationships as inferred until confirmed.
- Hidden/test records must stay hidden from member-facing lineage views.
