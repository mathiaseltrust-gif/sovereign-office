import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Printer, Lock, FileText, Shield, UserCheck, Info, PenLine } from "lucide-react";
import SignatureSelector, { type SlotAssignment } from "@/components/SignatureSelector";

const BASE = import.meta.env.BASE_URL ?? "/sovereign-dashboard/";

function formatStampDate(d: Date): string {
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const m = months[d.getMonth()];
  const day = String(d.getDate()).padStart(2, "0");
  const yr = d.getFullYear();
  return `${m} ${day} ${yr}`;
}

// ─── Official Date Stamp ──────────────────────────────────────────────────────
function OfficialStamp({ date }: { date: string }) {
  const blue: React.CSSProperties = {
    fontFamily: "'Arial Narrow', Arial, sans-serif",
    fontWeight: 700,
    color: "#0A3A78",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    lineHeight: 1.25,
    width: "100%",
  };
  return (
    <div
      className="select-none"
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        width: "1.625in",
        height: "1.0in",
        border: "2.5px solid #0A3A78",
        borderRadius: 0,
        paddingTop: "0.09in",
        paddingBottom: "0.09in",
        paddingLeft: "0.08in",
        paddingRight: "0.08in",
        background: "#fff",
        boxSizing: "border-box",
        textAlign: "center",
      }}
    >
      <div style={{ width: "100%" }}>
        <div style={{ ...blue, fontSize: "9.5px", fontWeight: 700 }}>BY ORDER OF THE</div>
        <div style={{ ...blue, fontSize: "9px", fontWeight: 900, letterSpacing: "0px" }}>MATHIAS EL TRIBE SUPREME COURT</div>
      </div>
      <div style={{
        fontFamily: "'Courier New', Courier, monospace",
        fontWeight: 700,
        fontSize: "15px",
        color: "#C62828",
        letterSpacing: "2px",
        lineHeight: 1.1,
        width: "100%",
      }}>
        {date}
      </div>
      <div style={{ width: "100%" }}>
        <div style={{ ...blue, fontSize: "9.5px", fontWeight: 700 }}>OFFICE OF THE</div>
        <div style={{ ...blue, fontSize: "9.5px", fontWeight: 900 }}>CHIEF JUSTICE &amp; TRUSTEE</div>
      </div>
    </div>
  );
}

