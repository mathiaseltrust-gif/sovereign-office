import { useEffect } from "react";
import { Globe2, ExternalLink, ArrowRight } from "lucide-react";

const ATLAS_URL = "/urban-indian-atlas/?mode=atlas";

/**
 * Ancestral Exposure Filter — now integrated into the Urban Indian Continuity Atlas.
 *
 * This page redirects to the Atlas, which is the canonical interface for this
 * analysis. The Atlas adds:
 *   • Tribal territory layers tied to the timeline filter
 *   • Ancestor location markers from actual records vs. inferred
 *   • Time-aware map showing which nations existed in which regions by era
 *   • Family clustering and per-ancestor migration arcs
 *
 * All filter logic (temporal overlap, location match, policy era exposure) is
 * implemented in the Atlas. This page is retained only as a redirect stub.
 */
export default function AncestralExposure() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = ATLAS_URL;
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
            <Globe2 className="w-7 h-7 text-primary animate-pulse" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">
            Opening the Continuity Atlas…
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The Ancestral Exposure Filter is now integrated into the{" "}
            <strong className="text-foreground">Urban Indian Continuity Atlas</strong>{" "}
            — the canonical interface combining the exposure engine with tribal territory
            layers, ancestor location records, and a time-aware map.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center text-[10px] text-muted-foreground/70">
          <span className="bg-muted/30 border border-border/40 px-2.5 py-1 rounded-full">Tribal Territories (time-aware)</span>
          <span className="bg-muted/30 border border-border/40 px-2.5 py-1 rounded-full">Ancestor Locations from Records</span>
          <span className="bg-muted/30 border border-border/40 px-2.5 py-1 rounded-full">Family Clustering</span>
          <span className="bg-muted/30 border border-border/40 px-2.5 py-1 rounded-full">Migration Arcs</span>
          <span className="bg-muted/30 border border-border/40 px-2.5 py-1 rounded-full">Full Exposure Filter Taxonomy</span>
        </div>

        <a
          href={ATLAS_URL}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          data-testid="atlas-redirect-cta"
        >
          <Globe2 className="w-4 h-4" />
          Open Continuity Atlas
          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
        </a>

        <p className="text-[10px] text-muted-foreground/50 flex items-center justify-center gap-1">
          <ArrowRight className="w-3 h-3" />
          Redirecting automatically in a moment…
        </p>
      </div>
    </div>
  );
}
