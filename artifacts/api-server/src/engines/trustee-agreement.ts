import { createHash } from "crypto";

export const TRUSTEE_AGREEMENT_KEY = "trustee_governing_agreement";
export const TRUSTEE_AGREEMENT_VERSION = "2026.10.02-1";

export interface TrusteeAgreementSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  emphasis?: "standard" | "removal" | "signature";
}

export interface TrusteeAgreementDocument {
  key: string;
  version: string;
  effectiveDate: string;
  title: string;
  subtitle: string;
  scope: string;
  preamble: string[];
  sections: TrusteeAgreementSection[];
  signatureStatement: string;
}

export const TRUSTEE_AGREEMENT: TrusteeAgreementDocument = {
  key: TRUSTEE_AGREEMENT_KEY,
  version: TRUSTEE_AGREEMENT_VERSION,
  effectiveDate: "October 2, 2026",
  title: "Trustee Agreement, Fiduciary Covenant & Acknowledgment of Office",
  subtitle: "Board of Trustees — Independent Accountability & Stewardship",
  scope: "Applies to a person exercising Trustee authority through the Sovereign Office, including delegated trustee functions concerning the Mathias El Tribe Trust, Mathias El Tribe Charitable Trust, Board Matters, institutional records, assets, programs, and continuity functions.",
  preamble: [
    "Trustee authority is an office of stewardship, not personal ownership. Authority exists only to the extent of a valid appointment, delegation, governing instrument, Board action, or other controlling authority of the Sovereign Office.",
    "The purpose of this Agreement is to make the Trustee's duties, limits, training obligations, accountability, suspension standards, and removal standards understandable before Trustee powers are exercised.",
    "Where a controlling trust instrument, charter, appointment, resolution, or applicable law imposes a stricter requirement, that controlling authority governs.",
  ],
  sections: [
    { heading: "1. Acceptance of Fiduciary Office", paragraphs: ["The Trustee accepts a position of confidence and agrees to act for the purposes, beneficiaries, property, records, and continuity of the institutions placed within the Trustee's assigned authority."], bullets: ["Exercise only authority actually delegated or assigned.","Act in good faith and for authorized institutional or beneficiary purposes.","Treat access to money, records, systems, credentials, and confidential information as entrusted access.","Use Sovereign Office systems and Board processes so material actions are documented and reviewable."] },
    { heading: "2. Duties of Loyalty, Care, Stewardship & Accounting", bullets: ["Protect trust property, charitable resources, institutional records, and operational continuity from waste, misuse, loss, or unauthorized transfer.","Avoid using Trustee authority for undisclosed personal advantage, favoritism, retaliation, or purposes outside the governing mission.","Maintain reasonable records of material decisions, transactions, directives, approvals, and supporting evidence.","Respond to lawful Board oversight, accounting requests, assigned Board Matters, and required evidence requests.","Escalate a matter when the Trustee lacks authority, knowledge, information, or capacity to act safely."] },
    { heading: "3. Conflicts, Self-Dealing & Recusal", bullets: ["Promptly disclose a material financial, family, business, personal, or other interest that could reasonably affect impartial Trustee judgment.","Do not approve or conceal a transaction in which the Trustee has an undisclosed material interest.","Recuse or obtain documented authorization when the governing process requires it.","Do not commingle entrusted property with personal property or treat institutional funds as personal funds."] },
    { heading: "4. Records, Confidentiality & System Security", bullets: ["Protect confidential beneficiary, family, legal, medical, financial, credential, and governmental information according to the person's authority.","Do not share Microsoft, Sovereign Office, financial, domain, server, or other institutional credentials with an unauthorized person.","Do not intentionally alter, conceal, destroy, backdate, or remove material institutional records to defeat review or accountability.","Promptly report suspected loss of credentials, unauthorized access, cybersecurity incidents, missing records, or material data integrity concerns."] },
    { heading: "5. Training, Upkeep & Continuity", paragraphs: ["A Trustee is expected to learn the assigned role. The Sovereign Office may provide role guides, AI-assisted explanations, reminders, checklists, recurring upkeep reviews, and Board-directed training."], bullets: ["Complete required orientation or role-specific learning assigned to the Trustee.","Review reminders, deadlines, continuity checks, and Board Matters assigned to the Trustee.","Ask for clarification when instructions, authority, or consequences are unclear.","Participate in orderly handoff of records, credentials, pending work, and institutional knowledge when authority changes."] },
    { heading: "6. Duty to Report Errors and Risks", paragraphs: ["A good-faith error should be reported and corrected. Concealing an error is more serious than identifying it promptly."], bullets: ["Report material missed deadlines, financial discrepancies, record errors, unauthorized transactions, or inability to complete an assigned critical duty.","Preserve the evidence needed to understand what occurred.","Cooperate with corrective action, training, supervision, or reassignment."] },
    { heading: "7. What Can Constitute Suspension or Removal", emphasis: "removal", paragraphs: ["Removal is not intended to be automatic for every good-faith mistake. A correctable error ordinarily calls for correction, education, supervision, or reassignment unless the conduct creates serious unmitigated risk or becomes repeated after notice.","Subject to the controlling appointment, charter, trust instrument, resolution, and governing procedure, the following can constitute grounds for suspension or removal from Trustee authority:"], bullets: ["Expiration, revocation, or termination of the appointment or delegation by the authority empowered to do so.","Voluntary resignation or abandonment of the assigned Trustee office.","A material or repeated breach of this Agreement or a controlling governing instrument.","Misappropriation, unauthorized transfer, conversion, concealment, or material misuse of entrusted money, property, benefits, records, or institutional resources.","Intentional falsification, material concealment, destruction, or alteration of institutional records or evidence.","Undisclosed material self-dealing, conflict of interest, or use of Trustee authority for improper personal benefit.","Unauthorized disclosure of protected information, credential sharing, intentional circumvention of access controls, or serious security misconduct.","Material action outside delegated authority that creates substantial risk to beneficiaries, trust property, charitable resources, legal rights, or institutional continuity.","Repeated substantial failure to perform assigned duties after written notice and a reasonable opportunity to correct the failure when correction is appropriate.","Refusal, without valid basis, to provide required accounting, records, evidence, or cooperation with authorized Board oversight.","A recorded finding by the authorized governing body of fraud, theft, intentional dishonesty, serious misconduct, or other conduct materially incompatible with continued fiduciary responsibility."] },
    { heading: "8. Emergency Suspension and Removal Procedure", emphasis: "removal", paragraphs: ["Where there is a reasonable basis to believe that continued access creates an immediate material risk to trust assets, charitable resources, beneficiaries, institutional records, credentials, systems, or continuity, access may be temporarily suspended while the matter is reviewed.","Permanent removal should be documented through the authority and procedure that governs the appointment. Except where emergency protection requires immediate suspension, the process should ordinarily provide notice of the stated grounds and a meaningful opportunity to respond before a final removal determination."], bullets: ["The grounds and material supporting evidence should be recorded.","The Trustee should be told whether the action is temporary suspension, restriction of authority, reassignment, or permanent removal.","A final decision should identify the authorized decision-maker or Board action relied upon.","Access, records, property, credentials, assignments, and pending work should be transitioned and preserved.","Any available reconsideration or review procedure under the governing instrument should be identified."] },
    { heading: "9. No Authority Beyond Delegation", paragraphs: ["Microsoft sign-in and a Trustee role in software do not themselves create unlimited legal authority. The system provides access only as an implementation of an underlying appointment, delegation, office, or governing decision."], bullets: ["Do not bind a trust, charitable trust, Board, Court, Tribe, Office, or beneficiary beyond delegated authority.","Do not transfer, encumber, pledge, sell, invest, or commit institutional assets unless the action is authorized through the applicable governing process.","When approval is required, create or use the appropriate Board Matter, resolution, task, or other recorded approval path."] },
    { heading: "10. Electronic Signature, Versioning & Continuing Acknowledgment", emphasis: "signature", paragraphs: ["By signing through a Microsoft-authenticated Sovereign Office session, the Trustee intends the typed name and authenticated acceptance record to constitute the Trustee's electronic signature and acknowledgment of this Agreement.","The Sovereign Office preserves the authenticated user identity, Microsoft Entra identity reference, agreement version, exact agreement snapshot, SHA-256 content fingerprint, signing time, and a server-generated signature receipt.","A materially revised Agreement may require a new acknowledgment before Trustee authority can continue to be exercised."] },
  ],
  signatureStatement: "I have read this Trustee Agreement, understand the duties and limits of Trustee authority, understand the stated grounds and process for suspension or removal, and intend my Microsoft-authenticated acceptance to serve as my electronic signature.",
};

export function getCurrentTrusteeAgreement() {
  const snapshotText = JSON.stringify(TRUSTEE_AGREEMENT);
  const contentHash = createHash("sha256").update(snapshotText, "utf8").digest("hex");
  return { agreement: TRUSTEE_AGREEMENT, snapshotText, contentHash };
}
