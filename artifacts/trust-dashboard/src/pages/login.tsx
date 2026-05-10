import { useState } from "react";
import { useAuth } from "@/lib/auth";


const ROLES = [
  { value: "chief_justice", label: "Chief Justice & Trustee" },
  { value: "trustee", label: "Trustee" },
  { value: "officer", label: "Officer" },
  { value: "medical_provider", label: "Medical Provider" },
  { value: "elder", label: "Elder" },
  { value: "community_elder", label: "Community Elder" },
  { value: "family_elder", label: "Family Elder" },
  { value: "grandparent_elder", label: "Grandparent Elder" },
  { value: "adult", label: "Member (Adult)" },
  { value: "minor", label: "Member (Minor)" },
  { value: "visitor_media", label: "Visitor / Media" },
];

export default function Login() {
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("trustee");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    login({ id: "1", name: name.trim(), email: email.trim(), roles: [role] });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-4">
            <img src="/dashboard/tribal-seal.png" alt="Mathias El Tribe Seal" className="w-20 h-20 object-contain" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Mathias El Tribe</h1>
          <p className="text-sm text-muted-foreground mt-1">Office of the Chief Justice &amp; Trustee</p>
        </div>

        <div className="bg-card border border-card-border rounded-xl shadow-md p-6">
          <h2 className="text-base font-semibold mb-4 text-card-foreground">Sign In</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Chief Justice Name"
                className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="justice@sovereign.gov"
                className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Access Level</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            <button
              type="submit"
              className="w-full py-2 px-4 bg-primary text-primary-foreground text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
            >
              Access Dashboard
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4 leading-relaxed max-w-xs mx-auto">
          Mathias El Tribe — A Sovereign Nation Exercising Inherent Authority Under Tribal, Federal, and International Law.
        </p>
      </div>
    </div>
  );
}
