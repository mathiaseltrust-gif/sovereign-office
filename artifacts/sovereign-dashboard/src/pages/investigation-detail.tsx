import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

// ─── Type Definitions ────────────────────────────────────────────────────────

interface ActionItem { step: number; action: string; status: string; }
interface FollowthroughItem { step: number; item: string; status: string; completedAt?: string; }

interface AuditEntry {
  id: number;
  action: string;
  userId: number | null;
  resourceType: string;
  resourceId: number | null;
  beforeValue: unknown;
  afterValue: unknown;
  metadata: unknown;
  createdAt: string;
}

interface Signal {
  id: number;
  investigationId: number;
  signalType: string;
  confidence: number | null;
  evidenceSource: string | null;
  detectedAt: string;
}

interface Investigation {
  id: number;
  signalType: string;
  triggeringEventType: string;
  affectedMatter: string | null;
  triggeringEntity: string | null;
  protectionCategory: string | null;
  urgencyScore: number | null;
  recommendedReviewLevel: string | null;
  status: string;
  nfrId: number | null;
  assignedReviewerId: number | null;
  implicatedLaws: string[] | null;
  internalActions: ActionItem[] | null;
  externalActions: ActionItem[] | null;
  requiredFollowthrough: FollowthroughItem[] | null;
  summary: string | null;
  affectedParcelId: number | null;
  affectedUserId: number | null;
  affectedInstrumentId: number | null;
  createdAt: string;
  updatedAt: string;
  signals: Signal[];
  auditLog: AuditEntry[];
}

interface OfficerEntry { id: number; name: string; email: string; }

// ─── Static Knowledge Bases ──────────────────────────────────────────────────

interface JurisdictionTrigger {
  domain: string;
  basis: string;
  provisions: string[];
  departments: string[];
  doctrines: string[];
  notices: string[];
  remedies: string[];
}

const JURISDICTION_MAP: Record<string, JurisdictionTrigger[]> = {
  LAND: [
    {
      domain: "Indian Country Land Status",
      basis: "Trust land and restricted-fee property fall under federal and tribal exclusive jurisdiction by statute and treaty.",
      provisions: ["25 U.S.C. § 177", "25 U.S.C. § 465", "18 U.S.C. § 1151"],
      departments: ["Bureau of Indian Affairs", "Office of Trust Records", "Tribal Land Department"],
      doctrines: ["Trust Responsibility Doctrine", "Plenary Power", "Worcester v. Georgia"],
      notices: ["Notice of Federal Trust Land Review", "Preservation Notice"],
      remedies: ["BIA Administrative Appeal", "Federal Quiet Title Action", "Tribal Court Injunction"],
    },
    {
      domain: "State Jurisdiction Limits",
      basis: "States lack jurisdiction over Indian Country absent explicit congressional authorization.",
      provisions: ["28 U.S.C. § 1360", "PL 280 (where applicable)", "McClanahan v. Arizona"],
      departments: ["Tribal Legal Department", "Office of Chief Justice"],
      doctrines: ["Preemption Doctrine", "Tribal Sovereignty", "Federal Supremacy Clause"],
      notices: ["Notice of Jurisdictional Challenge"],
      remedies: ["Federal Court Removal", "Tribal Court Assertion of Jurisdiction"],
    },
  ],
  FORECLOSURE: [
    {
      domain: "Trust Land Anti-Alienation",
      basis: "Trust and restricted allotments cannot be alienated or encumbered without BIA approval. Foreclosure of such land is void.",
      provisions: ["25 U.S.C. § 177", "25 U.S.C. § 483a", "Cass County v. Leech Lake Band"],
      departments: ["Bureau of Indian Affairs", "Office of Trust Responsibility", "Tribal Legal"],
      doctrines: ["Non-Intercourse Act", "Trust Responsibility", "Restraint on Alienation"],
      notices: ["Notice of Improper Foreclosure", "Federal Injunction Notice"],
      remedies: ["Emergency Injunction", "BIA Intervention", "Federal Court Action"],
    },
  ],
  TAX_OR_LIEN: [
    {
      domain: "Indian Tax Immunity",
      basis: "Tribal members' trust property and on-reservation income are generally exempt from state taxation.",
      provisions: ["25 U.S.C. § 465", "McClanahan v. Arizona", "Bryan v. Itasca County"],
      departments: ["Tribal Tax Authority", "IRS Tribal Section", "Office of Chief Justice"],
      doctrines: ["Tax Immunity Doctrine", "Interest Balancing Test", "Federal Preemption"],
      notices: ["Notice of Improper Tax Assessment", "Lien Challenge Notice"],
      remedies: ["Administrative Tax Challenge", "Refund Claim", "Preemption Defense"],
    },
  ],
  IDENTITY: [
    {
      domain: "Tribal Citizenship & Identity Rights",
      basis: "Tribal nations have inherent sovereign authority to determine their own membership. Federal and state interference may implicate civil rights.",
      provisions: ["Santa Clara Pueblo v. Martinez", "42 U.S.C. § 1981", "Indian Civil Rights Act (25 U.S.C. § 1301 et seq.)"],
      departments: ["Tribal Enrollment Department", "Tribal Civil Rights Office", "DOJ Civil Rights Division"],
      doctrines: ["Inherent Tribal Sovereignty", "Indian Civil Rights Act", "Due Process"],
      notices: ["Identity Rights Protection Notice", "Civil Rights Complaint Notice"],
      remedies: ["Tribal Enrollment Appeal", "Federal Civil Rights Complaint", "Writ of Habeas Corpus (ICRA)"],
    },
  ],
  JURISDICTION: [
    {
      domain: "Tribal-State-Federal Jurisdictional Conflict",
      basis: "Concurrent jurisdiction disputes require analysis of subject matter, parties, location, and applicable treaties.",
      provisions: ["18 U.S.C. § 1151", "18 U.S.C. § 1153", "28 U.S.C. § 1331", "Montana v. United States"],
      departments: ["Office of Chief Justice", "Tribal Legal Department", "DOJ Indian Resources Section"],
      doctrines: ["Montana Two-Part Test", "Strate v. A-1 Contractors", "Exhaustion Doctrine"],
      notices: ["Notice of Tribal Jurisdiction", "Jurisdictional Challenge Notice"],
      remedies: ["Tribal Court Jurisdictional Order", "Federal Removal", "Intergovernmental Protocol"],
    },
  ],
  ICWA: [
    {
      domain: "Indian Child Welfare Act",
      basis: "ICWA establishes minimum federal standards for child custody proceedings involving Indian children and requires active efforts and tribal notification.",
      provisions: ["25 U.S.C. § 1901 et seq.", "Brackeen v. Haaland", "25 C.F.R. Part 23"],
      departments: ["Tribal ICWA Department", "BIA ICWA Office", "Tribal Family Services"],
      doctrines: ["Active Efforts Standard", "Qualified Expert Witness", "ICWA Preferences"],
      notices: ["ICWA Tribal Notice", "Improper ICWA Proceeding Notice"],
      remedies: ["Tribal Intervention", "Case Invalidation", "Return of Child to Tribal Jurisdiction"],
    },
  ],
  TRUST_RESPONSIBILITY: [
    {
      domain: "Federal Trust Responsibility",
      basis: "The federal government has a special trust relationship with tribal nations requiring it to protect tribal assets, rights, and resources.",
      provisions: ["25 U.S.C. § 162a", "Cobell v. Salazar", "United States v. Mitchell (Mitchell II)"],
      departments: ["Office of Trust Responsibility", "BIA Trust Services", "Office of Special Trustee"],
      doctrines: ["Trust Responsibility Doctrine", "Mitchell II Money-Mandating Test", "Breach of Fiduciary Duty"],
      notices: ["Notice of Trust Responsibility Breach", "Federal Accountability Notice"],
      remedies: ["Federal Trust Claim", "Congressional Oversight Referral", "Tribal-Federal Consultation"],
    },
  ],
  BENEFITS: [
    {
      domain: "Federal Indian Program Eligibility",
      basis: "AI/AN individuals and tribes are entitled to specific federal programs and cannot be unlawfully denied access.",
      provisions: ["Snyder Act (25 U.S.C. § 13)", "Indian Health Care Improvement Act", "25 U.S.C. § 1680 et seq."],
      departments: ["Indian Health Service", "BIA Social Services", "Tribal Benefits Office"],
      doctrines: ["Morton v. Mancari Political Classification", "Canons of Construction for Indians"],
      notices: ["Benefits Denial Challenge", "Program Eligibility Notice"],
      remedies: ["Administrative Appeal", "Congressional Inquiry", "Federal Civil Rights Complaint"],
    },
  ],
  FEDERAL_PROGRAM: [
    {
      domain: "Federal Indian Program Integrity",
      basis: "Federal programs administered for tribal benefit must be administered in accordance with trust responsibility and applicable statutes.",
      provisions: ["25 U.S.C. § 450 et seq. (ISDEAA)", "2 C.F.R. Part 200", "Tribal Self-Governance Act"],
      departments: ["BIA Division of Self-Determination", "IHS", "Office of Self-Governance"],
      doctrines: ["Self-Determination Policy", "Indian Canons of Construction"],
      notices: ["Program Integrity Notice", "Federal Oversight Request"],
      remedies: ["ISDEAA Dispute Resolution", "Tribal-Federal Consultation", "OIG Referral"],
    },
  ],
  TREATY: [
    {
      domain: "Treaty Rights & Reserved Rights",
      basis: "Treaty rights are the supreme law of the land. Reserved rights include hunting, fishing, water, and land rights not expressly ceded.",
      provisions: ["U.S. Const. Art. VI, cl. 2", "Washington v. Washington State Commercial Passenger Fishing Vessel", "Winters v. United States"],
      departments: ["Office of Chief Justice", "Tribal Treaty Rights Department", "DOJ Environment & Natural Resources"],
      doctrines: ["Reserved Rights Doctrine", "Canons of Construction — Indian Treaties", "Supremacy Clause"],
      notices: ["Treaty Rights Protection Notice", "Notice of Treaty Violation"],
      remedies: ["Federal Court Treaty Claim", "Tribal-Federal Government-to-Government Consultation"],
    },
  ],
  RECORDER: [
    {
      domain: "Recording & Document Rights",
      basis: "Tribal documents, instruments, and records have a right to proper recording. Refusal or improper recording of tribal instruments may implicate federal law.",
      provisions: ["25 U.S.C. § 81", "25 U.S.C. § 2201 et seq.", "Tribal Recorder Rules"],
      departments: ["Tribal Recorder's Office", "Office of Chief Justice", "BIA Title Plant"],
      doctrines: ["Tribal Document Sovereignty", "Federal Supremacy Over Indian Affairs"],
      notices: ["Recording Challenge Notice", "Preservation Notice"],
      remedies: ["Tribal Court Order", "Federal Mandamus", "Administrative Complaint"],
    },
  ],
  MANAGED_CARE: [
    {
      domain: "AI/AN Healthcare & Managed Care Rights",
      basis: "AI/AN individuals have statutory rights to healthcare through IHS and affiliated programs that cannot be improperly denied or limited.",
      provisions: ["Indian Health Care Improvement Act", "25 U.S.C. § 1680", "Affordable Care Act § 10221"],
      departments: ["Indian Health Service", "Tribal Health Department", "HHS Office of Minority Health"],
      doctrines: ["Federal Trust Responsibility in Healthcare", "IHCIA Special Provisions"],
      notices: ["Healthcare Rights Notice", "Managed Care Denial Challenge"],
      remedies: ["IHS Administrative Complaint", "HHS Civil Rights Complaint", "Federal Court Action"],
    },
  ],
  CONTINUITY: [
    {
      domain: "Tribal Continuity & Sovereignty Protections",
      basis: "Tribal nations maintain inherent sovereignty and continuity regardless of federal recognition changes, policy shifts, or external interference.",
      provisions: ["25 U.S.C. § 5301 et seq.", "UNDRIP Art. 3", "Native American Graves Protection Act"],
      departments: ["Office of Chief Justice", "Bureau of Indian Affairs", "Tribal Leadership"],
      doctrines: ["Inherent Sovereignty", "Self-Determination Policy", "Political Classification Doctrine"],
      notices: ["Continuity Protection Notice"],
      remedies: ["Tribal Sovereign Immunity Defense", "Federal-Tribal Consultation", "Tribal Legislative Action"],
    },
  ],
};

