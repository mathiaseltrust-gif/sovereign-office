function getSovereignLoginUrl() {
  if (typeof window === "undefined") return "/sovereign-dashboard/login";
  const { hostname, origin } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "/sovereign-dashboard/login";
  }
  return `${origin}/sovereign-dashboard/login`;
}

export function SignInPrompt() {
  const loginUrl = getSovereignLoginUrl();

  function handleSignIn(e: React.MouseEvent) {
    e.preventDefault();
    window.open(loginUrl, "_blank", "noopener,noreferrer");
  }

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
          Sign in via the Sovereign Dashboard, then return here.
        </p>
        <a
          href={loginUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleSignIn}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Sign In via Sovereign Office
        </a>
        <p className="mt-4 text-xs text-muted-foreground">
          After signing in, return to this tab and refresh.
        </p>
      </div>
    </div>
  );
}
