import { useState } from "react";
import { useListAtlasEvents, useAtlasEventIntake, useCreateAtlasEvent, useUpdateAtlasEvent } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListAtlasEventsQueryKey } from "@workspace/api-client-react";
import type { AtlasEventRecord, AtlasEventInput, AtlasEventUpdate } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, BookOpen, Pencil, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";

const ERAS = ["Pre-Removal", "Removal-Era", "Reservation-Era", "Allotment-Era", "Reorganization-Era", "Termination-Era", "Self-Determination-Era", "Modern-Era", "colonial", "early-republic", "removal", "reservation", "post-civil-war", "allotment", "jim-crow", "termination", "wwii-migration", "self-determination", "modern"];
const EVENT_TYPES = ["federal_legislation", "supreme_court_case", "executive_order", "federal_policy", "state_action", "military_action", "treaty", "regulatory_change", "Act of Congress", "Supreme Court Case", "Executive Order"];
const POLICY_AREAS = ["land_rights", "identity_classification", "healthcare", "education", "family_welfare", "urban_relocation", "tribal_sovereignty", "economic_policy", "religious_freedom", "environmental", "Federal Trust Responsibility", "Public Schools", "Boarding Schools"];
const SEVERITY_LEVELS = ["catastrophic", "severe", "moderate", "beneficial", "mixed", "critical", "high"];

function severityColor(level: string) {
  switch (level) {
    case "catastrophic": case "critical": return "destructive";
    case "severe": case "high": return "destructive";
    case "moderate": return "secondary";
    case "beneficial": return "outline";
    default: return "secondary";
  }
}

type EventFormData = Partial<AtlasEventInput & AtlasEventUpdate>;

