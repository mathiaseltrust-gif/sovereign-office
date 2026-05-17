import { useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, ChevronDown, ChevronUp, BookOpen, Scale, AlertTriangle, Eye, Layers, Shield } from "lucide-react";

/* ─────────── Dataset ─────────── */
interface DefinitionLayer {
  label: string;
  content: string;
  citation?: string;
}
interface WordEntry {
  term: string;
  slug: string;
  category: string;
  oneLiner: string;
  warning?: string;
  layers: {
    ordinary: DefinitionLayer;
    historical: DefinitionLayer;
    federal: DefinitionLayer;
    administrative: DefinitionLayer;
  };
  patterns?: string[];
}

const WORDS: WordEntry[] = [
  {
    term: "Indian",
    slug: "indian",
    category: "Identity & Classification",
    oneLiner: "The most contested word in federal Indian law — it is not a racial category in law, it is a political and legal classification.",
    warning: "Administrative systems often treat 'Indian' as an eligibility filter for specific programs. Congressional statutes use it far more broadly.",
    layers: {
      ordinary:       { label: "Common Understanding", content: "A racial or ethnic label applied to Indigenous peoples of the Americas. Often used as a broad demographic descriptor.", citation: "Everyday usage" },
      historical:     { label: "Historical & Treaty-Era Meaning", content: "A political identity referring to members of Indigenous nations — peoples with pre-existing governments, territories, and legal standing. Used in treaties to acknowledge nationhood, not race. Noah Webster (1828): 'A native of India; or, in common use, a native of America.' Treaty-era usage treated 'Indian' as a nation-member, not a racial category.", citation: "Webster's American Dictionary, 1828; treaty language, 1778–1871" },
      federal:        { label: "Federal Statutory Definition", content: "Under 25 U.S.C. § 5304(e): 'Indian means a person who is a member of an Indian tribe.' Under the ISDEAA definition at 25 U.S.C. § 450b (§ 4), 'Indian' means an individual who is: (A) a member of an Indian tribe, or (B) certified as an Indian artisan by an Indian tribe. Under 25 U.S.C. § 1603(13): broad definition for health services. The Snyder Act (1921): 'Indians throughout the United States.' Congress has never limited 'Indian' to a single list. Eligibility is political, not racial (Morton v. Mancari, 1974).", citation: "25 U.S.C. § 5304(e); 25 U.S.C. § 450b (ISDEAA § 4); 25 U.S.C. § 1603; Snyder Act, 42 Stat. 208 (1921); Morton v. Mancari, 417 U.S. 535 (1974)" },
      administrative: { label: "Administrative Usage", content: "Some federal agencies apply 'Indian' only to members of federally recognized tribes as listed by BIA under 25 C.F.R. Part 83. This is a programmatic criterion for funding administration — not an exhaustive definition of the statutory term. The administrative list does not exhaust the full scope of federal Indian statutory language, historical continuity, or treaty history.", citation: "25 C.F.R. Part 83; BIA Federal Register list (annual)" },
    },
    patterns: [
      "Treating 'Indian' as a racial category — courts have rejected this (Morton v. Mancari).",
      "Limiting 'Indian' to BIA-list members when the controlling statute uses broader language.",
      "Using 'Indian' for program eligibility and then applying that eligibility limit to rights claims.",
    ],
  },
  {
    term: "Tribe / Tribal Nation",
    slug: "tribe",
    category: "Governance & Political Status",
    oneLiner: "A self-governing political community with inherent sovereignty — not a cultural or social club.",
    layers: {
      ordinary:       { label: "Common Understanding", content: "A group of people sharing common ancestry, culture, or social bonds. Often used informally to mean a social group or cultural community.", citation: "Everyday usage" },
      historical:     { label: "Historical & Treaty-Era Meaning", content: "A sovereign political nation with recognized territorial governance, laws, and the capacity to enter into treaties. Pre-constitutional recognition: the U.S. Constitution's Commerce Clause (Art. I, § 8) lists 'Indian Tribes' as a distinct governing category alongside foreign nations and states. Black's Law Dictionary (1st ed., 1891): 'A body of Indians of the same or a similar race, united in a community under one leadership or government.'", citation: "U.S. Const. Art. I § 8; Black's Law Dictionary, 1891" },
      federal:        { label: "Federal Statutory Definition", content: "25 U.S.C. § 5304(e): 'Indian tribe means any Indian tribe, band, nation, or other organized group or community… which is recognized as eligible for the special programs and services provided by the United States to Indians because of their status as Indians.' Congress has enumerated over 574 tribes — but has never closed the definition as exhaustive. Worcester v. Georgia (1832): 'A tribe of Indians is acknowledged to be a distinct political community.'", citation: "25 U.S.C. § 5304(b); Worcester v. Georgia, 31 U.S. 515 (1832)" },
      administrative: { label: "Administrative Usage", content: "BIA administers a list of federally recognized tribes (published annually in the Federal Register). This list determines eligibility for specific BIA programs and services. The list is an administrative tool — not a legal determination that unlisted communities lack sovereignty, treaty rights, or federal Indian law protections.", citation: "25 C.F.R. Part 83; Federal Register Vol. 88 (Jan. 2023)" },
    },
    patterns: [
      "Treating BIA list membership as the legal definition of 'tribe' when statutes use broader language.",
      "Equating 'not on the list' with 'no tribal rights' — the list governs program eligibility, not legal identity.",
      "Treating tribal status as dependent on federal conferral rather than as pre-existing and inherent.",
    ],
  },
  {
    term: "Recognition / Recognized",
    slug: "recognition",
    category: "Administrative Process",
    oneLiner: "Federal recognition confirms a pre-existing relationship — it does not create one. A tribe exists before the government acknowledges it.",
    warning: "The word 'recognition' creates a conceptual trap: it implies the government creates tribal status. In law, recognition confirms what already existed.",
    layers: {
      ordinary:       { label: "Common Understanding", content: "An acknowledgment that something exists. In everyday usage, to 'recognize' something means to see and affirm it for the first time.", citation: "Everyday usage" },
      historical:     { label: "Historical & Treaty-Era Meaning", content: "Treaty-making was the original form of federal-tribal recognition — government-to-government acknowledgment of Indian nations as political entities. Many nations with treaties were never subjected to the modern Part 83 process. Historical recognition occurred through: treaty ratification, executive order, congressional act, or consistent government dealings.", citation: "Treaty era, 1778–1871; Cohen's Handbook of Federal Indian Law (1942)" },
      federal:        { label: "Federal Statutory Definition", content: "No statute defines 'recognition' as an administrative process that creates tribal identity. Passamaquoddy Tribe v. Morton (1975): 'The trust obligation of the United States extends to Indian tribes regardless of whether the Bureau of Indian Affairs has officially recognized them.' The trust relationship does not require administrative list placement. Recognition in the statutory sense is a description of an existing relationship, not its cause.", citation: "Passamaquoddy Tribe v. Morton, 528 F.2d 370 (1st Cir. 1975)" },
      administrative: { label: "Administrative Usage", content: "BIA's Part 83 process (25 C.F.R. Part 83) is a regulatory procedure through which a community can obtain a formal administrative determination of tribal status for program eligibility purposes. It is a lengthy, resource-intensive process. The regulations list seven criteria. Failing Part 83 does not extinguish pre-existing treaty rights, historical recognition, or statutory eligibility under broader federal Indian law provisions.", citation: "25 C.F.R. Part 83 (2015 revision)" },
    },
    patterns: [
      "'Not federally recognized' used as if it means 'not legally Indian' — these are different legal questions.",
      "Part 83 denial treated as proof that no federal relationship exists — denial is a programmatic determination, not a rights adjudication.",
      "'Recognition' used without specifying which recognition criterion applies: treaty, executive order, statutory, or administrative.",
    ],
  },
  {
    term: "Jurisdiction",
    slug: "jurisdiction",
    category: "Governance & Political Status",
    oneLiner: "Jurisdiction is lawful authority, not just physical control — and tribal jurisdiction is not granted by the federal government, it is inherent.",
    layers: {
      ordinary:       { label: "Common Understanding", content: "The area or subject matter over which a governing body exercises control. Often used to mean territorial control by a government.", citation: "Everyday usage" },
      historical:     { label: "Historical & Treaty-Era Meaning", content: "Under treaty-era and pre-constitutional thinking, Indian nations exercised inherent jurisdiction over their territories and members — a jurisdiction that pre-existed the United States. Worcester v. Georgia (1832): the laws of Georgia 'can have no force' in Cherokee territory. Black's Law Dictionary (1891): 'The power of the court to decide a matter in controversy and presuppose the existence of a duly constituted court with control over the subject matter and the parties.'", citation: "Worcester v. Georgia, 31 U.S. 515 (1832); Black's Law Dictionary, 1891" },
      federal:        { label: "Federal Statutory Definition", content: "18 U.S.C. § 1151 defines 'Indian country' as the zone where federal and tribal jurisdiction applies: (a) all land within reservation limits, (b) all dependent Indian communities, (c) all Indian allotments. Under this framework, tribal jurisdiction is inherent — not delegated by Congress. Congress may limit tribal jurisdiction (Oliphant v. Suquamish, 1978), but cannot eliminate inherent sovereign authority over members.", citation: "18 U.S.C. § 1151; Oliphant v. Suquamish Indian Tribe, 435 U.S. 191 (1978)" },
      administrative: { label: "Administrative Usage", content: "Federal and state agencies often define 'jurisdiction' territorially — tied to reservation boundaries or land status. This creates gaps: off-reservation members may be told their tribe has 'no jurisdiction' when federal law grants broader authority. Administrative jurisdiction maps frequently use narrower criteria than the statutory definition of Indian country.", citation: "BIA Geographic Information Systems; NICS (National Indian Country Statistics)" },
    },
    patterns: [
      "Treating tribal jurisdiction as limited to reservation land when statute includes dependent Indian communities and allotments.",
      "Asserting state jurisdiction over Indian country without a clear federal authorization (Public Law 280 applies only in specific states).",
      "'No jurisdiction' asserted without specifying which jurisdictional framework is being applied: criminal, civil, regulatory, or self-governance.",
    ],
  },
  {
    term: "Federal Trust Responsibility",
    slug: "trust-responsibility",
    category: "Government Obligations",
    oneLiner: "A fiduciary duty of the United States toward Indian people and tribes — it runs independently of which tribe is 'recognized' and cannot be terminated by administrative convenience.",
    layers: {
      ordinary:       { label: "Common Understanding", content: "A protective relationship between the U.S. government and Indian tribes. Often described as a special duty of care.", citation: "Everyday usage" },
      historical:     { label: "Historical & Treaty-Era Meaning", content: "Originated in treaty relationships and the legal principle of the United States as 'guardian' of Indian nations (Cherokee Nation v. Georgia, 1831). Developed through hundreds of treaties in which the U.S. promised protection, services, and support in exchange for land cessions. The trust relationship is older than most federal agencies — it pre-dates the BIA (1824), the Department of the Interior (1849), and nearly every modern statute.", citation: "Cherokee Nation v. Georgia, 30 U.S. 1 (1831); treaty obligations, 1778–1871" },
      federal:        { label: "Federal Statutory Definition", content: "The Snyder Act (1921) establishes the broadest statutory basis: 'Indians throughout the United States.' 25 U.S.C. § 5302 (ISDEAA) reaffirms trust responsibility as a congressional commitment to Indian self-determination. The trust responsibility is not program-specific — it is a relationship. Post-Loper Bright (2024), agencies cannot narrow the trust responsibility through regulatory interpretation alone.", citation: "Snyder Act, 42 Stat. 208 (1921); 25 U.S.C. § 5302; Loper Bright Enterprises v. Raimondo (2024)" },
      administrative: { label: "Administrative Usage", content: "Agencies often apply trust responsibility only to enrolled members of federally recognized tribes as a funding administration criterion. This administrative limitation is narrower than the statutory language. Courts have recognized trust responsibility toward tribes not on the current BIA list (Passamaquoddy, 1975). The administrative criterion governs program access, not the underlying legal obligation.", citation: "25 C.F.R. Part 83; Passamaquoddy Tribe v. Morton, 528 F.2d 370 (1st Cir. 1975)" },
    },
    patterns: [
      "Treating trust responsibility as a benefit contingent on BIA list status rather than a legal obligation.",
      "Agencies citing funding limitations to deny trust obligations — funding is a separate question from the legal duty.",
      "Using 'no trust relationship' as a conclusion when the statutory and treaty basis for that relationship has not been examined.",
    ],
  },
  {
    term: "Enrollment / Enrolled Member",
    slug: "enrollment",
    category: "Identity & Classification",
    oneLiner: "Tribal enrollment is citizenship in a political community — it is the tribe's sovereign right to determine, not a federal eligibility filter.",
    layers: {
      ordinary:       { label: "Common Understanding", content: "Membership in an organization. Often understood as registration or formal listing with a group.", citation: "Everyday usage" },
      historical:     { label: "Historical & Treaty-Era Meaning", content: "Pre-Dawes era, tribal membership was determined by tribal custom, kinship, community recognition, and adoption — not federal lists. The Dawes Rolls (1898–1914) were the federal government's first systematic attempt to enumerate tribal members for allotment purposes. The Dawes Rolls were incomplete, politically manipulated, and racially filtered. Non-enrollment on the Dawes Rolls has been misread as proof of non-Indian status — it is not.", citation: "Dawes Commission, 1898–1914; Cohen's Handbook of Federal Indian Law" },
      federal:        { label: "Federal Statutory Definition", content: "Indian tribes have the inherent sovereign right to determine their own membership criteria (Santa Clara Pueblo v. Martinez, 1978). Congress has never legislated uniform national enrollment criteria. Federal programs may use enrollment as an eligibility criterion for specific programs — but the definition of 'member' remains the tribe's to determine, not the federal government's.", citation: "Santa Clara Pueblo v. Martinez, 436 U.S. 49 (1978)" },
      administrative: { label: "Administrative Usage", content: "BIA uses enrollment in a federally recognized tribe as an eligibility criterion for specific programs. Some agencies require a Certificate of Degree of Indian Blood (CDIB) or tribal enrollment card. These are administrative tools for program delivery. They do not determine who is an Indian under every federal statute — different programs may use different eligibility definitions.", citation: "25 C.F.R. § 11.100; BIA CDIB requirements" },
    },
    patterns: [
      "Treating BIA program enrollment criteria as the universal definition of tribal membership.",
      "Applying one program's enrollment requirement to determine eligibility under a different statute with different definitions.",
      "Using 'unenrolled' as equivalent to 'not Indian' when tribal membership criteria are set by the tribe, not BIA.",
    ],
  },
  {
    term: "Sovereignty",
    slug: "sovereignty",
    category: "Governance & Political Status",
    oneLiner: "Tribal sovereignty is inherent — it pre-dates the United States, it was not created by federal law, and it cannot be extinguished by administrative inaction.",
    layers: {
      ordinary:       { label: "Common Understanding", content: "Supreme authority or power, typically associated with a nation-state's absolute right to self-governance.", citation: "Everyday usage" },
      historical:     { label: "Historical & Treaty-Era Meaning", content: "Indian nations exercised full sovereignty — territorial, governmental, and legal — prior to European contact and the formation of the United States. The U.S. Constitution acknowledges this by treating Indian tribes separately from states and foreign nations (Art. I, § 8). The Marshall Trilogy established that Indian nations retain inherent sovereignty as 'distinct, independent political communities' (Worcester v. Georgia, 1832).", citation: "Worcester v. Georgia, 31 U.S. 515 (1832); U.S. Const. Art. I § 8" },
      federal:        { label: "Federal Statutory Definition", content: "Congress recognizes tribal sovereignty through ISDEAA (25 U.S.C. § 5302): 'the Congress… declares its commitment to the maintenance of the Federal Government's unique and continuing relationship with, and responsibility to, individual Indian people and to the Indian tribes.' Tribal sovereignty includes: the right to self-governance, to determine membership, to tax, to regulate, to operate courts, and to exercise criminal and civil jurisdiction within Indian country.", citation: "25 U.S.C. § 5302; ICRA, 25 U.S.C. §§ 1301–1304" },
      administrative: { label: "Administrative Usage", content: "Federal and state agencies sometimes treat tribal sovereignty as limited to 'government-to-government consultation' — a procedural right rather than a substantive governing authority. This is a significant narrowing. Administrative consultation requirements do not exhaust tribal sovereignty — they are one procedural dimension of a relationship that includes regulatory authority, court jurisdiction, and territorial governance.", citation: "Executive Order 13175 (Consultation, 2000); E.O. 14112 (2022)" },
    },
    patterns: [
      "Treating consultation as if it fulfills all tribal sovereignty obligations — consultation is a process, not a right.",
      "Asserting that tribes have 'no sovereignty' in areas where Congress has not explicitly acted — residual sovereignty is presumed.",
      "Equating sovereignty with 'what BIA recognizes' rather than with inherent pre-existing authority.",
    ],
  },
  {
    term: "Treaty",
    slug: "treaty",
    category: "Government Obligations",
    oneLiner: "Under the U.S. Constitution, ratified treaties are the supreme law of the land — they do not expire, they cannot be administratively voided, and they still bind both parties.",
    layers: {
      ordinary:       { label: "Common Understanding", content: "A formal agreement between governments. Often understood as a historical document from a past era.", citation: "Everyday usage" },
      historical:     { label: "Historical & Treaty-Era Meaning", content: "The U.S. negotiated approximately 374 ratified Indian treaties between 1778 and 1871. Under treaty law, these were government-to-government compacts exchanging land cessions for permanent rights — to fishing, hunting, health services, education, and protection. Canons of Construction: treaties are to be construed as the Indian signatories understood them, ambiguities resolved in favor of the tribe, and rights reserved by implication.", citation: "Canons of Construction; Jones v. Meehan, 175 U.S. 1 (1899)" },
      federal:        { label: "Federal Statutory Definition", content: "U.S. Constitution Art. VI, § 2: 'This Constitution, and the Laws of the United States which shall be made in Pursuance thereof; and all Treaties made… shall be the supreme Law of the Land.' Congress may abrogate treaty provisions through clear, explicit statutory language (Lone Wolf v. Hitchcock, 1903) — but this requires affirmative congressional action. Administrative agencies cannot unilaterally void treaty rights. Most Indian treaties remain in force as law.", citation: "U.S. Const. Art. VI § 2; Lone Wolf v. Hitchcock, 187 U.S. 553 (1903)" },
      administrative: { label: "Administrative Usage", content: "Federal agencies often treat Indian treaties as historical artifacts — relevant to 'background' but not operationally binding on program decisions. Courts consistently reject this approach. Agency interpretations that ignore treaty rights are subject to challenge, especially after Loper Bright (2024) eliminated the deference agencies previously received for their own legal interpretations.", citation: "Loper Bright Enterprises v. Raimondo (2024); McGirt v. Oklahoma, 591 U.S. ___ (2020)" },
    },
    patterns: [
      "Treating treaties as expired or superseded without identifying the specific congressional act of abrogation.",
      "Agencies citing regulatory priorities that conflict with treaty rights without acknowledging the Supremacy Clause.",
      "Using 'we no longer do it that way' as a legal basis for ignoring treaty obligations — administrative practice cannot abrogate law.",
    ],
  },
  {
    term: "Blood Quantum",
    slug: "blood-quantum",
    category: "Identity & Classification",
    oneLiner: "Blood quantum is a colonial administrative measurement system — it was created by the federal government to reduce Indian populations on paper over time, not to define Indigenous identity.",
    warning: "This is one of the most consequential definitional tools in federal Indian law — and one of the least examined. No treaty uses blood quantum as a basis for rights.",
    layers: {
      ordinary:       { label: "Common Understanding", content: "A fraction measuring the 'degree' of Indian ancestry. Often used as a shorthand for 'how Indian' someone is.", citation: "Everyday usage" },
      historical:     { label: "Historical & Treaty-Era Meaning", content: "Blood quantum was not used in treaties. The original federal introduction was through the Dawes Act (1887) and the Dawes Rolls, which required federal enrollment officers to classify people by blood degree. This was applied inconsistently, often based on appearance or enumerator judgment. It was designed as an assimilation mechanism — reducing the number of people who would qualify for Indian land rights over generations.", citation: "Dawes Act, 1887; Dawes Commission Rolls, 1898–1914; Spruhan, 'A Legal History of Blood Quantum' (2006)" },
      federal:        { label: "Federal Statutory Definition", content: "There is no uniform federal definition of blood quantum as a rights threshold. Different statutes use different standards: some require 1/4, some 1/2, some any degree, some have no quantum requirement. ISDEAA, IHCIA, and ICWA do not all use the same standard. The Indian Reorganization Act (1934) encouraged blood quantum-based enrollment criteria in IRA constitutions — but this was not universal. Tribes retain the right to set their own membership criteria without blood quantum (Santa Clara Pueblo v. Martinez, 1978).", citation: "25 U.S.C. § 5304; Santa Clara Pueblo v. Martinez, 436 U.S. 49 (1978); various IRA constitutions" },
      administrative: { label: "Administrative Usage", content: "BIA uses Certificate of Degree of Indian Blood (CDIB) for some program eligibility determinations. CDIB certifies a specific blood quantum based on BIA records. Critically: CDIB is only as accurate as the underlying enrollment records — and those records reflect historical misclassification, Dawes Roll errors, off-roll Indians, and racial reclassification events. A low CDIB does not establish the limit of Indian ancestry — it reflects the limit of the available administrative record.", citation: "25 C.F.R. § 11.100; BIA CDIB requirements" },
    },
    patterns: [
      "Using blood quantum as an identity test when it was designed as an administrative eligibility filter.",
      "Treating CDIB as a ceiling on Indian ancestry when the underlying records may be incomplete or deliberately inaccurate.",
      "Applying one program's blood quantum threshold to a different program with different statutory requirements.",
    ],
  },
  {
    term: "Descendant",
    slug: "descendant",
    category: "Identity & Classification",
    oneLiner: "Descendants may carry the same treaty rights and federal Indian law standing as enrolled members — the word 'descendant' in federal law is not a lesser category.",
    layers: {
      ordinary:       { label: "Common Understanding", content: "A biological heir — someone born of a particular ancestor. Generally understood as a familial relationship without political significance.", citation: "Everyday usage" },
      historical:     { label: "Historical & Treaty-Era Meaning", content: "Treaty rights were understood to run to descendants — both as biological heirs and as continuations of the tribal community. NAGPRA (1990) uses 'lineal descendant' as the primary standing category for repatriation claims — expressly recognizing that lineage creates legal standing independent of enrollment. Many treaty rights were reserved for 'the tribe and their descendants' without enrollment qualification.", citation: "NAGPRA, 25 U.S.C. § 3001; treaty language analysis" },
      federal:        { label: "Federal Statutory Definition", content: "NAGPRA defines 'lineal descendant' broadly (25 U.S.C. § 3001(2)). ICWA includes 'eligible' Indian children who may not yet be enrolled. Some health statutes extend to descendants. The Snyder Act's 'Indians throughout the United States' has been interpreted to include descendants. Congressional intent has consistently been to protect lineage continuity, not to restrict rights to current enrollment rolls.", citation: "NAGPRA, 25 U.S.C. § 3001; ICWA, 25 U.S.C. § 1903; Snyder Act (1921)" },
      administrative: { label: "Administrative Usage", content: "BIA and some agencies treat 'descendant' as a secondary, lesser category — often ineligible for programs requiring enrolled membership. This administrative distinction is real for specific program eligibility. However, it should not be applied globally to treaty rights, NAGPRA standing, ICWA protections, or statutory categories that use their own definitions. Descendants have distinct standing that cannot be administratively eliminated.", citation: "BIA program eligibility guidance; 25 C.F.R. Part 83" },
    },
    patterns: [
      "Treating 'descendant' as having no federal standing when specific statutes (NAGPRA, some treaty language) grant lineal descendants full standing.",
      "Applying BIA program eligibility criteria (enrolled member) to rights questions that use different statutory language.",
      "Using descent to deny status while simultaneously denying enrollment opportunities — a circular trap.",
    ],
  },
  {
    term: "Indian Country",
    slug: "indian-country",
    category: "Territory & Jurisdiction",
    oneLiner: "Indian country is a federal jurisdictional zone, not just 'reservation land' — it includes dependent communities, allotments, and territories far beyond reservation boundaries.",
    layers: {
      ordinary:       { label: "Common Understanding", content: "The geographic area where Indian tribes live — commonly understood as reservation land.", citation: "Everyday usage" },
      historical:     { label: "Historical & Treaty-Era Meaning", content: "Early federal statutes (Trade and Intercourse Acts, 1790–1834) defined 'Indian country' as all territory west of the settled frontier — nearly everything not yet ceded to the United States. The concept was territorial and jurisdictional, not just geographic. Pre-removal, Indian country included most of the eastern continent.", citation: "Trade and Intercourse Acts, 1790–1834; Cohen's Handbook of Federal Indian Law" },
      federal:        { label: "Federal Statutory Definition", content: "18 U.S.C. § 1151 defines Indian country in three categories: (a) all land within any Indian reservation under federal jurisdiction, including rights-of-way; (b) all dependent Indian communities; (c) all Indian allotments to which Indian title has not been extinguished. McGirt v. Oklahoma (2020): the Muscogee (Creek) Reservation was never disestablished — over 19 million acres in eastern Oklahoma remain Indian country. Definition is much broader than 'reservation.'", citation: "18 U.S.C. § 1151; McGirt v. Oklahoma, 591 U.S. ___ (2020)" },
      administrative: { label: "Administrative Usage", content: "Federal and state agencies frequently limit 'Indian country' to land currently held in trust or on reservation maps — ignoring dependent Indian communities and allotments. This administrative narrowing has been consistently rejected by courts when challenged. Administrative geographic maps of Indian country are often decades behind the legal definition.", citation: "BIA Land Records; McGirt v. Oklahoma (2020)" },
    },
    patterns: [
      "Limiting 'Indian country' to existing trust land parcels when statute includes dependent communities and allotments.",
      "Treating Oklahoma as lacking Indian country before McGirt — courts found 19 million acres remained Indian country.",
      "Using state jurisdiction as a default in areas that have not been conclusively analyzed under 18 U.S.C. § 1151.",
    ],
  },
  {
    term: "Self-Determination",
    slug: "self-determination",
    category: "Governance & Political Status",
    oneLiner: "Self-determination is both an international human right and a specific U.S. statutory framework — it means the tribe runs its own programs on its own terms, not that the government decides when tribes are 'ready.'",
    layers: {
      ordinary:       { label: "Common Understanding", content: "The right of a people or community to decide their own future — often used loosely to mean personal autonomy or choice.", citation: "Everyday usage" },
      historical:     { label: "Historical & Treaty-Era Meaning", content: "In international law, self-determination is the right of peoples to determine their own political status (UN Charter, Art. 1(2)). For Indian nations, self-determination was always inherent — they exercised it before federal contact. The modern U.S. policy shift from termination (1953–1968) to self-determination was codified in ISDEAA (1975), ending federal paternalism as official policy.", citation: "UN Charter, Art. 1(2); UNDRIP, Art. 3–4; ISDEAA, 1975" },
      federal:        { label: "Federal Statutory Definition", content: "25 U.S.C. § 5302 (ISDEAA): Congress declares 'its commitment to the maintenance of the Federal Government's unique and continuing relationship with, and responsibility to, individual Indian people and to the Indian tribes… to establish an orderly transition from Federal domination of programs for, and services to, Indians to effective and meaningful participation by the Indian people in the planning, conduct, and administration of those programs.' Tribes contract to administer federal programs themselves — replacing federal control with tribal control. Under 25 C.F.R. § 169.8, a tribe or tribal organization may contract or compact under ISDEAA (25 U.S.C. 450f et seq.) to administer on the federal government's behalf any eligible portion of a program — placing tribal offices on equal footing with federal agencies for member inquiries. 'Indian tribe' is defined at 25 U.S.C. § 450b (ISDEAA § 4).", citation: "ISDEAA, 25 U.S.C. § 5302; 25 U.S.C. § 450b; 25 C.F.R. § 169.8; 25 U.S.C. § 5361 (Self-Governance Compacts)" },
      administrative: { label: "Administrative Usage", content: "Federal agencies sometimes treat self-determination as a conditional benefit — tribes are 'eligible' for self-determination contracting, implying the federal government can restrict or revoke it. ISDEAA explicitly rejects this: tribal request triggers the contract obligation. Agencies cannot decline to enter a self-determination contract unless specific statutory criteria for declination are met (25 U.S.C. § 5321(a)(2)).", citation: "25 U.S.C. § 5321(a)(2); ISDEAA declination criteria" },
    },
    patterns: [
      "Treating self-determination as a federal gift rather than a right that tribes invoke through contracting.",
      "Agency discretion asserted over whether to enter ISDEAA contracts — statute limits declination grounds narrowly.",
      "Using 'self-determination' rhetorically while maintaining administrative control over tribal program design.",
    ],
  },
];

