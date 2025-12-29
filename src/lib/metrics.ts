"use server";

import crypto from "crypto";
import { Redis } from "@upstash/redis";

const COST_SCALE = 100;
const REDIS_PREFIX = process.env.KV_METRICS_PREFIX ?? "h1b-metrics";
const KEYS = {
  aggregate: `${REDIS_PREFIX}:aggregate`,
  uniqueVisitors: `${REDIS_PREFIX}:unique`,
  visitor: (id: string) => `${REDIS_PREFIX}:visitor:${id}`,
};

type TokenUsage = {
  prompt: number;
  completion: number;
  total: number;
  costUSD: number;
};

type VisitorStats = {
  visits: number;
  chatMessages: number;
  tokens: TokenUsage;
};

const missingKvWarnings = new Set<string>();
let redisClient: Redis | null | undefined;

function createEmptyTokenUsage(): TokenUsage {
  return { prompt: 0, completion: 0, total: 0, costUSD: 0 };
}

function warnMissingKv(origin: string) {
  if (missingKvWarnings.has(origin)) return;
  console.warn(
    `[metrics] ${origin} skipped: KV_REST_API_URL / KV_REST_API_TOKEN not configured.`
  );
  missingKvWarnings.add(origin);
}

function resolveRedis() {
  if (redisClient !== undefined) return redisClient;

  try {
    redisClient = Redis.fromEnv();
  } catch {
    redisClient = null;
  }
  return redisClient;
}

function getRedis(origin: string) {
  const redis = resolveRedis();
  if (!redis) {
    warnMissingKv(origin);
    return null;
  }
  return redis;
}

function parseNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function parseRedisHash(raw: unknown): Record<string, string> {
  if (Array.isArray(raw)) {
    const obj: Record<string, string> = {};
    for (let i = 0; i < raw.length; i += 2) {
      const key = raw[i];
      const value = raw[i + 1];
      if (typeof key === "string" && typeof value === "string") {
        obj[key] = value;
      }
    }
    return obj;
  }

  if (raw && typeof raw === "object") {
    return raw as Record<string, string>;
  }

  return {};
}

function tokensFromHash(hash: Record<string, string>): TokenUsage {
  return {
    prompt: parseNumber(hash.promptTokens ?? hash.prompt),
    completion: parseNumber(hash.completionTokens ?? hash.completion),
    total: parseNumber(hash.totalTokens ?? hash.total),
    costUSD: parseNumber(hash.costCents ?? hash.costUSD) / COST_SCALE,
  };
}

async function incrementHashField(
  origin: string,
  key: string,
  field: string,
  amount: number
) {
  const redis = getRedis(origin);
  if (!redis) return;
  const safeAmount = Math.round(amount);
  if (!safeAmount) return;
  await redis.hincrby(key, field, safeAmount);
}

async function incrementTokenUsage(
  origin: string,
  key: string,
  usage?: TokenUsage
) {
  const redis = getRedis(origin);
  if (!redis || !usage) return;

  if (!usage) return;

  const tasks: Array<Promise<unknown>> = [];
  if (usage.prompt) {
    tasks.push(redis.hincrby(key, "promptTokens", Math.round(usage.prompt)));
  }
  if (usage.completion) {
    tasks.push(
      redis.hincrby(key, "completionTokens", Math.round(usage.completion))
    );
  }
  if (usage.total) {
    tasks.push(redis.hincrby(key, "totalTokens", Math.round(usage.total)));
  }
  if (usage.costUSD) {
    tasks.push(
      redis.hincrby(key, "costCents", Math.round(usage.costUSD * COST_SCALE))
    );
  }

  await Promise.all(tasks);
}

function hashVisitorId(visitorId?: string | null) {
  if (!visitorId) return null;
  return crypto.createHash("sha256").update(visitorId).digest("hex");
}

export async function recordVisit(visitorId?: string) {
  await incrementHashField("recordVisit", KEYS.aggregate, "totalVisits", 1);

  const hashed = hashVisitorId(visitorId);
  if (!hashed) return;

  const redis = getRedis("recordVisit");
  if (!redis) return;

  await Promise.all([
    redis.sadd(KEYS.uniqueVisitors, hashed),
    incrementHashField("recordVisit", KEYS.visitor(hashed), "visits", 1),
  ]);
}

export async function recordChatMessages(
  count: number,
  visitorId?: string,
  usage?: TokenUsage
) {
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
  await incrementHashField(
    "recordChatMessages",
    KEYS.aggregate,
    "chatMessages",
    safeCount
  );
  await incrementTokenUsage("recordChatMessages", KEYS.aggregate, usage);

  const hashed = hashVisitorId(visitorId);
  if (!hashed) return;

  const redis = getRedis("recordChatMessages");
  if (!redis) return;

  await Promise.all([
    redis.sadd(KEYS.uniqueVisitors, hashed),
    incrementHashField(
      "recordChatMessages",
      KEYS.visitor(hashed),
      "chatMessages",
      safeCount
    ),
    incrementTokenUsage("recordChatMessages", KEYS.visitor(hashed), usage),
  ]);
}

async function readVisitorStats(id: string): Promise<VisitorStats> {
  const redis = getRedis("getVisitor");
  if (!redis) {
    return {
      visits: 0,
      chatMessages: 0,
      tokens: createEmptyTokenUsage(),
    };
  }
  const hashRaw = (await redis.hgetall(KEYS.visitor(id))) ?? {};
  const hash = parseRedisHash(hashRaw);
  return {
    visits: parseNumber(hash.visits),
    chatMessages: parseNumber(hash.chatMessages),
    tokens: tokensFromHash(hash),
  };
}

export async function getMetricsSummary() {
  const redis = resolveRedis();
  if (!redis) {
    warnMissingKv("getMetricsSummary");
    return {
      totalVisits: 0,
      uniqueVisitors: 0,
      chatMessages: 0,
      chatTokens: createEmptyTokenUsage(),
      visitors: [] as Array<{ id: string } & VisitorStats>,
    };
  }

  const aggregateRaw = await redis.hgetall(KEYS.aggregate);
  const aggregate = parseRedisHash(aggregateRaw);

  const uniqueIds =
    ((await redis.smembers(KEYS.uniqueVisitors)) ?? []) as string[];

  const visitors = await Promise.all(
    uniqueIds.map(async (id) => ({
      id,
      ...(await readVisitorStats(id)),
    }))
  );

  return {
    totalVisits: parseNumber(aggregate.totalVisits),
    uniqueVisitors: uniqueIds.length,
    chatMessages: parseNumber(aggregate.chatMessages),
    chatTokens: tokensFromHash(aggregate),
    visitors,
  };
}
