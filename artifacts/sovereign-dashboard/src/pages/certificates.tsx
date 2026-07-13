import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText, Award, Search, Download, CheckCircle2,
  PenLine, Shield, Plus, RefreshCw, Upload, AlertCircle,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL ?? "/sovereign-dashboard/";
const API = BASE.replace(/\/$/, "").replace(/\/sovereign-dashboard$/, "") + "/api";

interface Member {
  id: number;
  fullName: string;
  tribalEnrollmentNumber: string | null;
  birthYear: number | null;
  birthDate: string | null;
  membershipStatus: string;
  locationAddress: string | null;
}

interface Certificate {
  id: number;
  certNumber: string;
  memberName: string;
  memberEnrollment: string | null;
  membershipType: string;
  signaturesApplied: string[];
  issuedAt: string;
  status: string;
  storageObjectPath: string | null;
}

interface SignatureSlot {
  id: number;
  slot: string;
  signerName: string;
  signerTitle: string;
  hasImage: boolean;
  isActive: boolean;
}

function slotLabel(slot: string): string {
  return slot === "chief_justice" ? "Chief Justice" : "Trustee";
}

function memberTypeLabel(t: string): string {
  const map: Record<string, string> = {
    lineal_descendant: "Lineal Descendant",
    adoptive_descendant: "Adoptive — Protective Member",
    elder: "Elder Member",
    minor_lineal: "Minor — Lineal",
    minor_adoptive: "Minor — Adoptive",
  };
  return map[t] ?? t;
}

