import { useState } from "react";
import { Link } from "wouter";

export function ChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-card shadow-xl p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">COMPANION</p>
            <p className="text-xs text-muted-foreground mt-1">
              Performance mode is active. Companion opens only when you choose a workflow.
            </p>
          </div>
          <div className="grid gap-2">
            <Link href="/intake-companion">
              <button className="w-full rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">
                Open Companion Intake
              </button>
            </Link>
            <Link href="/intake-ai">
              <button className="w-full rounded-md border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">
                Open AI Review
              </button>
            </Link>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full border bg-card px-4 py-2 text-xs font-semibold shadow-lg hover:bg-muted"
        aria-expanded={open}
        aria-label="Open Companion"
      >
        Companion
      </button>
    </div>
  );
}
