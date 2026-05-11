import { db } from "@workspace/db";
import {
  familyLineageTable,
  ancestralRecordsTable,
  identityNarrativesTable,
  profilesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface ParsedPerson {
  fullName: string;
  firstName?: string;
  lastName?: string;
  birthYear?: number;
  deathYear?: number;
  gender?: string;
  tribalNation?: string;
  tribalEnrollmentNumber?: string;
  parentNames?: string[];
  spouseNames?: string[];
  notes?: string;
  isDeceased?: boolean;
  generationalPosition?: number;
  nameVariants?: string[];
}

export interface LineageGraph {
  people: ParsedPerson[];
  rootName: string;
  totalGenerations: number;
  tribalNations: string[];
  lineageTags: string[];
  icwaEligible: boolean;
  welfareEligible: boolean;
  trustInheritance: boolean;
  familyGroups: string[];
  ancestorChain: string[];
}

export interface StoredLineageResult {
  lineageIds: number[];
  narrativeId: number | null;
  lineageGraph: LineageGraph;
  identityTags: string[];
}

export interface EligibilityResult {
  icwaEligible: boolean;
  welfareEligible: boolean;
  trustInheritance: boolean;
  membershipVerified: boolean;
  protectionLevel: "standard" | "elevated" | "critical";
  benefitEligibility: {
    icwa: boolean;
    tribalWelfare: boolean;
    trustBeneficiary: boolean;
    membershipBenefits: boolean;
    ancestralLandRights: boolean;
  };
  reasons: string[];
}

export function parseGedcom(gedText: string): ParsedPerson[] {
  const lines = gedText.split(/\r?\n/);
  const individuals = new Map<string, ParsedPerson & { _id: string; _famc?: string[] }>();
  const families = new Map<string, { husb?: string; wife?: string; children: string[] }>();

  let currentType: "INDI" | "FAM" | null = null;
  let currentId = "";
  let currentTag = "";

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    const level = parseInt(parts[0] ?? "", 10);
    if (isNaN(level)) continue;

    const idOrTag = parts[1] ?? "";
    const rest = parts.slice(2).join(" ");

    if (level === 0) {
      currentTag = "";
      if (idOrTag.startsWith("@") && rest === "INDI") {
        currentType = "INDI";
        currentId = idOrTag;
        individuals.set(currentId, { _id: currentId, fullName: "", _famc: [] });
      } else if (idOrTag.startsWith("@") && rest === "FAM") {
        currentType = "FAM";
        currentId = idOrTag;
        families.set(currentId, { children: [] });
      } else {
        currentType = null;
        currentId = "";
      }
      continue;
    }

    const tag = idOrTag;
    const value = rest;

    if (currentType === "INDI" && currentId) {
      const indi = individuals.get(currentId)!;

      if (level === 1) {
        currentTag = tag;
        if (tag === "NAME") {
          const cleaned = value.replace(/\//g, "").replace(/\s+/g, " ").trim();
          if (cleaned) {
            indi.fullName = cleaned;
            const nameParts = cleaned.split(/\s+/);
            indi.firstName = nameParts[0] ?? "";
            const surnameMatch = value.match(/\/([^/]+)\//);
            indi.lastName = surnameMatch ? surnameMatch[1].trim() : (nameParts.length > 1 ? nameParts.slice(1).join(" ") : "");
          }
        } else if (tag === "SEX") {
          indi.gender = value === "M" ? "male" : value === "F" ? "female" : undefined;
        } else if (tag === "NOTE") {
          indi.notes = value;
        } else if (tag === "DEAT" && value === "Y") {
          indi.isDeceased = true;
        } else if (tag === "FAMC") {
          indi._famc = indi._famc ?? [];
          const famId = value.replace(/@/g, "");
          indi._famc.push(`@${famId}@`);
        }
      } else if (level === 2) {
        if (currentTag === "BIRT" && tag === "DATE") {
          const yearMatch = value.match(/\b(1[0-9]{3}|2[0-9]{3})\b/);
          if (yearMatch) indi.birthYear = parseInt(yearMatch[1], 10);
        } else if (currentTag === "BIRT" && tag === "PLAC") {
          indi.notes = indi.notes ? `${indi.notes}; born ${value}` : `born ${value}`;
        } else if ((currentTag === "DEAT" || currentTag === "BURI") && tag === "DATE") {
          const yearMatch = value.match(/\b(1[0-9]{3}|2[0-9]{3})\b/);
          if (yearMatch) {
            indi.deathYear = parseInt(yearMatch[1], 10);
            indi.isDeceased = true;
          }
        } else if (currentTag === "NOTE" && tag === "CONC") {
          indi.notes = (indi.notes ?? "") + " " + value;
        }
      }
    } else if (currentType === "FAM" && currentId) {
      const fam = families.get(currentId)!;
      if (level === 1) {
        if (tag === "HUSB") fam.husb = value;
        else if (tag === "WIFE") fam.wife = value;
        else if (tag === "CHIL") fam.children.push(value);
      }
    }
  }

  const nameToId = new Map<string, string>();
  for (const [id, indi] of individuals) {
    if (indi.fullName) nameToId.set(indi.fullName.toLowerCase(), id);
  }

  for (const [famId, fam] of families) {
    const parentIndiIds = [fam.husb, fam.wife].filter(Boolean) as string[];
    const parentNames = parentIndiIds.map((id) => individuals.get(id)?.fullName).filter(Boolean) as string[];

    for (const childId of fam.children) {
      const child = individuals.get(childId);
      if (child) {
        child.parentNames = [...(child.parentNames ?? []), ...parentNames.filter((n) => !(child.parentNames ?? []).includes(n))];
      }
    }
    for (const parentId of parentIndiIds) {
      const parent = individuals.get(parentId);
      const otherParentIds = parentIndiIds.filter((id) => id !== parentId);
      if (parent && otherParentIds.length > 0) {
        const otherNames = otherParentIds.map((id) => individuals.get(id)?.fullName).filter(Boolean) as string[];
        parent.spouseNames = [...new Set([...(parent.spouseNames ?? []), ...otherNames])];
      }
    }
  }

  const result: ParsedPerson[] = [];
  for (const [, indi] of individuals) {
    if (!indi.fullName) continue;
    const person: ParsedPerson = {
      fullName: indi.fullName,
      firstName: indi.firstName,
      lastName: indi.lastName,
      birthYear: indi.birthYear,
      deathYear: indi.deathYear,
      gender: indi.gender,
      tribalNation: indi.tribalNation,
      tribalEnrollmentNumber: indi.tribalEnrollmentNumber,
      parentNames: indi.parentNames,
      spouseNames: indi.spouseNames,
      notes: indi.notes,
      isDeceased: indi.isDeceased,
      generationalPosition: indi.generationalPosition,
    };
    result.push(person);
  }
  return result;
}

export function parseLineageCsv(csvText: string): ParsedPerson[] {
  const lines = csvText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));

  // Try multiple header aliases (all already lowercased in `headers`)
  const col = (...names: string[]) => {
    for (const n of names) {
      const idx = headers.indexOf(n);
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const nameIdx   = col("name", "full_name", "fullname", "full name");
  const firstIdx  = col("first_name", "firstname", "first");
  const lastIdx   = col("last_name", "lastname", "last", "surname");
  // birth: accept birth_year, birthyear, birth_date, birthdate — extract year from date strings below
  const birthIdx  = col("birth_year", "birthyear", "birth_date", "birthdate", "birth", "dob", "date_of_birth", "dateofbirth");
  const deathIdx  = col("death_year", "deathyear", "death_date", "deathdate", "death", "dod", "date_of_death", "dateofdeath");
  const birthPlaceIdx = col("birth_place", "birthplace", "place_of_birth", "placeofbirth", "birth_location");
  const genderIdx = col("gender", "sex");
  const tribalIdx = col("tribal_nation", "tribe", "nation", "tribal nation");
  const enrollIdx = col("enrollment_number", "tribal_enrollment_number", "enrollmentnumber", "enrollment");
  const parentIdx = col("parent_names", "parents", "parent_name", "parentname", "parentnames", "parent");
  const spouseIdx = col("spouse_names", "spouses", "spouse_name", "spousename", "spousenames", "spouse");
  const notesIdx  = col("notes", "note", "comments", "comment");
  const genIdx    = col("generation", "generational_position", "generationalposition", "gen");
  const deceasedIdx = col("deceased", "is_deceased", "isdeceased", "dead");

  const people: ParsedPerson[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvRow(lines[i]);
    if (cells.length === 0) continue;

    const get = (idx: number) => (idx >= 0 && idx < cells.length ? cells[idx].trim().replace(/^"|"$/g, "") : "");

    const fullName =
      nameIdx >= 0
        ? get(nameIdx)
        : firstIdx >= 0 && lastIdx >= 0
        ? `${get(firstIdx)} ${get(lastIdx)}`.trim()
        : "";

    if (!fullName) continue;

    const nameParts = fullName.trim().split(/\s+/);
    const firstName = firstIdx >= 0 ? get(firstIdx) : nameParts[0] ?? "";
    const lastName =
      lastIdx >= 0 ? get(lastIdx) : nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

    // Extract a 4-digit year from either a plain year ("1935") or a date string ("1935-04-15", "April 15 1935")
    const extractYear = (raw: string): number | undefined => {
      if (!raw) return undefined;
      const yearMatch = raw.match(/\b(1[5-9]\d\d|20\d\d)\b/);
      return yearMatch ? parseInt(yearMatch[1], 10) : undefined;
    };
    const birthYear = birthIdx >= 0 ? extractYear(get(birthIdx)) : undefined;
    const deathYear = deathIdx >= 0 ? extractYear(get(deathIdx)) : undefined;
    const birthPlace = birthPlaceIdx >= 0 ? get(birthPlaceIdx) : undefined;
    const genPos = genIdx >= 0 && get(genIdx) ? parseInt(get(genIdx), 10) : undefined;
    const deceased =
      deceasedIdx >= 0
        ? ["true", "yes", "1", "x"].includes(get(deceasedIdx).toLowerCase())
        : deathYear !== undefined && !isNaN(deathYear);

    const parentRaw = get(parentIdx);
    const parentNames = parentRaw ? parentRaw.split(";").map((n) => n.trim()).filter(Boolean) : [];

    const spouseRaw = get(spouseIdx);
    const spouseNames = spouseRaw ? spouseRaw.split(";").map((n) => n.trim()).filter(Boolean) : [];

    people.push({
      fullName,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      birthYear: birthYear && !isNaN(birthYear) ? birthYear : undefined,
      deathYear: deathYear && !isNaN(deathYear) ? deathYear : undefined,
      gender: genderIdx >= 0 && get(genderIdx) ? get(genderIdx) : undefined,
      tribalNation: tribalIdx >= 0 && get(tribalIdx) ? get(tribalIdx) : undefined,
      tribalEnrollmentNumber: enrollIdx >= 0 && get(enrollIdx) ? get(enrollIdx) : undefined,
      parentNames,
      spouseNames,
      notes: [notesIdx >= 0 ? get(notesIdx) : "", birthPlace ? `b. ${birthPlace}` : ""].filter(Boolean).join("; ") || undefined,
      isDeceased: deceased,
      generationalPosition: genPos !== undefined && !isNaN(genPos) ? genPos : undefined,
    });
  }

  return people;
}

function splitCsvRow(row: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

export function buildLineageGraph(people: ParsedPerson[]): LineageGraph {
  const tribalNations = [...new Set(people.flatMap((p) => (p.tribalNation ? [p.tribalNation] : [])))] ;
  const icwaEligible = tribalNations.length > 0 || people.some((p) => p.tribalEnrollmentNumber);
  const welfareEligible = icwaEligible;
  const trustInheritance = icwaEligible || people.length > 2;

  const lastNames = [...new Set(people.flatMap((p) => (p.lastName ? [p.lastName] : [])))];
  const familyGroups = lastNames.map((n) => `${n} Family`);

  const deceased = people.filter((p) => p.isDeceased);
  const ancestorChain = deceased
    .sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999))
    .map((p) => `${p.fullName}${p.birthYear ? ` (${p.birthYear}` : ""}${p.deathYear ? `–${p.deathYear}` : p.birthYear ? ")" : ""}`);

  const maxGen = Math.max(...people.map((p) => p.generationalPosition ?? 0));
  const rootPerson = people.find((p) => (p.generationalPosition ?? 0) === Math.max(...people.map((pp) => pp.generationalPosition ?? 0)));
  const rootName = rootPerson?.fullName ?? (people[0]?.fullName ?? "Unknown");

  const lineageTags = generateLineageTags(people, tribalNations, familyGroups);

  return {
    people,
    rootName,
    totalGenerations: maxGen + 1,
    tribalNations,
    lineageTags,
    icwaEligible,
    welfareEligible,
    trustInheritance,
    familyGroups,
    ancestorChain,
  };
}

export function generateLineageTags(people: ParsedPerson[], tribalNations?: string[], familyGroups?: string[]): string[] {
  const tags = new Set<string>();

  const nations = tribalNations ?? [...new Set(people.flatMap((p) => (p.tribalNation ? [p.tribalNation] : [])))];
  const groups = familyGroups ?? [...new Set(people.flatMap((p) => (p.lastName ? [`${p.lastName} Family`] : [])))];

  for (const n of nations) tags.add(`Tribal: ${n}`);
  for (const g of groups) tags.add(g);
  if (people.some((p) => p.tribalEnrollmentNumber)) tags.add("Tribal Enrollment");
  if (people.some((p) => p.isDeceased && (p.birthYear ?? 0) < 1900)) tags.add("Pre-1900 Ancestry");
  if (nations.length > 0) tags.add("ICWA Eligible");
  if (people.length >= 3) tags.add("Multi-Generational");
  if (people.length >= 5) tags.add("Extended Family");

  const hasKnownTrustee = people.some((p) =>
    /chief|trustee|justice|elder|council/i.test(p.notes ?? "")
  );
  if (hasKnownTrustee) tags.add("Trustee Lineage");

  return Array.from(tags);
}

export function detectEligibility(graph: LineageGraph): EligibilityResult {
  const reasons: string[] = [];

  if (graph.icwaEligible) {
    reasons.push("Tribal nation membership in lineage — ICWA protections apply");
  }
  if (graph.tribalNations.length > 0) {
    reasons.push(`Tribal affiliation: ${graph.tribalNations.join(", ")}`);
  }
  if (graph.trustInheritance) {
    reasons.push("Multi-generational lineage supports trust inheritance claim");
  }
  if (graph.ancestorChain.length >= 3) {
    reasons.push(`${graph.ancestorChain.length} documented ancestors support membership verification`);
  }

  const protectionLevel: "standard" | "elevated" | "critical" =
    graph.icwaEligible && graph.trustInheritance
      ? "critical"
      : graph.icwaEligible
      ? "elevated"
      : "standard";

  return {
    icwaEligible: graph.icwaEligible,
    welfareEligible: graph.welfareEligible,
    trustInheritance: graph.trustInheritance,
    membershipVerified: graph.tribalNations.length > 0 || graph.ancestorChain.length >= 2,
    protectionLevel,
    benefitEligibility: {
      icwa: graph.icwaEligible,
      tribalWelfare: graph.welfareEligible,
      trustBeneficiary: graph.trustInheritance,
      membershipBenefits: graph.tribalNations.length > 0,
      ancestralLandRights: graph.trustInheritance && graph.tribalNations.length > 0,
    },
    reasons,
  };
}

export async function storeLineage(
  graph: LineageGraph,
  userId: number | null,
  sourceType: "csv" | "photo" | "manual"
): Promise<StoredLineageResult> {
  const nameToId = new Map<string, number>();
  const lineageIds: number[] = [];

  for (let i = 0; i < graph.people.length; i++) {
    const person = graph.people[i];
    const eligibility = detectEligibility(graph);
    const [row] = await db
      .insert(familyLineageTable)
      .values({
        userId: userId ?? undefined,
        fullName: person.fullName,
        firstName: person.firstName ?? undefined,
        lastName: person.lastName ?? undefined,
        birthYear: person.birthYear ?? undefined,
        deathYear: person.deathYear ?? undefined,
        gender: person.gender ?? undefined,
        tribalNation: person.tribalNation ?? undefined,
        tribalEnrollmentNumber: person.tribalEnrollmentNumber ?? undefined,
        notes: person.notes ?? undefined,
        isDeceased: person.isDeceased ?? false,
        isAncestor: true,
        generationalPosition: person.generationalPosition ?? i,
        sourceType,
        lineageTags: graph.lineageTags,
        icwaEligible: eligibility.icwaEligible,
        welfareEligible: eligibility.welfareEligible,
        trustBeneficiary: eligibility.trustInheritance,
        parentIds: [],
        childrenIds: [],
        spouseIds: [],
      })
      .returning();

    nameToId.set(person.fullName.toLowerCase(), row.id);
    lineageIds.push(row.id);
  }

  for (let i = 0; i < graph.people.length; i++) {
    const person = graph.people[i];
    const personId = lineageIds[i];

    const parentIds = (person.parentNames ?? [])
      .map((n) => nameToId.get(n.toLowerCase()))
      .filter((id): id is number => id !== undefined);
    const spouseIds = (person.spouseNames ?? [])
      .map((n) => nameToId.get(n.toLowerCase()))
      .filter((id): id is number => id !== undefined);

    if (parentIds.length > 0 || spouseIds.length > 0) {
      await db
        .update(familyLineageTable)
        .set({ parentIds, spouseIds })
        .where(eq(familyLineageTable.id, personId));
    }
  }

  const eligibility = detectEligibility(graph);
  const identityTags = [...graph.lineageTags];

  let narrativeId: number | null = null;
  if (userId) {
    const narrativeContent = buildNarrativeContent(graph, eligibility);
    const [narrative] = await db
      .insert(identityNarrativesTable)
      .values({
        userId,
        narrativeType: "lineage",
        title: `${graph.rootName} — ${graph.familyGroups.join(", ") || "Family Lineage"}`,
        content: narrativeContent,
        lineageTags: graph.lineageTags,
        ancestorChain: graph.ancestorChain,
        familyGroup: graph.familyGroups[0] ?? "",
        generationalDepth: graph.totalGenerations,
        generationalPosition: 0,
        protectionLevel: eligibility.protectionLevel,
        benefitEligibility: eligibility.benefitEligibility,
        icwaEligible: eligibility.icwaEligible,
        welfareEligible: eligibility.welfareEligible,
        trustInheritance: eligibility.trustInheritance,
        membershipVerified: eligibility.membershipVerified,
        identityTags,
      })
      .returning();
    narrativeId = narrative.id;

    if (graph.familyGroups[0]) {
      const existing = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
      if (existing[0]) {
        const existingTags = Array.isArray(existing[0].welfareTags) ? existing[0].welfareTags as string[] : [];
        const merged = [...new Set([...existingTags, ...identityTags])];
        await db.update(profilesTable).set({ welfareTags: merged, familyGroup: graph.familyGroups[0] }).where(eq(profilesTable.userId, userId));
      }
    }
  }

  logger.info({ lineageIds: lineageIds.length, narrativeId, userId, sourceType }, "Lineage stored");

  return { lineageIds, narrativeId, lineageGraph: graph, identityTags };
}

function buildNarrativeContent(graph: LineageGraph, eligibility: EligibilityResult): string {
  const lines: string[] = [
    `LINEAGE NARRATIVE — ${graph.rootName}`,
    "",
    `Total persons documented: ${graph.people.length}`,
    `Generations: ${graph.totalGenerations}`,
    `Tribal nations: ${graph.tribalNations.join(", ") || "None on record"}`,
    `Family groups: ${graph.familyGroups.join(", ") || "None"}`,
    "",
    "ANCESTOR CHAIN:",
    ...graph.ancestorChain.map((a) => `  • ${a}`),
    "",
    "ELIGIBILITY:",
    `  ICWA: ${eligibility.icwaEligible ? "ELIGIBLE" : "Not determined"}`,
    `  Welfare: ${eligibility.welfareEligible ? "ELIGIBLE" : "Not determined"}`,
    `  Trust: ${eligibility.trustInheritance ? "ELIGIBLE" : "Not determined"}`,
    `  Protection Level: ${eligibility.protectionLevel.toUpperCase()}`,
    "",
    "ELIGIBILITY REASONS:",
    ...eligibility.reasons.map((r) => `  • ${r}`),
  ];
  return lines.join("\n");
}

export async function getLineageForUser(userId: number) {
  const lineage = await db
    .select()
    .from(familyLineageTable)
    .where(eq(familyLineageTable.userId, userId));
  const narratives = await db
    .select()
    .from(identityNarrativesTable)
    .where(eq(identityNarrativesTable.userId, userId));
  return { lineage, narratives };
}

export async function getAncestorById(id: number) {
  const [row] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, id)).limit(1);
  if (!row) return null;
  const records = await db.select().from(ancestralRecordsTable).where(eq(ancestralRecordsTable.lineageId, id));
  return { ancestor: row, records };
}

