import type { CoordinateStatus } from "./types";

export function coordinateConfidence(status: CoordinateStatus): number {
  if (status === "verified") return 95;
  if (status === "approximate") return 70;
  if (status === "tribal_territory") return 55;
  return 0;
}
