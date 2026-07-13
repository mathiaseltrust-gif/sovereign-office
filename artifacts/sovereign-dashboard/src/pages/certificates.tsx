import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText, Award, Search, Download, CheckCircle2,
  PenLine, Shield, Plus, RefreshCw, AlertCircle,
} from "lucide-react";
import SignatureSelector, { type SlotAssignment } from "@/components/SignatureSelector";

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

  const [signatureAssignments, setSignatureAssignments] = useState<SlotAssignment[]>([]);

  const [certs, setCerts] = useState<Certificate[]>([]);
  const [issuing, setIssuing] = useState(false);
  const [lastIssued, setLastIssued] = useState<{ certNumber: string; memberName: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    loadCerts();
  }, []);

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
          signatureAssignments: signatureAssignments.length > 0 ? signatureAssignments : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Failed to issue certificates"); return; }
      setLastIssued(d.issued ?? []);
      setSelectedMembers([]);
      setSearchResults([]);
      setMemberSearch("");
      await loadCerts();
    } catch {
      setError("Network error — please try again");
    } finally {
      setIssuing(false);
    }
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
              <SignatureSelector
                token={token ?? ""}
                onChange={setSignatureAssignments}
                chiefJusticeTitle="Chief Justice and Trustee"
                trusteeTitle="Office of the Chief Justice and Trustee"
              />
              {signatureAssignments.length > 0 && (
                <div className="mt-3 pt-3 border-t space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Will embed on certificate PDF:</p>
                  {signatureAssignments.map((a) => (
                    <div key={a.slot} className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{slotLabel(a.slot)} — {a.signerName}</span>
                    </div>
                  ))}
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

        {/* ── Right: Issued Log ── */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" /> Recent Certificates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {certs.slice(0, 5).length === 0 ? (
                <p className="text-sm text-muted-foreground">No certificates yet.</p>
              ) : (
                certs.slice(0, 5).map((c) => (
                  <div key={c.id} className="border rounded-md p-2.5 space-y-0.5">
                    <p className="text-xs font-mono font-semibold text-amber-800 dark:text-amber-400">{c.certNumber}</p>
                    <p className="text-xs font-medium leading-tight">{c.memberName}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant={c.status === "active" ? "default" : "secondary"} className={`text-[9px] ${c.status === "active" ? "bg-green-700" : ""}`}>
                        {c.status}
                      </Badge>
                      {(c.signaturesApplied as string[] ?? []).map((s) => (
                        <Badge key={s} variant="outline" className="text-[9px] border-amber-500 text-amber-700 dark:text-amber-400">
                          {slotLabel(s)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* ── Issued Certificates Log ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-700" />
            All Issued Certificates
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
                      {(c.signaturesApplied as string[] ?? []).length > 0
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
