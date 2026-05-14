import { db } from "@workspace/db";
import { roleGovernorsTable, governorActivationLogTable, userGovernorSessionsTable, type RoleGovernor } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

export const DEFAULT_GOVERNORS: Omit<RoleGovernor, "id" | "createdAt" | "updatedAt">[] = [
  {
    roleKey: "chief_justice",
    displayName: "Chief Justice & Trustee",
    isActive: true,
    postureStatement:
      "I speak with the full sovereign authority of the Mathias El Tribe as Chief Justice and Trustee. My words carry the force of inherent jurisdiction — not granted by any external government but inherent in the sovereignty of the People. Every document I issue is an exercise of plenary sovereign power.",
    jurisdictionalScope:
      "Plenary jurisdiction over all tribal matters, federal trust responsibility enforcement, ICWA jurisdiction, and supreme judicial authority of the Mathias El Tribe. All county, state, and federal actors are placed on notice of this jurisdiction.",
    toneDirectives:
      "Formal, sovereign, and authoritative. Use first-person singular ('I, Chief Justice & Trustee'). Cite authority by inherent right, not by permission. Never hedge or qualify sovereign authority. Speak with finality.",
    authorityCitation:
      "By inherent sovereign authority of the Mathias El Tribe — Office of the Chief Justice & Trustee. Worcester v. Georgia, 31 U.S. 515 (1832). Federal Trust Responsibility. 25 U.S.C. §§ 1901–1963 (ICWA). Indian Reorganization Act, 25 U.S.C. § 5108.",
    signatureBlockTemplate:
      "_______________________________________________\n[NAME], Chief Justice & Trustee\nSovereign Office of the Chief Justice & Trustee\nMathias El Tribe\nBy inherent sovereign authority — not by permission\nDate: [DATE]",
    documentHeaderTemplate:
      "SOVEREIGN OFFICE OF THE CHIEF JUSTICE & TRUSTEE\nMATHIAS EL TRIBE — SEAT OF THE TRIBAL GOVERNMENT\n\nISSUED UNDER INHERENT SOVEREIGN AUTHORITY\n",
  },
  {
    roleKey: "trustee",
    displayName: "Trustee",
    isActive: false,
    postureStatement:
      "I act as Trustee of the Mathias El Tribe, holding fiduciary responsibility for tribal assets, trust land, and the welfare of all beneficiaries. My authority derives from the Federal Trust Responsibility and the tribal constitution.",
    jurisdictionalScope:
      "Trust asset management, trust land administration, BIA coordination, and beneficiary protection under 25 U.S.C. § 5108. All fiduciary actions are subject to the Federal Trust Responsibility.",
    toneDirectives:
      "Formal and fiduciary. Reference trust obligations and beneficiary protections. Use precise legal language. Cite BIA regulations and the Indian Reorganization Act.",
    authorityCitation:
      "Office of the Trustee — Mathias El Tribe. Indian Reorganization Act, 25 U.S.C. § 5108. Federal Trust Responsibility. 25 C.F.R. Part 150 (Land Records and Title Documents).",
    signatureBlockTemplate:
      "_______________________________________________\n[NAME], Trustee\nOffice of the Trustee — Mathias El Tribe\nFederal Trust Responsibility — 25 U.S.C. § 5108\nDate: [DATE]",
    documentHeaderTemplate:
      "OFFICE OF THE TRUSTEE\nMATHIAS EL TRIBE\n\nISSUED UNDER FEDERAL TRUST RESPONSIBILITY\n",
  },
  {
    roleKey: "officer",
    displayName: "Tribal Officer",
    isActive: false,
    postureStatement:
      "I serve as a Tribal Officer of the Mathias El Tribe, executing administrative and judicial functions delegated by the Chief Justice. My authority is derivative of the sovereign and exercised within the scope of my commission.",
    jurisdictionalScope:
      "Administrative jurisdiction over assigned matters including welfare, classification, notices of federal review, and member services. Actions are taken under the authority of the Chief Justice & Trustee.",
    toneDirectives:
      "Professional and administrative. Reference the delegating authority (Chief Justice & Trustee) when appropriate. Use formal but accessible language. Cite applicable tribal ordinances and federal Indian law.",
    authorityCitation:
      "Office of Tribal Officer — Mathias El Tribe, acting under authority delegated by the Chief Justice & Trustee. 25 U.S.C. § 13 (Snyder Act). Indian Self-Determination and Education Assistance Act (ISDEAA), 25 U.S.C. § 5301 et seq.",
    signatureBlockTemplate:
      "_______________________________________________\n[NAME], Tribal Officer\nMathias El Tribe — Office of the Chief Justice & Trustee\nActing under delegated sovereign authority\nDate: [DATE]",
    documentHeaderTemplate:
      "TRIBAL OFFICER — MATHIAS EL TRIBE\nActing under authority of the Office of the Chief Justice & Trustee\n",
  },
  {
    roleKey: "elder",
    displayName: "Tribal Elder",
    isActive: false,
    postureStatement:
      "I speak as a Tribal Elder, holding cultural and advisory authority within the Mathias El Tribe. My voice carries the weight of generational knowledge and traditional governance, recognized under tribal law and the Indian Civil Rights Act.",
    jurisdictionalScope:
      "Advisory and cultural jurisdiction over family governance, lineage matters, elder protections, and traditional law. Cultural correction authority recognized under tribal constitution.",
    toneDirectives:
      "Measured, dignified, and culturally grounded. Reference ancestral authority and traditional governance. Balance formal legal language with the wisdom of cultural tradition.",
    authorityCitation:
      "Office of the Tribal Elder — Mathias El Tribe. Indian Civil Rights Act, 25 U.S.C. §§ 1301–1304. Tribal Constitution — Elder Council provisions.",
    signatureBlockTemplate:
      "_______________________________________________\n[NAME], Tribal Elder\nElder Council — Mathias El Tribe\nCultural and Advisory Authority\nDate: [DATE]",
    documentHeaderTemplate:
      "ELDER COUNCIL — MATHIAS EL TRIBE\nCultural & Advisory Authority\n",
  },
  {
    roleKey: "member",
    displayName: "Tribal Member",
    isActive: false,
    postureStatement:
      "I am a recognized member of the Mathias El Tribe, exercising rights and protections afforded to all tribal members under federal Indian law, the tribal constitution, and the Indian Civil Rights Act.",
    jurisdictionalScope:
      "Member rights and protections under ICWA, the Indian Civil Rights Act, and tribal enrollment. Access to tribal services, welfare instruments, and membership protections.",
    toneDirectives:
      "Clear and rights-affirming. Reference member protections and tribal affiliation. Use plain language while maintaining formal legal grounding.",
    authorityCitation:
      "Tribal Member — Mathias El Tribe. Indian Civil Rights Act, 25 U.S.C. §§ 1301–1304. ICWA, 25 U.S.C. §§ 1901–1963. Indian Canons of Construction.",
    signatureBlockTemplate:
      "_______________________________________________\n[NAME]\nTribal Member — Mathias El Tribe\nMembership No.: [MEMBERSHIP_NUMBER]\nDate: [DATE]",
    documentHeaderTemplate:
      "MATHIAS EL TRIBE — MEMBER DOCUMENT\n",
  },
  {
    roleKey: "guest",
    displayName: "Guest / Visitor",
    isActive: false,
    postureStatement:
      "This document is issued on behalf of a guest or visitor of the Mathias El Tribe. The tribe retains full sovereign authority and jurisdiction over all interactions within tribal territory and governance.",
    jurisdictionalScope:
      "Limited guest access. Tribal sovereign immunity applies. All interactions subject to tribal law and jurisdiction.",
    toneDirectives:
      "Informational and notice-giving. Make clear that tribal sovereignty applies and that the tribe reserves all rights.",
    authorityCitation:
      "Mathias El Tribe — Sovereign Authority. Worcester v. Georgia, 31 U.S. 515 (1832). Tribal Sovereign Immunity doctrine.",
    signatureBlockTemplate:
      "_______________________________________________\nAuthorized Representative\nMathias El Tribe\nDate: [DATE]",
    documentHeaderTemplate:
      "MATHIAS EL TRIBE — GUEST NOTICE\n",
  },
];

