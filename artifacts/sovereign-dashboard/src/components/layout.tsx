import { Link, useLocation } from "wouter";
import { useAuth } from "./auth-provider";

export function Layout({ children }: { children: React.ReactNode }) {
  const { activeRole, switchRole } = useAuth();
  const [location] = useLocation();

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-6 border-b">
          <h1 className="font-serif text-xl font-bold text-primary tracking-tight">Sovereign Office</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Chief Justice &amp; Trustee</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavLink href={`/dashboard/${activeRole}`} label="Dashboard" location={location} />
          <NavLink href="/instruments" label="Trust Instruments" location={location} />
          <NavLink href="/filings" label="Filings" location={location} />
          <NavLink href="/nfr" label="Notice of Federal Review" location={location} />
          <NavLink href="/welfare" label="Welfare Instruments" location={location} />
          <NavLink href="/documents" label="Court Documents" location={location} />
          <NavLink href="/classify" label="Classification" location={location} />
          <NavLink href="/complaints" label="Complaints" location={location} />
          <NavLink href="/tasks" label="Tasks" location={location} />
          <NavLink href="/calendar" label="Calendar" location={location} />
          <NavLink href="/notifications" label="Notifications" location={location} highlight />
          <NavLink href="/law" label="Law Library" location={location} />
          <NavLink href="/intake-ai" label="AI Intake Review" location={location} />
          <NavLink href="/search" label="Search" location={location} />
          {activeRole === "admin" && <NavLink href="/admin" label="Administration" location={location} />}
          <NavLink href="/profile" label="Profile &amp; Identity" location={location} />
          <NavLink href="/templates" label="Templates" location={location} />
        </nav>
        <div className="p-4 border-t">
          <select
            value={activeRole}
            onChange={(e) => switchRole(e.target.value as any)}
            className="w-full bg-input text-foreground border rounded p-2 text-sm"
          >
            <option value="trustee">Trustee View</option>
            <option value="officer">Officer View</option>
            <option value="member">Member View</option>
            <option value="admin">Admin View</option>
          </select>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-6xl mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavLink({ href, label, location, highlight }: { href: string; label: string; location: string; highlight?: boolean }) {
  const active = location === href || (href !== "/" && location.startsWith(href));
  return (
    <Link
      href={href}
      className={[
        "block px-3 py-2 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : highlight
          ? "text-orange-700 dark:text-orange-400 hover:bg-secondary hover:text-foreground font-semibold"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}
