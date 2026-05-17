import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { WhatNextPanel } from "@/components/WhatNextPanel";
import { OrgDocumentsPanel } from "@/components/OrgDocumentsPanel";
import {
  GraduationCap, BookOpen, Scale, Shield, ChevronDown, ChevronUp,
  ChevronRight, CheckCircle, AlertTriangle, ExternalLink, Map, Clock,
} from "lucide-react";

// ── Programs ──────────────────────────────────────────────────────────────────

const PROGRAMS = [
  {
    title: "Sovereignty Literacy",
    level: "Foundational",
    levelColor: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    desc: "Core education on tribal sovereignty, federal Indian law, treaty rights, and the legal framework of self-determination. Designed so every enrolled member understands their rights and standing.",
  },
  {
    title: "Federal Indian Law Practicum",
    level: "Intermediate",
    levelColor: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    desc: "Deep study of BIA regulations, Indian Civil Rights Act, ICWA, ISDEAA, and trust responsibilities. Prepares members for advocacy, compliance, and legal self-representation.",
  },
  {
    title: "Tribal Business & Enterprise",
    level: "Applied",
    levelColor: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
    desc: "Practical education on forming and operating Indian Economic Enterprises, SBA certification, BIA financing, and sovereign contracting. Includes business planning and model canvas workshops.",
  },
  {
    title: "Self-Determination Administration",
    level: "Advanced",
    levelColor: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    desc: "Training for tribal officers and administrators on contracting and compacting under ISDEAA, program management, and the administration of federal programs under tribal authority.",
  },
  {
    title: "Cultural Preservation & Heritage",
    level: "Community",
    levelColor: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    desc: "Programs preserving language, oral history, ancestral memory, and cultural practice — integrating indigenous knowledge systems with contemporary education.",
  },
  {
    title: "Health & Wellness Education",
    level: "Community",
    levelColor: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    desc: "Health literacy rooted in tribal sovereignty — covering Indian Health Service rights, Medicaid Indian provisions, IHCIA, and member wellness resources available under federal trust responsibility.",
  },
];

// ── Sovereignty Frameworks ────────────────────────────────────────────────────

interface Framework {
  term: string;
  slug: string;
  category: string;
  catColor: string;
  oneLiner: string;
  warning?: string;
  summary: string;
  authority: string;
}

