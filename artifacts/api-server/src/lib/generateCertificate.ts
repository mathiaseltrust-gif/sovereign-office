import PDFDocument from "pdfkit";

export interface CertMember {
  name: string;
  dob: string;
  age: number | null;
  enrollment: string;
  address: string;
  membershipType: string;
  certNumber: string;
}

export interface SignatureSlot {
  slot: "chief_justice" | "trustee";
  signerName: string;
  signerTitle: string;
  imageBuffer?: Buffer;
}

const DARK_RED = "#6B1A1A";
const GOLD = "#C4933A";
const LIGHT_GOLD = "#F5EDD6";
const MID_GRAY = "#555555";
const LIGHT_GRAY = "#DDDDDD";

function formatMembershipType(t: string): string {
  const map: Record<string, string> = {
    lineal_descendant: "Adult Member — Lineal Descendant",
    adoptive_descendant: "Adoptive Descendant — Protective Member",
    elder: "Elder Member — Lineal Descendant",
    minor_lineal: "Minor Member — Lineal Descendant",
    minor_adoptive: "Adoptive Descendant — Protective Member (Minor)",
  };
  return map[t] ?? t;
}

export async function generateCertificatePDF(
  members: CertMember[],
  signatures: SignatureSlot[],
  issueDate: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 54, bottom: 54, left: 61, right: 61 },
      autoFirstPage: false,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    members.forEach((member, idx) => {
      doc.addPage();
      renderCertPage(doc, member, signatures, issueDate);
    });

    doc.end();
  });
}

function goldRule(doc: PDFKit.PDFDocument, y: number, width: number): number {
  doc.save().strokeColor(GOLD).lineWidth(2).moveTo(61, y).lineTo(61 + width, y).stroke().restore();
  return y + 14;
}

function thinRule(doc: PDFKit.PDFDocument, y: number, width: number): number {
  doc.save().strokeColor(LIGHT_GRAY).lineWidth(0.5).moveTo(61, y).lineTo(61 + width, y).stroke().restore();
  return y + 10;
}

