#!/usr/bin/env bash
set -euo pipefail
cd "${1:-$HOME/sovereign-office}"
APP="artifacts/sovereign-dashboard/src/App.tsx"
LAYOUT="artifacts/sovereign-dashboard/src/components/layout.tsx"
cp "$APP" "$APP.BAK-lineage-$(date +%F-%H%M)"
cp "$LAYOUT" "$LAYOUT.BAK-lineage-$(date +%F-%H%M)"
python3 <<'PY'
from pathlib import Path
app = Path('artifacts/sovereign-dashboard/src/App.tsx')
s = app.read_text()
old = '''      <Route path="/family-tree">
        {() => <ProtectedRoute component={FamilyTreePage} />}
      </Route>
      <Route path="/kinship-tree">
        {() => <ProtectedRoute component={KinshipTreePage} />}
      </Route>'''
new = '''      <Route path="/lineage">
        {() => <ProtectedRoute component={GedcomImportPage} />}
      </Route>
      <Route path="/family-tree">
        {() => <Redirect to="/lineage" />}
      </Route>
      <Route path="/kinship-tree">
        {() => <Redirect to="/lineage" />}
      </Route>'''
s = s.replace(old, new)
s = s.replace('''      <Route path="/admin/lineage-import">
        {() => <ProtectedRoute component={AdminLineageImportPage} />}
      </Route>''', '''      <Route path="/admin/lineage-import">
        {() => <Redirect to="/lineage" />}
      </Route>''')
s = s.replace('''      <Route path="/gedcom-import">
        {() => <ProtectedRoute component={GedcomImportPage} />}
      </Route>''', '''      <Route path="/gedcom-import">
        {() => <Redirect to="/lineage" />}
      </Route>''')
app.write_text(s)
layout = Path('artifacts/sovereign-dashboard/src/components/layout.tsx')
s = layout.read_text()
s = s.replace('{ href: "/family-tree",          label: "Family Tree & Lineage",  icon: TreePine },', '{ href: "/lineage",              label: "Lineage Registry",      icon: TreePine },')
s = s.replace('{ href: "/family-tree",          label: "Family Tree & Lineage", icon: TreePine },', '{ href: "/lineage",              label: "Lineage Registry",     icon: TreePine },')
s = s.replace('{ href: "/family-tree",                label: "Patient Lineage",   icon: TreePine },', '{ href: "/lineage",                    label: "Lineage Registry",  icon: TreePine },')
s = s.replace('        { href: "/admin/lineage-import",label: "Lineage Registry",     icon: Database },\n', '')
s = s.replace('        { href: "/gedcom-import",       label: "GEDCOM Import",        icon: GitMerge },\n', '')
marker = '        { href: "/tasks",               label: "Tasks",                icon: CheckSquare },\n'
if '{ href: "/lineage",             label: "Lineage Registry",' not in s:
    s = s.replace(marker, marker + '        { href: "/lineage",             label: "Lineage Registry",     icon: TreePine },\n')
layout.write_text(s)
PY
git diff -- "$APP" "$LAYOUT"