export async function updateAncestor(id: number, updates: Partial<{
  fullName: string;
  firstName: string;
  lastName: string;
  birthYear: number;
  deathYear: number;
  gender: string;
  tribalNation: string;
  tribalEnrollmentNumber: string;
  notes: string;
  isDeceased: boolean;
  generationalPosition: number;
  lineageTags: string[];
  icwaEligible: boolean;
  welfareEligible: boolean;
  trustBeneficiary: boolean;
}>) {
  const [updated] = await db
    .update(familyLineageTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(familyLineageTable.id, id))
    .returning();
  return updated;
}

export async function linkAncestorToProfile(lineageId: number, targetUserId: number) {
  await db
    .update(familyLineageTable)
    .set({ linkedProfileUserId: targetUserId, updatedAt: new Date() })
    .where(eq(familyLineageTable.id, lineageId));

  const [lineage] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, lineageId)).limit(1);
  if (!lineage) return null;

  const [record] = await db
    .insert(ancestralRecordsTable)
    .values({
      lineageId,
      userId: targetUserId,
      recordType: "identity_link",
      recordSource: "System — Profile Identity Link",
      documentContent: `Identity link established between ${lineage.fullName} and user profile ID ${targetUserId}`,
      verificationStatus: "verified",
      icwaRelevant: lineage.icwaEligible ?? false,
      trustRelevant: lineage.trustBeneficiary ?? false,
      welfareRelevant: lineage.welfareEligible ?? false,
    })
    .returning();

  return record;
}

