import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SovereignIntakeGuard } from "@/components/SovereignIntakeGuard";
import {
  useListWelfareInstruments,
  useGenerateWelfareInstrument,
  useGenerateTroDeclaration,
  useIssueWelfareInstrument,
  getListWelfareInstrumentsQueryKey,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";

type WelfareAct = "ICWA" | "SNYDER" | "IHCIA" | "ISDEAA" | "TRIBAL_CODE" | "TRIBAL_WELFARE" | "TRIBAL_PROTECTIVE_ORDER" | "EMERGENCY_WELFARE" | "TRO_WELFARE";
type InstrumentType =
  | "icwa_notice"
  | "icwa_transfer_request"
  | "icwa_jurisdiction_declaration"
  | "tribal_family_placement_preference"
  | "tribal_welfare_certification"
  | "tribal_medical_necessity_certification"
  | "tribal_protective_order"
  | "emergency_welfare_order"
  | "tro_supporting_declaration";

const WELFARE_ACTS: { value: WelfareAct; label: string }[] = [
  { value: "ICWA", label: "Indian Child Welfare Act (ICWA)" },
  { value: "SNYDER", label: "Snyder Act" },
  { value: "IHCIA", label: "Indian Health Care Improvement Act (IHCIA)" },
  { value: "ISDEAA", label: "Indian Self-Determination & Education Assistance Act" },
  { value: "TRIBAL_CODE", label: "Tribal Family Protection Code" },
  { value: "TRIBAL_WELFARE", label: "Tribal Welfare Code" },
  { value: "TRIBAL_PROTECTIVE_ORDER", label: "Tribal Protective Order Authority" },
  { value: "EMERGENCY_WELFARE", label: "Emergency Welfare Authority" },
  { value: "TRO_WELFARE", label: "TRO Welfare Protection" },
];

const INSTRUMENT_TYPES: { value: InstrumentType; label: string }[] = [
  { value: "icwa_notice", label: "ICWA Notice of Proceeding" },
  { value: "icwa_transfer_request", label: "ICWA Transfer Request" },
  { value: "icwa_jurisdiction_declaration", label: "ICWA Jurisdiction Declaration" },
  { value: "tribal_family_placement_preference", label: "Tribal Family Placement Preference" },
  { value: "tribal_welfare_certification", label: "Tribal Welfare Certification" },
  { value: "tribal_medical_necessity_certification", label: "Tribal Medical Necessity Certification" },
  { value: "tribal_protective_order", label: "Tribal Protective Order" },
  { value: "emergency_welfare_order", label: "Emergency Welfare Order" },
  { value: "tro_supporting_declaration", label: "TRO-Supporting Declaration" },
];

function StatusBadges({ status, tro, emergency }: { status: string; tro: boolean; emergency: boolean }) {
  if (emergency) return <Badge className="bg-red-700 text-white">Emergency</Badge>;
  if (tro) return <Badge className="bg-orange-600 text-white">TRO-Sensitive</Badge>;
  if (status === "issued") return <Badge>Issued</Badge>;
  if (status === "prepared") return <Badge variant="secondary">Prepared</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function WelfareList({ items, isLoading, onDownload, onIssue, canIssue }: {
  items: any[];
  isLoading: boolean;
  onDownload: (id: number) => void;
  onIssue: (id: number) => void;
  canIssue: boolean;
}) {
  if (isLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;
  if (!items.length) return <div className="text-muted-foreground text-sm py-10 text-center">No instruments found.</div>;

  return (
    <div className="space-y-3">
      {items.map((item: any) => (
        <Card key={item.id} className={item.emergencyOrder ? "border-red-400" : item.troSensitive ? "border-orange-400" : ""}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm shrink-0">#{item.id}</span>
                  <Badge variant="outline" className="text-xs">{item.welfareAct}</Badge>
                  <Badge variant="outline" className="text-xs">{(item.instrumentType ?? "").replace(/_/g, " ")}</Badge>
                  <StatusBadges status={item.status} tro={item.troSensitive} emergency={item.emergencyOrder} />
                </div>
                {item.caseDetails && (
                  <div className="text-xs text-muted-foreground">
                    Case: {item.caseDetails.caseNumber ?? "—"} · Court: {item.caseDetails.court ?? "—"}
                  </div>
                )}
                {item.childInfo && item.childInfo.name && (
                  <div className="text-xs text-muted-foreground">
                    Child: {item.childInfo.name}{item.childInfo.age ? `, age ${item.childInfo.age}` : ""}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Created: {new Date(item.createdAt).toLocaleDateString()}
                  {item.generatedBy ? ` · By: ${item.generatedBy}` : ""}
                  {item.issuedBy ? ` · Issued by: ${item.issuedBy}` : ""}
                </div>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => onDownload(item.id)}>PDF</Button>
                {canIssue && item.status !== "issued" && (
                  <Button size="sm" onClick={() => onIssue(item.id)}>Issue</Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CreateInstrumentForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [welfareAct, setWelfareAct] = useState<WelfareAct>("ICWA");
  const [instrumentType, setInstrumentType] = useState<InstrumentType>("icwa_notice");
  const [emergency, setEmergency] = useState(false);
  const [caseNo, setCaseNo] = useState("");
  const [court, setCourt] = useState("");
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("");
  const [tribeName, setTribeName] = useState("");
  const [relief, setRelief] = useState("");

  const generate = useGenerateWelfareInstrument();
  const generateTro = useGenerateTroDeclaration();

  const buildPayload = (forTro = false) => ({
    welfareAct,
    instrumentType: forTro ? ("tro_supporting_declaration" as InstrumentType) : instrumentType,
    emergency: forTro ? true : emergency,
    caseDetails: {
      caseNumber: caseNo || (forTro ? `TRO-${Date.now()}` : "Unassigned"),
      court: court || "Tribal Court",
      ...(forTro ? { urgency: "EMERGENCY — TRO REQUESTED" } : {}),
    },
    child: childName ? { name: childName, age: childAge || "unknown" } : undefined,
    parties: {
      Tribe: tribeName || "Sovereign Tribal Nation",
      "Issuing Authority": "Sovereign Office of the Chief Justice & Trustee",
    },
    requestedRelief: relief
      ? relief.split(",").map((r) => r.trim()).filter(Boolean)
      : forTro
      ? ["Immediate TRO restraining unlawful removal", "Return to tribal custody", "Stay of state court proceedings"]
      : [],
    doctrineContext: [],
  });

  const handleGenerate = () => {
    generate.mutate({ data: buildPayload() }, {
      onSuccess: (data: any) => {
        queryClient.invalidateQueries({ queryKey: getListWelfareInstrumentsQueryKey() });
        toast({
          title: data.troSensitive ? "TRO-Sensitive Instrument Generated" : data.emergencyOrder ? "Emergency Order Generated" : "Welfare Instrument Generated",
          description: `${data.title} — ID #${data.id}`,
        });
        onSuccess();
      },
      onError: (err: any) => toast({ title: "Error", description: err.message ?? "Generation failed", variant: "destructive" }),
    });
  };

  const handleTro = () => {
    generateTro.mutate({ data: buildPayload(true) }, {
      onSuccess: (data: any) => {
        queryClient.invalidateQueries({ queryKey: getListWelfareInstrumentsQueryKey() });
        toast({ title: "TRO Declaration Generated", description: `Emergency TRO Instrument #${data.id}` });
        onSuccess();
      },
      onError: (err: any) => toast({ title: "Error", description: err.message ?? "TRO generation failed", variant: "destructive" }),
    });
  };

  const isPending = generate.isPending || generateTro.isPending;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Welfare Act</Label>
          <Select value={welfareAct} onValueChange={(v) => setWelfareAct(v as WelfareAct)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {WELFARE_ACTS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Instrument Type</Label>
          <Select value={instrumentType} onValueChange={(v) => setInstrumentType(v as InstrumentType)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {INSTRUMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Case Number</Label>
          <Input className="mt-1" placeholder="e.g. TC-2026-001" value={caseNo} onChange={(e) => setCaseNo(e.target.value)} />
        </div>
        <div>
          <Label>Court / Jurisdiction</Label>
          <Input className="mt-1" placeholder="e.g. Tribal Court, District 1" value={court} onChange={(e) => setCourt(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Child Name (if applicable)</Label>
          <Input className="mt-1" placeholder="Full name" value={childName} onChange={(e) => setChildName(e.target.value)} />
        </div>
        <div>
          <Label>Child Age</Label>
          <Input className="mt-1" placeholder="Age" value={childAge} onChange={(e) => setChildAge(e.target.value)} />
        </div>
        <div>
          <Label>Tribe Name</Label>
          <Input className="mt-1" placeholder="Enrolled tribe" value={tribeName} onChange={(e) => setTribeName(e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Requested Relief (comma-separated)</Label>
        <Input
          className="mt-1"
          placeholder="e.g. Stay of removal, Transfer to tribal court, Tribal placement preference"
          value={relief}
          onChange={(e) => setRelief(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <input type="checkbox" id="emergency-check" checked={emergency} onChange={(e) => setEmergency(e.target.checked)} className="w-4 h-4" />
        <Label htmlFor="emergency-check" className="cursor-pointer font-medium text-red-700 dark:text-red-400">
          Mark as Emergency Order
        </Label>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Button onClick={handleGenerate} disabled={isPending}>
          {generate.isPending ? "Generating…" : "Generate Instrument"}
        </Button>
        <Button variant="destructive" onClick={handleTro} disabled={isPending}>
          {generateTro.isPending ? "Generating TRO…" : "Generate TRO Declaration"}
        </Button>
      </div>
    </div>
  );
}

export default function WelfarePage() {
  const [tab, setTab] = useState("all");
  const { data, isLoading } = useListWelfareInstruments();
  const { user, activeRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const issueInstrument = useIssueWelfareInstrument();

  const allItems = data ?? [];
  const canIssue = ["trustee", "admin"].includes(activeRole);

  const downloadPdf = async (id: number) => {
    const token = btoa(JSON.stringify(user));
    const r = await fetch(`/api/court/welfare/${id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      toast({ title: "Error", description: "PDF not available.", variant: "destructive" });
      return;
    }
    const blob = await r.blob();
    window.open(URL.createObjectURL(blob));
  };

  const handleIssue = (id: number) => {
    issueInstrument.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWelfareInstrumentsQueryKey() });
        toast({ title: "Instrument Issued", description: `Welfare instrument #${id} issued.` });
      },
      onError: () => toast({ title: "Error", description: "Could not issue instrument.", variant: "destructive" }),
    });
  };

  const listProps = { isLoading, onDownload: downloadPdf, onIssue: handleIssue, canIssue };

  const [guardCleared, setGuardCleared] = useState(false);

  return (
    <div data-testid="page-welfare">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">Welfare Instruments</h1>
        <p className="text-muted-foreground mt-1">ICWA · IHCIA · ISDEAA · Tribal Protective Orders · Emergency Orders · TRO Declarations</p>
      </div>

      {!guardCleared && (
        <SovereignIntakeGuard
          intakeType="welfare"
          onClear={() => setGuardCleared(true)}
        />
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="all">All Instruments</TabsTrigger>
          <TabsTrigger value="create">Create New</TabsTrigger>
          <TabsTrigger value="tro">TRO Queue</TabsTrigger>
          <TabsTrigger value="emergency">Emergency Orders</TabsTrigger>
          <TabsTrigger value="icwa">ICWA Notices</TabsTrigger>
          <TabsTrigger value="transfer">Transfer Requests</TabsTrigger>
          <TabsTrigger value="protective">Protective Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-widest">All Welfare Instruments</CardTitle></CardHeader>
            <CardContent>
              <WelfareList items={allItems} {...listProps} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">Generate Welfare Instrument</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Intake Officers may prepare · Chief Justice &amp; Trustee may issue · All actions are audit-logged
              </p>
            </CardHeader>
            <CardContent>
              <CreateInstrumentForm onSuccess={() => setTab("all")} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tro">
          <Card className="border-orange-300">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest text-orange-700">TRO Queue — TRO-Sensitive Instruments</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Instruments flagged for potential Temporary Restraining Order support</p>
            </CardHeader>
            <CardContent>
              <WelfareList items={allItems.filter((i: any) => i.troSensitive)} {...listProps} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emergency">
          <Card className="border-red-400">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest text-red-700">Emergency Orders</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Active emergency welfare orders requiring immediate attention</p>
            </CardHeader>
            <CardContent>
              <WelfareList items={allItems.filter((i: any) => i.emergencyOrder)} {...listProps} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="icwa">
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-widest">ICWA Notices</CardTitle></CardHeader>
            <CardContent>
              <WelfareList items={allItems.filter((i: any) => i.instrumentType === "icwa_notice")} {...listProps} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfer">
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-widest">Transfer Requests</CardTitle></CardHeader>
            <CardContent>
              <WelfareList items={allItems.filter((i: any) => i.instrumentType === "icwa_transfer_request")} {...listProps} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="protective">
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-widest">Protective Orders</CardTitle></CardHeader>
            <CardContent>
              <WelfareList items={allItems.filter((i: any) => ["tribal_protective_order", "emergency_welfare_order"].includes(i.instrumentType))} {...listProps} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
