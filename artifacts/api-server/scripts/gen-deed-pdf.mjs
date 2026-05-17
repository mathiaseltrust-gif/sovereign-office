import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../../../attached_assets/tribal-grant-deed-kern-ca-APN-514-364-11-00-1.pdf");

const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
const W = 612, H = 792, ML = 72, MR = 72, LW = 468;

const doc = await PDFDocument.create();
const FR = await doc.embedFont(StandardFonts.TimesRoman);
const FB = await doc.embedFont(StandardFonts.TimesRomanBold);
const FI = await doc.embedFont(StandardFonts.TimesRomanItalic);
const FM = await doc.embedFont(StandardFonts.Courier);

const state = { pg: null, y: 0 };

function np() {
  state.pg = doc.addPage();
  state.pg.setSize(W, H);
  state.y = H - 72;
}
np();

function put(str, x, y, font, size, color) {
  state.pg.drawText(String(str), { x, y, font, size, color: color ?? rgb(0, 0, 0) });
}

function para(str, opts) {
  const font = opts?.font ?? FR;
  const size = opts?.size ?? 10;
  const x = opts?.x ?? ML;
  const maxW = opts?.maxW ?? LW;
  const lh = size * 1.45;
  const words = String(str).split(" ");
  let line = "", lines = [];
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(t, size) > maxW && line) { lines.push(line); line = w; }
    else line = t;
  }
  if (line) lines.push(line);
  for (const l of lines) {
    if (state.y < 80) np();
    const dx = opts?.center ? ML + (LW - font.widthOfTextAtSize(l, size)) / 2 : x;
    state.pg.drawText(l, { x: dx, y: state.y, font, size, color: rgb(0, 0, 0) });
    state.y -= lh;
  }
}

function hline(thick) {
  state.pg.drawLine({
    start: { x: ML, y: state.y + 4 },
    end: { x: W - MR, y: state.y + 4 },
    thickness: thick ?? 0.5,
    color: rgb(0, 0, 0)
  });
  state.y -= 4;
}

function gap(n) { state.y -= (n ?? 8); }

function sec(t) {
  para(t, { font: FB, size: 11 });
  hline();
  gap(4);
}

const cx = (s, f, sz) => ML + (LW - f.widthOfTextAtSize(s, sz)) / 2;

// ── RECORDER BOX ──────────────────────────────────────────────────────────────
state.pg.drawRectangle({ x: ML, y: state.y - 62, width: LW, height: 64, borderWidth: 1, borderColor: rgb(0,0,0), color: rgb(0.96,0.96,0.96) });
put("RECORDING REQUESTED BY AND WHEN RECORDED RETURN TO:", ML+4, state.y-11, FB, 7.5);
put("Mathias El Tribe — Office of the Chief Justice & Trustee", ML+4, state.y-23, FB, 9);
put("c/o Sovereign Land Registry  ·  Kern County Assessor-Recorder, 1115 Truxtun Ave, Bakersfield, CA 93301", ML+4, state.y-35, FR, 8.5);
put("RECORDER'S USE ONLY  ·  Document No.: ______________  ·  Recorded: ______________  ·  Book/Page: ______/______", ML+4, state.y-50, FR, 7.5, rgb(0.45,0.45,0.45));
state.y -= 76;

// ── HEADER BOX ────────────────────────────────────────────────────────────────
state.pg.drawRectangle({ x: ML, y: state.y - 68, width: LW, height: 70, borderWidth: 2, borderColor: rgb(0,0,0) });
put("MATHIAS EL TRIBE SUPREME COURT", cx("MATHIAS EL TRIBE SUPREME COURT", FB, 9), state.y-13, FB, 9);
put("TRIBAL GRANT DEED", cx("TRIBAL GRANT DEED", FB, 16), state.y-30, FB, 16);
put("Kern County, CA  —  Tribal Sovereign Land Instrument", cx("Kern County, CA  —  Tribal Sovereign Land Instrument", FI, 10), state.y-46, FI, 10);
const dl = `Instrument Date: ${today}   |   METC Title 4 — Land Trust Governance`;
put(dl, cx(dl, FR, 9), state.y-60, FR, 9);
state.y -= 82;

// ── SECTION I ─────────────────────────────────────────────────────────────────
sec("I. PARTIES TO THIS INSTRUMENT");
const c2 = ML + 122;
const rows = [
  ["Grantor:",       "Mathew-Allen: McCaster"],
  ["",               "4305 Sun Devils Avenue, Bakersfield, California 93313"],
  ["Grantee:",       "Mathias El Tribe Trust"],
  ["",               "c/o Office of the Chief Justice & Trustee, Kern County, CA"],
  ["APN:",           "514-364-11-00-1   |   Tribal Tract: MET-KERN-052"],
  ["Consideration:", "Voluntary Conveyance into Tribal Trust — No Monetary Consideration"],
  ["",               "(Exempt: 25 U.S.C. §177; Cal. Rev. & Tax. Code §11930)"],
  ["Beneficiary:",   "Members of the Mathias El Tribe and their heirs,"],
  ["",               "governed by the laws of the Mathias El Tribe — the people"],
];
for (const [lbl, val] of rows) {
  if (state.y < 80) np();
  if (lbl) put(lbl, ML, state.y, FB, 10);
  put(val, c2, state.y, FR, 10);
  state.y -= 14;
}
gap(10);