const FRAMEWORKS: Framework[] = [
  {
    term: "Sovereignty",
    slug: "sovereignty",
    category: "Governance",
    catColor: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    oneLiner: "Inherent, pre-existing governing power — not a federal grant.",
    summary: "Tribal sovereignty pre-dates the United States. It was not created by federal law and cannot be extinguished by administrative inaction. The Marshall Trilogy (1823–1832) confirmed tribes as 'distinct, independent political communities.'",
    authority: "Worcester v. Georgia (1832) · 25 U.S.C. § 5302",
  },
  {
    term: "Indian",
    slug: "indian",
    category: "Classification",
    catColor: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    oneLiner: "A political and legal classification — not a racial category.",
    warning: "Courts have rejected the racial framing (Morton v. Mancari, 1974).",
    summary: "Under federal law, 'Indian' is a political identity tied to tribal membership — not a racial designation. Congress has never limited the term to BIA-list membership. Different statutes apply different definitions.",
    authority: "25 U.S.C. § 5304(e) · Morton v. Mancari (1974)",
  },
  {
    term: "Tribe / Tribal Nation",
    slug: "tribe",
    category: "Governance",
    catColor: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    oneLiner: "A self-governing political community with inherent sovereignty.",
    summary: "The U.S. Constitution (Art. I § 8) recognizes Indian Tribes alongside foreign nations and states. A tribe is not a cultural club — it is a political entity with governing authority. The BIA list is an administrative tool, not the legal definition.",
    authority: "U.S. Const. Art. I § 8 · 25 U.S.C. § 5304(b)",
  },
  {
    term: "Federal Trust Responsibility",
    slug: "trust-responsibility",
    category: "Federal Obligation",
    catColor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
    oneLiner: "A fiduciary duty of the U.S. toward Indian people — older than the BIA.",
    summary: "The trust responsibility originated in treaty relationships and pre-dates most federal agencies. It runs independently of BIA list status. The Snyder Act (1921) establishes the broadest statutory basis: 'Indians throughout the United States.'",
    authority: "Snyder Act (1921) · 25 U.S.C. § 5302 · Cherokee Nation v. Georgia (1831)",
  },
  {
    term: "Recognition",
    slug: "recognition",
    category: "Administrative",
    catColor: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    oneLiner: "Confirms a pre-existing relationship — it does not create one.",
    warning: "The word 'recognition' creates a trap: it implies government creates tribal status. In law, it only confirms what already existed.",
    summary: "Treaty-making was the original form of recognition — government-to-government acknowledgment. The Part 83 process is an administrative procedure for program eligibility. Failing Part 83 does not extinguish treaty rights or historical recognition.",
    authority: "Passamaquoddy Tribe v. Morton (1975) · 25 C.F.R. Part 83",
  },
  {
    term: "Treaty",
    slug: "treaty",
    category: "Federal Obligation",
    catColor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
    oneLiner: "Supreme law of the land — not a historical artifact.",
    summary: "The U.S. negotiated ~374 ratified Indian treaties. Under Art. VI of the Constitution, ratified treaties are the supreme law of the land. They do not expire, cannot be administratively voided, and still bind both parties. Ambiguities are resolved in favor of the tribe.",
    authority: "U.S. Const. Art. VI § 2 · Canons of Construction",
  },
  {
    term: "Jurisdiction",
    slug: "jurisdiction",
    category: "Governance",
    catColor: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    oneLiner: "Inherent lawful authority — broader than reservation maps.",
    summary: "18 U.S.C. § 1151 defines Indian country as: (a) all land within reservation limits, (b) all dependent Indian communities, (c) all Indian allotments. Tribal jurisdiction is inherent — not delegated by Congress. McGirt v. Oklahoma (2020) confirmed 19 million acres remained Indian country.",
    authority: "18 U.S.C. § 1151 · McGirt v. Oklahoma (2020)",
  },
  {
    term: "Enrollment / Enrolled Member",
    slug: "enrollment",
    category: "Classification",
    catColor: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    oneLiner: "Tribal citizenship — the tribe's sovereign right to define.",
    summary: "Indian tribes have the inherent right to determine their own membership criteria (Santa Clara Pueblo v. Martinez, 1978). Federal programs may use enrollment as an eligibility criterion — but the definition of 'member' belongs to the tribe, not the federal government.",
    authority: "Santa Clara Pueblo v. Martinez (1978) · 25 U.S.C. § 5304",
  },
  {
    term: "Self-Determination",
    slug: "self-determination",
    category: "Governance",
    catColor: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    oneLiner: "The tribe runs its own programs, on its own terms — not when the government decides it is 'ready.'",
    summary: "ISDEAA (1975) codified the shift from federal paternalism to tribal control. Tribes contract to administer federal programs themselves. A tribe's request triggers the contract obligation — agencies cannot decline except on narrow statutory grounds (25 U.S.C. § 5321(a)(2)).",
    authority: "ISDEAA — 25 U.S.C. § 5302 · UNDRIP Art. 3–4",
  },
  {
    term: "Blood Quantum",
    slug: "blood-quantum",
    category: "Classification",
    catColor: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    oneLiner: "A colonial administrative measurement — created to reduce Indian populations on paper, not to define identity.",
    warning: "No treaty uses blood quantum as a basis for rights.",
    summary: "Blood quantum was introduced through the Dawes Act (1887) as an assimilation mechanism — designed to reduce the number of people qualifying for land rights over generations. There is no uniform federal threshold. Tribes retain the right to set their own membership criteria without it.",
    authority: "Santa Clara Pueblo v. Martinez (1978) · Dawes Act (1887)",
  },
  {
    term: "Descendant",
    slug: "descendant",
    category: "Classification",
    catColor: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    oneLiner: "A legal standing category — not a lesser tier than enrolled membership.",
    summary: "NAGPRA (1990) uses 'lineal descendant' as the primary standing category for repatriation claims. Many treaty rights were reserved for 'the tribe and their descendants' without enrollment qualification. The Snyder Act's 'Indians throughout the United States' has been interpreted to include descendants.",
    authority: "NAGPRA — 25 U.S.C. § 3001 · Snyder Act (1921)",
  },
  {
    term: "Indian Country",
    slug: "indian-country",
    category: "Governance",
    catColor: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    oneLiner: "A three-part jurisdictional zone — far broader than reservation maps.",
    summary: "18 U.S.C. § 1151 defines Indian country as reservation land, dependent Indian communities, and individual allotments. Administrative maps frequently lag behind the legal definition. McGirt (2020) found 19 million acres in Oklahoma had never ceased to be Indian country.",
    authority: "18 U.S.C. § 1151 · McGirt v. Oklahoma (2020)",
  },
];