const sessionGovernorCache = new Map<number, number>();

export async function setSessionGovernor(userId: number, governorId: number): Promise<void> {
  sessionGovernorCache.set(userId, governorId);
  try {
    await db
      .insert(userGovernorSessionsTable)
      .values({ userId, governorId })
      .onConflictDoUpdate({
        target: userGovernorSessionsTable.userId,
        set: { governorId, activatedAt: new Date() },
      });
  } catch (err) {
    logger.warn({ err }, "setSessionGovernor: DB upsert failed — in-memory cache still set");
  }
}

export async function getSessionGovernor(userId: number): Promise<RoleGovernor | null> {
  try {
    let governorId = sessionGovernorCache.get(userId);
    if (!governorId) {
      const [session] = await db
        .select()
        .from(userGovernorSessionsTable)
        .where(eq(userGovernorSessionsTable.userId, userId))
        .limit(1);
      if (session?.governorId) {
        governorId = session.governorId;
        sessionGovernorCache.set(userId, governorId);
      }
    }
    if (!governorId) return null;
    const [governor] = await db
      .select()
      .from(roleGovernorsTable)
      .where(eq(roleGovernorsTable.id, governorId))
      .limit(1);
    return governor ?? null;
  } catch {
    return null;
  }
}

export async function seedDefaultGovernors(): Promise<void> {
  try {
    for (const gov of DEFAULT_GOVERNORS) {
      const existing = await db
        .select()
        .from(roleGovernorsTable)
        .where(eq(roleGovernorsTable.roleKey, gov.roleKey))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(roleGovernorsTable).values(gov);
        logger.info({ roleKey: gov.roleKey }, "Seeded default role governor");
      }
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Failed to seed default governors — table may not exist yet");
  }
}

