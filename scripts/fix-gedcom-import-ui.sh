#!/usr/bin/env bash
set -euo pipefail

# Fix Admin Lineage Import so the UI uses the newer Ancestry GEDCOM staging importer.
# It changes:
#   POST /api/lineage/import     field=file
# to:
#   POST /api/ancestry/gedcom/import     field=gedcom
# and makes JSON parsing safer when the gateway returns HTML.

cd "${1:-$HOME/sovereign-office}"
PAGE="artifacts/sovereign-dashboard/src/pages/admin-lineage-import.tsx"
BACKUP="$PAGE.BAK-gedcom-import-ui-$(date +%F-%H%M)"
cp "$PAGE" "$BACKUP"

python3 <<'PY'
from pathlib import Path
p = Path("artifacts/sovereign-dashboard/src/pages/admin-lineage-import.tsx")
s = p.read_text()

s = s.replace('form.append("file", file);', 'form.append("gedcom", file);')
s = s.replace('const r = await fetch("/api/lineage/import", {', 'const r = await fetch("/api/ancestry/gedcom/import", {')

old = '''      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Import failed");
      }
      return r.json() as Promise<ImportResult>;'''
new = '''      const contentType = r.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json")
        ? await r.json()
        : { error: await r.text() };
      if (!r.ok) {
        const message = typeof payload.error === "string"
          ? payload.error.slice(0, 500)
          : "Import failed";
        throw new Error(message);
      }
      return payload as ImportResult;'''
if old in s:
    s = s.replace(old, new)

# Let the success toast handle both old /api/lineage/import shape and new /api/ancestry/gedcom/import shape.
s = s.replace(
'      toast({\n        title: "Import complete",\n        description: `Created ${data.created}, merged ${data.merged}, skipped ${data.skipped} of ${data.total} records.`,\n      });',
'''      toast({
        title: "GEDCOM staged",
        description: data.totalIndividuals
          ? `Staged ${data.totalIndividuals} people and ${data.totalFamilies ?? 0} family groups for review.`
          : `Created ${data.created ?? 0}, merged ${data.merged ?? 0}, skipped ${data.skipped ?? 0} of ${data.total ?? 0} records.`,
      });'''
)

# Widen ImportResult enough for the GEDCOM staging response.
s = s.replace('''interface ImportResult {
  format: string;
  total: number;
  created: number;
  merged: number;
  skipped: number;
  errors: string[];
  lineageIds: number[];
  graph: {
    totalGenerations: number;
    tribalNations: string[];
    familyGroups: string[];
    lineageTags: string[];
    icwaEligible: boolean;
    welfareEligible: boolean;
  };
}''', '''interface ImportResult {
  format?: string;
  total?: number;
  created?: number;
  merged?: number;
  skipped?: number;
  errors?: string[];
  lineageIds?: number[];
  batchId?: number;
  filename?: string;
  encoding?: string;
  totalIndividuals?: number;
  totalFamilies?: number;
  matchSummary?: { exact: number; probable: number; possible: number; new: number };
  graph?: {
    totalGenerations: number;
    tribalNations: string[];
    familyGroups: string[];
    lineageTags: string[];
    icwaEligible: boolean;
    welfareEligible: boolean;
  };
}''')

# Make result panel tolerant of staging response.
s = s.replace('Import Complete — {result.format.toUpperCase()}', 'GEDCOM Import — {result.format?.toUpperCase?.() ?? "STAGED"}')
s = s.replace('{result.created}', '{result.created ?? result.matchSummary?.new ?? 0}')
s = s.replace('{result.merged}', '{result.merged ?? ((result.matchSummary?.exact ?? 0) + (result.matchSummary?.probable ?? 0) + (result.matchSummary?.possible ?? 0))}')
s = s.replace('{result.skipped}', '{result.skipped ?? 0}')
s = s.replace('result.graph.lineageTags.length > 0', '(result.graph?.lineageTags?.length ?? 0) > 0')
s = s.replace('result.graph.lineageTags.map', 'result.graph!.lineageTags.map')
s = s.replace('result.graph.tribalNations.length > 0', '(result.graph?.tribalNations?.length ?? 0) > 0')
s = s.replace('result.graph.tribalNations.join', 'result.graph!.tribalNations.join')
s = s.replace('result.graph.totalGenerations > 0', '(result.graph?.totalGenerations ?? 0) > 0')
s = s.replace('result.graph.totalGenerations', 'result.graph!.totalGenerations')
s = s.replace('result.graph.icwaEligible', 'result.graph?.icwaEligible')
s = s.replace('result.graph.welfareEligible', 'result.graph?.welfareEligible')
s = s.replace('result.errors.length > 0', '(result.errors?.length ?? 0) > 0')
s = s.replace('Warnings ({result.errors.length})', 'Warnings ({result.errors?.length ?? 0})')
s = s.replace('result.errors.map', '(result.errors ?? []).map')

p.write_text(s)
PY

echo "Patched $PAGE"
echo "Backup: $BACKUP"
git diff -- "$PAGE"