// ── Legal Framework ───────────────────────────────────────────────────────────

const LEGAL_FRAMEWORK = [
  { code: "25 U.S.C. § 5321", title: "ISDEAA — Self-Determination Contracts", desc: "Authorizes tribes to administer federal education programs through self-determination contracts, replacing BIA-run programs with tribal-run ones." },
  { code: "25 U.S.C. § 5322", title: "ISDEAA — Self-Governance Compacts", desc: "Allows tribes to compact entire program areas including education into block grants administered under tribal authority." },
  { code: "20 U.S.C. § 7441", title: "Native American Language Programs", desc: "Federal support for indigenous language education and preservation programs." },
  { code: "26 U.S.C. § 501(c)(3)", title: "Nonprofit Tax-Exempt Status", desc: "SDU operates as a tax-exempt nonprofit. Donations are tax-deductible and the institution may receive foundation grants and federal education funding." },
];

const MEMBER_BENEFITS = [
  "Free access to all SDU course materials and certifications",
  "Priority enrollment in federal Indian law practicum",
  "Professional development credits for tribal officers",
  "Credentials recognized by the Office of the Chief Justice & Trustee",
  "Continuing education toward enrollment and advocacy roles",
  "Access to SDU digital library and sovereignty resource archive",
];

// ── Sovereignty Timeline ──────────────────────────────────────────────────────