const COMPARISON_TABLE = [
  { word: "Indian",          common: "Race label / demographic",      legal: "Political / legal classification",     administrative: "Program eligibility category",  historical: "Nation-member / Indigenous nationhood" },
  { word: "Tribe",           common: "Social / cultural group",       legal: "Self-governing political community",   administrative: "BIA-recognized entity",           historical: "Sovereign kinship nation" },
  { word: "Recognition",     common: "Acknowledgment (new)",          legal: "Confirmation of pre-existing relationship", administrative: "Part 83 agency process",      historical: "Treaty / executive / congressional act" },
  { word: "Jurisdiction",    common: "Geographic control",            legal: "Inherent lawful authority",            administrative: "Agency / reservation territory",  historical: "Relational territorial governance" },
  { word: "Sovereignty",     common: "Supreme authority",             legal: "Inherent, pre-existing governing power", administrative: "Consultation right",             historical: "Full pre-colonial nationhood" },
  { word: "Treaty",          common: "Historical document",           legal: "Supreme law of the land (Art. VI)",    administrative: "Background context",              historical: "Government-to-government compact" },
  { word: "Enrollment",      common: "Membership / registration",     legal: "Tribal citizenship (tribe's right to define)", administrative: "BIA program eligibility",  historical: "Community / kinship membership" },
  { word: "Trust Responsibility", common: "Special duty of care",     legal: "Fiduciary obligation (pre-dates BIA)", administrative: "Program delivery framework",      historical: "Treaty-exchange obligation" },
  { word: "Blood Quantum",   common: "Fraction of Indian ancestry",   legal: "No uniform statutory threshold",       administrative: "CDIB eligibility tool",           historical: "Colonial assimilation mechanism (Dawes)" },
  { word: "Descendant",      common: "Biological heir",               legal: "Standing category (NAGPRA, treaties)", administrative: "Secondary / ineligible tier",     historical: "Lineage continuity holder" },
  { word: "Indian Country",  common: "Reservation land",              legal: "3-part jurisdictional zone (18 U.S.C. § 1151)", administrative: "Trust land / BIA map",   historical: "Nearly all un-ceded eastern territory" },
  { word: "Self-Determination", common: "Personal autonomy",          legal: "Statutory contracting right (ISDEAA)", administrative: "Conditional program benefit",    historical: "Inherent right of peoples (UNDRIP)" },
];

