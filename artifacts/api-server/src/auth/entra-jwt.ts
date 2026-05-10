import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { logger } from "../lib/logger";

let _jwksClient: jwksClient.JwksClient | null = null;

function getJwksClient(): jwksClient.JwksClient | null {
  const tenantId = process.env.AZURE_ENTRA_TENANT_ID;
  if (!tenantId) return null;

  if (!_jwksClient) {
    _jwksClient = jwksClient({
      jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
      cache: true,
      cacheMaxEntries: 10,
      cacheMaxAge: 600000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
    logger.info({ tenantId }, "Entra JWKS client initialized");
  }

  return _jwksClient;
}

export interface EntraJwtPayload {
  oid: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  roles?: string[];
  tid: string;
  appid?: string;
}

function getSigningKey(client: jwksClient.JwksClient, kid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err || !key) return reject(err ?? new Error("No key found"));
      resolve(key.getPublicKey());
    });
  });
}

export async function verifyEntraJwt(token: string): Promise<EntraJwtPayload | null> {
  const tenantId = process.env.AZURE_ENTRA_TENANT_ID;
  const clientId = process.env.AZURE_ENTRA_CLIENT_ID;

  if (!tenantId || !clientId) {
    logger.debug("Entra JWT verification skipped — AZURE_ENTRA_TENANT_ID or AZURE_ENTRA_CLIENT_ID not set");
    return null;
  }

  const client = getJwksClient();
  if (!client) return null;

  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === "string" || !decoded.header?.kid) {
      return null;
    }

    const signingKey = await getSigningKey(client, decoded.header.kid);

    const payload = jwt.verify(token, signingKey, {
      algorithms: ["RS256"],
      audience: clientId,
      issuer: [
        `https://login.microsoftonline.com/${tenantId}/v2.0`,
        `https://sts.windows.net/${tenantId}/`,
      ],
    }) as EntraJwtPayload;

    logger.debug({ oid: payload.oid, name: payload.name }, "Entra JWT verified successfully");
    return payload;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Entra JWT verification failed");
    return null;
  }
}

export function isRealJwt(token: string): boolean {
  return token.split(".").length === 3;
}
