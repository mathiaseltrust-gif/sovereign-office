#!/usr/bin/env bash
set -euo pipefail

cd "${1:-$HOME/sovereign-office}"

echo "== Sovereign Office safe patch starting =="
echo "Repo: $(pwd)"

git status --short

BRANCH="kinship-and-document-router-$(date +%Y%m%d-%H%M)"
git checkout -b "$BRANCH"
echo "Created branch: $BRANCH"

mkdir -p scripts

cat > scripts/document-intelligence-router-plan.md <<'PLAN'
# Document Intelligence Router — Implementation Plan

Purpose: when a scanned/uploaded document enters the Office, classify it, extract structured facts, link it to the correct person/parcel/trust/case, preserve evidence, and trigger review engines when needed.

Document subtypes to support:
- deed_of_trust
- trust_instrument
- trust_declaration
- grant_deed
- correction_deed
- quitclaim_deed
- mortgage_security_instrument
- notice_of_default
- foreclosure_notice
- tax_lien
- recorder_notice
- tribal_court_order
- protective_order
- identity_document
- ancestry_record
- household_record
- court_document
- nfr_notice
- other_unknown

Required deed/trust fields:
- apn, atn, parcelId, propertyAddress, legalDescription
- recordingNumber, recordingDate, instrumentNumber, county
- grantor, grantee, borrower/trustor, trustee, beneficiary/lender, servicer
- documentTitle, executionDate, notaryDate, trustName, trustRole
- lienIndicators, encumbranceIndicators

Routing:
- deed_of_trust -> land_parcel + encumbrance + trust/case evidence + NFR trigger
- trust_instrument/trust_declaration -> trust_instrument + trust dashboard + evidence
- grant_deed/correction_deed/quitclaim_deed -> land_parcel + title chain + evidence
- notice_of_default/foreclosure_notice -> land_parcel + encumbrance + NFR trigger + calendar deadline
- tax_lien -> land_parcel + encumbrance + NFR trigger
- recorder_notice -> land_parcel + recorder review + NFR trigger
- ancestry_record/household_record -> lineage import/review
- identity_document -> profile vault

Safety rule: do not overwrite final records automatically. Store extracted facts as pending review if confidence or matching is uncertain.
PLAN

python3 <<'PY'
from pathlib import Path

p = Path('artifacts/api-server/src/routes/intake/classify-route.ts')
s = p.read_text()
orig = s

repls = {
'  deed:                      "Property Deed",': '''  deed:                      "Property Deed",
  deed_of_trust:              "Deed of Trust",
  trust_instrument:           "Trust Instrument",
  grant_deed:                 "Grant Deed",
  correction_deed:            "Correction Deed",
  quitclaim_deed:             "Quitclaim Deed",
  mortgage_security_instrument:"Mortgage / Security Instrument",
  recorder_notice:            "Recorder Notice",
  ancestry_record:            "Ancestry / Lineage Record",
  household_record:           "Household Record",''',

'  deed:                      null,': '''  deed:                      null,
  deed_of_trust:              "UNAUTHORIZED_LAND_ENCUMBRANCE",
  trust_instrument:           "TRUST_RESPONSIBILITY_BREACH",
  grant_deed:                 null,
  correction_deed:            null,
  quitclaim_deed:             null,
  mortgage_security_instrument:"UNAUTHORIZED_LAND_ENCUMBRANCE",
  recorder_notice:            "RECORDER_REFUSAL",
  ancestry_record:            null,
  household_record:           null,''',

'  deed:                      ["land_parcel", "court_document"],': '''  deed:                      ["land_parcel", "court_document"],
  deed_of_trust:              ["land_parcel", "encumbrance", "trust_instrument", "nfr_investigation", "court_document"],
  trust_instrument:           ["trust_instrument", "court_document"],
  trust_declaration:          ["trust_instrument", "court_document"],
  grant_deed:                 ["land_parcel", "court_document"],
  correction_deed:            ["land_parcel", "court_document"],
  quitclaim_deed:             ["land_parcel", "court_document"],
  mortgage_security_instrument:["land_parcel", "encumbrance", "nfr_investigation", "court_document"],
  recorder_notice:            ["land_parcel", "nfr_investigation", "court_document"],
  ancestry_record:            ["lineage_record", "court_document"],
  household_record:           ["lineage_record", "court_document"],'''
}

for old, new in repls.items():
    if old in s and new not in s:
        s = s.replace(old, new)

old_block = '''  if (probe.includes("warranty deed") || probe.includes("quitclaim") ||
      probe.includes("trust deed") || probe.includes("deed of trust") ||
      probe.includes("grant deed") || probe.includes("special warranty"))
    return "deed";'''

new_block = '''  if (probe.includes("deed of trust") || probe.includes("trust deed"))
    return "deed_of_trust";
  if (probe.includes("declaration of trust") || probe.includes("trust instrument") || probe.includes("trust agreement"))
    return "trust_instrument";
  if (probe.includes("correction deed") || probe.includes("corrective deed"))
    return "correction_deed";
  if (probe.includes("quitclaim"))
    return "quitclaim_deed";
  if (probe.includes("grant deed"))
    return "grant_deed";
  if (probe.includes("mortgage") && (probe.includes("security instrument") || probe.includes("lien")))
    return "mortgage_security_instrument";
  if (probe.includes("warranty deed") || probe.includes("special warranty"))
    return "deed";'''