const TIMELINE_EVENTS = [
  { year: "1778", label: "First Indian Treaty", category: "Treaty", color: "amber", desc: "Treaty of Fort Pitt — first formal treaty between the United States and an Indian nation, establishing the government-to-government relationship." },
  { year: "1823", label: "Johnson v. McIntosh", category: "Supreme Court", color: "indigo", desc: "Marshall Trilogy case 1 of 3. Established the doctrine of discovery — while controversial, it acknowledged tribal occupancy rights pre-dating European claims." },
  { year: "1831", label: "Cherokee Nation v. Georgia", category: "Supreme Court", color: "indigo", desc: "Marshall Trilogy case 2. Defined Indian tribes as 'domestic dependent nations' — sovereign, but with a special relationship to the federal government." },
  { year: "1832", label: "Worcester v. Georgia", category: "Supreme Court", color: "indigo", desc: "Marshall Trilogy case 3. Affirmed tribal sovereignty: state laws have no force in Indian country. Tribes are 'distinct, independent political communities.'" },
  { year: "1871", label: "End of Treaty Era", category: "Congress", color: "red", desc: "Congress ended the practice of making treaties with tribes — but did NOT abrogate existing treaties. All 374+ ratified treaties remain in effect as supreme law." },
  { year: "1887", label: "Dawes Act", category: "Federal Law", color: "red", desc: "Allotment era begins. Designed to break up communal tribal land. Led to the loss of 90 million acres of tribal land over 50 years. Blood quantum introduced." },
  { year: "1924", label: "Indian Citizenship Act", category: "Federal Law", color: "blue", desc: "Extended U.S. citizenship to all Native Americans born within the United States — without eliminating tribal citizenship or rights." },
  { year: "1934", label: "Indian Reorganization Act", category: "Federal Law", color: "teal", desc: "Ended allotment policy. Restored tribal self-governance. Encouraged formation of tribal governments and tribal constitutions." },
  { year: "1953", label: "Termination Era Begins", category: "Congress", color: "red", desc: "House Concurrent Resolution 108 terminated federal recognition of dozens of tribes — stripping treaty rights. Widely recognized as a failed policy." },
  { year: "1968", label: "Indian Civil Rights Act", category: "Federal Law", color: "blue", desc: "Extended many Bill of Rights protections to tribal members in dealings with tribal governments, while preserving tribal sovereignty." },
  { year: "1970", label: "Nixon's Self-Determination Policy", category: "Executive", color: "teal", desc: "President Nixon formally rejected termination policy and declared self-determination for Indian tribes — laying the groundwork for ISDEAA." },
  { year: "1975", label: "Indian Self-Determination Act (ISDEAA)", category: "Federal Law", color: "teal", desc: "25 U.S.C. § 5321. Landmark law allowing tribes to contract and compact to administer federal programs themselves. SDU operates under this authority." },
  { year: "1978", label: "Indian Child Welfare Act (ICWA)", category: "Federal Law", color: "blue", desc: "Affirmed tribal jurisdiction over child custody proceedings involving tribal children. One of the strongest tribal sovereignty statutes enacted." },
  { year: "1990", label: "NAGPRA", category: "Federal Law", color: "blue", desc: "Native American Graves Protection and Repatriation Act. Established lineal descendant standing for repatriation claims — broader than enrollment-only criteria." },
  { year: "1994", label: "Federally Recognized Tribe List Act", category: "Federal Law", color: "blue", desc: "Required annual publication of federally recognized tribes — but the list is an administrative tool, not an exhaustive definition of tribal rights." },
  { year: "2007", label: "UN Declaration on Indigenous Rights (UNDRIP)", category: "International", color: "violet", desc: "Recognized indigenous peoples' rights to self-determination, free prior informed consent, and cultural preservation. U.S. endorsed 2010." },
  { year: "2020", label: "McGirt v. Oklahoma", category: "Supreme Court", color: "indigo", desc: "Supreme Court confirmed that the Muscogee Nation reservation — covering most of eastern Oklahoma including Tulsa — had never been disestablished. 19 million acres remain Indian country." },
];

const CATEGORY_COLORS: Record<string, string> = {
  Treaty:       "bg-amber-500",
  "Supreme Court": "bg-indigo-600",
  Congress:     "bg-red-500",
  "Federal Law":"bg-teal-600",
  Executive:    "bg-teal-500",
  International:"bg-violet-600",
};

function TimelineTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/40 dark:bg-teal-950/20 p-4 flex items-start gap-3">
        <Clock className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-teal-900 dark:text-teal-100 mb-1">Federal Indian Law — Key Milestones</p>
          <p className="text-xs text-teal-800/70 dark:text-teal-300/70 leading-relaxed">
            Major treaties, legislation, and Supreme Court decisions that define the legal framework of tribal sovereignty and self-determination from 1778 to present.
          </p>
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-[72px] top-0 bottom-0 w-px bg-border" />
        <div className="space-y-3">
          {TIMELINE_EVENTS.map((ev) => {
            const dot = CATEGORY_COLORS[ev.category] ?? "bg-slate-500";
            return (
              <div key={ev.year + ev.label} className="flex gap-4 items-start">
                <div className="w-14 shrink-0 text-right">
                  <span className="text-[11px] font-mono font-semibold text-muted-foreground">{ev.year}</span>
                </div>
                <div className="relative flex flex-col items-center shrink-0 mt-1.5">
                  <div className={`h-3 w-3 rounded-full border-2 border-background ${dot} z-10`} />
                </div>
                <div className="flex-1 pb-3">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-semibold leading-tight">{ev.label}</p>
                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-white ${dot}`}>{ev.category}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{ev.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Indian Country Map ────────────────────────────────────────────────────────

const INDIAN_COUNTRY_POINTS = [
  { lat: 35.4676, lng: -97.5164, name: "McGirt Country", sub: "Eastern Oklahoma — 19M acres confirmed Indian country (2020)", color: "#7c3aed" },
  { lat: 44.3597, lng: -100.3510, name: "Standing Rock", sub: "Sioux Nation — treaty rights & water protection landmark", color: "#0d9488" },
  { lat: 36.7380, lng: -107.9900, name: "Navajo Nation", sub: "Largest reservation — 17.5M acres across AZ, NM, UT", color: "#d97706" },
  { lat: 46.8772, lng: -96.7898, name: "Turtle Mountain", sub: "Ojibwe treaty territory — ancestral Great Lakes region", color: "#2563eb" },
  { lat: 34.0522, lng: -118.2437, name: "Southern California", sub: "Multiple treaty tribes — complex overlapping jurisdictions", color: "#16a34a" },
  { lat: 47.6542, lng: -117.4260, name: "Spokane Territory", sub: "Plateau region — ISDEAA program contracting model", color: "#db2777" },
  { lat: 44.5133, lng: -88.0133, name: "Menominee Nation", sub: "Wisconsin — successful termination reversal (1973)", color: "#ea580c" },
  { lat: 45.5051, lng: -122.6750, name: "Pacific Northwest", sub: "Boldt Decision fishing rights — treaty interpretation landmark", color: "#0891b2" },
];

function MapTab() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<unknown>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    import("leaflet").then(L => {
      if (!mapRef.current || mapInstance.current) return;
      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false })
        .setView([39.5, -98.35], 4);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      INDIAN_COUNTRY_POINTS.forEach(pt => {
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${pt.color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        L.marker([pt.lat, pt.lng], { icon })
          .bindPopup(`<strong style="font-size:13px">${pt.name}</strong><br/><span style="font-size:11px;color:#555">${pt.sub}</span>`)
          .addTo(map);
      });

      mapInstance.current = map;
      setLoaded(true);
    });
    return () => {
      if (mapInstance.current) {
        (mapInstance.current as { remove: () => void }).remove();
        mapInstance.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/40 dark:bg-teal-950/20 p-4 flex items-start gap-3">
        <Map className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-teal-900 dark:text-teal-100 mb-1">Indian Country — Key Jurisdictional Sites</p>
          <p className="text-xs text-teal-800/70 dark:text-teal-300/70 leading-relaxed">
            Major tribal territories, treaty areas, and sovereignty landmarks across the United States. Each site represents a distinct legal jurisdiction or landmark case in federal Indian law.
          </p>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border" style={{ height: 420 }}>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/30 rounded-xl">
            <p className="text-sm text-muted-foreground">Loading map…</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {INDIAN_COUNTRY_POINTS.map(pt => (
          <div key={pt.name} className="flex items-start gap-2.5 rounded-lg border bg-card p-3">
            <div className="mt-1 h-3 w-3 rounded-full shrink-0" style={{ background: pt.color }} />
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-tight">{pt.name}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{pt.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Framework card ────────────────────────────────────────────────────────────

function FrameworkCard({ fw }: { fw: Framework }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`rounded-xl border transition-all overflow-hidden ${open ? "border-teal-300 dark:border-teal-700 bg-teal-50/50 dark:bg-teal-950/20" : "border-border hover:border-teal-200 dark:hover:border-teal-800 bg-card"}`}>
      <button
        className="w-full text-left p-4 flex items-start gap-3"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-sm text-foreground">{fw.term}</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${fw.catColor}`}>{fw.category}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{fw.oneLiner}</p>
        </div>
        <div className="shrink-0 mt-0.5 text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          {fw.warning && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300">{fw.warning}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground leading-relaxed">{fw.summary}</p>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-[11px] text-muted-foreground/60 font-mono">{fw.authority}</p>
            <Link href={`/sdu/definitions`}>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-teal-700 dark:text-teal-400 hover:text-teal-800 gap-1">
                Full analysis <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SduPage() {
  return (
    <div data-testid="page-sdu" className="space-y-5">

      {/* ── Hero ── */}
      <div className="rounded-2xl overflow-hidden border border-teal-800/60 bg-gradient-to-br from-teal-950 via-teal-900/90 to-slate-900 p-6">
        <div className="flex items-center gap-5">
          <img
            src={`${import.meta.env.BASE_URL}sdu-mascot.png`}
            alt="SDU Mascot"
            className="h-20 w-20 object-contain shrink-0 rounded-full border-2 border-teal-400/40 bg-teal-900/50"
          />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-400/60 mb-1">
              Nonprofit Indigenous Education System — ISDEAA
            </p>
            <h1 className="text-3xl font-serif font-bold text-teal-50">Self Determination University</h1>
            <p className="text-teal-300/60 text-sm mt-1">
              25 U.S.C. § 5321 · Educating members in sovereign rights and self-determined practice
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge className="bg-teal-700/60 border-teal-600 text-teal-200 text-xs">Nonprofit — 501(c)(3)</Badge>
              <Badge className="bg-slate-800/60 border-slate-600 text-slate-300 text-xs">ISDEAA Authorized</Badge>
              <Badge className="bg-green-900/40 border-green-700 text-green-300 text-xs">Active</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Programs",          value: PROGRAMS.length,         color: "text-teal-600 dark:text-teal-400" },
          { label: "Frameworks",        value: FRAMEWORKS.length,       color: "text-blue-600 dark:text-blue-400" },
          { label: "Member Benefits",   value: MEMBER_BENEFITS.length,  color: "text-green-600 dark:text-green-400" },
          { label: "Legal Authorities", value: LEGAL_FRAMEWORK.length,  color: "text-indigo-600 dark:text-indigo-400" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="shadow-none">
            <CardContent className="p-4">
              <p className={`text-2xl font-bold font-serif ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-9 w-full justify-start rounded-lg border bg-muted/30 p-1 gap-1 flex-wrap">
          <TabsTrigger value="overview"    className="text-xs h-7 gap-1.5"><GraduationCap className="h-3.5 w-3.5" />Overview</TabsTrigger>
          <TabsTrigger value="programs"   className="text-xs h-7 gap-1.5"><BookOpen className="h-3.5 w-3.5" />Programs</TabsTrigger>
          <TabsTrigger value="frameworks" className="text-xs h-7 gap-1.5"><Shield className="h-3.5 w-3.5" />Sovereignty Frameworks</TabsTrigger>
          <TabsTrigger value="legal"      className="text-xs h-7 gap-1.5"><Scale className="h-3.5 w-3.5" />Legal Authority</TabsTrigger>
          <TabsTrigger value="timeline"   className="text-xs h-7 gap-1.5"><Clock className="h-3.5 w-3.5" />Timeline</TabsTrigger>
          <TabsTrigger value="map"        className="text-xs h-7 gap-1.5"><Map className="h-3.5 w-3.5" />Indian Country Map</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="mt-0 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <Card className="shadow-none border-teal-200 dark:border-teal-800 bg-teal-50/40 dark:bg-teal-950/20">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400 mb-2">Mission & Purpose</p>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    Self Determination University (SDU) is the nonprofit education arm of the Mathias El Tribe, organized under
                    the Indian Self-Determination and Education Assistance Act (ISDEAA). SDU provides culturally grounded education,
                    professional development, and sovereignty literacy to enrolled members and eligible indigenous communities —
                    equipping them with the knowledge, credentials, and practical tools to exercise their inherent rights,
                    operate sovereign institutions, and build generational self-sufficiency.
                  </p>
                  <div className="rounded-lg border bg-background/80 p-3">
                    <p className="text-[11px] font-mono text-muted-foreground mb-1">Governing Instrument</p>
                    <p className="text-sm font-medium">25 U.S.C. § 5321 — ISDEAA Self-Determination Contracts</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Under ISDEAA, the Mathias El Tribe may contract or compact to administer federal education programs
                      directly. SDU is the institutional vehicle for that authority.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Benefits for Enrolled Members</p>
                  <ul className="space-y-2">
                    {MEMBER_BENEFITS.map((benefit) => (
                      <li key={benefit} className="flex gap-2.5 text-sm">
                        <CheckCircle className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <WhatNextPanel compact />

              <Card className="shadow-none">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick Access</p>
                  <div className="space-y-1.5">
                    {[
                      { href: "/profile",         label: "Member Enrollment" },
                      { href: "/law",             label: "Law Library" },
                      { href: "/business-canvas", label: "Business Education" },
                      { href: "/tribal-id",       label: "Tribal Credentials" },
                      { href: "/org",             label: "All Organizations" },
                    ].map(({ href, label }) => (
                      <Link key={href} href={href}>
                        <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8 text-left">
                          {label}
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── Programs ── */}
        <TabsContent value="programs" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PROGRAMS.map(({ title, level, levelColor, desc }) => (
              <Card key={title} className="shadow-none hover:border-teal-300 dark:hover:border-teal-700 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-sm">{title}</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${levelColor}`}>
                      {level}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Sovereignty Frameworks ── */}
        <TabsContent value="frameworks" className="mt-0 space-y-4">
          <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/40 dark:bg-teal-950/20 p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-teal-900 dark:text-teal-100 mb-1">Sovereignty Definition Frameworks</p>
                <p className="text-xs text-teal-800/70 dark:text-teal-300/70 leading-relaxed">
                  These frameworks teach how key legal terms operate differently in common usage, federal statute, 
                  administrative practice, and historical context. Understanding the gap between these meanings is 
                  the foundation of sovereignty literacy and legal self-determination.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {FRAMEWORKS.map(fw => (
              <FrameworkCard key={fw.slug} fw={fw} />
            ))}
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold">Definition Literacy System</p>
              <p className="text-xs text-muted-foreground mt-0.5">Full 4-layer analysis: common · historical · federal statutory · administrative — plus pattern recognition tools.</p>
            </div>
            <Link href="/sdu/definitions">
              <Button size="sm" className="gap-1.5 bg-teal-700 hover:bg-teal-800 text-white shrink-0">
                Open full system <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </TabsContent>

        {/* ── Legal Authority ── */}
        <TabsContent value="legal" className="mt-0 space-y-4">
          <Card className="shadow-none">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">How Any Tribe Can Establish an Indigenous Education Nonprofit</p>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                SDU's structure is replicable — organized as a 501(c)(3) with ISDEAA contracting authority,
                it can receive federal education dollars directly and deliver programs tribally.
              </p>
              <div className="divide-y">
                {LEGAL_FRAMEWORK.map(({ code, title, desc }) => (
                  <div key={code} className="py-4 first:pt-0 last:pb-0">
                    <p className="text-[11px] font-mono text-muted-foreground mb-0.5">{code}</p>
                    <p className="text-sm font-semibold mb-1">{title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <OrgDocumentsPanel orgId="sdu" orgName="Self Determination University" />
        </TabsContent>

        {/* ── Timeline ── */}
        <TabsContent value="timeline" className="mt-0">
          <TimelineTab />
        </TabsContent>

        {/* ── Map ── */}
        <TabsContent value="map" className="mt-0">
          <MapTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