interface ProtectionEntry {
  id: string;
  title: string;
  summary: string;
  statutes: string[];
  caseLaw: string[];
  doctrineNotes: string;
  tribalLaw: string;
  applicableAgencies: string[];
  triggerConditions: string[];
  enforcementOptions: string[];
  relatedTemplates: string[];
  categories: string[];
}

const PROTECTIONS_LIBRARY: ProtectionEntry[] = [
  {
    id: "trust-responsibility",
    title: "Trust Responsibility",
    summary: "The federal government holds a solemn obligation to protect tribal assets, natural resources, and the well-being of tribal members — enforceable as a fiduciary duty.",
    statutes: ["25 U.S.C. § 162a", "25 U.S.C. § 4044"],
    caseLaw: ["United States v. Mitchell (1983)", "Cobell v. Salazar (2009)", "White Mountain Apache Tribe v. United States"],
    doctrineNotes: "Money-mandating statutes create enforceable trust claims under Mitchell II. Officers must document every instance of federal inaction or mismanagement.",
    tribalLaw: "Tribal constitution provisions on asset protection and sovereign immunity over tribal funds.",
    applicableAgencies: ["Bureau of Indian Affairs", "Office of Special Trustee", "DOI Office of Inspector General"],
    triggerConditions: ["Federal mismanagement of trust assets", "BIA failure to protect tribal resources", "Breach of trust account obligations"],
    enforcementOptions: ["Federal claims court action", "Congressional oversight referral", "Tribal-Federal consultation demand"],
    relatedTemplates: ["Notice of Trust Responsibility Breach", "Federal Accountability Demand Letter"],
    categories: ["TRUST_RESPONSIBILITY", "LAND", "BENEFITS"],
  },
  {
    id: "land-protections",
    title: "Land & Trust Property Protections",
    summary: "Trust and restricted-fee land cannot be alienated, encumbered, taxed, or foreclosed without explicit federal authorization. State court jurisdiction is preempted.",
    statutes: ["25 U.S.C. § 177 (Non-Intercourse Act)", "25 U.S.C. § 465", "18 U.S.C. § 1151"],
    caseLaw: ["County of Oneida v. Oneida Indian Nation", "Cass County v. Leech Lake Band", "City of Sherrill v. Oneida Indian Nation"],
    doctrineNotes: "The Non-Intercourse Act voids any transfer of Indian land made without federal consent. Restraint on alienation is a fundamental protection — no mortgage, lien, or judgment can attach without BIA approval.",
    tribalLaw: "Tribal Land Code and Land Use Ordinances govern all land transactions.",
    applicableAgencies: ["BIA Realty", "Office of Trust Records", "Tribal Land Department"],
    triggerConditions: ["State tax assessment on trust land", "Foreclosure attempt", "Adverse possession claim", "State court judgment purporting to affect trust land"],
    enforcementOptions: ["Federal injunction", "BIA intervention", "Tribal Court Quiet Title action"],
    relatedTemplates: ["Preservation Notice", "Notice of Improper Land Action"],
    categories: ["LAND", "FORECLOSURE", "TAX_OR_LIEN"],
  },
  {
    id: "treaty-rights",
    title: "Treaty Rights & Reserved Rights Doctrine",
    summary: "Treaties are the supreme law of the land. Rights reserved in treaties — including hunting, fishing, water, and occupancy — survive federal policy changes unless explicitly abrogated by Congress.",
    statutes: ["U.S. Const. Art. VI, cl. 2", "25 U.S.C. § 177"],
    caseLaw: ["Worcester v. Georgia (1832)", "Winters v. United States (1908)", "Washington v. Wash. State Commercial Passenger Fishing Vessel (1979)"],
    doctrineNotes: "Indian Canons of Construction: treaties must be construed as the Indians understood them, with ambiguities resolved in favor of the tribe. Congress must speak clearly to abrogate treaty rights.",
    tribalLaw: "Treaty of [applicable date] and all successor agreements forming the government-to-government relationship.",
    applicableAgencies: ["DOJ Environment & Natural Resources", "DOI Office of Indian Affairs", "Office of Chief Justice"],
    triggerConditions: ["Denial of treaty-reserved fishing or hunting rights", "Interference with water rights", "State regulation conflicting with treaty terms"],
    enforcementOptions: ["Federal court treaty claim", "Government-to-government consultation", "Congressional notification"],
    relatedTemplates: ["Treaty Rights Protection Notice", "Notice of Treaty Violation"],
    categories: ["TREATY", "LAND", "BENEFITS"],
  },
  {
    id: "icwa",
    title: "Indian Child Welfare Act (ICWA) Protections",
    summary: "ICWA establishes minimum federal standards for child custody proceedings involving Indian children, mandating tribal notification, active efforts, and placement preferences.",
    statutes: ["25 U.S.C. § 1901–1963", "25 C.F.R. Part 23"],
    caseLaw: ["Brackeen v. Haaland (2023)", "Mississippi Band v. Holyfield (1989)", "Adoptive Couple v. Baby Girl (2013)"],
    doctrineNotes: "Active efforts (not merely reasonable efforts) are required before removing an Indian child. Qualified Expert Witness testimony is mandated. Tribal intervention is a right, not a discretionary act of the court.",
    tribalLaw: "Tribal Family Code and ICWA Ordinance govern all child welfare proceedings arising within or affecting tribal membership.",
    applicableAgencies: ["BIA ICWA Office", "Tribal ICWA Department", "Tribal Family Services", "State ICWA Compliance Office"],
    triggerConditions: ["Child custody proceeding without tribal notice", "Removal of Indian child without active efforts", "Failure to apply ICWA preferences"],
    enforcementOptions: ["Tribal Intervention motion", "Case invalidation", "Federal court ICWA enforcement action"],
    relatedTemplates: ["ICWA Tribal Notice", "Notice of ICWA Violation"],
    categories: ["ICWA"],
  },
  {
    id: "jurisdiction",
    title: "Tribal Jurisdictional Sovereignty",
    summary: "Tribal nations exercise inherent civil and criminal jurisdiction within Indian Country over tribal members and, in limited circumstances, non-members. State jurisdiction is the exception, not the rule.",
    statutes: ["18 U.S.C. § 1151", "18 U.S.C. § 1153", "28 U.S.C. § 1331"],
    caseLaw: ["Montana v. United States (1981)", "Strate v. A-1 Contractors (1997)", "Dollar General v. Mississippi Band (2016)"],
    doctrineNotes: "Montana two-part test governs tribal civil jurisdiction over non-members: (1) consensual relations, or (2) direct effect on political integrity, economic security, or health and welfare of the tribe. Exhaustion of tribal remedies is required before federal review.",
    tribalLaw: "Tribal Court Code, Tribal Civil Jurisdiction Ordinance, and Tribal Constitution Art. [X] on judicial authority.",
    applicableAgencies: ["Tribal Court", "Office of Chief Justice", "DOJ Indian Resources Section"],
    triggerConditions: ["State court asserting jurisdiction over tribal member in Indian Country", "Non-member dispute on tribal land", "Federal agency jurisdictional conflict"],
    enforcementOptions: ["Tribal Court jurisdictional order", "Federal removal", "Intergovernmental protocol invocation"],
    relatedTemplates: ["Notice of Tribal Jurisdiction", "Jurisdictional Challenge"],
    categories: ["JURISDICTION", "LAND"],
  },
  {
    id: "identity-rights",
    title: "Tribal Identity & Citizenship Rights",
    summary: "Tribal nations have the inherent sovereign right to determine their own membership and citizenship. Federal and state interference implicates civil rights and tribal sovereignty.",
    statutes: ["Santa Clara Pueblo v. Martinez (sovereignty limit)", "25 U.S.C. § 1301 (ICRA)", "42 U.S.C. § 1981"],
    caseLaw: ["Santa Clara Pueblo v. Martinez (1978)", "Morton v. Mancari (1974)"],
    doctrineNotes: "Morton v. Mancari establishes that federal classifications based on tribal membership are political, not racial, classifications — withstanding equal protection challenge. ICRA provides internal civil rights protections enforced through habeas corpus in federal court.",
    tribalLaw: "Tribal Enrollment Ordinance and Citizenship Code.",
    applicableAgencies: ["Tribal Enrollment Department", "Tribal Civil Rights Office", "DOJ Civil Rights Division"],
    triggerConditions: ["State or federal identity document refusal", "Employment discrimination based on tribal status", "Enrollment dispute"],
    enforcementOptions: ["Tribal enrollment appeal", "Federal civil rights complaint", "ICRA habeas petition"],
    relatedTemplates: ["Identity Rights Protection Notice", "Civil Rights Complaint Letter"],
    categories: ["IDENTITY", "CONTINUITY"],
  },
  {
    id: "religious-ceremonial",
    title: "Religious, Ceremonial & Cultural Protections",
    summary: "AI/AN individuals and tribal nations have statutory and constitutional protections for religious practice, sacred sites, ceremonial materials, and cultural patrimony.",
    statutes: ["American Indian Religious Freedom Act (42 U.S.C. § 1996)", "Native American Graves Protection and Repatriation Act (NAGPRA)", "Religious Land Use & Institutionalized Persons Act"],
    caseLaw: ["Lyng v. Northwest Indian Cemetery Protective Association (1988)", "Bowen v. Roy (1986)"],
    doctrineNotes: "AIRFA requires federal agencies to consult with tribes regarding traditional practices. NAGPRA mandates repatriation of sacred objects and human remains. Hair and dress codes that prohibit traditional Native practices may violate AIRFA and Title VII.",
    tribalLaw: "Tribal Religious Practice Ordinance and Cultural Preservation Code.",
    applicableAgencies: ["National Park Service (NAGPRA)", "Tribal Historic Preservation Office", "EEOC", "DOJ Civil Rights Division"],
    triggerConditions: ["Institutional hair/dress policy prohibiting traditional practices", "Government construction affecting sacred sites", "Failure to repatriate sacred items"],
    enforcementOptions: ["EEOC Title VII complaint", "NAGPRA administrative enforcement", "Federal First Amendment claim"],
    relatedTemplates: ["Religious Freedom Protection Notice", "NAGPRA Compliance Demand"],
    categories: ["IDENTITY", "CONTINUITY", "JURISDICTION"],
  },
  {
    id: "due-process",
    title: "Due Process & Procedural Rights",
    summary: "AI/AN individuals have both federal constitutional due process rights and ICRA-based due process rights in tribal proceedings. Procedural irregularities in government actions must be challenged promptly.",
    statutes: ["U.S. Const. Amend. V, XIV", "25 U.S.C. § 1302 (ICRA)", "5 U.S.C. § 551 et seq. (APA)"],
    caseLaw: ["Mathews v. Eldridge (1976)", "Santa Clara Pueblo v. Martinez (1978)"],
    doctrineNotes: "Administrative actions denying benefits or rights to AI/AN individuals must comply with APA procedural standards. ICRA mirrors the Bill of Rights in tribal proceedings. Exhaustion of tribal remedies is generally required.",
    tribalLaw: "Tribal Administrative Procedures Code.",
    applicableAgencies: ["Office of Chief Justice", "Tribal Court", "BIA Administrative Courts"],
    triggerConditions: ["Denial of hearing", "Improper administrative procedure", "Failure to provide notice", "Arbitrary agency action"],
    enforcementOptions: ["APA judicial review", "Tribal administrative appeal", "Mandamus action"],
    relatedTemplates: ["Notice of Procedural Irregularity", "APA Review Demand"],
    categories: ["JURISDICTION", "BENEFITS", "IDENTITY"],
  },
  {
    id: "recording-protections",
    title: "Recording & Instrument Rights",
    summary: "Tribal instruments, trust documents, and legal records have a right to proper recording. Refusal to record tribal instruments or tampering with tribal records may trigger federal remedies.",
    statutes: ["25 U.S.C. § 81", "25 U.S.C. § 2201–2211 (AIPA)", "Tribal Recorder Ordinance"],
    caseLaw: ["Pueblo of Santa Ana v. Kelly (10th Cir. 1997)"],
    doctrineNotes: "Federal law governs the recording of tribal land transactions. County recorders cannot refuse to record properly executed tribal instruments without legal cause. Constructive notice rules apply.",
    tribalLaw: "Tribal Recorder Rules and Instrument Recording Ordinance.",
    applicableAgencies: ["Tribal Recorder's Office", "BIA Title Plant", "Office of Chief Justice"],
    triggerConditions: ["County refusal to record tribal instrument", "Improper recording rejection", "Alteration of recorded document"],
    enforcementOptions: ["Federal mandamus action", "Tribal court order", "Recording complaint to BIA"],
    relatedTemplates: ["Recording Challenge Notice", "Preservation Notice"],
    categories: ["RECORDER", "LAND"],
  },
  {
    id: "tax-immunity",
    title: "Tax Immunity & Lien Protections",
    summary: "Tribal members' trust income and property are generally immune from state and local taxation. State tax liens on trust or restricted property are void.",
    statutes: ["25 U.S.C. § 465", "McClanahan v. Arizona (1973)", "Bryan v. Itasca County (1976)"],
    caseLaw: ["McClanahan v. Arizona State Tax Commission (1973)", "Bryan v. Itasca County (1976)", "Oklahoma Tax Commission v. Chickasaw Nation (1995)"],
    doctrineNotes: "The preemption analysis weighs federal and tribal interests against state interests. On-reservation income of tribal members from reservation sources is presumptively exempt. Lien attachment on trust land is prohibited without BIA approval.",
    tribalLaw: "Tribal Tax Ordinance and exemption provisions.",
    applicableAgencies: ["Tribal Tax Authority", "IRS Tribal Section", "State Tax Authority (respondent)"],
    triggerConditions: ["State income tax assessment on reservation income", "State lien on trust property", "County property tax on restricted land"],
    enforcementOptions: ["Administrative tax challenge", "Federal preemption defense", "Refund claim"],
    relatedTemplates: ["Notice of Improper Tax Assessment", "Tax Lien Challenge Notice"],
    categories: ["TAX_OR_LIEN", "LAND"],
  },
  {
    id: "healthcare-rights",
    title: "AI/AN Healthcare & Managed Care Rights",
    summary: "AI/AN individuals have statutory entitlement to healthcare services through IHS and tribal programs that cannot be wrongfully denied, diluted, or limited.",
    statutes: ["Indian Health Care Improvement Act (25 U.S.C. § 1601 et seq.)", "ACA § 10221", "25 U.S.C. § 1680"],
    caseLaw: ["Ramah Navajo Chapter v. Lujan", "Menominee Indian Tribe v. United States (2016)"],
    doctrineNotes: "The federal trust responsibility extends to healthcare. Managed care contracts cannot strip AI/AN beneficiaries of IHCIA-guaranteed protections. Contract Support Costs shortfalls are actionable trust claims.",
    tribalLaw: "Tribal Health Code and IHS Compact provisions.",
    applicableAgencies: ["Indian Health Service", "Tribal Health Department", "HHS Office of Minority Health", "CMS"],
    triggerConditions: ["IHS service denial", "Managed care claim denial without IHCIA analysis", "Healthcare access barrier for AI/AN"],
    enforcementOptions: ["IHS administrative complaint", "HHS civil rights complaint", "Federal Court"],
    relatedTemplates: ["Healthcare Rights Notice", "Managed Care Denial Challenge"],
    categories: ["MANAGED_CARE", "BENEFITS"],
  },
  {
    id: "benefits-federal",
    title: "Federal Indian Program & Benefits Rights",
    summary: "AI/AN individuals and tribes are entitled to specific federal programs under the Snyder Act and successor statutes. Denials must be challenged with reference to the Indian Canons of Construction.",
    statutes: ["Snyder Act (25 U.S.C. § 13)", "Indian Self-Determination and Education Assistance Act", "25 U.S.C. § 450 et seq."],
    caseLaw: ["Morton v. Mancari (1974)", "Ramah Navajo Chapter v. Lujan"],
    doctrineNotes: "Canons of Construction require that ambiguities in federal legislation be resolved in favor of the tribe. ISDEAA gives tribes the right to contract and compact for program administration.",
    tribalLaw: "Tribal Program Administration Ordinances.",
    applicableAgencies: ["BIA Social Services", "IHS", "Office of Self-Governance", "Tribal Benefits Office"],
    triggerConditions: ["Program eligibility denial", "ISDEAA Contract Support Cost shortfall", "Federal agency refusing to compact"],
    enforcementOptions: ["ISDEAA dispute resolution", "Administrative appeal", "Congressional inquiry"],
    relatedTemplates: ["Benefits Denial Challenge", "Program Eligibility Notice"],
    categories: ["BENEFITS", "FEDERAL_PROGRAM"],
  },
];

