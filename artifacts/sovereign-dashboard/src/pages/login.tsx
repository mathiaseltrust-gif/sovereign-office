import { useState } from "react";
import { useAuth, type Role } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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

export default function Login() {
  const { loginWithToken, loginWithDevRole } = useAuth();
  const { toast } = useToast();
  const [token, setToken] = useState("");
  const [tokenError, setTokenError] = useState("");

  function handleTokenLogin(e: React.FormEvent) {
    e.preventDefault();
    setTokenError("");
    const ok = loginWithToken(token);
    if (!ok) {
      setTokenError("Invalid token. Paste a valid base64-encoded JSON token from the API.");
    }
  }

  function handleDevLogin(role: Role) {
    loginWithDevRole(role);
    toast({ title: "Signed in", description: `Viewing as ${role.replace("_", " ")}` });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <img
            src="/sovereign-dashboard/tribal-seal.png"
            alt="Office of the Chief Justice and Trustee"
            className="w-20 h-20 object-contain mx-auto mb-4 drop-shadow-md"
          />
          <h1 className="font-serif text-2xl font-bold text-foreground">Office of the Chief Justice and Trustee</h1>
          <p className="text-sm text-muted-foreground mt-1">Mathias El Tribe — Sovereign Administration Dashboard</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-widest">Token Login</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Paste your base64-encoded JSON token. Use the format shown below, or generate one from your API server.</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTokenLogin} className="space-y-3">
                <Textarea
                  data-testid="input-token"
                  value={token}
                  onChange={(e) => { setToken(e.target.value); setTokenError(""); }}
                  rows={5}
                  placeholder={`Paste base64 token here…\n\nFormat: btoa(JSON.stringify({id, email, roles, name}))`}
                  className="font-mono text-xs resize-none"
                />
                {tokenError && (
                  <p className="text-xs text-destructive">{tokenError}</p>
                )}
                <Button type="submit" className="w-full" data-testid="button-token-login" disabled={!token.trim()}>
                  Sign In with Token
                </Button>
              </form>
              <div className="mt-4 p-3 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground font-semibold mb-1">Generate a dev token:</p>
                <code className="text-xs text-muted-foreground break-all">
                  {"btoa(JSON.stringify({id:'1',email:'cj@tribe.gov',roles:['chief_justice'],name:'CJ'}))"}
                </code>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-widest">Dev Access</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Quick access for development and demonstration — no token required.</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {DEV_ROLES.map(({ role, label, desc }) => (
                  <button
                    key={role}
                    data-testid={`button-dev-login-${role}`}
                    onClick={() => handleDevLogin(role)}
                    className="w-full text-left px-3 py-2.5 rounded-md border border-border hover:border-primary hover:bg-primary/5 transition-colors group"
                  >
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Mathias El Tribe — A Sovereign Nation Exercising Inherent Authority Under Tribal, Federal, and International Law.
        </p>
      </div>
    </div>
  );
}
