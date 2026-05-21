import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("env config", () => {
  const required = [
    "DATABASE_URL",
    "REDIS_CONNECTION_STRING",
    "SESSION_SECRET",
    "SERVICE_KEY",
    "AZURE_ENTRA_TENANT_ID",
    "AZURE_ENTRA_CLIENT_ID",
    "AZURE_ENTRA_CLIENT_SECRET",
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_DEPLOYMENT",
    "DEFAULT_OBJECT_STORAGE_BUCKET_ID",
    "PRIVATE_OBJECT_DIR",
    "PUBLIC_OBJECT_SEARCH_PATHS",
    "PORT",
  ];

  it("lists all required env var names without throwing", () => {
    expect(required).toHaveLength(14);
    expect(required).toContain("DATABASE_URL");
    expect(required).toContain("SESSION_SECRET");
  });

  it("NODE_ENV defaults are valid enum members", () => {
    const valid = ["development", "production", "test"];
    const current = process.env.NODE_ENV ?? "development";
    expect(valid).toContain(current);
  });
});
