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
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Chief Justice & Trustee</p>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavLink href={`/dashboard/${activeRole}`} label="Dashboard" />
          <NavLink href="/instruments" label="Trust Instruments" />
          <NavLink href="/filings" label="Filings" />
          <NavLink href="/nfr" label="NFR Documents" />
          <NavLink href="/welfare" label="Welfare Instruments" />
          <NavLink href="/classify" label="Classification" />
          <NavLink href="/complaints" label="Complaints" />
          <NavLink href="/tasks" label="Tasks" />
          <NavLink href="/calendar" label="Calendar" />
          <NavLink href="/search" label="Search" />
          {activeRole === "admin" && <NavLink href="/admin" label="Administration" />}
          <NavLink href="/profile" label="Profile" />
          <NavLink href="/templates" label="Templates" />
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

function NavLink({ href, label }: { href: string; label: string }) {
  const [location] = useLocation();
  const active = location.startsWith(href);
  return (
    <Link href={href} className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
      {label}
    </Link>
  );
}