function EventForm({
  initial,
  onSave,
  onCancel,
  saving,
  mode,
}: {
  initial: EventFormData;
  onSave: (data: EventFormData) => void;
  onCancel: () => void;
  saving: boolean;
  mode: "create" | "edit";
}) {
  const [form, setForm] = useState<EventFormData>(initial);
  const [expanded, setExpanded] = useState(false);

  const set = (k: keyof EventFormData, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {mode === "create" && (
          <div className="col-span-2">
            <Label>Event ID *</Label>
            <Input value={form.eventId ?? ""} onChange={(e) => set("eventId", e.target.value)} placeholder="evt-auto-XXXX" />
          </div>
        )}
        <div className="col-span-2">
          <Label>Title *</Label>
          <Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="Official full title" />
        </div>
        <div>
          <Label>Short Title</Label>
          <Input value={form.shortTitle ?? ""} onChange={(e) => set("shortTitle", e.target.value)} placeholder="Common abbreviated name" />
        </div>
        <div>
          <Label>Year *</Label>
          <Input type="number" value={form.year ?? ""} onChange={(e) => set("year", parseInt(e.target.value))} placeholder="1830" />
        </div>
        <div>
          <Label>Date Start</Label>
          <Input value={form.dateStart ?? ""} onChange={(e) => set("dateStart", e.target.value)} placeholder="YYYY-MM-DD" />
        </div>
        <div>
          <Label>Date End</Label>
          <Input value={form.dateEnd ?? ""} onChange={(e) => set("dateEnd", e.target.value)} placeholder="YYYY-MM-DD or leave blank" />
        </div>
        <div>
          <Label>Era *</Label>
          <Select value={form.era ?? ""} onValueChange={(v) => set("era", v)}>
            <SelectTrigger><SelectValue placeholder="Select era" /></SelectTrigger>
            <SelectContent>{ERAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Event Type *</Label>
          <Select value={form.eventType ?? ""} onValueChange={(v) => set("eventType", v)}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Policy Area *</Label>
          <Select value={form.policyArea ?? ""} onValueChange={(v) => set("policyArea", v)}>
            <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
            <SelectContent>{POLICY_AREAS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Severity</Label>
          <Select value={form.severityLevel ?? "moderate"} onValueChange={(v) => set("severityLevel", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SEVERITY_LEVELS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Description *</Label>
          <Textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="2-4 sentence factual description" />
        </div>
        <div className="col-span-2">
          <Label>Plain Language Summary *</Label>
          <Textarea value={form.plainLanguageSummary ?? ""} onChange={(e) => set("plainLanguageSummary", e.target.value)} rows={2} placeholder="1-2 sentence plain-language explanation for families" />
        </div>
        <div>
          <Label>Source Title</Label>
          <Input value={form.sourceTitle ?? ""} onChange={(e) => set("sourceTitle", e.target.value)} placeholder="Trade and Intercourse Act, 1 Stat. 137" />
        </div>
        <div>
          <Label>Citation</Label>
          <Input value={form.citation ?? ""} onChange={(e) => set("citation", e.target.value)} placeholder="25 U.S.C. § 177" />
        </div>
      </div>

      <button
        type="button"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded((x) => !x)}
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {expanded ? "Hide" : "Show"} impact fields
      </button>

      {expanded && (
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/40">
          {(
            [
              ["identityImpact", "Identity Impact"],
              ["reclassificationImpact", "Reclassification Impact"],
              ["continuityImpact", "Continuity Impact"],
              ["continuitySurvivalNote", "Continuity Survival Note"],
              ["familyImpact", "Family Impact"],
              ["urbanizationImpact", "Urbanization Impact"],
              ["healthAccessImpact", "Health Access Impact"],
              ["publicSchoolImpact", "Public School Impact"],
              ["landImpact", "Land Impact"],
              ["jurisdictionImpact", "Jurisdiction Impact"],
              ["housingImpact", "Housing Impact"],
              ["laborMigrationImpact", "Labor/Migration Impact"],
              ["modernEffect", "Modern Effect"],
              ["ancestorRelevanceNote", "Ancestor Relevance Note"],
              ["affectedPeople", "Affected People"],
            ] as [keyof EventFormData, string][]
          ).map(([k, label]) => (
            <div key={k} className="col-span-2">
              <Label>{label}</Label>
              <Textarea
                value={(form[k] as string) ?? ""}
                onChange={(e) => set(k, e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
          ))}
          <div>
            <Label>Coordinate Lat</Label>
            <Input type="number" value={form.coordinateLat ?? ""} onChange={(e) => set("coordinateLat", parseFloat(e.target.value))} placeholder="38.5" />
          </div>
          <div>
            <Label>Coordinate Lng</Label>
            <Input type="number" value={form.coordinateLng ?? ""} onChange={(e) => set("coordinateLng", parseFloat(e.target.value))} placeholder="-97.0" />
          </div>
          <div>
            <Label>Tags (comma-separated)</Label>
            <Input
              value={Array.isArray(form.tags) ? form.tags.join(", ") : ""}
              onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
            />
          </div>
          <div>
            <Label>Affected Regions (comma-separated)</Label>
            <Input
              value={Array.isArray(form.affectedRegions) ? form.affectedRegions.join(", ") : ""}
              onChange={(e) => set("affectedRegions", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
            />
          </div>
          <div>
            <Label>States Affected (comma-separated)</Label>
            <Input
              value={Array.isArray(form.statesAffected) ? form.statesAffected.join(", ") : ""}
              onChange={(e) => set("statesAffected", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
            />
          </div>
          <div>
            <Label>Public Law Number</Label>
            <Input value={form.publicLawNumber ?? ""} onChange={(e) => set("publicLawNumber", e.target.value)} />
          </div>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {mode === "create" ? "Save Event" : "Update Event"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function AtlasAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: events = [], isLoading: eventsLoading } = useListAtlasEvents();

  const intakeMutation = useAtlasEventIntake();
  const createMutation = useCreateAtlasEvent();
  const updateMutation = useUpdateAtlasEvent();

  const [rawText, setRawText] = useState("");
  const [extracted, setExtracted] = useState<EventFormData | null>(null);
  const [confidence, setConfidence] = useState<string>("");
  const [intakeNotes, setIntakeNotes] = useState("");
  const [showConfirmForm, setShowConfirmForm] = useState(false);

  const [editTarget, setEditTarget] = useState<AtlasEventRecord | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const [searchQ, setSearchQ] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListAtlasEventsQueryKey() });

  const handleIntake = async () => {
    if (!rawText.trim()) return;
    try {
      const result = await intakeMutation.mutateAsync({ data: { rawText } });
      setExtracted(result.extracted as EventFormData);
      setConfidence(result.confidence ?? "");
      setIntakeNotes(result.notes ?? "");
      setShowConfirmForm(true);
    } catch {
      toast({ title: "AI Extraction Failed", description: "Could not parse structured fields from this text. Try a cleaner excerpt of the primary source.", variant: "destructive" });
    }
  };

  const handleCreateFromIntake = async (data: EventFormData) => {
    try {
      await createMutation.mutateAsync({ data: data as AtlasEventInput });
      toast({ title: "Event Saved", description: `"${data.title}" added to the Atlas.` });
      setRawText("");
      setExtracted(null);
      setShowConfirmForm(false);
      invalidate();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to save event.";
      toast({ title: "Save Failed", description: msg, variant: "destructive" });
    }
  };

  const handleUpdate = async (data: EventFormData) => {
    if (!editTarget) return;
    try {
      await updateMutation.mutateAsync({ id: editTarget.id, data: data as AtlasEventUpdate });
      toast({ title: "Event Updated", description: `"${data.title ?? editTarget.title}" has been updated.` });
      setShowEditDialog(false);
      setEditTarget(null);
      invalidate();
    } catch {
      toast({ title: "Update Failed", description: "Could not save changes.", variant: "destructive" });
    }
  };

  const filtered = events.filter(
    (e) =>
      !searchQ ||
      e.title.toLowerCase().includes(searchQ.toLowerCase()) ||
      e.era.toLowerCase().includes(searchQ.toLowerCase()) ||
      e.policyArea.toLowerCase().includes(searchQ.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-primary font-medium">Atlas Event Administration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage events in the Urban Indian Continuity Atlas. Use AI intake to extract structured fields from raw legal text, or directly edit existing events. Deletion is not permitted — events may be marked inactive.
        </p>
      </div>

      <Tabs defaultValue="intake">
        <TabsList>
          <TabsTrigger value="intake">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Intake
          </TabsTrigger>
          <TabsTrigger value="manage">
            <BookOpen className="w-4 h-4 mr-2" />
            Manage Events ({events.length})
          </TabsTrigger>
        </TabsList>

        {/* ── AI INTAKE TAB ── */}
        <TabsContent value="intake" className="space-y-4 mt-4">
          {!showConfirmForm ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-serif">Paste Legal Text</CardTitle>
                <CardDescription>
                  Paste raw text from an Act of Congress, Supreme Court case, executive order, or treaty. The AI will extract and pre-fill all event fields for your review before saving.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={10}
                  placeholder="Paste the full text of the legislation, case opinion, or historical document here…"
                  className="font-mono text-sm resize-y"
                />
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleIntake}
                    disabled={!rawText.trim() || intakeMutation.isPending}
                    className="gap-2"
                  >
                    {intakeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {intakeMutation.isPending ? "Extracting fields…" : "Extract with AI"}
                  </Button>
                  {rawText.trim() && (
                    <span className="text-xs text-muted-foreground">
                      {rawText.length.toLocaleString()} characters
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-serif">Review Extracted Fields</CardTitle>
                  <div className="flex items-center gap-2">
                    {confidence === "high" ? (
                      <Badge variant="outline" className="gap-1 text-green-700 border-green-300">
                        <CheckCircle className="w-3.5 h-3.5" /> High confidence
                      </Badge>
                    ) : confidence === "medium" ? (
                      <Badge variant="secondary" className="gap-1">Medium confidence</Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Low confidence — review carefully
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => { setShowConfirmForm(false); setExtracted(null); }}>
                      ← Back
                    </Button>
                  </div>
                </div>
                {intakeNotes && (
                  <CardDescription className="italic">{intakeNotes}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[70vh]">
                  <EventForm
                    initial={extracted ?? {}}
                    onSave={handleCreateFromIntake}
                    onCancel={() => { setShowConfirmForm(false); setExtracted(null); }}
                    saving={createMutation.isPending}
                    mode="create"
                  />
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── MANAGE EVENTS TAB ── */}
        <TabsContent value="manage" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <Input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search by title, era, or policy area…"
              className="max-w-sm"
            />
            <span className="text-xs text-muted-foreground">
              {filtered.length} of {events.length} events
            </span>
          </div>

          {eventsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[70vh]">
              <div className="space-y-2">
                {filtered.map((event) => (
                  <Card key={event.id} className="hover:bg-muted/30 transition-colors">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-serif font-medium text-sm text-primary truncate">
                              {event.title}
                            </span>
                            <Badge variant={severityColor(event.severityLevel)} className="text-[10px] shrink-0">
                              {event.severityLevel}
                            </Badge>
                            {event.status !== "active" && (
                              <Badge variant="outline" className="text-[10px] shrink-0">{event.status}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{event.year}</span>
                            <Separator orientation="vertical" className="h-3" />
                            <span>{event.era}</span>
                            <Separator orientation="vertical" className="h-3" />
                            <span>{event.policyArea}</span>
                            <Separator orientation="vertical" className="h-3" />
                            <span>{event.eventType}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {event.plainLanguageSummary}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 gap-1.5 text-xs"
                          onClick={() => {
                            setEditTarget(event);
                            setShowEditDialog(true);
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { if (!open) { setShowEditDialog(false); setEditTarget(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Event: {editTarget?.title}</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <EventForm
              initial={{
                title: editTarget.title,
                shortTitle: editTarget.shortTitle ?? undefined,
                year: editTarget.year,
                dateStart: editTarget.dateStart ?? undefined,
                dateEnd: editTarget.dateEnd ?? undefined,
                era: editTarget.era,
                eventType: editTarget.eventType,
                policyArea: editTarget.policyArea,
                description: editTarget.description,
                plainLanguageSummary: editTarget.plainLanguageSummary,
                severityLevel: editTarget.severityLevel,
                status: editTarget.status,
                identityImpact: editTarget.identityImpact ?? undefined,
                reclassificationImpact: editTarget.reclassificationImpact ?? undefined,
                continuityImpact: editTarget.continuityImpact ?? undefined,
                continuitySurvivalNote: editTarget.continuitySurvivalNote ?? undefined,
                familyImpact: editTarget.familyImpact ?? undefined,
                urbanizationImpact: editTarget.urbanizationImpact ?? undefined,
                healthAccessImpact: editTarget.healthAccessImpact ?? undefined,
                publicSchoolImpact: editTarget.publicSchoolImpact ?? undefined,
                landImpact: editTarget.landImpact ?? undefined,
                jurisdictionImpact: editTarget.jurisdictionImpact ?? undefined,
                housingImpact: editTarget.housingImpact ?? undefined,
                laborMigrationImpact: editTarget.laborMigrationImpact ?? undefined,
                modernEffect: editTarget.modernEffect ?? undefined,
                ancestorRelevanceNote: editTarget.ancestorRelevanceNote ?? undefined,
                affectedPeople: editTarget.affectedPeople ?? undefined,
                affectedRegions: editTarget.affectedRegions,
                statesAffected: editTarget.statesAffected,
                coordinateLat: editTarget.coordinateLat ?? undefined,
                coordinateLng: editTarget.coordinateLng ?? undefined,
                sourceTitle: editTarget.sourceTitle,
                sourceUrl: editTarget.sourceUrl,
                sourceType: editTarget.sourceType ?? undefined,
                citation: editTarget.citation ?? undefined,
                publicLawNumber: editTarget.publicLawNumber ?? undefined,
                tags: editTarget.tags,
              }}
              onSave={handleUpdate}
              onCancel={() => { setShowEditDialog(false); setEditTarget(null); }}
              saving={updateMutation.isPending}
              mode="edit"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
