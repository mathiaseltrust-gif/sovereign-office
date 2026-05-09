import { db } from "@workspace/db";
import { welfareActsTable, welfareProvisionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface WelfareActRecord {
  code: string;
  label: string;
  description: string | null;
  federalStatutes: string[];
  doctrines: string[];
  troEligible: boolean;
  emergencyEligible: boolean;
}

export interface WelfareProvisionRecord {
  instrumentType: string;
  provisionText: string;
}

const SEED_ACTS: Omit<WelfareActRecord, never>[] = [
  {
    code: "ICWA",
    label: "Indian Child Welfare Act (ICWA)",
    description: "Federal law governing the removal, placement, and adoption of Indian children. 25 U.S.C. §§ 1901–1963.",
    federalStatutes: [
      "Indian Child Welfare Act of 1978 (ICWA), 25 U.S.C. §§ 1901–1963",
      "25 U.S.C. § 1911 — Tribal court jurisdiction over Indian child custody proceedings",
      "25 U.S.C. § 1912 — Pending court proceedings; notice; intervention",
      "25 U.S.C. § 1915 — Placement of Indian children; preferences",
      "25 U.S.C. § 1920 — Return of custody",
      "25 C.F.R. Part 23 — Indian Child Welfare Act",
      "Brackeen v. Haaland, 599 U.S. 255 (2023) — ICWA upheld as constitutional",
      "Mississippi Band of Choctaw Indians v. Holyfield, 490 U.S. 30 (1989) — Exclusive tribal court jurisdiction",
    ],
    doctrines: [
      "Indian Canons of Construction",
      "Worcester v. Georgia",
      "Federal Trust Responsibility",
      "ICWA Federal Preemption",
    ],
    troEligible: true,
    emergencyEligible: true,
  },
  {
    code: "SNYDER",
    label: "Snyder Act",
    description: "Federal authority for Indian welfare, health, and education. 25 U.S.C. § 13.",
    federalStatutes: [
      "Snyder Act of 1921, 25 U.S.C. § 13 — Federal authority for Indian welfare, health, and education",
      "25 U.S.C. § 13 — BIA appropriation for benefit, care, and assistance of Indians",
    ],
    doctrines: ["Federal Trust Responsibility", "Indian Canons of Construction"],
    troEligible: false,
    emergencyEligible: true,
  },
  {
    code: "IHCIA",
    label: "Indian Health Care Improvement Act (IHCIA)",
    description: "Establishes and expands Indian health programs. 25 U.S.C. §§ 1601–1685.",
    federalStatutes: [
      "Indian Health Care Improvement Act (IHCIA), 25 U.S.C. §§ 1601–1685",
      "25 U.S.C. § 1621 — Indian Health Service standards and treatment",
      "25 U.S.C. § 1680c — Contract health services for medical emergencies",
      "25 U.S.C. § 1621h — Mental health prevention and treatment services",
    ],
    doctrines: ["Federal Trust Responsibility", "Indian Canons of Construction"],
    troEligible: false,
    emergencyEligible: true,
  },
  {
    code: "ISDEAA",
    label: "Indian Self-Determination and Education Assistance Act",
    description: "Self-determination contracts with tribal organizations. 25 U.S.C. §§ 5301–5423.",
    federalStatutes: [
      "Indian Self-Determination and Education Assistance Act (ISDEAA), 25 U.S.C. §§ 5301–5423",
      "25 U.S.C. § 5321 — Self-determination contracts with tribal organizations",
      "25 U.S.C. § 5325 — Contract funding and indirect costs",
    ],
    doctrines: ["Tribal Sovereignty", "Federal Trust Responsibility"],
    troEligible: false,
    emergencyEligible: false,
  },
  {
    code: "TRIBAL_CODE",
    label: "Tribal Family Protection Code",
    description: "Tribal law governing family protection and child welfare within tribal jurisdiction.",
    federalStatutes: [
      "Snyder Act of 1921, 25 U.S.C. § 13",
      "Indian Child Welfare Act of 1978 (ICWA), 25 U.S.C. §§ 1901–1963",
      "25 U.S.C. § 1911 — Tribal court jurisdiction",
    ],
    doctrines: ["Tribal Sovereignty", "Worcester v. Georgia", "Montoya Tribal Authority"],
    troEligible: true,
    emergencyEligible: true,
  },
  {
    code: "TRIBAL_WELFARE",
    label: "Tribal Welfare Code",
    description: "Tribal code provisions for general welfare of tribal members.",
    federalStatutes: [
      "Snyder Act of 1921, 25 U.S.C. § 13",
      "Indian Self-Determination and Education Assistance Act (ISDEAA), 25 U.S.C. §§ 5301–5423",
    ],
    doctrines: ["Tribal Sovereignty", "Federal Trust Responsibility"],
    troEligible: false,
    emergencyEligible: true,
  },
  {
    code: "TRIBAL_PROTECTIVE_ORDER",
    label: "Tribal Protective Order Authority",
    description: "Tribal court authority to issue protective orders under inherent sovereign powers.",
    federalStatutes: [
      "18 U.S.C. § 2265 — Full faith and credit given to protection orders",
      "Violence Against Women Act (VAWA) — Tribal provisions",
      "Snyder Act of 1921, 25 U.S.C. § 13",
    ],
    doctrines: ["Tribal Sovereignty", "Montoya Tribal Authority", "Worcester v. Georgia"],
    troEligible: true,
    emergencyEligible: true,
  },
  {
    code: "EMERGENCY_WELFARE",
    label: "Emergency Welfare Authority",
    description: "Emergency welfare authority under 25 U.S.C. § 1922 and tribal emergency powers.",
    federalStatutes: [
      "25 U.S.C. § 1922 — Emergency removal of Indian child",
      "Snyder Act of 1921, 25 U.S.C. § 13",
    ],
    doctrines: ["Federal Trust Responsibility", "Tribal Sovereignty"],
    troEligible: true,
    emergencyEligible: true,
  },
  {
    code: "TRO_WELFARE",
    label: "TRO Welfare Protection",
    description: "Welfare authority supporting Temporary Restraining Orders for Indian children and families.",
    federalStatutes: [
      "Indian Child Welfare Act of 1978 (ICWA), 25 U.S.C. §§ 1901–1963",
      "25 U.S.C. § 1912 — Pending court proceedings; notice; intervention",
      "Brackeen v. Haaland, 599 U.S. 255 (2023)",
    ],
    doctrines: ["Indian Canons of Construction", "Worcester v. Georgia", "ICWA Federal Preemption"],
    troEligible: true,
    emergencyEligible: true,
  },
];

async function seedWelfareActs(): Promise<void> {
  for (const act of SEED_ACTS) {
    try {
      const existing = await db.select({ id: welfareActsTable.id }).from(welfareActsTable).where(eq(welfareActsTable.code, act.code)).limit(1);
      if (!existing[0]) {
        await db.insert(welfareActsTable).values({
          code: act.code,
          label: act.label,
          description: act.description,
          federalStatutes: act.federalStatutes,
          doctrines: act.doctrines,
          troEligible: act.troEligible,
          emergencyEligible: act.emergencyEligible,
          enabled: true,
          createdBy: "system",
        });
      }
    } catch {
      // Already exists or schema not ready — skip
    }
  }
}

let _seeded = false;
export async function ensureWelfareActsSeeded(): Promise<void> {
  if (_seeded) return;
  await seedWelfareActs();
  _seeded = true;
}

export async function listWelfareActs(): Promise<WelfareActRecord[]> {
  await ensureWelfareActsSeeded();
  const rows = await db.select().from(welfareActsTable).where(eq(welfareActsTable.enabled, true));
  return rows.map((r) => ({
    code: r.code,
    label: r.label,
    description: r.description,
    federalStatutes: (r.federalStatutes as string[]) ?? [],
    doctrines: (r.doctrines as string[]) ?? [],
    troEligible: r.troEligible,
    emergencyEligible: r.emergencyEligible,
  }));
}

export async function getWelfareAct(code: string): Promise<WelfareActRecord | null> {
  await ensureWelfareActsSeeded();
  const rows = await db.select().from(welfareActsTable).where(and(eq(welfareActsTable.code, code), eq(welfareActsTable.enabled, true))).limit(1);
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    code: r.code,
    label: r.label,
    description: r.description,
    federalStatutes: (r.federalStatutes as string[]) ?? [],
    doctrines: (r.doctrines as string[]) ?? [],
    troEligible: r.troEligible,
    emergencyEligible: r.emergencyEligible,
  };
}

