import { createContext, useContext, useState, useEffect } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

type Role = "trustee" | "officer" | "member" | "admin";

interface User {
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
  trustee: { id: 1, email: "trustee@sovereign.local", roles: ["trustee", "admin"], name: "Chief Justice" },
  officer: { id: 2, email: "officer@sovereign.local", roles: ["officer"], name: "Duty Officer" },
  member: { id: 3, email: "member@sovereign.local", roles: ["member"], name: "Citizen" },
  admin: { id: 4, email: "admin@sovereign.local", roles: ["admin", "trustee"], name: "System Admin" }
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

  return (
    <AuthContext.Provider value={{ user, activeRole, switchRole: setActiveRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
