import { useState } from "react";
import { useListAdminUsers, useAdminAction, getListAdminUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";

export default function AdminPage() {
  const { activeRole } = useAuth();
  const { data: users, isLoading } = useListAdminUsers();
  const adminAction = useAdminAction();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [roleOverrides, setRoleOverrides] = useState<Record<number, string>>({});

  if (activeRole !== "admin") {
    return (
      <div data-testid="page-admin">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-bold text-foreground">Administration</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Admin access required. Switch to Admin view using the role selector.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleAction = (action: string, userId?: number, extra?: Record<string, unknown>) => {
    adminAction.mutate(
      { data: { action: action as any, userId, ...extra } },
      {
        onSuccess: () => {
          toast({ title: "Action applied", description: `${action} executed.` });
          queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
        },
        onError: () => toast({ title: "Error", description: "Action failed.", variant: "destructive" }),
      }
    );
  };

  return (
    <div data-testid="page-admin">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">Administration</h1>
        <p className="text-muted-foreground mt-1">User management, role overrides, and trust privileges</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : (
        <div className="space-y-4">
          {(users ?? []).map((u) => (
            <Card key={u.id} data-testid={`user-card-${u.id}`}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="font-semibold text-sm">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{u.role}</Badge>
                      {u.entraRequired && <Badge variant="secondary">Entra Required</Badge>}
                      {u.trustPrivileges && <Badge>Trust Privileges</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select
                      value={roleOverrides[u.id] ?? u.role}
                      onValueChange={(v) => setRoleOverrides({ ...roleOverrides, [u.id]: v })}
                    >
                      <SelectTrigger className="w-32" data-testid={`select-role-${u.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["admin", "trustee", "officer", "member"].map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`button-override-role-${u.id}`}
                      onClick={() => handleAction("override_role", u.id, { role: roleOverrides[u.id] ?? u.role })}
                      disabled={adminAction.isPending}
                    >
                      Set Role
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`button-toggle-entra-${u.id}`}
                      onClick={() => handleAction("toggle_entra", u.id, { entraRequired: !u.entraRequired })}
                      disabled={adminAction.isPending}
                    >
                      {u.entraRequired ? "Disable Entra" : "Enable Entra"}
                    </Button>
                    <Button
                      size="sm"
                      variant={u.trustPrivileges ? "destructive" : "default"}
                      data-testid={`button-trust-${u.id}`}
                      onClick={() => handleAction(u.trustPrivileges ? "revoke_trust" : "grant_trust", u.id)}
                      disabled={adminAction.isPending}
                    >
                      {u.trustPrivileges ? "Revoke Trust" : "Grant Trust"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
