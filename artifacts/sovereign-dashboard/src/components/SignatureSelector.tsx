import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PenLine, CheckCircle2, UserCheck } from "lucide-react";

const BASE = import.meta.env.BASE_URL ?? "/sovereign-dashboard/";
const API = BASE.replace(/\/$/, "").replace(/\/sovereign-dashboard$/, "") + "/api";

export interface OfficerSig {
  userId: number;
  name: string;
  signatureUrl: string;
}

export interface SlotAssignment {
  slot: "chief_justice" | "trustee";
  userId: number;
  signerName: string;
  signerTitle: string;
  signatureUrl: string;
}

interface Props {
  token: string;
  onChange: (assignments: SlotAssignment[]) => void;
  chiefJusticeTitle?: string;
  trusteeTitle?: string;
  compact?: boolean;
}

const SLOT_META = {
  chief_justice: {
    label: "Chief Justice",
    sublabel: "Judicial & Official Capacity",
    defaultTitle: "Chief Justice and Trustee",
  },
  trustee: {
    label: "Trustee / Legal Name",
    sublabel: "In Propria Persona",
    defaultTitle: "In His Sovereign Trustee Capacity",
  },
} as const;

export default function SignatureSelector({ token, onChange, chiefJusticeTitle, trusteeTitle, compact }: Props) {
  const [officers, setOfficers] = useState<OfficerSig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<"chief_justice" | "trustee", number | null>>({
    chief_justice: null,
    trustee: null,
  });

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/identity/signatures/officer`, { headers })
      .then((r) => r.ok ? r.json() : { signatures: [] })
      .then((d) => {
        const sigs: OfficerSig[] = d.signatures ?? [];
        setOfficers(sigs);
        if (sigs.length > 0) {
          const init: Record<"chief_justice" | "trustee", number | null> = {
            chief_justice: sigs[0].userId,
            trustee: sigs.length > 1 ? sigs[1].userId : sigs[0].userId,
          };
          setSelected(init);
          emitChange(init, sigs, chiefJusticeTitle, trusteeTitle);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function emitChange(
    sel: Record<"chief_justice" | "trustee", number | null>,
    sigs: OfficerSig[],
    cjTitle?: string,
    tTitle?: string,
  ) {
    const assignments: SlotAssignment[] = [];
    for (const slot of ["chief_justice", "trustee"] as const) {
      const uid = sel[slot];
      if (uid == null) continue;
      const officer = sigs.find((o) => o.userId === uid);
      if (!officer) continue;
      assignments.push({
        slot,
        userId: officer.userId,
        signerName: officer.name,
        signerTitle: slot === "chief_justice"
          ? (cjTitle ?? SLOT_META.chief_justice.defaultTitle)
          : (tTitle ?? SLOT_META.trustee.defaultTitle),
        signatureUrl: officer.signatureUrl,
      });
    }
    onChange(assignments);
  }

  function pick(slot: "chief_justice" | "trustee", userId: number) {
    const next = { ...selected, [slot]: userId };
    setSelected(next);
    emitChange(next, officers, chiefJusticeTitle, trusteeTitle);
  }

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground py-3 text-center">
        Loading officer signatures…
      </div>
    );
  }

  if (officers.length === 0) {
    return (
      <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-md p-3 leading-relaxed">
        No officer signatures on file. Upload a signature on the{" "}
        <a href={`${BASE}tribal-id`} className="underline font-medium">Tribal ID page</a>{" "}
        to enable signature embedding on documents.
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {(["chief_justice", "trustee"] as const).map((slot) => {
        const meta = SLOT_META[slot];
        const currentId = selected[slot];
        return (
          <div key={slot} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wide">
                {meta.label}
              </Badge>
              <span className="text-[10px] text-muted-foreground">{meta.sublabel}</span>
            </div>
            <div className="space-y-1.5">
              {officers.map((o) => {
                const active = currentId === o.userId;
                return (
                  <div
                    key={o.userId}
                    onClick={() => pick(slot, o.userId)}
                    className={`flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                      active
                        ? "border-amber-700 bg-amber-50 dark:bg-amber-950/20"
                        : "hover:bg-muted/40 border-transparent bg-muted/20"
                    }`}
                  >
                    {/* Signature preview */}
                    <div
                      className="rounded flex-shrink-0 overflow-hidden flex items-center justify-center"
                      style={{
                        width: 88,
                        height: 36,
                        background: active ? "rgba(180,120,0,0.06)" : "rgba(0,0,0,0.04)",
                        border: `1px solid ${active ? "rgba(180,120,0,0.25)" : "rgba(0,0,0,0.08)"}`,
                      }}
                    >
                      <img
                        src={o.signatureUrl}
                        alt={o.name}
                        style={{ maxWidth: 80, maxHeight: 30, objectFit: "contain", opacity: 0.85 }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight truncate">{o.name}</p>
                      <p className="text-[10px] text-muted-foreground">{meta.label} slot</p>
                    </div>

                    {active
                      ? <CheckCircle2 className="h-4 w-4 text-amber-700 flex-shrink-0" />
                      : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function useOfficerSignatures(token: string) {
  const [officers, setOfficers] = useState<OfficerSig[]>([]);
  const [loading, setLoading] = useState(true);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/identity/signatures/officer`, { headers })
      .then((r) => r.ok ? r.json() : { signatures: [] })
      .then((d) => setOfficers(d.signatures ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { officers, loading };
}