// ── SECTION II ────────────────────────────────────────────────────────────────
sec("II. LEGAL DESCRIPTION OF PROPERTY");
para("The real property situated in the County of Kern, State of California, legally described as follows:");
gap(4);
const ldL = [
  'LOT 52 OF TRACT NO. 5958 - "PHASE 2,"',
  "CITY OF BAKERSFIELD, COUNTY OF KERN, STATE OF CALIFORNIA,",
  "as per map recorded September 21, 2001,",
  "in Book 47, Pages 83-85, Kern County Recorder records.",
];
const ldH = ldL.length * 14 + 10;
state.pg.drawRectangle({ x: ML, y: state.y - ldH, width: LW, height: ldH + 2, borderWidth: 0.5, borderColor: rgb(0.6,0.6,0.6), color: rgb(0.97,0.97,0.97) });
state.y -= 4;
for (const l of ldL) { put(l, ML+6, state.y, FM, 9.5); state.y -= 14; }
gap(12);

// ── SECTION III ───────────────────────────────────────────────────────────────
sec("III. GRANTING CLAUSE & COVENANTS");
para("FOR AND IN CONSIDERATION of the purposes set forth herein, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the Grantor, Mathew-Allen: McCaster, hereby GRANTS, CONVEYS, AND TRANSFERS to the Grantee, Mathias El Tribe Trust, all right, title, and interest in and to the above-described property, in trust for the benefit of the members of the Mathias El Tribe and their heirs, subject to the following covenants:");
gap(6);
para("Anti-Alienation Covenant (METC T4 §4):  This land is held in perpetual tribal trust. No sale, encumbrance, lease, mortgage, or transfer shall be valid without the express written consent of the Office of the Chief Justice & Trustee and compliance with 25 U.S.C. §177. Any purported transfer in violation is void ab initio.");
gap(5);
para("Exclusive Jurisdiction (METC T4 §2):  This parcel is subject to the exclusive jurisdiction of the Mathias El Tribe Supreme Court. No state or county regulation, zoning ordinance, tax assessment, or administrative order shall impair, encumber, or interfere with tribal title.");
gap(5);
para("Beneficiary Designation:  This land is deposited into the Mathias El Tribe Trust by the Grantor as Chief Justice & Trustee, for the benefit of the members of the Mathias El Tribe and their heirs, governed by the organic laws of the Mathias El Tribe — the people.");
gap(10);

// ── SECTION IV ────────────────────────────────────────────────────────────────
if (state.y < 200) np();
sec("IV. SOVEREIGN PROTECTIONS & FEDERAL AUTHORITY");
const nStr = "SOVEREIGN IMMUNITY DECLARATION: This instrument is executed in exercise of the Mathias El Tribe's inherent sovereign authority. The Tribe asserts sovereign immunity from unconsented suit in connection with this land. Any challenge to tribal title must be brought in the Mathias El Tribe Supreme Court.";
const nWords = nStr.split(" "); let nLn = "", nLines = [];
for (const w of nWords) {
  const t = nLn ? nLn + " " + w : w;
  if (FR.widthOfTextAtSize(t, 9.5) > LW - 20 && nLn) { nLines.push(nLn); nLn = w; }
  else nLn = t;
}
if (nLn) nLines.push(nLn);
const nBH = nLines.length * 13 + 12;
state.pg.drawRectangle({ x: ML, y: state.y - nBH, width: LW, height: nBH + 4, borderWidth: 0, color: rgb(1, 0.98, 0.88) });
state.pg.drawLine({ start: { x: ML, y: state.y - nBH }, end: { x: ML, y: state.y + 4 }, thickness: 3, color: rgb(0.6, 0.4, 0) });
state.y -= 4;
for (const l of nLines) { put(l, ML+9, state.y, FR, 9.5); state.y -= 13; }
gap(8);
para("Exemption / Tax Status:  Transfer exempt from documentary transfer tax per Cal. Rev. & Tax. Code §11930 and 25 U.S.C. §177.");
gap(5);
para("Federal Authority:  25 U.S.C. §177 (Non-Intercourse Act); 25 U.S.C. §5108 (Indian Reorganization Act); UNDRIP Art. 26.");
gap(5);
para("Tribal Code:  METC Title 4 §3 — Tribal Land Trust Governance.");
gap(5);
para("Worcester Doctrine:  Per Worcester v. Georgia, 31 U.S. 515 (1832), no state law may supersede the laws of the Mathias El Tribe within Indian Country (18 U.S.C. §1151).");
gap(5);
para("Loper Bright Notice:  Per Loper Bright Enterprises v. Raimondo, 603 U.S. ___ (2024), no federal agency is entitled to deference in interpreting statutes affecting tribal rights. All ambiguities resolved under the Indian Canons of Construction in favor of the Tribe.");
gap(12);

