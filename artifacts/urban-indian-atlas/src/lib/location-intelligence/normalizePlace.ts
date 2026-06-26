export function normalizePlaceName(place?: string | null): string {
  return String(place || "")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
}
