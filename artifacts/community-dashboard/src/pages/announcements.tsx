import React, { useState } from "react";
import { Megaphone, Pin, Shield, Calendar, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Announcement {
  id: number;
  title: string;
  date: string;
  category: "governance" | "rights" | "education" | "community";
  isPinned?: boolean;
  body: string;
  issuedBy: string;
}

const CATEGORY_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  governance: { label: "Governance",  color: "text-amber-700 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-950/30",  border: "border-amber-200 dark:border-amber-800" },
  rights:     { label: "Rights",      color: "text-blue-700 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-950/30",    border: "border-blue-200 dark:border-blue-800" },
  education:  { label: "Education",   color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800" },
  community:  { label: "Community",   color: "text-violet-700 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-200 dark:border-violet-800" },
};

const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 1,
    title: "COMPANION Tribal Intelligence System Now Active",
    date: "May 2026",
    category: "governance",
    isPinned: true,
    issuedBy: "Office of the Chief Justice & Trustee",
    body: "The COMPANION system — the Tribe's AI-powered legal intelligence and rights-protection engine — is now fully operational. COMPANION is trained on all 14 Office Provisions, tribal law, federal Indian law, the Indian Canons of Construction, and each member's personal profile. Members may access COMPANION through the Sovereign Office Dashboard to ask questions about their rights, their status, and their legal standing. COMPANION does not represent external legal definitions as authoritative — it applies the Tribe's own framing first.",
  },
  {
    id: 2,
    title: "Sovereign Definition Literacy System — Terminology Now Published",
    date: "May 2026",
    category: "education",
    isPinned: true,
    issuedBy: "Office of the Chief Justice & Trustee",
    body: "The Definition Literacy System is now live in the Sovereign Office Dashboard under Tribal Education. Twelve foundational terms — including Tribal Sovereignty, Indian, Trust Responsibility, and Treaty — are now published with four-layer analysis: ordinary meaning, historical meaning, federal administrative meaning, and the Tribe's own protective definition. Members are encouraged to review these definitions before engaging with any external legal or governmental process. Our goal is always to protect our peoples and highlight the distinction between our definitions and external legal definitions.",
  },
  {
    id: 3,
    title: "Family Directory — Clean-Up of Placeholder Entries Complete",
    date: "May 2026",
    category: "governance",
    issuedBy: "Office of the Chief Justice & Trustee",
    body: "The Family Directory and Family Tree have been aligned. Duplicate and placeholder entries that were holding space during system development have been removed. The directory now reflects enrolled family members with verified enrollment numbers. If you believe your record has an error or is missing, contact the Office of the Chief Justice through the Sovereign Office Dashboard.",
  },
  {
    id: 4,
    title: "Ancestral Continuity Timeline — Now Live for All Enrolled Ancestors",
    date: "May 2026",
    category: "rights",
    issuedBy: "Office of the Chief Justice & Trustee",
    body: "The Ancestral Continuity Timeline is now available for all enrolled ancestors in the system. This tool places each ancestor beside the historical laws, removals, treaties, and racial classifications that acted upon them during their lifetime. The Timeline now includes a Rights Violation Analysis section that applies the Indian Canons of Construction and documents — in legal detail — how each ancestor's rights were violated and how those violations connect to present-day standing. Identity loss in records is not proof of nonexistence — it is evidence of interruption.",
  },
  {
    id: 5,
    title: "Business Canvas Now Available — Entity Concepts and Planning Tools",
    date: "April 2026",
    category: "community",
    issuedBy: "Office of the Chief Justice & Trustee",
    body: "Members may now create and develop Business Concepts through the Sovereign Office Dashboard. The Business Canvas walks through entity formation under tribal jurisdiction, mission and structure planning, and governance alignment with tribal law. Business Concepts receive a concept number that connects to the Definition Literacy System — so every entity operates on the Tribe's own legal definitions, not external commercial frameworks. COMPANION is available throughout the process to provide guidance.",
  },
];

function AnnouncementCard({ ann }: { ann: Announcement }) {
  const [open, setOpen] = useState(ann.isPinned ?? false);
  const meta = CATEGORY_META[ann.category];

  return (
    <Card className={`overflow-hidden ${ann.isPinned ? "border-primary/30 shadow-sm" : "border-border/50"}`}>
      <button className="w-full text-left" onClick={() => setOpen(v => !v)}>
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-start gap-3">
            {ann.isPinned && (
              <Pin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${meta.color} ${meta.bg} ${meta.border}`}>
                  {meta.label}
                </Badge>
                {ann.isPinned && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border border-primary/20">
                    Pinned
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {ann.date}
                </span>
              </div>
              <h3 className="font-semibold text-sm leading-snug pr-4">{ann.title}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">{ann.issuedBy}</p>
            </div>
            <div className="shrink-0 mt-0.5">
              {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </div>
        </CardHeader>
      </button>
      {open && (
        <CardContent className="pt-0 pb-4 px-4">
          <div className="border-t border-border/40 pt-3">
            <p className="text-sm text-muted-foreground leading-relaxed">{ann.body}</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function Announcements() {
  const pinned = ANNOUNCEMENTS.filter(a => a.isPinned);
  const rest = ANNOUNCEMENTS.filter(a => !a.isPinned);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary">Announcements</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Official communications from the Office of the Chief Justice & Trustee, Mathias El Tribe.
        </p>
      </div>

      {/* Issuing authority banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-primary">Office of the Chief Justice & Trustee</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Announcements issued from this office carry the authority of the Tribe's self-governance and are 
            published under the Tribe's own legal framing. Members are encouraged to read each announcement 
            and bring questions to COMPANION or the Forum.
          </p>
        </div>
      </div>

      {/* Pinned */}
      {pinned.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Pin className="w-3 h-3" /> Pinned Announcements
          </p>
          {pinned.map(a => <AnnouncementCard key={a.id} ann={a} />)}
        </div>
      )}

      {/* Recent */}
      {rest.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent</p>
          {rest.map(a => <AnnouncementCard key={a.id} ann={a} />)}
        </div>
      )}

      {/* Forum pointer */}
      <div className="rounded-xl border border-dashed border-border p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Questions or responses?</p>
          <p className="text-xs text-muted-foreground mt-0.5">Take discussions to the Community Forum — the space for member questions, responses, and conversation.</p>
        </div>
        <a href="/community-dashboard/forum">
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
            Open Forum <ExternalLink className="w-3 h-3" />
          </Button>
        </a>
      </div>
    </div>
  );
}
