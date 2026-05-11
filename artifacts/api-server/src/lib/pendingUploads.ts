/**
 * Server-side registry of presigned upload URLs issued to authenticated users.
 * Prevents clients from registering arbitrary file keys they did not actually upload.
 *
 * Entries expire after UPLOAD_TTL_MS (1 hour). A key may only be claimed once —
 * claiming removes it from the registry, so re-use or replay is not possible.
 */

const UPLOAD_TTL_MS = 60 * 60 * 1000;

interface PendingUpload {
  userId: string;
  expiresAt: number;
}

const registry = new Map<string, PendingUpload>();

export function registerUpload(objectPath: string, userId: string): void {
  registry.set(objectPath, { userId, expiresAt: Date.now() + UPLOAD_TTL_MS });
}

/**
 * Returns true and removes the entry if the objectPath was issued to this user
 * and has not expired. Returns false otherwise.
 */
export function claimUpload(objectPath: string, userId: string): boolean {
  const entry = registry.get(objectPath);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    registry.delete(objectPath);
    return false;
  }
  if (entry.userId !== userId) return false;
  registry.delete(objectPath);
  return true;
}

// Purge expired entries every 30 minutes to prevent unbounded growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of registry.entries()) {
    if (now > entry.expiresAt) registry.delete(key);
  }
}, 30 * 60 * 1000).unref();