export async function getKnowledgeOfSelfLinks(userId: number) {
  const narratives = await db
    .select()
    .from(identityNarrativesTable)
    .where(eq(identityNarrativesTable.userId, userId));

  const linkedAncestors = await db
    .select()
    .from(familyLineageTable)
    .where(eq(familyLineageTable.linkedProfileUserId, userId));

  const records = await db
    .select()
    .from(ancestralRecordsTable)
    .where(eq(ancestralRecordsTable.userId, userId));

  return { narratives, linkedAncestors, records };
}

export function buildLineageSummaryForIntake(lineage: {
  lineage: typeof familyLineageTable.$inferSelect[];
  narratives: typeof identityNarrativesTable.$inferSelect[];
}): string {
  if (lineage.lineage.length === 0) return "No lineage on record.";

  const tribalNations = [...new Set(lineage.lineage.flatMap((l) => l.tribalNation ? [l.tribalNation] : []))];
  const icwa = lineage.lineage.some((l) => l.icwaEligible);
  const welfare = lineage.lineage.some((l) => l.welfareEligible);
  const trust = lineage.lineage.some((l) => l.trustBeneficiary);
  const tags = lineage.narratives.flatMap((n) => Array.isArray(n.lineageTags) ? n.lineageTags as string[] : []);

  return [
    `${lineage.lineage.length} lineage records documented.`,
    tribalNations.length > 0 ? `Tribal nations: ${tribalNations.join(", ")}.` : "",
    icwa ? "ICWA eligible per lineage records." : "",
    welfare ? "Tribal welfare eligible." : "",
    trust ? "Trust beneficiary per lineage." : "",
    tags.length > 0 ? `Tags: ${[...new Set(tags)].join(", ")}.` : "",
  ].filter(Boolean).join(" ");
}
