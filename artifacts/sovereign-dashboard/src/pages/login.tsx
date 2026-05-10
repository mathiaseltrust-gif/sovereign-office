import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth, type Role, roleLandingPath } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const DEV_ROLES: Array<{ role: Role; label: string; desc: string }> = [
  { role: "trustee", label: "Chief Justice & Trustee", desc: "Full court and trustee authority" },
  { role: "officer", label: "Duty Officer", desc: "Complaints, welfare, classification" },
  { role: "sovereign_admin", label: "Sovereign Admin", desc: "System configuration and admin" },
  { role: "member", label: "Citizen Member", desc: "Member portal and filings" },
  { role: "elder", label: "Tribal Elder", desc: "Cultural authority and lineage" },
  { role: "medical_provider", label: "Medical Provider", desc: "Clinical notes and patient care" },
  { role: "visitor_media", label: "Visitor / Media", desc: "Public records access only" },
];

const API_BASE = "/api";

export default function Login() {
  const { loginWithSessionToken, loginWithDevRole, user, activeRole } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const nextPath = params.get("next");
  const isExpired = params.get("expired") === "1";

  useEffect(() => {
    if (user) {
      const dest = nextPath ? decodeURIComponent(nextPath) : roleLandingPath(activeRole);
      navigate(dest, { replace: true });
    }
  }, [user, activeRole, nextPath, navigate]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [microsoftLoading, setMicrosoftLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleMicrosoftLogin() {
    setMicrosoftLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/microsoft/login`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Microsoft login unavailable" })) as { error?: string };
        toast({ title: "Microsoft login unavailable", description: err.error ?? "Contact your administrator.", variant: "destructive" });
        return;
      }
      const { authUrl, stateCookie } = await res.json() as { authUrl: string; stateCookie: string };
      document.cookie = `oauth_state=${encodeURIComponent(stateCookie)}; path=/; max-age=600; SameSite=Lax`;
      window.location.href = authUrl;
    } catch {
      toast({ title: "Error", description: "Could not reach the authentication server.", variant: "destructive" });
    } finally {
      setMicrosoftLoading(false);
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    if (!email.trim() || !password) return;
    setPasswordLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json() as { sessionToken?: string; user?: { id: number; email: string; name: string; role: string }; error?: string; code?: string };
      if (!res.ok) {
        if (data.code === "NO_PASSWORD") {
          setPasswordError("This account uses Microsoft sign-in. Please use the button above.");
        } else {
          setPasswordError(data.error ?? "Login failed.");
        }
        return;
      }
      if (data.sessionToken && data.user) {
        loginWithSessionToken(data.sessionToken, {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          roles: [data.user.role],
        });
      }
    } catch {
      setPasswordError("Could not reach the server. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  }

  function handleDevLogin(role: Role) {
    loginWithDevRole(role);
    toast({ title: "Signed in", description: `Viewing as ${role.replace(/_/g, " ")}` });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img
            src={`${import.meta.env.BASE_URL}tribal-seal.png`}
            alt="Office of the Chief Justice and Trustee"
            className="w-20 h-20 object-contain mx-auto mb-4 drop-shadow-md"
          />
          <h1 className="font-serif text-2xl font-bold text-foreground">Office of the Chief Justice and Trustee</h1>
          <p className="text-sm text-muted-foreground mt-1">Mathias El Tribe — Sovereign Administration Dashboard</p>
        </div>

        {isExpired && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your session has expired. Please sign in again.
          </div>
        )}

        <Card className="mb-4">
          <CardContent className="pt-6 space-y-4">
            <Button
              className="w-full h-11 text-sm font-medium gap-3"
              onClick={handleMicrosoftLogin}
              disabled={microsoftLoading}
              data-testid="button-microsoft-login"
            >
              <svg width="18" height="18" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              {microsoftLoading ? "Redirecting to Microsoft…" : "Sign in with Microsoft"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-2 text-muted-foreground">or sign in with email</span>
              </div>
            </div>

            {!showPassword ? (
              <button
                onClick={() => setShowPassword(true)}
                className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                Use email & password instead
              </button>
            ) : (
              <form onSubmit={handlePasswordLogin} className="space-y-3">
                <div>
                  <Label htmlFor="email" className="text-xs">Email</Label>
                  <Input
                    id="email"
                    data-testid="input-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setPasswordError(""); }}
                    placeholder="you@mathiasel.tribe"
                    className="mt-1 h-9 text-sm"
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password" className="text-xs">Password</Label>
                  <Input
                    id="password"
                    data-testid="input-password"
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
                    placeholder="••••••••"
                    className="mt-1 h-9 text-sm"
                    required
                  />
                </div>
                {passwordError && (
                  <p className="text-xs text-destructive">{passwordError}</p>
                )}
                <Button type="submit" className="w-full" data-testid="button-password-login" disabled={passwordLoading || !email.trim() || !password}>
                  {passwordLoading ? "Signing in…" : "Sign In"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {import.meta.env.DEV && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-widest">Dev Access</CardTitle>
              <p className="text-xs text-muted-foreground">Quick access for development — not available in production.</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {DEV_ROLES.map(({ role, label, desc }) => (
                  <button
                    key={role}
                    data-testid={`button-dev-login-${role}`}
                    onClick={() => handleDevLogin(role)}
                    className="text-left px-3 py-2 rounded-md border border-border hover:border-primary hover:bg-primary/5 transition-colors group"
                  >
                    <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors leading-tight">{label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{desc}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          Mathias El Tribe — A Sovereign Nation Exercising Inherent Authority Under Tribal, Federal, and International Law.
        </p>
      </div>
    </div>
  );
}
