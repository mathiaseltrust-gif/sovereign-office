import { runIntakeFilter, type IntakeFilterResult } from "./intake-filter";
import { queryLawDb } from "./law-db";
import { callAzureOpenAI, getAzureOpenAIClient, type ConversationMessage } from "../lib/azure-openai";
import { checkAlignment, type AlignmentResult } from "./alignment-checker";
import { logger } from "../lib/logger";
import { db, usersTable, messageThreadsTable, directMessagesTable } from "@workspace/db";
import { eq, ilike, and, ne } from "drizzle-orm";

export type ChatTier = "funnel" | "intake_filter" | "law_db" | "azure_openai" | "hard_default";

export interface ChatAction {
  label: string;
  href?: string;
  intent?: string;
}

export interface ChatLawRef {
  title: string;
  citation: string;
  type: "federal" | "tribal" | "doctrine";
}

export interface ChatIntakeReport {
  riskLevel: string;
  violations: string[];
  troRecommended: boolean;
  nfrRecommended: boolean;
  doctrinesTriggered: string[];
  canonicalPosture: string;
}

export interface AlignmentWarning {
  isAligned: false;
  severity: "notice" | "warning" | "critical";
  maatMessage: string;
  violationCount: number;
  categories: string[];
  governorConflict: boolean;
}

export interface ChatResponse {
  reply: string;
  tier: ChatTier;
  tierLabel: string;
  redFlag: boolean;
  redFlagMessage?: string;
  lawRefs?: ChatLawRef[];
  actions?: ChatAction[];
  funnelId?: string;
  azureTokensUsed?: number;
  intakeReport?: ChatIntakeReport;
  alignmentWarning?: AlignmentWarning;
}

export interface ChatInput {
  message: string;
  userName?: string;
  userId?: number;
  uploadedDocumentText?: string;
  conversationHistory?: ConversationMessage[];
}

interface FunnelDef {
  id: string;
  patterns: RegExp[];
  respond: (input: ChatInput) => string;
  actions?: ChatAction[];
  lawTags?: string[];
}

// ─── FUNNEL DEFINITIONS (zero Azure cost) ─────────────────────────────────────

