#!/usr/bin/env bash
set -euo pipefail
cd "${1:-$HOME/sovereign-office}"
STAMP="$(date +%F-%H%M)"
LOG="repair-$STAMP.log"
exec > >(tee -a "$LOG") 2>&1

echo "== Sovereign Office one-shot repair =="
echo "Started: $STAMP"

echo "== 1. Snapshot current state =="
git status --short || true
sudo docker compose -f docker-compose.prod.yml ps || true
sudo docker compose -f docker-compose.gramps.yml ps || true

echo "== 2. Runtime nginx upload limit patch inside running containers =="
for c in sovereign-office-gateway-1 sovereign-office-sovereign-1; do
  if sudo docker ps --format '{{.Names}}' | grep -qx "$c"; then
    echo "Patching $c"
    sudo docker exec "$c" sh -c 'find /etc/nginx -type f -name "*.conf" -print | while read f; do cp "$f" "$f.BAK-413"; if grep -q client_max_body_size "$f"; then sed -i "s/client_max_body_size .*/client_max_body_size 100M;/g" "$f"; else sed -i "/server {/a\\    client_max_body_size 100M;" "$f"; fi; done; nginx -t && nginx -s reload'
  fi
done

echo "== 3. Repo nginx upload limit patch =="
for f in deploy-package/nginx-sovereign.conf deploy-package/gateway/nginx.conf gateway.nginx.working sovereign-dashboard.nginx.working gateway.STABLE-WORKING.conf; do
  [ -f "$f" ] || continue
  cp "$f" "$f.BAK-413-$STAMP"
  if grep -q client_max_body_size "$f"; then
    sed -i 's/client_max_body_size .*/client_max_body_size 100M;/g' "$f"
  else
    sed -i '/server {/a\    client_max_body_size 100M;' "$f" || true
  fi
done

echo "== 4. Consolidate frontend routes/navigation to /lineage =="
APP="artifacts/sovereign-dashboard/src/App.tsx"
LAYOUT="artifacts/sovereign-dashboard/src/components/layout.tsx"
if [ -f "$APP" ]; then
  cp "$APP" "$APP.BAK-one-lineage-$STAMP"
  python3 - <<'PY'
from pathlib import Path
p = Path('artifacts/sovereign-dashboard/src/App.tsx')
s = p.read_text()
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
if '<Route path="/lineage">' not in s:
    marker = '      <Route path="/family-tree">'
    s = s.replace(marker, '      <Route path="/lineage">\n        {() => <ProtectedRoute component={GedcomImportPage} />}\n      </Route>\n' + marker)
p.write_text(s)
PY
fi
if [ -f "$LAYOUT" ]; then
  cp "$LAYOUT" "$LAYOUT.BAK-one-lineage-$STAMP"
  python3 - <<'PY'
from pathlib import Path
p = Path('artifacts/sovereign-dashboard/src/components/layout.tsx')
s = p.read_text()
s = s.replace('{ href: "/family-tree",          label: "Family Tree & Lineage",  icon: TreePine },', '{ href: "/lineage",              label: "Lineage Registry",      icon: TreePine },')
s = s.replace('{ href: "/family-tree",          label: "Family Tree & Lineage", icon: TreePine },', '{ href: "/lineage",              label: "Lineage Registry",     icon: TreePine },')
s = s.replace('{ href: "/family-tree",                label: "Patient Lineage",   icon: TreePine },', '{ href: "/lineage",                    label: "Lineage Registry",  icon: TreePine },')
s = s.replace('        { href: "/admin/lineage-import",label: "Lineage Registry",     icon: Database },\n', '')
s = s.replace('        { href: "/gedcom-import",       label: "GEDCOM Import",        icon: GitMerge },\n', '')
marker = '        { href: "/tasks",               label: "Tasks",                icon: CheckSquare },\n'
if '{ href: "/lineage",             label: "Lineage Registry",' not in s:
    s = s.replace(marker, marker + '        { href: "/lineage",             label: "Lineage Registry",     icon: TreePine },\n')
p.write_text(s)
PY
fi

echo "== 5. Land DB inspection =="
cat > /tmp/land_check.sql <<'SQL'
SELECT id, tract_number, parcel_id, acreage, classification, internal_tribal_status, jurisdictional_status, tribal_code_ref, tribal_ref, lat, lng
FROM land_parcels
ORDER BY id;
SQL
sudo docker run --rm --env-file .env -v /tmp/land_check.sql:/tmp/land_check.sql postgres:16-alpine sh -c 'psql "$DATABASE_URL" -f /tmp/land_check.sql' || true

echo "== 6. Endpoint checks =="
curl -sI http://localhost:5010 | head || true
curl -sI https://office.mathiaseltribe.org/api/healthz | head || true

echo "== 7. Diff summary =="
git diff --stat || true

echo "== Done =="
echo "Log: $LOG"
echo "Next: review diff, git add/commit/push, then deploy sovereign/gateway/api."