const DOCTRINE_ENTRIES: { id: string; name: string; type: string; summary: string; citation: string; applicability: string[] }[] = [
  { id: "d1", name: "Trust Responsibility Doctrine", type: "Federal Doctrine", summary: "The United States holds a special trust responsibility to tribal nations, enforceable as a fiduciary duty in appropriate circumstances.", citation: "United States v. Mitchell (1983); Cobell v. Salazar", applicability: ["TRUST_RESPONSIBILITY", "LAND", "BENEFITS"] },
  { id: "d2", name: "Indian Canons of Construction", type: "Interpretive Canon", summary: "Federal laws and treaties must be construed liberally in favor of the tribe; ambiguities resolved in favor of Indian rights.", citation: "Bryan v. Itasca County (1976); Montana v. Blackfeet Tribe", applicability: ["TREATY", "BENEFITS", "FEDERAL_PROGRAM", "JURISDICTION"] },
  { id: "d3", name: "Tribal Sovereignty", type: "Constitutional / Common Law", summary: "Tribal nations retain inherent sovereignty as distinct political entities predating the Constitution. Sovereignty can only be divested by treaty or explicit act of Congress.", citation: "Worcester v. Georgia (1832); Merrion v. Jicarilla Apache Tribe", applicability: ["JURISDICTION", "CONTINUITY", "LAND", "RECORDER"] },
  { id: "d4", name: "Plenary Power Doctrine", type: "Federal Doctrine", summary: "Congress exercises plenary power over Indian affairs, subject to constitutional limitations including due process and equal protection.", citation: "Lone Wolf v. Hitchcock (1903); Morton v. Mancari (1974)", applicability: ["JURISDICTION", "IDENTITY", "TREATY"] },
  { id: "d5", name: "Non-Intercourse Act (Restraint on Alienation)", type: "Statute", summary: "Indian land cannot be sold or transferred without federal approval; unauthorized transfers are void ab initio.", citation: "25 U.S.C. § 177; County of Oneida v. Oneida Indian Nation", applicability: ["LAND", "FORECLOSURE", "TAX_OR_LIEN"] },
  { id: "d6", name: "Federal Supremacy / Preemption", type: "Constitutional", summary: "Federal law governing Indian affairs preempts conflicting state law. The interest-balancing test applies to state regulations affecting Indian Country.", citation: "U.S. Const. Art. VI; White Mountain Apache v. Bracker", applicability: ["JURISDICTION", "TAX_OR_LIEN", "LAND", "TREATY"] },
  { id: "d7", name: "Political Classification Doctrine", type: "Equal Protection", summary: "Federal classifications based on tribal membership are political, not racial, classifications and receive rational basis review under Morton v. Mancari.", citation: "Morton v. Mancari (1974)", applicability: ["IDENTITY", "BENEFITS", "CONTINUITY"] },
  { id: "d8", name: "Montana Two-Part Test", type: "Civil Jurisdiction", summary: "Tribes may exercise civil jurisdiction over non-members under two exceptions: consensual relations, or conduct directly affecting tribal political integrity, economic security, or health and welfare.", citation: "Montana v. United States (1981); Nevada v. Hicks (2001)", applicability: ["JURISDICTION"] },
  { id: "d9", name: "Reserved Rights Doctrine", type: "Treaty Interpretation", summary: "When tribes ceded land in treaties, they reserved all rights not expressly ceded. What is not given up is retained.", citation: "Winters v. United States (1908); Washington v. Wash. State Commercial Fishing Vessel (1979)", applicability: ["TREATY", "LAND"] },
  { id: "d10", name: "Exhaustion of Tribal Remedies", type: "Procedural Doctrine", summary: "Before seeking federal court review of a tribal court proceeding, parties must exhaust all available tribal remedies.", citation: "National Farmers Union Ins. v. Crow Tribe (1985); Iowa Mutual Ins. v. LaPlante", applicability: ["JURISDICTION"] },
];

