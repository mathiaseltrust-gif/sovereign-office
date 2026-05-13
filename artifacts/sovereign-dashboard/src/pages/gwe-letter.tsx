import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";

type ExclusionBasis = "25 U.S.C. § 117b" | "IRC § 139E" | "25 U.S.C. § 117b / IRC § 139E";

const EXCLUSION_BASIS_OPTIONS: { value: ExclusionBasis; label: string }[] = [
  { value: "25 U.S.C. § 117b / IRC § 139E", label: "25 U.S.C. § 117b / IRC § 139E (Combined)" },
  { value: "25 U.S.C. § 117b", label: "25 U.S.C. § 117b (Tribal General Welfare)" },
  { value: "IRC § 139E", label: "IRC § 139E (Indian General Welfare Benefits)" },
];

interface GweLetter {
  id: number;
  recipientName: string;
  letterDate: string;
  programName: string;
  exclusionBasis: string;
  amount: string;
  issuingOfficer: string;
  generatedBy: string | null;
  createdAt: string;
}

function useGweLetters() {
  return useQuery<GweLetter[]>({
    queryKey: ["gwe-letters"],
    queryFn: async () => {
      const token = getCurrentBearerToken();
      const r = await fetch("/api/documents/gwe-letter", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<GweLetter[]>;
    },
  });
}

async function downloadGwePdf(id: number, recipientName: string): Promise<void> {
  const token = getCurrentBearerToken();
  const r = await fetch(`/api/documents/gwe-letter/${id}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) throw new Error("Failed to download PDF");
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gwe-letter-${id}-${recipientName.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

function GweLetterList({ letters, isLoading }: { letters: GweLetter[] | undefined; isLoading: boolean }) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  if (!letters?.length) {
    return (
      <div className="text-muted-foreground text-sm py-12 text-center">
        No GWE letters generated yet. Use the Generate Letter tab to create your first letter.
      </div>
    );
  }

  const handleDownload = async (letter: GweLetter) => {
    setDownloading(letter.id);
    try {
      await downloadGwePdf(letter.id, letter.recipientName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not download PDF";
      toast({ title: "Download Failed", description: msg, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-3">
      {letters.map((letter) => (
        <Card key={letter.id}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm shrink-0">GWE-{String(letter.id).padStart(6, "0")}</span>
                  <span className="text-sm font-medium">{letter.recipientName}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Program: {letter.programName}
                </div>
                <div className="text-xs text-muted-foreground">
                  Amount: {letter.amount} · Basis: {letter.exclusionBasis}
                </div>
                <div className="text-xs text-muted-foreground">
                  Date: {letter.letterDate} · Officer: {letter.issuingOfficer}
                </div>
                <div className="text-xs text-muted-foreground">
                  Created: {new Date(letter.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={downloading === letter.id}
                  onClick={() => handleDownload(letter)}
                >
                  {downloading === letter.id ? "Downloading…" : "Download PDF"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function GenerateForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const today = new Date().toISOString().split("T")[0];

  const [recipientName, setRecipientName] = useState("");
  const [letterDate, setLetterDate] = useState(today ?? "");
  const [programName, setProgramName] = useState("");
  const [exclusionBasis, setExclusionBasis] = useState<ExclusionBasis>("25 U.S.C. § 117b / IRC § 139E");
  const [amount, setAmount] = useState("");
  const [issuingOfficer, setIssuingOfficer] = useState("");

  const generate = useMutation({
    mutationFn: async () => {
      const token = getCurrentBearerToken();
      const r = await fetch("/api/documents/gwe-letter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ recipientName, letterDate, programName, exclusionBasis, amount, issuingOfficer }),
      });

      if (!r.ok) {
        const errBody = await r.json().catch(() => ({ error: "Unknown error" })) as { error?: string };
        throw new Error(errBody.error ?? "Failed to generate letter");
      }

      const letterId = r.headers.get("X-GWE-Letter-Id");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gwe-letter-${letterId ?? "new"}-${recipientName.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      return { id: letterId };
    },
    onSuccess: (data) => {
      toast({
        title: "GWE Letter Generated",
        description: `Letter GWE-${String(data.id ?? "").padStart(6, "0")} has been generated and downloaded.`,
      });
      onSuccess();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to generate letter";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const isValid = recipientName.trim() && letterDate && programName.trim() && exclusionBasis && amount.trim() && issuingOfficer.trim();

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <Label htmlFor="recipientName">Recipient Name *</Label>
        <Input
          id="recipientName"
          className="mt-1"
          placeholder="Full name of recipient"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="letterDate">Letter Date *</Label>
        <Input
          id="letterDate"
          type="date"
          className="mt-1"
          value={letterDate}
          onChange={(e) => setLetterDate(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="programName">Program Name *</Label>
        <Input
          id="programName"
          className="mt-1"
          placeholder="e.g. Tribal Member Assistance Program"
          value={programName}
          onChange={(e) => setProgramName(e.target.value)}
        />
      </div>

      <div>
        <Label>Exclusion Basis *</Label>
        <Select value={exclusionBasis} onValueChange={(v) => setExclusionBasis(v as ExclusionBasis)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXCLUSION_BASIS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="amount">Exclusion Amount *</Label>
        <Input
          id="amount"
          className="mt-1"
          placeholder="e.g. $1,500.00 or $1,500 in program benefits"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="issuingOfficer">Issuing Officer *</Label>
        <Input
          id="issuingOfficer"
          className="mt-1"
          placeholder="Full name and title of issuing officer"
          value={issuingOfficer}
          onChange={(e) => setIssuingOfficer(e.target.value)}
        />
      </div>

      <div className="pt-2">
        <Button
          onClick={() => generate.mutate()}
          disabled={!isValid || generate.isPending}
          className="w-full"
        >
          {generate.isPending ? "Generating & Downloading…" : "Generate GWE Letter (PDF)"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        The generated letter will be saved to the registry and immediately downloaded as a PDF.
        You can re-download any previous letter from the All Letters tab.
      </p>
    </div>
  );
}

export default function GweLetterPage() {
  const { activeRole } = useAuth();
  const queryClient = useQueryClient();
  const { data: letters, isLoading } = useGweLetters();

  const canGenerate = ["trustee", "officer", "sovereign_admin"].includes(activeRole);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">General Welfare Exclusion Letters</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate and download official GWE letters for tribal members under 25 U.S.C. § 117b and IRC § 139E.
        </p>
      </div>

      <Tabs defaultValue={canGenerate ? "generate" : "list"}>
        <TabsList>
          {canGenerate && <TabsTrigger value="generate">Generate Letter</TabsTrigger>}
          <TabsTrigger value="list">All Letters</TabsTrigger>
        </TabsList>

        {canGenerate && (
          <TabsContent value="generate" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">New GWE Letter</CardTitle>
              </CardHeader>
              <CardContent>
                <GenerateForm
                  onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["gwe-letters"] });
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="list" className="mt-4">
          <GweLetterList letters={letters} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
