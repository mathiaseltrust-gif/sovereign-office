import { useRef } from "react";
import { X, Printer, AlertTriangle, FileText, MapPin, Clock, Users, ShieldAlert, CheckCircle2 } from "lucide-react";
import type { AncestorRecord, AncestorContextMatch } from "@/pages/atlas";
import { USStateMapSnapshot } from "@/components/USStateMapSnapshot";

interface ContinuityReportProps {
  ancestor: AncestorRecord;
  contextMatches: AncestorContextMatch[];
  onClose: () => void;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function inferEraLabel(birthYear: number | null, deathYear: number | null): string {
  const mid = birthYear && deathYear ? Math.round((birthYear + deathYear) / 2) : birthYear ?? deathYear ?? null;
  if (!mid) return "Era unknown";
  if (mid < 1830) return "Early Republic / Pre-Removal Era";
  if (mid < 1870) return "Removal & Reservation Era";
  if (mid < 1900) return "Allotment Era";
  if (mid < 1940) return "Early Federal Period";
  if (mid < 1960) return "Termination Era";
  if (mid < 1980) return "Urban Relocation & Self-Determination Era";
  return "Modern Era";
}

function eraTerritorySummary(birthYear: number | null, deathYear: number | null, tribalNation: string | null): string {
  const era = inferEraLabel(birthYear, deathYear);
  const nation = tribalNation ? `the ${tribalNation}` : "their tribal nation";

  if (era.includes("Pre-Removal")) {
    return `During the Early Republic and Pre-Removal period, ${nation} retained significant portions of their ancestral territory. Federal treaty negotiations were underway, but tribal land bases remained largely intact across much of the eastern half of the continent and the interior West. Census records and federal enumerations from this period were inconsistent and frequently omitted or misidentified Native persons.`;
  }
  if (era.includes("Removal")) {
    return `The Removal and Reservation era marked a catastrophic contraction of tribal territories across the continent. ${tribalNation ? `The ${tribalNation} homeland` : "Ancestral tribal territories"} was subject to federal pressure, forced cession, and relocation policy. The Indian Removal Act (1830) and subsequent executive actions displaced hundreds of thousands of Indigenous people. Many families were separated, land records destroyed, and tribal enrollment systems disrupted.`;
  }
  if (era.includes("Allotment")) {
    return `The Allotment era (1887–1934) saw the Dawes Act partition communally held tribal lands into individual parcels, opening "surplus" acreage to non-Native settlement. ${tribalNation ? `Lands associated with ${tribalNation}` : "Tribal land bases"} were dramatically reduced. Federal enrollment rolls (Dawes Rolls, Baker Rolls, etc.) from this period form the evidentiary backbone of modern tribal enrollment — but their accuracy was undermined by enumerator bias, racial reclassification, and deliberate exclusion.`;
  }
  if (era.includes("Termination")) {
    return `The Termination Era (1945–1968) saw Congress formally end the federal relationship with over 100 tribes, stripping them of recognition, land, and services. Concurrent relocation programs (BIA Urban Relocation, 1952) pushed large numbers of Native families into Chicago, Los Angeles, Minneapolis, Denver, and other urban centers — often cutting ties to reservation lands and tribal documentation.`;
  }
  if (era.includes("Urban")) {
    return `The Urban Relocation and Self-Determination era transformed the geographic distribution of Native communities. Federal relocation programs moved an estimated 100,000+ Native people to urban centers by the 1970s. The Indian Self-Determination and Education Assistance Act (1975) restored meaningful tribal sovereignty, but urban-born generations often lacked documentary proof of continuous community ties required by some enrollment processes.`;
  }
  return `During this period, ${nation} operated under a complex matrix of federal Indian law, treaty rights, and state jurisdiction. Continuity evidence from this era often requires cross-referencing federal agency records, state census data, and tribal archives.`;
}

function buildContinuityStatement(ancestor: AncestorRecord, matches: AncestorContextMatch[]): string {
  const criticals = matches.filter(m => m.severityLevel === "critical");
  const highs = matches.filter(m => m.severityLevel === "high");
  const locationMatches = matches.filter(m => m.locationMatch);
  const highConf = matches.filter(m => m.confidenceLevel === "high");

  const name = ancestor.fullName;
  const lifespan = [ancestor.birthYear, ancestor.deathYear].filter(Boolean).join("–") || "unknown dates";
  const nation = ancestor.tribalNation ? `, affiliated with ${ancestor.tribalNation},` : "";

  let statement = `${name}${nation} (${lifespan}) is documented in the family lineage record as a deceased ancestor. `;

  if (matches.length === 0) {
    statement += `No temporal overlaps with catalogued federal Indian law events were identified in the current Atlas dataset. This may reflect gaps in the ancestor's date records or the Atlas event corpus, not an absence of historical exposure.`;
    return statement;
  }

  statement += `The Atlas identified ${matches.length} potentially relevant historical event${matches.length !== 1 ? "s" : ""} within or near their recorded lifespan. `;

  if (highConf.length > 0) {
    statement += `Of these, ${highConf.length} event${highConf.length !== 1 ? "s" : ""} meet the high-confidence temporal threshold — meaning birth and death year records bracket the event date within the ancestor's confirmed lifespan. `;
  }

  if (criticals.length > 0) {
    statement += `${criticals.length} critical-severity event${criticals.length !== 1 ? "s" : ""} — federal policies or court decisions with documented, severe, and widespread impact on Native people — occurred during or near this ancestor's life. `;
  }

  if (highs.length > 0) {
    statement += `${highs.length} high-severity event${highs.length !== 1 ? "s" : ""} with significant but regionally concentrated effects are also noted. `;
  }

  if (locationMatches.length > 0) {
    statement += `${locationMatches.length} event${locationMatches.length !== 1 ? "s" : ""} show geographic overlap with the ancestor's recorded or inferred tribal homeland region, strengthening the inference of potential exposure. `;
  }

  statement += `These overlaps are computationally derived from date, tribal nation, and affected-region data. They indicate plausible, potentially relevant exposure — not confirmed historical fact. Each event listed in this report should be reviewed against primary source documentation before being cited in enrollment or recognition proceedings.`;

  return statement;
}

function gapsAndCaveats(ancestor: AncestorRecord, matches: AncestorContextMatch[]): string[] {
  const caveats: string[] = [];

  if (!ancestor.birthYear && !ancestor.deathYear) {
    caveats.push("No birth or death years are recorded for this ancestor. All historical event matches are derived from era-overlap heuristics only — confidence is low across all matches. Adding date records significantly improves the evidentiary value of this report.");
  } else if (!ancestor.birthYear) {
    caveats.push("Birth year is not recorded. Events before the recorded death year are included on a born-before or near-contemporary basis, but cannot be confirmed as lifespan overlaps.");
  } else if (!ancestor.deathYear) {
    caveats.push("Death year is not recorded. Events after the recorded birth year are included on an alive-during or near-contemporary basis, but the upper bound of exposure is unknown.");
  }

  if (!ancestor.tribalNation) {
    caveats.push("No tribal nation affiliation is recorded. Geographic filtering of historical events could not be applied. All event matches are based on temporal overlap only, without regional corroboration.");
  }

  if (!ancestor.locationText && !ancestor.tribalNation) {
    caveats.push("No location data is available for this ancestor — neither from ancestral timeline event records nor from tribal nation inference. Geographic context is absent from this report.");
  } else if (!ancestor.hasTimelineLocation && ancestor.tribalNation) {
    caveats.push(`Location information is inferred from the recorded tribal nation affiliation (${ancestor.tribalNation}), not from actual place-of-record documents. This is an approximation of territory only.`);
  }

  const lowConfCount = matches.filter(m => m.confidenceLevel === "low").length;
  if (lowConfCount > 0) {
    caveats.push(`${lowConfCount} event match${lowConfCount !== 1 ? "es" : ""} ${lowConfCount !== 1 ? "are" : "is"} rated low confidence, meaning the ancestor's date records were insufficient to confirm a direct lifespan overlap. These matches are included for completeness but should not be cited as evidence without additional primary-source corroboration.`);
  }

  caveats.push("Documentary absence is not evidence of non-exposure. Enumerator bias, reclassification, destruction of records, and deliberate exclusion mean that many Native people were not accurately documented in the federal and state records that underlie this Atlas.");
  caveats.push("This report was generated by a computational system and does not constitute legal advice, a tribal enrollment determination, or an official genealogical certification. It is a research aid intended to assist attorneys, genealogists, and community members in identifying potentially relevant historical context for further investigation.");

  return caveats;
}

const relationshipLabels: Record<string, { label: string; hedged: string }> = {
  alive_during: {
    label: "Alive During",
    hedged: "Records indicate this ancestor was alive when this event occurred. This event may have directly affected them or their community.",
  },
  near_contemporary: {
    label: "Near Contemporary (±20 yr)",
    hedged: "This ancestor lived within 20 years of this event. While direct personal exposure cannot be confirmed, the policy environment shaped the world their family inhabited.",
  },
  born_before: {
    label: "Born Before Event",
    hedged: "This ancestor was born before this event and may have lived through its earliest effects.",
  },
  era_overlap: {
    label: "Era Overlap",
    hedged: "This ancestor's life partially overlapped with the era during which this event occurred. Contextual relevance is possible but not confirmed.",
  },
};

// Mirror of STATE_TILES from USStateMapSnapshot — kept in sync manually.
// [col, row] positions in a 12×7 tile grid.
const STATE_TILES_PRINT: Record<string, [number, number]> = {
  WA: [1, 0], MT: [3, 0], ND: [4, 0], MN: [5, 0], WI: [7, 1], MI: [8, 1],
  OR: [1, 1], ID: [2, 1], SD: [4, 1], WY: [3, 1], IA: [5, 1], IL: [6, 1], IN: [7, 2], OH: [8, 2],
  CA: [1, 2], NV: [2, 2], UT: [3, 2], CO: [4, 2], NE: [5, 2], MO: [6, 2], KY: [7, 3], WV: [8, 3],
  AZ: [2, 3], NM: [3, 3], KS: [5, 3], OK: [5, 4], AR: [6, 4], TN: [7, 4], VA: [8, 4], NC: [9, 4],
  TX: [4, 5], LA: [6, 5], MS: [7, 5], AL: [8, 5], GA: [9, 5], SC: [10, 5],
  FL: [9, 6],
  ME: [11, 0], NH: [11, 1], VT: [10, 1], MA: [11, 2], RI: [11, 3], CT: [10, 2],
  NY: [9, 2], PA: [9, 3], NJ: [10, 3], DE: [10, 4], MD: [9, 4],
  AK: [0, 6], HI: [2, 6],
};

const TILE_SIZE = 30;
const TILE_GAP = 2;
const GRID_COLS = 12;
const GRID_ROWS = 7;
const SVG_W = GRID_COLS * (TILE_SIZE + TILE_GAP);
const SVG_H = GRID_ROWS * (TILE_SIZE + TILE_GAP) + 22;

function buildMapSvgHtml(highlightedStates: string[], era: string, tribalNation: string | null): string {
  const hlSet = new Set(highlightedStates.map(s => s.toUpperCase()));

  const tiles = Object.entries(STATE_TILES_PRINT).map(([abbr, [col, row]]) => {
    const x = col * (TILE_SIZE + TILE_GAP);
    const y = row * (TILE_SIZE + TILE_GAP);
    const isHl = hlSet.has(abbr);
    const fill = isHl ? "#7c3a13" : "#e8e2d9";
    const stroke = isHl ? "#5a2a0e" : "#c5bdb0";
    const strokeW = isHl ? "1.5" : "0.75";
    const textFill = isHl ? "#fff" : "#6b5f50";
    const fontW = isHl ? "bold" : "normal";
    return `<rect x="${x}" y="${y}" width="${TILE_SIZE}" height="${TILE_SIZE}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>`
      + `<text x="${x + TILE_SIZE / 2}" y="${y + TILE_SIZE / 2 + 4}" text-anchor="middle" font-size="8" fill="${textFill}" font-weight="${fontW}" font-family="'Courier New',monospace">${abbr}</text>`;
  }).join("\n");

  const legendY = GRID_ROWS * (TILE_SIZE + TILE_GAP) + 4;
  const legend = `<rect x="0" y="${legendY}" width="12" height="12" rx="2" fill="#7c3a13" stroke="#5a2a0e" stroke-width="1"/>`
    + `<text x="16" y="${legendY + 10}" font-size="8" fill="#444" font-family="'Courier New',monospace">States with documented event overlap</text>`
    + `<rect x="220" y="${legendY}" width="12" height="12" rx="2" fill="#e8e2d9" stroke="#c5bdb0" stroke-width="0.75"/>`
    + `<text x="236" y="${legendY + 10}" font-size="8" fill="#888" font-family="'Courier New',monospace">No events in Atlas dataset</text>`;

  const eraLabel = escapeHtml(era);
  const nationLabel = tribalNation ? ` &middot; ${escapeHtml(tribalNation)}` : "";

  return `<div style="border:0.75pt solid #ccc;border-radius:3pt;padding:10pt;background:#fafaf8;margin-bottom:8pt;">
  <div style="font-family:'Courier New',monospace;font-size:7pt;text-transform:uppercase;letter-spacing:0.06em;color:#888;margin-bottom:6pt;">
    Territorial snapshot &mdash; ${eraLabel}${nationLabel}
  </div>
  <svg viewBox="0 0 ${SVG_W} ${SVG_H}" width="${SVG_W}" height="${SVG_H}" xmlns="http://www.w3.org/2000/svg">
    ${tiles}
    ${legend}
  </svg>
  <p style="font-size:8pt;color:#888;font-style:italic;margin-top:4pt;">States highlighted have at least one Atlas historical event &mdash; temporally overlapping with this ancestor&rsquo;s recorded lifespan &mdash; that affected those states. This is a research signal, not a confirmed location record.</p>
</div>`;
}

function buildPrintCitations(sortedEvents: AncestorContextMatch[]): string {
  if (sortedEvents.length === 0) return "";
  const lines = sortedEvents.map((m, i) => {
    const type = m.eventType?.replace(/_/g, " ") ?? "Historical event";
    const policy = m.policyArea?.replace(/_/g, " ") ?? "";
    const regions = m.affectedRegions?.length ? ` Affected regions: ${m.affectedRegions.slice(0, 4).join(", ")}.` : "";
    const states = m.statesAffected?.length ? ` States: ${m.statesAffected.slice(0, 6).join(", ")}.` : "";
    return `[${i + 1}] ${escapeHtml(m.title)} (${m.year}). ${escapeHtml(m.era)}. Type: ${escapeHtml(type)}. Policy area: ${escapeHtml(policy)}.${escapeHtml(regions)}${escapeHtml(states)} Urban Indian Continuity Atlas research database, accessed ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`;
  });
  return lines.join("\n");
}

function buildPrintHtml(
  ancestor: AncestorRecord,
  sortedEvents: AncestorContextMatch[],
  eraLabel: string,
  territorySummary: string,
  continuityStatement: string,
  caveats: string[],
  generatedDate: string,
  highlightedStates: string[],
  criticalCount: number,
  highCount: number,
  highConfCount: number,
  locationMatchCount: number,
): string {
  const safeName = escapeHtml(ancestor.fullName);
  const safeLifespan = escapeHtml([ancestor.birthYear, ancestor.deathYear].filter(Boolean).join(" – ") || "Dates unknown");
  const safeEra = escapeHtml(eraLabel);
  const safeNation = escapeHtml(ancestor.tribalNation ?? "Not recorded");
  const safeDate = escapeHtml(generatedDate);

  const eventsHtml = sortedEvents.map((m, i) => {
    const rel = relationshipLabels[m.relationshipType] ?? relationshipLabels.era_overlap;
    const sevClass = m.severityLevel === "critical" ? "critical-sev" : m.severityLevel === "high" ? "high-sev" : "moderate-sev";
    const sevBadgeClass = m.severityLevel === "critical" ? "badge-critical" : m.severityLevel === "high" ? "badge-high" : "badge-moderate";
    const confBadgeClass = m.confidenceLevel === "high" ? "badge-conf-high" : m.confidenceLevel === "moderate" ? "badge-conf-moderate" : "badge-conf-low";
    const regionMatch = m.locationMatch ? `<span class="badge badge-region">&#10003; region match</span>` : "";
    const idImpact = m.identityImpact ? `<div class="impact-box"><div class="impact-label">Identity Impact</div><p>${escapeHtml(m.identityImpact)}</p></div>` : "";
    const reclassImpact = m.reclassificationImpact ? `<div style="margin-top:4pt;font-size:9.5pt;color:#555;">&#9651; ${escapeHtml(m.reclassificationImpact)}</div>` : "";
    const relevanceNote = m.ancestorRelevanceNote ? `<div class="impact-box" style="background:#fff5f0;border-color:#d4876a;"><div class="impact-label" style="color:#8b3a15;">If this affected your ancestor</div><p>${escapeHtml(m.ancestorRelevanceNote)}</p></div>` : "";
    const metaRegions = m.affectedRegions?.length ? escapeHtml(m.affectedRegions.slice(0, 3).join(", ")) : "";
    const metaStates = m.statesAffected?.length ? ` · States: ${escapeHtml(m.statesAffected.slice(0, 5).join(", "))}` : "";

    return `<div class="event-item ${sevClass}">
      <div>
        <span class="badge ${sevBadgeClass}">${escapeHtml(m.severityLevel)}</span>
        <span class="badge ${confBadgeClass}">${escapeHtml(m.confidenceLevel)} conf.</span>
        ${regionMatch}
        <span class="badge" style="background:#f0f0f0;color:#666;">[${i + 1}]</span>
      </div>
      <div class="event-title">${escapeHtml(m.title)}</div>
      <div class="event-meta">${m.year} &middot; ${escapeHtml(m.era)} &middot; ${escapeHtml(m.eventType?.replace(/_/g, " ") ?? "")} &middot; Policy: ${escapeHtml(m.policyArea?.replace(/_/g, " ") ?? "")}${metaRegions ? ` &middot; Regions: ${metaRegions}` : ""}${metaStates}</div>
      <div class="relationship-box">
        <div class="rel-label">${escapeHtml(rel.label)}</div>
        <p>${escapeHtml(rel.hedged)}</p>
      </div>
      ${idImpact}${reclassImpact}${relevanceNote}
    </div>`;
  }).join("\n");

  const caveatsHtml = caveats.map(c => `<div class="caveat-box"><p>${escapeHtml(c)}</p></div>`).join("\n");

  const citationsText = buildPrintCitations(sortedEvents);
  const citationsHtml = citationsText
    ? `<h2>VII. Sources &amp; Citations</h2>
       <div style="font-family:'Courier New',monospace;font-size:8pt;color:#444;line-height:1.6;">
         ${citationsText.split("\n").map(line => `<p style="margin-bottom:4pt;">${line}</p>`).join("")}
       </div>`
    : "";

  const mapSvgHtml = buildMapSvgHtml(highlightedStates, eraLabel, ancestor.tribalNation);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Continuity Report — ${safeName}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; color: #1a1a1a; background: #fff; padding: 0.5in 0.75in; line-height: 1.55; }
    h1 { font-size: 20pt; font-weight: bold; margin-bottom: 4pt; }
    h2 { font-size: 12pt; font-weight: bold; margin-top: 18pt; margin-bottom: 8pt; border-bottom: 1.5pt solid #333; padding-bottom: 3pt; font-family: 'Courier New', monospace; text-transform: uppercase; letter-spacing: 0.06em; color: #444; }
    p { margin-bottom: 8pt; }
    .report-header { border-bottom: 2pt solid #1a1a1a; padding-bottom: 12pt; margin-bottom: 20pt; }
    .meta { font-family: 'Courier New', monospace; font-size: 8.5pt; color: #555; margin-top: 2pt; }
    .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt; margin-top: 8pt; }
    .profile-field { padding: 6pt 8pt; border: 0.75pt solid #ccc; border-radius: 3pt; }
    .profile-field .label { font-family: 'Courier New', monospace; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.06em; color: #666; margin-bottom: 2pt; }
    .profile-field .value { font-size: 10.5pt; }
    .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6pt; margin-bottom: 14pt; }
    .summary-stat { text-align: center; padding: 8pt; border: 0.75pt solid #ccc; border-radius: 3pt; }
    .summary-stat .num { font-size: 16pt; font-weight: bold; }
    .summary-stat .lbl { font-family: 'Courier New', monospace; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.05em; color: #666; margin-top: 2pt; }
    .event-item { border: 0.75pt solid #ccc; padding: 8pt 10pt; margin-bottom: 8pt; page-break-inside: avoid; border-radius: 3pt; }
    .event-item.critical-sev { border-left: 3pt solid #a64115; }
    .event-item.high-sev { border-left: 3pt solid #c29b40; }
    .event-item.moderate-sev { border-left: 3pt solid #5c744c; }
    .event-title { font-size: 11pt; font-weight: bold; margin: 4pt 0 2pt; }
    .event-meta { font-family: 'Courier New', monospace; font-size: 7.5pt; color: #666; margin-bottom: 5pt; }
    .badge { display: inline-block; font-family: 'Courier New', monospace; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.05em; padding: 1pt 4pt; border-radius: 2pt; margin-right: 3pt; margin-bottom: 3pt; border: 0.5pt solid #ccc; }
    .badge-critical { background: #a64115; color: #fff; border-color: #a64115; }
    .badge-high { background: #c29b40; color: #fff; border-color: #c29b40; }
    .badge-moderate { background: #5c744c; color: #fff; border-color: #5c744c; }
    .badge-conf-high { background: #e8f5e8; color: #1e6b1e; border-color: #8bcb8b; }
    .badge-conf-moderate { background: #fdf3e0; color: #8b6b00; border-color: #d4aa40; }
    .badge-conf-low { background: #f0f0f0; color: #666; border-color: #ccc; }
    .badge-region { background: #e0ecf7; color: #1a4d7c; border-color: #8ab4d4; }
    .relationship-box { background: #f7f7f7; border: 0.5pt solid #ddd; border-radius: 2pt; padding: 5pt 8pt; margin-top: 5pt; font-size: 9.5pt; }
    .rel-label { font-family: 'Courier New', monospace; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.06em; color: #666; margin-bottom: 2pt; }
    .impact-box { background: #fffbf0; border: 0.5pt solid #e8d88a; border-radius: 2pt; padding: 5pt 8pt; margin-top: 5pt; font-size: 9.5pt; }
    .impact-label { font-family: 'Courier New', monospace; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.06em; color: #8b6b00; margin-bottom: 2pt; }
    .caveat-box { background: #fff8ee; border: 1pt solid #e8c060; border-radius: 3pt; padding: 8pt 10pt; margin-bottom: 6pt; font-size: 10pt; }
    .continuity-box { background: #f0f5f0; border: 1pt solid #8bcb8b; border-radius: 3pt; padding: 10pt 12pt; font-size: 10.5pt; }
    .territory-box { background: #f5f5f0; border: 0.75pt solid #bbb; border-radius: 3pt; padding: 10pt 12pt; font-size: 10.5pt; font-style: italic; }
    .map-section { border: 0.75pt solid #ccc; border-radius: 3pt; padding: 10pt; margin-bottom: 8pt; background: #fafaf8; }
    .map-grid { display: grid; grid-template-columns: repeat(12, 28pt); gap: 2pt; margin-bottom: 8pt; }
    .map-cell { width: 28pt; height: 28pt; border-radius: 2pt; display: flex; align-items: center; justify-content: center; font-family: 'Courier New', monospace; font-size: 7pt; font-weight: bold; }
    .map-cell.hl { background: #7c3a13; color: #fff; }
    .map-cell.no { background: #e8e2d9; color: #888; font-weight: normal; }
    .map-cell.empty { background: transparent; }
    .disclaimer { font-size: 8pt; color: #777; border-top: 0.75pt solid #ccc; padding-top: 10pt; margin-top: 24pt; font-style: italic; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="report-header">
    <div class="meta">Urban Indian Continuity Atlas — Ancestor Research Report</div>
    <h1>Continuity Report: ${safeName}</h1>
    <div class="meta">Generated: ${safeDate} &nbsp;|&nbsp; Report type: Ancestor Historical Context Summary &nbsp;|&nbsp; Purpose: Enrollment research aid / legal context documentation</div>
  </div>

  <h2>I. Ancestor Profile</h2>
  <div class="profile-grid">
    <div class="profile-field"><div class="label">Full Name</div><div class="value">${safeName}</div></div>
    <div class="profile-field"><div class="label">Lifespan</div><div class="value">${safeLifespan}</div></div>
    <div class="profile-field"><div class="label">Tribal Nation</div><div class="value">${safeNation}</div></div>
    <div class="profile-field"><div class="label">Era</div><div class="value">${safeEra}</div></div>
    <div class="profile-field"><div class="label">Generation</div><div class="value">${escapeHtml(ancestor.generationalPosition ? `Generation ${ancestor.generationalPosition}` : "Not recorded")}</div></div>
    <div class="profile-field"><div class="label">Location Source</div><div class="value">${escapeHtml(ancestor.hasTimelineLocation ? `From records: ${ancestor.locationText ?? ""}` : ancestor.tribalNation ? `Inferred from tribal nation (${ancestor.tribalNation})` : "No location data available")}</div></div>
  </div>

  <h2>II. Territorial &amp; Historical Era Context</h2>
  <div class="territory-box">
    <div style="font-family:'Courier New',monospace;font-size:7.5pt;text-transform:uppercase;letter-spacing:0.06em;color:#888;margin-bottom:6pt;font-style:normal;">
      Era: ${safeEra}${ancestor.tribalNation ? ` &middot; Nation: ${safeNation}` : ""}
    </div>
    <p>${escapeHtml(territorySummary)}</p>
  </div>

  ${mapSvgHtml}

  <h2>III. Historical Event Match Summary</h2>
  <div class="summary-grid">
    <div class="summary-stat"><div class="num" style="color:#1a1a1a;">${sortedEvents.length}</div><div class="lbl">Total Events</div></div>
    <div class="summary-stat"><div class="num" style="color:#a64115;">${criticalCount}</div><div class="lbl">Critical</div></div>
    <div class="summary-stat"><div class="num" style="color:#c29b40;">${highCount}</div><div class="lbl">High Severity</div></div>
    <div class="summary-stat"><div class="num" style="color:#2d6b2d;">${highConfCount}</div><div class="lbl">High Confidence</div></div>
    <div class="summary-stat"><div class="num" style="color:#1a4d7c;">${locationMatchCount}</div><div class="lbl">Region Matches</div></div>
  </div>

  <h2>IV. Historical Event Timeline</h2>
  ${sortedEvents.length === 0
    ? `<p style="font-style:italic;color:#666;">No historical event overlaps identified for this ancestor's recorded lifespan. This may reflect absent date records rather than confirmed non-exposure.</p>`
    : eventsHtml
  }

  <h2>V. Continuity Statement</h2>
  <div class="continuity-box"><p>${escapeHtml(continuityStatement)}</p></div>

  <h2>VI. Document Gaps &amp; Caveats</h2>
  ${caveatsHtml}

  ${citationsHtml}

  <div class="disclaimer">
    This report was generated by the Urban Indian Continuity Atlas on ${safeDate}. It is a research aid produced by a computational system using publicly available historical and genealogical data. It does not constitute legal advice, a tribal enrollment determination, an official genealogical certification, or a federal recognition opinion. All historical event matches are derived from date overlap and geographic heuristics — they are indicators of potential relevance only and require review against primary source documentation before use in any legal or administrative proceeding. The Atlas data corpus is not exhaustive; absence of an event from this report does not indicate absence of exposure. Prepared for research and documentation purposes only.
  </div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;
}

export function ContinuityReport({ ancestor, contextMatches, onClose }: ContinuityReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);

  const lifespan = [ancestor.birthYear, ancestor.deathYear].filter(Boolean).join(" – ") || "Dates unknown";
  const eraLabel = inferEraLabel(ancestor.birthYear, ancestor.deathYear);
  const territorySummary = eraTerritorySummary(ancestor.birthYear, ancestor.deathYear, ancestor.tribalNation);
  const continuityStatement = buildContinuityStatement(ancestor, contextMatches);
  const caveats = gapsAndCaveats(ancestor, contextMatches);
  const generatedDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const sortedEvents = [...contextMatches].sort((a, b) => a.year - b.year);

  const criticalCount = contextMatches.filter(m => m.severityLevel === "critical").length;
  const highCount = contextMatches.filter(m => m.severityLevel === "high").length;
  const highConfCount = contextMatches.filter(m => m.confidenceLevel === "high").length;
  const locationMatchCount = contextMatches.filter(m => m.locationMatch).length;

  // Aggregate all unique states across all context matches
  const highlightedStates = Array.from(
    new Set(contextMatches.flatMap(m => m.statesAffected ?? []))
  ).sort();

  const handlePrint = () => {
    const html = buildPrintHtml(
      ancestor,
      sortedEvents,
      eraLabel,
      territorySummary,
      continuityStatement,
      caveats,
      generatedDate,
      highlightedStates,
      criticalCount,
      highCount,
      highConfCount,
      locationMatchCount,
    );
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      data-testid="continuity-report-modal"
    >
      {/* Modal container */}
      <div className="relative bg-white text-zinc-900 w-full max-w-3xl max-h-[92vh] flex flex-col rounded-lg shadow-2xl overflow-hidden">

        {/* Modal toolbar */}
        <div className="flex-none flex items-center justify-between px-5 py-3 bg-zinc-100 border-b border-zinc-200">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-zinc-600" />
            <span className="font-serif font-bold text-sm text-zinc-800">Continuity Report Preview</span>
            <span className="text-xs text-zinc-500 font-mono ml-1">— {ancestor.fullName}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-800 text-white text-xs font-medium hover:bg-zinc-700 transition-colors"
              data-testid="print-report-button"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-zinc-200 transition-colors"
              data-testid="report-close-button"
            >
              <X className="w-4 h-4 text-zinc-600" />
            </button>
          </div>
        </div>

        {/* Scrollable report body */}
        <div className="flex-1 overflow-y-auto">
          <div ref={reportRef} className="p-8 font-serif text-sm leading-relaxed max-w-2xl mx-auto">

            {/* ── Report Header ── */}
            <div className="border-b-2 border-zinc-800 pb-5 mb-7">
              <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Urban Indian Continuity Atlas</div>
              <h1 className="text-2xl font-bold leading-tight mb-1">Continuity Report</h1>
              <div className="text-base font-medium text-zinc-700 mb-2">{ancestor.fullName}</div>
              <div className="text-[10px] font-mono text-zinc-400 space-y-0.5">
                <div>Generated: {generatedDate}</div>
                <div>Report type: Ancestor Historical Context Summary</div>
                <div>Purpose: Enrollment research aid / legal context documentation</div>
              </div>
            </div>

            {/* ── I. Ancestor Profile ── */}
            <div className="mb-7">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-200 pb-1.5 mb-4 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> I. Ancestor Profile
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Full Name", value: ancestor.fullName },
                  { label: "Lifespan", value: lifespan },
                  { label: "Tribal Nation", value: ancestor.tribalNation ?? "Not recorded" },
                  { label: "Era", value: eraLabel },
                  { label: "Generation", value: ancestor.generationalPosition ? `Generation ${ancestor.generationalPosition}` : "Not recorded" },
                  {
                    label: "Location Source",
                    value: ancestor.hasTimelineLocation
                      ? `From records: ${ancestor.locationText}`
                      : ancestor.tribalNation
                        ? `Inferred from tribal nation (${ancestor.tribalNation})`
                        : "No location data available",
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="border border-zinc-200 rounded p-2.5">
                    <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-0.5">{label}</div>
                    <div className="text-sm font-medium text-zinc-800">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── II. Territorial & Historical Era Context ── */}
            <div className="mb-7">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-200 pb-1.5 mb-4 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> II. Territorial &amp; Historical Era Context
              </h2>
              <div className="bg-zinc-50 border border-zinc-200 rounded p-4 text-[11pt] leading-relaxed text-zinc-700 italic mb-3">
                <div className="not-italic text-[9px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
                  Era: {eraLabel}
                  {ancestor.tribalNation && ` · Nation: ${ancestor.tribalNation}`}
                </div>
                {territorySummary}
              </div>

              {/* Tile-grid map snapshot */}
              <USStateMapSnapshot
                highlightedStates={highlightedStates}
                tribalNation={ancestor.tribalNation}
                era={eraLabel}
                caption="States shown highlighted have at least one Atlas historical event — temporally overlapping with this ancestor's recorded lifespan — that affected those states. This is a research signal, not a confirmed location record."
              />
            </div>

            {/* ── III. Event Match Summary ── */}
            {contextMatches.length > 0 && (
              <div className="mb-7">
                <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-200 pb-1.5 mb-4 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> III. Historical Event Match Summary
                </h2>
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {[
                    { num: contextMatches.length, label: "Total Events", color: "text-zinc-800" },
                    { num: criticalCount, label: "Critical", color: "text-[#a64115]" },
                    { num: highCount, label: "High Severity", color: "text-[#c29b40]" },
                    { num: highConfCount, label: "High Confidence", color: "text-emerald-700" },
                    { num: locationMatchCount, label: "Region Matches", color: "text-blue-700" },
                  ].map(({ num, label, color }) => (
                    <div key={label} className="text-center border border-zinc-200 rounded p-2">
                      <div className={`text-xl font-bold ${color}`}>{num}</div>
                      <div className="text-[8px] font-mono uppercase tracking-wider text-zinc-500 mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── IV. Historical Event Timeline ── */}
            <div className="mb-7">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-200 pb-1.5 mb-4 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> IV. Historical Event Timeline
              </h2>

              {sortedEvents.length === 0 ? (
                <p className="text-zinc-500 italic text-[11px]">No historical event overlaps identified for this ancestor's recorded lifespan.</p>
              ) : (
                <div className="space-y-3">
                  {sortedEvents.map((match, i) => {
                    const rel = relationshipLabels[match.relationshipType] ?? relationshipLabels.era_overlap;
                    const sevBorderColor =
                      match.severityLevel === "critical" ? "border-l-[#a64115]" :
                      match.severityLevel === "high" ? "border-l-[#c29b40]" :
                      "border-l-[#5c744c]";
                    const sevBadgeColor =
                      match.severityLevel === "critical" ? "bg-[#a64115] text-white" :
                      match.severityLevel === "high" ? "bg-[#c29b40] text-white" :
                      "bg-[#5c744c] text-white";
                    const confBadgeColor =
                      match.confidenceLevel === "high" ? "bg-emerald-50 text-emerald-800 border-emerald-300" :
                      match.confidenceLevel === "moderate" ? "bg-amber-50 text-amber-800 border-amber-300" :
                      "bg-zinc-100 text-zinc-600 border-zinc-300";

                    return (
                      <div
                        key={`${match.eventId}-${i}`}
                        className={`border border-zinc-200 border-l-4 ${sevBorderColor} rounded p-3`}
                      >
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          <span className={`inline-block text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded ${sevBadgeColor}`}>
                            {match.severityLevel}
                          </span>
                          <span className={`inline-block text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border ${confBadgeColor}`}>
                            {match.confidenceLevel} conf.
                          </span>
                          {match.locationMatch && (
                            <span className="inline-flex items-center gap-0.5 text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              <CheckCircle2 className="w-2 h-2" /> region match
                            </span>
                          )}
                          <span className="inline-block text-[8px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 border border-zinc-200">
                            [{i + 1}]
                          </span>
                        </div>
                        <div className="font-bold text-[11px] mb-0.5 leading-snug">{match.title}</div>
                        <div className="text-[9px] font-mono text-zinc-500 mb-2">
                          {match.year} · {match.era} · {match.eventType?.replace(/_/g, " ")} · Policy: {match.policyArea?.replace(/_/g, " ")}
                          {match.affectedRegions?.length > 0 && ` · Regions: ${match.affectedRegions.slice(0, 3).join(", ")}`}
                          {match.statesAffected?.length > 0 && ` · States: ${match.statesAffected.slice(0, 5).join(", ")}`}
                        </div>

                        <div className="bg-zinc-50 border border-zinc-200 rounded p-2 mb-1.5">
                          <div className="text-[8.5px] font-mono uppercase tracking-wider text-zinc-400 mb-0.5">{rel.label}</div>
                          <p className="text-[10px] leading-relaxed text-zinc-700">{rel.hedged}</p>
                        </div>

                        {match.identityImpact && (
                          <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-1.5">
                            <div className="text-[8.5px] font-mono uppercase tracking-wider text-amber-700 mb-0.5">Identity Impact</div>
                            <p className="text-[10px] leading-relaxed text-zinc-700">{match.identityImpact}</p>
                          </div>
                        )}

                        {match.reclassificationImpact && (
                          <div className="flex items-start gap-1.5 mt-1">
                            <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                            <p className="text-[10px] leading-relaxed text-zinc-600">{match.reclassificationImpact}</p>
                          </div>
                        )}

                        {match.ancestorRelevanceNote && (
                          <div className="bg-[#a64115]/5 border border-[#a64115]/20 rounded p-2 mt-1.5">
                            <span className="text-[8.5px] font-mono font-medium text-[#a64115]/80 uppercase tracking-wider">If this affected your ancestor: </span>
                            <p className="text-[10px] leading-relaxed text-zinc-600 mt-0.5">{match.ancestorRelevanceNote}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── V. Continuity Statement ── */}
            <div className="mb-7">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-200 pb-1.5 mb-4 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> V. Continuity Statement
              </h2>
              <div className="bg-emerald-50 border border-emerald-200 rounded p-4 text-[11px] leading-relaxed text-zinc-800">
                {continuityStatement}
              </div>
            </div>

            {/* ── VI. Document Gaps & Caveats ── */}
            <div className="mb-7">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-200 pb-1.5 mb-4 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> VI. Document Gaps &amp; Caveats
              </h2>
              <div className="space-y-2.5">
                {caveats.map((c, i) => (
                  <div key={i} className="bg-amber-50 border border-amber-200 rounded p-3">
                    <p className="text-[10.5px] leading-relaxed text-zinc-700">{c}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── VII. Sources & Citations ── */}
            {sortedEvents.length > 0 && (
              <div className="mb-7">
                <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-200 pb-1.5 mb-4 flex items-center gap-1.5">
                  <FileText className="w-3 h-3" /> VII. Sources &amp; Citations
                </h2>
                <div className="space-y-1.5">
                  {sortedEvents.map((m, i) => {
                    const type = m.eventType?.replace(/_/g, " ") ?? "historical event";
                    const policy = m.policyArea?.replace(/_/g, " ") ?? "";
                    const regions = m.affectedRegions?.length ? ` Affected regions: ${m.affectedRegions.slice(0, 4).join(", ")}.` : "";
                    const states = m.statesAffected?.length ? ` States: ${m.statesAffected.slice(0, 6).join(", ")}.` : "";
                    return (
                      <div key={`cite-${m.eventId}-${i}`} className="text-[9.5px] font-mono text-zinc-600 leading-relaxed bg-zinc-50 border border-zinc-200 rounded px-3 py-2">
                        <span className="font-bold text-zinc-800">[{i + 1}]</span>{" "}
                        {m.title} ({m.year}). {m.era}. Type: {type}. Policy area: {policy}.{regions}{states}{" "}
                        <span className="italic text-zinc-400">Urban Indian Continuity Atlas research database, accessed {generatedDate}.</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Footer / Legal Disclaimer ── */}
            <div className="border-t border-zinc-200 pt-4 mt-6">
              <p className="text-[9px] text-zinc-400 leading-relaxed italic">
                This report was generated by the Urban Indian Continuity Atlas on {generatedDate}. It is a research aid produced by a computational system using publicly available historical and genealogical data. It does not constitute legal advice, a tribal enrollment determination, an official genealogical certification, or a federal recognition opinion. All historical event matches are derived from date overlap and geographic heuristics — they are indicators of potential relevance only and require review against primary source documentation before use in any legal or administrative proceeding. Prepared for research and documentation purposes only.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
