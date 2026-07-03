---
name: Role mapping gap — chief_justice_trustee
description: roleFromStrings in auth-provider.tsx must include ALL role strings from the JWT or they silently fall to "member"
---

# Rule
Every role string the API can issue in a JWT must have an explicit entry in BOTH `priority` and `ROLE_MAP` inside `roleFromStrings` (auth-provider.tsx). Missing entries get priority -1 which loses to "member" (30) in the sort — the user appears as a plain member even if their JWT says otherwise.

**Why:** `chief_justice_trustee` was absent, so users with that role had canEdit=false and no gov-section visibility on the hub despite being Chief Justice & Trustee. The bug is silent — no error, just wrong access level.

**How to apply:** Any time a new role string is added to the API (users table role column or JWT payload), update roleFromStrings in BOTH maps. Current known roles: chief_justice (→sovereign_admin), chief_justice_trustee (→trustee), admin (→sovereign_admin), sovereign_admin, trustee, officer, elder, medical_provider, member, visitor_media, guest.
