import React, { useState } from "react";
import {
  GraduationCap,
  Scale,
  FileText,
  BookOpen,
  Shield,
  ChevronRight,
  ExternalLink,
  Download,
  Search,
  Landmark,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";

const PILLARS = [
  {
    id: "sovereignty",
    icon: Shield,
    title: "Tribal Sovereignty & Self-Governance",
    color: "amber",
    description:
      "Study the legal foundations of tribal sovereignty, treaty rights, and the principles of self-governance that protect the Nation's authority.",
    topics: [
      "Tribal Sovereignty Doctrine",
      "Treaty Rights & Obligations",
      "Indian Self-Determination Act",
      "Sovereignty vs. Federal Jurisdiction",
      "ICWA — Indian Child Welfare Act",
      "Trust Responsibility",
    ],
  },
  {
    id: "law",
    icon: Scale,
    title: "Law, Process & Accountability",
    color: "blue",
    description:
      "Understand due process, lawful procedure, constitutional protections, and the accountability standards that govern the Nation and its members.",
    topics: [
      "Due Process & Equal Protection",
      "Tribal Court Procedure",
      "Full Faith & Credit",
      "Administrative Law",
      "Federal Indian Law",
      "Constitutional Protections",
    ],
  },
  {
    id: "records",
    icon: FileText,
    title: "Record Preservation & Protected Rights",
    color: "emerald",
    description:
      "Learn the standards for preserving official records, protecting sensitive data, and asserting your documented rights within the Nation.",
    topics: [
      "Lineage Documentation Standards",
      "Official Record Keeping",
      "Privacy & Protected Data",
      "Right to Records Access",
      "Enrollment Documentation",
      "Archival Best Practices",
    ],
  },
];

const LIBRARY = [
  {
    id: "treaty-dancing-rabbit",
    title: "Treaty of Dancing Rabbit Creek (1830)",
    category: "Treaty",
    year: "1830",
    description:
      "The Treaty of Dancing Rabbit Creek — a treaty of perpetual friendship, cession and limits entered into between the United States and the Choctaw Nation. One of the foundational documents of federal Indian law.",
    color: "amber",
    icon: Landmark,
    downloadUrl: `${import.meta.env.BASE_URL}treaty-dancing-rabbit-creek-1830.pdf`,
    tags: ["Treaty", "Federal Indian Law", "Sovereignty", "1830"],
  },
  {
    id: "indian-self-determination",
    title: "Indian Self-Determination and Education Assistance Act",
    category: "Federal Law",
    year: "1975",
    description:
      "Public Law 93-638 — the cornerstone legislation affirming tribal self-governance, allowing tribes to contract and compact federal services for their members.",
    color: "blue",
    icon: Scale,
    tags: ["Self-Governance", "Federal Law", "Education"],
  },
  {
    id: "icwa",
    title: "Indian Child Welfare Act (ICWA)",
    category: "Federal Law",
    year: "1978",
    description:
      "Federal law establishing minimum standards for the removal of American Indian children from their families, affirming tribal jurisdiction over child custody proceedings.",
    color: "emerald",
    icon: Shield,
    tags: ["ICWA", "Child Welfare", "Tribal Jurisdiction"],
  },
];

const colorMap: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-950/20",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
};

