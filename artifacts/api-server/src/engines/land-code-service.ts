/**
 * Tribal Land Code Service
 *
 * Rules:
 *   Code format:  MET-TL-{LOCATION_CODE}-{SEQ:03d}
 *   Location code derived from county / city / address
 *   Sequence is per-location, starting at 001, incrementing by 1
 *
 * Known locations:
 *   BC  — Bakersfield / Kern County      (current seq: 001–003)
 *   OC  — Oakland / Alameda County
 *   LAC — Los Angeles County
 *   SAC — Sacramento County
 *   FRC — Fresno County
 *   SDC — San Diego County
 *   SFC — San Francisco County
 *   RVC — Riverside County
 *   SBC — San Bernardino County
 *   ORC — Orange County
 *   VNC — Ventura County
 *   GEN — General / unknown location
 */

import { db } from "@workspace/db";
import { profilesTable, usersTable } from "@workspace/db";
import { eq, and, like, isNotNull } from "drizzle-orm";
import { logger } from "../lib/logger";

const NATION_PREFIX = "MET";

const LOCATION_MAP: Array<[string, string]> = [
  ["kern",          "BC"],
  ["bakersfield",   "BC"],
  ["alameda",       "OC"],
  ["oakland",       "OC"],
  ["los angeles",   "LAC"],
  ["sacramento",    "SAC"],
  ["fresno",        "FRC"],
  ["san diego",     "SDC"],
  ["san francisco", "SFC"],
  ["riverside",     "RVC"],
  ["san bernardino","SBC"],
  ["orange",        "ORC"],
  ["ventura",       "VNC"],
];

export function deriveLocationCode(
  county?: string | null,
  city?: string | null,
  address?: string | null,
): string {
  const haystack = [county, city, address]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  for (const [key, code] of LOCATION_MAP) {
    if (haystack.includes(key)) return code;
  }
  return "GEN";
}

export function buildLandCode(locCode: string, seq: number): string {
  return `${NATION_PREFIX}-${locCode}-TL-${String(seq).padStart(3, "0")}`;
}

/**
 * Return the next available sequence number for a given location code
 * by scanning all existing land codes in the profiles table.
 */
export async function nextSeqForLocation(locCode: string): Promise<number> {
  const pattern = `${NATION_PREFIX}-${locCode}-TL-%`;
  const rows = await db
    .select({ tribalLandCode: profilesTable.tribalLandCode })
    .from(profilesTable)
    .where(and(isNotNull(profilesTable.tribalLandCode), like(profilesTable.tribalLandCode, pattern)));

  let maxSeq = 0;
  for (const row of rows) {
    const m = row.tribalLandCode?.match(/-(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxSeq) maxSeq = n;
    }
  }
  return maxSeq + 1;
}

export interface LandCodeResult {
  code: string;
  isNew: boolean;
  locationCode: string;
  seq: number;
}

/**
 * Get or assign a tribal land code for a user.
 * If the user's profile already has a code, return it unchanged (isNew = false).
 * Otherwise, generate the next available code for their location and persist it.
 *
 * Pass dryRun=true to compute the code without saving.
 */
export async function getOrAssignLandCode(
  userId: number,
  opts?: {
    county?: string | null;
    city?: string | null;
    address?: string | null;
    dryRun?: boolean;
  },
): Promise<LandCodeResult> {
  const [prof] = await db
    .select({
      tribalLandCode: profilesTable.tribalLandCode,
      mailingAddress: profilesTable.mailingAddress,
    })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  if (prof?.tribalLandCode) {
    const m = prof.tribalLandCode.match(/-([A-Z]+)-TL-(\d+)$/);
    return {
      code: prof.tribalLandCode,
      isNew: false,
      locationCode: m?.[1] ?? "??",
      seq: m ? parseInt(m[2], 10) : 0,
    };
  }

  const locCode = deriveLocationCode(
    opts?.county,
    opts?.city,
    opts?.address ?? prof?.mailingAddress,
  );
  const seq = await nextSeqForLocation(locCode);
  const code = buildLandCode(locCode, seq);

  if (!opts?.dryRun) {
    const updated = await db
      .update(profilesTable)
      .set({ tribalLandCode: code, updatedAt: new Date() })
      .where(eq(profilesTable.userId, userId));

    if ((updated.rowCount ?? 0) === 0) {
      await db.insert(profilesTable).values({
        userId,
        tribalLandCode: code,
      }).onConflictDoNothing();
    }

    logger.info({ userId, code, locCode, seq }, "Tribal land code assigned");
  }

  return { code, isNew: true, locationCode: locCode, seq };
}

