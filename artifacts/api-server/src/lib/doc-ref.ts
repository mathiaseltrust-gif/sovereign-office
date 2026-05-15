/**
 * Document Reference Number Utility
 *
 * Encodes document type, date, member ID, and document ID into a structured
 * reference number that can be decoded to retrieve the associated member and
 * document without any lookup table.
 *
 * Format: {TYPE}-{YYMMDD}-U{memberId:03d}-D{docId:04d}
 *
 * Examples:
 *   NFR-260515-U006-D0042   → NFR doc #42, 2026-05-15, member #6
 *   INST-260515-U006-D0003  → Trust Instrument #3, 2026-05-15, member #6
 *   GWE-260515-U006-D0001   → GWE Letter #1, 2026-05-15, member #6
 *   VER-260515-U006-D0000   → Verification Letter, 2026-05-15, member #6
 *   TID-260515-U006-D0000   → Tribal ID card, 2026-05-15, member #6
 */
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

/**
 * Parse a document reference number back to its component parts.
 * Returns null if the format is not recognized.
 */
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