const FUNNELS: FunnelDef[] = [
  {
    id: "GREETING",
    patterns: [
      /^(hi|hello|hey|good\s+\w+|howdy|greetings|yo|start)\b/i,
      /what\s+can\s+you\s+do/i,
      /^help\s*[?!]?\s*$/i,
      /how\s+(do|does)\s+(you|this)\s+work/i,
      /^(get\s+)?started\s*$/i,
    ],
    respond: ({ userName }) =>
      `Hello${userName ? `, ${userName}` : ""}! I am the Sovereign Office Assistant for the Mathias El Tribe.\n\nI can help you with:\n\n• Filing a complaint or reporting a violation\n• Understanding your ICWA, trust land, and jurisdictional rights\n• Getting the right legal documents and forms\n• Welfare and health benefit assistance\n• Membership and enrollment questions\n• Sovereignty and self-determination guidance\n\nFor most questions, I respond immediately using our federal Indian law knowledge base. For complex legal analysis, new court rulings, or document review, our AI legal system assists — but only when truly needed to keep your access costs minimal.\n\nWhat can I help you with today?`,
    actions: [
      { label: "File a Complaint", href: "/complaints" },
      { label: "ICWA Rights", intent: "ICWA_GUIDE" },
      { label: "Trust Land Info", intent: "TRUST_LAND" },
      { label: "My Status", href: "/profile" },
    ],
  },
  {
    id: "COMPLAINT_HELP",
    patterns: [
      /file\s+a?\s+complaint/i,
      /report\s+a?\s+(violation|problem|issue)/i,
      /submit\s+a?\s+complaint/i,
      /how\s+do\s+i\s+(report|complain|file)/i,
      /i\s+want\s+to\s+(report|complain|file\s+a\s+complaint)/i,
      /someone\s+(violated|broke|ignored|disregarded)\s+(my\s+rights|tribal|federal|icwa)/i,
    ],
    respond: ({ userName }) =>
      `${userName ? `${userName}, y` : "Y"}ou can file a complaint directly through the Sovereign Office. Here is how:\n\n1. Go to the Complaints section (link below)\n2. Describe what happened — who acted, what they did, where, and when\n3. Upload any documents, court orders, or notices you received\n4. Our officers review within 5 business days\n\nIf there is imminent harm or a child is involved, your complaint will be flagged as a RED FLAG and reviewed immediately. Our intake system automatically detects ICWA violations, trust land issues, and jurisdictional overreach.\n\nOr describe your situation here and I will assess it for you right now.`,
    actions: [
      { label: "File Complaint Now", href: "/complaints" },
      { label: "Describe My Situation", intent: "ANALYZE_SITUATION" },
      { label: "ICWA Violation", intent: "ICWA_GUIDE" },
      { label: "Emergency — Child Removal", intent: "EMERGENCY" },
    ],
    lawTags: ["tribal-jurisdiction", "state-preemption"],
  },
  {
    id: "ICWA_GUIDE",
    patterns: [
      /\bicwa\b/i,
      /indian\s+child\s+welfare/i,
      /indian\s+child/i,
      /(child|children)\s+(custody|removal|placement|foster|adoption)/i,
      /foster\s+(care|placement)/i,
      /my\s+child\s+(was\s+taken|was\s+removed|is\s+being\s+removed)/i,
      /they\s+(took|taking|removed|removing)\s+my\s+child/i,
      /termination\s+of\s+parental/i,
    ],
    respond: () =>
      `The Indian Child Welfare Act (ICWA), 25 U.S.C. §§ 1901-1963, provides the strongest federal protections for Indian children in any custody or placement proceeding.\n\nYOUR KEY RIGHTS UNDER ICWA:\n\n• NOTICE — The tribe must receive notice before any placement, adoption, or termination proceeding involving an Indian child (25 U.S.C. § 1912(a))\n• INTERVENTION — The tribe has the unconditional right to intervene in any state court proceeding\n• PLACEMENT PREFERENCES — Courts must place Indian children with (1) extended family, (2) tribal members, (3) other Indian families (§ 1915)\n• BURDEN OF PROOF — Termination of parental rights requires proof beyond a reasonable doubt\n• TRANSFER — Tribal court transfer may be requested at any time\n\nICWA was upheld as constitutional by the Supreme Court in Brackeen v. Haaland, 599 U.S. 255 (2023).\n\nIF ICWA IS BEING IGNORED — this is a federal violation and a RED FLAG. Our office can generate a Notice of Federal Review and recommend an emergency TRO to halt state proceedings.\n\nDescribe your child's specific situation for an immediate assessment.`,
    actions: [
      { label: "File ICWA Complaint", href: "/complaints" },
      { label: "Request Emergency TRO", href: "/welfare" },
      { label: "Describe Case Details", intent: "ANALYZE_SITUATION" },
      { label: "ICWA in Law Library", href: "/law" },
    ],
    lawTags: ["child-welfare", "icwa", "tro", "placement"],
  },
  {
    id: "JURISDICTION_INFO",
    patterns: [
      /\bjurisdiction\b/i,
      /state\s+(court|law|authority|government)\s+(has|asserts|claiming|over\s+us|over\s+the\s+tribe)/i,
      /who\s+has\s+(authority|jurisdiction|power)\s+over/i,
      /federal\s+vs?\s+state/i,
      /state\s+vs?\s+tribal/i,
      /can\s+the\s+state\s+(touch|regulate|control|have\s+authority)/i,
      /county\s+(ordinance|law|regulation)\s+(applies?|apply)\s+to\s+(us|the\s+tribe|tribal|indian)/i,
      /pl[-\s]?280/i,
      /public\s+law\s+280/i,
    ],
    respond: () =>
      `Jurisdiction in Indian Country follows a federal framework that strictly limits state authority.\n\nGENERAL RULE (Non-PL-280 states):\n• Indian-on-Indian crimes: TRIBAL + FEDERAL jurisdiction (no state)\n• Non-Indian crimes against Indians: FEDERAL (18 U.S.C. § 1152)\n• Major crimes by Indians: FEDERAL (18 U.S.C. § 1153 — 16 enumerated felonies)\n• Civil jurisdiction over non-members: limited (Montana v. United States, 450 U.S. 544)\n\nCALIFORNIA (PL-280 state — 18 U.S.C. § 1162):\n• State has concurrent CRIMINAL jurisdiction\n• Tribal courts retain civil jurisdiction over members\n• Tribal sovereignty is NOT extinguished — Worcester v. Georgia (31 U.S. 515) still applies\n• SDVCJ opt-in (25 U.S.C. § 1304) — tribal courts may exercise criminal jurisdiction over non-Indians for domestic violence\n\nKEY PRINCIPLE: Even in PL-280 states, states cannot tax, regulate, or exercise civil jurisdiction over Indians on trust land without explicit Congressional authorization.\n\nIF A STATE COURT OR AGENCY IS ASSERTING UNAUTHORIZED JURISDICTION — our office can issue a Jurisdiction Enforcement Notice and Notice of Federal Review citing the applicable federal statutes.\n\nWhat specific jurisdictional situation are you facing?`,
    actions: [
      { label: "Report State Overreach", href: "/complaints" },
      { label: "Get Jurisdiction Notice", href: "/instruments" },
      { label: "Analyze My Situation", intent: "ANALYZE_SITUATION" },
    ],
    lawTags: ["tribal-jurisdiction", "state-jurisdiction", "indian-country"],
  },
  {
    id: "TRUST_LAND",
    patterns: [
      /trust\s+land/i,
      /\ballotment\b/i,
      /indian\s+country\b/i,
      /land\s+(status|classification|in\s+trust)/i,
      /fee\s+land/i,
      /tribal\s+land/i,
      /property\s+(on|in)\s+(the\s+)?reservation/i,
      /state\s+(wants|tried|attempting|is\s+taxing|taxing)\s+(to\s+)?(tax|zone|regulate)\s+(our|tribal|trust)/i,
      /county\s+(zoning|ordinance|taxing)\s+(on|over|of)\s+(trust|tribal|indian)/i,
    ],
    respond: () =>
      `Indian trust land carries the highest level of protection under tribal sovereignty and applicable law.\n\nKEY PROTECTIONS:\n\n• TRIBAL SOVEREIGN AUTHORITY — Trust land cannot be alienated, encumbered, or transferred without explicit tribal and informed consent; any such act without consent is void ab initio\n• FEDERAL TRUST RESPONSIBILITY — The U.S. holds a fiduciary duty derivative of tribal sovereignty to protect Indian trust lands from alienation or encroachment\n• 18 U.S.C. § 1151 — Defines Indian Country to include reservations, dependent Indian communities, and allotments\n• FEDERAL PREEMPTION — State and local laws (zoning, taxation, regulation) are preempted on trust land (McClanahan v. Arizona State Tax Comm'n, 411 U.S. 164 (1973))\n• States cannot tax Indian income derived from Indian Country (Moe v. Confederated Salish, 425 U.S. 463 (1976))\n• Worcester v. Georgia (31 U.S. 515 (1832)) — State laws have no force within Indian territory\n\nIF ANY AGENCY IS ATTEMPTING TO:\n  - Tax your trust land or trust income\n  - Apply county zoning or ordinances to trust land\n  - Assert state jurisdiction over Indian Country\n  - Reclassify trust land as fee land\n  - Encumber or convey your land without your explicit informed consent\n\nThis is a violation of tribal sovereignty and federal law. Our office can issue a State Prohibition Notice, Jurisdictional Enforcement Notice, and Notice of Federal Review.\n\nDescribe your land situation for a full legal assessment.`,
    actions: [
      { label: "File Land Complaint", href: "/complaints" },
      { label: "Get Trust Instruments", href: "/instruments" },
      { label: "Jurisdiction Analysis", intent: "ANALYZE_SITUATION" },
      { label: "Law Library", href: "/law" },
    ],
    lawTags: ["trust-land", "ira", "federal-trust", "federal-preemption"],
  },
  {
    id: "WELFARE_HELP",
    patterns: [
      /\bwelfare\b/i,
      /health\s+(benefit|care|insurance|service)/i,
      /(medical|dental|vision)\s+(benefit|care|coverage)/i,
      /snyder\s+act/i,
      /indian\s+health\s+service/i,
      /food\s+(assistance|stamp|benefit)/i,
      /housing\s+(assistance|benefit|help)/i,
      /assistance\s+program/i,
      /tribal\s+(benefit|program|service)/i,
    ],
    respond: ({ userName }) =>
      `${userName ? `${userName}, t` : "T"}ribal members have access to welfare and health benefits guaranteed under federal law.\n\nFEDERAL ENTITLEMENTS:\n\n• SNYDER ACT (25 U.S.C. § 13) — Congressional authority for BIA to provide health, education, and general assistance to Indians\n• INDIAN HEALTH SERVICE — Medical, dental, and behavioral health services for enrolled tribal members\n• TRIBAL TANF — Tribal Temporary Assistance for Needy Families (25 C.F.R. Part 286)\n• BIA GENERAL ASSISTANCE — Direct financial aid for basic needs for eligible Indians\n\nMATHIAS EL TRIBE PROGRAMS:\n• Tribal Welfare Fund — Emergency assistance for verified members (MRS-2025)\n• Medical referral program — IHS and contracted provider referrals (EML-2025)\n• Housing assistance — Available through tribal housing authority\n\nTO ACCESS BENEFITS:\n1. Verify your tribal membership in your Profile\n2. Go to Welfare section to request an instrument\n3. Officers process within 3 business days\n\nIF YOU ARE BEING DENIED BENEFITS you are federally entitled to, that may constitute a Snyder Act violation — our office can file a Notice of Federal Review.`,
    actions: [
      { label: "Request Welfare Instrument", href: "/welfare" },
      { label: "Check Membership", href: "/profile" },
      { label: "Report Benefits Denial", href: "/complaints" },
      { label: "Medical Notes", href: "/medical-notes" },
    ],
    lawTags: ["welfare", "health", "snyder"],
  },
  {
    id: "MEMBERSHIP_INFO",
    patterns: [
      /am\s+i\s+a\s+member/i,
      /membership\s+status/i,
      /how\s+(do\s+i\s+)?(join|become\s+a\s+member|enroll)/i,
      /\benrollment\b/i,
      /enrolled\s+(member|tribal)/i,
      /verify\s+my\s+membership/i,
      /prove\s+i['\u2019]?m\s+(a\s+)?member/i,
    ],
    respond: () =>
      `Membership in the Mathias El Tribe is based on lineage, descent, and tribal law.\n\nHOW MEMBERSHIP IS VERIFIED:\n1. Lineage Records — Ancestor chain connecting to the tribal roll\n2. Family Group Records — Documented family group membership\n3. Identity Documentation — Supporting Moorish/El lineage\n\nIMPORTANT LEGAL PRINCIPLE: Under Santa Clara Pueblo v. Martinez, 436 U.S. 49 (1978), tribal membership determinations are the EXCLUSIVE right of the tribe. No court can override tribal enrollment decisions.\n\nONCE MEMBERSHIP IS VERIFIED, you gain access to:\n• ICWA protections for your children\n• Tribal welfare and health benefits\n• Trust land and inheritance rights\n• Full tribal legal representation\n• Medical protection decrees\n\nTO VERIFY YOUR MEMBERSHIP:\nGo to Profile → Family Tree → Upload lineage records and ancestor documentation.\n\nYour verification status is shown on your Profile page.`,
    actions: [
      { label: "Check My Profile", href: "/profile" },
      { label: "Family Tree Records", href: "/family-tree" },
      { label: "Membership Questions", intent: "ANALYZE_SITUATION" },
    ],
    lawTags: ["tribal-jurisdiction", "canons-of-construction"],
  },
  {
    id: "DOCUMENT_HELP",
    patterns: [
      /need\s+a?\s+(document|form|notice|declaration)/i,
      /get\s+a?\s+(document|form|notice|declaration)/i,
      /how\s+do\s+i\s+get\s+a/i,
      /upload\s+(a?\s+)?(notice|document|form)/i,
      /what\s+documents\s+do\s+i\s+need/i,
      /generate\s+a?\s+(document|form)/i,
      /create\s+a?\s+(document|form|instrument)/i,
    ],
    respond: () =>
      `The Sovereign Office generates recorder-compliant legal documents for tribal members.\n\nAVAILABLE DOCUMENT TEMPLATES:\n\n• Trust Deed — Establishes Indian trust land status in county records\n• Sovereign Restoration Declaration — Asserts inherent sovereignty (SRD-2025)\n• Inherent Sovereignty Declaration — Formal declaration of inherent authority\n• State Prohibition Notice — Cease and desist: state jurisdiction on trust land\n• Jurisdiction Enforcement Notice — PL-280 jurisdiction matrix enforcement\n• Notice of Federal Review (NFR) — Documents federal Indian law violations\n• TRO Declaration — Emergency restraining order support\n• Welfare Instrument — Authorizes tribal welfare benefits\n• Medical Protection Decree — Protects Indian health service access\n• Tribal Health Referral — Official referral to IHS and contracted providers\n\nAll documents are generated as recorder-compliant PDFs with proper margins, checksums, and signature blocks — ready for county recorder filing.\n\nTO CREATE A DOCUMENT:\nGo to Trust Instruments > New Instrument > Select Template`,
    actions: [
      { label: "Browse Templates", href: "/templates" },
      { label: "Create Instrument", href: "/instruments" },
      { label: "View My Documents", href: "/instruments" },
    ],
  },
  {
    id: "SOVEREIGNTY_INFO",
    patterns: [
      /sovereign(ty)?/i,
      /self[\s-]determination/i,
      /inherent\s+(authority|right|power|sovereignty)/i,
      /what\s+are\s+our\s+(rights|powers|authorities)/i,
      /can\s+the\s+(state|government|federal)\s+(stop|interfere|override|take)/i,
      /\brecognition\b/i,
      /tribe\s+(is\s+a\s+)?sovereign/i,
    ],
    respond: () =>
      `The Mathias El Tribe holds inherent sovereignty — authority that predates and was never granted by the United States.\n\nFOUNDATIONAL LEGAL PRINCIPLES:\n\n• INHERENT SOVEREIGNTY — Tribal sovereign authority arises from the tribe's own existence as a self-governing people, not from any federal act (United States v. Wheeler, 435 U.S. 313 (1978))\n• FEDERAL TRUST RESPONSIBILITY — The U.S. has a paramount fiduciary duty to protect tribal sovereignty (Seminole Nation v. United States, 316 U.S. 286 (1942))\n• WORCESTER DOCTRINE — State laws have no force within Indian territory (Worcester v. Georgia, 31 U.S. 515 (1832))\n• INDIAN CANONS OF CONSTRUCTION — All statutory ambiguities must be resolved in favor of Indian interests (Montana v. Blackfeet Tribe, 471 U.S. 759 (1985))\n\nMATHIAS EL TRIBE SOVEREIGNTY INSTRUMENTS:\n• SRD-2025 — Sovereign Restoration Doctrine\n• SD-2025 — Sovereignty Declaration\n• SPD-2025 — Sovereign Protection Decree\n\nYOUR SOVEREIGN RIGHTS INCLUDE:\n  - Self-governance and tribal courts\n  - Exclusive membership determination\n  - Control over tribal land and resources\n  - Protection of members under all applicable federal Indian law\n  - Right to exclude state authority from Indian Country`,
    actions: [
      { label: "Law Library", href: "/law" },
      { label: "Sovereignty Instruments", href: "/instruments" },
      { label: "File Sovereignty Complaint", href: "/complaints" },
    ],
    lawTags: ["tribal-jurisdiction", "state-preemption", "federal-preemption"],
  },
  {
    id: "STATUS_CHECK",
    patterns: [
      /(my\s+)?(case|complaint|filing)\s+status/i,
      /where\s+is\s+my\s+(complaint|filing|document|case)/i,
      /check\s+my\s+(status|complaint|filing|case)/i,
      /what\s+happened\s+to\s+my\s+(complaint|case|filing)/i,
      /update\s+on\s+my\s+(case|complaint|filing)/i,
      /has\s+my\s+(complaint|filing)\s+been/i,
    ],
    respond: ({ userName }) =>
      `${userName ? `${userName}, y` : "Y"}ou can track all your matters through the dashboard.\n\nWHERE TO CHECK:\n\n• Complaints — Status of filed complaints (open, under review, resolved)\n• Filings — Status of recorder filings (submitted, accepted, rejected)\n• Trust Instruments — All your legal documents and their status\n• Tasks — Action items assigned to your cases\n• Notifications — All updates across your matters\n\nIF A FILING WAS REJECTED — check the Filings section for the recorder's response. Our office can assist with correcting and resubmitting.\n\nIF A COMPLAINT HAS BEEN OPEN MORE THAN 5 BUSINESS DAYS without a response, it may be escalated to the Chief Justice office.\n\nIs there a specific case number or type of matter I can help you locate?`,
    actions: [
      { label: "My Complaints", href: "/complaints" },
      { label: "My Filings", href: "/filings" },
      { label: "My Instruments", href: "/instruments" },
      { label: "Notifications", href: "/notifications" },
    ],
  },
  {
    id: "CREDIT_DEBT_PROTECTION",
    patterns: [
      /credit\s*(bureau|report|file|score|card)/i,
      /equifax|experian|transunion/i,
      /mortgage\s*(company|servicer|lender|collect)/i,
      /carrington/i,
      /debt\s*(collector|collection|validation|validate)/i,
      /place[sd]?\s+(something|things?|item|account|charge|lien)\s+(on|to)\s+(my|our)?\s*(person|personal|credit)/i,
      /reporting\s+(to|on)\s+(my|our|the)?\s*credit/i,
      /force\s*(d)?\s*(clos|foreclos)/i,
      /foreclos(e|ure|ing)/i,
      /fdcpa|fcra/i,
      /validate\s+the\s+debt/i,
      /sent\s+(multiple\s+)?(notices?|orders?|letters?)\s+(and\s+)?(no\s+response|ignored|disregarded)/i,
      /cease\s+and\s+desist/i,
      /stop\s+(carrington|the\s+mortgage|the\s+debt\s+collector|them\s+from\s+report)/i,
    ],
    respond: ({ userName }) =>
      `${userName ? `${userName}, t` : "T"}his situation — a mortgage company or debt collector placing items on your credit file and/or attempting to force close on restricted land — triggers multiple layers of federal law protection.\n\nWHAT YOU ARE FACING IS AN ADMINISTRATIVE PROCESS VIOLATION:\n\n` +
      `CREDIT BUREAU REPORTING (FCRA — 15 U.S.C. § 1681):\n` +
      `• A furnisher (Carrington Mortgage or any servicer) CANNOT report inaccurate or unauthorized information\n` +
      `• Your sovereign status and any federally recognized debt invalidity are grounds to dispute every item on your credit file\n` +
      `• Once you send a written dispute, the bureau has 30 days to investigate and must notify the furnisher\n` +
      `• Willful non-compliance: $100–$1,000 per violation + attorney fees (§ 1681n)\n\n` +
      `DEBT COLLECTION (FDCPA — 15 U.S.C. § 1692):\n` +
      `• Under § 1692g, once you send a written Debt Validation Demand, ALL collection must stop until they prove the debt is valid\n` +
      `• They have 30 days to validate in writing — or the debt is presumed invalid\n` +
      `• Continuing to collect or report during the validation period is itself an FDCPA violation\n` +
      `• You have sent notices and orders — this is already on record and strengthens your position\n\n` +
      `RESTRICTED/TRUST LAND (Nonintercourse Act — 25 U.S.C. § 177):\n` +
      `• No mortgage, lien, or encumbrance on restricted Indian land is valid without federal authorization\n` +
      `• Any attempted foreclosure on restricted land is void ab initio — it has no legal effect\n` +
      `• Worcester v. Georgia (31 U.S. 515) — commercial actors have no force over protected Indian land\n\n` +
      `THE MOST STRAIGHTFORWARD PATH — 3 STEPS:\n\n` +
      `1. FDCPA DEBT VALIDATION DEMAND (certified mail, return receipt)\n` +
      `   → Immediately halts all collection and credit reporting during validation\n` +
      `   → Forces Carrington to produce: original signed contract, chain of title, proof of debt ownership\n\n` +
      `2. CREDIT BUREAU DISPUTE NOTICE (to Equifax, Experian, TransUnion)\n` +
      `   → Assert sovereign status + protected land status as grounds for dispute\n` +
      `   → Demand removal of all items placed by the unauthorized creditor\n\n` +
      `3. SOVEREIGN CEASE & DESIST (from this office)\n` +
      `   → Formal order from Chief Justice & Trustee asserting jurisdiction, restricted land status, and FDCPA/FCRA violations\n` +
      `   → Can be served on Carrington, their registered agent, and any credit bureaus\n\n` +
      `Our system can generate all three documents. Use the Intake Pipeline for a full analysis, or go to Court Documents to start the drafts now.`,
    actions: [
      { label: "Run Full Intake Analysis", href: "/sovereign-pipeline" },
      { label: "Draft Debt Validation Demand", href: "/documents" },
      { label: "Draft Credit Dispute Notice", href: "/documents" },
      { label: "File Complaint Against Carrington", href: "/complaints" },
    ],
    lawTags: ["debt-invalidation", "admin-process", "fdcpa", "fcra", "credit-protection", "nonintercourse", "trust-land"],
  },
  {
    id: "HAIR_ATTIRE_PROTECTION",
    patterns: [
      /\bhair\b.{0,40}(policy|policies|rule|cut|long|braid|lock|dread)/i,
      /\b(braid|dreadlock|loc|locs)\b/i,
      /traditional\s+(attire|dress|clothing|regalia|wear)/i,
      /\bregalia\b/i,
      /grooming\s+(policy|rule|standard|requirement)/i,
      /dress\s+code.{0,40}(native|indian|indigenous|spiritual|ceremonial|traditional)/i,
      /(school|work|employer|prison|jail)\s+.{0,40}\b(hair|braids?|attire|clothing|dress)\b/i,
      /can['\u2019]?t\s+(wear|have|keep).{0,40}(hair|braids?|attire|clothing|regalia)/i,
      /told\s+(me|us)\s+(to\s+)?(cut|remove|change)\s+(my|our).{0,30}(hair|attire|clothing)/i,
      /\bheaddress\b|\bfeathers?\b.{0,20}(wear|worn|carry|school|work)/i,
    ],
    respond: ({ userName }) =>
      `${userName ? `${userName}, t` : "T"}his touches one of the most important — and most overlooked — areas of Indigenous protective rights.\n\n` +
      `HAIR, APPEARANCE & ATTIRE PROTECTIONS:\n\n` +
      `Long hair, braids, traditional attire, regalia, head coverings, beadwork, and ceremonial clothing may carry deep spiritual, cultural, familial, or ceremonial significance. That significance is legally protected — not as a courtesy, but as a right.\n\n` +
      `WHY THESE PROTECTIONS EXIST:\n` +
      `Hair cutting was one of the most documented acts of cultural destruction in the boarding school era. The forced removal of hair was a deliberate act of identity erasure. Federal law now protects what was once systematically destroyed.\n\n` +
      `APPLICABLE LEGAL FRAMEWORKS:\n\n` +
      `• AIRFA — American Indian Religious Freedom Act (42 U.S.C. § 1996): Federal policy affirms the right of Indigenous people to practice traditional religion including appearance and ceremonial objects.\n` +
      `• RFRA — Religious Freedom Restoration Act (42 U.S.C. § 2000bb): Government and government-funded institutions cannot substantially burden religious practice without a compelling interest and the least restrictive means.\n` +
      `• Title VII — Civil Rights Act (42 U.S.C. § 2000e): Employers must provide reasonable accommodation for sincerely held religious and cultural practice, including appearance and attire, unless it causes undue hardship.\n` +
      `• RLUIPA — Religious Land Use and Institutionalized Persons Act (42 U.S.C. § 2000cc): Applies in prisons and jails — facilities cannot enforce grooming policies that substantially burden Indigenous religious practice without compelling justification.\n` +
      `• Equal Protection — Schools receiving federal funds cannot apply dress codes in ways that discriminate against Indigenous cultural and religious expression.\n\n` +
      `THE STANDARD:\n` +
      `The institution must show a compelling interest AND that their policy is the least restrictive way to achieve it. "Policy is policy" is not a legal standard. "It applies to everyone" does not override a religious accommodation right.\n\n` +
      `WHAT COMPANION CAN GENERATE FOR YOU:\n` +
      `• A formal Religious/Cultural Accommodation Request letter\n` +
      `• A notice identifying the applicable federal legal framework\n` +
      `• Documentation of the protected practice and its cultural/spiritual significance\n` +
      `• An objection letter if accommodation is denied\n\n` +
      `Tell me the setting (school, employer, prison, courthouse) and what specifically is being required of you — and I will generate the appropriate accommodation request now.`,
    actions: [
      { label: "Generate Accommodation Letter", intent: "ACCOMMODATION_LETTER" },
      { label: "File a Complaint", href: "/complaints" },
      { label: "Religious Protections — Law Library", href: "/law" },
    ],
    lawTags: ["airfa", "rfra", "title-vii", "rluipa", "hair-attire", "religious-accommodation"],
  },
  {
    id: "RELIGIOUS_CEREMONY_PROTECTION",
    patterns: [
      /\bceremony\b|\bceremonial\b/i,
      /sweat\s+lodge/i,
      /sacred\s+(site|land|object|item|ground|place)/i,
      /\bpipe\b.{0,20}(sacred|ceremony|pray|prayer)/i,
      /medicine\s+(bundle|bag|man|woman|practice)/i,
      /\bsmudging?\b|\bsmudge\b/i,
      /(prayer|praying)\s+(circle|ceremony|ritual)/i,
      /fasting\s+(ceremony|ritual|spiritual|cultural)/i,
      /\bpowwow\b/i,
      /spiritual\s+(practice|ceremony|gathering|observance)/i,
      /interfering\s+with.{0,30}(ceremony|prayer|practice|spiritual)/i,
      /(denied|blocking|prevented|stopped)\s+(from\s+)?(ceremony|prayer|praying|practice)/i,
      /american\s+indian\s+religious\s+freedom/i,
      /\bairfa\b|\brfra\b/i,
    ],
    respond: () =>
      `RELIGIOUS & CEREMONIAL PROTECTIONS — Indigenous Sovereign Right:\n\n` +
      `Prayer, ceremony, sacred objects, medicine, fasting, gathering, songs, and sacred sites are legally protected under multiple federal frameworks. Interference with Indigenous ceremonial practice is a federal matter — not a policy disagreement.\n\n` +
      `WHY THESE PROTECTIONS EXIST:\n` +
      `Indigenous ceremony was systematically suppressed — the Sun Dance was criminalized, sacred objects were seized and taken to museums, ceremony was prohibited in boarding schools. Federal law now acknowledges that harm and creates binding obligations in response.\n\n` +
      `GOVERNING LAW:\n\n` +
      `• AIRFA — American Indian Religious Freedom Act (42 U.S.C. § 1996): It is the policy of the United States to protect and preserve the inherent right of American Indians to believe, express, and exercise their traditional religions — including access to sacred sites, ceremonial objects, and the freedom to worship through traditional rites.\n` +
      `• RFRA — Religious Freedom Restoration Act (42 U.S.C. § 2000bb): No government action may substantially burden a person's religious practice unless it serves a compelling government interest using the least restrictive means available.\n` +
      `• RLUIPA — Institutionalized Persons Act (42 U.S.C. § 2000cc-1): Protects incarcerated Indigenous people's right to sweat lodge, ceremony, diet (fasting), and sacred objects in prisons and jails.\n` +
      `• NAGPRA (25 U.S.C. § 3001): Protects sacred objects and ancestral remains from excavation, transfer, or institutional control without tribal consultation and consent.\n` +
      `• Eagle Feather Laws — The Migratory Bird Treaty Act and Bald Eagle Protection Act include specific exemptions for enrolled tribal members to possess eagle feathers for ceremonial use.\n\n` +
      `SETTINGS WHERE THESE RIGHTS APPLY:\n` +
      `Prison or jail, school, workplace, hospital, courthouse, any federally funded institution — and any interference with access to sacred sites on federal or public land.\n\n` +
      `Describe what is being interfered with — the ceremony, the object, the setting — and I will identify the exact protection and generate a notice or accommodation request.`,
    actions: [
      { label: "Generate Accommodation Request", intent: "ACCOMMODATION_LETTER" },
      { label: "File Complaint", href: "/complaints" },
      { label: "Law Library — Religious Rights", href: "/law" },
    ],
    lawTags: ["airfa", "rfra", "rluipa", "nagpra", "ceremony", "sacred-sites"],
  },
  {
    id: "ACCOMMODATION_LETTER",
    patterns: [
      /accommodation\s+(letter|request|form|notice)/i,
      /generate\s+(an?\s+)?(accommodation|letter|request)/i,
      /write\s+(a\s+)?(letter|notice|request).{0,40}(hair|attire|ceremony|pray|religious|cultural)/i,
      /draft\s+(a\s+)?(letter|notice|request).{0,40}(accommodation|hair|attire|ceremony|pray|religious)/i,
      /(need|want|create)\s+.{0,20}accommodation\s+(letter|notice|request)/i,
      /how\s+do\s+i\s+(request|ask\s+for|get)\s+an?\s+accommodation/i,
      /template\s+for\s+(accommodation|religious|hair|attire|cultural)/i,
    ],
    respond: ({ userName }) =>
      `${userName ? `${userName}, I` : "I"} can generate an accommodation request for you. These letters establish your legal position in writing — they are not requests for special treatment, they are assertions of rights the law already recognizes.\n\n` +
      `WHAT A PROPER ACCOMMODATION REQUEST MUST INCLUDE:\n\n` +
      `1. Your identity and tribal affiliation (political relationship, not racial classification)\n` +
      `2. The specific practice, observance, or appearance at issue\n` +
      `3. The cultural, spiritual, or familial significance — in your words\n` +
      `4. The specific institutional policy causing conflict\n` +
      `5. The applicable legal framework (Title VII, RFRA, AIRFA, RLUIPA, Equal Protection)\n` +
      `6. The accommodation you are requesting\n` +
      `7. The standard the institution must meet (compelling interest + least restrictive means)\n` +
      `8. A reservation of rights and notice of potential federal complaint if denied\n\n` +
      `TYPES OF ACCOMMODATION LETTERS COMPANION CAN DRAFT:\n\n` +
      `• Hair & Appearance — school, employer, prison, courthouse\n` +
      `• Ceremonial Leave — requesting time for ceremony, gathering, or observance\n` +
      `• Sacred Objects — right to possess in institutional setting\n` +
      `• Dietary Accommodation — fasting protocols, traditional diet\n` +
      `• Sweat Lodge or Prayer Access — incarcerated members\n` +
      `• Regalia or Traditional Attire — school or workplace\n` +
      `• Traditional Healer Access — hospital or medical setting\n\n` +
      `Tell me: (1) the setting (school, employer, prison, hospital), (2) what is being restricted, and (3) the specific practice or significance — and I will draft the letter now using the correct legal framework.`,
    actions: [
      { label: "Describe My Situation", intent: "ANALYZE_SITUATION" },
      { label: "File Complaint if Denied", href: "/complaints" },
      { label: "Religious Rights — Law Library", href: "/law" },
    ],
    lawTags: ["title-vii", "rfra", "airfa", "rluipa", "religious-accommodation"],
  },
  {
    id: "EDUCATION_RIGHTS",
    patterns: [
      /school.{0,40}(native|indian|indigenous|tribal|cultural|spiritual|language|hair|regalia|discrimination)/i,
      /student.{0,40}(native|indian|indigenous|tribal|rights|discrimination)/i,
      /native\s+american\s+languages?\s+act/i,
      /\b(teacher|principal|school\s+board)\b.{0,40}(hair|regalia|ceremony|cultural|prayer|language)/i,
      /school\s+(won['\u2019]?t|refused|denied|won['\u2019]?t\s+let|is\s+preventing)/i,
      /my\s+(child|daughter|son|kid)\s+.{0,40}(school|teacher|principal).{0,40}(hair|regalia|dress|prayer|language|cultural)/i,
      /tribal\s+(language|culture)\s+in\s+school/i,
      /(bullied|harassed|discriminated)\s+(against\s+)?at\s+school.{0,20}(native|indian|indigenous|tribal)/i,
    ],
    respond: ({ userName }) =>
      `${userName ? `${userName}, N` : "N"}ative students have federal rights to cultural expression, language preservation, and protection from discrimination in educational settings.\n\n` +
      `WHY THESE PROTECTIONS EXIST:\n` +
      `Boarding schools were designed explicitly to "kill the Indian and save the man" — to destroy language, culture, family, and identity through forced education. Federal law now imposes obligations in direct response to that documented harm.\n\n` +
      `EDUCATIONAL RIGHTS FRAMEWORK:\n\n` +
      `• Native American Languages Act (25 U.S.C. §§ 2901–2906): It is the policy of the United States to preserve, protect, and promote the rights and freedom of Native Americans to use, practice, and develop Native American languages. Schools receiving federal funds cannot prohibit Native language use or instruction.\n` +
      `• Title VI, Civil Rights Act (42 U.S.C. § 2000d): No person shall be subjected to discrimination based on race or national origin in any federally funded program or activity — including public schools.\n` +
      `• Equal Protection (14th Amendment): Schools cannot apply dress codes, grooming policies, or behavioral rules in ways that discriminate against Indigenous cultural and religious expression.\n` +
      `• AIRFA & RFRA: Religious and cultural accommodations in school settings — prayer, ceremony, attire, sacred objects.\n` +
      `• Title IX: Protects against sex-based harassment that may intersect with cultural discrimination.\n\n` +
      `WHAT CAN BE PROTECTED IN SCHOOL:\n` +
      `• Traditional hair (long hair, braids, locs)\n` +
      `• Regalia and ceremonial clothing (including graduation ceremonies)\n` +
      `• Prayer and ceremony time\n` +
      `• Native language use and instruction\n` +
      `• Cultural expression in projects and curriculum\n` +
      `• Protection from harassment and bullying based on Indigenous identity\n\n` +
      `COMPANION CAN GENERATE:\n` +
      `A school accommodation notice, a Title VI complaint letter, or a parental rights assertion letter — telling me the school, what happened, and what the student was told.`,
    actions: [
      { label: "Generate School Accommodation Letter", intent: "ACCOMMODATION_LETTER" },
      { label: "File Discrimination Complaint", href: "/complaints" },
      { label: "Law Library — Education Rights", href: "/law" },
    ],
    lawTags: ["native-languages-act", "title-vi", "airfa", "rfra", "equal-protection", "education"],
  },
  {
    id: "NAGPRA_BURIAL",
    patterns: [
      /\bnagpra\b/i,
      /\brepatriation\b/i,
      /ancestral\s+(remains?|bones?|burial|grave)/i,
      /\bburial\s+(site|ground|protection)\b/i,
      /(museum|university|institution)\s+.{0,40}(remains?|bones?|artifacts?|sacred\s+objects?)/i,
      /sacred\s+objects?\s+.{0,40}(museum|return|returned|repatriate|stolen)/i,
      /\bcultural\s+patrimony\b/i,
      /(disturb|excavat|found|discovered).{0,30}(grave|remains?|burial)/i,
      /cemetery\s+(protection|rights|tribal)/i,
    ],
    respond: () =>
      `LAND, BURIAL & ANCESTOR PROTECTIONS — NAGPRA:\n\n` +
      `Indigenous burial sites, ancestral remains, sacred objects, and cultural patrimony are protected under federal law. Disturbance, excavation, and trafficking of ancestral remains and sacred items is a federal crime.\n\n` +
      `WHY THIS LAW EXISTS:\n` +
      `Generations of Indigenous ancestral remains were removed from burial sites, displayed in museums, and held by universities — often without consent and in violation of tribal spiritual law. NAGPRA was enacted to reverse that harm and establish repatriation as a federal obligation.\n\n` +
      `GOVERNING LAW — NATIVE AMERICAN GRAVES PROTECTION AND REPATRIATION ACT (25 U.S.C. §§ 3001–3013):\n\n` +
      `• REPATRIATION: Federal agencies and institutions receiving federal funds must inventory and repatriate Native American human remains, funerary objects, sacred objects, and cultural patrimony to affiliated tribes upon request.\n` +
      `• NEWLY DISCOVERED REMAINS: If human remains or cultural items are discovered on federal or tribal land during any activity, work must stop. The Secretary of the Interior must be notified. Affiliated tribes have the right to control disposition.\n` +
      `• CONSULTATION: Institutions must consult with tribes before any disposition of covered items.\n` +
      `• CRIMINAL PENALTIES: Trafficking in Native American human remains or sacred objects is a federal crime — 18 U.S.C. § 1170 (up to 12 months imprisonment, up to 5 years for repeat violations).\n` +
      `• ENFORCEMENT: Tribes may file for injunctive relief and civil penalties for NAGPRA violations.\n\n` +
      `IF YOU KNOW OF:\n` +
      `• A burial site being disturbed by construction or development\n` +
      `• Ancestral remains held by a museum or university\n` +
      `• Sacred objects in private or institutional collections\n` +
      `• A cemetery being improperly treated\n\n` +
      `Our office can file a formal NAGPRA compliance demand, a Notice of Federal Review, and coordinate repatriation requests directly.\n\n` +
      `Describe what you know and I will identify the appropriate federal response.`,
    actions: [
      { label: "File NAGPRA Complaint", href: "/complaints" },
      { label: "Generate Federal Review Notice", href: "/instruments" },
      { label: "Law Library — NAGPRA", href: "/law" },
    ],
    lawTags: ["nagpra", "burial-protection", "repatriation", "sacred-objects", "cultural-patrimony"],
  },
  {
    id: "EMERGENCY",
    patterns: [
      /\bemergency\b/i,
      /right\s+now\b/i,
      /happening\s+now/i,
      /(today|tonight|tomorrow\s+morning)\s+(is\s+the\s+hearing|they|court)/i,
      /hearing\s+(is\s+)?(today|tonight|in\s+\d+\s+hour)/i,
      /(going\s+to|about\s+to)\s+(remove|take|arrest|seize)/i,
      /they\s+(are\s+)?(removing|taking|arresting|seizing)\s+(my\s+child|our\s+land|my)/i,
      /court\s+order\s+(was\s+served|arrived|just\s+came)/i,
    ],
    respond: () =>
      `URGENT — Our office treats imminent harm as the highest priority.\n\nIF A CHILD IS BEING REMOVED WITHOUT ICWA COMPLIANCE:\n• The tribe must have received NOTICE before any placement (25 U.S.C. § 1912(a)) — if not, this is a federal violation\n• An emergency motion for stay of state proceedings can be filed immediately\n• The tribe has the unconditional right to intervene\n\nIF YOU FACE IMMEDIATE STATE ACTION ON TRUST LAND:\n• Federal courts can enjoin unconstitutional state actions\n• A TRO can halt the action pending federal review\n• A Jurisdiction Enforcement Notice can be served on the state court immediately\n\nIMMEDIATE STEPS:\n1. Document everything — dates, names, court orders received, notices\n2. File an EMERGENCY complaint — mark it urgent with all details\n3. Upload any court orders or notices — our system analyzes them immediately\n4. Request an emergency TRO through Court Documents\n5. Contact the Chief Justice & Trustee office directly\n\nDescribe what is happening right now and I will do an immediate legal assessment.`,
    actions: [
      { label: "File Emergency Complaint", href: "/complaints" },
      { label: "Request Emergency TRO", href: "/welfare" },
      { label: "Court Documents", href: "/documents" },
      { label: "Describe My Emergency", intent: "ANALYZE_SITUATION" },
    ],
    lawTags: ["icwa", "child-welfare", "tro", "placement"],
  },
];

// ─── AI ESCALATION DETECTION ──────────────────────────────────────────────────
// Only escalate to Azure OpenAI when truly needed — keeps costs minimal.
// Average cost per AI call: ~$0.003 — $0.01.
// Expected usage: <50 AI calls/month = ~$0.50/month = ~$6/year max.

const AI_ESCALATION_PATTERNS = [
  /new\s+(law|legislation|ruling|decision|case|act|regulation)/i,
  /recent(ly)?\s+(ruled?|decided?|enacted?|signed?|passed?|changed?|held)/i,
  /court\s+recently\s+(ruled?|decided?|held)/i,
  /(what\s+did|what\s+has)\s+the\s+(supreme\s+)?court\s+.{0,40}(rule|ruled|decide|decided|held)/i,
  /just\s+(passed|signed\s+into\s+law|enacted)/i,
  /202[3-9]\s+(law|act|ruling|decision|case)/i,
  /updated?\s+(law|statute|regulation|rule)/i,
  /what\s+does\s+(the\s+)?(supreme\s+)?court\s+(currently\s+)?say\s+about/i,
  /analyze\s+(this|my|the)\s+(document|notice|order|case|letter)/i,
  /review\s+(this|my)\s+(document|notice|order|letter)/i,
  /what\s+does\s+this\s+(mean|say)\s+(legally|for\s+me|in\s+my\s+case)/i,
  /interpret\s+(this|my|for\s+me)/i,
  /is\s+(this|it)\s+(legal|constitutional|valid|enforceable)/i,
  /(ask|use|get)\s+(the\s+)?ai/i,
  /need\s+(ai|legal\s+analysis|deeper\s+analysis|more\s+detail)/i,
  /complex\s+(legal|case|situation)/i,
];

function shouldEscalateToAI(input: ChatInput): boolean {
  if (input.uploadedDocumentText) return true;
  if (input.message.length > 350) return true;
  for (const p of AI_ESCALATION_PATTERNS) {
    if (p.test(input.message)) return true;
  }
  return false;
}

function matchFunnel(message: string): FunnelDef | null {
  for (const funnel of FUNNELS) {
    for (const pattern of funnel.patterns) {
      if (pattern.test(message)) return funnel;
    }
  }
  return null;
}

// ─── TAG DETECTION FOR LAW DB LOOKUP ─────────────────────────────────────────

function detectGeneralTags(message: string): string[] {
  const lower = message.toLowerCase();
  const tags = new Set<string>();
  if (/icwa|child|custody|placement|foster|adoption/.test(lower)) {
    ["icwa", "child-welfare", "tro", "placement"].forEach(t => tags.add(t));
  }
  if (/trust\s*land|allotment|fee\s*land|indian\s*country|restricted/.test(lower)) {
    ["trust-land", "ira", "federal-trust"].forEach(t => tags.add(t));
  }
  if (/state\s*court|county|state\s*law|local\s*gov|zoning|tax/.test(lower)) {
    ["state-preemption", "federal-preemption", "tribal-jurisdiction"].forEach(t => tags.add(t));
  }
  if (/welfare|health|medical|snyder|benefit|food|housing/.test(lower)) {
    ["welfare", "health", "snyder"].forEach(t => tags.add(t));
  }
  if (/jurisdiction|authority|sovereign|self.determin/.test(lower)) {
    ["tribal-jurisdiction", "state-jurisdiction"].forEach(t => tags.add(t));
  }
  if (/protection\s*order|domestic|vawa|restraining/.test(lower)) {
    ["protection-order", "tribal-jurisdiction"].forEach(t => tags.add(t));
  }
  return Array.from(tags);
}

function getTagsFromFlags(flags: IntakeFilterResult): string[] {
  const tags: string[] = [];
  if (flags.indianStatusViolation) tags.push("canons-of-construction", "tribal-jurisdiction");
  if (flags.troRecommended) tags.push("tro", "icwa", "child-welfare");
  if (flags.nfrRecommended) tags.push("state-preemption", "federal-preemption", "tribal-jurisdiction");
  if (flags.violations.some(v => /icwa/i.test(v))) tags.push("icwa", "child-welfare", "placement");
  if (flags.violations.some(v => /land/i.test(v))) tags.push("trust-land", "federal-trust");
  return [...new Set(tags)];
}

function buildIntakeReply(flags: IntakeFilterResult, lawRefs: ChatLawRef[]): string {
  const lines: string[] = [];
  if (flags.redBannerMessage) {
    lines.push(flags.redBannerMessage);
    lines.push("");
  }
  if (flags.violations.length > 0) {
    lines.push("VIOLATIONS DETECTED IN YOUR MESSAGE:");
    flags.violations.forEach(v => lines.push(`  • ${v}`));
    lines.push("");
  }
  if (flags.doctrinesTriggered.length > 0) {
    lines.push("CONTROLLING DOCTRINES:");
    flags.doctrinesTriggered.slice(0, 3).forEach(d => lines.push(`  • ${d}`));
    lines.push("");
  }
  lines.push(`POSTURE: ${flags.canonicalPosture}`);
  lines.push("");
  if (lawRefs.length > 0) {
    lines.push("APPLICABLE LAW:");
    lawRefs.slice(0, 4).forEach(r => lines.push(`  • [${r.type.toUpperCase()}] ${r.title} — ${r.citation}`));
    lines.push("");
  }
  lines.push("Please describe your situation in full detail so the Sovereign Office can prepare the appropriate legal instruments and response.");
  return lines.join("\n");
}

function buildIntakeActions(flags: IntakeFilterResult): ChatAction[] {
  const actions: ChatAction[] = [];
  if (flags.troRecommended) actions.push({ label: "Request Emergency TRO", href: "/welfare" });
  if (flags.nfrRecommended) actions.push({ label: "Generate NFR Document", href: "/nfr" });
  actions.push({ label: "File Complaint", href: "/complaints" });
  if (flags.violations.some(v => /icwa/i.test(v))) actions.push({ label: "ICWA Rights Guide", intent: "ICWA_GUIDE" });
  actions.push({ label: "Law Library", href: "/law" });
  return actions.slice(0, 4);
}

// ─── AZURE OPENAI SYSTEM PROMPT ───────────────────────────────────────────────

const SOVEREIGN_SYSTEM_PROMPT = `You are COMPANION — the Sovereign Office Legal Assistant for the Mathias El Tribe, serving under the Office of the Chief Justice & Trustee. You are an expert in federal Indian law, tribal sovereignty, ICWA, trust land law, and the sovereign laws of the Mathias El Tribe.

GOVERNING LAW FRAMEWORK:
- Federal: 25 U.S.C. §§ 1901-1963 (ICWA), 18 U.S.C. §§ 1151-1153 (Indian Country jurisdiction), 25 U.S.C. § 5123 (IRA), 25 U.S.C. § 13 (Snyder Act), TLOA (25 U.S.C. § 1302)
- Doctrines: Worcester v. Georgia (31 U.S. 515), Wheeler (435 U.S. 313), Santa Clara Pueblo (436 U.S. 49), Oliphant (435 U.S. 191), Morton v. Mancari (417 U.S. 535), McClanahan (411 U.S. 164), Moe v. Confederated Salish (425 U.S. 463)
- Tribal: SRD-2025 (Sovereign Restoration), SD-2025 (Sovereignty Declaration), SPD-2025 (Sovereign Protection), JM-2025 (Justice Mandate), MRS-2025 (Member Rights), EML-2025 (El Medical Law)
- Canon: All ambiguities resolved in favor of Indian interests (Montana v. Blackfeet Tribe, 471 U.S. 759)
- The Trust Responsibility of the United States is paramount and non-delegable

CRITICAL — SOVEREIGNTY IS INHERENT, NOT BIA-GRANTED:
The Mathias El Tribe's sovereign standing, member rights, and legal protections are INHERENT and self-executing. They flow from lineage, the Treaty of Dancing Rabbit Creek (1830), and inherent indigenous sovereignty — NOT from BIA federal acknowledgment lists, BIE prerequisites, or any federal recognition process.

NEVER condition a member's rights, protections, or tribal standing on BIA list enrollment or federal recognition status. That framing sends members down the wrong path. Rights flow from who they are — descendants of a sovereign people — not from a federal agency's approval.

Specifically:
- Do NOT tell members they must be on the BIA list to access rights or protections
- Do NOT frame eligibility for tribal rights as dependent on federal recognition prerequisites
- Do NOT cite BIE, IHS, NAHASDA, or HUD programs as the primary basis for rights — these are discretionary federal funding streams, not the source of sovereignty
- DO emphasize inherent sovereignty, self-executing treaty protections, and the tribe's own instruments (SRD-2025, MRS-2025, SPD-2025)
- DO distinguish clearly: inherent rights (non-conditional) vs. discretionary federal program funding (which has separate administrative requirements outside the tribe's control)
- When discussing federal programs that do have BIA recognition requirements, note those administrative hurdles honestly but always ground the member's identity and rights in inherent sovereignty first

RESPONSE STYLE:
1. Be clear, concise, and empowering — tribal members need actionable guidance, not bureaucratic dead ends
2. Cite specific statutes and cases when applicable
3. Clearly flag EMERGENCY situations requiring immediate action
4. Recommend specific next steps: file complaint, request TRO, generate NFR, etc.
5. Speak as an officer of the tribe — professional, sovereign, supportive
6. Keep responses focused — avoid unnecessary length
7. Never direct members toward the BIA recognition pathway as a prerequisite for their rights`;

// ─── AZURE OPENAI HANDLER ─────────────────────────────────────────────────────

async function handleAITier(input: ChatInput, intakeFlags: IntakeFilterResult): Promise<ChatResponse> {
  const client = getAzureOpenAIClient();

  const contextParts: string[] = [];
  if (intakeFlags.violations.length > 0) {
    contextParts.push(`INTAKE ANALYSIS:\nViolations: ${intakeFlags.violations.join("; ")}`);
    contextParts.push(`Doctrines triggered: ${intakeFlags.doctrinesTriggered.join("; ")}`);
    contextParts.push(`Posture: ${intakeFlags.canonicalPosture}`);
  }
  if (input.uploadedDocumentText) {
    contextParts.push(`\nUPLOADED DOCUMENT (analyze this):\n${input.uploadedDocumentText.substring(0, 2500)}`);
  }

  const userPrompt = contextParts.length > 0
    ? `${contextParts.join("\n")}\n\nUSER MESSAGE: ${input.message}`
    : input.message;

  if (!client) {
    logger.warn("Azure OpenAI not available for chat — falling back to intake filter result");
    if (intakeFlags.redFlag) {
      const tags = getTagsFromFlags(intakeFlags);
      let lawRefs: ChatLawRef[] = [];
      try {
        const lawData = await queryLawDb(tags);
        lawRefs = [
          ...lawData.federalLaws.slice(0, 3).map(f => ({ title: f.title, citation: f.citation, type: "federal" as const })),
          ...lawData.doctrines.slice(0, 3).map(d => ({ title: d.caseName, citation: d.citation, type: "doctrine" as const })),
        ];
      } catch { /* ok */ }
      return {
        reply: buildIntakeReply(intakeFlags, lawRefs) + "\n\n(Note: AI analysis system is currently unavailable — this assessment is from the federal Indian law intake engine.)",
        tier: "intake_filter",
        tierLabel: "Sovereign Intake Analyzer",
        redFlag: true,
        redFlagMessage: intakeFlags.redBannerMessage ?? undefined,
        lawRefs,
        actions: buildIntakeActions(intakeFlags),
        intakeReport: {
          riskLevel: intakeFlags.indianStatusViolation ? "critical" : "elevated",
          violations: intakeFlags.violations,
          troRecommended: intakeFlags.troRecommended,
          nfrRecommended: intakeFlags.nfrRecommended,
          doctrinesTriggered: intakeFlags.doctrinesTriggered,
          canonicalPosture: intakeFlags.canonicalPosture,
        },
      };
    }
    return hardDefault(input);
  }

  try {
    const result = await callAzureOpenAI(
      SOVEREIGN_SYSTEM_PROMPT,
      userPrompt,
      { maxTokens: 3000, temperature: 0.15, timeoutMs: 45000 },
      input.conversationHistory ?? [],
    );

    logger.info({ tokens: result.usage?.totalTokens, redFlag: intakeFlags.redFlag }, "Chat AI tier completed");

    const actions: ChatAction[] = [];
    if (intakeFlags.troRecommended) actions.push({ label: "Request TRO", href: "/welfare" });
    if (intakeFlags.nfrRecommended) actions.push({ label: "Generate NFR", href: "/nfr" });
    actions.push({ label: "File Complaint", href: "/complaints" });
    actions.push({ label: "Law Library", href: "/law" });

    return {
      reply: result.content,
      tier: "azure_openai",
      tierLabel: "AI Legal Advisor",
      redFlag: intakeFlags.redFlag,
      redFlagMessage: intakeFlags.redBannerMessage ?? undefined,
      azureTokensUsed: result.usage?.totalTokens,
      actions: actions.slice(0, 4),
      intakeReport: intakeFlags.redFlag ? {
        riskLevel: intakeFlags.indianStatusViolation ? "critical" : "elevated",
        violations: intakeFlags.violations,
        troRecommended: intakeFlags.troRecommended,
        nfrRecommended: intakeFlags.nfrRecommended,
        doctrinesTriggered: intakeFlags.doctrinesTriggered,
        canonicalPosture: intakeFlags.canonicalPosture,
      } : undefined,
    };
  } catch (err) {
    logger.warn({ err }, "Azure OpenAI chat call failed — falling back to intake filter");
    if (intakeFlags.redFlag) {
      const tags = getTagsFromFlags(intakeFlags);
      let lawRefs: ChatLawRef[] = [];
      try {
        const lawData = await queryLawDb(tags);
        lawRefs = [
          ...lawData.federalLaws.slice(0, 3).map(f => ({ title: f.title, citation: f.citation, type: "federal" as const })),
          ...lawData.doctrines.slice(0, 3).map(d => ({ title: d.caseName, citation: d.citation, type: "doctrine" as const })),
        ];
      } catch { /* ok */ }
      return {
        reply: buildIntakeReply(intakeFlags, lawRefs) + "\n\n(AI analysis temporarily unavailable — displaying rule-based assessment.)",
        tier: "intake_filter",
        tierLabel: "Sovereign Intake Analyzer",
        redFlag: true,
        redFlagMessage: intakeFlags.redBannerMessage ?? undefined,
        lawRefs,
        actions: buildIntakeActions(intakeFlags),
        intakeReport: {
          riskLevel: intakeFlags.indianStatusViolation ? "critical" : "elevated",
          violations: intakeFlags.violations,
          troRecommended: intakeFlags.troRecommended,
          nfrRecommended: intakeFlags.nfrRecommended,
          doctrinesTriggered: intakeFlags.doctrinesTriggered,
          canonicalPosture: intakeFlags.canonicalPosture,
        },
      };
    }
    return hardDefault(input);
  }
}

function hardDefault(input: ChatInput): ChatResponse {
  return {
    reply: `Thank you for reaching out to the Sovereign Office${input.userName ? `, ${input.userName}` : ""}. To provide you with accurate guidance under federal Indian law, please describe your situation in more detail — what happened, who was involved, and what you need.\n\nI will then:\n• Run it through our federal Indian law assessment\n• Check applicable statutes and tribal doctrines\n• Connect to our AI legal system if needed\n\nAlternatively, you can file a complaint directly, browse the law library, or check your case status.`,
    tier: "hard_default",
    tierLabel: "Sovereign Office Advisor",
    redFlag: false,
    actions: [
      { label: "File a Complaint", href: "/complaints" },
      { label: "Law Library", href: "/law" },
      { label: "Browse Templates", href: "/templates" },
      { label: "My Status", href: "/profile" },
    ],
  };
}

// ─── MAIN ROUTER ─────────────────────────────────────────────────────────────

function buildAlignmentWarning(result: AlignmentResult): AlignmentWarning | undefined {
  if (result.isAligned || !result.maatMessage || !result.severity) return undefined;
  return {
    isAligned: false,
    severity: result.severity,
    maatMessage: result.maatMessage,
    violationCount: result.violations.length,
    categories: [...new Set(result.violations.map(v => v.category))],
    governorConflict: result.governorConflict,
  };
}

// ─── SEND MESSAGE INTENT DETECTION ────────────────────────────────────────────

const SEND_MSG_PATTERNS = [
  /send\s+(?:a\s+)?message\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:saying|:)\s+(.+)/i,
  /message\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:saying|:)\s+(.+)/i,
  /tell\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:that\s+)?(.+)/i,
  /send\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+a\s+message\s*(?::|saying)?\s*(.+)/i,
];

