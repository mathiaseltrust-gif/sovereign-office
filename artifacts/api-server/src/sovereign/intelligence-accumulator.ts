/**
 * STATUS & IDENTITY INTELLIGENCE ACCUMULATOR
 *
 * Runs in the background after every interaction. Extracts status and identity
 * signals from member messages, builds a living intelligence picture, and
 * produces a priority-ordered action queue. The picture is persisted in
 * COMPANION's knowledge layer so it flows into every subsequent conversation.
 *
 * The system is not just reacting — it is watching, learning the situation,
 * and knowing what must happen, and when.
 */

import { db } from "@workspace/db";
import { kiConversationsTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

export type SignalType =
  | "IDENTITY_CHALLENGED"
  | "PROCEEDING_WITHOUT_STATUS_ASSERTION"
  | "DEBT_COLLECTION_ACTIVE"
  | "CREDIT_REPORTING_ACTIVE"
  | "UNAUTHORIZED_LAND_ENCUMBRANCE"
  | "STATE_JURISDICTION_CLAIMED"
  | "NOTICES_SENT_NO_RESPONSE"
  | "STATUS_NOT_ON_RECORD"
  | "ICWA_PROCEEDING_DETECTED"
  | "ADMINISTRATIVE_CAPITULATION_RISK";

export type ActionPriority = "IMMEDIATE" | "THIS_WEEK" | "THIS_MONTH";
export type ActionStatus = "pending" | "suggested" | "taken" | "dismissed";

export type ActionCode =
  | "GENERATE_STATUS_AFFIRMATION"
  | "FILE_ENROLLMENT_VERIFICATION"
  | "SEND_DEBT_VALIDATION_DEMAND"
  | "FILE_CREDIT_DISPUTE"
  | "ISSUE_NFR"
  | "FILE_JURISDICTIONAL_STATEMENT"
  | "ESTABLISH_ADMINISTRATIVE_RECORD"
  | "FILE_ICWA_NOTICE"
  | "ASSERT_SOVEREIGN_IDENTITY"
  | "ISSUE_CEASE_DESIST";

export interface ActionItem {
  action: ActionCode;
  label: string;
  priority: ActionPriority;
  rationale: string;
  triggeredBy: SignalType[];
  deadline?: string;
  status: ActionStatus;
  detectedAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
}

export interface StatusSignal {
  type: SignalType;
  detectedAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  context: string;
}

export interface MemberIntelligencePicture {
  userId: number;
  updatedAt: string;
  signals: StatusSignal[];
  actionQueue: ActionItem[];
  summaryForCompanion: string;
}

// ─── SIGNAL EXTRACTION RULES ─────────────────────────────────────────────────

interface SignalRule {
  type: SignalType;
  patterns: RegExp[];
  negativePatterns: RegExp[];
}

const SIGNAL_RULES: SignalRule[] = [
  {
    type: "IDENTITY_CHALLENGED",
    patterns: [
      /they\s+(say|claim|assert|argue|allege|told\s+me).{0,40}(I'?m\s+not|I\s+am\s+not|not\s+really|we'?re\s+not)\s+(Indian|Native|tribal|indigenous|enrolled|member)/i,
      /question(ing)?.{0,20}(my|our).{0,10}(enrollment|status|membership|identity|Indian|tribal)/i,
      /denied?.{0,20}(my|our).{0,10}(Indian|tribal|native|sovereign)\s+status/i,
      /not\s+recogniz(ing|ed).{0,20}(my|our|as)\s+(Indian|tribal|sovereign|member)/i,
      /they\s+(don'?t|do\s+not)\s+recognize\s+(me|us)\s+as\s+(Indian|Native|tribal|member)/i,
      /disputing\s+(my|our)\s+(enrollment|membership|Indian|tribal)\s+status/i,
    ],
    negativePatterns: [
      /\b(stop|prevent|document|assert|prove|affirm|record)\b.{0,20}(status|identity|Indian|enrollment)/i,
    ],
  },
  {
    type: "PROCEEDING_WITHOUT_STATUS_ASSERTION",
    patterns: [
      /\b(court\s+)?(hearing|proceeding|case|lawsuit)\b.{0,40}\b(scheduled|set|coming|upcoming|next\s+week|tomorrow|soon)\b/i,
      /they\s+(filed|are\s+filing|have\s+filed).{0,30}against\s+(me|us)/i,
      /\b(lawsuit|legal\s+action|complaint\s+filed)\b.{0,30}\b(against|on)\b/i,
      /\b(foreclos|evict|repossess|garnish).{0,20}\b(my|our|the)\b/i,
      /\b(appear\s+in|go\s+to|attend|have\s+to\s+be\s+in).{0,20}(court|hearing|proceeding)/i,
      /\b(order\s+to\s+show\s+cause|summons?|subpoena)\b/i,
    ],
    negativePatterns: [],
  },
  {
    type: "DEBT_COLLECTION_ACTIVE",
    patterns: [
      /\b(debt\s+collector|collection\s+agenc|servicer|mortgage\s+compan|carrington|creditor)\b.{0,40}\b(calling|sending|reporting|collecting|threaten|contact|harass)\b/i,
      /\b(collect(ing)?|trying\s+to\s+collect).{0,20}(a\s+)?debt\b/i,
      /they\s+(sent|keep\s+sending|are\s+sending).{0,20}\b(letters?|notices?|bills?|demands?)\b/i,
      /\b(collection\s+calls?|collection\s+letters?|debt\s+collection)\b/i,
      /\b(harassing|harassment).{0,20}(calls?|letters?|messages?|contacts?)\b/i,
      /\bowing\s+(money|a\s+debt)\b.{0,30}\b(they|collector|servicer|bank|carrington)\b/i,
    ],
    negativePatterns: [
      /\b(stopped?|ceased?|halted?|validated?)\b.{0,20}(collecting|collection)/i,
      /already\s+sent\s+(the\s+)?(validation|demand)\b/i,
    ],
  },
  {
    type: "CREDIT_REPORTING_ACTIVE",
    patterns: [
      /\b(credit\s+bureau|equifax|experian|transunion)\b.{0,30}\b(report|reporting|placed|item|account|listed)\b/i,
      /\b(placed?|putting|reporting|listed?|showing)\b.{0,20}\b(on|to)\b.{0,10}\b(my|our)\b.{0,10}\b(credit|credit\s+file|credit\s+report|person(al)?\s+credit)\b/i,
      /\b(hurt(ing)?|damag(ing)?|affecting?|impacting?)\b.{0,20}\b(my|our)\b.{0,10}\b(credit|credit\s+score|credit\s+report)\b/i,
      /places?\s+thing\s+on\s+(my|our)\s+person/i,
    ],
    negativePatterns: [],
  },
  {
    type: "UNAUTHORIZED_LAND_ENCUMBRANCE",
    patterns: [
      /\b(mortgage|lien|encumbrance|foreclos)\b.{0,30}\b(on|against)\b.{0,20}\b(the\s+|my\s+|our\s+)?(restricted|trust|Indian|tribal)?\s*(land|property|allotment)\b/i,
      /\bforce\s*(d)?\s*(clos|close|foreclos)\b/i,
      /\b(restrict(ed)?|trust)\s+land\b.{0,30}\b(mortgage|lien|encumbrance|foreclos)\b/i,
      /\b(foreclos|seize)\b.{0,20}\b(restricted|trust|Indian)\b/i,
    ],
    negativePatterns: [
      /\b(stop|prevent|void|invalid|unauthorized|challenge|blocked?)\b.{0,20}(foreclos|lien|mortgage|encumbrance)\b/i,
    ],
  },
  {
    type: "STATE_JURISDICTION_CLAIMED",
    patterns: [
      /\b(state|county)\s+(court|judge|agency|department)\b.{0,30}\b(jurisdiction|authority|power|over|said|order|ruling)\b/i,
      /\b(superior\s+court|district\s+court|municipal\s+court|circuit\s+court)\b.{0,30}\b(over|on|about|for|has|have)\b/i,
      /\b(state|county)\b.{0,20}\b(claim(ing|s)?|assert(ing|s)?|has|have)\b.{0,20}\bjurisdiction\b/i,
      /\b(state|county)\b.{0,20}\b(told|said|ordered|notified)\b.{0,20}\b(me|us)\b/i,
    ],
    negativePatterns: [
      /\b(object|challenge|deny|contest|remove|transfer|no\s+jurisdiction|federal\s+court)\b/i,
    ],
  },
  {
    type: "NOTICES_SENT_NO_RESPONSE",
    patterns: [
      /\bsent\b.{0,30}\b(notices?|letters?|orders?|demands?)\b.{0,40}\b(no\s+response|ignored|disregarded|no\s+reply|never\s+responded?)\b/i,
      /\b(they|the\s+bank|the\s+servicer|the\s+creditor|carrington)\b.{0,30}\b(ignored|disregarded|didn'?t\s+respond|never\s+responded?)\b/i,
      /\b(multiple|several|many)\b.{0,15}\b(notices?|letters?|requests?)\b.{0,30}\b(no|without)\s+(response|reply|answer)\b/i,
      /sent\s+(multiple\s+)?(notices?\s+and\s+orders?|orders?\s+and\s+notices?)/i,
    ],
    negativePatterns: [],
  },
  {
    type: "STATUS_NOT_ON_RECORD",
    patterns: [
      /nobody\s+knows\s+(I'?m|we'?re|that\s+(I|we)'?re)\s+(Indian|tribal|Native|enrolled)/i,
      /never\s+(filed|asserted|documented|recorded)\s+(my|our)\s+(Indian|tribal|sovereign)\s+status/i,
      /\b(not\s+on\s+record|not\s+documented|not\s+filed)\b.{0,30}\b(status|identity|enrollment|tribal)/i,
      /they\s+don'?t\s+(have|know)\s+(my|our)\s+(Indian|tribal|enrollment|status)\s+(on\s+file|documented|recorded)\b/i,
    ],
    negativePatterns: [],
  },
  {
    type: "ICWA_PROCEEDING_DETECTED",
    patterns: [
      /\b(child|children|custody|placement|foster|adoption|removal|welfare)\b.{0,30}\b(court|proceeding|case|hearing|order|CPS|DCFS|DHS)\b/i,
      /\b(CPS|DCFS|DHS|child\s+protective\s+services|social\s+services)\b.{0,30}\b(involved|investigation|case|visit|hearing)\b/i,
      /\b(my|our)\s+(child|children|kids?|son|daughter)\b.{0,30}\b(removed|taken|placed|custody|foster)\b/i,
    ],
    negativePatterns: [],
  },
  {
    type: "ADMINISTRATIVE_CAPITULATION_RISK",
    patterns: [
      /\b(just|maybe|thinking\s+about)\b.{0,20}\b(pay(ing)?|settle|settling|paying\s+it|paying\s+them|pay\s+it\s+off)\b/i,
      /\b(accept|agree\s+to|go\s+along\s+with)\b.{0,30}\b(their|the)\b.{0,20}\b(offer|demand|settlement|terms)\b/i,
      /\b(give\s+(them|up)|surrender|cave|back\s+down)\b.{0,30}\b(rights?|land|status|claim)\b/i,
      /maybe\s+I\s+(should|just)\s+(pay|settle|give|accept|agree)/i,
    ],
    negativePatterns: [
      /\b(don'?t|do\s+not|cannot|must\s+not|should\s+not)\b.{0,20}\b(pay|settle|give|accept|agree)\b/i,
    ],
  },
];

// ─── ACTION MAPPING ───────────────────────────────────────────────────────────

interface ActionDef {
  action: ActionCode;
  label: string;
  priority: ActionPriority;
  rationale: string;
  triggeredBy: SignalType[];
}

const ACTION_DEFINITIONS: ActionDef[] = [
  {
    action: "GENERATE_STATUS_AFFIRMATION",
    label: "Generate Sovereign Status Affirmation Document",
    priority: "IMMEDIATE",
    rationale: "Your Indian status has been challenged or has not been placed on record in an active proceeding. A Status Affirmation from the Sovereign Office formally declares tribal membership, enrollment, and all federal protections — putting the challenging party on legal notice.",
    triggeredBy: ["IDENTITY_CHALLENGED", "STATUS_NOT_ON_RECORD"],
  },
  {
    action: "FILE_ENROLLMENT_VERIFICATION",
    label: "File Tribal Enrollment Verification in Active Proceeding",
    priority: "IMMEDIATE",
    rationale: "An active proceeding (court, agency, foreclosure) is underway and Indian status has not been formally entered into the record. Federal ICWA, FDCPA sovereign status protections, and preemption doctrines cannot be triggered until status is on the record of that proceeding.",
    triggeredBy: ["PROCEEDING_WITHOUT_STATUS_ASSERTION", "IDENTITY_CHALLENGED"],
  },
  {
    action: "SEND_DEBT_VALIDATION_DEMAND",
    label: "Issue FDCPA Debt Validation Demand — Halts All Collection Immediately",
    priority: "IMMEDIATE",
    rationale: "Active debt collection is ongoing. A written Debt Validation Demand (FDCPA § 1692g) sent by certified mail immediately halts all collection activity. The creditor then has 30 days to prove the debt is valid and legally enforceable against you. Failure to validate means the debt cannot legally be collected. The window runs from first contact — do not wait.",
    triggeredBy: ["DEBT_COLLECTION_ACTIVE", "UNAUTHORIZED_LAND_ENCUMBRANCE"],
  },
  {
    action: "FILE_CREDIT_DISPUTE",
    label: "File FCRA Dispute with Equifax, Experian, and TransUnion",
    priority: "THIS_WEEK",
    rationale: "Unauthorized credit reporting is active. An FCRA dispute (15 U.S.C. § 1681i) triggers a mandatory 30-day investigation. The bureau must notify the furnisher, who must investigate and remove inaccurate or unauthorized information. Your sovereign status and restricted land protections are grounds for dispute. File with all three bureaus — certified mail, return receipt.",
    triggeredBy: ["CREDIT_REPORTING_ACTIVE"],
  },
  {
    action: "ISSUE_NFR",
    label: "Issue Notice of Federal Review — Unauthorized Encumbrance on Restricted Land",
    priority: "IMMEDIATE",
    rationale: "A mortgage, lien, or foreclosure action on restricted Indian land is void under the Nonintercourse Act (25 U.S.C. § 177) without Secretary of Interior authorization. A Notice of Federal Review formally notifies all parties of this federal law, creates a permanent administrative record, and invokes federal jurisdiction over the matter.",
    triggeredBy: ["UNAUTHORIZED_LAND_ENCUMBRANCE", "STATE_JURISDICTION_CLAIMED"],
  },
  {
    action: "FILE_JURISDICTIONAL_STATEMENT",
    label: "File Jurisdictional Statement — Assert Tribal Sovereignty Over This Matter",
    priority: "THIS_WEEK",
    rationale: "A state or county actor is claiming or exercising jurisdiction over a matter involving a tribal member on tribal or trust land. A Jurisdictional Statement, issued from this office, formally notifies the state actor of federal preemption under Worcester v. Georgia and McClanahan, and asserts exclusive tribal and/or federal jurisdiction.",
    triggeredBy: ["STATE_JURISDICTION_CLAIMED", "PROCEEDING_WITHOUT_STATUS_ASSERTION"],
  },
  {
    action: "ESTABLISH_ADMINISTRATIVE_RECORD",
    label: "Establish Certified Administrative Record of All Communications Sent",
    priority: "THIS_WEEK",
    rationale: "Notices and orders have been sent and ignored. A certified, notarized administrative record of all communications — with dates, methods, and content — is critical evidence for federal remedies. When a creditor, servicer, or agency ignores sovereign notices, the administrative record becomes the foundation for FDCPA violations claims and federal court action.",
    triggeredBy: ["NOTICES_SENT_NO_RESPONSE", "ADMINISTRATIVE_CAPITULATION_RISK"],
  },
  {
    action: "FILE_ICWA_NOTICE",
    label: "File ICWA Notice of Proceeding — Mandatory Federal Filing",
    priority: "IMMEDIATE",
    rationale: "A child welfare, custody, or placement proceeding has been detected involving a tribal member's child. Under ICWA (25 U.S.C. § 1912), the court must provide 10 days notice to the tribe before any placement decision. Failure to file ICWA notice is reversible error — any placement made without it can be challenged.",
    triggeredBy: ["ICWA_PROCEEDING_DETECTED"],
  },
  {
    action: "ASSERT_SOVEREIGN_IDENTITY",
    label: "Assert Sovereign Identity in All Active Matters",
    priority: "THIS_WEEK",
    rationale: "Multiple active matters exist where sovereign identity has not been formally asserted. A comprehensive identity assertion package — Status Affirmation, enrollment verification, land status declaration — should be served on all relevant parties simultaneously to establish the legal framework for all ongoing matters.",
    triggeredBy: ["IDENTITY_CHALLENGED", "STATUS_NOT_ON_RECORD", "PROCEEDING_WITHOUT_STATUS_ASSERTION"],
  },
  {
    action: "ISSUE_CEASE_DESIST",
    label: "Issue Sovereign Cease & Desist — Stop All Unauthorized Activity",
    priority: "IMMEDIATE",
    rationale: "There is risk of capitulation to external pressure without first asserting all sovereign protections. A Cease & Desist issued from this office orders the external actor to halt all collection, reporting, and encumbrance activity pending federal review — and puts them on notice of the full scope of federal law violations in play.",
    triggeredBy: ["ADMINISTRATIVE_CAPITULATION_RISK", "DEBT_COLLECTION_ACTIVE", "CREDIT_REPORTING_ACTIVE"],
  },
];

// ─── SIGNAL EXTRACTION ────────────────────────────────────────────────────────

export function extractSignals(text: string): SignalType[] {
  const detected: SignalType[] = [];
  for (const rule of SIGNAL_RULES) {
    const matches = rule.patterns.some(p => p.test(text));
    if (!matches) continue;
    const excluded = rule.negativePatterns.some(np => np.test(text));
    if (excluded) continue;
    detected.push(rule.type);
  }
  return detected;
}

// ─── ACTION QUEUE BUILDER ─────────────────────────────────────────────────────

function buildActionQueue(signals: StatusSignal[]): ActionItem[] {
  const activeSignalTypes = new Set(signals.map(s => s.type));
  const now = new Date().toISOString();
  const queue: ActionItem[] = [];

  for (const def of ACTION_DEFINITIONS) {
    const triggering = def.triggeredBy.filter(t => activeSignalTypes.has(t));
    if (triggering.length === 0) continue;

    const relatedSignals = signals.filter(s => triggering.includes(s.type));
    const earliestDetected = relatedSignals.reduce((min, s) => s.detectedAt < min ? s.detectedAt : min, relatedSignals[0]?.detectedAt ?? now);
    const latestSeen = relatedSignals.reduce((max, s) => s.lastSeenAt > max ? s.lastSeenAt : max, relatedSignals[0]?.lastSeenAt ?? now);
    const totalOccurrences = relatedSignals.reduce((sum, s) => sum + s.occurrenceCount, 0);

    queue.push({
      action: def.action,
      label: def.label,
      priority: def.priority,
      rationale: def.rationale,
      triggeredBy: triggering,
      status: "pending",
      detectedAt: earliestDetected,
      lastSeenAt: latestSeen,
      occurrenceCount: totalOccurrences,
    });
  }

  const priorityOrder: Record<ActionPriority, number> = { IMMEDIATE: 0, THIS_WEEK: 1, THIS_MONTH: 2 };
  queue.sort((a, b) => {
    const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pd !== 0) return pd;
    return b.occurrenceCount - a.occurrenceCount;
  });

  return queue;
}

// ─── COMPANION SUMMARY BUILDER ────────────────────────────────────────────────

function buildSummaryForCompanion(picture: Omit<MemberIntelligencePicture, "summaryForCompanion">): string {
  if (picture.signals.length === 0) return "";

  const lines: string[] = [
    "═══════════════════════════════════════════════",
    "INTELLIGENCE PICTURE — STATUS & IDENTITY",
    `(Built from ${picture.signals.length} signal(s) across interactions · Updated ${new Date(picture.updatedAt).toLocaleDateString()})`,
    "═══════════════════════════════════════════════",
    "",
    "ACTIVE SITUATION SIGNALS:",
  ];

  for (const sig of picture.signals) {
    const freq = sig.occurrenceCount > 1 ? ` (mentioned ${sig.occurrenceCount}x)` : "";
    lines.push(`▸ ${sig.type.replace(/_/g, " ")}${freq}`);
    if (sig.context) lines.push(`  Context: "${sig.context.substring(0, 120)}${sig.context.length > 120 ? "…" : ""}"`);
  }

  if (picture.actionQueue.length > 0) {
    lines.push("");
    lines.push("PROACTIVE ACTION QUEUE (Priority-Ordered):");
    lines.push("These are the actions this member should take, in order. Surface them when relevant.");
    lines.push("");

    const immediate = picture.actionQueue.filter(a => a.priority === "IMMEDIATE");
    const thisWeek = picture.actionQueue.filter(a => a.priority === "THIS_WEEK");
    const thisMonth = picture.actionQueue.filter(a => a.priority === "THIS_MONTH");

    if (immediate.length > 0) {
      lines.push("⚡ IMMEDIATE (do now, today):");
      for (const a of immediate) {
        lines.push(`  • ${a.label}`);
        lines.push(`    Why: ${a.rationale.substring(0, 200)}${a.rationale.length > 200 ? "…" : ""}`);
      }
    }
    if (thisWeek.length > 0) {
      lines.push("");
      lines.push("▸ THIS WEEK:");
      for (const a of thisWeek) {
        lines.push(`  • ${a.label}`);
        lines.push(`    Why: ${a.rationale.substring(0, 180)}${a.rationale.length > 180 ? "…" : ""}`);
      }
    }
    if (thisMonth.length > 0) {
      lines.push("");
      lines.push("▸ THIS MONTH:");
      for (const a of thisMonth) {
        lines.push(`  • ${a.label}`);
      }
    }

    lines.push("");
    lines.push("COMPANION INSTRUCTION: When the member speaks about any of these situations, do not wait to be asked. Proactively surface the relevant action from this queue. Use the rationale to explain why it matters and when. You are not reacting — you are guiding.");
  }

  lines.push("═══════════════════════════════════════════════");
  return lines.join("\n");
}

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────

const INTEL_CATEGORY = "_intel_picture";

async function loadPicture(userId: number): Promise<MemberIntelligencePicture | null> {
  try {
    const [row] = await db
      .select({ content: kiConversationsTable.content })
      .from(kiConversationsTable)
      .where(and(
        eq(kiConversationsTable.userId, userId),
        eq(kiConversationsTable.role, "knowledge"),
        eq(kiConversationsTable.category, INTEL_CATEGORY),
      ))
      .orderBy(desc(kiConversationsTable.createdAt))
      .limit(1);

    if (!row) return null;
    return JSON.parse(row.content) as MemberIntelligencePicture;
  } catch {
    return null;
  }
}

async function savePicture(picture: MemberIntelligencePicture): Promise<void> {
  await db.insert(kiConversationsTable).values({
    userId: picture.userId,
    role: "knowledge",
    content: JSON.stringify(picture),
    category: INTEL_CATEGORY,
    isDiary: false,
    createdAt: new Date(),
  });
}

// ─── MAIN ACCUMULATOR ─────────────────────────────────────────────────────────

export async function accumulateIntelligence(
  userId: number,
  messageText: string,
): Promise<MemberIntelligencePicture | null> {
  try {
    const newSignalTypes = extractSignals(messageText);
    if (newSignalTypes.length === 0) {
      return null;
    }

    const existing = await loadPicture(userId);
    const now = new Date().toISOString();
    const contextSnippet = messageText.substring(0, 150);

    const signals: StatusSignal[] = existing?.signals ? [...existing.signals] : [];

    for (const type of newSignalTypes) {
      const existing_signal = signals.find(s => s.type === type);
      if (existing_signal) {
        existing_signal.lastSeenAt = now;
        existing_signal.occurrenceCount++;
        if (existing_signal.context.length < 300) {
          existing_signal.context += ` | ${contextSnippet}`;
        }
      } else {
        signals.push({
          type,
          detectedAt: now,
          lastSeenAt: now,
          occurrenceCount: 1,
          context: contextSnippet,
        });
      }
    }

    const actionQueue = buildActionQueue(signals);

    const pictureBase = { userId, updatedAt: now, signals, actionQueue };
    const picture: MemberIntelligencePicture = {
      ...pictureBase,
      summaryForCompanion: buildSummaryForCompanion(pictureBase),
    };

    await savePicture(picture);

    logger.info(
      {
        userId,
        newSignals: newSignalTypes,
        totalSignals: signals.length,
        queueLength: actionQueue.length,
        immediateActions: actionQueue.filter(a => a.priority === "IMMEDIATE").length,
      },
      "Intelligence accumulator: picture updated",
    );

    return picture;
  } catch (err) {
    logger.warn({ err: (err as Error).message, userId }, "Intelligence accumulator: failed to update picture");
    return null;
  }
}

export async function getIntelligencePicture(userId: number): Promise<MemberIntelligencePicture | null> {
  return loadPicture(userId);
}

export async function getCompanionIntelContext(userId: number): Promise<string> {
  const picture = await getIntelligencePicture(userId);
  if (!picture || picture.signals.length === 0) return "";
  return picture.summaryForCompanion;
}
