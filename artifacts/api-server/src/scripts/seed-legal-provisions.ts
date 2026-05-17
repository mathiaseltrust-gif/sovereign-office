import { db } from "@workspace/db";
import { legalProvisionsTable } from "@workspace/db";

const provisions = [
  {
    title: "Federal Indian Definitions",
    category: "federal_indian_definitions",
    purpose: "Broad statutory definitions that extend beyond narrow BIA-list assumptions.",
    content: `Federal Indian law protections are not dependent on whether a person appears on a narrow administrative list. Many protections are tied to statutory definitions, treaty obligations, trust responsibilities, ancestry/community status, or eligibility classifications written directly into federal law.

The federal definition of "Indian" under ISDEAA (25 U.S.C. ss 5304) and IHCIA (25 U.S.C. ss 1603) is purposely broad. It does not depend on any BIA enrollment list, federal acknowledgment database, or agency-maintained registry. A person may be classified as Indian under federal law based on descent, community membership, or treaty standing.

Being told "you are not on our list" is an administrative convenience argument -- not a statement of federal law. It is a misclassification.

Rights that exist whether or not you were properly informed of them are still operative by law and can be invoked once understood. Administrative silence does not necessarily extinguish statutory protections.`,
    keyStatutes: ["25 U.S.C. ss 5304(e) -- ISDEAA", "25 U.S.C. ss 1603 -- IHCIA", "Passamaquoddy Tribe v. Morton, 528 F.2d 370 (1st Cir. 1975)"],
    companionCategories: ["Federal Indian Definitions", "Rights Activation Through Knowledge", "Administrative Classification Review"],
  },
  {
    title: "Trust Responsibility",
    category: "trust_responsibility",
    purpose: "Federal fiduciary obligations to tribal people and Indian beneficiaries -- legally enforceable, not merely political language, and not conditioned on administrative lists, BIA recognition status, or CDIB possession.",
    content: `WHAT IT IS — LEGAL & STRUCTURAL FOUNDATION

Federal Indian law recognizes a unique trust relationship between the United States and Indian tribes and Indian people. This relationship developed through treaties, federal dealings, congressional enactments, territorial expansion, protection obligations, and the continued existence of tribal nations and communities within the United States legal framework.

The federal trust responsibility is not merely political language. Courts have repeatedly recognized that federal agencies and officials dealing with Indian affairs may carry fiduciary obligations, heightened duties of protection, and legally enforceable responsibilities involving tribal lands, tribal assets, governmental functions, treaty obligations, protected Indian interests, and beneficiary welfare.

Congress codified portions of these duties through statutes governing Indian affairs, trust assets, health services, self-determination programs, tribal property, and federal administration involving Indian tribes and Indian beneficiaries. Courts have repeatedly held that these obligations are to be interpreted liberally in favor of protected tribal and Indian interests under the Indian Canons of Construction.

The trust responsibility is not limited solely to reservation boundaries, administrative rosters, BIA recognition systems, or possession of a CDIB card. Federal Indian law protections may extend to protected tribal interests, identifiable tribal communities, tribal governmental functions, tribal beneficiaries, restricted property interests, treaty rights, and federally protected Indian affairs implicated by statute, federal dealings, or trust obligations.

When governmental actions affect tribal lands, tribal governmental operations, protected Indian interests, beneficiary welfare, trust assets, jurisdictional integrity, or federally protected tribal functions, multiple overlapping legal frameworks may become implicated simultaneously -- including federal trust responsibility doctrines, the Non-Intercourse Act, federal preemption principles, Indian Country doctrines, tribal governmental protections, fiduciary obligations, treaty protections, and federal constitutional and statutory safeguards.

The trust responsibility has operational consequences. Courts have recognized liability, enforcement obligations, fiduciary standards, limits on state interference, protections for tribal property, protections for tribal governmental functions, and remedies for breaches of federal duties involving Indian affairs and tribal interests.

KEY CASES — SCOPE, ENFORCEMENT & OPERATIONAL EFFECT

Seminole Nation v. United States, 316 U.S. 286 (1942): Established that the federal government must meet "the most exacting fiduciary standards" in its dealings involving Indian affairs and protected tribal interests.

United States v. Mitchell, 463 U.S. 206 (1983): Confirmed that the United States may be held liable for breach of fiduciary duties involving management of Indian trust resources and assets.

Cobell v. Salazar, 573 F.3d 808 (D.C. Cir. 2009): Recognized enforceable federal trust-accounting obligations and large-scale fiduciary breaches involving Indian trust management.

United States v. White Mountain Apache Tribe, 537 U.S. 465 (2003): Confirmed fiduciary duties may arise where the United States occupies, controls, or uses tribal property or assets.

Morton v. Ruiz, 415 U.S. 199 (1974): Held that agencies administering Indian programs cannot impose unpublished or arbitrary eligibility restrictions inconsistent with federal obligations and lawful standards.

Joint Tribal Council of the Passamaquoddy Tribe v. Morton, 528 F.2d 370 (1st Cir. 1975): Confirmed that federal obligations under the Non-Intercourse Act may apply even where the government disputed formal administrative recognition status.

White Mountain Apache Tribe v. Bracker, 448 U.S. 136 (1980): Recognized that federal and tribal interests may preempt state taxation and regulatory interference involving tribal operations and Indian affairs.

Worcester v. Georgia, 31 U.S. 515 (1832): Established foundational principles limiting unauthorized state interference in tribal affairs and recognizing the distinct legal status of tribal nations and communities.

McGirt v. Oklahoma, 591 U.S. ___ (2020): Reaffirmed that tribal jurisdiction and reservation status remain effective unless Congress clearly provides otherwise.

United States v. Jicarilla Apache Nation, 564 U.S. 162 (2011): Recognized that the federal government acts in a trust relationship with Indian tribes and that fiduciary principles remain central to federal Indian law analysis.

ENFORCEMENT & RESPONSE PATHWAYS

Where actions potentially impair tribal lands, tribal governmental functions, protected tribal interests, trust assets, beneficiary welfare, tribal jurisdiction, or federally protected Indian affairs, appropriate responses may include: administrative notice; preservation demands; jurisdictional objections; federal-agency review requests; protective-order enforcement; federal trust responsibility assertions; federal preemption challenges; tribal court remedies; and actions in appropriate federal forums, including the United States Court of Federal Claims where applicable.

The existence of a trust responsibility is not merely symbolic. Courts have repeatedly recognized that breaches of federal obligations involving Indian affairs may carry enforceable legal consequences.`,
    keyStatutes: [
      "Snyder Act (25 U.S.C. ss 13)",
      "Federal Trust Responsibility doctrine",
      "Non-Intercourse Act (25 U.S.C. ss 177)",
      "Indian Country Jurisdiction (18 U.S.C. ss 1151)",
      "Seminole Nation v. United States, 316 U.S. 286 (1942)",
      "United States v. Mitchell, 463 U.S. 206 (1983)",
      "Cobell v. Salazar, 573 F.3d 808 (D.C. Cir. 2009)",
      "United States v. White Mountain Apache Tribe, 537 U.S. 465 (2003)",
      "Morton v. Ruiz, 415 U.S. 199 (1974)",
      "Passamaquoddy Tribe v. Morton, 528 F.2d 370 (1st Cir. 1975)",
      "White Mountain Apache Tribe v. Bracker, 448 U.S. 136 (1980)",
      "McGirt v. Oklahoma, 591 U.S. ___ (2020)",
      "United States v. Jicarilla Apache Nation, 564 U.S. 162 (2011)",
      "Worcester v. Georgia, 31 U.S. 515 (1832)",
      "Indian Canons of Construction -- ambiguities resolved in favor of tribal and Indian interests",
      "Loper Bright Enterprises v. Raimondo (2024) -- administrative deference overturned",
    ],
    companionCategories: ["Trust Responsibility", "Federal Obligations", "Self-Executing Rights", "Fiduciary Enforcement", "Overlapping Protections", "Tribal Governmental Facility Protection", "Enforcement & Response Pathways"],
  },
  {
    title: "Land & Territory",
    category: "land_and_territory",
    purpose: "Jurisdiction and protected land frameworks -- federal protections against unlawful encumbrance.",
    content: `The Non-Intercourse Act (25 U.S.C. ss 177) provides foundational protection for Indian land interests, restrictions on alienation, and federal approval requirements for any transfer. Per Passamaquoddy v. Morton, these protections apply even without formal federal recognition.

Indian Country (18 U.S.C. ss 1151) creates layered jurisdiction -- federal, tribal, and state distinctions apply based on territory classification. The trust responsibility applies to all trust land, restricted land, and land held in beneficial interest.

State laws generally have no force within Indian country per Worcester v. Georgia (1832). COMPANION should help members identify land status misclassification -- trust land treated as ordinary property is a cognizable federal injury.`,
    keyStatutes: ["25 U.S.C. ss 177 -- Non-Intercourse Act", "18 U.S.C. ss 1151 -- Indian Country definition", "Worcester v. Georgia, 31 U.S. 515 (1832)"],
    companionCategories: ["Protected Land Interests", "Restricted Land", "Federal Protection Against Unlawful Encumbrance", "Jurisdiction Mapping"],
  },
  {
    title: "Family & Kinship",
    category: "family_and_kinship",
    purpose: "ICWA and family continuity protections -- tribal jurisdiction over child welfare matters.",
    content: `The Indian Child Welfare Act (ICWA, 25 U.S.C. ss 1901-1963) acknowledges tribal political identity, family and community continuity, and protection against forced assimilation structures. ICWA establishes minimum federal standards for child custody proceedings involving Indian children and affirms tribal court jurisdiction.

The Violence Against Women Act (VAWA) tribal provisions acknowledge tribal court authority and enforcement powers, including recognition of tribal protective orders by non-tribal courts.

Tribal court enforcement and interjurisdictional recognition are federal law -- not discretionary courtesies.`,
    keyStatutes: ["ICWA -- 25 U.S.C. ss 1901-1963", "VAWA Tribal Provisions", "25 U.S.C. ss 1911 -- Tribal jurisdiction"],
    companionCategories: ["Family Integrity", "Kinship Rights", "Cultural Continuity", "Child Protection", "Protective Orders", "Tribal Court Enforcement"],
  },
  {
    title: "Health Rights",
    category: "health_rights",
    purpose: "IHCIA, urban Indian protections, and Medicaid AI/AN rights -- applicable based on broad federal definitions.",
    content: `The Indian Health Care Improvement Act (IHCIA, 25 U.S.C. ss 1601 et seq.) defines "Indian" broadly to include all persons of Indian descent who are members of the Indian community -- explicitly including urban Indians (25 U.S.C. ss 1651-1660i).

Leaving a reservation does not extinguish federal Indian status or health program eligibility. Medicaid AI/AN protections often apply based on eligibility classification and federal definitions -- not simply narrow recognition assumptions.

Members have managed care opt-out rights and fee-for-service election rights. The federal trust health obligation flows from the broad statutory definition -- not from administrative convenience.`,
    keyStatutes: ["25 U.S.C. ss 1601 -- IHCIA", "25 U.S.C. ss 1603 -- Indian definition (broad)", "25 U.S.C. ss 1651-1660i -- Urban Indian provisions", "Medicaid AI/AN Protections"],
    companionCategories: ["Health Rights", "Urban Indian Protections", "Federal Trust Health Obligations", "Managed Care Opt-Out Rights", "AI/AN Healthcare Rights"],
  },
  {
    title: "Tribal Governance",
    category: "tribal_governance",
    purpose: "ISDEAA self-determination rights and ICRA civil liberties within tribal governance structures.",
    content: `The Indian Self-Determination and Education Assistance Act (ISDEAA, 25 U.S.C. ss 5301 et seq.) recognizes and affirms the inherent right of Indian tribes to self-determination and self-governance. Congress used broad language tied to tribal communities and federally acknowledged tribal relationships.

The Indian Civil Rights Act (ICRA) protects due process concepts, tribal civil liberties structures, and procedural safeguards within tribal governance. Tribal powers are generally understood as inherent and retained -- not created by states.

Inherent sovereignty means tribes retain all sovereign powers not expressly divested by Congress. Silence does not divest.`,
    keyStatutes: ["25 U.S.C. ss 5304(e) -- ISDEAA", "Indian Civil Rights Act (ICRA)", "Ex Parte Crow Dog, 109 U.S. 556 (1883) -- inherent criminal jurisdiction"],
    companionCategories: ["Self-Determination Rights", "Community Governance", "Tribal Administration", "Civil Liberties", "Tribal Due Process"],
  },
  {
    title: "Civil Liberties",
    category: "civil_liberties",
    purpose: "Religious freedom protections and due process rights applicable to tribal members.",
    content: `The Religious Freedom Restoration Act (RFRA) and the American Indian Religious Freedom Act (AIRFA) protect ceremonial rights, spiritual practices, and protected religious exercise. These protections apply against government interference with tribal members' spiritual and ceremonial practices.

The Indian Civil Rights Act provides a structural framework for civil liberties within tribal governance -- protecting members from arbitrary governmental action.

COMPANION should recognize when a member's spiritual practices, ceremonial observances, or religious expression are being interfered with and name the applicable protections clearly.`,
    keyStatutes: ["RFRA -- 42 U.S.C. ss 2000bb", "AIRFA -- 42 U.S.C. ss 1996", "Indian Civil Rights Act"],
    companionCategories: ["Ceremonial Rights", "Spiritual Practices", "Protected Religious Exercise", "Civil Liberties"],
  },
  {
    title: "Cultural Continuity",
    category: "cultural_continuity",
    purpose: "Language restoration, ancestral preservation, and cultural property rights.",
    content: `The Native American Languages Act affirms the right of Native peoples to use, practice, and develop Native American languages. The Native American Graves Protection and Repatriation Act (NAGPRA) provides rights to the repatriation of ancestral remains and cultural items.

These are federally recognized rights flowing from the broader trust responsibility and sovereign relationship. Cultural preservation is not merely aspirational -- it is a federal legal obligation.

COMPANION should affirm members' rights to cultural expression, language use, and ancestral stewardship.`,
    keyStatutes: ["Native American Languages Act", "NAGPRA -- 25 U.S.C. ss 3001-3013"],
    companionCategories: ["Language Restoration", "Ancestral Preservation", "Cultural Property Rights", "Cultural Continuity"],
  },
  {
    title: "Administrative Review",
    category: "administrative_review",
    purpose: "Classification challenges and administrative misclassification -- rights to contest agency determinations.",
    content: `Agencies operate through classifications, but classifications can be challenged. Many federal protections attach through law itself -- administrative convenience does not override statutory rights.

Post-Loper Bright (2024), federal agencies may no longer rely solely on their own interpretation of ambiguous statutes. Agency administrative convenience arguments that narrow Indian rights are now legally vulnerable.

Members have the right to contest: land status misclassification; identity denial based on administrative lists rather than the broad federal statutory definition; and administrative narrowing of eligibility that conflicts with the governing statute. COMPANION should help members identify and name misclassifications clearly.`,
    keyStatutes: ["Loper Bright Enterprises v. Raimondo (2024)", "Indian Canons of Construction -- ambiguities resolved in favor of the tribe", "Passamaquoddy v. Morton -- no list required"],
    companionCategories: ["Administrative Classification Review", "Rights Activation Through Knowledge", "Misclassification Detection"],
  },
  {
    title: "Notice & Remedy",
    category: "notice_and_remedy",
    purpose: "Procedural frameworks for asserting rights -- notices, templates, and preservation of remedies.",
    content: `Jurisdiction often depends on consent, status, territory, or congressional limits. Members should be aware of: deadlines in agency or court matters; waiver and consent language in documents that may inadvertently extinguish rights; the importance of reservation-of-rights language in any response or agreement.

COMPANION can help draft notices that identify the issuing authority, state the applicable tribal/federal framework, request correction or action, and include reservation-of-rights and non-waiver language.

No document touching jurisdictional questions should be signed without review.`,
    keyStatutes: ["25 U.S.C. ss 177 -- Non-Intercourse Act protections", "ICWA procedural requirements", "Federal Rules -- rights preservation doctrine"],
    companionCategories: ["Notice & Remedy", "Procedural Guidance", "Rights Preservation", "Document Review"],
  },
  {
    title: "Jurisdiction Mapping",
    category: "jurisdiction_mapping",
    purpose: "Federal, tribal, and state jurisdiction distinctions -- understanding where each authority applies.",
    content: `Jurisdiction is one of the most important and most misunderstood concepts in federal Indian law.

Key principles: State laws generally have no force within Indian country (Worcester v. Georgia, 1832). Tribal courts have inherent jurisdiction over tribal members (Ex Parte Crow Dog, 1883). Federal jurisdiction in Indian country is defined by congressional enactment -- not by state convenience.

Indian country (18 U.S.C. ss 1151) includes reservations, dependent Indian communities, and allotments. Urban Indians who leave a reservation retain their federal Indian status. COMPANION should help members understand which jurisdictional layer applies to their situation and recognize when outside actors are overstepping into federal or tribal jurisdiction.`,
    keyStatutes: ["18 U.S.C. ss 1151 -- Indian Country", "Worcester v. Georgia, 31 U.S. 515 (1832)", "Ex Parte Crow Dog, 109 U.S. 556 (1883)", "ISDEAA self-governance provisions"],
    companionCategories: ["Jurisdiction Mapping", "Protected Territory", "Federal Indian Country", "Tribal Governance"],
  },
  {
    title: "Treaty & Historical Rights",
    category: "treaty_and_historical_rights",
    purpose: "Treaty frameworks, the Treaty of Dancing Rabbit Creek (1830), and the Indian Canons of Construction.",
    content: `Treaties are the supreme law of the land under Article VI of the U.S. Constitution. Treaty rights are not extinguished by the passage of time, administrative convenience, or state action.

The Indian Canons of Construction require that ambiguities in treaties or statutes be resolved in favor of the tribe. Intent to abrogate treaty rights must be express and clear -- silence does not abrogate.

The Treaty of Dancing Rabbit Creek (1830) is part of the organic law foundation of the Mathias El Tribe. Rights flowing from treaty standing are primary law -- they predate and cannot be overridden by ordinary positive law.`,
    keyStatutes: ["Treaty of Dancing Rabbit Creek (1830)", "Indian Canons of Construction", "Article VI, U.S. Constitution -- Supremacy Clause", "United States v. Winans, 198 U.S. 371 (1905)"],
    companionCategories: ["Treaty & Historical Rights", "Rights Activation Through Knowledge", "Inherent Sovereignty"],
  },
  {
    title: "Protected Status Review",
    category: "protected_status_review",
    purpose: "Eligibility and classification analysis -- reviewing whether protections apply to a member's specific situation.",
    content: `COMPANION should consistently distinguish educational/legal-information guidance from individualized legal representation.

The correct framing: "These federal provisions may apply depending on your status, community relationship, eligibility, ancestry, location, or jurisdictional circumstances. Review and formal analysis may be appropriate."

A protected status review asks: What statutory definitions govern this situation? What is the member's eligibility classification? Has the member been misclassified by an agency? What self-executing protections may apply automatically? What administrative challenge is available? COMPANION should open these questions -- not close them.`,
    keyStatutes: ["25 U.S.C. ss 5304 -- ISDEAA Indian definition", "25 U.S.C. ss 1603 -- IHCIA Indian definition", "Loper Bright -- administrative deference overturned"],
    companionCategories: ["Protected Status Review", "Eligibility Analysis", "Classification Challenges", "Legal Literacy"],
  },
  {
    title: "Community Stewardship",
    category: "community_stewardship",
    purpose: "Governance ethics, trustee responsibilities, and community-centered decision-making.",
    content: `The foundational principle of Community Stewardship is that sovereign authority exists in trust -- for the community, for the ancestors, and for future generations.

Trustee ethics require: transparency in decision-making; fiduciary duty to the membership; avoidance of self-dealing; preference for community benefit over administrative convenience; and perpetual alignment with the tribe's organic law (treaty, constitution, inherent sovereignty).

COMPANION should help the Chief Justice and sovereign office evaluate decisions through the stewardship lens: Does this decision protect the people? Does it preserve jurisdiction? Does it serve the ancestors and future generations? Does it keep the tribe in truth, logic, and lawful order?`,
    keyStatutes: ["Federal Trust Responsibility doctrine", "ISDEAA self-governance", "Tribal constitution and organic law", "Treaty of Dancing Rabbit Creek (1830)"],
    companionCategories: ["Community Stewardship", "Governance Ethics", "Trustee Responsibilities", "Sovereign Administration"],
  },
];

async function seed() {
  const existing = await db.select({ id: legalProvisionsTable.id }).from(legalProvisionsTable).limit(1);
  if (existing.length > 0) {
    console.log("Legal provisions already seeded, skipping.");
    return;
  }
  console.log("Seeding 14 Office Provisions...");
  for (const p of provisions) {
    await db.insert(legalProvisionsTable).values({
      title: p.title,
      category: p.category,
      purpose: p.purpose,
      content: p.content,
      keyStatutes: p.keyStatutes,
      companionCategories: p.companionCategories,
      status: "active",
    });
    console.log("  Inserted:", p.title);
  }
  console.log("Done. 14 Office Provisions seeded.");
}

seed().catch(console.error).finally(() => process.exit(0));