const PATTERNS = [
  {
    name: "Administrative Substitution",
    icon: "⚙️",
    description: "An administrative list, regulation, or agency process is used as if it defines the full scope of a Congressional statute — when the statute uses broader language.",
    example: "BIA Part 83 list used as the definition of 'Indian tribe' — when 25 U.S.C. § 5304 does not limit the term to the list.",
  },
  {
    name: "Circular Definition",
    icon: "🔄",
    description: "A definition relies on another term that is itself undefined, or the definition assumes its own conclusion.",
    example: "'You must be enrolled to be a member. You must be a member to be enrolled.' — A community seeking initial recognition has no path in.",
  },
  {
    name: "Jurisdictional Narrowing",
    icon: "📍",
    description: "The geographic or subject-matter scope of a term is silently reduced from its statutory definition to a more convenient administrative boundary.",
    example: "'Indian country' limited to existing reservation maps — when 18 U.S.C. § 1151 includes dependent communities and allotments not on any current map.",
  },
  {
    name: "Racial Substitution for Political Classification",
    icon: "🏷️",
    description: "A political/legal classification ('Indian' in federal law) is treated as a racial category — allowing equal protection arguments to challenge Indian-specific protections.",
    example: "Arguing that ICWA or Indian preference programs are race-based and therefore unconstitutional — when Morton v. Mancari (1974) established they are political, not racial.",
  },
  {
    name: "Undefined Term as Authority",
    icon: "❓",
    description: "A key term is used in an official document or decision without definition — allowing the reader to assume the narrowest interpretation without the agency committing to it.",
    example: "'Federally recognized tribe' used in a program denial without specifying whether it refers to Part 83 status, treaty relationship, statutory eligibility, or congressional recognition.",
  },
  {
    name: "Historical Freeze",
    icon: "🕰️",
    description: "Rights or status are frozen to a historical moment — treating a community's current situation as determinative when the law protects ongoing relationship, not a fixed historical snapshot.",
    example: "Treating post-removal census data as proof that a Southeastern community is 'no longer Indian' — when removal was itself an interruption, not an identity change.",
  },
  {
    name: "Eligibility Conflation",
    icon: "🔀",
    description: "Program eligibility criteria are applied to rights determinations that use different statutory definitions.",
    example: "A BIA program eligibility denial (requiring Part 83 recognition) used to deny treaty rights that apply independently under the Non-Intercourse Act (1790).",
  },
];

