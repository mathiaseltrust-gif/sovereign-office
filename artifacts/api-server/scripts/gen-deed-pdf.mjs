import { writeFileSync } from "fs";
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

// ── Page/cursor state ──────────────────────────────────────────────────────────
const s = { pg: null, y: 0 };

function np() {
  s.pg = doc.addPage();
  s.pg.setSize(W, H);
  s.y = H - 72;
}
np();

function put(str, x, y, font, size, color) {
  s.pg.drawText(String(str), { x, y, font, size, color: color ?? rgb(0, 0, 0) });
}

function cx(str, font, size) {
  return ML + (LW - font.widthOfTextAtSize(str, size)) / 2;
}

// Word-wrapped paragraph — advances s.y
function para(str, opts) {
  const font  = opts?.font  ?? FR;
  const size  = opts?.size  ?? 10;
  const x     = opts?.x     ?? ML;
  const maxW  = opts?.maxW  ?? LW;
  const lh    = size * 1.5;
  const words = String(str).split(" ");
  let line = "", lines = [];
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(t, size) > maxW && line) { lines.push(line); line = w; }
    else line = t;
  }
  if (line) lines.push(line);
  for (const l of lines) {
    if (s.y < 90) np();
    const dx = opts?.center ? cx(l, font, size) : x;
    s.pg.drawText(l, { x: dx, y: s.y, font, size, color: rgb(0, 0, 0) });
    s.y -= lh;
  }
}

function hline(thick, color) {
  s.pg.drawLine({
    start: { x: ML,     y: s.y + 4 },
    end:   { x: W - MR, y: s.y + 4 },
    thickness: thick ?? 0.5,
    color: color ?? rgb(0, 0, 0),
  });
  s.y -= 6;
}

function gap(n) { s.y -= (n ?? 8); }

function secHead(t) {
  para(t, { font: FB, size: 11 });
  hline(0.75);
  gap(6);
}

// ════════════════════════════════════════════════════════════════════════════
//  PAGE 1 — THE DEED
// ════════════════════════════════════════════════════════════════════════════

// ── RECORDING HEADER ──────────────────────────────────────────────────────────
// Top recording space (blank — recorder writes here)
s.pg.drawRectangle({ x: ML, y: s.y - 50, width: LW, height: 52,
  borderWidth: 1, borderColor: rgb(0,0,0), color: rgb(1,1,1) });
put("Recording space — recorder's use only", ML + 4, s.y - 20, FI, 8, rgb(0.6,0.6,0.6));
s.y -= 62;

// Return address block
s.pg.drawRectangle({ x: ML, y: s.y - 58, width: LW, height: 60,
  borderWidth: 1, borderColor: rgb(0,0,0), color: rgb(0.97,0.97,0.97) });
put("RECORDING REQUESTED BY:", ML+6, s.y - 12, FB, 8);
put("Mathias El Tribe — Office of the Chief Justice & Trustee", ML+6, s.y - 25, FB, 9.5);
put("c/o Sovereign Land Registry Office", ML+6, s.y - 37, FR, 9);
put("Kern County Assessor-Recorder  ·  1115 Truxtun Ave, Bakersfield, CA 93301  ·  (661) 868-3588", ML+6, s.y - 49, FR, 8.5);
s.y -= 70;

// Recorder divider line
hline(0.5, rgb(0.4,0.4,0.4));
para("RECORDER'S USE ONLY — Document No.: _______________ · Recorded: _______________ · Book/Page: ______/______",
  { font: FR, size: 7.5, center: true, color: rgb(0.45,0.45,0.45) });
hline(0.5, rgb(0.4,0.4,0.4));
gap(16);

// ── COURT + INSTRUMENT TITLE ──────────────────────────────────────────────────
// Court name — small, above title
para("MATHIAS EL TRIBE SUPREME COURT", { font: FB, size: 9.5, center: true });
gap(2);

// Main title — large and dominant
para("TRIBAL GRANT DEED", { font: FB, size: 20, center: true });
gap(4);

// Subtitle — clearly subordinate
para("Kern County, California", { font: FI, size: 10.5, center: true });
para("Tribal Sovereign Land Instrument", { font: FR, size: 9, center: true });
gap(10);

