const SOVEREIGN_LOGIN =
  typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? `${window.location.origin}/sovereign-dashboard/login?next=${encodeURIComponent(window.location.href)}`
    : `/sovereign-dashboard/login`;

export function SignInPrompt() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="max-w-sm w-full mx-4 text-center">
        <img
          src="/authority-directory/tribal-seal.png"
          alt="Mathias El Tribe Seal"
          className="mx-auto mb-5 h-20 w-20 object-contain"
        />
        <h1 className="text-xl font-semibold text-foreground mb-2">Authentication Required</h1>
        <p className="text-sm text-muted-foreground mb-6">
          This dashboard requires a valid Sovereign Office session.<br />
          Please sign in via the Sovereign Dashboard to continue.
        </p>
        <a
          href={SOVEREIGN_LOGIN}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Sign In via Sovereign Office
        </a>
      </div>
    </div>
  );
}
