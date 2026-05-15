import { useState, useEffect } from "react";
import { getCurrentBearerToken } from "@/components/auth-provider";

interface GreetingResponse {
  greeting: string;
  source: string;
  name: string;
  role: string;
  awakeningLevel: number;
  intakeCount: number;
  documentCount: number;
  isNewMember: boolean;
}

const AWAKENING_LABELS: Record<number, string> = {
  1: "Emerging", 2: "Emerging", 3: "Awakening", 4: "Awakening",
  5: "Rising", 6: "Rising", 7: "Sovereign", 8: "Sovereign",
  9: "Elder", 10: "Elder",
};

export function ElderGreeting() {
  const [data, setData] = useState<GreetingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getCurrentBearerToken() ?? "";
    fetch("/api/memory/greeting", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() as Promise<GreetingResponse> : Promise.reject())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-amber-200/50 bg-gradient-to-r from-amber-50/70 to-transparent px-5 py-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-200/60 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-amber-200/60 rounded animate-pulse w-1/3" />
            <div className="h-3.5 bg-amber-200/40 rounded animate-pulse w-4/5" />
            <div className="h-3.5 bg-amber-200/30 rounded animate-pulse w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const awakeningLabel = AWAKENING_LABELS[Math.min(10, Math.max(1, data.awakeningLevel))] ?? "Rising";
  const awakeningPct = Math.round((data.awakeningLevel / 10) * 100);

  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-amber-50/60 to-transparent px-5 py-4 mb-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-amber-100 font-serif text-xl font-bold select-none shadow-inner"
          style={{ background: "linear-gradient(135deg, #78350f 0%, #92400e 50%, #b45309 100%)" }}
          title="Elder Kaya — Sovereign Memory Guide"
        >
          K
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-xs font-bold text-amber-900 tracking-wide">Elder Kaya</span>
            <span className="text-[10px] text-amber-700/60">· Sovereign Memory Guide</span>
            {!data.isNewMember && (
              <span className="text-[10px] bg-amber-900/10 text-amber-900 rounded-full px-2 py-0.5 font-semibold">
                Level {data.awakeningLevel} · {awakeningLabel}
              </span>
            )}
          </div>

          <p className="text-sm text-amber-950 leading-relaxed italic">{data.greeting}</p>

          {!data.isNewMember && (
            <div className="mt-2.5 flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <div className="h-1.5 flex-1 rounded-full bg-amber-200/60 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-700 transition-all duration-700"
                    style={{ width: `${awakeningPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-amber-700/70 shrink-0">{awakeningPct}% awakened</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-amber-700/60 shrink-0">
                {data.intakeCount > 0 && (
                  <span>{data.intakeCount} case{data.intakeCount !== 1 ? "s" : ""} reviewed</span>
                )}
                {data.documentCount > 0 && (
                  <span>{data.documentCount} doc{data.documentCount !== 1 ? "s" : ""} recalled</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
