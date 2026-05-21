const LS_KEY = "sovereign_recent_pages_v1";
const MAX_PATHS = 10;

export function recordPageVisit(path: string) {
  if (!path || path === "/") return;
  try {
    const existing: string[] = JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
    const updated = [path, ...existing.filter((p) => p !== path)].slice(0, MAX_PATHS);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  } catch { /* non-fatal */ }
}

export function getRecentPages(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
  } catch { return []; }
}