// Instrument details line
s.pg.drawLine({ start:{x:ML, y:s.y+4}, end:{x:W-MR, y:s.y+4}, thickness:0.3, color:rgb(0.5,0.5,0.5) });
s.y -= 6;
const detailsY = s.y;
put(`Instrument Date: ${today}`, ML, detailsY, FR, 9);
put("APN: 514-364-11-00-1", W - MR - FR.widthOfTextAtSize("APN: 514-364-11-00-1", 9), detailsY, FR, 9);
s.y -= 14;
put("Reference: METC Title 4 — Land Trust Governance", ML, s.y, FI, 8.5, rgb(0.3,0.3,0.3));
s.y -= 14;
s.pg.drawLine({ start:{x:ML, y:s.y+4}, end:{x:W-MR, y:s.y+4}, thickness:0.3, color:rgb(0.5,0.5,0.5) });
s.y -= 16;

// ── SECTION I — PARTIES ───────────────────────────────────────────────────────
secHead("I. PARTIES TO THIS INSTRUMENT");
const c2 = ML + 122;
const rows = [
  ["Grantor:",       "Mathew-Allen: McCaster"],
  ["",               "4305 Sun Devils Avenue, Bakersfield, California 93313"],
  ["",               ""],
  ["Grantee:",       "Mathias El Tribe Trust"],
  ["",               "c/o Office of the Chief Justice & Trustee, Kern County, CA"],
  ["",               ""],
  ["APN:",           "514-364-11-00-1"],
  ["Tribal Tract:",  "MET-KERN-052"],
  ["",               ""],
  ["Consideration:", "Voluntary Conveyance into Tribal Trust — No Monetary Consideration"],
  ["",               "(Exempt: 25 U.S.C. §177; Cal. Rev. & Tax. Code §11930)"],
  ["",               ""],
  ["Beneficiary:",   "Members of the Mathias El Tribe and their heirs,"],
  ["",               "as governed by the laws of the Mathias El Tribe — the people"],
];
for (const [lbl, val] of rows) {
  if (!lbl && !val) { gap(4); continue; }
  if (s.y < 90) np();
  if (lbl) put(lbl, ML, s.y, FB, 10);
  put(val, c2, s.y, FR, 10);
  s.y -= 14;
}
gap(12);

// ── SECTION II — LEGAL DESCRIPTION ───────────────────────────────────────────
secHead("II. LEGAL DESCRIPTION OF PROPERTY");
para("The real property situated in the County of Kern, State of California, legally described as follows:");
gap(6);
const ldL = [
  'LOT 52 OF TRACT NO. 5958 - "PHASE 2,"',
  "CITY OF BAKERSFIELD, COUNTY OF KERN, STATE OF CALIFORNIA,",
  "as per map recorded September 21, 2001,",
  "in Book 47, Pages 83-85, Kern County Recorder records.",
];
const ldH = ldL.length * 15 + 16;
s.pg.drawRectangle({ x: ML, y: s.y - ldH, width: LW, height: ldH + 4,
  borderWidth: 0.5, borderColor: rgb(0.55,0.55,0.55), color: rgb(0.97,0.97,0.97) });
s.y -= 6;
for (const l of ldL) { put(l, ML+8, s.y, FM, 9.5); s.y -= 15; }
gap(14);

// ── SECTION III — GRANTING CLAUSE ────────────────────────────────────────────
secHead("III. GRANTING CLAUSE");
para("FOR AND IN CONSIDERATION of the purposes set forth herein, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the Grantor, Mathew-Allen: McCaster, hereby GRANTS, CONVEYS, AND TRANSFERS to the Grantee, Mathias El Tribe Trust, all right, title, and interest in and to the above-described real property, to be held in trust for the benefit of the members of the Mathias El Tribe and their heirs.");
gap(10);
para("This conveyance is made subject to the Protective Covenants set forth in the attached Exhibit A, and to the jurisdictional position of the Sovereign Office as set forth in the attached Sovereign Notice.");
gap(10);
para("The Grantor warrants that this conveyance is made voluntarily, with full knowledge of its effect, and that no monetary consideration has passed between the parties in connection with this transfer.");
gap(12);

// ── SECTION IV — TRUST STRUCTURE ─────────────────────────────────────────────
secHead("IV. TRUST STRUCTURE & BENEFICIARY DESIGNATION");
para("This land is deposited into the Mathias El Tribe Trust by the Grantor, Mathew-Allen: McCaster, acting as Chief Justice & Trustee, pursuant to the tribal land governance authority vested in the Office of the Chief Justice & Trustee under METC Title 4.");
gap(8);

