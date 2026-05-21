import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const routesDir = path.resolve(
  new URL(".", import.meta.url).pathname,
  "../src/routes"
);

describe("routes structure", () => {
  it("all wrapped route directories have an index.ts", () => {
    const wrapped = [
      "deed", "deliver", "donate", "family-tree", "geocode",
      "health", "law", "membership", "notifications",
      "storage", "unsubscribe", "users",
    ];
    for (const name of wrapped) {
      const indexPath = path.join(routesDir, name, "index.ts");
      expect(fs.existsSync(indexPath), `missing: routes/${name}/index.ts`).toBe(true);
    }
  });

  it("no flat .ts route files remain at routes/ root except index.ts", () => {
    const entries = fs.readdirSync(routesDir, { withFileTypes: true });
    const flatFiles = entries
      .filter(e => e.isFile() && e.name.endsWith(".ts") && e.name !== "index.ts")
      .map(e => e.name);
    expect(flatFiles).toEqual([]);
  });

  it("routes/index.ts exists and imports sovereign/succession route correctly", () => {
    const indexPath = path.join(routesDir, "index.ts");
    expect(fs.existsSync(indexPath)).toBe(true);
    const content = fs.readFileSync(indexPath, "utf8");
    expect(content).toContain('./sovereign/succession');
  });
});
