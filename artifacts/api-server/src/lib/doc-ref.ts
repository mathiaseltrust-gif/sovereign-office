/**
 * Document Reference Number Utility
 *
 * Two numbering schemes:
 *
 * 1. buildDocRef / parseDocRef — legacy per-member encoded ref
 *    Format: {TYPE}-{YYMMDD}-U{memberId:03d}-D{docId:04d}
 *
 * 2. nextDocRef — tribal ascending sequential reference (PRIMARY)
 *    Format: {PREFIX}-{YYYY}-{NNNN}
 *    Examples: LAND-2026-0001  COURT-2026-0042  INST-2026-0007
 *    Counter resets each calendar year per document type.
 *    Uses the tribal_doc_sequences table (auto-created on first use).
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

// ── Tribal sequential references ─────────────────────────────────────────────

export const DOC_TYPE_PREFIXES: Record<string, string> = {
  land_parcel:      "LAND",
  trust_instrument: "INST",
  trust_filing:     "FILING",
  court_document:   "COURT",
  complaint:        "COMPL",
  nfr_document:     "NFR",
  land_lease:       "LEASE",
  land_deed:        "DEED",
  land_notice:      "NOTICE",
  land_pipeline:    "LPIPE",
  protective_order: "PROT",
  // Case file jurisdiction types
  federal_matter:   "FED",
  state_matter:     "STATE",
  private_matter:   "CIV",
  icwa_matter:      "ICWA",
  intake_matter:    "INT",
  general_case:     "CASE",
  sovereign_matter: "SOV",
};

/**
 * Maps a plain jurisdiction/case type string to the corresponding doc_type key
 * used by nextDocRef so callers don't have to know internal key names.
 */
export function caseTypeToDocType(caseType: string): string {
  const map: Record<string, string> = {
    federal:   "federal_matter",
    state:     "state_matter",
    private:   "private_matter",
    civil:     "private_matter",
    icwa:      "icwa_matter",
    court:     "court_document",
    nfr:       "nfr_document",
    trust:     "trust_instrument",
    filing:    "trust_filing",
    complaint: "complaint",
    prot:      "protective_order",
    intake:    "intake_matter",
    sovereign: "sovereign_matter",
    general:   "general_case",
  };
  return map[caseType.toLowerCase()] ?? "general_case";
}

let _seqTableEnsured = false;

async function ensureSequenceTable(): Promise<void> {
  if (_seqTableEnsured) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tribal_doc_sequences (
      doc_type  VARCHAR(50) PRIMARY KEY,
      prefix    VARCHAR(20) NOT NULL,
      last_seq  INTEGER     NOT NULL DEFAULT 0,
      year      INTEGER     NOT NULL DEFAULT 0
    )
  `);
  _seqTableEnsured = true;
}

/**
 * Atomically returns the next tribal reference number for a document type.
 * Counter resets at the start of each calendar year.
 *
 * Example output: LAND-2026-0001
 */
export async function nextDocRef(docType: string): Promise<string> {
  await ensureSequenceTable();

  const prefix = DOC_TYPE_PREFIXES[docType] ?? docType.toUpperCase().slice(0, 10);
  const currentYear = new Date().getFullYear();

  const result = await db.execute<{ prefix: string; last_seq: number; year: number }>(sql`
    INSERT INTO tribal_doc_sequences (doc_type, prefix, last_seq, year)
    VALUES (${docType}, ${prefix}, 1, ${currentYear})
    ON CONFLICT (doc_type) DO UPDATE SET
      last_seq = CASE
        WHEN tribal_doc_sequences.year = ${currentYear}
        THEN tribal_doc_sequences.last_seq + 1
        ELSE 1
      END,
      year   = ${currentYear},
      prefix = ${prefix}
    RETURNING prefix, last_seq, year
  `);

  const row = result.rows[0];
  if (!row) throw new Error(`Failed to generate doc ref for type: ${docType}`);

  const seq = String(row.last_seq).padStart(4, "0");
  return `${row.prefix}-${row.year}-${seq}`;
}

/**
 * Ensures the tribal_ref column exists on all document tables.
 * Called once at server startup — safe to run multiple times.
 */
export async function ensureDocRefColumns(): Promise<void> {
  await ensureSequenceTable();

  const drizzleTables = [
    "trust_instruments",
    "complaints",
    "court_documents",
    "nfr_documents",
    "trust_filings",
  ];

  for (const table of drizzleTables) {
    try {
      await db.execute(sql.raw(
        `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS tribal_ref VARCHAR(50)`
      ));
    } catch (err) {
      logger.warn({ table, err }, "Could not add tribal_ref column");
    }
  }

  const rawSqlTables = ["land_parcels", "land_leases", "land_notices"];
  for (const table of rawSqlTables) {
    try {
      await db.execute(sql.raw(
        `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS tribal_ref VARCHAR(50)`
      ));
    } catch (err) {
      logger.warn({ table, err }, "Could not add tribal_ref column");
    }
  }

  logger.info("Tribal document reference columns ensured");
}

// ── Legacy per-member encoded refs ────────────────────────────────────────────

export function buildDocRef(
  docType: "NFR" | "INST" | "GWE" | "VER" | "TID" | "WEL" | "CRT" | string,
  memberId: number,
  docId: number,
): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const uid = String(Math.max(memberId, 0)).padStart(3, "0");
  const did = String(Math.max(docId, 0)).padStart(4, "0");
  return `${docType}-${yy}${mm}${dd}-U${uid}-D${did}`;
}

export function parseDocRef(ref: string): {
  docType: string;
  date: string;
  memberId: number;
  docId: number;
} | null {
  const m = ref.match(/^([A-Z]+)-(\d{6})-U(\d+)-D(\d+)$/);
  if (!m) return null;
  return {
    docType: m[1],
    date: m[2],
    memberId: parseInt(m[3], 10),
    docId: parseInt(m[4], 10),
  };
}
