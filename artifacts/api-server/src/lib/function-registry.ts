/**
 * Server-side Function Registry — injected into Kaya's system prompt.
 * Plain text format so it fits cleanly in the prompt context.
 */
export const FUNCTION_REGISTRY_PROMPT = `
PLATFORM FUNCTIONS — navigable pages and features of the Indigenous Intelligence System:
When a member asks where to go, what a feature does, or how to find something, reference this list and include a NAVIGATE card in your response.

Chief's Office:
- Office & Profile (/profile) — Identity hub, land records, tribal ID, sovereign status
- Intake Pipeline (/sovereign-pipeline) — Submit new matters through the sovereign document pipeline
- Official Documents (/official-documents) — Official tribal documents, decrees, and instruments
- Court Documents (/documents) — Court filings and legal records

Governance:
- Files (/files) — General tribal file repository
- Case File Registry (/case-registry → /authority-directory/case-files) — All open and closed case files
- Filings (/filings) — Formal filings with tribal and federal agencies
- Document Templates (/templates) — Ready-to-use sovereign templates (NFR, ICWA, notices, letters)
- Trust Instruments (/instruments) — Trust deeds and governance instruments
- Land & Asset Management (/land) — APN, land records, restricted land, tribal land codes
- Organizations (/org) — Tribal organizations and governance entities
- Notice of Federal Review (/nfr) — Issue and track NFR documents

Community:
- Membership Status (/membership) — Enrollment status and tribal membership records
- Welfare Instruments (/welfare) — Welfare letters and protective instruments
- GWE Letters (/gwe-letter) — General Welfare Exclusion letters
- Elder Advisory (/elder-advisory) — Elder council panel
- Family Governance (/family-governance) — Household structures and kinship records
- Family Tree & Lineage (/family-tree) — Lineage records and ancestry tree
- Ancestral Memory Bank (/ancestral-memories) — Ancestral stories and cultural records
- Exposure Filter (/ancestral-exposure) — Identity exposure and misclassification risk analysis
- Sovereign Journal (/journal) — Personal reflections and official notes
- Complaints (/complaints) — Formal complaint submissions
- Medical Notes (/medical-notes) — Health records and protected health information
- Business Canvas (/business-canvas) — Business planning and economic development

Administration:
- Law Library (/law) — Federal Indian law, statutes, CFR, treaties, case law
- AI Intake Review (/intake-ai) — AI-assisted intake document analysis
- AI Document Drafts (/drafts) — AI-generated document drafts for review
- Classification (/classify) — Tag and classify matters
- Tasks (/tasks) — Task and action tracking
- Lineage Registry (/admin/lineage-import) — Import and manage lineage records
- GEDCOM Import (/gedcom-import) — Import genealogy files
- Atlas Events (/atlas-admin) — Urban Indian Atlas map data
- Microsoft 365 (/m365) — M365 integration and email/calendar sync
- Role Governor (/role-governors) — Role-based governance configuration

Education:
- Self Determination University (/sdu) — Educational modules on sovereignty and federal Indian law
- Sovereign Definitions (/sdu/definitions) — Glossary of key legal and sovereign terms

Personal:
- Notifications (/notifications) — System alerts and updates
- Calendar (/calendar) — Dates, deadlines, and events
- Profile & Identity (/profile) — Personal identity and membership record
- Tribal ID (/tribal-id) — Tribal identification credentials
- Search Records (/search) — Search across all tribal records

Organizations:
- Supreme Court (/supreme-court) — Tribal court records and proceedings
- Tribal Trust (/tribal-trust) — Trust organization and beneficiary management
- Charitable Trust (/charitable-trust) — 501c3 charitable trust
- NIAC (/niac) — National Indigenous American Committee §527 political organization
- Indian Economic Enterprises (/iee) — Tribal economic development

Ecosystem Portals (other dashboards):
- Trust Instruments Dashboard (/trust-dashboard) — Full trust portal
- TRACE — Compliance Engine (/trace/) — Administrative Procedure & Compliance Engine, NIAC review
- Community Dashboard (/community-dashboard) — Member-facing community portal
- Authority Directory (/authority-directory) — Agency directory and jurisdiction maps
- Urban Indian Continuity Atlas (/urban-indian-atlas) — Ancestral migration map
`.trim();

/**
 * Navigation action format for Kaya to include in responses.
 * Uses the [[ACTION:navigate]]...[[/ACTION]] format consistent with the action-queue pattern.
 *
 * Kaya should output this at the end of a response when navigation intent is detected:
 *   [[ACTION:navigate]]{"label":"Go to Family Tree","path":"/family-tree","description":"Lineage records and ancestry tree"}[[/ACTION]]
 */
export const NAVIGATE_INSTRUCTION = `
NAVIGATION CARDS:
When a member asks where to find something, how to navigate to a feature, or what a feature does — include a navigation card at the END of your response using this EXACT format:
[[ACTION:navigate]]{"label":"Go to [Feature Name]","path":"[path from list above]","description":"[one-sentence description]"}[[/ACTION]]

You may include up to 3 navigation cards if multiple destinations are relevant.
For external portals (TRACE, Trust Dashboard, Community Dashboard, Authority Directory, Atlas), use the full path (e.g. /trace/).
Do NOT include navigation cards in purely conversational or legal guidance responses — only when the member is asking about platform features or where to go.
`.trim();