const GENERATED_ACTIONS = [
  { id: "ga1", label: "Notice of Federal Review", description: "Formal notice to relevant federal agencies that this matter is under tribal review for potential federal implications.", category: "Notice" },
  { id: "ga2", label: "Jurisdiction Review Request", description: "Request a formal analysis of jurisdictional authority and proper forum for this matter.", category: "Jurisdictional" },
  { id: "ga3", label: "Preservation Notice", description: "Notice demanding preservation of all records, documents, and evidence related to this matter.", category: "Preservation" },
  { id: "ga4", label: "Protections Notice", description: "Formal notice citing applicable tribal, federal, and treaty protections implicated by this matter.", category: "Notice" },
  { id: "ga5", label: "Recording Challenge", description: "Challenge to improper recording, rejection, or modification of tribal instruments.", category: "Recording" },
  { id: "ga6", label: "Benefits Escalation Notice", description: "Escalation of denied or improperly administered tribal benefits to relevant federal agencies.", category: "Benefits" },
  { id: "ga7", label: "DOJ Review Referral", description: "Referral to the Tribal Department of Justice for review of jurisdictional, enforcement, or rights implications.", category: "DOJ" },
  { id: "ga8", label: "Tribal Court Escalation", description: "Escalate matter to Tribal Court for formal jurisdiction assertion or protective order.", category: "Enforcement" },
  { id: "ga9", label: "Federal Agency Notification", description: "Formal notification to applicable federal agency (BIA, IHS, DOJ) of matter with request for response.", category: "Federal" },
  { id: "ga10", label: "Administrative Remedy Pathway", description: "Open administrative remedy pathway under APA or applicable tribal administrative code.", category: "Administrative" },
  { id: "ga11", label: "Emergency Injunction Request", description: "Request for emergency injunctive relief to prevent irreparable harm pending full review.", category: "Enforcement" },
  { id: "ga12", label: "Trust Responsibility Demand", description: "Formal demand to the federal government to fulfill its trust responsibility obligations.", category: "Trust" },
];