const trustRows = [
  ["Trust Name:",       "Mathias El Tribe Trust"],
  ["Trustee:",          "Office of the Chief Justice & Trustee, Mathias El Tribe"],
  ["Beneficiary Class:","Members of the Mathias El Tribe and their heirs"],
  ["Governing Law:",    "Laws of the Mathias El Tribe — the people"],
  ["Tribal Code:",      "METC Title 4 §3 — Tribal Land Trust Governance"],
  ["Federal Basis:",    "25 U.S.C. §177; 25 U.S.C. §5108; Federal Trust Responsibility"],
  ["Tax Exemption:",    "Cal. Rev. & Tax. Code §11930; 25 U.S.C. §177"],
];
const trC2 = ML + 140;
for (const [lbl, val] of trustRows) {
  if (s.y < 90) np();
  put(lbl, ML, s.y, FB, 9.5);
  put(val, trC2, s.y, FR, 9.5);
  s.y -= 14;
}
gap(14);

// ── SECTION V — EXECUTION & SIGNATURES ───────────────────────────────────────
if (s.y < 200) np();
secHead("V. EXECUTION & SIGNATURES");
para(`IN WITNESS WHEREOF, the Grantor has executed this Tribal Grant Deed as of ${today}.`);
gap(30);

// Two equal signature columns
const colW   = (LW - 48) / 2;
const col1x  = ML;
const col2x  = ML + colW + 48;
const sigLineLen = colW;
const sigY   = s.y;

// Signature lines
s.pg.drawLine({ start:{x:col1x, y:sigY}, end:{x:col1x+sigLineLen, y:sigY}, thickness:0.8, color:rgb(0,0,0) });
s.pg.drawLine({ start:{x:col2x, y:sigY}, end:{x:col2x+sigLineLen, y:sigY}, thickness:0.8, color:rgb(0,0,0) });

// Labels above lines (role)
put("GRANTOR",          col1x, sigY + 10, FB, 8.5, rgb(0.3,0.3,0.3));
put("GRANTEE / TRUSTEE", col2x, sigY + 10, FB, 8.5, rgb(0.3,0.3,0.3));

// Printed name
put("Mathew-Allen: McCaster",               col1x, sigY - 14, FR, 10);
put("Mathias El Tribe Trust",               col2x, sigY - 14, FR, 10);

// Title
put("Depositor / Grantor",                  col1x, sigY - 27, FI, 9, rgb(0.3,0.3,0.3));
put("Chief Justice & Trustee",              col2x, sigY - 27, FI, 9, rgb(0.3,0.3,0.3));
put("Mathias El Tribe",                     col2x, sigY - 38, FI, 9, rgb(0.3,0.3,0.3));

// Date line
s.pg.drawLine({ start:{x:col1x, y:sigY-54}, end:{x:col1x+sigLineLen, y:sigY-54}, thickness:0.6, color:rgb(0,0,0) });
s.pg.drawLine({ start:{x:col2x, y:sigY-54}, end:{x:col2x+sigLineLen, y:sigY-54}, thickness:0.6, color:rgb(0,0,0) });
put("Date", col1x, sigY - 65, FR, 8.5, rgb(0.4,0.4,0.4));
put("Date", col2x, sigY - 65, FR, 8.5, rgb(0.4,0.4,0.4));

s.y = sigY - 80;

// ── NOTARY BLOCK ─────────────────────────────────────────────────────────────
if (s.y < 190) np();
gap(14);
const nBH = 148;
s.pg.drawRectangle({ x: ML, y: s.y - nBH, width: LW, height: nBH,
  borderWidth: 1.2, borderColor: rgb(0,0,0) });

put("NOTARY ACKNOWLEDGMENT", cx("NOTARY ACKNOWLEDGMENT", FB, 10.5), s.y - 16, FB, 10.5);

// Horizontal rule inside notary box
s.pg.drawLine({ start:{x:ML, y:s.y-22}, end:{x:W-MR, y:s.y-22}, thickness:0.4, color:rgb(0.5,0.5,0.5) });

const ackStr = "State of California, County of Kern. Before me, the undersigned Notary Public, personally appeared ____________________________, and proved to me on the basis of satisfactory evidence to be the person whose name is subscribed to the within instrument and acknowledged to me that he/she executed the same in an authorized capacity. I certify under PENALTY OF PERJURY under the laws of the State of California that the foregoing paragraph is true and correct.";
const aWords = ackStr.split(" "); let aLn = "", aLines = [];
for (const w of aWords) {
  const t = aLn ? aLn + " " + w : w;
  if (FR.widthOfTextAtSize(t, 9.5) > LW - 24 && aLn) { aLines.push(aLn); aLn = w; }
  else aLn = t;
}
if (aLn) aLines.push(aLn);
let ay = s.y - 34;
for (const l of aLines) { put(l, ML+8, ay, FR, 9.5); ay -= 14; }

