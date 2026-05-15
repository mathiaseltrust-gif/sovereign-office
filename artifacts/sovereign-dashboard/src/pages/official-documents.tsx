import { useState, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Printer, Lock, FileText, Shield, UserCheck, Info } from "lucide-react";

const BASE = import.meta.env.BASE_URL ?? "/sovereign-dashboard/";

function formatStampDate(d: Date): string {
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const m = months[d.getMonth()];
  const day = String(d.getDate()).padStart(2, "0");
  const yr = d.getFullYear();
  return `${m} ${day} ${yr}`;
}

// ─── Official Date Stamp ──────────────────────────────────────────────────────
const STAMP_LINES = [
  { text: "BY ORDER OF THE",         color: "#0A3A78", scale: 1.00, mono: false },
  { text: "MATHIAS EL TRIBE",        color: "#0A3A78", scale: 1.10, mono: false },
  { text: "SUPREME COURT",           color: "#0A3A78", scale: 1.10, mono: false },
  { text: "DATE",                    color: "#C62828", scale: 1.20, mono: true  },
  { text: "OFFICE OF THE",           color: "#0A3A78", scale: 0.95, mono: false },
  { text: "CHIEF JUSTICE & TRUSTEE", color: "#0A3A78", scale: 1.00, mono: false },
] as const;

const STAMP_BASE_PX = 6.8;

function OfficialStamp({ date }: { date: string }) {
  return (
    <div
      className="inline-flex flex-col items-center justify-center select-none"
      style={{
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
        gap: "1px",
        textAlign: "center",
      }}
    >
      {STAMP_LINES.map((l, i) => (
        <div
          key={i}
          style={{
            fontSize: `${STAMP_BASE_PX * l.scale}px`,
            color: l.color,
            fontFamily: l.mono
              ? "'Courier New', Courier, monospace"
              : "'Arial Narrow', Arial, sans-serif",
            fontWeight: 700,
            letterSpacing: l.mono ? "1px" : "0.3px",
            textTransform: "uppercase",
            lineHeight: 1.15,
            width: "100%",
          }}
        >
          {l.text === "DATE" ? date : l.text}
        </div>
      ))}
    </div>
  );
}

