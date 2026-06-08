# Active Task Plan — Gramps + Land Document Backbone

Created for the next implementation pass.

## Objective

Replace the custom kinship renderer with a Gramps/Gramps-Web based genealogy subsystem, while preserving Sovereign Office as the governance, document intelligence, trust, NFR, and Companion orchestration layer.

Also repair the land-management visibility problem so protected land appears in Land & Asset Management and deed/trust scans automatically route into land documents.

## Track 1 — Gramps / Gramps-Web Integration

### Goal
Use Gramps as the genealogy data model and Gramps Web as the visual and interactive family-tree layer.

### Tasks
1. Add a dedicated Gramps service to production compose or a companion compose override.
2. Add a Gramps bridge service that can export current `family_lineage` records into Gramps-compatible data.
3. Preserve Sovereign Office as the source of truth for:
   - member numbers
   - member claim status
   - tribal roles
   - protected lineage tags
   - treaty/protection markers
   - trust-beneficiary status
4. Use Gramps/Gramps-Web for:
   - pedigree charts
   - fan charts
   - descendant trees
   - family groups
   - spouse/children relationship views
   - source/citation display
   - GEDCOM compatibility
5. Embed or link Gramps Web inside Sovereign Office at `/kinship-tree` after testing.

### Non-negotiables
- Do not replace Sovereign Office authentication without review.
- Do not make Gramps the authority for tribal membership numbers.
- Do not let ancestors consume tribal member IDs.
- Do not overwrite family_lineage until bridge reconciliation is reviewed.

## Track 2 — Land Visibility Repair

### Goal
Ensure the known trust land appears in Land & Asset Management.

### Known parcel facts
- Parcel Number: 514-364-11-6
- ATN: 514-364-11-00-1
- Prior APN: 514-300-03
- Legal description: Lot 52 of Tract 5958 PH2
- Core status: tribal trust / protected land / contested jurisdiction
- Known recorded instruments:
  - 223085433
  - 223135016
  - 224042175

### Tasks
1. Inspect the `land_parcels` table and the Land page API filters.
2. Confirm whether the parcel exists but is hidden by status/filter/field mismatch.
3. If missing, add a safe upsert script that inserts the protected parcel without deleting or resetting anything.
4. Add aliases so parcel/ATN/prior APN all resolve to the same land record.
5. Ensure `land_parcels` links to court documents, encumbrances, and scanned instruments.

## Track 3 — Document Nervous System

### Goal
Turn scan/OCR/classification into action.

### Existing foundation
The intake classify route already maps deed/trust/foreclosure/tax/recorder documents into land, court, encumbrance, and NFR targets.

### Tasks
1. Add document-intelligence visible response object called `companionSummary`.
2. Add `recommendedActions` from the classifier.
3. Add `provisionsApplied` from document type and extracted fields.
4. Improve encumbrance typing:
   - deed_of_trust → deed_of_trust_encumbrance
   - mortgage_security_instrument → mortgage_security_instrument
   - tax_lien → tax_lien
   - foreclosure → foreclosure_notice
5. Ensure apply-filing creates or links:
   - land parcel
   - court document
   - encumbrance
   - NFR signal when applicable
6. Add front-end display later so Companion visibly says what the scan is and what happens next.

## Track 4 — Safe deployment sequence

1. Push code only.
2. Pull on VM.
3. Deploy API first.
4. Verify `/api/healthz`.
5. Run land inspection SQL.
6. Apply land upsert only if missing.
7. Deploy frontend only after route compiles.
8. Do not reset DB.
9. Do not change routing rewrites.
10. Preserve `stable-routes-ok-2026-06-07` behavior.
