import { Redis } from '@upstash/redis';

interface RateLimitContext {
    count: number;
    lastReset: number;
}

interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
}

// Redis client singleton
let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
    if (redisClient !== undefined) return redisClient;

    try {
        redisClient = Redis.fromEnv();
        console.log('[RateLimit] Redis connected successfully');
    } catch (error) {
        redisClient = null;
        console.warn('[RateLimit] Redis not configured, using in-memory fallback');
    }

    return redisClient;
}

export class RateLimit {
    private ipMap: Map<string, RateLimitContext>;
    private windowSize: number;
    private maxRequests: number;
    private redis: Redis | null;

    constructor(windowMs: number = 60000, maxRequests: number = 20) {
        this.ipMap = new Map();
        this.windowSize = windowMs;
        this.maxRequests = maxRequests;
        this.redis = getRedis();
    }

    /**
     * Check if request is allowed (synchronous for backwards compatibility)
     * Note: When Redis is available, this uses memory fallback.
     * Use checkAsync() for Redis-backed rate limiting.
     */
    check(ip: string): boolean {
        const now = Date.now();
        const record = this.ipMap.get(ip);

        if (!record) {
            this.ipMap.set(ip, { count: 1, lastReset: now });
            return true;
        }

        if (now - record.lastReset > this.windowSize) {
            record.count = 1;
            record.lastReset = now;
            return true;
        }

        if (record.count < this.maxRequests) {
            record.count++;
            return true;
        }

        return false;
    }

    /**
     * Async rate limit check using Redis (recommended for production)
     * Falls back to memory if Redis is not available
     */
    async checkAsync(ip: string): Promise<RateLimitResult> {
        const limit = this.maxRequests;
        const now = Date.now();

        // Try Redis first (production)
        if (this.redis) {
            try {
                const key = `ratelimit:${ip}`;
                const windowSeconds = Math.ceil(this.windowSize / 1000);

                // Use Redis Sorted Set for sliding window
                const pipeline = this.redis.pipeline();

                // Remove expired entries
                pipeline.zremrangebyscore(key, 0, now - this.windowSize);

                // Count current requests in window
                pipeline.zcard(key);

                // Add current request
                pipeline.zadd(key, {
                    score: now,
                    member: `${now}-${Math.random().toString(36).substring(7)}`
                });

                // Set expiration (2x window to be safe)
                pipeline.expire(key, windowSeconds * 2);

                const results = await pipeline.exec() as [unknown, number, unknown, unknown];
                const currentCount = results[1]; // zcard result

                const success = currentCount < limit;
                const remaining = Math.max(0, limit - currentCount - 1);
                const reset = now + this.windowSize;

                return { success, limit, remaining, reset };
            } catch (error) {
                console.error('[RateLimit] Redis error, falling back to memory:', error);
                // Fall through to memory mode
            }
        }

        // Fallback to in-memory (development or Redis failure)
        const record = this.ipMap.get(ip);

        if (!record || now > record.lastReset + this.windowSize) {
            this.ipMap.set(ip, { count: 1, lastReset: now });
            return {
                success: true,
                limit,
                remaining: limit - 1,
                reset: now + this.windowSize
            };
        }

        const success = record.count < limit;
        if (success) {
            record.count++;
        }

        return {
            success,
            limit,
            remaining: Math.max(0, limit - record.count),
            reset: record.lastReset + this.windowSize
        };
    }
}

// Singleton instance for global use
export const rateLimit = new RateLimit(60000, 20); // 20 requests per minute