// ─── HTML print builder ────────────────────────────────────────────────────────
function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildOfficialDocHtml(opts: {
  stampDate: string; title: string; subject: string; body: string;
  signerName: string; signerTitle: string; useActualSeal: boolean; showSeal: boolean;
}): string {
  const { stampDate, title, subject, body, signerName, signerTitle, useActualSeal, showSeal } = opts;
  const origin = window.location.origin;
  const base = import.meta.env.BASE_URL ?? "/sovereign-dashboard/";
  const tribalSeal  = `${origin}${base}tribal-seal.png`;
  const supremeSeal = `${origin}${base}supreme-court-seal.png`;

  const stampHtml = `
    <div style="display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:156px;height:96px;border:2.5px solid #0A3A78;padding:8px 7px;background:#fff;box-sizing:border-box;gap:1px;text-align:center;flex-shrink:0;">
      <div style="font-family:'Arial Narrow',Arial,sans-serif;font-size:6.5pt;font-weight:700;color:#0A3A78;text-transform:uppercase;letter-spacing:0.3px;line-height:1.15;width:100%;">BY ORDER OF THE</div>
      <div style="font-family:'Arial Narrow',Arial,sans-serif;font-size:7pt;font-weight:900;color:#0A3A78;text-transform:uppercase;letter-spacing:0.3px;line-height:1.15;width:100%;">MATHIAS EL TRIBE</div>
      <div style="font-family:'Arial Narrow',Arial,sans-serif;font-size:7pt;font-weight:900;color:#0A3A78;text-transform:uppercase;letter-spacing:0.3px;line-height:1.15;width:100%;">SUPREME COURT</div>
      <div style="font-family:'Courier New',Courier,monospace;font-size:8pt;font-weight:700;color:#C62828;letter-spacing:1px;line-height:1.15;width:100%;">${escHtml(stampDate)}</div>
      <div style="font-family:'Arial Narrow',Arial,sans-serif;font-size:6.5pt;font-weight:700;color:#0A3A78;text-transform:uppercase;letter-spacing:0.3px;line-height:1.15;width:100%;">OFFICE OF THE</div>
      <div style="font-family:'Arial Narrow',Arial,sans-serif;font-size:6.5pt;font-weight:900;color:#0A3A78;text-transform:uppercase;letter-spacing:0.3px;line-height:1.15;width:100%;">CHIEF JUSTICE &amp; TRUSTEE</div>
    </div>`;

  const sealHtml = showSeal
    ? useActualSeal
      ? `<img src="${supremeSeal}" alt="Mathias El Tribe Supreme Court Seal" style="width:140px;height:140px;object-fit:contain;" />`
      : `<div style="width:140px;height:140px;border-radius:50%;border:2px dashed #aaa;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><div style="text-align:center;color:#aaa;font-size:10px;padding:20px;"><div style="font-size:22px;margin-bottom:4px;">&#8853;</div>SEAL PLACEMENT</div></div>`
    : "";

  return `<!DOCTYPE html><html lang="en"><head>
    <meta charset="utf-8">
    <title>Official Document — ${escHtml(title || "Sovereign Order")}</title>
    <style>* { box-sizing: border-box; } body { margin:0; padding:0; background:#fff; } @page { size: letter; margin: 0; }</style>
  </head><body>
    <div style="background:#fff;color:#000;font-family:'Times New Roman',Georgia,serif;font-size:12pt;line-height:1.6;padding:1in 1in 0.75in;max-width:8.5in;min-height:11in;margin:0 auto;position:relative;box-sizing:border-box;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:12px;">
        <img src="${tribalSeal}" alt="Mathias El Tribe" style="width:64px;height:64px;object-fit:contain;flex-shrink:0;" />
        <div style="flex:1;text-align:center;padding:0 16px;">
          <div style="font-size:9pt;letter-spacing:3px;text-transform:uppercase;font-weight:700;color:#8B0000;">Mathias El Tribe</div>
          <div style="font-size:8pt;letter-spacing:2px;text-transform:uppercase;color:#555;">Sovereign Office &mdash; Chief Justice &amp; Trustee</div>
          <div style="font-size:7pt;color:#777;margin-top:2px;">In His Sovereign Trustee Capacity, on Behalf of the Mathias El Tribe</div>
        </div>
        ${stampHtml}
      </div>
      <hr style="border-top:2px solid #000;margin-bottom:24px;" />
      ${title ? `<div style="text-align:center;margin-bottom:20px;"><div style="font-size:13pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${escHtml(title)}</div></div>` : ""}
      ${subject ? `<div style="margin-bottom:16px;font-size:11pt;"><strong>RE:</strong> ${escHtml(subject)}</div>` : ""}
      <div style="margin-bottom:32px;font-size:11pt;white-space:pre-wrap;">${escHtml(body || " ")}</div>
      <div style="margin-top:40px;display:flex;align-items:flex-end;justify-content:space-between;gap:20px;">
        ${showSeal ? `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;">${sealHtml}<div style="font-size:8pt;color:#777;letter-spacing:0.5px;text-align:center;">${useActualSeal ? "Official Seal" : "[Seal Placement]"}</div></div>` : ""}
        <div style="flex:1;margin-left:${showSeal ? "40px" : "0"};">
          <div style="border-top:1px solid #000;width:260px;margin-bottom:4px;"></div>
          <div style="font-size:11pt;font-weight:700;">${escHtml(signerName || "Mathew-Allen McCaster, Chief Mathias El")}</div>
          <div style="font-size:10pt;">${escHtml(signerTitle || "Chief Justice & Trustee")}</div>
          <div style="font-size:10pt;color:#555;">Mathias El Tribe Supreme Court</div>
          <div style="font-size:9pt;color:#555;">In His Sovereign Trustee Capacity</div>
        </div>
      </div>
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
        style={{ width: "140px", height: "140px", objectFit: "contain" }}
      />
    );
  }
  return (
    <div
      style={{
        width: "140px",
        height: "140px",
        borderRadius: "50%",
        border: "2px dashed #aaa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <div style={{ textAlign: "center", color: "#aaa", fontSize: "10px", padding: "20px" }}>
        <div style={{ fontSize: "22px", marginBottom: "4px" }}>⊕</div>
        SEAL PLACEMENT
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
  signerName,
  signerTitle,
  useActualSeal,
  showSeal,
}: {
  stampDate: string;
  title: string;
  subject: string;
  body: string;
  signerName: string;
  signerTitle: string;
  useActualSeal: boolean;
  showSeal: boolean;
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
        {/* Left: seal */}
        <img
          src={`${BASE}tribal-seal.png`}
          alt="Mathias El Tribe"
          style={{ width: "64px", height: "64px", objectFit: "contain" }}
        />

        {/* Center: letterhead */}
        <div style={{ flex: 1, textAlign: "center", padding: "0 16px" }}>
          <div style={{ fontSize: "9pt", letterSpacing: "3px", textTransform: "uppercase", fontWeight: 700, color: "#8B0000" }}>
            Mathias El Tribe
          </div>
          <div style={{ fontSize: "8pt", letterSpacing: "2px", textTransform: "uppercase", color: "#555" }}>
            Sovereign Office — Chief Justice &amp; Trustee
          </div>
          <div style={{ fontSize: "7pt", color: "#777", marginTop: "2px" }}>
            In His Sovereign Trustee Capacity, on Behalf of the Mathias El Tribe
          </div>
        </div>

        {/* Right: date stamp */}
        <OfficialStamp date={stampDate} />
      </div>

      <hr style={{ borderTop: "2px solid #000", marginBottom: "24px" }} />

      {/* Document title */}
      {title && (
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{ fontSize: "13pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>
            {title}
          </div>
        </div>
      )}

      {/* Subject */}
      {subject && (
        <div style={{ marginBottom: "16px", fontSize: "11pt" }}>
          <strong>RE:</strong> {subject}
        </div>
      )}

      {/* Body */}
      <div style={{ marginBottom: "32px", fontSize: "11pt", whiteSpace: "pre-wrap" }}>
        {body || " "}
      </div>

      {/* Seal + Signature block */}
      <div style={{ marginTop: "40px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        {/* Seal (left side, like the photo) */}
        {showSeal && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            <SealPlaceholder useActualSeal={useActualSeal} />
            <div style={{ fontSize: "8pt", color: "#777", letterSpacing: "0.5px", textAlign: "center" }}>
              {useActualSeal ? "Official Seal" : "[Seal Placement]"}
            </div>
          </div>
        )}

        {/* Signature block (right side) */}
        <div style={{ flex: 1, marginLeft: "40px" }}>
          <div style={{ borderTop: "1px solid #000", width: "260px", marginBottom: "4px" }} />
          <div style={{ fontSize: "11pt", fontWeight: 700 }}>{signerName || "Mathew-Allen McCaster, Chief Mathias El"}</div>
          <div style={{ fontSize: "10pt" }}>{signerTitle || "Chief Justice & Trustee"}</div>
          <div style={{ fontSize: "10pt", color: "#555" }}>Mathias El Tribe Supreme Court</div>
          <div style={{ fontSize: "9pt", color: "#555" }}>In His Sovereign Trustee Capacity</div>
        </div>
      </div>

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
          Additional delegates may be added via sovereign office order.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function OfficialDocumentsPage() {
  const { activeRole } = useAuth();
  const canAccess = ["trustee", "sovereign_admin"].includes(activeRole);

  const today = new Date();
  const [stampDate, setStampDate] = useState(formatStampDate(today));
  const [title, setTitle] = useState("SOVEREIGN ORDER");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(
    "To Whom It May Concern:\n\n\n\n\n\n"
  );
  const [signerName, setSignerName] = useState("Mathew-Allen McCaster, Chief Mathias El");
  const [signerTitle, setSignerTitle] = useState("Chief Justice & Trustee");
  const [useActualSeal, setUseActualSeal] = useState(true);
  const [showSeal, setShowSeal] = useState(true);

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Restricted — Chief Justice Office Only</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          Official Document printing is restricted to the Office of the Chief Justice &amp; Trustee. Contact the sovereign office to request delegation.
        </p>
      </div>
    );
  }

  const handlePrint = () => {
    const html = buildOfficialDocHtml({ stampDate, title, subject, body, signerName, signerTitle, useActualSeal, showSeal });
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
            Compose, stamp, and print sovereign office documents with official seal and date block.
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
                  <p className="text-[10px] text-muted-foreground">Format: MON DD YYYY (e.g. SEP 11 2025)</p>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Signature Block</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider">Signer Name</Label>
                  <Input value={signerName} onChange={e => setSignerName(e.target.value)} className="font-serif text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider">Title</Label>
                  <Input value={signerTitle} onChange={e => setSignerTitle(e.target.value)} className="text-sm" />
                </div>
              </CardContent>
            </Card>

            <DelegationPanel />

            <Card className="border-blue-200 dark:border-blue-800 no-print">
              <CardContent className="p-4">
                <div className="flex gap-2 text-xs text-blue-700 dark:text-blue-300">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    The stamp block and seal are printed in color on electronic documents. For physical seal placement, select "Seal placement outline" — a dashed circle will appear where you place your official stamp.
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
                signerName={signerName}
                signerTitle={signerTitle}
                useActualSeal={useActualSeal}
                showSeal={showSeal}
              />
            </div>
          </div>
        </div>
    </div>
  );
}
