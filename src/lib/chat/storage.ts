"use server";

import { Redis } from "@upstash/redis";
import type { UIMessage } from "ai";

const REDIS_PREFIX = process.env.KV_CHAT_PREFIX ?? "h1b-chat";

// Reuse Redis client from metrics.ts
let redisClient: Redis | null | undefined;

function resolveRedis() {
    if (redisClient !== undefined) return redisClient;

    try {
        redisClient = Redis.fromEnv();
    } catch {
        redisClient = null;
    }
    return redisClient;
}

function getChatKey(visitorId: string): string {
    return `${REDIS_PREFIX}:${visitorId}`;
}

/**
 * Save chat messages to Redis
 * @param visitorId - Unique visitor identifier
 * @param messages - Full message array (Source of Truth from frontend)
 */
export async function saveChat(
    visitorId: string,
    messages: UIMessage[]
): Promise<void> {
    const redis = resolveRedis();
    if (!redis) {
        console.warn("[chat/storage] Redis not configured, skipping save");
        return;
    }

    const key = getChatKey(visitorId);

    // If messages is empty, delete the key (clear chat)
    if (!messages || messages.length === 0) {
        await redis.del(key);
        return;
    }

    // Upstash Redis client automatically serializes objects
    await redis.set(key, messages, { ex: 60 * 60 * 24 * 30 });
}

/**
 * Get chat messages from Redis
 * @param visitorId - Unique visitor identifier
 * @returns Array of messages or empty array if not found
 */
export async function getChat(visitorId: string): Promise<UIMessage[]> {
    const redis = resolveRedis();
    if (!redis) {
        console.warn("[chat/storage] Redis not configured, returning empty history");
        return [];
    }

    const key = getChatKey(visitorId);
    const data = await redis.get<UIMessage[]>(key);

    if (!data) return [];

    if (Array.isArray(data)) {
        return data;
    }

    return [];
}
