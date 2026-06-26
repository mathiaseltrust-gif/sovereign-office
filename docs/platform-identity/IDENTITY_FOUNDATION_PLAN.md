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
