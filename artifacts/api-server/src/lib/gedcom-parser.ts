/**
 * GEDCOM 5.5/5.5.1 parser
 * Handles UTF-8, UTF-8 BOM, ANSEL, and ASCII/Latin-1 encodings.
 * Also handles ZIP-compressed GEDCOM files (Ancestry.com exports .ged as ZIP).
 * Extracts INDI and FAM records into a structured intermediate format.
 */
import AdmZip from "adm-zip";

export interface GedcomIndividual {
  gedcomId: string;
  fullName: string;
  givenName: string;
  surname: string;
  birthDate: string | null;
  birthYear: number | null;
  birthPlace: string | null;
  deathDate: string | null;
  deathYear: number | null;
  deathPlace: string | null;
  gender: string | null;
  notes: string[];
  sources: string[];
  censusLabels: string[];
}

export interface GedcomFamily {
  gedcomId: string;
  husbandId: string | null;
  wifeId: string | null;
  childIds: string[];
}

export interface GedcomParseResult {
  individuals: GedcomIndividual[];
  families: GedcomFamily[];
  encoding: string;
  errors: string[];
}

// ── ZIP extraction ────────────────────────────────────────────────────────────
// Ancestry.com exports .ged files as ZIP archives containing the real GEDCOM.

function maybeUnzip(buf: Buffer): Buffer {
  // ZIP files start with PK\x03\x04
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    const zip = new AdmZip(buf);
    const entries = zip.getEntries();
    // Find the first .ged entry, or fall back to the first text-like entry
    const gedEntry = entries.find(e => e.entryName.toLowerCase().endsWith(".ged"))
      ?? entries.find(e => !e.isDirectory);
    if (gedEntry) {
      return gedEntry.getData();
    }
  }
  return buf;
}

// ── Encoding detection + decode ───────────────────────────────────────────────

function decodeBuffer(buf: Buffer): { text: string; encoding: string } {
  // BOM: UTF-8
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { text: buf.slice(3).toString("utf-8"), encoding: "UTF-8" };
  }
  // Try UTF-8 first; fall back to Latin-1 (close enough for ANSEL core text)
  const utf8 = buf.toString("utf-8");
  if (!utf8.includes("\uFFFD")) {
    return { text: utf8, encoding: "UTF-8" };
  }
  return { text: buf.toString("latin1"), encoding: "ANSEL/Latin-1" };
}

// ── GEDCOM line parser ────────────────────────────────────────────────────────

interface GedLine {
  level: number;
  xref: string | null;
  tag: string;
  value: string;
}

function parseLine(raw: string): GedLine | null {
  const line = raw.trimEnd();
  if (!line) return null;
  // Format: LEVEL [XREF] TAG [VALUE]
  const m = line.match(/^(\d+)\s+(@[^@]+@)?\s*(\w+)\s*(.*)?$/);
  if (!m) return null;
  return {
    level: parseInt(m[1], 10),
    xref: m[2] ? m[2].trim() : null,
    tag: m[3].toUpperCase(),
    value: (m[4] ?? "").trim(),
  };
}

// ── Date utilities ────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

function extractYear(dateStr: string): number | null {
  if (!dateStr) return null;
  const clean = dateStr.replace(/^(ABT|BEF|AFT|EST|CAL|CIRCA)\s*/i, "").trim();
  const m = clean.match(/\b(\d{4})\b/);
  return m ? parseInt(m[1], 10) : null;
}

