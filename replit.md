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

## Document Gap Listener — AI Intake System Specification

During any intake, listening, investigation, member guidance, AI interaction, or automated review flow, the system must detect whether the needed document already exists in the template library, workflow system, document engine, or ecosystem infrastructure.

### Routing logic

- **Document exists** → route user to existing template, populate with intake data, continue via established ecosystem logic
- **Document does not exist** → trigger the Dynamic Document Builder (see below)

### Dynamic Document Builder — required behavior

When a gap is detected, the builder must:

1. **Identify the document type** from: user facts, intake responses, agency involved, jurisdiction, requested remedy, triggered protections, workflow context, procedural requirements, existing governance structures

2. **Determine governing law layer(s):** tribal law · federal law · state procedure · administrative rules · court rules · treaty principles · trust responsibilities · internal governance logic · combinations

3. **Pull and organize:** statutes, regulations, procedural requirements, rights, protections, trust obligations, treaty provisions, jurisdictional principles, existing ecosystem logic, alignment protocols, governance standards, approved language patterns

4. **Generate a properly structured draft** including where applicable: heading/caption, parties/entities, statement of facts, jurisdictional basis, applicable provisions, procedural compliance, requests/notices/objections/remedies, reservation of rights, signature blocks, service sections, internal workflow triggers, automation hooks, metadata tagging, routing logic

5. **Overlap check** — analyze whether the generated structure already overlaps with existing ecosystem components before creating new duplicate logic

6. **Integrate** newly generated structures through continuity and alignment — not replacement

7. **Ecosystem harmony** — all generated provisions, strings, automations, workflows, templates, and intake-generated structures must remain in harmony with existing governing principles, alignment protocols, tribal law structures, trust instruments, jurisdictional frameworks, existing workflow chains, governors, protections, intake logic, enforcement structures, and approved system behavior

8. **Hard constraint** — no generated process, automation, template, logic layer, workflow, listener, or intake-derived document shall violate, override, conflict with, dismantle, bypass, improperly duplicate, or unintentionally weaken the existing ecosystem or its governing structures

9. **Integration method** — new strings, listeners, mechanisms, workflows, and document-generation behaviors must integrate through: alignment · continuity · reshaping · repurposing · harmonization · ecosystem-aware expansion — not destructive replacement

10. **Uncertainty handling** — if uncertainty exists, generate a provisional structure using best applicable logic while flagging internally for ecosystem review and refinement — do not refuse generation

11. **Reusable assets** — all newly generated structures become reusable ecosystem assets capable of: future automation · template learning · workflow reuse · governance expansion · pattern recognition · intake optimization · cross-system integration

This is an **ecosystem-aware extension layer** — not a replacement engine. It operates inside the existing AI Intake System, governance infrastructure, document ecosystem, automation chains, and intelligent workflow architecture already established within the platform.

### Intersection with Escalation & Enforcement Intelligence Database

The Document Gap Listener feeds directly into the Escalation & Enforcement Intelligence Database (see below). When a document gap triggers an escalation pathway, the builder should pull structured oversight profiles, escalation chains, required timelines, and applicable templates from that database before generating output.

---

## Escalation & Enforcement Intelligence Database — Specification

This database functions as the primary issue-detection, escalation, oversight, enforcement, and accountability structure used throughout the AI Intake System, governance infrastructure, investigation systems, document-generation systems, tribal court enforcement systems, and workflow automation layers.

### Issue categories to detect and classify

Healthcare · Housing · Government assistance · Child and family services · Tribal rights · Civil rights · Administrative violations · Court matters · Jurisdictional conflicts · Benefits denials · Land and trust matters · Education · Disability-related matters · Utility shutoff or lien actions · Taxation conflicts · Sovereignty and self-determination matters · Procedural due process violations · Tribal court enforcement matters · Federal trust responsibility matters · Identity and classification issues · State overreach into tribal affairs · Recording or administrative obstruction · Consumer and financial harm · Emergency escalation situations

### Entity/oversight profiles — required fields per record

Each structured oversight profile must contain:

- Agency or entity name
- Jurisdictional scope
- Oversight hierarchy
- Escalation chain
- Contact structure
- Governing statutes
- Applicable CFR provisions
- Administrative codes
- Procedural rules
- Treaty implications
- Trust responsibility implications
- Civil rights implications
- Tribal law implications
- Federal supremacy implications
- Jurisdiction-triggering conditions
- Enforcement authorities
- Common violation patterns
- Intake trigger patterns
- Escalation thresholds
- Required timelines
- Required notices
- Administrative exhaustion requirements
- Review pathways
- Emergency escalation logic
- Applicable remedies
- Associated templates
- Associated workflows
- Associated governors
- Enforcement compatibility with tribal court orders

### Entity types to maintain profiles for

Federal agencies · State agencies · County departments · Courts · Administrative bodies · Healthcare systems · Managed care organizations · Housing authorities · Educational institutions · Utility companies · Law enforcement agencies · Contractors acting under government authority · Tribal entities · Oversight divisions · Ombudsman offices · Civil rights offices · Inspector General offices · Regulatory authorities · Enforcement bodies

### Tribal Court Enforcement Layer

This layer must determine:

- Whether an existing tribal court order applies
- Whether full faith and credit provisions are triggered
- Whether federal enforcement mechanisms are implicated
- Whether administrative agencies are legally required to recognize or respond to the order
- Whether escalation to oversight bodies becomes mandatory
- Whether interference or noncompliance triggers additional review or enforcement actions

### Active intelligence — not passive storage

The system must function as an active intelligence and routing layer capable of:

Trigger detection · Pattern recognition · Jurisdiction analysis · Procedural analysis · Escalation sequencing · Oversight identification · Enforcement guidance · Workflow automation · Document generation · Rights and protections analysis · Ecosystem-aware decision support

### Connectivity

Intelligently connect: intake facts · uploaded evidence · agency conduct · existing templates · tribal court orders · statutory protections · CFR requirements · procedural deadlines · existing ecosystem logic · applicable escalation pathways

### Hard constraint

All escalation logic, oversight structures, enforcement pathways, statutes, CFR provisions, workflow chains, and automation strings must remain in harmony with the existing ecosystem, governing principles, tribal law structures, alignment protocols, trust instruments, and established governance architecture. No escalation mechanism or enforcement workflow shall violate, bypass, dismantle, override, weaken, or conflict with the existing ecosystem or governing structures.

This is a **living oversight, escalation, and enforcement intelligence framework** integrated into the ecosystem infrastructure — not merely a data store.

### Intersection with Document Gap Listener

When the Escalation & Enforcement Intelligence Database identifies a required notice, filing, motion, protective instrument, or administrative response, it must check the Document Gap Listener before generating output. If the required document exists in the template library, route to it. If not, trigger the Dynamic Document Builder with the escalation profile context pre-loaded.

---

## Deployment Protocol — Standing Instruction

**Dev = Replit Preview.** Changes happen here instantly. Nothing touches the outside world unless explicitly deployed.

**Production = Azure Container Apps.** This is what members, officers, trustees, and the public see. Nothing goes live unless Mathias says so.

When any deployment-type instruction is given — "deploy," "push to production," "roll this out," "update live," "send it to Azure," or anything in that family — follow this exact pathway, no deviation:

1. Go to **portal.azure.com**
2. Open **Cloud Shell** (`>_` button at top)
3. Upload: `deploy-package/azure/deploy-container-apps.sh`
4. Run: `bash deploy-container-apps.sh`
5. Wait 5–10 minutes — Cloud Shell prints all 5 live URLs at the end

No alternate routes. No rebuilds. No improvisation. Same script every time.

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
