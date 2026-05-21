import { describe, it, expect } from "vitest";

describe("engines directory", () => {
  it("engines/ module path resolves without filesystem error", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const enginesDir = path.resolve(
      new URL(".", import.meta.url).pathname,
      "../src/engines"
    );
    expect(fs.existsSync(enginesDir)).toBe(true);
  });

  it("engines/ contains expected core files", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const enginesDir = path.resolve(
      new URL(".", import.meta.url).pathname,
      "../src/engines"
    );
    const files = fs.readdirSync(enginesDir);
    expect(files).toContain("rights-engine.ts");
    expect(files).toContain("alignment-checker.ts");
    expect(files).toContain("intelligence-accumulator.ts");
    expect(files).toContain("law-db.ts");
    expect(files).toContain("template-engine.ts");
  });

  it("legacy templates file exists in engines/templates/", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const legacyPath = path.resolve(
      new URL(".", import.meta.url).pathname,
      "../src/engines/templates/legacy-templates.ts"
    );
    expect(fs.existsSync(legacyPath)).toBe(true);
  });
});
