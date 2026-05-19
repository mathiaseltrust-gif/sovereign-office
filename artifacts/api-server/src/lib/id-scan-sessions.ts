/**
 * Server-side ID scan session registry.
 * After images are uploaded and extracted, the server stores image object paths
 * keyed by a session ID. The client sends the session ID during confirm — the server
 * retrieves the trusted paths, preventing clients from supplying arbitrary URLs.
 *
 * For admin sessions, both `ownerUserId` (officer) and `targetUserId` (member) are
 * stored. Claiming an admin session requires both to match, preventing an officer
 * from reusing a session to write ID data to a different member record.
 *
 * Sessions expire after SESSION_TTL_MS (2 hours).
 */

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export interface IdScanSession {
  ownerUserId: number;
  targetUserId: number | null;
  frontObjectPath: string | null;
  backObjectPath: string | null;
  expiresAt: number;
}

const sessions = new Map<string, IdScanSession>();

export function createIdScanSession(
  sessionId: string,
  ownerUserId: number,
  frontObjectPath: string | null,
  backObjectPath: string | null,
  targetUserId?: number,
): void {
  sessions.set(sessionId, {
    ownerUserId,
    targetUserId: targetUserId ?? null,
    frontObjectPath,
    backObjectPath,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
}

/**
 * Claim a session.
 * @param sessionId     UUID returned during extraction
 * @param ownerUserId   The user who created the session (user for self-service, officer for admin flow)
 * @param targetUserId  Required for admin sessions — must match the member the session was created for
 */
export function claimIdScanSession(
  sessionId: string,
  ownerUserId: number,
  targetUserId?: number,
): IdScanSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  if (session.ownerUserId !== ownerUserId) return null;
  if (session.targetUserId !== null) {
    if (targetUserId === undefined || session.targetUserId !== targetUserId) return null;
  }
  sessions.delete(sessionId);
  return session;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions.entries()) {
    if (now > session.expiresAt) sessions.delete(key);
  }
}, 30 * 60 * 1000).unref();
