
interface RateLimitContext {
    count: number;
    lastReset: number;
}

export class RateLimit {
    private ipMap: Map<string, RateLimitContext>;
    private windowSize: number;
    private maxRequests: number;

    constructor(windowMs: number = 60000, maxRequests: number = 20) {
        this.ipMap = new Map();
        this.windowSize = windowMs;
        this.maxRequests = maxRequests;

        // Optional: Periodic cleanup to prevent memory leaks in long-running processes
        setInterval(() => this.cleanup(), 60000 * 5);
    }

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

    private cleanup() {
        const now = Date.now();
        for (const [ip, record] of this.ipMap.entries()) {
            if (now - record.lastReset > this.windowSize) {
                this.ipMap.delete(ip);
            }
        }
    }
}

// Singleton instance for global use
export const rateLimit = new RateLimit(60000, 20); // 20 requests per minute
