import { createContext, useContext, useState, useEffect } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export type Role = "trustee" | "officer" | "member" | "sovereign_admin";

export interface User {
  id: number;
  email: string;
  roles: Role[];
  name: string;
}

interface AuthContextType {
  user: User;
  activeRole: Role;
  switchRole: (role: Role) => void;
}

const DEV_USERS: Record<Role, User> = {
  trustee: {
    id: 1,
    email: "cjt@sovereign.local",
    roles: ["trustee"],
    name: "Chief Justice & Trustee",
  },
  officer: {
    id: 2,
    email: "officer@sovereign.local",
    roles: ["officer"],
    name: "Duty Officer",
  },
  member: {
    id: 3,
    email: "member@sovereign.local",
    roles: ["member"],
    name: "Citizen Member",
  },
  sovereign_admin: {
    id: 4,
    email: "admin@sovereign.local",
    roles: ["sovereign_admin", "trustee"],
    name: "System Administrator",
  },
};

const makeToken = (user: User) => btoa(JSON.stringify(user));

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [activeRole, setActiveRole] = useState<Role>("trustee");
  const user = DEV_USERS[activeRole];

  setAuthTokenGetter(() => makeToken(user));

  useEffect(() => {
    return () => { setAuthTokenGetter(null); };
  }, []);

  function switchRole(role: Role) {
    setActiveRole(role);
  }

  return (
    <AuthContext.Provider value={{ user, activeRole, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

export function useIsAdmin() {
  const { activeRole } = useAuth();
  return activeRole === "sovereign_admin";
}

export function useIsTrustee() {
  const { activeRole } = useAuth();
  return activeRole === "trustee" || activeRole === "sovereign_admin";
}

export function useIsOfficer() {
  const { activeRole } = useAuth();
  return activeRole === "officer" || activeRole === "trustee" || activeRole === "sovereign_admin";
}

export function roleLandingPath(role: Role): string {
  switch (role) {
    case "trustee": return "/dashboard/trustee";
    case "officer": return "/dashboard/officer";
    case "member": return "/dashboard/member";
    case "sovereign_admin": return "/dashboard/admin";
  }
}
