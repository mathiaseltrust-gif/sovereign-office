import { describe, expect, it } from "vitest";
import { canAccessObject, ObjectPermission } from "../lib/objectAcl";
import { canReadOwnedPrivateObject } from "../security/private-object-policy";

function fakeFile(policy?: { owner: string; visibility: "public" | "private"; readers?: string[] }) {
  return {
    getMetadata: async () => [{
      metadata: policy
        ? { "custom:aclPolicy": JSON.stringify(policy) }
        : {},
    }],
  } as any;
}

describe("private object boundaries", () => {
  it("defaults to deny when object ACL metadata is absent", async () => {
    await expect(canAccessObject({
      userId: "1",
      objectFile: fakeFile(),
      requestedPermission: ObjectPermission.READ,
    })).resolves.toBe(false);
  });

  it("allows a private object only to its ACL owner", async () => {
    const objectFile = fakeFile({ owner: "7", visibility: "private" });
    await expect(canAccessObject({
      userId: "7",
      objectFile,
      requestedPermission: ObjectPermission.READ,
    })).resolves.toBe(true);
    await expect(canAccessObject({
      userId: "8",
      objectFile,
      requestedPermission: ObjectPermission.READ,
    })).resolves.toBe(false);
  });

  it("allows explicitly listed institutional readers without granting write authority", async () => {
    const objectFile = fakeFile({
      owner: "org:trust_a",
      visibility: "private",
      readers: ["org:board_of_trustees"],
    } as any);
    await expect(canAccessObject({
      principalIds: ["org:board_of_trustees"],
      objectFile,
      requestedPermission: ObjectPermission.READ,
    })).resolves.toBe(true);
    await expect(canAccessObject({
      principalIds: ["org:board_of_trustees"],
      objectFile,
      requestedPermission: ObjectPermission.WRITE,
    })).resolves.toBe(false);
    await expect(canAccessObject({
      principalIds: ["org:unrelated"],
      objectFile,
      requestedPermission: ObjectPermission.READ,
    })).resolves.toBe(false);
  });

  it("allows public read but never public write merely because visibility is public", async () => {
    const objectFile = fakeFile({ owner: "7", visibility: "public" });
    await expect(canAccessObject({
      objectFile,
      requestedPermission: ObjectPermission.READ,
    })).resolves.toBe(true);
    await expect(canAccessObject({
      objectFile,
      requestedPermission: ObjectPermission.WRITE,
    })).resolves.toBe(false);
  });

  it("does not accept Office role as a substitute for record ownership", () => {
    expect(canReadOwnedPrivateObject({ requestingUserId: 11, ownerUserId: 11 })).toBe(true);
    expect(canReadOwnedPrivateObject({ requestingUserId: 12, ownerUserId: 11 })).toBe(false);
    expect(canReadOwnedPrivateObject({ requestingUserId: undefined, ownerUserId: 11 })).toBe(false);
  });
});
