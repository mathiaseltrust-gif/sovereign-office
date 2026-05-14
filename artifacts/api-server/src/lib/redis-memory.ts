import Redis from "ioredis";
import { logger } from "./logger";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const MAX_MESSAGES = 20;
const TTL_SECONDS = 4 * 60 * 60;

let _redis: Redis | null = null;
let _initFailed = false;

function getRedis(): Redis | null {
  if (_initFailed) return null;
  if (_redis) return _redis;

  const url = process.env.REDIS_CONNECTION_STRING;
  if (!url) return null;

  try {
    _redis = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 3000,
      commandTimeout: 2000,
      maxRetriesPerRequest: 1,
      tls: url.startsWith("rediss://") ? {} : undefined,
    });

    _redis.on("error", (err) => {
      logger.warn({ err }, "Redis connection error — chat memory disabled");
    });

    _redis.on("connect", () => {
      logger.info("Redis connected — chat memory active");
    });

    return _redis;
  } catch (err) {
    logger.warn({ err }, "Redis init failed — chat memory disabled");
    _initFailed = true;
    return null;
  }
}

function historyKey(userId: number): string {
  return `chat:history:${userId}`;
}

export async function getHistory(userId: number): Promise<ChatMessage[]> {
  const redis = getRedis();
  if (!redis) return [];
  try {
    const raw = await redis.lrange(historyKey(userId), 0, MAX_MESSAGES - 1);
    return raw.map((r) => JSON.parse(r) as ChatMessage);
  } catch (err) {
    logger.warn({ err, userId }, "Failed to read chat history from Redis");
    return [];
  }
}

export async function appendMessages(
  userId: number,
  messages: ChatMessage[],
): Promise<void> {
  const redis = getRedis();
  if (!redis || messages.length === 0) return;
  try {
    const key = historyKey(userId);
    const serialized = messages.map((m) => JSON.stringify(m));
    await redis.rpush(key, ...serialized);
    await redis.ltrim(key, -MAX_MESSAGES, -1);
    await redis.expire(key, TTL_SECONDS);
  } catch (err) {
    logger.warn({ err, userId }, "Failed to append chat history to Redis");
  }
}

export async function clearHistory(userId: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(historyKey(userId));
  } catch { /* ok */ }
}

export async function isRedisAvailable(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}
