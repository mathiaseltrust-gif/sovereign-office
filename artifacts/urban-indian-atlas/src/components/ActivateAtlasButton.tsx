import { Globe2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActivateAtlasButtonProps {
  atlasMode: boolean;
  onToggle: () => void;
  ancestorCount?: number;
  loading?: boolean;
}

export function ActivateAtlasButton({ atlasMode, onToggle, ancestorCount, loading }: ActivateAtlasButtonProps) {
  if (atlasMode) {
    return (
      <Button
        variant="default"
        size="sm"
        className="text-xs gap-2 h-8 bg-primary text-primary-foreground"
        onClick={onToggle}
        data-testid="atlas-mode-active-button"
      >
        <Globe2 className="w-3.5 h-3.5" />
        Atlas Mode
        {ancestorCount !== undefined && ancestorCount > 0 && (
          <span className="ml-1 bg-white/20 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none">
            {ancestorCount}
          </span>
        )}
        <X className="w-3 h-3 opacity-60 ml-0.5" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-xs gap-2 h-8 border-primary/40 text-primary hover:bg-primary/5"
      onClick={onToggle}
      disabled={loading}
      data-testid="activate-atlas-button"
    >
      <Globe2 className="w-3.5 h-3.5" />
      {loading ? "Loading…" : "Activate Atlas Mode"}
    </Button>
  );
}
