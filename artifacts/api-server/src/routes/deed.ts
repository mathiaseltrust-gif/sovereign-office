import { Router } from "express";
import { requireAuth } from "../auth/entra-guard";

const router = Router();

// ── County Registry ───────────────────────────────────────────────────────────

interface CountyRecord {
  slug: string;
  name: string;
  state: string;
  recorderOffice: string;
  address: string;
  phone: string;
  parcelLabel: string;
  deedTypes: string[];
}

const COUNTIES: CountyRecord[] = [
  // ── Michigan ────────────────────────────────────────────────────────────────
  { slug: "oakland-mi",   name: "Oakland County",    state: "MI", recorderOffice: "Oakland County Register of Deeds",           address: "1200 N Telegraph Rd, Pontiac, MI 48341",           phone: "(248) 858-0577", parcelLabel: "Parcel ID",                      deedTypes: ["Tribal Trust Deed","Warranty Deed","Quit Claim Deed","Land Contract"] },
  { slug: "wayne-mi",     name: "Wayne County",      state: "MI", recorderOffice: "Wayne County Register of Deeds",             address: "400 Monroe St, Detroit, MI 48226",                 phone: "(313) 224-5990", parcelLabel: "Parcel ID",                      deedTypes: ["Tribal Trust Deed","Warranty Deed","Quit Claim Deed"] },
  { slug: "macomb-mi",    name: "Macomb County",     state: "MI", recorderOffice: "Macomb County Register of Deeds",            address: "1 S Main St, Mount Clemens, MI 48043",             phone: "(586) 469-5120", parcelLabel: "Parcel ID",                      deedTypes: ["Tribal Trust Deed","Warranty Deed","Quit Claim Deed"] },
  { slug: "washtenaw-mi", name: "Washtenaw County",  state: "MI", recorderOffice: "Washtenaw County Register of Deeds",         address: "200 N Main St, Ann Arbor, MI 48107",               phone: "(734) 222-6790", parcelLabel: "Parcel ID",                      deedTypes: ["Tribal Trust Deed","Warranty Deed","Quit Claim Deed"] },
  { slug: "kent-mi",      name: "Kent County",       state: "MI", recorderOffice: "Kent County Register of Deeds",              address: "300 Monroe Ave NW, Grand Rapids, MI 49503",        phone: "(616) 632-7610", parcelLabel: "Parcel ID",                      deedTypes: ["Tribal Trust Deed","Warranty Deed","Quit Claim Deed"] },
  { slug: "genesee-mi",   name: "Genesee County",    state: "MI", recorderOffice: "Genesee County Register of Deeds",           address: "1101 Beach St, Flint, MI 48502",                   phone: "(810) 257-3060", parcelLabel: "Parcel ID",                      deedTypes: ["Tribal Trust Deed","Warranty Deed","Quit Claim Deed"] },
  { slug: "ingham-mi",    name: "Ingham County",     state: "MI", recorderOffice: "Ingham County Register of Deeds",            address: "341 S Jefferson St, Mason, MI 48854",              phone: "(517) 676-7270", parcelLabel: "Parcel ID",                      deedTypes: ["Tribal Trust Deed","Warranty Deed","Quit Claim Deed"] },
  { slug: "kalamazoo-mi", name: "Kalamazoo County",  state: "MI", recorderOffice: "Kalamazoo County Register of Deeds",         address: "201 W Kalamazoo Ave, Kalamazoo, MI 49007",         phone: "(269) 383-8840", parcelLabel: "Parcel ID",                      deedTypes: ["Tribal Trust Deed","Warranty Deed","Quit Claim Deed"] },
  // ── California ──────────────────────────────────────────────────────────────
  { slug: "los-angeles-ca",    name: "Los Angeles County",    state: "CA", recorderOffice: "LA County Registrar-Recorder / County Clerk",           address: "12400 Imperial Hwy, Norwalk, CA 90650",            phone: "(800) 201-8999", parcelLabel: "Assessor's Parcel Number (APN)", deedTypes: ["Tribal Grant Deed","Grant Deed","Quitclaim Deed","Deed of Trust"] },
  { slug: "kern-ca",           name: "Kern County",           state: "CA", recorderOffice: "Kern County Assessor-Recorder",                         address: "1115 Truxtun Ave, Bakersfield, CA 93301",          phone: "(661) 868-3588", parcelLabel: "APN",                           deedTypes: ["Tribal Grant Deed","Grant Deed","Quitclaim Deed"] },
  { slug: "san-bernardino-ca", name: "San Bernardino County", state: "CA", recorderOffice: "San Bernardino County Assessor-Recorder-Clerk",         address: "222 W Hospitality Ln, San Bernardino, CA 92415",   phone: "(909) 387-8306", parcelLabel: "APN",                           deedTypes: ["Tribal Grant Deed","Grant Deed","Quitclaim Deed"] },
  { slug: "riverside-ca",      name: "Riverside County",      state: "CA", recorderOffice: "Riverside County Assessor-County Clerk-Recorder",       address: "2720 Gateway Dr, Riverside, CA 92507",             phone: "(951) 955-6200", parcelLabel: "APN",                           deedTypes: ["Tribal Grant Deed","Grant Deed","Quitclaim Deed"] },
  // ── Texas ────────────────────────────────────────────────────────────────────
  { slug: "harris-tx",  name: "Harris County",  state: "TX", recorderOffice: "Harris County Clerk — Real Property Division", address: "201 Caroline St, Houston, TX 77002",   phone: "(713) 274-8680", parcelLabel: "Property ID", deedTypes: ["Tribal Warranty Deed","Special Warranty Deed","Quitclaim Deed"] },
  { slug: "dallas-tx",  name: "Dallas County",  state: "TX", recorderOffice: "Dallas County Clerk",                         address: "509 Main St, Dallas, TX 75202",         phone: "(214) 653-7099", parcelLabel: "Property ID", deedTypes: ["Tribal Warranty Deed","Special Warranty Deed","Quitclaim Deed"] },
  { slug: "travis-tx",  name: "Travis County",  state: "TX", recorderOffice: "Travis County Clerk",                         address: "5501 Airport Blvd, Austin, TX 78751",   phone: "(512) 854-9188", parcelLabel: "Property ID", deedTypes: ["Tribal Warranty Deed","Special Warranty Deed","Quitclaim Deed"] },
  { slug: "tarrant-tx", name: "Tarrant County", state: "TX", recorderOffice: "Tarrant County Clerk",                        address: "100 W Weatherford St, Fort Worth, TX 76196", phone: "(817) 884-1195", parcelLabel: "Property ID", deedTypes: ["Tribal Warranty Deed","Special Warranty Deed","Quitclaim Deed"] },
];