function renderCertPage(
  doc: PDFKit.PDFDocument,
  member: CertMember,
  signatures: SignatureSlot[],
  issueDate: string,
): void {
  const LEFT = 61;
  const WIDTH = doc.page.width - LEFT * 2;
  let y = 54;

  // ── Title ────────────────────────────────────────────────────────────────
  doc
    .font("Times-Bold")
    .fontSize(18)
    .fillColor(DARK_RED)
    .text("MATHIAS EL TRIBE", LEFT, y, { width: WIDTH, align: "center" });
  y += 26;

  doc
    .font("Times-Italic")
    .fontSize(11)
    .fillColor(GOLD)
    .text("Choctaw-Lineage · IKSA Sovereign Nation", LEFT, y, { width: WIDTH, align: "center" });
  y += 18;

  y = goldRule(doc, y, WIDTH);

  doc
    .font("Times-Bold")
    .fontSize(12)
    .fillColor(DARK_RED)
    .text("TRIBAL MEMBERSHIP VERIFICATION CERTIFICATE", LEFT, y, { width: WIDTH, align: "center" });
  y += 18;

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(MID_GRAY)
    .text(
      `Office of the Chief Justice and Trustee  ·  Date of Issue: ${issueDate}`,
      LEFT, y, { width: WIDTH, align: "center" },
    );
  y += 20;

  // ── Body text ────────────────────────────────────────────────────────────
  const isAdoptive = member.membershipType.includes("adoptive");
  const body =
    `This document certifies that ${member.name} is a recognized and enrolled member ` +
    `of the Mathias El Tribe, a Choctaw-lineage IKSA sovereign nation. Membership has been ` +
    `verified through the Tribe's official enrollment records and lineage documentation ` +
    `maintained by the Office of the Chief Justice and Trustee.`;

  doc
    .font("Times-Roman")
    .fontSize(10)
    .fillColor("#000000")
    .text(body, LEFT, y, { width: WIDTH, align: "justify", lineGap: 2 });
  y += doc.heightOfString(body, { width: WIDTH, lineGap: 2 }) + 8;

  if (isAdoptive) {
    const notice =
      `This individual holds Protective Member status as a verified adoptive descendant. ` +
      `Such status confers full tribal recognition, ICWA-eligible protections, and all ` +
      `rights accorded to enrolled members under tribal law and applicable federal Indian law.`;
    doc
      .font("Times-Roman")
      .fontSize(10)
      .fillColor("#000000")
      .text(notice, LEFT, y, { width: WIDTH, align: "justify", lineGap: 2 });
    y += doc.heightOfString(notice, { width: WIDTH, lineGap: 2 }) + 8;
  }

  y += 6;

  // ── Section label ────────────────────────────────────────────────────────
  doc
    .font("Times-Bold")
    .fontSize(10)
    .fillColor(DARK_RED)
    .text("MEMBER RECORD", LEFT, y);
  y += 14;
  y = thinRule(doc, y, WIDTH);

  // ── Data table ───────────────────────────────────────────────────────────
  const rows: [string, string][] = [
    ["FULL LEGAL NAME",   member.name],
    ["DATE OF BIRTH",     member.dob || "—"],
    ["AGE",               member.age != null ? String(member.age) : "—"],
    ["ENROLLMENT NO.",    member.enrollment || "Pending"],
    ["MEMBERSHIP STATUS", formatMembershipType(member.membershipType)],
    ["ADDRESS OF RECORD", member.address || "—"],
    ["CERTIFICATE NO.",   member.certNumber],
  ];

  const COL1 = 122;
  const COL2 = LEFT + COL1 + 8;
  const ROW_H = 18;

  rows.forEach(([label, value], i) => {
    const rowY = y + i * ROW_H;
    const bg = i % 2 === 0 ? LIGHT_GOLD : "#FFFFFF";
    doc.save().rect(LEFT, rowY, WIDTH, ROW_H).fill(bg).restore();
    doc.save().rect(LEFT, rowY, WIDTH, ROW_H).stroke(LIGHT_GRAY).restore();

    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(MID_GRAY)
      .text(label, LEFT + 6, rowY + 5, { width: COL1 - 6 });

    doc
      .font("Times-Roman")
      .fontSize(10)
      .fillColor("#000000")
      .text(value, COL2, rowY + 4, { width: WIDTH - COL1 - 14 });
  });

  y += rows.length * ROW_H + 24;

  // ── Photo notice ─────────────────────────────────────────────────────────
  doc
    .font("Times-Italic")
    .fontSize(9)
    .fillColor(MID_GRAY)
    .text(
      "Official tribal photo on file. Photo identification verified and retained in the enrollment records of the Office of the Chief Justice and Trustee for this member.",
      LEFT, y, { width: WIDTH, align: "center", lineGap: 1 },
    );
  y += 36;

  // ── Signature block ───────────────────────────────────────────────────────
  const sigSlots = signatures.length > 0
    ? signatures
    : [
        { slot: "chief_justice" as const, signerName: "Chief Mathias El", signerTitle: "Chief Justice and Trustee", imageBuffer: undefined },
        { slot: "trustee" as const,       signerName: "Enrollment Records Officer", signerTitle: "Office of the Chief Justice and Trustee", imageBuffer: undefined },
      ];

  const colW = WIDTH / sigSlots.length;

  sigSlots.forEach((sig, i) => {
    const sigX = LEFT + i * colW;
    const lineY = y;

    // signature image or blank line
    if (sig.imageBuffer) {
      try {
        doc.image(sig.imageBuffer, sigX, lineY - 28, { height: 28, fit: [colW - 20, 28] });
      } catch {
        // skip if image fails
      }
    }

    // rule line
    doc.save().strokeColor(DARK_RED).lineWidth(1)
      .moveTo(sigX, lineY)
      .lineTo(sigX + colW - 16, lineY)
      .stroke().restore();

    doc
      .font("Times-Bold")
      .fontSize(11)
      .fillColor(DARK_RED)
      .text(sig.signerName, sigX, lineY + 4, { width: colW - 16 });

    doc
      .font("Times-Italic")
      .fontSize(9)
      .fillColor(MID_GRAY)
      .text(sig.signerTitle, sigX, lineY + 18, { width: colW - 16 });

    doc
      .font("Times-Italic")
      .fontSize(9)
      .fillColor(MID_GRAY)
      .text("Office of the Chief Justice and Trustee", sigX, lineY + 30, { width: colW - 16 });
  });

  y += 60;

  // ── Footer rule + text ────────────────────────────────────────────────────
  y = goldRule(doc, y, WIDTH);

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(MID_GRAY)
    .text(
      "This certificate is issued by the Office of the Chief Justice and Trustee, Mathias El Tribe, " +
      "a Choctaw-lineage IKSA sovereign nation. It is intended for use in all federal, state, and local " +
      "proceedings requiring proof of tribal membership. Inquiries may be directed to the " +
      "Office of the Chief Justice and Trustee, Mathias El Tribe.",
      LEFT, y, { width: WIDTH, align: "center", lineGap: 1 },
    );
}
