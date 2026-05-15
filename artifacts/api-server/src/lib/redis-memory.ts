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

// ── Long-term Profile Memory (1-year TTL — grows with every session) ───────────

export interface ProfileMemory {
  userId: number;
  name?: string;
  role?: string;
  facts: string[];            // key life facts from intake sessions (last 10)
  intakeCount: number;        // total intake analyses completed
  documentCount: number;      // total documents uploaded and recalled
  awakeningLevel: number;     // 1–10, grows with each meaningful engagement
  lastSeenAt?: string;        // ISO timestamp of last activity
  lastGreetedAt?: string;     // ISO timestamp of last Elder greeting
  recentTopics: string[];     // recent case summaries (last 5, ≤80 chars each)
  riskHistory: string[];      // risk levels from last 10 intakes
  featureUsage: Record<string, number>; // feature → click count, drives adaptive suggestions
}

const PROFILE_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year

function profileKey(userId: number): string {
  return `memory:profile:${userId}`;
}

export async function getProfileMemory(userId: number): Promise<ProfileMemory | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(profileKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as ProfileMemory;
  } catch {
    return null;
  }
}

export async function saveProfileMemory(userId: number, memory: ProfileMemory): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(profileKey(userId), JSON.stringify(memory), "EX", PROFILE_TTL_SECONDS);
  } catch (err) {
    logger.warn({ err, userId }, "Failed to save profile memory to Redis");
  }
}

export async function appendIntakeFact(
  userId: number,
  opts: {
    riskLevel: string;
    summary: string;
    docType?: string;
    name?: string;
    role?: string;
  },
): Promise<ProfileMemory> {
  const existing = await getProfileMemory(userId);
  const now = new Date().toISOString();
  const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const fact = `[${dateStr}] ${opts.riskLevel.toUpperCase()}: ${opts.summary.substring(0, 120)}`;

  const awakeningBoost = ["critical", "emergency"].includes(opts.riskLevel) ? 2 : 1;

  const updated: ProfileMemory = {
    userId,
    name: opts.name ?? existing?.name,
    role: opts.role ?? existing?.role,
    facts: [fact, ...(existing?.facts ?? [])].slice(0, 10),
    intakeCount: (existing?.intakeCount ?? 0) + 1,
    documentCount: (existing?.documentCount ?? 0) + (opts.docType ? 1 : 0),
    awakeningLevel: Math.min(10, (existing?.awakeningLevel ?? 1) + awakeningBoost),
    lastSeenAt: now,
    lastGreetedAt: existing?.lastGreetedAt,
    recentTopics: [opts.summary.substring(0, 80), ...(existing?.recentTopics ?? [])].slice(0, 5),
    riskHistory: [opts.riskLevel, ...(existing?.riskHistory ?? [])].slice(0, 10),
    featureUsage: existing?.featureUsage ?? {},
  };

  await saveProfileMemory(userId, updated);
  return updated;
}