// Pending DM confirmation store — TTL 5 minutes (no external dependency)
interface PendingDmIntent {
  recipientId: number;
  recipientName: string;
  content: string;
  expiresAt: number;
}
const pendingDmIntents = new Map<number, PendingDmIntent>();
const PENDING_DM_TTL_MS = 5 * 60 * 1000;

function clearExpiredPending(): void {
  const now = Date.now();
  for (const [userId, intent] of pendingDmIntents) {
    if (intent.expiresAt <= now) pendingDmIntents.delete(userId);
  }
}

async function executeDmSend(userId: number, intent: PendingDmIntent): Promise<ChatResponse> {
  pendingDmIntents.delete(userId);
  try {
    const existingThread = await db.query.messageThreadsTable.findFirst({
      where: (t, { or, and: a }) =>
        or(
          a(eq(t.participantAId, userId), eq(t.participantBId, intent.recipientId)),
          a(eq(t.participantAId, intent.recipientId), eq(t.participantBId, userId)),
        ),
    });

    let threadId: number;
    if (existingThread) {
      threadId = existingThread.id;
    } else {
      const [canonA, canonB] = userId < intent.recipientId
        ? [userId, intent.recipientId]
        : [intent.recipientId, userId];
      const [newThread] = await db.insert(messageThreadsTable).values({ participantAId: canonA, participantBId: canonB }).returning({ id: messageThreadsTable.id });
      threadId = newThread.id;
    }

    const [newMsg] = await db.insert(directMessagesTable).values({ threadId, senderId: userId, recipientId: intent.recipientId, content: intent.content }).returning();

    await db.update(messageThreadsTable).set({ lastMessageAt: new Date() }).where(eq(messageThreadsTable.id, threadId));

    const { publishMessageEvent } = await import("../lib/redis-memory");
    const event = { type: "new_message", message: newMsg, threadId };
    void publishMessageEvent(intent.recipientId, event);
    void publishMessageEvent(userId, event);

    return {
      reply: `✓ Message sent to **${intent.recipientName}**:\n\n> ${intent.content}\n\nThey will see it in the Community Dashboard. Would you like to open a direct chat?`,
      tier: "funnel",
      tierLabel: "Sovereign Office Messenger",
      redFlag: false,
      actions: [{ label: "Open Community Dashboard", href: "/community-dashboard/directory" }],
    };
  } catch (err) {
    logger.error({ err }, "Companion message-send failed");
    return {
      reply: "I was unable to send the message due to a server error. Please try again.",
      tier: "hard_default",
      tierLabel: "Sovereign Office",
      redFlag: false,
    };
  }
}

