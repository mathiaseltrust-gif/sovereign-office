# Sovereign Office — Mathias El Tribe

Three-dashboard sovereign administration system for the Mathias El Tribe Supreme Court. Handles identity, trust instruments, welfare filings, court documents, family lineage, and community governance under inherent tribal sovereign authority.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port from $PORT env)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`, `AZURE_OPENAI_*`, `AZURE_ENTRA_*`, `REDIS_CONNECTION_STRING`

## Dashboards

| Artifact | Path | Purpose |
|---|---|---|
| sovereign-dashboard | `/sovereign-dashboard/` | Chief Justice & Trustee primary workspace |
| community-dashboard | `/community-dashboard/` | Member portal, community governance |
| trust-dashboard | `/trust-dashboard/` | Trust instruments and filings |
| api-server | (API only) | REST backend, PDF generation, identity gateway |

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 · DB: PostgreSQL + Drizzle ORM (lib/db)
- Auth: Microsoft Entra ID (OIDC/MSAL) + email/password dev fallback
- PDF: pdf-lib (server-side, no browser dependency)
- AI: Azure OpenAI (GPT-4o) via AZURE_OPENAI_* env vars
- Frontend: React 19 + Vite + Tailwind CSS 4 + shadcn/ui + TanStack Query

## Where things live

- `lib/db/src/schema/` — all Drizzle table definitions (source of truth for DB shape)
- `lib/db/migrations/` — SQL migration files (applied manually via psql or migrate.ts)
- `artifacts/api-server/src/routes/` — all Express route handlers
- `artifacts/api-server/src/lib/pdf-builder.ts` — all PDF generation (NFR, instruments, tribal ID, verification letters, GWE letters)
- `artifacts/api-server/src/lib/doc-ref.ts` — document reference number encoding/decoding
- `artifacts/api-server/src/sovereign/identity-gateway.ts` — SIG: resolves member identity, protection level, elder status, delegation
- `artifacts/api-server/src/sovereign/identity-engine.ts` — resolves identity for profile API
- `artifacts/api-server/src/sovereign/authority.ts` — ROLE_HIERARCHY (trustee=105 > admin=100 > officer=60 > ...)
- `artifacts/api-server/src/auth/entra-guard.ts` — requireAuth / requireAdmin middleware
- `artifacts/sovereign-dashboard/src/components/auth-provider.tsx` — DEV_USERS mapping (dev-only bypass)
- `artifacts/sovereign-dashboard/src/pages/profile.tsx` — unified profile + vault page

## Architecture Decisions

### Document Reference Numbers
Every generated document carries a structured reference number: `{TYPE}-{YYMMDD}-U{memberId:03d}-D{docId:04d}`.
Example: `NFR-260515-U006-D0042` = NFR doc #42, generated 2026-05-15, for member #6.
This encodes enough information to retrieve the document AND identify the associated member without a lookup table.
Types: `NFR`, `INST`, `GWE`, `VER`, `TID`, `WEL`, `CRT`.
Source: `artifacts/api-server/src/lib/doc-ref.ts`.

### Member Context in Documents
When a document is generated (PDF download), the route handler pulls the requesting/owning member's profile (name, title, family group) and vault address, then stamps the PDF footer with a Member Association block. If the member has `elevated` or `critical` protection level, a PROTECTED STATUS NOTICE is added to the document body.
Trust instruments with `userId` pull data for that specific member. NFR documents use the requesting user.

### Personal Information Vault
`profile_vault` table stores DOB, address, preferred contact method, contact email, and SSN — all as plaintext columns (encryption at the application/access-control layer). The vault API (`GET/PUT /api/user/vault`) **never returns actual field values** — only boolean presence flags (`hasDob`, `hasAddress`, `hasEmail`, `hasSsn`). The actual values are only read server-side for document generation. SSN is stripped to 9 digits. Email is required and validated.

### Identity Gateway (SIG)
`GET /api/identity/gateway` resolves the full member identity including protection level (`standard` | `elevated` | `critical`), elder status, delegated authorities, profile photo, and lineage summary. Used as the single source of truth for displaying member identity. Protection level comes from `family_lineage.protectionLevel`.

### Profile Photo Storage
Photos are stored as base64 data URLs directly in `family_lineage.photoUrl`. Upload goes through `POST /api/identity/photo`. The profile page and tribal ID card both read from the SIG gateway's `profilePhoto` field, which resolves: `linkedNode.photoUrl ?? lineageRows[0].photoUrl ?? profile.profilePhoto ?? null`.

### Role Hierarchy
`ROLE_HIERARCHY` in `authority.ts`: trustee=105 · admin=100 · officer=60 · elder=55 · member=10.
`requireAdmin` accepts any role with hierarchy ≥ 100 (trustee and above).
Chief Mathias El (user #6) has `trustee` role — this is above admin and can do everything.

### Dev Authentication
DEV_USERS in `auth-provider.tsx` maps role names to DB user accounts for local development. "Chief Justice & Trustee" and "Tribal Admin" both map to user #6 (`mmccaster@mathiaseltribe.org`). Microsoft Entra login only works in production (OIDC requires registered redirect URI).

### Trust Land & Protection Status
Documents involving members with `elevated` or `critical` protection level automatically receive a PROTECTED STATUS NOTICE citing 25 U.S.C. § 177, Worcester v. Georgia (1832), and tribal sovereignty. If the member has an address on file in their vault, it appears in the document address block.

### DB Migrations
Drizzle-kit `generate` has a path resolution bug when run outside `lib/db/`. Write SQL migrations manually to `lib/db/migrations/00XX_description.sql` and apply with `psql "$DATABASE_URL" -f lib/db/migrations/00XX_description.sql`. Then update `lib/db/migrations/meta/_journal.json`.

## Product

- **Profile & Identity**: unified profile page with AI-guided intake, profile photo upload, and Personal Information Vault (masked fields — never displayed in cleartext)
- **Tribal ID Card**: printable sovereign identity document with member photo, enrollment number, protection level, and verification QR code
- **Trust Instruments**: create, record, and download sovereign trust instruments as recorder-compliant PDFs
- **NFR Documents**: Notice of Federal Review — PDF documents citing applicable federal Indian law
- **Verification Letters**: multi-page identity verification letters with dual e-signatures, tribal seal, and lineage chain
- **GWE Letters**: General Welfare Exclusion letters per 25 U.S.C. § 117b / IRC § 139E
- **Family Lineage**: genealogical tree with Knowledge of Self narratives
- **Admin Portal**: manage members, roles, email addresses, and trust privileges
- **AI Intake**: voice-guided profile intake, AI chat assistant, learning preferences system
- **Court Docket**: welfare instruments, TRO/protection orders, ICWA notices, complaints

## Atlas Mode — Family / Ancestors / Locations (Urban Indian Continuity Atlas)

### Core principle: Atlas Mode is user-relative

The logged-in user's view is personal. Another member's view will differ. No user's relatives should automatically inherit the current user's location.

### Location resolution order (per family/ancestor record)

Apply in strict priority order — stop at the first match:

1. Known ancestry address or place record
2. Last known life location from ancestry data
3. Birth / residence / death / census location
4. Historical family/lineage location
5. Likely ancestral affiliation / likely homeland
6. **If none exists → mark as "Location unknown" — never default to the logged-in user's address**

Do not infer a location merely because the user currently lives there.

### Household vs. family vs. ancestors

| Group | Location behavior |
|---|---|
| Logged-in user's immediate household (self + spouse + children) | Default to user's current address unless manually updated |
| Living relatives outside immediate household | Their own known or likely location — never the current user's address |
| Deceased ancestors | Ancestry-derived last known or historical location only |
| Shared relatives between users | May appear in both views; retain their own locations |
| Shared ancestors | Retain their own historical/ancestry-derived locations |

### Map purpose

The Atlas is an **ancestral movement and historical impact map**, not a member directory map.

Priority display:
1. Household location for the logged-in user's immediate household only
2. Ancestry record locations
3. Last known locations
4. Historical movement paths
5. Likely lineage / ancestral affiliation

Show how removal acts, congressional acts, and government classifications displaced and migrated Indigenous families over time.

### Label and status language

**Do not use:** `Tribal Nation Homeland`

**Use instead:** `Likely Affiliation / Ancestral Location` or `Likely Family / Lineage Location`

Add explanatory note: *"This location is based on known ancestry records, last known residence, historical movement, and likely lineage affiliation. It does not determine political jurisdiction or tribal citizenship by itself."*

**Do not use:** `Mathias El Tribe (approximate territory)`

**Use instead:** `Likely Mathias El Lineage / Family Affiliation` or `Likely Ancestral Location`

### Status labels

| Status | Label |
|---|---|
| Living immediate household members | Protected Members |
| Living family outside immediate household | Eligible Family / Protected Lineage |
| Deceased family | Ancestors |
| Deceased ancestors | Ancestors (not active household members) |

### Membership eligibility (unchanged)

Atlas display changes do **not** affect membership eligibility. All living family / ancestors / other ancestors remain eligible for membership per system logic. This only changes map display behavior.

## User Preferences

- Documents must be associated with the generating member — reference numbers encode member ID
- If a member has restricted/trust-land protected status, that must appear on all generated documents
- Address stored in Personal Information Vault flows into document address blocks automatically
- Profile photo is stored in the database (not as a static file path) — base64 in family_lineage.photoUrl
- Card authority text: "By inherent right · Descendants of the Treaty of Dancing Rabbit Creek (1830)"
- Dual e-signatures on all formal documents: `/s/ Chief Mathias El` (judicial) + `/s/ Mathew-Allen: McCaster` (legal name)
- The vault section on the profile page appears AFTER the identity intake form — it is filled in post-intake
- Do not repeat instructions that have already been implemented — check replit.md for current state

## Gotchas

- Vite base path is `/sovereign-dashboard/` — all public asset URLs must use `${import.meta.env.BASE_URL}filename`
- Microsoft Entra login (AADSTS7000215) fails in dev — use the DEV ACCESS buttons on the login screen
- The tribal ID photo (4.1 MB PNG) is RGBA — must convert to RGB before embedding in PDF (use jpeg embed)
- `requireAdmin` uses ROLE_HIERARCHY ≥ 100 — trustee passes, plain `admin` role also passes
- Vault API never returns SSN, DOB, address, or email values — only `hasXxx` booleans (by design)
- All vault input fields use `type="password"` — characters hidden while typing; eye toggle to reveal temporarily
- `family_lineage` rows: `linkedProfileUserId` links a lineage node to a user account. Photo update writes to ALL rows matching either `linkedProfileUserId = userId` or `userId = userId`
- GWE letter reference numbers: stored as `GWE-${referenceNumber}` in the PDF — the referenceNumber field in the table is just the suffix; use buildDocRef for new ones

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Identity Gateway API: `GET /api/identity/gateway` — requires Bearer token, returns full SIG resolution
- Profile API: `GET/PUT /api/user/profile` — profile fields (legalName, title, etc.)
- Vault API: `GET/PUT /api/user/vault` — presence-only GET, full write on PUT
- Photo upload: `POST /api/identity/photo` (multipart/form-data, field name: `photo`)