export default function CertificatesPage() {
  const { token } = useAuth();

  const [memberSearch, setMemberSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);

  const [sigSlots, setSigSlots] = useState<SignatureSlot[]>([]);
  const [applySlots, setApplySlots] = useState<string[]>(["chief_justice", "trustee"]);

  const [certs, setCerts] = useState<Certificate[]>([]);
  const [issuing, setIssuing] = useState(false);
  const [lastIssued, setLastIssued] = useState<{ certNumber: string; memberName: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editSlot, setEditSlot] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [savingSlot, setSavingSlot] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    loadSigSlots();
    loadCerts();
  }, []);

  async function loadSigSlots() {
    try {
      const r = await fetch(`${API}/certificates/signatures/slots`, { headers });
      if (r.ok) {
        const d = await r.json();
        setSigSlots(d.signatures ?? []);
      }
    } catch { /* silent */ }
  }

  async function loadCerts() {
    try {
      const r = await fetch(`${API}/certificates`, { headers });
      if (r.ok) {
        const d = await r.json();
        setCerts(d.certificates ?? []);
      }
    } catch { /* silent */ }
  }

  async function searchMembers(q: string) {
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const r = await fetch(`${API}/lineage/nodes?search=${encodeURIComponent(q)}&limit=20`, { headers });
      if (r.ok) {
        const d = await r.json();
        const nodes = d.nodes ?? d ?? [];
        setSearchResults(Array.isArray(nodes) ? nodes.slice(0, 10) : []);
      }
    } catch { /* silent */ }
    setSearching(false);
  }

  function toggleMember(m: Member) {
    setSelectedMembers((prev) =>
      prev.find((x) => x.id === m.id)
        ? prev.filter((x) => x.id !== m.id)
        : [...prev, m],
    );
  }

  async function issueCerts() {
    if (selectedMembers.length === 0) return;
    setIssuing(true);
    setError(null);
    setLastIssued(null);
    try {
      const r = await fetch(`${API}/certificates/membership`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          memberIds: selectedMembers.map((m) => m.id),
          applySignatures: applySlots,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Failed to issue certificates"); return; }
      setLastIssued(d.issued ?? []);
      setSelectedMembers([]);
      setSearchResults([]);
      setMemberSearch("");
      await loadCerts();
    } catch (e) {
      setError("Network error — please try again");
    } finally {
      setIssuing(false);
    }
  }

  async function saveSlot() {
    if (!editSlot) return;
    setSavingSlot(true);
    try {
      await fetch(`${API}/certificates/signatures/${editSlot}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ signerName: editName, signerTitle: editTitle }),
      });
      setEditSlot(null);
      await loadSigSlots();
    } catch { /* silent */ }
    setSavingSlot(false);
  }

  function openEdit(slot: SignatureSlot) {
    setEditSlot(slot.slot);
    setEditName(slot.signerName);
    setEditTitle(slot.signerTitle);
  }

  async function downloadCert(certNumber: string) {
    const r = await fetch(`${API}/certificates/${certNumber}`, { headers });
    if (!r.ok) return;
    const d = await r.json();
    if (d.downloadUrl) window.open(d.downloadUrl, "_blank");
  }

  return (
    <div className="min-h-screen bg-background p-6 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Award className="h-7 w-7 text-amber-700" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Certificate Issuance</h1>
          <p className="text-sm text-muted-foreground">
            Office of the Chief Justice and Trustee — Mathias El Tribe
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: Issue Panel ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Member search */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" /> Select Members
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Search by name…"
                  value={memberSearch}
                  onChange={(e) => {
                    setMemberSearch(e.target.value);
                    searchMembers(e.target.value);
                  }}
                />
                {searching && <RefreshCw className="h-4 w-4 animate-spin mt-2 text-muted-foreground" />}
              </div>

              {searchResults.length > 0 && (
                <ScrollArea className="h-48 border rounded-md">
                  {searchResults.map((m) => {
                    const selected = !!selectedMembers.find((x) => x.id === m.id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleMember(m)}
                        className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/50 border-b last:border-0 ${selected ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}
                      >
                        <div>
                          <p className="text-sm font-medium">{m.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {m.tribalEnrollmentNumber ?? "No enrollment #"}
                            {m.birthYear ? ` · b. ${m.birthYear}` : ""}
                          </p>
                        </div>
                        {selected && <CheckCircle2 className="h-4 w-4 text-amber-700 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </ScrollArea>
              )}

              {selectedMembers.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Selected</p>
                  {selectedMembers.map((m) => (
                    <div key={m.id} className="flex items-center justify-between bg-muted/30 rounded px-3 py-1.5">
                      <span className="text-sm font-medium">{m.fullName}</span>
                      <button
                        onClick={() => toggleMember(m)}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Signature selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PenLine className="h-4 w-4" /> Apply Signatures
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sigSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading signature slots…</p>
              ) : (
                <div className="space-y-2">
                  {sigSlots.map((s) => {
                    const active = applySlots.includes(s.slot);
                    return (
                      <div
                        key={s.slot}
                        onClick={() =>
                          setApplySlots((prev) =>
                            active ? prev.filter((x) => x !== s.slot) : [...prev, s.slot],
                          )
                        }
                        className={`flex items-center justify-between border rounded-lg px-4 py-3 cursor-pointer transition-colors ${active ? "border-amber-700 bg-amber-50 dark:bg-amber-950/20" : "hover:bg-muted/40"}`}
                      >
                        <div>
                          <p className="text-sm font-semibold">{slotLabel(s.slot)} Signature</p>
                          <p className="text-xs text-muted-foreground">{s.signerName} — {s.signerTitle}</p>
                          {s.hasImage
                            ? <p className="text-xs text-green-600 mt-0.5">✓ Signature image on file</p>
                            : <p className="text-xs text-amber-600 mt-0.5">No image — will use signature line</p>}
                        </div>
                        {active
                          ? <CheckCircle2 className="h-5 w-5 text-amber-700 flex-shrink-0" />
                          : <div className="h-5 w-5 rounded-full border-2 border-muted-foreground flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Issue button */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
          )}

          {lastIssued && (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-lg px-4 py-3 space-y-1">
              <p className="text-sm font-semibold text-green-800 dark:text-green-400">
                ✓ {lastIssued.length} certificate{lastIssued.length > 1 ? "s" : ""} issued and stored
              </p>
              {lastIssued.map((c) => (
                <p key={c.certNumber} className="text-xs text-green-700 dark:text-green-500">
                  {c.certNumber} — {c.memberName}
                </p>
              ))}
            </div>
          )}

          <Button
            onClick={issueCerts}
            disabled={selectedMembers.length === 0 || issuing}
            className="w-full bg-amber-700 hover:bg-amber-800 text-white"
          >
            {issuing
              ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Generating…</>
              : <><Plus className="h-4 w-4 mr-2" /> Issue {selectedMembers.length > 1 ? `${selectedMembers.length} Certificates` : "Certificate"}</>}
          </Button>
        </div>

        {/* ── Right: Signature Management ── */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" /> Signature Slots
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sigSlots.map((s) => (
                <div key={s.slot} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {slotLabel(s.slot)}
                    </Badge>
                    <button
                      onClick={() => openEdit(s)}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      edit
                    </button>
                  </div>
                  <p className="text-sm font-medium leading-tight">{s.signerName}</p>
                  <p className="text-xs text-muted-foreground">{s.signerTitle}</p>
                  <div className="flex items-center gap-1.5 text-xs">
                    {s.hasImage
                      ? <><CheckCircle2 className="h-3 w-3 text-green-600" /><span className="text-green-600">Image on file</span></>
                      : <><Upload className="h-3 w-3 text-amber-600" /><span className="text-amber-600">No image yet</span></>}
                  </div>
                </div>
              ))}

              <p className="text-xs text-muted-foreground pt-1">
                To upload a signature image, use the file storage system and paste the object path here.
              </p>
            </CardContent>
          </Card>

          {/* Edit slot panel */}
          {editSlot && (
            <Card className="border-amber-300 dark:border-amber-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Edit {slotLabel(editSlot)} Slot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Signer Name</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Signer Title</Label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveSlot} disabled={savingSlot} className="flex-1 bg-amber-700 hover:bg-amber-800 text-white">
                    {savingSlot ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditSlot(null)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Separator />

      {/* ── Issued Certificates Log ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-700" />
            Issued Certificates
          </h2>
          <Button variant="outline" size="sm" onClick={loadCerts}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
        </div>

        {certs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No certificates issued yet. Use the panel above to issue your first certificate.
          </div>
        ) : (
          <div className="space-y-2">
            {certs.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between border rounded-lg px-4 py-3 hover:bg-muted/30"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-mono font-semibold text-amber-800 dark:text-amber-400">
                      {c.certNumber}
                    </p>
                    <p className="text-sm font-medium">{c.memberName}</p>
                    <p className="text-xs text-muted-foreground">
                      {memberTypeLabel(c.membershipType)} · {new Date(c.issuedAt).toLocaleDateString()}
                      {c.signaturesApplied?.length > 0
                        ? ` · Signed: ${(c.signaturesApplied as string[]).map(slotLabel).join(", ")}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={c.status === "active" ? "default" : "secondary"}
                    className={c.status === "active" ? "bg-green-700" : ""}
                  >
                    {c.status}
                  </Badge>
                  {c.storageObjectPath && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadCert(c.certNumber)}
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" /> PDF
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