export default function University() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"library" | "pillars">("pillars");

  const filteredLibrary = LIBRARY.filter(
    (doc) =>
      !search ||
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.description.toLowerCase().includes(search.toLowerCase()) ||
      doc.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl bg-[#0f1923] text-white">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url(${import.meta.env.BASE_URL}sdu-book-cover.png)`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            filter: "blur(2px)",
          }}
        />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 p-6 md:p-8">
          <img
            src={`${import.meta.env.BASE_URL}sdu-mascot.png`}
            alt="SDU"
            className="h-28 w-28 object-contain shrink-0 rounded-full border-2 border-amber-400/40"
          />
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
              <GraduationCap className="h-5 w-5 text-amber-400" />
              <span className="text-amber-400 text-sm font-semibold uppercase tracking-widest">
                SDU
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-none">
              Self-Determination University
            </h1>
            <p className="mt-2 text-white/70 max-w-xl text-sm md:text-base">
              A private institute for self-governance, lawful process, and disciplined record
              preservation. Knowledge. Sovereignty. Responsibility. Truth. Due Process. Future.
            </p>
            <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-2">
              {["Tribal Sovereignty", "Law & Process", "Record Preservation"].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-amber-400/20 text-amber-300 border border-amber-400/30"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
        {/* Gold bottom rule */}
        <div className="h-1 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600" />
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("pillars")}
          className={`pb-2.5 px-1 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "pillars"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Departments
        </button>
        <button
          onClick={() => setActiveTab("library")}
          className={`pb-2.5 px-1 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "library"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Research Library
        </button>
      </div>

      {/* Departments tab */}
      {activeTab === "pillars" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PILLARS.map((pillar) => {
              const colors = colorMap[pillar.color];
              const Icon = pillar.icon;
              return (
                <Card
                  key={pillar.id}
                  className={`border ${colors.border} ${colors.bg} hover:shadow-md transition-shadow`}
                >
                  <CardHeader className="pb-2">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-2 ${colors.badge}`}>
                      <Icon className={`h-5 w-5 ${colors.text}`} />
                    </div>
                    <CardTitle className="text-base leading-tight">{pillar.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{pillar.description}</p>
                    <div className="space-y-1.5">
                      {pillar.topics.map((topic) => (
                        <div key={topic} className="flex items-start gap-2">
                          <ChevronRight className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${colors.text}`} />
                          <span className="text-xs text-foreground">{topic}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Scene image */}
          <div className="rounded-xl overflow-hidden border">
            <img
              src={`${import.meta.env.BASE_URL}sdu-treaty-scene.png`}
              alt="SDU — Tribal Sovereignty & Treaty Research"
              className="w-full object-cover max-h-64"
            />
          </div>

          {/* Quick links into existing tools */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/legal">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-dashed">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    <BookOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Legal Resources</p>
                    <p className="text-xs text-muted-foreground">Tribal codes, federal law, doctrine library</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                </CardContent>
              </Card>
            </Link>
            <Link href="/guidance">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-dashed">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <Scale className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Legal Guidance (AI)</p>
                    <p className="text-xs text-muted-foreground">Ask sovereign law questions, get researched answers</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Law books image */}
          <Card className="overflow-hidden">
            <div className="flex flex-col md:flex-row">
              <img
                src={`${import.meta.env.BASE_URL}sdu-law-books.png`}
                alt="SDU Law Library"
                className="w-full md:w-56 object-cover shrink-0"
              />
              <CardContent className="p-5 flex flex-col justify-center">
                <h3 className="font-bold text-lg mb-1">The SDU Law Library</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Access the full collection of tribal constitutions, federal Indian law statutes, 
                  historical treaties, and sovereign doctrine — curated for members pursuing 
                  knowledge of their protected rights and lawful standing.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => setActiveTab("library")}
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Open Research Library
                </Button>
              </CardContent>
            </div>
          </Card>
        </div>
      )}

      {/* Research Library tab */}
      {activeTab === "library" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search treaties, laws, doctrine..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="space-y-3">
            {filteredLibrary.map((doc) => {
              const colors = colorMap[doc.color];
              const Icon = doc.icon;
              return (
                <Card key={doc.id} className={`border ${colors.border}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={`h-11 w-11 rounded-lg flex items-center justify-center shrink-0 ${colors.badge}`}>
                        <Icon className={`h-5 w-5 ${colors.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm">{doc.title}</h3>
                          <Badge variant="outline" className="text-[10px]">
                            {doc.year}
                          </Badge>
                          <Badge className={`text-[10px] border-0 ${colors.badge}`}>
                            {doc.category}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">{doc.description}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {doc.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                          {doc.downloadUrl && (
                            <a
                              href={doc.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto"
                            >
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                                <Download className="h-3 w-3" />
                                View PDF
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredLibrary.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No documents match your search.</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center pt-2">
            For the full legal resource database, visit{" "}
            <Link href="/legal" className="underline text-primary">
              Legal Resources
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