// ── Eligibility checker ───────────────────────────────────────────────────────

export interface EligibilityField {
  field: string;
  label: string;
  value?: string;
  required: boolean;
  hint?: string;
}

export interface EligibilityResult {
  eligible: boolean;
  status: "eligible" | "not_yet" | "pending_review";
  userId: number;
  legalName: string | null;
  apn: string | null;
  tribalLandCode: string | null;
  present: EligibilityField[];
  missing: EligibilityField[];
  nextStep: string;
}

const REQUIRED: Array<{ field: string; label: string; hint: string }> = [
  {
    field: "legalName",
    label: "Legal name",
    hint: "Full legal name as it appears on deed documents (e.g. 'Mathew-Allen: McCaster')",
  },
  {
    field: "apn",
    label: "APN (Assessor's Parcel Number)",
    hint: "Obtain from your county assessor-recorder office. Format: ###-###-##-##-#",
  },
  {
    field: "legalDescription",
    label: "Legal description of property",
    hint: "Found on your recorded grant deed — includes Lot, Tract No., Book, and Page",
  },
  {
    field: "mailingAddress",
    label: "Property address",
    hint: "Street address, city, state, ZIP code",
  },
  {
    field: "membershipVerified",
    label: "Tribal membership verified",
    hint: "Contact the Office of the Chief Justice & Trustee to complete membership verification",
  },
];

export async function checkEligibility(userId: number): Promise<EligibilityResult> {
  const [[user], [prof]] = await Promise.all([
    db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1),
    db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1),
  ]);

  const legalName = prof?.legalName ?? user?.name ?? null;
  const apn = prof?.apn ?? null;

  const checks: Record<string, unknown> = {
    legalName,
    apn,
    legalDescription:  prof?.legalDescription ?? null,
    mailingAddress:    prof?.mailingAddress ?? null,
    membershipVerified: prof?.membershipVerified ?? false,
  };

  const present: EligibilityField[] = [];
  const missing: EligibilityField[] = [];

  for (const f of REQUIRED) {
    const val = checks[f.field];
    const hasValue = val !== null && val !== undefined && val !== false && val !== "";
    if (hasValue) {
      present.push({ field: f.field, label: f.label, value: String(val), required: true });
    } else {
      missing.push({ field: f.field, label: f.label, required: true, hint: f.hint });
    }
  }

  // Optional informational fields (non-blocking)
  if (prof?.tribalLandCode) {
    present.push({ field: "tribalLandCode", label: "Tribal land code", value: prof.tribalLandCode, required: false });
  }
  if (prof?.lineageVerified) {
    present.push({ field: "lineageVerified", label: "Lineage verified", value: "Yes", required: false });
  }
  if (prof?.hasRecordedInstrument) {
    present.push({ field: "hasRecordedInstrument", label: "Recorded instrument on file", value: "Yes", required: false });
  }
  if (prof?.landClassification) {
    present.push({ field: "landClassification", label: "Land classification", value: prof.landClassification, required: false });
  }

  const eligible = missing.length === 0;

  const nextStep = eligible
    ? "This individual meets all requirements for tribal land trust. A trustee may proceed with drafting a deed of trust."
    : `Not yet eligible. Still needed: ${missing.map((m) => m.label).join("; ")}.`;

  return {
    eligible,
    status: eligible ? "eligible" : "not_yet",
    userId,
    legalName,
    apn,
    tribalLandCode: prof?.tribalLandCode ?? null,
    present,
    missing,
    nextStep,
  };
}