if old_block in s:
    s = s.replace(old_block, new_block)

old_enum = '"documentType": "one of: board_of_review_petition | received_stamp | certificate_of_record | tax_notice | tax_lien | foreclosure | deed | court_order | complaint | icwa_notice | identity_document | trust_declaration | nfr | jurisdictional_statement | other",'
new_enum = '"documentType": "one of: board_of_review_petition | received_stamp | certificate_of_record | tax_notice | tax_lien | foreclosure | deed | deed_of_trust | trust_instrument | trust_declaration | grant_deed | correction_deed | quitclaim_deed | mortgage_security_instrument | recorder_notice | court_order | complaint | icwa_notice | identity_document | ancestry_record | household_record | nfr | jurisdictional_statement | other",'

if old_enum in s:
    s = s.replace(old_enum, new_enum)

old_hint = '  "extractedFields": {'
if old_hint in s and '"apn": "string|null"' not in s:
    s = s.replace(old_hint, '''  "extractedFields": {
    "apn": "string|null",
    "atn": "string|null",
    "parcelId": "string|null",
    "propertyAddress": "string|null",
    "legalDescription": "string|null",
    "recordingNumber": "string|null",
    "recordingDate": "string|null",
    "instrumentNumber": "string|null",
    "county": "string|null",
    "grantor": "string|null",
    "grantee": "string|null",
    "trustor": "string|null",
    "trustee": "string|null",
    "beneficiary": "string|null",
    "lender": "string|null",
    "servicer": "string|null",
    "trustName": "string|null",
    "encumbranceIndicators": [],''', 1)

if s != orig:
    p.write_text(s)
    print('Patched classify-route.ts')
else:
    print('No classify-route.ts changes made; patterns may already differ')
PY

cat > scripts/inspect-collateral-kin.sql <<'SQL'
-- Collateral kin inspection: father/mother siblings through shared parent_ids.
-- Known current linked profile node has been id 12 in production.

WITH self AS (
  SELECT id, full_name, parent_ids
  FROM family_lineage
  WHERE linked_profile_user_id = 1 OR id = 12
  ORDER BY CASE WHEN linked_profile_user_id = 1 THEN 0 ELSE 1 END
  LIMIT 1
), parents AS (
  SELECT p.id, p.full_name, p.parent_ids,
         row_number() OVER () AS parent_order
  FROM self s
  JOIN family_lineage p ON p.id IN (
    SELECT jsonb_array_elements_text(s.parent_ids)::int
  )
), parent_siblings AS (
  SELECT
    p.id AS parent_id,
    p.full_name AS parent_name,
    sib.id AS relative_id,
    sib.full_name AS relative_name,
    CASE
      WHEN p.parent_order = 1 THEN 'paternal_parent_sibling'
      WHEN p.parent_order = 2 THEN 'maternal_parent_sibling'
      ELSE 'parent_sibling'
    END AS collateral_category,
    sib.gender
  FROM parents p
  JOIN family_lineage sib ON sib.id <> p.id
  WHERE p.parent_ids IS NOT NULL
    AND p.parent_ids <> '[]'::jsonb
    AND sib.parent_ids = p.parent_ids
)
SELECT * FROM parent_siblings ORDER BY parent_id, relative_name;
SQL

cat > scripts/collateral-kin-plan.md <<'PLAN'
# Collateral Kin Visibility Plan

Category terms:
- collateral_relative
- parent_sibling
- paternal_aunt / paternal_uncle
- maternal_aunt / maternal_uncle
- sibling_group
- extended_kin

Rule:
For the authenticated member, find parents. For each parent, find all nodes sharing that parent's parent_ids. Exclude the parent. Those records are the parent's brothers and sisters.

Views:
- Parent View: self + parents only.
- Household View: self + spouse + children.
- Pedigree/Fan: direct ancestors only.
- Kinship View: self, parents, siblings, spouse, children, aunts/uncles, cousins, household.

Do not delete or hide collateral relatives. If not shown in pedigree/fan, keep them visible in Kinship View and person detail.
PLAN

cat > scripts/SAFE_PATCH_NOTES.md <<'NOTES'
# Safe Patch Notes

This branch does not reset the database and does not alter Docker routing.

Before merging:
1. Run TypeScript/build checks.
2. Test `/api/intake/classify-and-route` with deed of trust, trust instrument, grant deed, and ancestry records.
3. Run `scripts/inspect-collateral-kin.sql` against production DB to confirm parent sibling data.
4. Add a dedicated Kinship View UI after backend relationship data is verified.
NOTES

echo "== Diff summary =="
git diff --stat

echo "== Changed files =="
git status --short

echo "Next commands if the diff is acceptable:"
echo "  git add artifacts/api-server/src/routes/intake/classify-route.ts scripts/"
echo "  git commit -m 'Extend document router and add collateral kin inspection'"
echo "  git push origin HEAD"