function normalizeName(raw: string): { full: string; given: string; surname: string } {
  if (!raw) return { full: "", given: "", surname: "" };
  // GEDCOM name format: Given /Surname/ Suffix
  const surnameMatch = raw.match(/\/([^/]+)\//);
  const surname = surnameMatch ? surnameMatch[1].trim() : "";
  const given = raw.replace(/\/[^/]*\//, "").replace(/\s+/g, " ").trim();
  const full = given && surname ? `${given} ${surname}` : given || surname || raw.trim();
  return { full, given, surname };
}

// ── Census / racial label heuristics ─────────────────────────────────────────

const CENSUS_KEYWORDS = [
  "indian", "colored", "mulatto", "negro", "white", "black",
  "free person of color", "freedman", "cherokee", "choctaw", "chickasaw",
  "creek", "seminole", "tribal", "native", "indigenous",
];

function extractCensusLabels(text: string): string[] {
  const lower = text.toLowerCase();
  return CENSUS_KEYWORDS.filter(kw => lower.includes(kw));
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseGedcom(fileBuffer: Buffer): GedcomParseResult {
  const unzipped = maybeUnzip(fileBuffer);
  const { text, encoding } = decodeBuffer(unzipped);
  const lines = text.split(/\r\n|\r|\n/);
  const errors: string[] = [];

  const individuals = new Map<string, GedcomIndividual>();
  const families = new Map<string, GedcomFamily>();

  let currentIndi: GedcomIndividual | null = null;
  let currentFam: GedcomFamily | null = null;
  let currentContext: "BIRT" | "DEAT" | "RESI" | "NOTE" | "SOUR" | null = null;
  let contBuffer = "";

  function flushCont() {
    if (!currentIndi || !contBuffer) return;
    if (currentContext === "NOTE") currentIndi.notes.push(contBuffer.trim());
    if (currentContext === "SOUR") currentIndi.sources.push(contBuffer.trim());
    contBuffer = "";
    currentContext = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const gl = parseLine(lines[i]);
    if (!gl) continue;

    // ── Level 0: start of new record ─────────────────────────────────────────
    if (gl.level === 0) {
      // Flush accumulated note/sour
      flushCont();

      // Save previous record
      if (currentIndi && gl.xref !== currentIndi.gedcomId) {
        individuals.set(currentIndi.gedcomId, currentIndi);
        currentIndi = null;
      }
      if (currentFam && gl.xref !== currentFam.gedcomId) {
        families.set(currentFam.gedcomId, currentFam);
        currentFam = null;
      }

      if (gl.tag === "INDI" && gl.xref) {
        currentIndi = {
          gedcomId: gl.xref,
          fullName: "", givenName: "", surname: "",
          birthDate: null, birthYear: null, birthPlace: null,
          deathDate: null, deathYear: null, deathPlace: null,
          gender: null,
          notes: [], sources: [], censusLabels: [],
        };
        currentFam = null;
        currentContext = null;
      } else if (gl.tag === "FAM" && gl.xref) {
        currentFam = { gedcomId: gl.xref, husbandId: null, wifeId: null, childIds: [] };
        currentIndi = null;
        currentContext = null;
      } else {
        currentIndi = null;
        currentFam = null;
      }
      continue;
    }

    // ── INDI sub-records ──────────────────────────────────────────────────────
    if (currentIndi) {
      if (gl.level === 1) {
        flushCont();
        currentContext = null;
        switch (gl.tag) {
          case "NAME": {
            const n = normalizeName(gl.value);
            currentIndi.fullName = n.full;
            currentIndi.givenName = n.given;
            currentIndi.surname = n.surname;
            break;
          }
          case "SEX":
            currentIndi.gender = gl.value.toUpperCase() === "M" ? "male"
              : gl.value.toUpperCase() === "F" ? "female" : gl.value || null;
            break;
          case "BIRT":
            currentContext = "BIRT";
            break;
          case "DEAT":
            currentContext = "DEAT";
            break;
          case "RESI":
            currentContext = "RESI";
            break;
          case "NOTE":
            currentContext = "NOTE";
            contBuffer = gl.value;
            if (gl.value) {
              const labels = extractCensusLabels(gl.value);
              currentIndi.censusLabels.push(...labels);
            }
            break;
          case "SOUR":
            currentContext = "SOUR";
            contBuffer = gl.value.replace(/^@[^@]+@$/, "").trim();
            break;
        }
      } else if (gl.level === 2) {
        switch (gl.tag) {
          case "GIVN":
            if (!currentIndi.givenName) currentIndi.givenName = gl.value;
            break;
          case "SURN":
            if (!currentIndi.surname) currentIndi.surname = gl.value;
            if (!currentIndi.fullName) currentIndi.fullName = `${currentIndi.givenName} ${gl.value}`.trim();
            break;
          case "DATE":
            if (currentContext === "BIRT") {
              currentIndi.birthDate = gl.value;
              currentIndi.birthYear = extractYear(gl.value);
            } else if (currentContext === "DEAT") {
              currentIndi.deathDate = gl.value;
              currentIndi.deathYear = extractYear(gl.value);
            }
            break;
          case "PLAC":
            if (currentContext === "BIRT") currentIndi.birthPlace = gl.value;
            else if (currentContext === "DEAT") currentIndi.deathPlace = gl.value;
            else if (currentContext === "RESI") {
              const labels = extractCensusLabels(gl.value);
              currentIndi.censusLabels.push(...labels);
            }
            break;
          case "TEXT":
            if (currentContext === "SOUR") contBuffer += " " + gl.value;
            break;
        }
      } else if (gl.level >= 2 && (gl.tag === "CONT" || gl.tag === "CONC")) {
        const sep = gl.tag === "CONT" ? "\n" : "";
        if (currentContext === "NOTE" || currentContext === "SOUR") {
          contBuffer += sep + gl.value;
          const labels = extractCensusLabels(gl.value);
          currentIndi.censusLabels.push(...labels);
        }
      }
    }

    // ── FAM sub-records ───────────────────────────────────────────────────────
    if (currentFam) {
      if (gl.level === 1) {
        switch (gl.tag) {
          case "HUSB": currentFam.husbandId = gl.value || null; break;
          case "WIFE": currentFam.wifeId = gl.value || null; break;
          case "CHIL": if (gl.value) currentFam.childIds.push(gl.value); break;
        }
      }
    }
  }

  // Flush last records
  flushCont();
  if (currentIndi) individuals.set(currentIndi.gedcomId, currentIndi);
  if (currentFam) families.set(currentFam.gedcomId, currentFam);

  // Deduplicate census labels
  for (const indi of individuals.values()) {
    indi.censusLabels = [...new Set(indi.censusLabels)];
  }

  return {
    individuals: Array.from(individuals.values()),
    families: Array.from(families.values()),
    encoding,
    errors,
  };
}

// ── Relationship resolver ─────────────────────────────────────────────────────
// Given parsed individuals and families, annotate each individual with
// their father, mother, spouse, and children GEDCOM IDs.

export interface ResolvedRelationships {
  fatherGedcomId: string | null;
  motherGedcomId: string | null;
  spouseGedcomIds: string[];
  childrenGedcomIds: string[];
}

export function resolveRelationships(
  result: GedcomParseResult,
): Map<string, ResolvedRelationships> {
  const map = new Map<string, ResolvedRelationships>();
  for (const indi of result.individuals) {
    map.set(indi.gedcomId, { fatherGedcomId: null, motherGedcomId: null, spouseGedcomIds: [], childrenGedcomIds: [] });
  }

  for (const fam of result.families) {
    const husb = fam.husbandId;
    const wife = fam.wifeId;

    if (husb && map.has(husb)) {
      const r = map.get(husb)!;
      if (wife && !r.spouseGedcomIds.includes(wife)) r.spouseGedcomIds.push(wife);
      for (const chil of fam.childIds) {
        if (!r.childrenGedcomIds.includes(chil)) r.childrenGedcomIds.push(chil);
      }
    }
    if (wife && map.has(wife)) {
      const r = map.get(wife)!;
      if (husb && !r.spouseGedcomIds.includes(husb)) r.spouseGedcomIds.push(husb);
      for (const chil of fam.childIds) {
        if (!r.childrenGedcomIds.includes(chil)) r.childrenGedcomIds.push(chil);
      }
    }
    for (const chil of fam.childIds) {
      if (!map.has(chil)) continue;
      const r = map.get(chil)!;
      if (husb) r.fatherGedcomId = husb;
      if (wife) r.motherGedcomId = wife;
    }
  }

  return map;
}
