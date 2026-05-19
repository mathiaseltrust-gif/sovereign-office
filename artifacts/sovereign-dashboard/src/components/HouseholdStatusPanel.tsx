import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MapPin, Shield, Heart, Users, Home, AlertCircle } from "lucide-react";

interface HouseholdMember {
  id: number;
  fullName: string;
  relationship: "spouse" | "child_dependent";
  birthYear: number | null;
  tribalNation: string | null;
  inheritedAddress: string | null;
  inheritedLandStatus: string | null;
  inheritedTribalLandCode: string | null;
  isIndianCountry: boolean;
  ihsEligible: boolean;
  urbanIndianEligible: boolean;
  icwaProtected: boolean;
  protections: string[];
}

interface HouseholdStatus {
  hasLinkedNode: boolean;
  headName?: string;
  headTribalNation?: string | null;
  address: string | null;
  landStatus: string | null;
  tribalLandCode: string | null;
  landClassification?: string | null;
  isIndianCountry: boolean;
  ihsEligible: boolean;
  urbanIndianEligible: boolean;
  members: HouseholdMember[];
  memberCount: number;
}

const LAND_STATUS_LABELS: Record<string, string> = {
  trust: "Trust Land",
  allotment: "Allotment",
  tribal_government_land: "Tribal Government Land",
  tribal_trust_stewardship: "Tribal Trust Stewardship",
  protected_tribal_land: "Protected Tribal Land",
  sacred_cultural_land: "Sacred / Cultural Land",
  restricted_fee: "Restricted Fee",
  fee: "Fee Simple",
};

const PROTECTION_COLORS: Record<string, string> = {
  "Indian Country Jurisdiction": "bg-amber-100 text-amber-800 border-amber-300",
  "IHS Eligible":                 "bg-blue-100 text-blue-800 border-blue-300",
  "Urban Indian Health":          "bg-teal-100 text-teal-800 border-teal-300",
  "ICWA Protected":               "bg-purple-100 text-purple-800 border-purple-300",
  "Sovereign Spousal Rights":     "bg-rose-100 text-rose-800 border-rose-300",
};

export function HouseholdStatusPanel() {
  const { data, isLoading, error } = useQuery<HouseholdStatus>({
    queryKey: ["household-status"],
    queryFn: async () => {
      const r = await fetch("/api/lineage/nodes/household/status", {
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Home className="w-4 h-4" /> Household Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) return null;

  const landLabel = data.landStatus ? (LAND_STATUS_LABELS[data.landStatus] ?? data.landStatus) : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Home className="w-4 h-4" /> Household Status & Inherited Protections
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Household address + land status (the source record) */}
        <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Household Address of Record</p>
          {data.address ? (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{data.address}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              No address on file. Set your mailing address in your{" "}
              <Link href="/profile" className="underline font-medium">profile</Link>{" "}
              — all household members will inherit it automatically.
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {landLabel && (
              <Badge variant="outline" className={data.isIndianCountry ? "border-amber-400 bg-amber-50 text-amber-800" : "border-zinc-300"}>
                {landLabel}
              </Badge>
            )}
            {data.isIndianCountry && (
              <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold">
                Indian Country
              </Badge>
            )}
            {data.tribalLandCode && (
              <Badge variant="outline" className="text-xs font-mono">
                {data.tribalLandCode}
              </Badge>
            )}
            {data.ihsEligible && (
              <Badge className="bg-blue-100 text-blue-800 border border-blue-300 text-xs">IHS Eligible</Badge>
            )}
            {data.urbanIndianEligible && (
              <Badge className="bg-teal-100 text-teal-800 border border-teal-300 text-xs">Urban Indian Health</Badge>
            )}
          </div>
        </div>

        {/* Household head note */}
        {!data.hasLinkedNode && (
          <div className="text-xs text-muted-foreground border border-dashed rounded px-3 py-2">
            Link a lineage node to your profile ("This is me" in the Family Tree) to enable household member status inheritance.
          </div>
        )}

        {/* Household members */}
        {data.memberCount > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Household Members ({data.memberCount})
            </p>
            <div className="text-xs text-muted-foreground italic mb-2">
              All members below inherit the household address and protections — no separate address entry required.
            </div>

            {data.members.map(member => (
              <div
                key={member.id}
                className="rounded-lg border bg-background px-4 py-3 space-y-2"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-semibold">{member.fullName}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {member.relationship === "spouse" ? "Spouse" : "Child / Dependent"}
                      {member.birthYear ? ` · b. ${member.birthYear}` : ""}
                      {member.tribalNation ? ` · ${member.tribalNation}` : ""}
                    </p>
                  </div>
                  {member.icwaProtected && (
                    <Badge className="bg-purple-100 text-purple-800 border border-purple-300 text-xs">
                      <Shield className="w-3 h-3 mr-1" /> ICWA Protected
                    </Badge>
                  )}
                </div>

                {/* Inherited address chip */}
                {member.inheritedAddress && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="italic">Inherits household address:</span>
                    <span className="font-medium not-italic text-foreground">{member.inheritedAddress}</span>
                  </div>
                )}

                {/* Protection badges */}
                {member.protections.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {member.protections.map(p => (
                      <span
                        key={p}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${PROTECTION_COLORS[p] ?? "bg-zinc-100 text-zinc-700 border-zinc-200"}`}
                      >
                        {p === "IHS Eligible" && <Heart className="w-2.5 h-2.5" />}
                        {p === "ICWA Protected" && <Shield className="w-2.5 h-2.5" />}
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {data.hasLinkedNode && data.memberCount === 0 && (
          <div className="text-xs text-muted-foreground border border-dashed rounded px-3 py-2">
            No household members added yet. Use the{" "}
            <Link href="/family-tree" className="underline font-medium">Family Tree</Link>{" "}
            to add a spouse, child, or dependent — their address and protections will auto-populate from this record.
          </div>
        )}

        {/* Legal basis footnote */}
        <p className="text-[10px] text-muted-foreground/60 leading-relaxed border-t pt-3">
          Household membership confers Indian Country jurisdiction (Worcester v. Georgia), IHS eligibility
          (Snyder Act · IHCIA § 201), Urban Indian health access, and ICWA protections for qualifying minors
          (25 U.S.C. § 1903). Address and land status govern all members by operation of tribal sovereign law.
        </p>

        <div className="flex gap-2">
          <Link href="/family-tree">
            <Button variant="outline" size="sm" className="text-xs">Manage Household</Button>
          </Link>
          <Link href="/land">
            <Button variant="outline" size="sm" className="text-xs">Land Records</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