// ── SECTION V — SIGNATURES ────────────────────────────────────────────────────
if (state.y < 240) np();
sec("V. EXECUTION & SIGNATURES");
para(`IN WITNESS WHEREOF, the Grantor has executed this Tribal Grant Deed as of ${today}.`);
gap(26);

const hW = (LW - 32) / 2;
const sY = state.y;
state.pg.drawLine({ start: { x: ML, y: sY }, end: { x: ML + hW, y: sY }, thickness: 0.7, color: rgb(0,0,0) });
state.pg.drawLine({ start: { x: ML + hW + 32, y: sY }, end: { x: ML + LW, y: sY }, thickness: 0.7, color: rgb(0,0,0) });
put("GRANTOR:", ML, sY-13, FB, 9);
put("GRANTEE / TRUSTEE:", ML+hW+32, sY-13, FB, 9);
put("Mathew-Allen: McCaster", ML, sY-25, FR, 9.5);
put("Mathias El Tribe Trust", ML+hW+32, sY-25, FR, 9.5);
put("Depositor / Grantor", ML, sY-37, FI, 8.5, rgb(0.35,0.35,0.35));
put("Chief Justice & Trustee, Mathias El Tribe", ML+hW+32, sY-37, FI, 8.5, rgb(0.35,0.35,0.35));
put("Date: ____________________", ML, sY-50, FR, 9);
put("Date: ____________________", ML+hW+32, sY-50, FR, 9);
state.y = sY - 70;

// ── NOTARY BLOCK ─────────────────────────────────────────────────────────────
if (state.y < 150) np();
gap(4);
const nBx = 108;
state.pg.drawRectangle({ x: ML, y: state.y - nBx, width: LW, height: nBx, borderWidth: 1, borderColor: rgb(0,0,0) });
put("ACKNOWLEDGMENT — STATE OF CALIFORNIA, COUNTY OF KERN", ML+6, state.y-14, FB, 10);
const aStr = "Before me, the undersigned Notary Public in and for said County and State, personally appeared ____________________________, known to me (or proved to me on the basis of satisfactory evidence) to be the person(s) whose name(s) is/are subscribed to the within instrument and acknowledged to me that he/she/they executed the same in his/her/their authorized capacity(ies).";
const aWords = aStr.split(" "); let aLn = "", aLines = [];
for (const w of aWords) {
  const t = aLn ? aLn + " " + w : w;
  if (FR.widthOfTextAtSize(t, 9.5) > LW - 28 && aLn) { aLines.push(aLn); aLn = w; }
  else aLn = t;
}
if (aLn) aLines.push(aLn);
let ay = state.y - 28;
for (const l of aLines) { put(l, ML+6, ay, FR, 9.5); ay -= 13; }
state.pg.drawLine({ start: { x: ML+6, y: state.y-80 }, end: { x: ML+220, y: state.y-80 }, thickness: 0.5, color: rgb(0,0,0) });
put("Notary Public", ML+6, state.y-92, FR, 9);
put("Commission Expires: ____________________", ML+6, state.y-104, FR, 8.5, rgb(0.4,0.4,0.4));
state.pg.drawRectangle({ x: ML+LW-70, y: state.y-nBx+4, width: 64, height: 48, borderWidth: 1.5, borderColor: rgb(0.5,0.5,0.5), borderDashArray: [4,3] });
put("NOTARY", ML+LW-57, state.y-nBx+30, FB, 8, rgb(0.5,0.5,0.5));
put("SEAL",   ML+LW-50, state.y-nBx+18, FB, 8, rgb(0.5,0.5,0.5));

// ── FOOTERS ───────────────────────────────────────────────────────────────────
const pc = doc.getPageCount();
const yr = new Date().getFullYear();
for (let i = 0; i < pc; i++) {
  const p = doc.getPage(i);
  p.drawLine({ start: { x: ML, y: 44 }, end: { x: W-MR, y: 44 }, thickness: 0.3, color: rgb(0.7,0.7,0.7) });
  p.drawText(`Tribal Grant Deed  ·  Kern County, CA  ·  Mathias El Tribe Sovereign Land Instrument  ·  ${yr}`, { x: ML, y: 32, font: FR, size: 7.5, color: rgb(0.5,0.5,0.5) });
  p.drawText("Prepared by the Office of the Chief Justice & Trustee — Mathias El Tribe Indigenous Intelligence System", { x: ML, y: 21, font: FR, size: 7.5, color: rgb(0.5,0.5,0.5) });
  p.drawText("METC Title 4 — Land Trust Governance  |  25 U.S.C. §177  |  18 U.S.C. §1151", { x: ML, y: 10, font: FR, size: 7.5, color: rgb(0.5,0.5,0.5) });
  p.drawText(`Page ${i+1} of ${pc}`, { x: W-MR-44, y: 10, font: FR, size: 7.5, color: rgb(0.5,0.5,0.5) });
}

const pdfBytes = await doc.save();
writeFileSync(OUT, pdfBytes);
console.log(`Saved: ${OUT} — ${pdfBytes.length} bytes, ${pc} page(s)`);
