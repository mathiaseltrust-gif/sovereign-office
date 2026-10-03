import { File } from "@google-cloud/storage";

const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
  readers?: string[];
}

export async function setObjectAclPolicy(
  objectFile: File,
  aclPolicy: ObjectAclPolicy,
): Promise<void> {
  const [exists] = await objectFile.exists();
  if (!exists) {
    throw new Error(`Object not found: ${objectFile.name}`);
  }
  await objectFile.setMetadata({
    metadata: {
      [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy),
    },
  });
}

export async function getObjectAclPolicy(
  objectFile: File,
): Promise<ObjectAclPolicy | null> {
  const [metadata] = await objectFile.getMetadata();
  const raw = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw as string) as Partial<ObjectAclPolicy>;
    if (
      typeof parsed.owner !== "string" ||
      (parsed.visibility !== "public" && parsed.visibility !== "private") ||
      (parsed.readers !== undefined && (
        !Array.isArray(parsed.readers) ||
        parsed.readers.some((principal) => typeof principal !== "string")
      ))
    ) {
      return null;
    }
    return {
      owner: parsed.owner,
      visibility: parsed.visibility,
      readers: parsed.readers ?? [],
    };
  } catch {
    // Malformed ACL metadata is never treated as permissive.
    return null;
  }
}

export async function canAccessObject({
  userId,
  principalIds,
  objectFile,
  requestedPermission,
}: {
  userId?: string;
  principalIds?: string[];
  objectFile: File;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  const aclPolicy = await getObjectAclPolicy(objectFile);
  if (!aclPolicy) return false;
  if (aclPolicy.visibility === "public" && requestedPermission === ObjectPermission.READ) {
    return true;
  }
  const principals = new Set([
    ...(userId ? [userId] : []),
    ...(principalIds ?? []),
  ]);
  if (principals.size === 0) return false;

  if (principals.has(aclPolicy.owner)) return true;
  if (requestedPermission === ObjectPermission.READ) {
    return (aclPolicy.readers ?? []).some((principal) => principals.has(principal));
  }
  return false;
}