// ── Sample data (bundled — no filesystem reads at runtime) ────────────────────

interface DeedData {
  grantor: string;
  grantorAddress: string;
  grantee: string;
  granteeAddress: string;
  parcelId: string;
  legalDescription: string;
  consideration: string;
  deedType: string;
  county: string;
  state: string;
  tractNumber?: string;
  biaTractNumber?: string;
  instrumentDate?: string;
  exemptionBasis?: string;
  sovereignImmunity?: boolean;
  federalLawRef?: string;
  tribalCodeRef?: string;
  notaryState?: string;
  notaryCounty?: string;
}

const SAMPLE_DATA: Record<string, DeedData> = {
  "oakland-mi": {
    grantor: "Mathias El Tribe Sovereign Authority",
    grantorAddress: "Sovereign Office of the Chief Justice & Trustee, Oakland County, MI",
    grantee: "Mathias El Tribe Land Trust",
    granteeAddress: "c/o Office of the Chief Justice, Oakland County, MI",
    parcelId: "15-20-476-001",
    legalDescription: "Beginning at the N ¼ corner of Section 20, T1N, R10E, City of Pontiac, Oakland County, Michigan; thence S 89°58'30\" E along the north line of said Section 20, 660.00 feet; thence S 0°01'30\" W, 660.00 feet; thence N 89°58'30\" W, 660.00 feet; thence N 0°01'30\" E, 660.00 feet to the point of beginning. Containing 10.00 acres, more or less.",
    consideration: "Sovereign Trust — No Monetary Consideration (Exempt: 25 U.S.C. §177)",
    deedType: "Tribal Trust Deed",
    county: "Oakland", state: "Michigan",
    tractNumber: "MET-OAK-001", biaTractNumber: "BIA-MET-2024-001",
    federalLawRef: "25 U.S.C. §177 — Non-Intercourse Act",
    tribalCodeRef: "METC Title 4 §3 — Tribal Land Trust Governance",
    sovereignImmunity: true,
    exemptionBasis: "Indian Trust Land — exempt from state transfer tax per 25 U.S.C. §177 and METC Title 4 §4",
    notaryState: "Michigan", notaryCounty: "Oakland",
  },
  "wayne-mi": {
    grantor: "Mathias El Tribe Sovereign Authority",
    grantorAddress: "Sovereign Office of the Chief Justice & Trustee, Wayne County, MI",
    grantee: "Mathias El Tribe Land Trust",
    granteeAddress: "c/o Office of the Chief Justice, Wayne County, MI",
    parcelId: "22-009999-001",
    legalDescription: "Lot 14, Block C, Wayne County Plat No. 142, as recorded in Liber 87 of Plats, Page 22, Wayne County Records, Michigan. Subject to easements and restrictions of record.",
    consideration: "Sovereign Trust — No Monetary Consideration (Exempt: 25 U.S.C. §177)",
    deedType: "Tribal Trust Deed",
    county: "Wayne", state: "Michigan",
    tractNumber: "MET-WAY-001",
    federalLawRef: "25 U.S.C. §177 — Non-Intercourse Act",
    tribalCodeRef: "METC Title 4 §3",
    sovereignImmunity: true,
    exemptionBasis: "Indian Trust Land — exempt from state transfer tax per 25 U.S.C. §177",
    notaryState: "Michigan", notaryCounty: "Wayne",
  },
  "los-angeles-ca": {
    grantor: "Mathias El Tribe Sovereign Authority",
    grantorAddress: "Sovereign Office of the Chief Justice & Trustee, Los Angeles County, CA",
    grantee: "Mathias El Tribe Land Trust",
    granteeAddress: "c/o Office of the Chief Justice, Los Angeles County, CA",
    parcelId: "5134-021-001",
    legalDescription: "Parcel A of Parcel Map No. 28744, in the City of Los Angeles, County of Los Angeles, State of California, as per map filed in Book 298, Pages 1 through 3 of Parcel Maps, in the Office of the County Recorder of said County.",
    consideration: "Grant for sovereign trust purposes — No taxable consideration (Rev. & Tax. Code §11930)",
    deedType: "Tribal Grant Deed",
    county: "Los Angeles", state: "California",
    tractNumber: "MET-LA-001",
    federalLawRef: "25 U.S.C. §177 — Non-Intercourse Act; UNDRIP Art. 26",
    tribalCodeRef: "METC Title 4 §3",
    sovereignImmunity: true,
    exemptionBasis: "Transfer to Indian tribe pursuant to federal trust obligation — exempt per Rev. & Tax. Code §11930 and 25 U.S.C. §177",
    notaryState: "California", notaryCounty: "Los Angeles",
  },
  "kern-ca": {
    grantor: "Mathias El Tribe Sovereign Authority",
    grantorAddress: "Sovereign Office of the Chief Justice & Trustee, Kern County, CA",
    grantee: "Mathias El Tribe Land Trust",
    granteeAddress: "c/o Office of the Chief Justice, Kern County, CA",
    parcelId: "516-010-01-00-1",
    legalDescription: "The Southeast Quarter (SE ¼) of the Northwest Quarter (NW ¼) of Section 14, Township 29 South, Range 29 East, M.D.B.&M., in the County of Kern, State of California, containing 40 acres, more or less.",
    consideration: "Grant for sovereign trust purposes — No taxable consideration",
    deedType: "Tribal Grant Deed",
    county: "Kern", state: "California",
    tractNumber: "MET-KERN-001",
    federalLawRef: "25 U.S.C. §177 — Non-Intercourse Act",
    tribalCodeRef: "METC Title 4 §3",
    sovereignImmunity: true,
    exemptionBasis: "Transfer to Indian tribe pursuant to federal trust obligation — exempt from documentary transfer tax",
    notaryState: "California", notaryCounty: "Kern",
  },
};

