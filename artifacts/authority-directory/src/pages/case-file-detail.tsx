import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  ArrowLeft,
  FolderOpen,
  AlertTriangle,
  Shield,
  MessageSquare,
  User,
  FileText,
  Calendar,
  MapPin,
  Hash,
  Scale,
  Zap,
  Clock,
  CheckCircle2,
  Archive,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { api, ApiError, CaseFileDetail } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SessionExpiredBanner } from "@/App";

// ── helpers ───────────────────────────────────────────────────────────────────

const CASE_TYPE_LABELS: Record<string, string> = {
  federal: "Federal", state: "State", private: "Civil / Private",
  civil: "Civil / Private", court: "Court", nfr: "NFR",
  trust: "Trust", icwa: "ICWA", sovereign: "Sovereign Pipeline",
  intake: "Intake", general: "General",
};

const CASE_TYPE_COLORS: Record<string, string> = {
  federal: "bg-indigo-50 text-indigo-700 border-indigo-200",
  state:   "bg-violet-50 text-violet-700 border-violet-200",
  private: "bg-orange-50 text-orange-700 border-orange-200",
  civil:   "bg-orange-50 text-orange-700 border-orange-200",
  court:   "bg-red-50 text-red-700 border-red-200",
  nfr:     "bg-red-50 text-red-700 border-red-200",
  trust:   "bg-teal-50 text-teal-700 border-teal-200",
  icwa:    "bg-pink-50 text-pink-700 border-pink-200",
  sovereign: "bg-amber-50 text-amber-700 border-amber-200",
  intake:  "bg-sky-50 text-sky-700 border-sky-200",
  general: "bg-gray-50 text-gray-600 border-gray-200",
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  open:           { label: "Open",           icon: Clock,        className: "bg-blue-50 text-blue-700 border-blue-200" },
  active:         { label: "Active",         icon: RefreshCw,    className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending_review: { label: "Pending Review", icon: AlertCircle,  className: "bg-amber-50 text-amber-700 border-amber-200" },
  closed:         { label: "Closed",         icon: CheckCircle2, className: "bg-gray-50 text-gray-600 border-gray-200" },
  archived:       { label: "Archived",       icon: Archive,      className: "bg-gray-50 text-gray-400 border-gray-200" },
};

const RISK_COLORS: Record<string, string> = {
  low:      "bg-green-50 text-green-700 border-green-200",
  medium:   "bg-amber-50 text-amber-700 border-amber-200",
  high:     "bg-red-50 text-red-700 border-red-200",
  critical: "bg-red-100 text-red-900 border-red-300",
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function calcAge(birthYear: number | null): string {
  if (!birthYear) return "—";
  const age = new Date().getFullYear() - birthYear;
  return `${age} yrs (b. ${birthYear})`;
}

function SectionHeader({ icon: Icon, label, count }: { icon: React.ElementType; label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <h2 className="text-sm font-semibold text-foreground">{label}</h2>
      {count !== undefined && (
        <span className="ml-auto text-xs font-medium tabular-nums bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
          {count}
        </span>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{label}</div>
      <div className={cn("text-sm text-foreground", mono && "font-mono")}>{value ?? "—"}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", cfg.className)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function CaseTypeBadge({ caseType }: { caseType: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", CASE_TYPE_COLORS[caseType] ?? CASE_TYPE_COLORS.general)}>
      {CASE_TYPE_LABELS[caseType] ?? caseType}
    </span>
  );
}

// ── Section: Member Profile ───────────────────────────────────────────────────

function MemberSection({ member }: { member: NonNullable<CaseFileDetail["linkedMember"]> }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <SectionHeader icon={User} label="Linked Person / Member" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
        <Field label="Full Name" value={member.fullName} />
        <Field label="Age" value={calcAge(member.birthYear)} />
        <Field label="Address" value={member.locationAddress} />
        <Field label="Enrollment #" value={member.tribalEnrollmentNumber} mono />
        <Field label="Membership" value={
          member.membershipStatus
            ? <span className="capitalize">{member.membershipStatus.replace(/_/g, " ")}</span>
            : null
        } />
        <Field label="Deceased" value={member.isDeceased ? "Yes" : "No"} />
        {member.contactEmail && (
          <div className="col-span-full">
            <Field label="Contact Email" value={
              <a href={`mailto:${member.contactEmail}`} className="text-primary hover:underline">
                {member.contactEmail}
              </a>
            } />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section: Pipeline Record ──────────────────────────────────────────────────

function PipelineSection({ rec }: { rec: NonNullable<CaseFileDetail["linkedPipelineRecord"]> }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <SectionHeader icon={Zap} label="Linked Intake Pipeline Record" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 mb-4">
        <Field label="File Number" value={rec.fileNumber} mono />
        <Field label="Matter Type" value={rec.matterType?.replace(/_/g, " ")} />
        <Field label="Risk Level" value={
          rec.riskLevel
            ? <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize", RISK_COLORS[rec.riskLevel] ?? RISK_COLORS.medium)}>
                {rec.riskLevel}
              </span>
            : null
        } />
        <Field label="Status" value={<span className="capitalize">{rec.status}</span>} />
        <Field label="Template" value={rec.templateTitle} />
        <Field label="Created" value={fmtDate(rec.createdAt)} />
      </div>
      {rec.generatedSummary && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Summary</div>
          <p className="text-sm text-foreground/80 bg-muted/30 rounded-md border border-border px-3 py-2 leading-relaxed">
            {rec.generatedSummary}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Section: Protective Orders ────────────────────────────────────────────────

function ProtectiveOrdersSection({ orders }: { orders: CaseFileDetail["protectiveOrders"] }) {
  if (!orders.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <SectionHeader icon={Shield} label="Protective Orders" count={orders.length} />
      <div className="space-y-4">
        {orders.map((po) => (
          <div key={po.id} className="border border-border rounded-md p-4 bg-background">
            <div className="flex flex-wrap items-start gap-2 mb-2">
              <span className="font-mono text-xs font-semibold text-primary">{po.caseNumber}</span>
              <StatusBadge status={po.status} />
            </div>
            <div className="font-medium text-sm text-foreground mb-2">{po.title}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs mb-3">
              {po.court && <div><span className="text-muted-foreground">Court: </span>{po.court}</div>}
              {po.issuedDate && <div><span className="text-muted-foreground">Issued: </span>{fmtDate(po.issuedDate)}</div>}
              {po.expiresDate && <div><span className="text-muted-foreground">Expires: </span>{fmtDate(po.expiresDate)}</div>}
            </div>
            {po.namedRespondents.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Named Respondents</div>
                <div className="flex flex-wrap gap-1">
                  {po.namedRespondents.map((r, i) => (
                    <span key={i} className="text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {po.legalBases.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Legal Bases</div>
                <div className="flex flex-wrap gap-1">
                  {po.legalBases.map((b, i) => (
                    <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-md px-2 py-0.5 font-mono">
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {po.summary && (
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed border-t border-border pt-2">{po.summary}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: NFR Documents ────────────────────────────────────────────────────

function NfrDocumentsSection({ docs }: { docs: CaseFileDetail["nfrDocuments"] }) {
  if (!docs.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <SectionHeader icon={AlertTriangle} label="Notice of Federal Review — Documents" count={docs.length} />
      <div className="space-y-2">
        {docs.map((d) => (
          <div key={d.id} className="border border-border rounded-md px-4 py-3 bg-background flex flex-wrap gap-x-6 gap-y-1 text-sm items-center">
            <span className="font-mono text-xs text-muted-foreground">NFR-DOC-{d.id}</span>
            {d.triggeringEntity && <span className="text-foreground/80">{d.triggeringEntity}</span>}
            {d.protectionCategory && (
              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 capitalize">
                {d.protectionCategory.replace(/_/g, " ")}
              </span>
            )}
            {d.urgencyScore !== null && (
              <span className={cn(
                "text-xs rounded-full px-2 py-0.5 border font-medium",
                (d.urgencyScore ?? 0) >= 8 ? "bg-red-50 text-red-700 border-red-200" :
                (d.urgencyScore ?? 0) >= 5 ? "bg-amber-50 text-amber-700 border-amber-200" :
                "bg-green-50 text-green-700 border-green-200"
              )}>
                Urgency {d.urgencyScore}/10
              </span>
            )}
            <StatusBadge status={d.status} />
            <span className="ml-auto text-xs text-muted-foreground">{fmtDate(d.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: Complaints ───────────────────────────────────────────────────────

function ComplaintsSection({ complaints }: { complaints: CaseFileDetail["complaints"] }) {
  if (!complaints.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <SectionHeader icon={MessageSquare} label="Linked Complaints" count={complaints.length} />
      <div className="space-y-3">
        {complaints.map((c) => (
          <div key={c.id} className="border border-border rounded-md px-4 py-3 bg-background">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="font-mono text-xs text-muted-foreground">CMPLT-{c.id}</span>
              {c.classification && (
                <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded-full px-2 py-0.5 capitalize">
                  {c.classification.replace(/_/g, " ")}
                </span>
              )}
              <StatusBadge status={c.status} />
              <span className="ml-auto text-xs text-muted-foreground">{fmtDate(c.createdAt)}</span>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{c.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: Related Case Files ───────────────────────────────────────────────

function RelatedCasesSection({ cases }: { cases: CaseFileDetail["relatedCaseFiles"] }) {
  if (!cases.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <SectionHeader icon={FolderOpen} label="Related Case Files" count={cases.length} />
      <div className="space-y-1.5">
        {cases.map((c) => (
          <Link key={c.id} href={`/case-files/${encodeURIComponent(c.caseNumber)}`}>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border bg-background hover:bg-muted/40 transition-colors cursor-pointer group">
              <span className="font-mono text-xs font-semibold text-primary">{c.caseNumber}</span>
              <CaseTypeBadge caseType={c.caseType} />
              <StatusBadge status={c.status} />
              <span className="flex-1 truncate text-sm text-foreground/80 ml-1">{c.title}</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CaseFileDetailPage() {
  const { caseNumber } = useParams<{ caseNumber: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["case-file-detail", caseNumber],
    queryFn: () => api.getCaseFileDetail(caseNumber!),
    enabled: !!caseNumber,
  });

  const is401 = (error as ApiError)?.status === 401;

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <div className="h-8 w-48 rounded bg-muted/40 animate-pulse" />
        <div className="h-32 rounded-lg bg-muted/40 animate-pulse" />
        <div className="h-40 rounded-lg bg-muted/40 animate-pulse" />
        <div className="h-32 rounded-lg bg-muted/40 animate-pulse" />
      </div>
    );
  }

  if (is401) {
    return <div className="p-6 max-w-4xl mx-auto"><SessionExpiredBanner /></div>;
  }

  if (error) {
    const is404 = (error as ApiError)?.status === 404;
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Link href="/case-files">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Registry
          </button>
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-5 text-red-800">
          <div className="font-semibold mb-1">{is404 ? "Case file not found" : "Failed to load case file"}</div>
          <div className="text-sm">{is404 ? `No case file with number "${caseNumber}" exists.` : "An error occurred loading this case file."}</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { caseFile: cf, linkedMember, linkedPipelineRecord, protectiveOrders, nfrDocuments, complaints, nfrInvestigationCount, relatedCaseFiles } = data;
  const statusCfg = STATUS_CONFIG[cf.status] ?? STATUS_CONFIG.open;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Back nav */}
      <Link href="/case-files">
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Case File Registry
        </button>
      </Link>

      {/* Case Header Card */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex flex-wrap items-start gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <FolderOpen className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="font-mono text-lg font-bold text-primary">{cf.caseNumber}</h1>
              <CaseTypeBadge caseType={cf.caseType} />
              <StatusBadge status={cf.status} />
              {nfrInvestigationCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                  <AlertTriangle className="h-3 w-3" />
                  {nfrInvestigationCount} Investigation{nfrInvestigationCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="text-base font-semibold text-foreground leading-tight">{cf.title}</div>
          </div>
        </div>

        {/* Core fields grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 pt-4 border-t border-border">
          <Field
            label="Case Type"
            value={CASE_TYPE_LABELS[cf.caseType] ?? cf.caseType}
          />
          <Field label="Jurisdiction" value={<span className="capitalize">{cf.jurisdictionLevel}</span>} />
          {cf.matterType && (
            <Field label="Matter Type" value={cf.matterType.replace(/_/g, " ")} />
          )}
          <Field
            label="Opened"
            value={
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                {fmtDate(cf.openedAt)}
              </span>
            }
          />
          {cf.closedAt && (
            <Field
              label="Closed"
              value={
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  {fmtDate(cf.closedAt)}
                </span>
              }
            />
          )}
          {cf.linkedDocumentRef && (
            <Field label="Document Ref" value={<span className="font-mono text-xs">{cf.linkedDocumentRef}</span>} />
          )}
          {cf.linkedDocumentType && (
            <Field
              label="Linked Record"
              value={
                <span className="text-xs capitalize">{cf.linkedDocumentType.replace(/_/g, " ")} #{cf.linkedDocumentId}</span>
              }
            />
          )}
        </div>

        {/* Notes */}
        {cf.notes && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Notes</div>
            <p className="text-sm text-foreground/80 bg-muted/20 border border-border rounded-md px-3 py-2 leading-relaxed">
              {cf.notes}
            </p>
          </div>
        )}
      </div>

      {/* Quick-action bar */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Protective Orders", count: protectiveOrders.length, icon: Shield, color: "text-blue-700" },
          { label: "NFR Documents", count: nfrDocuments.length, icon: AlertTriangle, color: "text-amber-700" },
          { label: "Complaints", count: complaints.length, icon: MessageSquare, color: "text-violet-700" },
          { label: "Investigations", count: nfrInvestigationCount, icon: Scale, color: "text-red-700" },
          { label: "Related Files", count: relatedCaseFiles.length, icon: FolderOpen, color: "text-foreground" },
        ].map(({ label, count, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2.5">
            <Icon className={cn("h-4 w-4 shrink-0", color)} />
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className={cn("text-sm font-bold tabular-nums ml-1", color)}>{count}</span>
          </div>
        ))}
      </div>

      {/* Linked Person */}
      {linkedMember && <MemberSection member={linkedMember} />}

      {/* Linked Pipeline Record */}
      {linkedPipelineRecord && <PipelineSection rec={linkedPipelineRecord} />}

      {/* Protective Orders */}
      <ProtectiveOrdersSection orders={protectiveOrders} />

      {/* NFR Documents */}
      <NfrDocumentsSection docs={nfrDocuments} />

      {/* Complaints */}
      <ComplaintsSection complaints={complaints} />

      {/* Related Case Files */}
      <RelatedCasesSection cases={relatedCaseFiles} />

      {/* Empty state */}
      {!linkedMember && !linkedPipelineRecord && !protectiveOrders.length && !nfrDocuments.length && !complaints.length && !relatedCaseFiles.length && (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <div className="text-sm font-medium text-muted-foreground">No linked records found</div>
          <div className="text-xs text-muted-foreground/60 mt-1">
            Linked members, protective orders, NFR documents and complaints will appear here as they are created and associated with this case number.
          </div>
        </div>
      )}

      {/* Cross-dashboard link */}
      <div className="flex items-center gap-3 bg-muted/30 border border-border rounded-lg px-4 py-3 text-xs text-muted-foreground">
        <Hash className="h-4 w-4 shrink-0" />
        <span>Case number <span className="font-mono font-semibold text-foreground">{cf.caseNumber}</span> is globally accessible across all dashboards in the Mathias El Tribe system.</span>
        <a
          href="/sovereign-dashboard/"
          className="ml-auto flex items-center gap-1 text-primary hover:underline shrink-0"
        >
          Sovereign Office <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
