import { describe, expect, it, vi } from "vitest";
import { requireIdentityAdmin } from "../auth/entra-guard";

function mockResponse() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  return res;
}

describe("identity administration boundary", () => {
  it("does not let a trustee role alone mutate identity authority", () => {
    const req: any = {
      user: { id: "trustee", email: "trustee@example.test", roles: ["trustee"], dbId: 10 },
    };
    const res = mockResponse();
    const next = vi.fn();

    requireIdentityAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("allows explicit chief/system authority", () => {
    for (const role of ["admin", "sovereign_admin", "chief_justice", "chief_justice_trustee"]) {
      const req: any = {
        user: { id: role, email: "authorized@example.test", roles: [role], dbId: 1 },
      };
      const res = mockResponse();
      const next = vi.fn();

      requireIdentityAdmin(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.statusCode).toBe(200);
    }
  });

  it("denies an unauthenticated principal", () => {
    const res = mockResponse();
    const next = vi.fn();
    requireIdentityAdmin({} as any, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});
