import { ShieldAlert } from "lucide-react";

export function SignInPrompt() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="max-w-sm w-full mx-4 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <ShieldAlert className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">Authentication Required</h1>
        <p className="text-sm text-muted-foreground mb-6">
          This dashboard requires a valid Sovereign Office session. Please sign in via the Sovereign Dashboard to continue.
        </p>
        <a
          href={`https://office.mathiaseltribe.org/login?next=${encodeURIComponent(window.location.href)}`}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium border border-primary-border hover-elevate active-elevate-2 transition-colors"
        >
          Sign In via Sovereign Office
        </a>
      </div>
    </div>
  );
}