/* ─────────── Sub-components ─────────── */
const LAYER_COLORS: Record<string, string> = {
  ordinary:       "border-slate-600/40 bg-slate-900/40 text-slate-300",
  historical:     "border-amber-700/40 bg-amber-950/30 text-amber-200",
  federal:        "border-indigo-700/40 bg-indigo-950/30 text-indigo-200",
  administrative: "border-rose-700/40 bg-rose-950/25 text-rose-200",
};
const LAYER_LABEL_COLORS: Record<string, string> = {
  ordinary: "text-slate-400", historical: "text-amber-400", federal: "text-indigo-400", administrative: "text-rose-400",
};

function WordCard({ entry }: { entry: WordEntry }) {
  const [open, setOpen] = useState(false);
  const [activeLayer, setActiveLayer] = useState<"ordinary"|"historical"|"federal"|"administrative"|null>(null);

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 overflow-hidden">
      <button
        className="w-full text-left p-4 flex items-start justify-between gap-3 hover:bg-slate-800/40 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-base font-bold text-teal-200">{entry.term}</span>
            <Badge className="text-[10px] bg-slate-800 border-slate-600 text-slate-400 px-1.5 py-0">{entry.category}</Badge>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{entry.oneLiner}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />}
      </button>

      {open && (
        <div className="border-t border-slate-700/50 p-4 space-y-4">
          {entry.warning && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-700/40 bg-amber-950/20 p-3">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200/80 leading-relaxed">{entry.warning}</p>
            </div>
          )}

          {/* Layer tabs */}
          <div className="flex flex-wrap gap-1.5">
            {(["ordinary","historical","federal","administrative"] as const).map(layer => (
              <button
                key={layer}
                onClick={() => setActiveLayer(activeLayer === layer ? null : layer)}
                className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors font-medium ${
                  activeLayer === layer
                    ? LAYER_COLORS[layer].replace("bg-","bg-").replace("/30","/60").replace("/40","/70")
                    : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-300"
                }`}
              >
                {entry.layers[layer].label}
              </button>
            ))}
            {activeLayer && (
              <button onClick={() => setActiveLayer(null)} className="text-[11px] px-2 py-1 text-slate-600 hover:text-slate-400">✕ close</button>
            )}
          </div>

          {/* Active layer content */}
          {activeLayer && (
            <div className={`rounded-lg border p-3 text-xs ${LAYER_COLORS[activeLayer]}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${LAYER_LABEL_COLORS[activeLayer]}`}>
                {entry.layers[activeLayer].label}
              </p>
              <p className="leading-relaxed mb-2">{entry.layers[activeLayer].content}</p>
              {entry.layers[activeLayer].citation && (
                <p className="text-[11px] opacity-60 italic">{entry.layers[activeLayer].citation}</p>
              )}
            </div>
          )}

          {/* All 4 layers (collapsed preview when no layer selected) */}
          {!activeLayer && (
            <div className="grid grid-cols-2 gap-2">
              {(["ordinary","historical","federal","administrative"] as const).map(layer => (
                <button
                  key={layer}
                  onClick={() => setActiveLayer(layer)}
                  className={`rounded-lg border p-2.5 text-left hover:opacity-90 transition-opacity ${LAYER_COLORS[layer]}`}
                >
                  <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${LAYER_LABEL_COLORS[layer]}`}>
                    {entry.layers[layer].label}
                  </p>
                  <p className="text-[11px] line-clamp-2 opacity-80 leading-relaxed">{entry.layers[layer].content}</p>
                </button>
              ))}
            </div>
          )}

          {/* Patterns */}
          {entry.patterns && entry.patterns.length > 0 && (
            <div className="rounded-lg border border-rose-800/30 bg-rose-950/15 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-400 mb-2">Watch For These Patterns</p>
              <ul className="space-y-1.5">
                {entry.patterns.map((p, i) => (
                  <li key={i} className="text-[11px] text-rose-200/70 leading-relaxed flex items-start gap-2">
                    <span className="text-rose-500 mt-0.5">⚠</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────── Main page ─────────── */
export default function SduDefinitionsPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"words"|"table"|"patterns">("words");

  const filtered = WORDS.filter(w =>
    search === "" ||
    w.term.toLowerCase().includes(search.toLowerCase()) ||
    w.category.toLowerCase().includes(search.toLowerCase()) ||
    w.oneLiner.toLowerCase().includes(search.toLowerCase())
  );

  const TABS = [
    { id: "words",    label: "Word Explorer",         icon: BookOpen },
    { id: "table",    label: "Parallel Comparison",   icon: Layers },
    { id: "patterns", label: "Pattern Recognition",   icon: Eye },
  ] as const;

  return (
    <div className="space-y-6 pb-12">
      {/* ── Back nav ── */}
      <div className="flex items-center gap-3">
        <Link to="/sdu" className="text-sm text-muted-foreground hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Back to SDU
        </Link>
      </div>

      {/* ── Hero ── */}
      <div
        className="rounded-2xl p-6 space-y-4"
        style={{ background: "linear-gradient(135deg, #021a14 0%, #041f18 50%, #021a14 100%)", border: "1px solid #0d4a35" }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-teal-500/70 mb-1">SDU — Language & Jurisdiction Literacy</p>
            <h1 className="text-2xl font-serif font-bold text-teal-100">Definition Literacy System</h1>
            <p className="text-teal-300/60 text-sm mt-1">Language, Definition, and Jurisdiction Literacy — Self Determination University</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-teal-900/60 border-teal-700 text-teal-300 text-xs">{WORDS.length} Key Terms</Badge>
            <Badge className="bg-slate-900/60 border-slate-700 text-slate-300 text-xs">4-Layer Analysis</Badge>
            <Badge className="bg-rose-900/40 border-rose-800 text-rose-300 text-xs">{PATTERNS.length} Patterns</Badge>
          </div>
        </div>

        {/* Why definitions matter */}
        <div className="rounded-xl border border-teal-800/40 bg-teal-950/30 p-4">
          <p className="text-xs font-semibold text-teal-300 uppercase tracking-wider mb-3">Why Definitions Matter</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
            {["Jurisdiction","Eligibility","Classification","Authority","Protection","Obligation","Access to Remedies","Historical Standing"].map(w => (
              <div key={w} className="rounded-md border border-teal-800/30 bg-teal-900/20 px-2 py-1.5 text-center">
                <span className="text-xs text-teal-200/80 font-medium">{w}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-teal-200/60 leading-relaxed">
            A single change in definition can alter whether a people are protected, whether land is treated as protected, whether benefits attach, whether jurisdiction applies, or whether a community is treated as continuing or nonexistent. Many legal conflicts are not fought openly through force first — they are fought through interpretation, classification, and administrative narrowing. Understanding definitions is part of self-determination, legal literacy, and historical comprehension.
          </p>
        </div>

        {/* Key principle */}
        <div className="rounded-xl border border-amber-800/30 bg-amber-950/20 p-4">
          <div className="flex items-start gap-2">
            <Scale className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-300 mb-1">Foundational Distinction</p>
              <p className="text-xs text-amber-200/70 leading-relaxed">
                Language systems shape perception, classification, and legal outcomes. This system teaches the difference between <strong className="text-amber-200">identity</strong>, <strong className="text-amber-200">classification</strong>, <strong className="text-amber-200">eligibility</strong>, <strong className="text-amber-200">administration</strong>, and <strong className="text-amber-200">existence</strong> — because many communities were not erased physically first. They were renamed, reclassified, administratively absorbed, or interpreted through narrower frameworks over time.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 border-b border-slate-800 pb-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as typeof tab)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
              tab === id
                ? "border-teal-500 text-teal-300"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Word Explorer ── */}
      {tab === "words" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search terms, categories, or concepts…"
              className="pl-8 bg-slate-900 border-slate-700 text-slate-200 text-xs h-9"
            />
          </div>
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No terms match "{search}"</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(entry => <WordCard key={entry.slug} entry={entry} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Parallel Comparison Table ── */}
      {tab === "table" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-4 text-xs text-slate-400 leading-relaxed">
            <p className="font-semibold text-slate-300 mb-1">How to read this table</p>
            Words operate differently depending on who is using them and for what purpose. The same word can mean four different things depending on the context — <span className="text-slate-200">common usage</span>, <span className="text-indigo-300">federal statute</span>, <span className="text-rose-300">administrative process</span>, or <span className="text-amber-300">historical meaning</span>. Understanding the gap between these is the foundation of legal literacy.
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-700/50">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-900/80">
                  <th className="text-left px-4 py-3 text-slate-300 font-semibold w-28">Word</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Common Understanding</th>
                  <th className="text-left px-4 py-3 text-indigo-400 font-medium">Legal / Statutory Meaning</th>
                  <th className="text-left px-4 py-3 text-rose-400 font-medium">Administrative Usage</th>
                  <th className="text-left px-4 py-3 text-amber-400 font-medium">Historical Meaning</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_TABLE.map((row, i) => (
                  <tr key={row.word} className={`border-b border-slate-800/60 ${i % 2 === 0 ? "bg-slate-900/20" : "bg-slate-800/10"}`}>
                    <td className="px-4 py-3 font-semibold text-teal-300 align-top whitespace-nowrap">{row.word}</td>
                    <td className="px-4 py-3 text-slate-400 align-top leading-relaxed">{row.common}</td>
                    <td className="px-4 py-3 text-indigo-300/80 align-top leading-relaxed">{row.legal}</td>
                    <td className="px-4 py-3 text-rose-300/80 align-top leading-relaxed">{row.administrative}</td>
                    <td className="px-4 py-3 text-amber-300/80 align-top leading-relaxed">{row.historical}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pattern Recognition ── */}
      {tab === "patterns" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-rose-800/30 bg-rose-950/15 p-4 text-xs text-rose-200/70 leading-relaxed">
            <p className="font-semibold text-rose-300 mb-1">What to look for in documents and decisions</p>
            These are recurring patterns of definitional manipulation — ways that language is used to narrow rights, restrict access, or reframe legal questions without engaging their substance. Identifying these patterns is the first step toward responding to them effectively and educationally.
          </div>
          <div className="space-y-3">
            {PATTERNS.map(pat => (
              <PatternCard key={pat.name} pat={pat} />
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div
        className="rounded-xl p-5 text-center"
        style={{ background: "linear-gradient(135deg, #021a14 0%, #041f18 100%)", border: "1px solid #0d4a35" }}
      >
        <p className="text-xs text-teal-300/50 leading-relaxed max-w-2xl mx-auto italic">
          "Administrative lists serve administrative purposes and do not necessarily exhaust the full scope of federal Indian statutory language, historical continuity, treaty history, or Indigenous identity."
        </p>
        <p className="text-[11px] text-teal-400/30 mt-2">— Definition Literacy System · Self Determination University · Mathias El Tribe</p>
      </div>
    </div>
  );
}

function PatternCard({ pat }: { pat: typeof PATTERNS[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-rose-800/30 bg-rose-950/15 overflow-hidden">
      <button
        className="w-full text-left p-4 flex items-center gap-3 hover:bg-rose-950/20 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-xl flex-shrink-0">{pat.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-rose-200">{pat.name}</p>
          <p className="text-xs text-rose-300/60 leading-relaxed mt-0.5 line-clamp-1">{pat.description}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-rose-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-rose-500 flex-shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-rose-800/30 p-4 space-y-3">
          <p className="text-xs text-rose-200/80 leading-relaxed">{pat.description}</p>
          <div className="rounded-lg border border-amber-800/30 bg-amber-950/20 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 mb-1.5">Example</p>
            <p className="text-xs text-amber-200/70 leading-relaxed">{pat.example}</p>
          </div>
        </div>
      )}
    </div>
  );
}