// ─── HTML print builder ────────────────────────────────────────────────────────
function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildOfficialDocHtml(opts: {
  stampDate: string;
  title: string;
  subject: string;
  body: string;
  useActualSeal: boolean;
  showSeal: boolean;
  certifiedCopy?: boolean;
  certifyingOfficer?: string;
  certDate?: string;
  chiefJusticeAssignment?: SlotAssignment;
  trusteeAssignment?: SlotAssignment;
}): string {
  const {
    stampDate, title, subject, body, useActualSeal, showSeal,
    certifiedCopy, certifyingOfficer, certDate,
    chiefJusticeAssignment, trusteeAssignment,
  } = opts;

  const origin = window.location.origin;
  const base = import.meta.env.BASE_URL ?? "/sovereign-dashboard/";
  const tribalSeal  = `${origin}${base}tribal-seal.png`;
  const supremeSeal = `${origin}${base}supreme-court-seal.png`;

  const cjName = chiefJusticeAssignment?.signerName ?? "Mathew-Allen McCaster, Chief Mathias El";
  const cjTitle = chiefJusticeAssignment?.signerTitle ?? "Chief Justice &amp; Trustee";
  const cjSigUrl = chiefJusticeAssignment?.signatureUrl ?? null;

  const trusteeName = trusteeAssignment?.signerName ?? cjName;
  const trusteeTitle = trusteeAssignment?.signerTitle ?? "In His Sovereign Trustee Capacity";
  const trusteeSigUrl = trusteeAssignment?.signatureUrl ?? null;

  const stampHtml = `
    <div style="display:inline-flex;flex-direction:column;align-items:center;justify-content:space-between;width:156px;height:96px;border:2.5px solid #0A3A78;padding:8px 7px;background:#fff;box-sizing:border-box;text-align:center;flex-shrink:0;">
      <div style="width:100%;">
        <div style="font-family:'Arial Narrow',Arial,sans-serif;font-size:8.5pt;font-weight:700;color:#0A3A78;text-transform:uppercase;letter-spacing:0.4px;line-height:1.25;width:100%;">BY ORDER OF THE</div>
        <div style="font-family:'Arial Narrow',Arial,sans-serif;font-size:8pt;font-weight:900;color:#0A3A78;text-transform:uppercase;letter-spacing:0px;line-height:1.25;width:100%;">MATHIAS EL TRIBE SUPREME COURT</div>
      </div>
      <div style="font-family:'Courier New',Courier,monospace;font-size:11pt;font-weight:700;color:#C62828;letter-spacing:2px;line-height:1.1;width:100%;">${escHtml(stampDate)}</div>
      <div style="width:100%;">
        <div style="font-family:'Arial Narrow',Arial,sans-serif;font-size:8.5pt;font-weight:700;color:#0A3A78;text-transform:uppercase;letter-spacing:0.4px;line-height:1.25;width:100%;">OFFICE OF THE</div>
        <div style="font-family:'Arial Narrow',Arial,sans-serif;font-size:8.5pt;font-weight:900;color:#0A3A78;text-transform:uppercase;letter-spacing:0.4px;line-height:1.25;width:100%;">CHIEF JUSTICE &amp; TRUSTEE</div>
      </div>
    </div>`;

  const sealHtml = showSeal
    ? useActualSeal
      ? `<img src="${supremeSeal}" alt="Mathias El Tribe Supreme Court Seal" style="width:120px;height:120px;object-fit:contain;" />`
      : `<div style="width:120px;height:120px;border-radius:50%;border:2px dashed #aaa;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><div style="text-align:center;color:#aaa;font-size:10px;padding:18px;"><div style="font-size:20px;margin-bottom:4px;">&#8853;</div>SEAL</div></div>`
    : "";

  const certifiedStampHtml = certifiedCopy
    ? `<div style="position:absolute;bottom:0.85in;right:1in;display:inline-flex;flex-direction:column;align-items:center;border:2px solid #0a1875;background:rgba(240,243,255,0.96);padding:8px 12px;min-width:210px;font-family:Arial,sans-serif;box-sizing:border-box;">
        <div style="font-size:9pt;font-weight:700;color:#0a1875;letter-spacing:0.5px;text-transform:uppercase;text-align:center;padding-bottom:4px;border-bottom:1px solid #0a1875;width:100%;margin-bottom:4px;">TRUE AND CERTIFIED COPY</div>
        <div style="font-size:8pt;color:#111;width:100%;margin-bottom:2px;"><span style="font-weight:700;">Date:</span> ${escHtml(certDate ?? "")}</div>
        <div style="font-size:8pt;color:#111;width:100%;margin-bottom:4px;"><span style="font-weight:700;">Certified by:</span> ${escHtml(certifyingOfficer ?? "")}</div>
        <div style="font-size:6.5pt;color:#777;text-align:center;width:100%;">SOVEREIGN OFFICE — MATHIAS EL TRIBE</div>
      </div>`
    : "";

  // Two-column authorized signature block (mirrors pdf-builder.ts layout)
  const sigBlockHtml = `
    <div style="margin-top:48px;display:grid;grid-template-columns:1fr 1fr;gap:32px;">
      <!-- Chief Justice / Official Capacity -->
      <div>
        <div style="font-size:7.5pt;font-weight:700;color:#444;letter-spacing:0.3px;margin-bottom:6px;text-transform:uppercase;">Electronic Signature — Judicial &amp; Official Capacity:</div>
        ${cjSigUrl ? `<img src="${cjSigUrl}" alt="Chief Justice Signature" style="height:46px;max-width:210px;object-fit:contain;display:block;margin-bottom:4px;opacity:0.87;" />` : `<div style="height:46px;"></div>`}
        <div style="border-top:1.5px solid #8B0000;width:240px;margin-bottom:5px;"></div>
        <div style="font-size:9.5pt;font-weight:700;color:#111;">/s/ ${escHtml(cjName)}</div>
        <div style="font-size:8.5pt;color:#333;margin-top:1px;">${escHtml(cjTitle)}</div>
        <div style="font-size:8pt;color:#555;font-style:italic;">Office of the Chief Justice &amp; Trustee</div>
        <div style="margin-top:14px;font-size:7.5pt;color:#777;font-weight:600;">Wet Signature (where required):</div>
        <div style="border-bottom:0.5px solid #000;width:220px;margin-top:16px;"></div>
        <div style="font-size:7pt;color:#888;margin-top:3px;">Chief Mathias El &nbsp;/&nbsp; Official Seal</div>
      </div>
      <!-- Trustee / Legal Name -->
      <div>
        <div style="font-size:7.5pt;font-weight:700;color:#444;letter-spacing:0.3px;margin-bottom:6px;text-transform:uppercase;">Electronic Signature — Legal Name (In Propria Persona):</div>
        ${trusteeSigUrl ? `<img src="${trusteeSigUrl}" alt="Trustee Signature" style="height:46px;max-width:210px;object-fit:contain;display:block;margin-bottom:4px;opacity:0.87;" />` : `<div style="height:46px;"></div>`}
        <div style="border-top:1.5px solid #8B0000;width:240px;margin-bottom:5px;"></div>
        <div style="font-size:9.5pt;font-weight:700;color:#111;">/s/ ${escHtml(trusteeName)}</div>
        <div style="font-size:8.5pt;color:#333;margin-top:1px;">${escHtml(trusteeTitle)}</div>
        <div style="font-size:8pt;color:#555;font-style:italic;">Mathias El Tribe — In Propria Persona</div>
        <div style="margin-top:14px;font-size:7.5pt;color:#777;font-weight:600;">Wet Signature (where required):</div>
        <div style="border-bottom:0.5px solid #000;width:220px;margin-top:16px;"></div>
        <div style="font-size:7pt;color:#888;margin-top:3px;">Mathew-Allen: McCaster</div>
      </div>
    </div>`;

  return `<!DOCTYPE html><html lang="en"><head>
    <meta charset="utf-8">
    <title>Official Document — ${escHtml(title || "Sovereign Order")}</title>
    <style>* { box-sizing: border-box; } body { margin:0; padding:0; background:#fff; } @page { size: letter; margin: 0; }</style>
  </head><body>
    <div style="background:#fff;color:#000;font-family:'Times New Roman',Georgia,serif;font-size:12pt;line-height:1.6;padding:1in 1in 0.75in;max-width:8.5in;min-height:11in;margin:0 auto;position:relative;box-sizing:border-box;">
      ${certifiedStampHtml}
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:12px;">
        <img src="${tribalSeal}" alt="Mathias El Tribe" style="width:64px;height:64px;object-fit:contain;flex-shrink:0;" />
        <div style="flex:1;text-align:center;padding:0 16px;">
          <div style="font-size:9pt;letter-spacing:3px;text-transform:uppercase;font-weight:700;color:#8B0000;">Mathias El Tribe</div>
          <div style="font-size:8pt;letter-spacing:2px;text-transform:uppercase;color:#555;">Office of the Chief Justice &amp; Trustee</div>
          <div style="font-size:7pt;color:#777;margin-top:2px;">In His Sovereign Trustee Capacity, on Behalf of the Mathias El Tribe</div>
        </div>
        ${stampHtml}
      </div>
      <hr style="border-top:2px solid #000;margin-bottom:24px;" />
      ${title ? `<div style="text-align:center;margin-bottom:20px;"><div style="font-size:13pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${escHtml(title)}</div></div>` : ""}
      ${subject ? `<div style="margin-bottom:16px;font-size:11pt;"><strong>RE:</strong> ${escHtml(subject)}</div>` : ""}
      <div style="margin-bottom:32px;font-size:11pt;white-space:pre-wrap;">${escHtml(body || " ")}</div>
      ${showSeal ? `<div style="display:flex;align-items:flex-end;gap:12px;margin-bottom:8px;">${sealHtml}<div style="font-size:8pt;color:#777;letter-spacing:0.5px;align-self:flex-end;">${useActualSeal ? "Official Seal" : "[Seal Placement]"}</div></div>` : ""}
      ${sigBlockHtml}
      <div style="position:absolute;bottom:0.5in;left:1in;right:1in;border-top:1px solid #ccc;padding-top:6px;">
        <div style="font-size:7.5pt;color:#888;text-align:center;letter-spacing:0.5px;">Issued under inherent sovereign authority of the Mathias El Tribe &mdash; An Identifiable Group of American Indians</div>
      </div>
    </div>
    <script>window.onload=function(){var imgs=document.querySelectorAll('img');var done=0;var total=imgs.length;function tryPrint(){done++;if(done>=total)setTimeout(function(){window.print();},300);}if(total===0){setTimeout(function(){window.print();},400);return;}imgs.forEach(function(i){if(i.complete){tryPrint();}else{i.onload=i.onerror=tryPrint;}});setTimeout(function(){window.print();},3000);};<\/script>
  </body></html>`;
}

// ─── Seal Placeholder ─────────────────────────────────────────────────────────
function SealPlaceholder({ useActualSeal }: { useActualSeal: boolean }) {
  if (useActualSeal) {
    return (
      <img
        src={`${BASE}supreme-court-seal.png`}
        alt="Mathias El Tribe Supreme Court Seal"
        style={{ width: "120px", height: "120px", objectFit: "contain" }}
      />
    );
  }
  return (
    <div
      style={{
        width: "120px",
        height: "120px",
        borderRadius: "50%",
        border: "2px dashed #aaa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <div style={{ textAlign: "center", color: "#aaa", fontSize: "10px", padding: "18px" }}>
        <div style={{ fontSize: "20px", marginBottom: "4px" }}>⊕</div>
        SEAL
      </div>
    </div>
  );
}

// ─── Signature preview row for live document preview ──────────────────────────
function SigPreviewRow({
  cjAssignment,
  trusteeAssignment,
}: {
  cjAssignment?: SlotAssignment;
  trusteeAssignment?: SlotAssignment;
}) {
  const cjName = cjAssignment?.signerName ?? "Mathew-Allen McCaster, Chief Mathias El";
  const cjTitle = cjAssignment?.signerTitle ?? "Chief Justice & Trustee";
  const trusteeName = trusteeAssignment?.signerName ?? cjName;
  const trusteeTitle = trusteeAssignment?.signerTitle ?? "In His Sovereign Trustee Capacity";

  return (
    <div style={{ marginTop: "32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
      {/* Chief Justice */}
      <div>
        <div style={{ fontSize: "7pt", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: "6px" }}>
          Electronic Sig — Judicial Capacity:
        </div>
        {cjAssignment?.signatureUrl ? (
          <img
            src={cjAssignment.signatureUrl}
            alt="Chief Justice sig"
            style={{ height: "38px", maxWidth: "180px", objectFit: "contain", display: "block", marginBottom: "4px", opacity: 0.87 }}
          />
        ) : (
          <div style={{ height: "38px" }} />
        )}
        <div style={{ borderTop: "1.5px solid #8B0000", width: "210px", marginBottom: "4px" }} />
        <div style={{ fontSize: "9.5pt", fontWeight: 700 }}>/s/ {cjName}</div>
        <div style={{ fontSize: "8pt", color: "#333" }}>{cjTitle}</div>
        <div style={{ fontSize: "7.5pt", color: "#777", fontStyle: "italic" }}>Office of the Chief Justice &amp; Trustee</div>
        <div style={{ marginTop: "12px", borderBottom: "0.5px solid #000", width: "190px" }} />
        <div style={{ fontSize: "7pt", color: "#aaa", marginTop: "2px" }}>Wet signature line</div>
      </div>
      {/* Trustee / Legal Name */}
      <div>
        <div style={{ fontSize: "7pt", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: "6px" }}>
          Electronic Sig — Legal Name:
        </div>
        {trusteeAssignment?.signatureUrl ? (
          <img
            src={trusteeAssignment.signatureUrl}
            alt="Trustee sig"
            style={{ height: "38px", maxWidth: "180px", objectFit: "contain", display: "block", marginBottom: "4px", opacity: 0.87 }}
          />
        ) : (
          <div style={{ height: "38px" }} />
        )}
        <div style={{ borderTop: "1.5px solid #8B0000", width: "210px", marginBottom: "4px" }} />
        <div style={{ fontSize: "9.5pt", fontWeight: 700 }}>/s/ {trusteeName}</div>
        <div style={{ fontSize: "8pt", color: "#333" }}>{trusteeTitle}</div>
        <div style={{ fontSize: "7.5pt", color: "#777", fontStyle: "italic" }}>In Propria Persona — Mathias El Tribe</div>
        <div style={{ marginTop: "12px", borderBottom: "0.5px solid #000", width: "190px" }} />
        <div style={{ fontSize: "7pt", color: "#aaa", marginTop: "2px" }}>Wet signature line</div>
      </div>
    </div>
  );
}

// ─── Document Preview ─────────────────────────────────────────────────────────
function DocumentPreview({
  stampDate,
  title,
  subject,
  body,
  useActualSeal,
  showSeal,
  cjAssignment,
  trusteeAssignment,
}: {
  stampDate: string;
  title: string;
  subject: string;
  body: string;
  useActualSeal: boolean;
  showSeal: boolean;
  cjAssignment?: SlotAssignment;
  trusteeAssignment?: SlotAssignment;
}) {
  return (
    <div
      id="official-document"
      style={{
        background: "#fff",
        color: "#000",
        fontFamily: "'Times New Roman', Georgia, serif",
        fontSize: "12pt",
        lineHeight: "1.6",
        padding: "1in 1in 0.75in",
        maxWidth: "8.5in",
        minHeight: "11in",
        margin: "0 auto",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      {/* Header row: seal + title + stamp */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
        <img
          src={`${BASE}tribal-seal.png`}
          alt="Mathias El Tribe"
          style={{ width: "64px", height: "64px", objectFit: "contain" }}
        />
        <div style={{ flex: 1, textAlign: "center", padding: "0 16px" }}>
          <div style={{ fontSize: "9pt", letterSpacing: "3px", textTransform: "uppercase", fontWeight: 700, color: "#8B0000" }}>
            Mathias El Tribe
          </div>
          <div style={{ fontSize: "8pt", letterSpacing: "2px", textTransform: "uppercase", color: "#555" }}>
            Office of the Chief Justice &amp; Trustee
          </div>
          <div style={{ fontSize: "7pt", color: "#777", marginTop: "2px" }}>
            In His Sovereign Trustee Capacity, on Behalf of the Mathias El Tribe
          </div>
        </div>
        <OfficialStamp date={stampDate} />
      </div>

      <hr style={{ borderTop: "2px solid #000", marginBottom: "24px" }} />

      {title && (
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{ fontSize: "13pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>
            {title}
          </div>
        </div>
      )}

      {subject && (
        <div style={{ marginBottom: "16px", fontSize: "11pt" }}>
          <strong>RE:</strong> {subject}
        </div>
      )}

      <div style={{ marginBottom: "32px", fontSize: "11pt", whiteSpace: "pre-wrap" }}>
        {body || " "}
      </div>

      {/* Seal */}
      {showSeal && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", marginBottom: "8px" }}>
          <SealPlaceholder useActualSeal={useActualSeal} />
          <div style={{ fontSize: "8pt", color: "#777", letterSpacing: "0.5px", alignSelf: "flex-end" }}>
            {useActualSeal ? "Official Seal" : "[Seal Placement]"}
          </div>
        </div>
      )}

      {/* Two-column signature block */}
      <SigPreviewRow cjAssignment={cjAssignment} trusteeAssignment={trusteeAssignment} />

      {/* Footer */}
      <div style={{ position: "absolute", bottom: "0.5in", left: "1in", right: "1in", borderTop: "1px solid #ccc", paddingTop: "6px" }}>
        <div style={{ fontSize: "7.5pt", color: "#888", textAlign: "center", letterSpacing: "0.5px" }}>
          Issued under inherent sovereign authority of the Mathias El Tribe — An Identifiable Group of American Indians
        </div>
      </div>
    </div>
  );
}

// ─── Delegation Panel ─────────────────────────────────────────────────────────
const DELEGATED_ROLES = [
  { role: "Trustee Officer", name: "Chief Justice & Trustee", canPrint: true, canDelegate: true },
];

function DelegationPanel() {
  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
          <Shield className="h-4 w-4" /> Print Delegation Authority
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3 text-sm">
        <p className="text-muted-foreground text-xs leading-relaxed">
          The right to print Official Documents in this format is a sovereign authority. Delegation may only be granted by the Office of the Chief Justice &amp; Trustee.
        </p>
        <div className="space-y-2">
          {DELEGATED_ROLES.map((d) => (
            <div key={d.role} className="flex items-center gap-3 p-2 rounded-md bg-muted/40 border">
              <UserCheck className="h-4 w-4 text-green-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs">{d.name}</p>
                <p className="text-[10px] text-muted-foreground">{d.role}</p>
              </div>
              <div className="flex gap-1">
                {d.canPrint && <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 border-green-500 text-green-700 dark:text-green-400">Print</Badge>}
                {d.canDelegate && <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 border-blue-500 text-blue-700 dark:text-blue-400">Delegate</Badge>}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground italic">
          Additional delegates may be added via order of the Office of the Chief Justice and Trustee.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function OfficialDocumentsPage() {
  const { activeRole, user, token } = useAuth();
  const canAccess = ["officer", "trustee", "admin", "sovereign_admin", "elder"].includes(activeRole);

  const today = new Date();
  const [stampDate, setStampDate] = useState(formatStampDate(today));
  const [title, setTitle] = useState("SOVEREIGN ORDER");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("To Whom It May Concern:\n\n\n\n\n\n");
  const [useActualSeal, setUseActualSeal] = useState(true);
  const [showSeal, setShowSeal] = useState(true);
  const [certifiedCopy, setCertifiedCopy] = useState(false);

  const [signatureAssignments, setSignatureAssignments] = useState<SlotAssignment[]>([]);

  const cjAssignment = signatureAssignments.find((a) => a.slot === "chief_justice");
  const trusteeAssignment = signatureAssignments.find((a) => a.slot === "trustee");

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Restricted — Chief Justice Office Only</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          Official Document printing is restricted to the Office of the Chief Justice &amp; Trustee. Contact the Office of the Chief Justice and Trustee to request delegation.
        </p>
      </div>
    );
  }

  const handlePrint = () => {
    const certDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const html = buildOfficialDocHtml({
      stampDate, title, subject, body, useActualSeal, showSeal,
      certifiedCopy, certifyingOfficer: user?.name ?? cjAssignment?.signerName,
      certDate, chiefJusticeAssignment: cjAssignment, trusteeAssignment,
    });
    const w = window.open("", "_blank", "width=1000,height=820");
    if (!w) { alert("Pop-up blocked — please allow pop-ups for this site."); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Official Documents
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Compose, stamp, and print official documents with seal and date block.
          </p>
        </div>
        <Button onClick={handlePrint} className="gap-2 bg-[#8B0000] hover:bg-[#6B0000] text-white">
          <Printer className="h-4 w-4" /> Print Official Document
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Document Fields</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider">Document Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. SOVEREIGN ORDER" className="font-serif" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider">RE: Subject</Label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject matter..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider">Body</Label>
                <Textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={10}
                  className="font-serif text-sm resize-y"
                  placeholder="Document body text..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Stamp &amp; Seal</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider">Stamp Date</Label>
                <Input
                  value={stampDate}
                  onChange={e => setStampDate(e.target.value.toUpperCase())}
                  placeholder="SEP 11 2025"
                  className="font-mono"
                />
                <p className="text-[10px] text-muted-foreground">Format: MON DD YYYY (e.g. JUL 13 2026)</p>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider">Court Seal</Label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="seal" checked={!showSeal} onChange={() => setShowSeal(false)} />
                    <span className="text-sm text-muted-foreground">No seal (text only)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="seal" checked={showSeal && !useActualSeal} onChange={() => { setShowSeal(true); setUseActualSeal(false); }} />
                    <span className="text-sm">Seal placement outline</span>
                    <span className="text-[9px] text-muted-foreground">(physical stamp)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="seal" checked={showSeal && useActualSeal} onChange={() => { setShowSeal(true); setUseActualSeal(true); }} />
                    <span className="text-sm font-medium">Official court seal</span>
                    <span className="text-[9px] text-muted-foreground">(digital)</span>
                  </label>
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider">Reproduction</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={certifiedCopy}
                    onChange={(e) => setCertifiedCopy(e.target.checked)}
                  />
                  <span className="text-sm font-medium">This is a reproduction</span>
                </label>
                {certifiedCopy && (
                  <p className="text-[10px] text-blue-700 dark:text-blue-400 leading-snug">
                    A "TRUE AND CERTIFIED COPY" block will appear on the printed document.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Signature selector */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <PenLine className="h-3.5 w-3.5" /> Authorized Signatures
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
                Select the officer signature for each slot. The actual signature image (uploaded on the Tribal ID page) is embedded in both the live preview and the printed document.
              </p>
              <SignatureSelector
                token={token ?? ""}
                onChange={setSignatureAssignments}
                chiefJusticeTitle="Chief Justice and Trustee"
                trusteeTitle="In His Sovereign Trustee Capacity"
                compact
              />
            </CardContent>
          </Card>

          <DelegationPanel />

          <Card className="border-blue-200 dark:border-blue-800 no-print">
            <CardContent className="p-4">
              <div className="flex gap-2 text-xs text-blue-700 dark:text-blue-300">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  The stamp block and seal print in color on electronic documents. For physical seal placement, select "Seal placement outline". Signature images are embedded directly from the Tribal ID page upload.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: live document preview */}
        <div className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Live Preview</p>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2 text-xs">
              <Printer className="h-3 w-3" /> Print
            </Button>
          </div>
          <div className="shadow-xl border rounded-sm overflow-auto" style={{ background: "#f5f5f5", padding: "16px" }}>
            <DocumentPreview
              stampDate={stampDate}
              title={title}
              subject={subject}
              body={body}
              useActualSeal={useActualSeal}
              showSeal={showSeal}
              cjAssignment={cjAssignment}
              trusteeAssignment={trusteeAssignment}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
