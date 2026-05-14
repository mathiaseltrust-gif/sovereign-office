import { runIntakeFilter, type IntakeFilterResult } from "./intake-filter";
import { queryLawDb } from "./law-db";
import { callAzureOpenAI, getAzureOpenAIClient, type ConversationMessage } from "../lib/azure-openai";
import { logger } from "../lib/logger";

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
      `Indian trust land carries the highest level of federal protection in U.S. law.\n\nKEY PROTECTIONS:\n\n• FEDERAL TRUST RESPONSIBILITY — The U.S. holds a fiduciary duty to protect all Indian trust lands from alienation or encroachment\n• 18 U.S.C. § 1151 — Defines Indian Country to include reservations, dependent Indian communities, and allotments\n• FEDERAL PREEMPTION — State and local laws (zoning, taxation, regulation) are preempted on trust land (McClanahan v. Arizona State Tax Comm'n, 411 U.S. 164 (1973))\n• States cannot tax Indian income derived from Indian Country (Moe v. Confederated Salish, 425 U.S. 463 (1976))\n• Worcester v. Georgia (31 U.S. 515 (1832)) — State laws have no force within Indian territory\n\nIF ANY AGENCY IS ATTEMPTING TO:\n  - Tax your trust land or trust income\n  - Apply county zoning or ordinances to trust land\n  - Assert state jurisdiction over Indian Country\n  - Reclassify trust land as fee land\n\nThis is a federal violation. Our office can issue a State Prohibition Notice, Jurisdictional Enforcement Notice, and Notice of Federal Review.\n\nDescribe your land situation for a full legal assessment.`,
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

const SOVEREIGN_SYSTEM_PROMPT = `You are the Sovereign Office Legal Assistant for the Mathias El Tribe, serving under the Office of the Chief Justice & Trustee. You are an expert in federal Indian law, tribal sovereignty, ICWA, trust land law, and the sovereign laws of the Mathias El Tribe.

GOVERNING LAW FRAMEWORK:
- Federal: 25 U.S.C. §§ 1901-1963 (ICWA), 18 U.S.C. §§ 1151-1153 (Indian Country jurisdiction), 25 U.S.C. § 5123 (IRA), 25 U.S.C. § 13 (Snyder Act), TLOA (25 U.S.C. § 1302)
- Doctrines: Worcester v. Georgia (31 U.S. 515), Wheeler (435 U.S. 313), Santa Clara Pueblo (436 U.S. 49), Oliphant (435 U.S. 191), Morton v. Mancari (417 U.S. 535), McClanahan (411 U.S. 164), Moe v. Confederated Salish (425 U.S. 463)
- Tribal: SRD-2025 (Sovereign Restoration), SD-2025 (Sovereignty Declaration), SPD-2025 (Sovereign Protection), JM-2025 (Justice Mandate), MRS-2025 (Member Rights), EML-2025 (El Medical Law)
- Canon: All ambiguities resolved in favor of Indian interests (Montana v. Blackfeet Tribe, 471 U.S. 759)
- The Trust Responsibility of the United States is paramount and non-delegable

RESPONSE STYLE:
1. Be clear, concise, and empowering — tribal members need actionable guidance
2. Cite specific statutes and cases when applicable
3. Clearly flag EMERGENCY situations requiring immediate action
4. Recommend specific next steps: file complaint, request TRO, generate NFR, etc.
5. Speak as an officer of the tribe — professional, sovereign, supportive
6. Keep responses focused — avoid unnecessary length`;

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
      { maxTokens: 800, temperature: 0.15, timeoutMs: 25000 },
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

export async function routeChat(input: ChatInput): Promise<ChatResponse> {
  const { message } = input;

  // Always run intake filter first (zero cost — pattern matching)
  const intakeFlags = runIntakeFilter(message + (input.uploadedDocumentText ? " " + input.uploadedDocumentText : ""));

  // Check if AI escalation is needed
  const needsAI = shouldEscalateToAI(input);

  // Red flag + complex situation → AI tier
  if (needsAI) {
    return handleAITier(input, intakeFlags);
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
  return hardDefault(input);
}
