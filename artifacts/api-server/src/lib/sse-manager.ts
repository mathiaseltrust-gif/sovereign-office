import type { Response } from "express";
import Redis from "ioredis";
import { logger } from "./logger";

interface SseClient {
  userId: number;
  res: Response;
}

const clients = new Map<number, Set<SseClient>>();

export function registerSseClient(userId: number, res: Response): () => void {
  const client: SseClient = { userId, res };
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId)!.add(client);
  logger.debug({ userId }, "SSE client registered");

  return () => {
    clients.get(userId)?.delete(client);
    if (clients.get(userId)?.size === 0) clients.delete(userId);
    logger.debug({ userId }, "SSE client removed");
  };
}

export function pushToUser(userId: number, event: string, data: object): void {
  const userClients = clients.get(userId);
  if (!userClients) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of userClients) {
    try {
      client.res.write(payload);
    } catch { /* client disconnected */ }
  }
}

let _subRedis: Redis | null = null;

export function startRedisSubscriber(): void {
  const url = process.env.REDIS_CONNECTION_STRING;
  if (!url) return;

  try {
    _subRedis = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 3000,
      commandTimeout: 2000,
      maxRetriesPerRequest: 1,
      tls: url.startsWith("rediss://") ? {} : undefined,
    });

    _subRedis.on("error", (err) => {
      logger.warn({ err }, "Redis subscriber error");
    });

    _subRedis.psubscribe("msg:*", (err) => {
      if (err) logger.warn({ err }, "Redis psubscribe failed");
      else logger.info("Redis message subscriber active");
    });

    _subRedis.on("pmessage", (_pattern: string, channel: string, message: string) => {
      const match = channel.match(/^msg:(\d+)$/);
      if (!match) return;
      const recipientId = parseInt(match[1], 10);
      try {
        const event = JSON.parse(message) as { type: string; [key: string]: unknown };
        pushToUser(recipientId, event.type ?? "message", event);
        // Also fan-out to WebSocket clients on this server
        void import("./ws-manager").then(({ pushWsEvent }) => pushWsEvent(recipientId, event));
      } catch { /* bad JSON */ }
    });
  } catch (err) {
    logger.warn({ err }, "Redis subscriber init failed");
  }
}