// Notary signature row
const notarySigY = s.y - nBH + 50;
s.pg.drawLine({ start:{x:ML+8, y:notarySigY}, end:{x:ML+210, y:notarySigY}, thickness:0.6, color:rgb(0,0,0) });
put("Notary Public Signature", ML+8, notarySigY - 13, FR, 8.5, rgb(0.3,0.3,0.3));
s.pg.drawLine({ start:{x:ML+230, y:notarySigY}, end:{x:ML+360, y:notarySigY}, thickness:0.6, color:rgb(0,0,0) });
put("Commission Expires", ML+230, notarySigY - 13, FR, 8.5, rgb(0.3,0.3,0.3));

// Seal box — large enough for a real stamp
const sealX = ML + LW - 96;
const sealY = s.y - nBH + 8;
s.pg.drawRectangle({ x: sealX, y: sealY, width: 88, height: 80,
  borderWidth: 1.5, borderColor: rgb(0.45,0.45,0.45), borderDashArray: [5,3] });
put("NOTARY", sealX + 20, sealY + 48, FB, 9, rgb(0.5,0.5,0.5));
put("OFFICIAL", sealX + 16, sealY + 36, FB, 9, rgb(0.5,0.5,0.5));
put("SEAL", sealX + 26, sealY + 24, FB, 9, rgb(0.5,0.5,0.5));

s.y -= nBH + 10;

// ════════════════════════════════════════════════════════════════════════════
//  PAGE 2 — SOVEREIGN NOTICE (EXHIBIT A)
// ════════════════════════════════════════════════════════════════════════════
np();

// Page header
s.pg.drawRectangle({ x: ML, y: s.y - 42, width: LW, height: 44,
  borderWidth: 1.5, borderColor: rgb(0,0,0) });
put("SOVEREIGN NOTICE — EXHIBIT A", cx("SOVEREIGN NOTICE — EXHIBIT A", FB, 13), s.y - 15, FB, 13);
put("Jurisdictional Position & Protective Covenants", cx("Jurisdictional Position & Protective Covenants", FI, 10), s.y - 30, FI, 10);
s.y -= 56;

para("This Sovereign Notice is issued by the Sovereign Office of the Chief Justice & Trustee of the Mathias El Tribe and is recorded as an integral part of the Tribal Grant Deed to which it is attached. It sets forth the jurisdictional position, anti-alienation covenants, and federal authority governing the land conveyed therein.");
gap(14);

secHead("A. JURISDICTIONAL POSITION");
para("The Mathias El Tribe Supreme Court retains exclusive jurisdiction over all matters arising from this trust land, including disputes, encroachments, and unauthorized claims. This land is subject to the organic laws of the Mathias El Tribe.");
gap(8);
para("Federal law exclusively governs this trust land pursuant to the Federal Trust Responsibility. State and county regulations, zoning ordinances, and administrative orders do not supersede the authority of the Mathias El Tribe within Indian Country. Worcester v. Georgia, 31 U.S. 515 (1832).");
gap(14);

secHead("B. ANTI-ALIENATION COVENANT");
para("This land is held in perpetual tribal trust. No sale, encumbrance, lease, mortgage, or transfer shall be valid without the express written consent of the Office of the Chief Justice & Trustee and compliance with 25 U.S.C. §177 (Non-Intercourse Act). Any purported transfer made without such consent is void ab initio.");
gap(8);
para("All subsequent purchasers, lenders, and encumbrancers receive constructive notice of this trust status and anti-alienation covenant by virtue of its recordation in the official records of Kern County.");
gap(14);

secHead("C. STATE TAX EXEMPTION");
para("This trust land is exempt from state and local taxation pursuant to the Federal Trust Responsibility. McClanahan v. Arizona State Tax Comm'n, 411 U.S. 164 (1973). No state or county tax lien may attach to this property. The transfer is exempt from documentary transfer tax per Cal. Rev. & Tax. Code §11930.");
gap(14);

secHead("D. SOVEREIGN IMMUNITY DECLARATION");
// Amber notice box
const sIDStr = "This instrument is executed in exercise of the Mathias El Tribe's inherent sovereign authority. The Tribe asserts sovereign immunity from unconsented suit in connection with this land. Any challenge to tribal title must be brought in the Mathias El Tribe Supreme Court.";
const siWords = sIDStr.split(" "); let siLn = "", siLines = [];
for (const w of siWords) {
  const t = siLn ? siLn + " " + w : w;
  if (FR.widthOfTextAtSize(t, 10) > LW - 22 && siLn) { siLines.push(siLn); siLn = w; }
  else siLn = t;
}
if (siLn) siLines.push(siLn);
const siBH = siLines.length * 15 + 16;
s.pg.drawRectangle({ x:ML, y:s.y-siBH, width:LW, height:siBH+4,
  borderWidth: 0, color: rgb(1, 0.97, 0.85) });