async function tryConfirmPendingDm(input: ChatInput): Promise<ChatResponse | null> {
  if (!input.userId) return null;
  clearExpiredPending();
  const pending = pendingDmIntents.get(input.userId);
  if (!pending) return null;

  const msg = input.message.trim().toLowerCase();
  if (/^(yes|confirm|send it|send|go ahead|ok|yep|yeah|sure)\.?$/i.test(msg)) {
    return executeDmSend(input.userId, pending);
  }
  if (/^(no|cancel|nevermind|never mind|stop|abort|don'?t)\.?$/i.test(msg)) {
    pendingDmIntents.delete(input.userId);
    return {
      reply: `Message to **${pending.recipientName}** cancelled. Is there anything else I can help you with?`,
      tier: "funnel",
      tierLabel: "Sovereign Office Messenger",
      redFlag: false,
    };
  }
  return null;
}

async function trySendMessageIntent(input: ChatInput): Promise<ChatResponse | null> {
  if (!input.userId) return null;
  const { message } = input;
  let recipientName: string | null = null;
  let messageContent: string | null = null;
  for (const pat of SEND_MSG_PATTERNS) {
    const m = pat.exec(message);
    if (m) {
      recipientName = m[1].trim();
      messageContent = m[2].trim();
      break;
    }
  }
  if (!recipientName || !messageContent) return null;

  try {
    const candidates = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(and(ilike(usersTable.name, `%${recipientName}%`), ne(usersTable.id, input.userId), eq(usersTable.role, "member")))
      .limit(5);

    if (candidates.length === 0) {
      return {
        reply: `I couldn't find a member named **${recipientName}** in the community. Please check the name and try again, or visit the Family Directory to find the correct spelling.`,
        tier: "funnel",
        tierLabel: "Sovereign Office Advisor",
        redFlag: false,
        actions: [{ label: "Open Family Directory", href: "/community-dashboard/directory" }],
      };
    }

    // If multiple candidates, ask which one
    if (candidates.length > 1) {
      const nameList = candidates.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
      return {
        reply: `I found multiple members matching **${recipientName}**:\n\n${nameList}\n\nPlease be more specific — include their full name to proceed.`,
        tier: "funnel",
        tierLabel: "Sovereign Office Advisor",
        redFlag: false,
      };
    }

    const recipient = candidates[0];

    // Store pending confirmation — require explicit "yes" before sending
    pendingDmIntents.set(input.userId, {
      recipientId: recipient.id,
      recipientName: recipient.name,
      content: messageContent,
      expiresAt: Date.now() + PENDING_DM_TTL_MS,
    });

    return {
      reply: `I found **${recipient.name}** in the community.\n\nShall I send them this message?\n\n> ${messageContent}\n\nReply **yes** to send or **no** to cancel.`,
      tier: "funnel",
      tierLabel: "Sovereign Office Messenger",
      redFlag: false,
    };
  } catch (err) {
    logger.error({ err }, "Companion message-send failed");
    return null;
  }
}

export async function routeChat(input: ChatInput): Promise<ChatResponse> {
  const { message } = input;

  // Companion task mode — step 1: confirm pending DM intent ("yes"/"no")
  const confirmResponse = await tryConfirmPendingDm(input);
  if (confirmResponse) return confirmResponse;

  // Companion task mode — step 2: detect send-message intent and prompt for confirmation
  const msgIntent = await trySendMessageIntent(input);
  if (msgIntent) return msgIntent;

  // Law & Logic Layer — run alignment check on every message (zero cost, synchronous)
  const alignmentResult = checkAlignment(message + (input.uploadedDocumentText ? " " + input.uploadedDocumentText : ""));

  if (!alignmentResult.isAligned) {
    logger.info(
      { severity: alignmentResult.severity, violations: alignmentResult.violations.length, governorConflict: alignmentResult.governorConflict },
      "Law & Logic Layer: alignment drift detected",
    );
  }

  // Always run intake filter first (zero cost — pattern matching)
  const intakeFlags = runIntakeFilter(message + (input.uploadedDocumentText ? " " + input.uploadedDocumentText : ""));

  // Check if AI escalation is needed
  const needsAI = shouldEscalateToAI(input);

  const alignmentWarning = buildAlignmentWarning(alignmentResult);

  // Red flag + complex situation → AI tier
  if (needsAI) {
    const aiResponse = await handleAITier(input, intakeFlags);
    return { ...aiResponse, alignmentWarning };
  }

  // Try funnel match first (zero cost, instant response)
  const funnel = matchFunnel(message);
  if (funnel) {
    let lawRefs: ChatLawRef[] = [];
    if (funnel.lawTags) {
      try {
        const lawData = await queryLawDb(funnel.lawTags);
        lawRefs = [
          ...lawData.federalLaws.slice(0, 2).map(f => ({ title: f.title, citation: f.citation, type: "federal" as const })),
          ...lawData.doctrines.slice(0, 2).map(d => ({ title: d.caseName, citation: d.citation, type: "doctrine" as const })),
        ];
      } catch { /* law DB unavailable, no problem */ }
    }
    return {
      reply: funnel.respond(input),
      tier: "funnel",
      tierLabel: "Sovereign Office Advisor",
      redFlag: intakeFlags.redFlag,
      redFlagMessage: intakeFlags.redBannerMessage ?? undefined,
      lawRefs,
      actions: funnel.actions,
      funnelId: funnel.id,
      alignmentWarning,
      intakeReport: intakeFlags.redFlag ? {
        riskLevel: intakeFlags.indianStatusViolation ? "critical" : "elevated",
        violations: intakeFlags.violations,
        troRecommended: intakeFlags.troRecommended,
        nfrRecommended: intakeFlags.nfrRecommended,
        doctrinesTriggered: intakeFlags.doctrinesTriggered,
        canonicalPosture: intakeFlags.canonicalPosture,
      } : undefined,
    };
  }

  // Red flag with no funnel match → intake filter + law DB (still zero cost)
  if (intakeFlags.redFlag) {
    const tags = getTagsFromFlags(intakeFlags);
    let lawRefs: ChatLawRef[] = [];
    try {
      const lawData = await queryLawDb(tags);
      lawRefs = [
        ...lawData.federalLaws.slice(0, 3).map(f => ({ title: f.title, citation: f.citation, type: "federal" as const })),
        ...lawData.doctrines.slice(0, 3).map(d => ({ title: d.caseName, citation: d.citation, type: "doctrine" as const })),
      ];
    } catch { /* ok */ }
    return {
      reply: buildIntakeReply(intakeFlags, lawRefs),
      tier: "intake_filter",
      tierLabel: "Sovereign Intake Analyzer",
      redFlag: true,
      redFlagMessage: intakeFlags.redBannerMessage ?? undefined,
      lawRefs,
      actions: buildIntakeActions(intakeFlags),
      alignmentWarning,
      intakeReport: {
        riskLevel: intakeFlags.indianStatusViolation ? "critical" : "elevated",
        violations: intakeFlags.violations,
        troRecommended: intakeFlags.troRecommended,
        nfrRecommended: intakeFlags.nfrRecommended,
        doctrinesTriggered: intakeFlags.doctrinesTriggered,
        canonicalPosture: intakeFlags.canonicalPosture,
      },
    };
  }

  // General question — try law DB keyword lookup (zero cost)
  const generalTags = detectGeneralTags(message);
  if (generalTags.length > 0) {
    try {
      const lawData = await queryLawDb(generalTags);
      const lawRefs: ChatLawRef[] = [
        ...lawData.federalLaws.slice(0, 3).map(f => ({ title: f.title, citation: f.citation, type: "federal" as const })),
        ...lawData.tribalLaws.slice(0, 2).map(t => ({ title: t.title, citation: t.citation, type: "tribal" as const })),
        ...lawData.doctrines.slice(0, 3).map(d => ({ title: d.caseName, citation: d.citation, type: "doctrine" as const })),
      ];
      if (lawRefs.length > 0) {
        return {
          reply: `Based on the Sovereign Office law library, here are the applicable laws and doctrines for your question:\n\n${lawRefs.map(r => `• [${r.type.toUpperCase()}] ${r.title} — ${r.citation}`).join("\n")}\n\nWould you like me to explain any of these in detail? Or describe your specific situation and I will provide more targeted guidance.\n\nFor questions about recent court decisions or new legislation, I can escalate to our AI legal analysis system.`,
          tier: "law_db",
          tierLabel: "Law Library",
          redFlag: false,
          lawRefs,
          alignmentWarning,
          actions: [
            { label: "View Law Library", href: "/law" },
            { label: "Describe My Situation", intent: "ANALYZE_SITUATION" },
            { label: "AI Legal Analysis", intent: "AI_ESCALATE" },
          ],
        };
      }
    } catch { /* ok */ }
  }

  // Hard default — catch-all sovereign response
  const defaultResponse = hardDefault(input);
  return { ...defaultResponse, alignmentWarning };
}