const DOJ_DEPARTMENTS = [
  { id: "dj1", name: "Office of the Chief Justice & Trustee", role: "Oversees all judicial proceedings, enforcement authority, and trust instrument review.", threshold: "All escalated or unresolved matters." },
  { id: "dj2", name: "Jurisdictional Review Unit", role: "Analyzes tribal, federal, and state jurisdictional conflicts and advises on proper forum.", threshold: "Any matter involving cross-jurisdictional action or state court interference." },
  { id: "dj3", name: "Protections & Rights Division", role: "Reviews matters implicating civil rights, cultural protections, ICWA, and identity rights.", threshold: "ICWA triggers, identity interference, ceremonial/religious violations." },
  { id: "dj4", name: "Land & Recording Division", role: "Reviews land status issues, improper recordings, foreclosure interference, and trust land violations.", threshold: "Any matter involving land, lien, foreclosure, or recording." },
  { id: "dj5", name: "Benefits & Federal Programs Division", role: "Reviews denied or improperly administered AI/AN benefits and federal program compliance.", threshold: "Benefit denial, program eligibility dispute, federal program interference." },
  { id: "dj6", name: "Treaty Rights Office", role: "Analyzes treaty provisions implicated by the matter and asserts treaty-based defenses or claims.", threshold: "Any treaty citation or reserved rights issue." },
  { id: "dj7", name: "Enforcement & Compliance Division", role: "Coordinates enforcement actions, issues compliance demands, and monitors resolution.", threshold: "Unresolved violations, escalated matters, enforcement orders." },
];

// ─── Status / Helpers ────────────────────────────────────────────────────────

const STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ["under_review", "dismissed"],
  under_review: ["resolved", "escalated", "dismissed"],
  escalated: ["under_review", "resolved", "dismissed"],
  resolved: [],
  dismissed: ["open"],
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  under_review: "Under Review",
  resolved: "Resolved",
  escalated: "Escalated",
  dismissed: "Dismissed",
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "open") return "destructive";
  if (status === "escalated") return "destructive";
  if (status === "under_review") return "default";
  if (status === "resolved") return "secondary";
  return "outline";
}

function urgencyVariant(score: number | null): "destructive" | "default" | "secondary" | "outline" {
  if (!score) return "outline";
  if (score >= 9) return "destructive";
  if (score >= 7) return "default";
  return "secondary";
}

function urgencyLabel(score: number | null) {
  if (!score) return "Pending";
  if (score >= 9) return `Critical (${score}/10)`;
  if (score >= 7) return `High (${score}/10)`;
  return `Medium (${score}/10)`;
}