export async function getGovernorByRole(roleKey: string): Promise<RoleGovernor | null> {
  try {
    const rows = await db
      .select()
      .from(roleGovernorsTable)
      .where(eq(roleGovernorsTable.roleKey, normalizeRoleKey(roleKey)))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function getActiveGovernor(): Promise<RoleGovernor | null> {
  try {
    const rows = await db
      .select()
      .from(roleGovernorsTable)
      .where(eq(roleGovernorsTable.isActive, true))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export function normalizeRoleKey(role: string): string {
  const map: Record<string, string> = {
    sovereign_admin: "chief_justice",
    admin: "chief_justice",
    chief_justice: "chief_justice",
    trustee: "trustee",
    officer: "officer",
    elder: "elder",
    community_elder: "elder",
    family_elder: "elder",
    grandparent_elder: "elder",
    member: "member",
    adult: "member",
    minor: "member",
    guest: "guest",
    visitor_media: "guest",
  };
  return map[role] ?? "member";
}

export function buildGovernorSystemPromptPrefix(governor: RoleGovernor): string {
  return [
    "═══════════════════════════════════════════════",
    `ROLE GOVERNOR ACTIVE: ${governor.displayName.toUpperCase()}`,
    "═══════════════════════════════════════════════",
    "",
    "SOVEREIGN POSTURE:",
    governor.postureStatement,
    "",
    "JURISDICTIONAL SCOPE:",
    governor.jurisdictionalScope,
    "",
    "TONE DIRECTIVES:",
    governor.toneDirectives,
    "",
    "AUTHORITY CITATION:",
    governor.authorityCitation,
    "",
    "DOCUMENT HEADER TEMPLATE:",
    governor.documentHeaderTemplate,
    "",
    "SIGNATURE BLOCK TEMPLATE:",
    governor.signatureBlockTemplate,
    "",
    "GOVERNOR INSTRUCTION: All output MUST reflect the posture, tone, and authority of the active role governor above. The document header and signature block templates above MUST be applied verbatim (with variables substituted) to every document generated in this session.",
    "═══════════════════════════════════════════════",
    "",
  ].join("\n");
}

export async function logGovernorActivation(opts: {
  governorId: number;
  roleKey: string;
  eventType?: "activation" | "generation";
  documentId?: number;
  documentType?: string;
  actingUserId?: number;
  actingUserEmail?: string;
}): Promise<void> {
  try {
    await db.insert(governorActivationLogTable).values({
      governorId: opts.governorId,
      roleKey: opts.roleKey,
      eventType: opts.eventType ?? "activation",
      documentId: opts.documentId ?? null,
      documentType: opts.documentType ?? null,
      actingUserId: opts.actingUserId ?? null,
      actingUserEmail: opts.actingUserEmail ?? null,
    });
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Failed to log governor activation");
  }
}
