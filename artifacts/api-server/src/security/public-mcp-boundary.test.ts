import { describe, expect, it } from "vitest";
import {
  PUBLIC_MCP_PROFILE,
  PUBLIC_MCP_RESOURCES,
  PUBLIC_MCP_TOOLS,
} from "../mcp/public-capabilities";

describe("public MCP least-privilege boundary", () => {
  it("exposes only explicitly public tool names", () => {
    expect(PUBLIC_MCP_TOOLS.length).toBeGreaterThan(0);
    for (const tool of PUBLIC_MCP_TOOLS) {
      expect(tool.name.startsWith("public.")).toBe(true);
    }
  });

  it("does not expose internal records or action tools", () => {
    const names = PUBLIC_MCP_TOOLS.map((tool) => tool.name);
    for (const forbidden of [
      "office.search",
      "case.get",
      "member.get",
      "medical.get",
      "trust.issue_directive",
      "document.send",
      "record.delete",
    ]) {
      expect(names).not.toContain(forbidden);
    }
  });

  it("keeps sensitive capabilities explicitly denied", () => {
    expect(PUBLIC_MCP_PROFILE.deniedCapabilities).toEqual(expect.arrayContaining([
      "read_internal_case_files",
      "read_member_records",
      "read_private_lineage",
      "read_medical_records",
      "read_trust_assets",
      "send_external_communications",
      "alter_permanent_records",
      "initiate_financial_transactions",
    ]));
  });

  it("publishes only public resource URIs", () => {
    for (const resource of PUBLIC_MCP_RESOURCES) {
      expect(resource.uri.startsWith("sovereign-office://public/")).toBe(true);
    }
  });
});
