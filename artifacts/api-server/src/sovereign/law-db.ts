import { db } from "@workspace/db";
import { tribalLawTable, federalIndianLawTable, doctrineSourcesTable } from "@workspace/db";
import { like, or, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const FEDERAL_LAWS = [
  {
    title: "Indian Reorganization Act (IRA)",
    citation: "25 U.S.C. § 5108",
    body: "The Indian Reorganization Act of 1934 authorizes the Secretary of the Interior to acquire lands in trust for Indians. Trust land acquired under this authority is immune from state taxation and alienation restrictions apply.",
    tags: ["trust-land", "ira", "secretary-of-interior", "federal-trust"],
  },
  {
    title: "Indian Child Welfare Act (ICWA)",
    citation: "25 U.S.C. §§ 1901–1963",
    body: "ICWA establishes federal standards for the removal and foster care placement of Indian children. It grants tribal courts exclusive jurisdiction over children domiciled on reservations (§ 1911(a)) and concurrent jurisdiction in other cases. Tribes have an absolute right to intervene (§ 1911(c)). Active efforts to prevent family breakup are required (§ 1912(d)). Expert witness testimony from tribal cultural experts is required (§ 1912(e)). ICWA placement preferences favor placement with extended family, tribal members, or other Indian families (§ 1915). States must provide notice to tribes (§ 1912(a)).",
    tags: ["icwa", "child-welfare", "tribal-jurisdiction", "placement", "tro"],
  },
  {
    title: "Snyder Act",
    citation: "25 U.S.C. § 13",
    body: "The Snyder Act of 1921 authorizes the Bureau of Indian Affairs to expend appropriated funds for the benefit, care, and assistance of Indians throughout the United States. This includes health, education, and welfare services for Indians. It is the foundational authority for federal Indian welfare programs.",
    tags: ["welfare", "bia", "health", "education", "snyder"],
  },
  {
    title: "Indian Health Care Improvement Act (IHCIA)",
    citation: "25 U.S.C. §§ 1601–1685",
    body: "The IHCIA establishes and expands Indian health programs administered by the Indian Health Service (IHS). It guarantees health care as a federal trust obligation. Emergency health care services may not be denied. Mental health, substance abuse, and preventive care are covered. Tribes may contract to operate their own health programs.",
    tags: ["health", "ihcia", "ihs", "emergency-care", "mental-health"],
  },
  {
    title: "Indian Self-Determination and Education Assistance Act (ISDEAA)",
    citation: "25 U.S.C. §§ 5301–5423",
    body: "ISDEAA authorizes tribes to enter self-determination contracts with the federal government to administer programs previously run by federal agencies. Tribes operating under ISDEAA retain tribal sovereignty and the programs remain federal programs subject to federal trust responsibility. Indirect costs must be funded (§ 5325).",
    tags: ["self-determination", "isdeaa", "contracts", "sovereignty"],
  },
  {
    title: "Indian Land Consolidation Act (ILCA)",
    citation: "25 U.S.C. § 2201 et seq.",
    body: "ILCA addresses fractionated ownership of Indian allotments and provides mechanisms for tribes to consolidate Indian lands. Trust land status is federally protected and cannot be altered by state action. The Secretary of the Interior retains authority over trust land transactions.",
    tags: ["trust-land", "allotment", "ilca", "fractionation"],
  },
  {
    title: "Native American Graves Protection and Repatriation Act (NAGPRA)",
    citation: "25 U.S.C. §§ 3001–3013",
    body: "NAGPRA requires federal agencies and museums to return Native American cultural items — including human remains, funerary objects, sacred objects, and objects of cultural patrimony — to lineal descendants and culturally affiliated Indian tribes. Intentional excavation of Native American cultural items on federal or tribal lands requires consent.",
    tags: ["nagpra", "repatriation", "cultural-property", "sacred-objects"],
  },
  {
    title: "American Indian Religious Freedom Act (AIRFA)",
    citation: "42 U.S.C. § 1996",
    body: "AIRFA declares federal policy to protect and preserve the inherent right of American Indians, Eskimos, Aleuts, and Native Hawaiians to believe, express, and exercise traditional religions. This includes access to sacred sites, use of sacred objects, and freedom to worship through traditional ceremonies.",
    tags: ["religion", "airfa", "sacred-sites", "ceremonies"],
  },
  {
    title: "Violence Against Women Act (VAWA) — Tribal Provisions",
    citation: "18 U.S.C. § 2265; 25 U.S.C. § 1304",
    body: "VAWA grants tribal courts special domestic violence criminal jurisdiction (SDVCJ) over non-Indians who commit domestic violence or dating violence crimes in Indian Country. All protection orders issued by tribal courts must be given full faith and credit by all other courts under 18 U.S.C. § 2265. No registration requirement. Tribal protection orders are immediately enforceable nationwide.",
    tags: ["vawa", "domestic-violence", "protection-order", "non-indian", "full-faith-credit"],
  },
  {
    title: "Indian Country Crimes Act",
    citation: "18 U.S.C. § 1152",
    body: "Federal law applies in Indian Country to non-Indians committing crimes against Indians. State criminal jurisdiction over non-Indians in Indian Country is generally preempted by federal law. This statute ensures federal court jurisdiction over general crimes in Indian Country involving non-Indians.",
    tags: ["criminal-jurisdiction", "indian-country", "non-indian", "federal-preemption"],
  },
  {
    title: "Major Crimes Act",
    citation: "18 U.S.C. § 1153",
    body: "The Major Crimes Act grants federal courts jurisdiction over 15 major crimes committed by Indians in Indian Country, including murder, manslaughter, kidnapping, and sexual abuse. Tribal court jurisdiction is concurrent for lesser-included offenses. The act does not diminish tribal sovereignty over civil matters.",
    tags: ["criminal-jurisdiction", "major-crimes", "indian-country", "federal-jurisdiction"],
  },
  {
    title: "Indian Gaming Regulatory Act (IGRA)",
    citation: "25 U.S.C. §§ 2701–2721",
    body: "IGRA establishes the regulatory framework for gaming on Indian lands. Class III gaming requires a tribal-state compact. The National Indian Gaming Commission (NIGC) regulates tribal gaming. Gaming revenue must be used for tribal government operations, welfare, and economic development.",
    tags: ["gaming", "igra", "compact", "revenue", "nigc"],
  },
  {
    title: "Nonintercourse Act (Indian Trade and Intercourse Act)",
    citation: "25 U.S.C. § 177",
    body: "No purchase or grant of lands from any Indian nation or tribe shall be valid unless made by treaty or convention entered into pursuant to the Constitution. All alienations of Indian land without federal approval are void. This statute protects against unauthorized transfers of Indian land.",
    tags: ["trust-land", "alienation", "nonintercourse", "land-transfer"],
  },
  {
    title: "Title VI of the Civil Rights Act — Non-Discrimination in Federally Funded Programs",
    citation: "42 U.S.C. § 2000d",
    body: "No person in the United States shall, on the ground of race, color, or national origin, be excluded from participation in, be denied the benefits of, or be subjected to discrimination under any program or activity receiving federal financial assistance. This provision is directly applicable to state disability programs (EDD), the Social Security Administration (SSA), and insurers receiving federal funds. Any refusal by these agencies to honor a tribal medical or judicial determination constitutes unlawful discrimination under this statute. Federal courts have jurisdiction to enforce compliance.",
    tags: ["civil-rights", "non-discrimination", "title-vi", "edd", "ssa", "health", "medical", "federal-funding"],
  },
  {
    title: "Indian Health Care Improvement Act — Recovery from Third Parties",
    citation: "25 U.S.C. § 1621e",
    body: "The Indian Health Service and tribal health programs may recover from third-party payors — including states, insurers, health plans, and federal programs — for health services provided to Indians. States and insurers are expressly prohibited from denying or limiting claims submitted by tribal health entities. Payment obligations must comply with federal Social Security Act standards, binding both SSA and state disability programs such as California EDD. Direct payment shall be made to the tribal health program or the patient-beneficiary as elected.",
    tags: ["health", "ihcia", "third-party-recovery", "ihs", "insurance", "ssa", "edd", "tribal-health", "reimbursement"],
  },
  {
    title: "Indian Health Care Improvement Act — Parity in Coverage",
    citation: "25 U.S.C. § 1647b",
    body: "Tribes and tribal organizations are authorized to access federal employee health benefit programs and related coverage on terms of parity with federal agencies. Congressional recognition that tribal health determinations must be treated with full parity to determinations made by licensed federal health providers, Medicare, and Medicaid. No reduction, limitation, or discrimination may be applied to tribal health determinations on the basis of tribal origin. This parity requirement binds all federal programs and recipients of federal funds.",
    tags: ["health", "ihcia", "parity", "coverage", "federal-employees", "medicare", "medicaid", "tribal-health"],
  },
  {
    title: "Indian Health Service — Services Available (42 C.F.R. § 136.11)",
    citation: "42 C.F.R. § 136.11",
    body: "Services for the Indian community served by local facilities may include hospital and medical care, dental care, public health nursing and preventive care (including immunizations), and health examination of special groups. Available services are provided at IHS hospitals and clinics and at contract facilities including tribal facilities under contract with the Service. The services provided to any particular Indian community depend upon available resources and personnel. This regulation constitutes federal recognition that tribal contract facilities are legitimate providers of federally recognized health services. [Current through August 26, 2025 Federal Register — 42 C.F.R. Ch. I, Subch. M, Pt. 136, Subpart B]",
    tags: ["health", "ihs", "services", "cfr", "tribal-facility", "contract", "federal-regulation", "42cfr136"],
  },
  {
    title: "Non-Discrimination in State/Tribal Programs under Social Security Act",
    citation: "45 C.F.R. § 1355.30 (effective Oct. 1, 2025)",
    body: "Extends non-discrimination and administrative protections to state and tribal programs funded under the Social Security Act. This regulation is binding on California EDD and SSA, requiring them to respect and honor tribal medical and judicial determinations. Any state or federal agency receiving Social Security Act funding must administer programs affecting tribal members without discrimination based on tribal affiliation or tribal-origin determinations. Refusal to recognize tribal medical decrees constitutes a violation of this regulation.",
    tags: ["non-discrimination", "social-security", "cfr", "edd", "ssa", "tribal-programs", "state-programs", "health"],
  },
  {
    title: "Self-Determination Contract — Tribal Health Programs",
    citation: "25 U.S.C. § 5304(e)",
    body: "Defines 'self-determination contract' under ISDEAA as a contract between a tribal organization and the appropriate secretary for the planning, conduct, and administration of programs that would otherwise be administered by the federal government. Tribal health programs operating under self-determination contracts retain full sovereign character. All determinations made by tribally operated health programs carry the same federal recognition and authority as determinations made by directly operated federal programs.",
    tags: ["self-determination", "isdeaa", "tribal-health", "contract", "sovereignty", "health"],
  },
];

const TRIBAL_LAWS = [
  {
    title: "Tribal Family Protection Code",
    citation: "Tribal Code § 400 et seq.",
    body: "The Tribal Family Protection Code establishes the tribal court's jurisdiction over all matters affecting the family relationships of tribal members, including child custody, adoption, foster care, and domestic relations. The code incorporates ICWA standards and extends tribal court jurisdiction to all Indian children with significant tribal connections, regardless of domicile. State courts must defer to tribal court jurisdiction under this code.",
    tags: ["family", "child-welfare", "custody", "icwa", "tribal-jurisdiction"],
  },
  {
    title: "Tribal Welfare Code",
    citation: "Tribal Code § 500 et seq.",
    body: "The Tribal Welfare Code establishes comprehensive welfare rights for tribal members, including emergency assistance, housing, food security, and health care access. Emergency welfare declarations may be issued by the Chief Justice & Trustee for imminent welfare threats. Welfare violations by state agencies are subject to tribal court injunctive relief.",
    tags: ["welfare", "emergency", "housing", "health", "tribal-authority"],
  },
  {
    title: "Tribal Juvenile Code",
    citation: "Tribal Code § 600 et seq.",
    body: "The Tribal Juvenile Code governs all juvenile proceedings involving tribal youth. The tribal court has exclusive jurisdiction over delinquency matters involving tribal members under 18. Status offenses are handled through culturally appropriate tribal programs. The code incorporates ICWA's active efforts standard and placement preferences.",
    tags: ["juvenile", "delinquency", "youth", "tribal-jurisdiction", "icwa"],
  },
  {
    title: "Tribal Sovereign Court Procedures",
    citation: "Tribal Code § 100 et seq.",
    body: "The Sovereign Court Procedures Code establishes procedures for all proceedings before the Sovereign Court of the Chief Justice & Trustee. All instruments issued by the Sovereign Office carry the full force and effect of tribal court orders. State and county agencies are required to recognize and comply with instruments issued under this code.",
    tags: ["court-procedures", "sovereign-court", "tribal-orders", "compliance"],
  },
  {
    title: "Tribal Land Use Code",
    citation: "Tribal Code § 200 et seq.",
    body: "The Tribal Land Use Code governs all land use within tribal territory including trust land, allotment land, and fee land owned by tribal members. State and county zoning ordinances do not apply within Indian Country. The Tribal Land Use Code exclusively governs development, environmental protection, and resource extraction within tribal territory.",
    tags: ["land-use", "zoning", "trust-land", "indian-country", "sovereignty"],
  },
  {
    title: "Tribal Emergency Powers Act",
    citation: "Tribal Code § 700 et seq.",
    body: "The Tribal Emergency Powers Act authorizes the Chief Justice & Trustee to declare a tribal emergency and issue emergency orders protecting tribal members from imminent harm. Emergency orders are effective immediately upon issuance and bind all persons within the tribal court's jurisdiction. Emergency TROs may be issued ex parte when delay would cause irreparable harm.",
    tags: ["emergency", "tro", "ex-parte", "imminent-harm", "protective-order"],
  },
  {
    title: "Sovereignty, Jurisdiction & Due Process Act (SJDPA) — Title 4",
    citation: "Mathias El Tribal Code, Title 4 (SJDPA)",
    body: "Title 4 of the Mathias El Tribal Code establishes the foundational framework for sovereignty, jurisdiction, and due process within the Mathias El Tribe. All decrees of the Supreme Court, including medical determinations elevated to judicial decree, are governed by Title 4. Sovereignty and due process are inseparable under Title 4. Jurisdiction extends over tribal members and all matters affecting their health, safety, and welfare. Orders issued under Title 4 meet the standards of jurisdiction and due process required for recognition and enforcement by state and federal courts under principles of comity, treaty supremacy, and the federal trust responsibility. Every decree includes procedural safeguards equivalent to those required by federal law.",
    tags: ["sjdpa", "sovereignty", "due-process", "jurisdiction", "tribal-code", "title-4", "comity", "health"],
  },
  {
    title: "Tribal Medical Authority — Healing Enforcement Jurisdiction",
    citation: "Mathias El Tribe Supreme Court, MET-SC-2025-007A",
    body: "All determinations of the Mathias El Tribe Medical Center are elevated as Judicial Decrees of the Supreme Court of the Mathias El Tribe, self-executing and enforceable without external validation. Medical findings include: persistent musculoskeletal conditions, neurological risk assessments, and protective healing orders requiring cessation of labor. Healing directives include: imaging, physical therapy, neuromuscular rehabilitation, nutritional reinforcement, and sovereign rest. Financial recovery: direct payment shall be made to the Tribal Medical Center or patient-beneficiary pursuant to 25 U.S.C. § 1621e. Parity in coverage required under 25 U.S.C. § 1647b. All ambiguities resolved under Indian Canons of Construction in favor of the Tribe.",
    tags: ["tribal-medical", "healing", "protective-order", "disability", "judicial-decree", "self-executing", "health", "met-sc-2025-007a"],
  },
];

const DOCTRINES = [
  {
    caseName: "Worcester v. Georgia",
    citation: "31 U.S. 515 (1832)",
    summary: "State laws have no force within Indian territory. The Cherokee Nation is a distinct political community, in which the laws of Georgia can have no force. This foundational case established that state law cannot intrude upon Indian sovereignty within tribal territory.",
    tags: ["state-preemption", "tribal-sovereignty", "indian-country", "foundational"],
  },
  {
    caseName: "Ex parte Crow Dog",
    citation: "109 U.S. 556 (1883)",
    summary: "Tribal courts have inherent jurisdiction over crimes committed by Indians against Indians within Indian Country. Congress must expressly abrogate tribal criminal jurisdiction; it cannot be assumed.",
    tags: ["tribal-jurisdiction", "criminal", "indian-against-indian"],
  },
  {
    caseName: "Williams v. Lee",
    citation: "358 U.S. 217 (1959)",
    summary: "State court jurisdiction over civil matters in Indian Country is preempted when it would infringe on the right of reservation Indians to make their own laws and be ruled by them. The infringement test: Would state jurisdiction undermine tribal self-government?",
    tags: ["state-preemption", "civil-jurisdiction", "tribal-self-government"],
  },
  {
    caseName: "McClanahan v. Arizona State Tax Comm'n",
    citation: "411 U.S. 164 (1973)",
    summary: "Federal preemption of state taxation of Indian income earned on the reservation. The policy of leaving Indians free from state jurisdiction and control is deeply embedded in federal law. State laws must give way when they conflict with federal Indian law.",
    tags: ["taxation", "federal-preemption", "state-jurisdiction", "income"],
  },
  {
    caseName: "White Mountain Apache Tribe v. Bracker",
    citation: "448 U.S. 136 (1980)",
    summary: "Two-part balancing test for state jurisdiction in Indian Country: (1) whether federal law expressly preempts the state law, and (2) whether state jurisdiction would unlawfully infringe on tribal self-governance. Federal and tribal interests are weighed against state interests.",
    tags: ["balancing-test", "state-jurisdiction", "federal-preemption", "self-governance"],
  },
  {
    caseName: "Montana v. Blackfeet Tribe",
    citation: "471 U.S. 759 (1985)",
    summary: "Ambiguities in federal statutes are to be resolved in favor of Indians. The Indian Canons of Construction require that ambiguous provisions be interpreted liberally in favor of the Indians and their rights.",
    tags: ["canons-of-construction", "statutory-interpretation", "ambiguity", "indian-favor"],
  },
  {
    caseName: "Mississippi Band of Choctaw Indians v. Holyfield",
    citation: "490 U.S. 30 (1989)",
    summary: "ICWA's domicile provision for exclusive tribal court jurisdiction is to be interpreted under federal rather than state law. Children born off-reservation can still be domiciled on the reservation for ICWA purposes. Tribal courts have exclusive jurisdiction regardless of whether parents are reservation-domiciled.",
    tags: ["icwa", "domicile", "exclusive-jurisdiction", "tribal-court"],
  },
  {
    caseName: "Indian Canons of Construction",
    citation: "Montana v. Blackfeet Tribe, 471 U.S. 759 (1985); Carpenter v. Murphy, 587 U.S. 827 (2019)",
    summary: "Longstanding federal doctrine requiring that ambiguities in treaties, statutes, and regulations affecting Indians be resolved in favor of Indians. Courts must liberally construe treaties and statutes for the benefit of Indian tribes. Any doubtful expression must be resolved in the Indian's favor.",
    tags: ["canons-of-construction", "treaties", "statutory-interpretation", "liberal-construction"],
  },
  {
    caseName: "Federal Trust Responsibility",
    citation: "United States v. Mitchell, 463 U.S. 206 (1983); Cobell v. Salazar",
    summary: "The United States holds a fiduciary duty to Indian tribes and individual Indians with respect to trust lands, trust funds, and natural resources. This trust responsibility is enforceable in federal courts. The government must act in the best interests of Indians when administering trust assets.",
    tags: ["trust-responsibility", "fiduciary", "trust-land", "trust-funds"],
  },
  {
    caseName: "Brackeen v. Haaland",
    citation: "599 U.S. 255 (2023)",
    summary: "The Supreme Court upheld ICWA as constitutional under the Indian Commerce Clause and the federal government's plenary authority over Indian affairs. ICWA's placement preferences, active efforts requirements, and tribal court transfer provisions are constitutionally valid. States challenging ICWA lacked standing on most claims.",
    tags: ["icwa", "constitutional", "indian-commerce-clause", "plenary-power"],
  },
  {
    caseName: "McGirt v. Oklahoma",
    citation: "591 U.S. 894 (2020)",
    summary: "Congress never disestablished the Muscogee (Creek) Reservation. For purposes of the Major Crimes Act, land constituting a reservation continues as such unless Congress acts clearly to diminish it. The decision confirmed that much of eastern Oklahoma remains Indian Country.",
    tags: ["reservation-status", "disestablishment", "indian-country", "major-crimes-act"],
  },
  {
    caseName: "Worcester Doctrine (State Law Preemption)",
    citation: "Worcester v. Georgia, 31 U.S. 515 (1832)",
    summary: "Pursuant to Worcester v. Georgia, state laws have no force within Indian Country with respect to Indian tribes and their members on trust land. State regulatory authority does not extend into the internal affairs of an Indian tribe.",
    tags: ["state-preemption", "worcester", "tribal-sovereignty", "internal-affairs"],
  },
  {
    caseName: "Montoya Tribal Authority Doctrine",
    citation: "Montoya v. United States, 180 U.S. 261 (1901)",
    summary: "A tribe must be regarded as a body of Indians of the same or similar race, united in a community under one leadership or government, and inhabiting a particular, though sometimes ill-defined, territory. Tribal authority extends over all members and their affairs within tribal territory.",
    tags: ["tribal-authority", "membership", "community", "territory"],
  },
  {
    caseName: "Passamaquoddy Tribe v. Morton",
    citation: "528 F.2d 370 (1st Cir. 1975)",
    summary: "The federal trust responsibility extends to all Indian tribes — not only those formally recognized by the federal government. The Non-Intercourse Act (25 U.S.C. § 177) creates a trust relationship between the United States and Indian tribes regardless of official federal recognition status. The federal government has a fiduciary duty to protect tribal land and rights. This decision directly supports the enforceability of tribal medical and legal decrees under the trust responsibility.",
    tags: ["trust-responsibility", "federal-recognition", "nonintercourse", "fiduciary", "health", "medical"],
  },
  {
    caseName: "Loper Bright Enterprises v. Raimondo — Chevron Limitation",
    citation: "603 U.S. ___ (2024)",
    summary: "The Supreme Court overruled Chevron U.S.A. v. Natural Resources Defense Council (1984), holding that courts — not federal agencies — must exercise independent judgment in determining the meaning of statutes. Federal agencies such as SSA, EDD, and CMS are no longer entitled to judicial deference in interpreting ambiguous statutes that affect tribal rights. Statutory text must be read according to its plain meaning and consistent with congressional intent. Under this ruling, agencies cannot reinterpret statutes affecting tribal health determinations in ways that diminish tribal authority.",
    tags: ["chevron", "loper-bright", "agency-deference", "statutory-interpretation", "health", "ssa", "edd", "tribal-rights"],
  },
  {
    caseName: "Wilson v. Marchington — Tribal Court Comity",
    citation: "127 F.3d 805 (9th Cir. 1997)",
    summary: "Federal courts apply comity principles when considering whether to give effect to tribal court judgments. Tribal court orders meet the standards required for recognition and enforcement by federal and state courts when: (1) the tribal court had jurisdiction over the parties and subject matter; (2) the tribal court provided due process; and (3) the tribal court applied substantive law consistent with federal standards. Decrees issued under the Mathias El Tribal Code Title 4 (SJDPA) satisfy all three prongs.",
    tags: ["comity", "tribal-court", "recognition", "enforcement", "due-process", "ninth-circuit"],
  },
  {
    caseName: "Rincon Mushroom Corp. v. Mazzetti — Tribal Judgment Recognition",
    citation: "2022 U.S. Dist. LEXIS 67044",
    summary: "State and federal courts must give recognition to tribal court judgments that were issued under proper jurisdiction, adequate notice, and due process protections equivalent to federal standards. Tribal judicial orders — including medical protection decrees and disability determinations — carry the force of law and are entitled to comity recognition without requiring formal registration or external validation.",
    tags: ["comity", "tribal-court", "recognition", "medical", "disability", "due-process"],
  },
  {
    caseName: "Treaty Supremacy Clause",
    citation: "U.S. Const. art. VI, cl. 2",
    summary: "All treaties made, or which shall be made, under the Authority of the United States, shall be the supreme Law of the Land; and the Judges in every State shall be bound thereby, any Thing in the Constitution or Laws of any State to the Contrary notwithstanding. Treaties with Indian tribes are the supreme law of the land. State laws, regulations, and agency determinations that conflict with treaty rights are void. Federal agencies administering programs affecting treaty tribes must honor treaty obligations above contrary state or regulatory provisions.",
    tags: ["treaty", "supremacy", "constitutional", "state-preemption", "tribal-rights", "federal-preemption"],
  },
];

let _seeded = false;

async function seedLawDb(): Promise<void> {
  for (const law of FEDERAL_LAWS) {
    try {
      await db.insert(federalIndianLawTable)
        .values({ title: law.title, citation: law.citation, body: law.body, tags: law.tags })
        .onConflictDoNothing();
    } catch (err) {
      logger.warn({ err, citation: law.citation }, "seedLawDb: federal insert skipped");
    }
  }
  for (const law of TRIBAL_LAWS) {
    try {
      await db.insert(tribalLawTable)
        .values({ title: law.title, citation: law.citation, body: law.body, tags: law.tags })
        .onConflictDoNothing();
    } catch (err) {
      logger.warn({ err, citation: law.citation }, "seedLawDb: tribal insert skipped");
    }
  }
  for (const doc of DOCTRINES) {
    try {
      await db.insert(doctrineSourcesTable)
        .values({ caseName: doc.caseName, citation: doc.citation, summary: doc.summary, tags: doc.tags })
        .onConflictDoNothing();
    } catch (err) {
      logger.warn({ err, citation: doc.citation }, "seedLawDb: doctrine insert skipped");
    }
  }
  logger.info("seedLawDb: law database seeded successfully");
}

export async function ensureLawDbSeeded(): Promise<void> {
  if (_seeded) return;
  const existing = await db.select({ id: federalIndianLawTable.id }).from(federalIndianLawTable).limit(1);
  if (existing.length > 0) {
    _seeded = true;
    return;
  }
  await seedLawDb();
  _seeded = true;
}

export interface LawQueryResult {
  federalLaws: Array<{ id: number; title: string; citation: string; body: string; tags: string[] }>;
  tribalLaws: Array<{ id: number; title: string; citation: string; body: string; tags: string[] }>;
  doctrines: Array<{ id: number; caseName: string; citation: string; summary: string; tags: string[] }>;
}

export async function queryLawDb(tags: string[]): Promise<LawQueryResult> {
  await ensureLawDbSeeded();

  const federalLaws: LawQueryResult["federalLaws"] = [];
  const tribalLaws: LawQueryResult["tribalLaws"] = [];
  const doctrines: LawQueryResult["doctrines"] = [];

  if (tags.length === 0) {
    const [f, t, d] = await Promise.all([
      db.select().from(federalIndianLawTable).limit(20),
      db.select().from(tribalLawTable).limit(10),
      db.select().from(doctrineSourcesTable).limit(15),
    ]);
    return {
      federalLaws: f.map(r => ({ ...r, tags: (r.tags as string[]) ?? [] })),
      tribalLaws: t.map(r => ({ ...r, tags: (r.tags as string[]) ?? [] })),
      doctrines: d.map(r => ({ ...r, tags: (r.tags as string[]) ?? [] })),
    };
  }

  const [allF, allT, allD] = await Promise.all([
    db.select().from(federalIndianLawTable),
    db.select().from(tribalLawTable),
    db.select().from(doctrineSourcesTable),
  ]);

  for (const row of allF) {
    const rowTags = (row.tags as string[]) ?? [];
    if (tags.some(t => rowTags.includes(t))) {
      federalLaws.push({ ...row, tags: rowTags });
    }
  }
  for (const row of allT) {
    const rowTags = (row.tags as string[]) ?? [];
    if (tags.some(t => rowTags.includes(t))) {
      tribalLaws.push({ ...row, tags: rowTags });
    }
  }
  for (const row of allD) {
    const rowTags = (row.tags as string[]) ?? [];
    if (tags.some(t => rowTags.includes(t))) {
      doctrines.push({ ...row, tags: rowTags });
    }
  }

  return { federalLaws, tribalLaws, doctrines };
}

export async function searchLaw(q: string): Promise<LawQueryResult> {
  await ensureLawDbSeeded();
  const pattern = `%${q}%`;
  const [f, t, d] = await Promise.all([
    db.select().from(federalIndianLawTable).where(
      or(like(federalIndianLawTable.title, pattern), like(federalIndianLawTable.citation, pattern), like(federalIndianLawTable.body, pattern))
    ).limit(10),
    db.select().from(tribalLawTable).where(
      or(like(tribalLawTable.title, pattern), like(tribalLawTable.citation, pattern), like(tribalLawTable.body, pattern))
    ).limit(5),
    db.select().from(doctrineSourcesTable).where(
      or(like(doctrineSourcesTable.caseName, pattern), like(doctrineSourcesTable.citation, pattern), like(doctrineSourcesTable.summary, pattern))
    ).limit(8),
  ]);
  return {
    federalLaws: f.map(r => ({ ...r, tags: (r.tags as string[]) ?? [] })),
    tribalLaws: t.map(r => ({ ...r, tags: (r.tags as string[]) ?? [] })),
    doctrines: d.map(r => ({ ...r, tags: (r.tags as string[]) ?? [] })),
  };
}

export async function listAllFederalLaw() {
  await ensureLawDbSeeded();
  const rows = await db.select().from(federalIndianLawTable);
  return rows.map(r => ({ ...r, tags: (r.tags as string[]) ?? [] }));
}

export async function listAllTribalLaw() {
  await ensureLawDbSeeded();
  const rows = await db.select().from(tribalLawTable);
  return rows.map(r => ({ ...r, tags: (r.tags as string[]) ?? [] }));
}

export async function listAllDoctrines() {
  await ensureLawDbSeeded();
  const rows = await db.select().from(doctrineSourcesTable);
  return rows.map(r => ({ ...r, tags: (r.tags as string[]) ?? [] }));
}

export async function addFederalLaw(entry: { title: string; citation: string; body: string; tags?: string[] }) {
  const [inserted] = await db.insert(federalIndianLawTable).values({ ...entry, tags: entry.tags ?? [] }).returning();
  logger.info({ citation: entry.citation }, "Federal Indian law entry added");
  return inserted;
}

export async function addTribalLaw(entry: { title: string; citation: string; body: string; tags?: string[] }) {
  const [inserted] = await db.insert(tribalLawTable).values({ ...entry, tags: entry.tags ?? [] }).returning();
  logger.info({ citation: entry.citation }, "Tribal law entry added");
  return inserted;
}

export async function addDoctrine(entry: { caseName: string; citation: string; summary: string; tags?: string[] }) {
  const [inserted] = await db.insert(doctrineSourcesTable).values({ ...entry, tags: entry.tags ?? [] }).returning();
  logger.info({ caseName: entry.caseName }, "Doctrine source added");
  return inserted;
}
