// Region / tribal-nation keyword → approximate centroid coordinate.
// Mirrors the REGION_COORD_MAP used in the Urban Indian Continuity Atlas so
// that both apps infer ancestor locations consistently.

export const REGION_COORD_MAP: Record<string, [number, number]> = {
  oklahoma: [35.5, -97.5],
  cherokee: [35.5, -95.9],
  choctaw: [34.7, -95.3],
  chickasaw: [34.3, -97.1],
  seminole: [35.2, -96.7],
  creek: [35.7, -96.0],
  muscogee: [35.7, -96.0],
  osage: [36.7, -96.4],
  navajo: [36.5, -108.5],
  "diné": [36.5, -108.5],
  lakota: [43.5, -102.0],
  sioux: [43.5, -102.0],
  ojibwe: [46.5, -91.0],
  chippewa: [46.5, -91.0],
  apache: [33.5, -109.0],
  comanche: [34.6, -98.4],
  paiute: [38.5, -117.5],
  shoshone: [43.0, -115.0],
  cheyenne: [45.5, -107.0],
  crow: [45.6, -107.5],
  blackfeet: [48.7, -112.8],
  blackfoot: [48.7, -112.8],
  "nez perce": [46.0, -116.5],
  yakama: [46.6, -120.5],
  lummi: [48.8, -122.6],
  pueblo: [35.5, -106.5],
  zuni: [35.1, -108.8],
  hopi: [35.8, -110.3],
  mississippi: [32.5, -89.5],
  "north carolina": [35.5, -79.0],
  virginia: [37.5, -79.0],
  alabama: [32.8, -86.8],
  georgia: [32.5, -83.5],
  florida: [28.0, -82.5],
  louisiana: [31.0, -92.0],
  "south carolina": [34.0, -81.0],
  tennessee: [36.0, -86.5],
  arkansas: [34.8, -92.2],
  texas: [31.0, -100.0],
  california: [36.5, -119.5],
  "mathias el": [34.05, -118.24],
  "mathias el tribe": [34.05, -118.24],
  "los angeles": [34.05, -118.24],
  chicago: [41.88, -87.63],
  minneapolis: [44.98, -93.27],
  "san francisco": [37.77, -122.42],
  seattle: [47.6, -122.33],
  denver: [39.74, -104.99],
  phoenix: [33.45, -112.07],
  tahlequah: [35.91, -94.97],
  tulsa: [36.15, -95.99],
  "new mexico": [34.5, -106.0],
  arizona: [34.0, -111.5],
  "south dakota": [44.5, -100.0],
  "north dakota": [47.5, -100.0],
  montana: [47.0, -110.0],
  idaho: [44.0, -114.5],
  washington: [47.5, -120.5],
  oregon: [44.0, -120.5],
  minnesota: [46.5, -94.0],
  wisconsin: [44.5, -90.0],
  michigan: [44.0, -85.0],
};

/**
 * Returns the first matching [lat, lng] centroid for any keyword found in `text`,
 * or null if nothing matches.
 */
export function geocodeText(text: string): [number, number] | null {
  const lower = text.toLowerCase();
  for (const [key, coords] of Object.entries(REGION_COORD_MAP)) {
    if (lower.includes(key)) return coords;
  }
  return null;
}
