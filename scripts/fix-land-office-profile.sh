#!/usr/bin/env bash
set -euo pipefail

# Safe patch for Land & Asset Management:
# - keeps existing MET-TL-BC-001 land code
# - keeps tribal government land classification
# - improves edit modal contrast
# - makes land code visibly clickable in the registry
# - leaves Docker routing untouched

cd "${1:-$HOME/sovereign-office}"
LAND_PAGE="artifacts/sovereign-dashboard/src/pages/land.tsx"
BACKUP="$LAND_PAGE.BAK-land-office-profile-$(date +%F-%H%M)"
cp "$LAND_PAGE" "$BACKUP"

python3 <<'PY'
from pathlib import Path
p = Path("artifacts/sovereign-dashboard/src/pages/land.tsx")
s = p.read_text()

s = s.replace(
'  tribal_government_land: "bg-amber-700 text-amber-100",',
'  tribal_government_land: "bg-amber-100 text-amber-950 border border-amber-400",'
)

s = s.replace(
'    exclusive_tribal: "text-emerald-400",',
'    exclusive_tribal: "text-emerald-700",\n    exclusive_tribal_jurisdiction: "text-emerald-700",'
)

s = s.replace(
'      <div className="bg-[#111] border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">',
'      <div className="bg-white text-slate-950 border border-slate-300 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">'
)

s = s.replace(
'        <div className="flex items-start justify-between px-6 py-4 border-b border-border sticky top-0 bg-[#111] z-10">',
'        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">'
)

s = s.replace(
'            <h2 className="text-base font-semibold text-amber-400">{title}</h2>',
'            <h2 className="text-base font-semibold text-slate-950">{title}</h2>'
)

s = s.replace(
'              {p.tribal_code_ref && <div className="text-[10px] text-amber-500 mt-0.5">{p.tribal_code_ref.replace("METC.T4.", "METC T4 ")}</div>}',
'''              {p.tribal_code_ref && (
                <button
                  onClick={() => onSelectParcel?.(p)}
                  className="text-[11px] text-amber-700 hover:text-amber-900 hover:underline mt-0.5 font-mono font-semibold"
                  title={`Open land profile for ${p.tribal_code_ref}`}
                >
                  {p.tribal_code_ref.replace("METC.T4.", "METC T4 ")}
                </button>
              )}'''
)

s = s.replace(
'               ${p.tribal_code_ref ? `<div style="font-size:10px;color:#b45309;margin-top:4px">${p.tribal_code_ref.replace("METC.T4.", "METC T4 ")}</div>` : ""}',
'               ${p.tribal_code_ref ? `<div data-parcel-open="true" style="font-size:11px;color:#92400e;margin-top:4px;font-weight:700;cursor:pointer;text-decoration:underline">${p.tribal_code_ref.replace("METC.T4.", "METC T4 ")}</div>` : ""}'
)

p.write_text(s)
PY

echo "Patched $LAND_PAGE"
echo "Backup: $BACKUP"
git diff -- "$LAND_PAGE"
