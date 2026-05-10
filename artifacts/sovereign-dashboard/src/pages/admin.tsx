import { useState } from "react";
import { useListAdminUsers, useAdminAction, useAdminSetPassword, getListAdminUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (password.length === 0) return { score: 0, label: "", color: "" };
  if (password.length < 8) return { score: 1, label: "Too short", color: "bg-red-500" };

  let score = 1;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score: 2, label: "Weak", color: "bg-orange-500" };
  if (score === 3) return { score: 3, label: "Fair", color: "bg-yellow-500" };
  if (score === 4) return { score: 4, label: "Strong", color: "bg-green-500" };
  return { score: 5, label: "Very strong", color: "bg-green-600" };
}

interface SetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  userId: number;
}

function SetPasswordDialog({ open, onOpenChange, userName, userId }: SetPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const { toast } = useToast();
  const setPassword_ = useAdminSetPassword();

  const strength = getPasswordStrength(password);
  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = password.length >= 8 && password === confirm && !setPassword_.isPending;

  const handleSubmit = () => {
    setPassword_.mutate(
      { data: { userId, password } },
      {
        onSuccess: () => {
          toast({ title: "Password set", description: `Password for ${userName} has been updated.` });
          setPassword("");
          setConfirm("");
          onOpenChange(false);
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : "Failed to set password.";
          toast({ title: "Error", description: message, variant: "destructive" });
        },
      }
    );
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setPassword("");
      setConfirm("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Password</DialogTitle>
          <DialogDescription>
            Set an email/password login for <strong>{userName}</strong>. They can use this instead of Microsoft sign-in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              data-testid="input-new-password"
              autoComplete="new-password"
            />
            {tooShort && (
              <p className="text-xs text-destructive">Password must be at least 8 characters.</p>
            )}
            {password.length >= 8 && (
              <div className="space-y-1">
                <div className="flex gap-1 h-1.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-full ${i <= strength.score ? strength.color : "bg-muted"}`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{strength.label}</p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              data-testid="input-confirm-password"
              autoComplete="new-password"
            />
            {mismatch && (
              <p className="text-xs text-destructive">Passwords do not match.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={setPassword_.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="button-confirm-set-password"
          >
            {setPassword_.isPending ? "Saving…" : "Set Password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPage() {
  const { activeRole } = useAuth();
  const { data: users, isLoading } = useListAdminUsers();
  const adminAction = useAdminAction();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [roleOverrides, setRoleOverrides] = useState<Record<number, string>>({});
  const [passwordDialogUser, setPasswordDialogUser] = useState<{ id: number; name: string } | null>(null);

  if (activeRole !== "sovereign_admin") {
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
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`button-set-password-${u.id}`}
                      onClick={() => setPasswordDialogUser({ id: u.id, name: u.name })}
                    >
                      Set Password
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {passwordDialogUser && (
        <SetPasswordDialog
          open={!!passwordDialogUser}
          onOpenChange={(open) => { if (!open) setPasswordDialogUser(null); }}
          userId={passwordDialogUser.id}
          userName={passwordDialogUser.name}
        />
      )}
    </div>
  );
}
