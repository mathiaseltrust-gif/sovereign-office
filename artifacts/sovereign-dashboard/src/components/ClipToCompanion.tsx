import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { Scissors, CheckCircle2 } from "lucide-react";

const MAX_CLIP_CHARS = 2000;
const MIN_CLIP_CHARS = 10;

function isInsideEditableArea(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  return !!(target.closest(
    'input, textarea, [contenteditable], select, ' +
    '[role="dialog"], [role="alertdialog"], ' +
    '[data-radix-dialog-content], [data-radix-alert-dialog-content], ' +
    '.fixed[role="dialog"], form'
  ));
}

function isSelectionInsideEditable(): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const el = container instanceof Element ? container : container.parentElement;
  if (!el) return false;
  return !!(el.closest(
    'input, textarea, [contenteditable], select, ' +
    '[role="dialog"], [role="alertdialog"], ' +
    '[data-radix-dialog-content], form'
  ));
}

function isModalOpen(): boolean {
  return !!(
    document.querySelector('[role="dialog"][data-state="open"]') ||
    document.querySelector('[data-radix-dialog-content]') ||
    document.querySelector('[data-radix-alert-dialog-content]') ||
    document.querySelector('.fixed[aria-modal="true"]')
  );
}

export function ClipToCompanion() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [clipping, setClipping] = useState(false);
  const [justClipped, setJustClipped] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (btnRef.current?.contains(e.target as Node)) return;

    if (isInsideEditableArea(e.target)) {
      setPos(null);
      setSelectedText("");
      return;
    }

    const active = document.activeElement;
    if (active && (
      active.tagName === "TEXTAREA" ||
      active.tagName === "INPUT" ||
      active.tagName === "SELECT" ||
      active.getAttribute("contenteditable") === "true"
    )) {
      setPos(null);
      setSelectedText("");
      return;
    }

    if (isModalOpen()) {
      setPos(null);
      setSelectedText("");
      return;
    }

    if (isSelectionInsideEditable()) {
      setPos(null);
      setSelectedText("");
      return;
    }

    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (text.length >= MIN_CLIP_CHARS) {
      const btnLeft = Math.min(e.clientX + 4, window.innerWidth - 200);
      const btnTop = e.clientY + 14;
      const companionZoneRight = window.innerWidth - 360;
      const companionZoneBottom = window.innerHeight - 60;
      if (btnLeft > companionZoneRight && btnTop > companionZoneBottom - 540) {
        setPos(null);
        setSelectedText("");
        return;
      }
      setSelectedText(text.substring(0, MAX_CLIP_CHARS));
      setPos({ x: e.clientX, y: e.clientY });
    } else {
      setPos(null);
      setSelectedText("");
    }
  }, []);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (btnRef.current?.contains(e.target as Node)) return;
    setPos(null);
    setSelectedText("");
    setJustClipped(false);
  }, []);

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [handleMouseUp, handleMouseDown]);

  const handleClip = async () => {
    if (!selectedText || !user || clipping) return;
    setClipping(true);
    try {
      const preview = selectedText.length > 60
        ? `${selectedText.substring(0, 60)}…`
        : selectedText;
      const r = await fetch("/api/kaya/knowledge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`,
        },
        body: JSON.stringify({
          content: selectedText,
          category: "clip",
        }),
      });
      if (!r.ok) throw new Error("Failed to clip");
      setSessionCount((c) => c + 1);
      setJustClipped(true);
      window.getSelection()?.removeAllRanges();
      toast({
        title: "Clipped to COMPANION",
        description: `"${preview}" — COMPANION will draw on this in your sessions.`,
      });
      setTimeout(() => {
        setPos(null);
        setSelectedText("");
        setJustClipped(false);
      }, 1200);
    } catch {
      toast({
        title: "Clip failed",
        description: "Could not save this passage.",
        variant: "destructive",
      });
    } finally {
      setClipping(false);
    }
  };

  if (!user || !pos) return null;

  const btnLeft = Math.min(pos.x + 4, window.innerWidth - 200);
  const btnTop = pos.y + 14;

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none">
      <button
        ref={btnRef}
        onClick={handleClip}
        disabled={clipping}
        className="pointer-events-auto absolute flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold shadow-xl transition-all duration-150 select-none"
        style={{
          left: btnLeft,
          top: btnTop,
          background: justClipped
            ? "linear-gradient(135deg, #0d2b0d 0%, #071407 100%)"
            : "linear-gradient(135deg, #2d1800 0%, #1a0c00 100%)",
          border: justClipped
            ? "1px solid rgba(100,200,100,0.55)"
            : "1px solid rgba(200,155,50,0.65)",
          color: justClipped
            ? "rgba(120,220,120,0.95)"
            : "rgba(228,190,90,0.95)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.55), 0 1px 0 rgba(200,155,50,0.12) inset",
          transform: "translateY(0)",
          opacity: 0.97,
        }}
      >
        {justClipped ? (
          <>
            <CheckCircle2 className="w-3 h-3" />
            Clipped
          </>
        ) : (
          <>
            <Scissors className="w-3 h-3" />
            {clipping ? "Saving…" : "Clip to COMPANION"}
            {sessionCount > 0 && (
              <span
                className="px-1 rounded-full text-[9px] font-bold"
                style={{
                  background: "rgba(200,155,50,0.20)",
                  color: "rgba(228,190,90,0.75)",
                }}
              >
                {sessionCount}
              </span>
            )}
          </>
        )}
      </button>
    </div>
  );
}