// ── HTML deed renderer ─────────────────────────────────────────────────────────

function renderDeed(county: CountyRecord, data: DeedData): string {
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const instrDate = data.instrumentDate ?? dateStr;
  const year = today.getFullYear();
  const notaryState  = (data.notaryState  ?? data.state).toUpperCase();
  const notaryCounty = (data.notaryCounty ?? data.county).toUpperCase();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${data.deedType} — ${county.name}, ${county.state}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Times New Roman", Times, serif; font-size: 12pt; color: #000; background: #fff; }
  .page { max-width: 8.5in; margin: 0 auto; padding: 1in 1.25in; min-height: 11in; }
  h1 { font-size: 16pt; text-align: center; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6pt; }
  h2 { font-size: 12pt; text-align: center; margin-bottom: 4pt; font-style: italic; }
  .recorder-box { border: 1px solid #000; padding: 10pt; margin-bottom: 20pt; font-size: 10pt; }
  .recorder-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; color: #555; }
  .header-box { border: 2px solid #000; padding: 12pt; margin-bottom: 20pt; text-align: center; }
  .header-tribe { font-size: 10pt; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6pt; }
  .section { margin-bottom: 16pt; }
  .section-title { font-size: 11pt; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 3pt; margin-bottom: 8pt; letter-spacing: 1px; }
  p { line-height: 1.6; margin-bottom: 8pt; text-align: justify; }
  .legal-desc { font-family: "Courier New", monospace; font-size: 10pt; background: #f9f9f9; border: 1px solid #ccc; padding: 10pt; margin: 8pt 0; line-height: 1.5; }
  .notice { background: #fffbe6; border: 1px solid #ccc; border-left: 4px solid #996600; padding: 10pt; font-size: 10pt; margin: 10pt 0; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 8pt 0; }
  td { padding: 4pt 8pt; vertical-align: top; }
  td:first-child { font-weight: bold; width: 35%; white-space: nowrap; }
  .sig-row { display: flex; gap: 60pt; margin-top: 20pt; }
  .sig-col p { font-size: 10pt; }
  .sig-line { border-bottom: 1px solid #000; width: 200pt; height: 20pt; margin-bottom: 4pt; }
  .sig-name { font-size: 10pt; }
  .sig-sub  { font-size: 9pt; color: #555; }
  .sig-date { font-size: 9pt; color: #555; margin-top: 8pt; }
  .seal-box { border: 2px dashed #999; width: 80pt; height: 80pt; display: flex; align-items: center; justify-content: center; font-size: 8pt; text-align: center; color: #999; margin-top: 10pt; }
  .notary-block { border: 1px solid #000; padding: 12pt; margin-top: 20pt; }
  .notary-row { display: flex; gap: 40pt; margin-top: 16pt; }
  .footer { margin-top: 30pt; border-top: 1px solid #ccc; padding-top: 10pt; font-size: 8pt; color: #666; text-align: center; }
  @media print { .page { padding: 0.75in 1in; } }
</style>
</head>
<body>
<div class="page">

  <div class="recorder-box">
    <div class="recorder-label">Recording Requested By and When Recorded Return To:</div>
    <div style="margin-top:6pt;">
      <strong>Mathias El Tribe — Office of the Chief Justice &amp; Trustee</strong><br>
      c/o Sovereign Land Registry Office<br>
      ${county.recorderOffice}<br>
      ${county.address} &nbsp;·&nbsp; Tel: ${county.phone}
    </div>
    <div style="margin-top:10pt; border:1px dashed #999; padding:6pt; font-size:9pt; color:#666;">
      RECORDER'S USE ONLY &nbsp;·&nbsp; Document No.: ________________ &nbsp;·&nbsp; Recorded: ________________ &nbsp;·&nbsp; Book/Liber: ______ Page: ______
    </div>
  </div>

  <div class="header-box">
    <div class="header-tribe">Mathias El Tribe Supreme Court</div>
    <h1>${data.deedType.toUpperCase()}</h1>
    <h2>${county.name}, ${county.state} — Tribal Sovereign Land Instrument</h2>
    <div style="margin-top:8pt; font-size:10pt;">Instrument Date: <strong>${instrDate}</strong> &nbsp;|&nbsp; METC Title 4 — Land Trust Governance</div>
  </div>

  <div class="section">
    <div class="section-title">I. Parties to this Instrument</div>
    <table>
      <tr><td>Grantor:</td><td>${data.grantor}<br><span style="font-weight:normal; font-size:10pt;">${data.grantorAddress}</span></td></tr>
      <tr><td>Grantee:</td><td>${data.grantee}<br><span style="font-weight:normal; font-size:10pt;">${data.granteeAddress}</span></td></tr>
      <tr><td>${county.parcelLabel}:</td><td><strong>${data.parcelId}</strong>${data.tractNumber ? ` &nbsp;·&nbsp; Tribal Tract: <strong>${data.tractNumber}</strong>` : ""}${data.biaTractNumber ? ` &nbsp;·&nbsp; BIA Tract: <strong>${data.biaTractNumber}</strong>` : ""}</td></tr>
      <tr><td>Consideration:</td><td>${data.consideration}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">II. Legal Description of Property</div>
    <p>The real property situated in the County of ${data.county}, State of ${data.state}, legally described as follows:</p>
    <div class="legal-desc">${data.legalDescription}</div>
  </div>

  <div class="section">
    <div class="section-title">III. Granting Clause &amp; Covenants</div>
    <p>FOR AND IN CONSIDERATION of the purposes set forth herein, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the Grantor hereby GRANTS, CONVEYS, AND TRANSFERS to the Grantee, its successors and assigns in tribal trust, all right, title, and interest in and to the above-described property, subject to the following conditions:</p>
    <p><strong>Anti-Alienation Covenant (METC T4 §4):</strong> This land is held in perpetual tribal trust. No sale, encumbrance, lease, mortgage, or transfer shall be valid without the express written consent of the Office of the Chief Justice &amp; Trustee and compliance with 25 U.S.C. §177. Any purported transfer in violation is <em>void ab initio</em>.</p>
    <p><strong>Exclusive Jurisdiction (METC T4 §2):</strong> This parcel is subject to the exclusive jurisdiction of the Mathias El Tribe Supreme Court. No state or county regulation, zoning ordinance, tax assessment, or administrative order shall impair, encumber, or interfere with tribal title.</p>
  </div>

  <div class="section">
    <div class="section-title">IV. Sovereign Protections &amp; Federal Authority</div>
    ${data.sovereignImmunity ? `<div class="notice"><strong>SOVEREIGN IMMUNITY DECLARATION:</strong> This instrument is executed in exercise of the Mathias El Tribe's inherent sovereign authority. The Tribe asserts sovereign immunity from unconsented suit in connection with this land. Any challenge to tribal title must be brought in the Mathias El Tribe Supreme Court.</div>` : ""}
    ${data.exemptionBasis ? `<p><strong>Exemption / Tax Status:</strong> ${data.exemptionBasis}</p>` : ""}
    ${data.federalLawRef ? `<p><strong>Federal Authority:</strong> ${data.federalLawRef}</p>` : ""}
    ${data.tribalCodeRef ? `<p><strong>Tribal Code Reference:</strong> ${data.tribalCodeRef}</p>` : ""}
    <p><strong>Loper Bright Notice:</strong> Per <em>Loper Bright Enterprises v. Raimondo</em>, 603 U.S. ___ (2024), no federal agency is entitled to judicial deference in interpreting statutes affecting tribal rights. All ambiguities resolved under the Indian Canons of Construction in favor of the Tribe.</p>
    <p><strong>Worcester Doctrine:</strong> Per <em>Worcester v. Georgia</em>, 31 U.S. 515 (1832), no state law may supersede the laws of the Mathias El Tribe within Indian Country (18 U.S.C. §1151).</p>
  </div>

  <div class="section">
    <div class="section-title">V. Execution &amp; Signatures</div>
    <p>IN WITNESS WHEREOF, the parties have executed this ${data.deedType} as of the date first written above.</p>
    <div class="sig-row">
      <div class="sig-col">
        <p style="font-weight:bold;">GRANTOR:</p>
        <div class="sig-line"></div>
        <div class="sig-name">${data.grantor}</div>
        <div class="sig-sub">Office of the Chief Justice &amp; Trustee</div>
        <div class="sig-date">Date: ____________________</div>
      </div>
      <div class="sig-col">
        <p style="font-weight:bold;">GRANTEE:</p>
        <div class="sig-line"></div>
        <div class="sig-name">${data.grantee}</div>
        <div class="sig-sub">Authorized Trustee Representative</div>
        <div class="sig-date">Date: ____________________</div>
      </div>
      <div class="sig-col" style="text-align:center;">
        <div class="seal-box">TRIBAL<br>SEAL</div>
      </div>
    </div>
  </div>

  <div class="notary-block">
    <strong>ACKNOWLEDGMENT — STATE OF ${notaryState}, COUNTY OF ${notaryCounty}</strong>
    <p style="margin-top:10pt;">Before me, the undersigned Notary Public in and for said County and State, personally appeared ____________________________, known to me (or proved to me on the basis of satisfactory evidence) to be the person(s) whose name(s) is/are subscribed to the within instrument and acknowledged to me that he/she/they executed the same in his/her/their authorized capacity(ies).</p>
    <div class="notary-row">
      <div>
        <div class="sig-line" style="width:220pt;"></div>
        <p style="font-size:10pt;">Notary Public</p>
        <p style="font-size:9pt; color:#555;">Commission Expires: ____________________</p>
      </div>
      <div style="text-align:center;">
        <div class="seal-box" style="width:70pt; height:70pt;">NOTARY<br>SEAL</div>
      </div>
    </div>
  </div>

  <div class="footer">
    ${data.deedType} &nbsp;·&nbsp; ${county.name}, ${data.state} &nbsp;·&nbsp; Mathias El Tribe Sovereign Land Instrument &nbsp;·&nbsp; ${year}<br>
    Prepared by the Office of the Chief Justice &amp; Trustee — Mathias El Tribe Indigenous Intelligence System<br>
    METC Title 4 — Land Trust Governance &nbsp;|&nbsp; 25 U.S.C. §177 &nbsp;|&nbsp; 18 U.S.C. §1151
  </div>

</div>
</body>
</html>`;
}

// ── GET /api/deed/counties ─────────────────────────────────────────────────────

router.get("/counties", (_req, res) => {
  res.json(COUNTIES.map(c => ({
    slug: c.slug,
    name: c.name,
    state: c.state,
    recorderOffice: c.recorderOffice,
    address: c.address,
    phone: c.phone,
    parcelLabel: c.parcelLabel,
    deedTypes: c.deedTypes,
    hasSampleData: c.slug in SAMPLE_DATA,
  })));
});

// ── GET /api/deed/:county — render with bundled sample data ───────────────────

router.get("/:county", requireAuth, (req, res) => {
  const slug: string = String(req.params.county);
  const county = COUNTIES.find(c => c.slug === slug);
  if (!county) { res.status(404).json({ error: `County '${slug}' not supported. GET /api/deed/counties for the full list.` }); return; }
  const data: DeedData | undefined = (SAMPLE_DATA as Record<string, DeedData>)[slug];
  if (!data) { res.status(404).json({ error: `No sample data for '${slug}'. Use POST /api/deed/${slug} with your own JSON body.` }); return; }

  const html = renderDeed(county, data);
  const download = req.query.download === "1";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (download) res.setHeader("Content-Disposition", `attachment; filename="deed-${slug}-sample.html"`);
  res.send(html);
});

// ── POST /api/deed/:county — render with caller-supplied data ─────────────────

router.post("/:county", requireAuth, (req, res) => {
  const slug: string = String(req.params.county);
  const county = COUNTIES.find(c => c.slug === slug);
  if (!county) { res.status(404).json({ error: `County '${slug}' not supported.` }); return; }

  const data = req.body as DeedData;
  const missing: string[] = [];
  if (!data.grantor)         missing.push("grantor");
  if (!data.grantee)         missing.push("grantee");
  if (!data.parcelId)        missing.push("parcelId");
  if (!data.legalDescription) missing.push("legalDescription");
  if (!data.deedType)        missing.push("deedType");
  if (missing.length) {
    res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}.` });
    return;
  }

  const merged: DeedData = {
    ...data,
    county: data.county || county.name,
    state:  data.state  || county.state,
  };

  const html = renderDeed(county, merged);
  const download = req.query.download === "1";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (download) res.setHeader("Content-Disposition", `attachment; filename="deed-${slug}.html"`);
  res.send(html);
});

export default router;
