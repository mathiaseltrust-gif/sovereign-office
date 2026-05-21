import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, CheckCircle2, XCircle, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { api, TraceAccessUser, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SessionExpiredBanner } from "@/App";
import { getAuthState } from "@/lib/auth";

export default function AccessPage() {
  const qc = useQueryClient();
  const auth = getAuthState();
  const isSovereignAdmin = auth?.user.roles.includes("sovereign_admin") ?? false;

  const { data, isLoading, error } = useQuery({
    queryKey: ["trace-access"],
    queryFn: () => api.getAccessUsers(),
    enabled: isSovereignAdmin,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ userId, grant }: { userId: number; grant: boolean }) =>
      api.setAccess(userId, grant),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trace-access"] }),
  });

  const is401 = (error as ApiError)?.status === 401;
  const is403 = (error as ApiError)?.status === 403;
  const users = data?.users ?? [];

  const sovereignUsers = users.filter(u =>
    ["sovereign_admin", "admin", "chief_justice", "officer"].includes(u.role)
  );
  const otherUsers = users.filter(u =>
    !["sovereign_admin", "admin", "chief_justice", "officer"].includes(u.role)
  );

  if (!isSovereignAdmin) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Users className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Access Management</h1>
        </div>
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-medium">Sovereign Admin Required</span>
          </div>
          <p className="text-xs">
            Only sovereign administrators (role: sovereign_admin) can manage TRACE access grants. Contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Users className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold text-foreground">Access Management</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Grant or revoke TRACE portal access for members. Officers and admins have automatic access; only Sovereign Admins may manage grants.
      </p>

      {is401 ? (
        <SessionExpiredBanner />
      ) : is403 ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Access denied. Sovereign Admin role required.
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading users…
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load users.
        </div>
      ) : (
        <div className="space-y-6">
          {sovereignUsers.length > 0 && (
            <UserGroup
              title="Sovereign Officers & Admins"
              subtitle="Automatic access — cannot be revoked"
              users={sovereignUsers}
              autoAccess
              onToggle={() => {}}
              isPending={false}
            />
          )}

          <UserGroup
            title="Members"
            subtitle="Explicit access grant required"
            users={otherUsers}
            autoAccess={false}
            onToggle={(userId, grant) => toggleMutation.mutate({ userId, grant })}
            isPending={toggleMutation.isPending}
          />
        </div>
      )}
    </div>
  );
}

function UserGroup({
  title,
  subtitle,
  users,
  autoAccess,
  onToggle,
  isPending,
}: {
  title: string;
  subtitle: string;
  users: TraceAccessUser[];
  autoAccess: boolean;
  onToggle: (userId: number, grant: boolean) => void;
  isPending: boolean;
}) {
  if (users.length === 0) return null;

  return (
    <div>
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="rounded-lg border border-card-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/60 border-b border-border">
              <th className="text-left px-3 py-2.5 font-semibold text-foreground">Name</th>
              <th className="text-left px-3 py-2.5 font-semibold text-foreground">Email</th>
              <th className="text-left px-3 py-2.5 font-semibold text-foreground">Role</th>
              <th className="text-left px-3 py-2.5 font-semibold text-foreground">TRACE Access</th>
              {!autoAccess && <th className="w-24 px-3 py-2.5 font-semibold text-foreground">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => {
              const hasAccess = autoAccess || u.traceAccess === true;
              return (
                <tr key={u.userId}>
                  <td className="px-3 py-2.5 font-medium text-foreground">{u.name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{u.email}</td>
                  <td className="px-3 py-2.5">
                    <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {hasAccess ? (
                      <span className="inline-flex items-center gap-1 text-green-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {autoAccess ? "Auto" : "Granted"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <XCircle className="h-3.5 w-3.5" />
                        No Access
                      </span>
                    )}
                  </td>
                  {!autoAccess && (
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => onToggle(u.userId, !u.traceAccess)}
                        disabled={isPending}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium border transition-colors",
                          hasAccess
                            ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                            : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                        )}
                      >
                        {hasAccess ? "Revoke" : "Grant"}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
