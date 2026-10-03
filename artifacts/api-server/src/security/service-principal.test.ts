import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasServiceCapability,
  requireServiceCapabilityOrAuth,
  serviceKeyMiddleware,
} from "../auth/service-key";

function mockResponse() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  return res;
}

describe("machine service principal boundary", () => {
  const original = process.env.M365_SERVICE_KEY;

  afterEach(() => {
    if (original === undefined) delete process.env.M365_SERVICE_KEY;
    else process.env.M365_SERVICE_KEY = original;
  });

  it("authenticates the M365 credential as a service principal, never as an Office user", () => {
    process.env.M365_SERVICE_KEY = "x";
    const req: any = {
      headers: { "x-api-key": "x" },
      path: "/api/m365/webhook",
      ip: "127.0.0.1",
    };
    const next = vi.fn();

    serviceKeyMiddleware(req, mockResponse(), next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.isServiceAccount).toBe(true);
    expect(req.servicePrincipal?.kind).toBe("service");
    expect(req.servicePrincipal?.capabilities).toContain("m365:intake:submit");
    expect(req.user).toBeUndefined();
  });

  it("does not authenticate an invalid service credential", () => {
    process.env.M365_SERVICE_KEY = "x";
    const req: any = {
      headers: { "x-api-key": "y" },
      path: "/api/m365/webhook",
      ip: "127.0.0.1",
    };

    serviceKeyMiddleware(req, mockResponse(), vi.fn());

    expect(req.servicePrincipal).toBeUndefined();
    expect(req.user).toBeUndefined();
  });

  it("enforces exact service capabilities", () => {
    const req: any = {
      servicePrincipal: {
        id: "m365-service",
        kind: "service",
        capabilities: ["m365:intake:submit"],
      },
    };
    expect(hasServiceCapability(req, "m365:intake:submit")).toBe(true);
    expect(hasServiceCapability(req, "m365:facts:extract")).toBe(false);

    const allowedNext = vi.fn();
    requireServiceCapabilityOrAuth("m365:intake:submit")(req, mockResponse(), allowedNext);
    expect(allowedNext).toHaveBeenCalledOnce();

    const deniedRes = mockResponse();
    const deniedNext = vi.fn();
    requireServiceCapabilityOrAuth("m365:facts:extract")(req, deniedRes, deniedNext);
    expect(deniedNext).not.toHaveBeenCalled();
    expect(deniedRes.statusCode).toBe(401);
  });

  it("does not let an M365 principal cross into the GitHub intake capability", () => {
    const req: any = {
      servicePrincipal: {
        id: "m365-service",
        kind: "service",
        capabilities: ["m365:intake:submit", "m365:facts:extract"],
      },
    };
    const res = mockResponse();
    const next = vi.fn();
    requireServiceCapabilityOrAuth("github:intake:preview")(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("does not treat a raw Bearer header as an authenticated human session", () => {
    const req: any = {
      headers: { authorization: "Bearer not-a-verified-session" },
    };
    const res = mockResponse();
    const next = vi.fn();
    requireServiceCapabilityOrAuth("github:intake:preview")(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("allows an authenticated human without converting them into a service principal", () => {
    const req: any = {
      user: { id: "human", email: "human@example.test", roles: ["member"] },
    };
    const next = vi.fn();
    requireServiceCapabilityOrAuth("m365:intake:submit")(req, mockResponse(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.servicePrincipal).toBeUndefined();
  });
});