export async function createWelfareAct(act: {
  code: string;
  label: string;
  description?: string;
  federalStatutes?: string[];
  doctrines?: string[];
  troEligible?: boolean;
  emergencyEligible?: boolean;
  createdBy?: string;
}): Promise<WelfareActRecord> {
  const [inserted] = await db.insert(welfareActsTable).values({
    code: act.code.toUpperCase(),
    label: act.label,
    description: act.description ?? null,
    federalStatutes: act.federalStatutes ?? [],
    doctrines: act.doctrines ?? [],
    troEligible: act.troEligible ?? false,
    emergencyEligible: act.emergencyEligible ?? false,
    enabled: true,
    createdBy: act.createdBy ?? "admin",
  }).returning();
  logger.info({ code: inserted.code }, "New welfare act created");
  return {
    code: inserted.code,
    label: inserted.label,
    description: inserted.description,
    federalStatutes: (inserted.federalStatutes as string[]) ?? [],
    doctrines: (inserted.doctrines as string[]) ?? [],
    troEligible: inserted.troEligible,
    emergencyEligible: inserted.emergencyEligible,
  };
}

export async function getCustomProvisions(actCode: string, instrumentType: string): Promise<WelfareProvisionRecord[]> {
  const rows = await db
    .select()
    .from(welfareProvisionsTable)
    .where(and(eq(welfareProvisionsTable.actCode, actCode), eq(welfareProvisionsTable.instrumentType, instrumentType)));
  return rows.map((r) => ({ instrumentType: r.instrumentType, provisionText: r.provisionText }));
}