s.pg.drawLine({ start:{x:ML, y:s.y-siBH}, end:{x:ML, y:s.y+4},
  thickness: 4, color: rgb(0.6, 0.4, 0) });
s.y -= 6;
for (const l of siLines) { put(l, ML+10, s.y, FR, 10); s.y -= 15; }
gap(14);

secHead("E. FEDERAL LEGAL FRAMEWORK");
para("This Sovereign Notice invokes the following federal authorities:");
gap(6);
const feds = [
  ["25 U.S.C. §177",     "Non-Intercourse Act — protection against unauthorized alienation"],
  ["25 U.S.C. §5108",    "Indian Reorganization Act — tribal trust land acquisition authority"],
  ["25 U.S.C. §2201",    "Indian Land Consolidation Act"],
  ["18 U.S.C. §1151",    "Definition of Indian Country — federal jurisdiction"],
  ["UNDRIP Art. 26",     "Indigenous peoples' rights to their traditional lands"],
  ["Morton v. Mancari",  "417 U.S. 535 (1974) — political, not racial, nature of tribal status"],
  ["Loper Bright",       "603 U.S. ___ (2024) — no agency deference; ambiguities resolved"],
  ["",                    "under Indian Canons of Construction in favor of the Tribe"],
];
const fedC2 = ML + 130;
for (const [cite, desc] of feds) {
  if (s.y < 90) np();
  if (cite) put(cite, ML, s.y, FB, 9.5);
  put(desc, fedC2, s.y, FR, 9.5);
  s.y -= 14;
}
gap(16);

// Sovereign Office signature block on Exhibit A
if (s.y < 100) np();
s.pg.drawLine({ start:{x:ML, y:s.y}, end:{x:ML+220, y:s.y}, thickness:0.8, color:rgb(0,0,0) });
put("SOVEREIGN OFFICE", ML, s.y + 10, FB, 8.5, rgb(0.3,0.3,0.3));
s.y -= 14;
put("Chief Justice & Trustee, Mathias El Tribe", ML, s.y, FR, 9.5);
s.y -= 13;
put("Sovereign Office of the Chief Justice & Trustee", ML, s.y, FI, 9, rgb(0.3,0.3,0.3));
s.y -= 13;
s.pg.drawLine({ start:{x:ML, y:s.y}, end:{x:ML+140, y:s.y}, thickness:0.6, color:rgb(0,0,0) });
s.y -= 13;
put("Date", ML, s.y, FR, 8.5, rgb(0.4,0.4,0.4));

// ── PAGE FOOTERS ──────────────────────────────────────────────────────────────
const pc = doc.getPageCount();
const yr = new Date().getFullYear();
const footerLines = [
  "Tribal Grant Deed with Sovereign Notice  ·  Kern County, CA  ·  Mathias El Tribe  ·  " + yr,
  "Office of the Chief Justice & Trustee — Mathias El Tribe Indigenous Intelligence System",
  "METC Title 4 — Land Trust Governance  |  25 U.S.C. §177  |  18 U.S.C. §1151",
];
for (let i = 0; i < pc; i++) {
  const p = doc.getPage(i);
  p.drawLine({ start:{x:ML, y:46}, end:{x:W-MR, y:46}, thickness:0.3, color:rgb(0.65,0.65,0.65) });
  p.drawText(footerLines[0], { x: ML, y: 34, font: FR, size: 7.5, color: rgb(0.5,0.5,0.5) });
  p.drawText(footerLines[1], { x: ML, y: 23, font: FR, size: 7.5, color: rgb(0.5,0.5,0.5) });
  p.drawText(footerLines[2], { x: ML, y: 12, font: FR, size: 7.5, color: rgb(0.5,0.5,0.5) });
  p.drawText(`Page ${i + 1} of ${pc}`, { x: W - MR - 46, y: 12, font: FR, size: 7.5, color: rgb(0.5,0.5,0.5) });
}

const pdfBytes = await doc.save();
writeFileSync(OUT, pdfBytes);
console.log(`Saved: ${OUT} — ${pdfBytes.length} bytes, ${pc} page(s)`);