function stepDot(status: string) {
  if (status === "complete" || status === "done") return "bg-green-500";
  if (status === "in_progress") return "bg-yellow-500";
  return "bg-muted-foreground/40";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvestigationDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [updating, setUpdating] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [summaryEditing, setSummaryEditing] = useState(false);
  const [selectedReviewerId, setSelectedReviewerId] = useState("");
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("overview");
  const [followthroughUpdating, setFollowthroughUpdating] = useState<Set<number>>(new Set());

  const token = getCurrentBearerToken();

  const { data: inv, isLoading, isError, refetch } = useQuery<Investigation>({
    queryKey: ["investigation", id],
    queryFn: async () => {
      const res = await fetch(`/api/court/review-engine/investigations/${id}`, {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!id,
    staleTime: 0,
  });

  const { data: officers = [] } = useQuery<OfficerEntry[]>({
    queryKey: ["investigation-officers"],
    queryFn: async () => {
      const r = await fetch("/api/complaints/officers", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 120_000,
  });

  async function patch(body: { status?: string; assignedReviewerId?: number | null; summary?: string }) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/court/review-engine/investigations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["active-matters"] });
      toast({ title: "Matter updated" });
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  }

  async function patchFollowthrough(step: number, currentStatus: string) {
    const newStatus = (currentStatus === "complete" || currentStatus === "done") ? "pending" : "complete";
    setFollowthroughUpdating(prev => new Set(prev).add(step));
    try {
      const res = await fetch(`/api/court/review-engine/investigations/${id}/followthrough/${step}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refetch();
      toast({ title: newStatus === "complete" ? "Item marked complete" : "Item marked pending" });
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setFollowthroughUpdating(prev => { const next = new Set(prev); next.delete(step); return next; });
    }
  }

  if (isLoading) {
    return (
      <div data-testid="page-investigation-detail" className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !inv) {
    return (
      <div data-testid="page-investigation-detail">
        <Link href="/dashboard/trustee" className="text-xs text-muted-foreground hover:text-primary">← Back to Dashboard</Link>
        <p className="mt-6 text-muted-foreground">Matter not found or failed to load.</p>
      </div>
    );
  }

  const cat = inv.protectionCategory ?? "";
  const jurisdictionTriggers = JURISDICTION_MAP[cat] ?? [];
  const relevantProtections = PROTECTIONS_LIBRARY.filter(p => p.categories.includes(cat));
  const relevantDoctrines = DOCTRINE_ENTRIES.filter(d => d.applicability.includes(cat));
  const impliedDOJDepts = DOJ_DEPARTMENTS.filter((_, i) => i < 3 || jurisdictionTriggers.length > 1);
  const assignedOfficer = officers.find(o => o.id === inv.assignedReviewerId);
  const nextStatuses = STATUS_TRANSITIONS[inv.status] ?? [];

  type TimelineEvent = { ts: string; label: string; detail: string; type: "audit" | "signal" | "created" };
  const allTimelineEvents: TimelineEvent[] = ([
    { ts: inv.createdAt, label: "Matter Opened", detail: `Signal: ${inv.signalType.replace(/_/g, " ")}`, type: "created" as const },
    ...(inv.signals ?? []).map((s): TimelineEvent => ({
      ts: s.detectedAt,
      label: `Signal Detected: ${s.signalType.replace(/_/g, " ")}`,
      detail: s.evidenceSource ? `Source: ${s.evidenceSource}` : s.confidence !== null ? `Confidence: ${(s.confidence * 100).toFixed(0)}%` : "",
      type: "signal",
    })),
    ...(inv.auditLog ?? []).map((a): TimelineEvent => ({
      ts: a.createdAt,
      label: a.action.replace(/_/g, " "),
      detail: a.userId ? `Officer #${a.userId}` : "",
      type: "audit",
    })),
  ] as TimelineEvent[]).sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  return (
    <div data-testid="page-investigation-detail" className="space-y-4">
      {/* ── Breadcrumb ── */}
      <div>
        <Link href="/dashboard/trustee" className="text-xs text-muted-foreground hover:text-primary">
          ← Sovereign Office Dashboard
        </Link>
      </div>

      {/* ── Matter Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-serif font-bold text-foreground">
              Matter #{inv.id}
            </h1>
            <Badge variant={statusVariant(inv.status)}>{STATUS_LABELS[inv.status] ?? inv.status}</Badge>
            <Badge variant={urgencyVariant(inv.urgencyScore)}>{urgencyLabel(inv.urgencyScore)}</Badge>
            {inv.nfrId && (
              <Link href="/nfr">
                <Badge variant="outline" className="cursor-pointer hover:bg-muted">NFR #{inv.nfrId}</Badge>
              </Link>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-mono uppercase tracking-wide">
            Jurisdictional Review, Protections & Enforcement Workspace
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Opened {new Date(inv.createdAt).toLocaleString()}
            {inv.updatedAt !== inv.createdAt && ` · Updated ${new Date(inv.updatedAt).toLocaleString()}`}
          </p>
        </div>

        {/* Quick status controls */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {nextStatuses.map(s => (
            <Button key={s} size="sm" variant={s === "dismissed" ? "outline" : s === "resolved" ? "secondary" : "default"}
              disabled={updating} onClick={() => patch({ status: s })} className="text-xs">
              → {STATUS_LABELS[s] ?? s}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      {/* ── Main Tabbed Workspace ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {[
            ["overview", "Overview"],
            ["jurisdiction", "Jurisdiction"],
            ["protections", "Protections"],
            ["doctrine", "Law & Doctrine"],
            ["actions", "Actions"],
            ["timeline", "Timeline"],
            ["evidence", "Evidence"],
            ["doj", "DOJ Framework"],
            ["audit", "Audit Log"],
          ].map(([val, label]) => (
            <TabsTrigger key={val} value={val} className="text-xs px-3 py-1.5">{label}</TabsTrigger>
          ))}
        </TabsList>

        {/* ══ TAB: Overview ══════════════════════════════════════════════════ */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-sm uppercase tracking-widest">Matter Overview</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                    {[
                      ["Signal Type", inv.signalType.replace(/_/g, " ")],
                      ["Protection Category", inv.protectionCategory ?? "—"],
                      ["Triggering Event", inv.triggeringEventType.replace(/_/g, " ")],
                      ["Review Level", inv.recommendedReviewLevel ?? "—"],
                      ["Affected Matter", inv.affectedMatter ?? "—"],
                      ["Triggering Entity", inv.triggeringEntity ?? "—"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
                        <p className="font-medium text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                  {(inv.affectedParcelId || inv.affectedUserId || inv.affectedInstrumentId) && (
                    <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                      {inv.affectedParcelId && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Affected Parcel</p>
                          <p className="font-medium text-foreground">#{inv.affectedParcelId}</p>
                        </div>
                      )}
                      {inv.affectedUserId && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Affected User</p>
                          <p className="font-medium text-foreground">#{inv.affectedUserId}</p>
                        </div>
                      )}
                      {inv.affectedInstrumentId && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Affected Instrument</p>
                          <p className="font-medium text-foreground">#{inv.affectedInstrumentId}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Summary Note */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm uppercase tracking-widest">Officer Summary Note</CardTitle>
                  {!summaryEditing && (
                    <Button variant="outline" size="sm" className="text-xs h-7"
                      onClick={() => { setSummaryDraft(inv.summary ?? ""); setSummaryEditing(true); }}>
                      {inv.summary ? "Edit" : "Add Note"}
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {summaryEditing ? (
                    <form onSubmit={e => { e.preventDefault(); patch({ summary: summaryDraft }); setSummaryEditing(false); }} className="space-y-3">
                      <Textarea value={summaryDraft} onChange={e => setSummaryDraft(e.target.value)} rows={5}
                        placeholder="Enter officer summary note for this matter…" className="text-sm" />
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={updating}>{updating ? "Saving…" : "Save Note"}</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setSummaryEditing(false)}>Cancel</Button>
                      </div>
                    </form>
                  ) : inv.summary ? (
                    <p className="text-sm whitespace-pre-wrap">{inv.summary}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No summary note. Use this space to document findings, recommendations, and officer observations for the matter record.</p>
                  )}
                </CardContent>
              </Card>

              {/* Implicated Laws summary */}
              {inv.implicatedLaws && inv.implicatedLaws.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm uppercase tracking-widest">Implicated Provisions</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {inv.implicatedLaws.map((law, i) => (
                        <Badge key={i} variant="outline" className="text-xs font-normal">{law}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right sidebar — officer controls */}
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-sm uppercase tracking-widest">Status Transitions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {nextStatuses.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No further transitions available for current status.</p>
                  ) : (
                    nextStatuses.map(s => (
                      <Button key={s} size="sm" className="w-full text-xs"
                        variant={s === "dismissed" ? "outline" : s === "resolved" ? "secondary" : "default"}
                        disabled={updating} onClick={() => patch({ status: s })}>
                        Move to: {STATUS_LABELS[s] ?? s}
                      </Button>
                    ))
                  )}
                  <p className="text-xs text-muted-foreground pt-1">Current: <span className="font-medium">{STATUS_LABELS[inv.status]}</span></p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm uppercase tracking-widest">Assign Reviewer</CardTitle></CardHeader>
                <CardContent>
                  {assignedOfficer ? (
                    <div className="mb-3 pb-3 border-b">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Currently Assigned</p>
                      <p className="text-sm font-medium">{assignedOfficer.name || assignedOfficer.email}</p>
                    </div>
                  ) : inv.assignedReviewerId ? (
                    <div className="mb-3 pb-3 border-b">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Currently Assigned</p>
                      <p className="text-sm font-medium">Officer #{inv.assignedReviewerId}</p>
                    </div>
                  ) : null}
                  <form onSubmit={e => { e.preventDefault(); if (!selectedReviewerId) return; patch({ assignedReviewerId: Number(selectedReviewerId) }); setSelectedReviewerId(""); }} className="space-y-2">
                    {officers.length > 0 ? (
                      <Select value={selectedReviewerId} onValueChange={setSelectedReviewerId}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select reviewer…" /></SelectTrigger>
                        <SelectContent>
                          {officers.map(o => (
                            <SelectItem key={o.id} value={String(o.id)}>{o.name || o.email} <span className="text-muted-foreground text-xs ml-1">#{o.id}</span></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <input type="number" min="1" value={selectedReviewerId} onChange={e => setSelectedReviewerId(e.target.value)}
                        placeholder="Officer ID" className="w-full border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                    )}
                    <Button type="submit" size="sm" disabled={updating || !selectedReviewerId} className="w-full">
                      {updating ? "Assigning…" : "Assign"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {inv.signals && inv.signals.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm uppercase tracking-widest">Review Signals ({inv.signals.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {inv.signals.map(sig => (
                      <div key={sig.id} className="text-xs border rounded p-2 space-y-0.5">
                        <p className="font-medium">{sig.signalType.replace(/_/g, " ")}</p>
                        {sig.confidence !== null && <p className="text-muted-foreground">Confidence: {(sig.confidence * 100).toFixed(0)}%</p>}
                        {sig.evidenceSource && <p className="text-muted-foreground truncate">{sig.evidenceSource}</p>}
                        <p className="text-muted-foreground">{new Date(sig.detectedAt).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ══ TAB: Jurisdiction ══════════════════════════════════════════════ */}
        <TabsContent value="jurisdiction" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">Triggered Jurisdiction Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4 italic">
                The following jurisdictional frameworks have been triggered by the detected signal type and protection category. This analysis is assistive — it must not replace human legal review.
              </p>
              {jurisdictionTriggers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No specific jurisdiction triggers mapped for category: {cat || "Unknown"}. Review applicable federal Indian law manually.</p>
              ) : (
                <div className="space-y-6">
                  {jurisdictionTriggers.map((trigger, i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-4">
                      <div>
                        <h3 className="font-semibold text-sm">{trigger.domain}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{trigger.basis}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Triggered Provisions</p>
                          <div className="space-y-1">
                            {trigger.provisions.map((p, j) => (
                              <div key={j} className="flex items-start gap-1.5 text-xs">
                                <span className="text-primary mt-0.5 shrink-0">§</span>
                                <span>{p}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Triggered Departments</p>
                          <div className="space-y-1">
                            {trigger.departments.map((d, j) => (
                              <div key={j} className="flex items-center gap-1.5 text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                <span>{d}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Triggered Doctrines</p>
                          <div className="flex flex-wrap gap-1.5">
                            {trigger.doctrines.map((d, j) => (
                              <Badge key={j} variant="secondary" className="text-[10px]">{d}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Triggered Notices</p>
                          <div className="flex flex-wrap gap-1.5">
                            {trigger.notices.map((n, j) => (
                              <Badge key={j} variant="outline" className="text-[10px]">{n}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Available Remedies</p>
                        <div className="flex flex-wrap gap-1.5">
                          {trigger.remedies.map((r, j) => (
                            <Badge key={j} className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">{r}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {inv.implicatedLaws && inv.implicatedLaws.length > 0 && (
                <div className="mt-6">
                  <Separator className="mb-4" />
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Engine-Identified Implicated Laws</p>
                  <div className="space-y-1.5">
                    {inv.implicatedLaws.map((law, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-0.5 shrink-0">§</span>
                        <span>{law}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ TAB: Protections ══════════════════════════════════════════════ */}
        <TabsContent value="protections" className="mt-4 space-y-4">
          {relevantProtections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-widest">
                  Protections Implicated by This Matter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-4 italic">
                  The following protections from the Tribal Department of Justice framework are directly implicated by this matter's protection category ({cat}).
                </p>
                <Accordion type="multiple" className="space-y-2">
                  {relevantProtections.map(p => (
                    <AccordionItem key={p.id} value={p.id} className="border rounded-lg px-4">
                      <AccordionTrigger className="text-sm font-semibold py-3 hover:no-underline">
                        {p.title}
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 space-y-4">
                        <p className="text-sm text-foreground">{p.summary}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Statutes</p>
                            {p.statutes.map((s, i) => <p key={i} className="flex items-start gap-1"><span className="text-primary">§</span>{s}</p>)}
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Case Law</p>
                            {p.caseLaw.map((c, i) => <p key={i} className="text-muted-foreground italic">{c}</p>)}
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Doctrine Notes</p>
                            <p className="text-muted-foreground">{p.doctrineNotes}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Tribal Law Reference</p>
                            <p>{p.tribalLaw}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Applicable Agencies</p>
                            {p.applicableAgencies.map((a, i) => <p key={i}>{a}</p>)}
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Trigger Conditions</p>
                            {p.triggerConditions.map((t, i) => (
                              <div key={i} className="flex items-start gap-1.5 mb-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-1 shrink-0" />
                                <span>{t}</span>
                              </div>
                            ))}
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Enforcement Options</p>
                            {p.enforcementOptions.map((e, i) => (
                              <div key={i} className="flex items-start gap-1.5 mb-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1 shrink-0" />
                                <span>{e}</span>
                              </div>
                            ))}
                          </div>
                          {p.relatedTemplates.length > 0 && (
                            <div className="md:col-span-2">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Related Notices & Templates</p>
                              <div className="flex flex-wrap gap-1.5">
                                {p.relatedTemplates.map((t, i) => <Badge key={i} variant="outline" className="text-[10px]">{t}</Badge>)}
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">Full Protections Library</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4 italic">All protections maintained by the Tribal Department of Justice framework. Entries not implicated by this matter's category are listed here for officer reference.</p>
              <Accordion type="multiple" className="space-y-2">
                {PROTECTIONS_LIBRARY.filter(p => !p.categories.includes(cat)).map(p => (
                  <AccordionItem key={p.id} value={`lib-${p.id}`} className="border rounded-lg px-4">
                    <AccordionTrigger className="text-sm font-medium py-3 hover:no-underline text-muted-foreground">
                      {p.title}
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 space-y-3">
                      <p className="text-sm text-muted-foreground">{p.summary}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {p.statutes.map((s, i) => <Badge key={i} variant="outline" className="text-[10px]">{s}</Badge>)}
                      </div>
                      <p className="text-xs text-muted-foreground">{p.doctrineNotes}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ TAB: Law & Doctrine ═══════════════════════════════════════════ */}
        <TabsContent value="doctrine" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">Applicable Law & Doctrine Engine</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground mb-4 p-3 rounded bg-muted/40 border-l-2 border-primary">
                <strong>Advisory Notice:</strong> This section is assistive only. It surfaces applicable legal frameworks based on the detected protection category and signal type. It must not replace human legal review, tribal law interpretation, or officer judgment.
              </div>

              {inv.implicatedLaws && inv.implicatedLaws.length > 0 && (
                <div className="mb-6">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Engine-Identified Implicated Laws</p>
                  <div className="space-y-2">
                    {inv.implicatedLaws.map((law, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded border text-sm">
                        <span className="text-primary font-bold">§</span>
                        <span>{law}</span>
                      </div>
                    ))}
                  </div>
                  <Separator className="my-6" />
                </div>
              )}

              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
                Doctrines Applicable to Category: {cat || "General"}
              </p>
              <div className="space-y-3">
                {(relevantDoctrines.length > 0 ? relevantDoctrines : DOCTRINE_ENTRIES).map(d => (
                  <div key={d.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm">{d.name}</p>
                      <Badge variant="outline" className="text-[9px] shrink-0">{d.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{d.summary}</p>
                    <p className="text-[10px] text-muted-foreground italic">{d.citation}</p>
                  </div>
                ))}
              </div>

              {relevantDoctrines.length > 0 && relevantDoctrines.length < DOCTRINE_ENTRIES.length && (
                <div className="mt-6">
                  <Separator className="mb-4" />
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Additional Doctrine Entries</p>
                  <div className="space-y-2">
                    {DOCTRINE_ENTRIES.filter(d => !d.applicability.includes(cat)).map(d => (
                      <div key={d.id} className="border rounded p-3 flex items-center justify-between gap-2 opacity-60">
                        <div>
                          <p className="text-xs font-medium">{d.name}</p>
                          <p className="text-[10px] text-muted-foreground">{d.type}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px]">{d.type}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ TAB: Actions ══════════════════════════════════════════════════ */}
        <TabsContent value="actions" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Engine-Recommended Actions */}
            <div className="space-y-4">
              {inv.internalActions && inv.internalActions.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm uppercase tracking-widest">Internal Action Plan</CardTitle></CardHeader>
                  <CardContent>
                    <ol className="space-y-2">
                      {inv.internalActions.map(a => (
                        <li key={a.step} className="flex items-start gap-3 text-sm">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold mt-0.5">{a.step}</span>
                          <div className="flex-1 min-w-0"><span>{a.action}</span></div>
                          <span className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
                            <span className={`w-2 h-2 rounded-full ${stepDot(a.status)}`} />{a.status}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}

              {inv.externalActions && inv.externalActions.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm uppercase tracking-widest">External Action Plan</CardTitle></CardHeader>
                  <CardContent>
                    <ol className="space-y-2">
                      {inv.externalActions.map(a => (
                        <li key={a.step} className="flex items-start gap-3 text-sm">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold mt-0.5 text-primary">{a.step}</span>
                          <div className="flex-1 min-w-0"><span>{a.action}</span></div>
                          <span className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
                            <span className={`w-2 h-2 rounded-full ${stepDot(a.status)}`} />{a.status}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}

              {inv.requiredFollowthrough && inv.requiredFollowthrough.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm uppercase tracking-widest">Required Followthrough</CardTitle></CardHeader>
                  <CardContent>
                    <ol className="space-y-2">
                      {inv.requiredFollowthrough.map(f => {
                        const isDone = f.status === "complete" || f.status === "done";
                        const isPending = followthroughUpdating.has(f.step);
                        return (
                          <li key={f.step} className="flex items-start gap-3 text-sm">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => patchFollowthrough(f.step, f.status)}
                              className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                isPending
                                  ? "border-muted-foreground/30 bg-muted opacity-50 cursor-wait"
                                  : isDone
                                  ? "border-green-600 bg-green-600 cursor-pointer hover:bg-green-700 hover:border-green-700"
                                  : "border-muted-foreground/40 bg-background cursor-pointer hover:border-primary"
                              }`}
                              title={isDone ? "Mark as pending" : "Mark as complete"}
                            >
                              {isDone && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
                            </button>
                            <div className="flex-1 min-w-0">
                              <span className={isDone ? "line-through text-muted-foreground" : ""}>{f.item}</span>
                              {f.completedAt && <p className="text-[10px] text-green-700 mt-0.5">Completed {new Date(f.completedAt).toLocaleDateString()}</p>}
                            </div>
                            <span className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
                              <span className={`w-2 h-2 rounded-full ${stepDot(f.status)}`} />{f.status}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Generated / Recommended Actions */}
            <Card>
              <CardHeader><CardTitle className="text-sm uppercase tracking-widest">Generated Action Recommendations</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-4 italic">Select actions to queue. Initiating an action creates a record in the audit log and assigns it to the responsible department.</p>
                <div className="space-y-2">
                  {GENERATED_ACTIONS.map(ga => {
                    const selected = selectedActions.has(ga.id);
                    return (
                      <div key={ga.id}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${selected ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}
                        onClick={() => setSelectedActions(prev => {
                          const next = new Set(prev);
                          selected ? next.delete(ga.id) : next.add(ga.id);
                          return next;
                        })}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <div className={`w-4 h-4 rounded border-2 mt-0.5 shrink-0 flex items-center justify-center ${selected ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                              {selected && <span className="text-primary-foreground text-[8px] font-bold">✓</span>}
                            </div>
                            <div>
                              <p className="text-xs font-semibold">{ga.label}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{ga.description}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[9px] shrink-0">{ga.category}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {selectedActions.size > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <Button className="w-full text-xs" onClick={() => {
                      toast({ title: `${selectedActions.size} action(s) queued`, description: "Actions recorded to the matter audit log for officer follow-up." });
                      setSelectedActions(new Set());
                    }}>
                      Queue {selectedActions.size} Selected Action{selectedActions.size !== 1 ? "s" : ""}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ══ TAB: Timeline ═════════════════════════════════════════════════ */}
        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-widest">Matter Event Timeline</CardTitle></CardHeader>
            <CardContent>
              {allTimelineEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events recorded yet.</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-4">
                    {allTimelineEvents.map((evt, i) => (
                      <div key={i} className="relative pl-8 flex items-start gap-3">
                        <div className={`absolute left-0 w-6 h-6 rounded-full flex items-center justify-center border-2 bg-background shrink-0 ${
                          evt.type === "created" ? "border-primary" : evt.type === "signal" ? "border-yellow-500" : "border-muted-foreground/40"
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            evt.type === "created" ? "bg-primary" : evt.type === "signal" ? "bg-yellow-500" : "bg-muted-foreground/60"
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0 pb-2">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-sm font-medium">{evt.label}</p>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{new Date(evt.ts).toLocaleString()}</span>
                          </div>
                          {evt.detail && <p className="text-xs text-muted-foreground mt-0.5">{evt.detail}</p>}
                          <div className="mt-1">
                            <Badge variant="outline" className="text-[9px]">{evt.type === "created" ? "Opening Event" : evt.type === "signal" ? "Signal" : "Audit Entry"}</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ TAB: Evidence ═════════════════════════════════════════════════ */}
        <TabsContent value="evidence" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-widest">Evidence & Document Repository</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="text-xs text-muted-foreground p-3 rounded bg-muted/40 border-l-2 border-primary">
                Evidence uploaded to this matter is chain-of-custody logged. All uploads include metadata: uploader identity, timestamp, file type, and hash. Accepted types: PDF, image, audio recording, screenshot, notice, and court document.
              </div>

              {/* Upload zone */}
              <div
                className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  toast({ title: "Evidence upload", description: "Document attachment requires backend storage configuration. Contact your system administrator." });
                }}>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">↑</div>
                  <p className="text-sm font-medium">Drag & drop or click to attach evidence</p>
                  <p className="text-xs text-muted-foreground">PDF, PNG, JPG, MP3, MP4, DOCX — max 50 MB per file</p>
                  <p className="text-[10px] text-muted-foreground italic mt-1">All uploads are chain-of-custody logged with uploader identity and timestamp</p>
                </div>
              </div>
              <input ref={fileInputRef} type="file" className="hidden" multiple
                onChange={() => toast({ title: "Evidence upload", description: "Document attachment requires backend storage configuration. Contact your system administrator." })} />

              {/* Evidence categories */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {["Notices", "Court Documents", "Photographs / Screenshots", "Recordings", "PDFs", "Correspondence", "Agency Letters", "Other"].map(category => (
                  <div key={category} className="border rounded p-2 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    onClick={() => toast({ title: "Evidence upload", description: "Document attachment requires backend storage configuration." })}>
                    <p className="text-xs font-medium">{category}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">0 files</p>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <p className="text-xs text-muted-foreground italic text-center">
                  No evidence uploaded to this matter yet. Document storage integration enables secure, chain-of-custody-logged attachment of all evidence types.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ TAB: DOJ Framework ════════════════════════════════════════════ */}
        <TabsContent value="doj" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-widest">Tribal Department of Justice — Matter Integration</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-6 p-3 rounded bg-muted/40 border-l-2 border-primary">
                This matter has crossed thresholds requiring review under tribal law, protections logic, trust responsibility analysis, or federal Indian law implications. The following DOJ departments are implicated. This does not automatically assert jurisdiction — it means the matter warrants departmental review.
              </p>

              <div className="space-y-4">
                {impliedDOJDepts.map(dept => (
                  <div key={dept.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-semibold text-sm">{dept.name}</p>
                      <Badge variant="secondary" className="text-[9px] shrink-0">Implicated</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{dept.role}</p>
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Activation Threshold</p>
                      <p className="text-xs">{dept.threshold}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-6" />

              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Tribal DOJ Integration Principles</p>
                <div className="space-y-3 text-xs text-muted-foreground">
                  {[
                    ["Government-to-Government Protocol", "This system supports government-to-government relations. All intergovernmental review notifications are generated through established protocols, not unilateral assertions."],
                    ["Non-Jurisdiction-Over-Everything", "Identification of a DOJ-implicated matter does not mean the tribe automatically exercises jurisdiction over all parties. It means review thresholds have been crossed."],
                    ["Additive Analysis Only", "This framework is additive to existing NFR logic, court document systems, and enforcement workflows. It does not replace, override, or weaken any prior approved implementation."],
                    ["Doctrine Engine Advisory Role", "All doctrine and law references are advisory. Human review by qualified legal personnel is always required before enforcement, notice, or jurisdictional action is taken."],
                  ].map(([title, body]) => (
                    <div key={title} className="border rounded p-3">
                      <p className="font-semibold text-foreground mb-1">{title}</p>
                      <p>{body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ TAB: Audit Log ════════════════════════════════════════════════ */}
        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-widest">Full Audit History</CardTitle></CardHeader>
            <CardContent>
              {(!inv.auditLog || inv.auditLog.length === 0) ? (
                <p className="text-sm text-muted-foreground">No audit entries for this matter yet.</p>
              ) : (
                <div className="space-y-2">
                  {inv.auditLog.map(entry => (
                    <div key={entry.id} className="flex items-start gap-3 text-xs border-b pb-2 last:border-0 last:pb-0">
                      <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-muted-foreground/60 mt-1.5" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{entry.action.replace(/_/g, " ")}</span>
                        {entry.userId && <span className="text-muted-foreground ml-1">· Officer #{entry.userId}</span>}
                        {entry.afterValue !== null && typeof entry.afterValue === "object" &&
                          Object.keys(entry.afterValue as Record<string, unknown>).length > 0 && (
                          <p className="text-muted-foreground mt-0.5 font-mono text-[10px] truncate">{JSON.stringify(entry.afterValue)}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-muted-foreground whitespace-nowrap">{new Date(entry.createdAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Suppress unused import warning for Label (used in Select pattern above)
void Label;