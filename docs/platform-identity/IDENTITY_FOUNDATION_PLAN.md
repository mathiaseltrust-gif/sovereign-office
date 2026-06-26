# Platform Identity Foundation Plan

## Principle
All modules consume one authenticated platform identity. No module owns a separate identity system.

## Identity Chain
Session -> User -> Profile -> Member/Beneficiary -> Genealogy Person -> Household -> Module Permissions

## Modules
- Office
- Atlas
- Family Tree
- Community
- Trust
- Authority
- Business
- Court
- Medical
- Education
- Companion
- Governor Intelligence

## Required Resolver Output
CurrentPlatformIdentity:
- userId
- email
- name
- roles
- permissions
- profileId
- memberId
- beneficiaryId
- personId
- householdId
- activeModule
- authSource
- tokenSource

## Rules
1. Atlas does not authenticate independently.
2. Family Tree does not authenticate independently.
3. Community does not authenticate independently.
4. Each module asks the platform identity resolver who the user is.
5. Missing profile/member/person links must be explicit, not silently guessed.

## Progressive Identity Completion

A user may enter the platform from different angles:
- invited member account
- trustee-created account
- lineage enrollment
- household creation
- community dashboard
- profile onboarding
- Atlas/family history access
- officer-created beneficiary record

Therefore Platform Identity must not assume all records already exist.

## Identity States
- complete
- profile_pending
- member_pending
- beneficiary_pending
- lineage_pending
- household_pending
- guest_limited

## Rule
Missing links are valid states, not errors. The resolver must return missing links explicitly and provide allowed next actions.

## Example
A newly logged-in member may have:
- userId
- email
- basic role

but may not yet have:
- profileId
- personId
- householdId
- verified beneficiary status

Atlas must not guess the person record. Family Tree must offer linking or creation. Community must guide onboarding.
