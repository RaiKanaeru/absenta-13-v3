/**
 * Export Rate Limit Middleware
 * Prevents abuse of export endpoints which are CPU/memory heavy.
 * Per-user sliding window: max N export requests per time window.
 *
 * Uses Redis sorted sets when available (global across Node.js instances).
 * Falls back to an in-memory Map when Redis is unavailable.
 */

import { sendRateLimitError } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ExportRateLimit');

/**
 * In-memory store for per-user export request tracking (fallback)
 * Key: userId, Value: { timestamps: number[] }
 */
const exportStore = new Map();

/** Cleanup interval reference for graceful shutdown */
let cleanupTimer = null;

/** Default configuration */
const DEFAULT_CONFIG = {
    windowMs: 60 * 1000,           // 1 minute window
    maxRequests: 5,                  // 5 exports per window
    cleanupIntervalMs: 5 * 60 * 1000 // purge stale in-memory entries every 5 min
};

/**
 * Purge expired entries from the in-memory fallback store
 * @param {number} windowMs - Sliding window duration in milliseconds
 */
function purgeExpired(windowMs) {
    const cutoff = Date.now() - windowMs;
    for (const [userId, data] of exportStore) {
        data.timestamps = data.timestamps.filter(t => t > cutoff);
        if (data.timestamps.length === 0) {
            exportStore.delete(userId);
        }
    }
}

/**
 * Rate-limit a single request using Redis sorted sets (sliding window).
 * Key pattern: ratelimit:export:{userId}
 * Scores are Unix timestamps in milliseconds.
 *
 * @param {string|number} userId     - Authenticated user identifier
 * @param {number}        windowMs   - Sliding window in milliseconds
 * @param {number}        maxRequests - Maximum allowed requests per window
 * @returns {Promise<{allowed: boolean, count: number, oldestInWindow: number|null}>}
 */
async function checkRedis(userId, windowMs, maxRequests) {
    const redis = globalThis.cacheSystem.redis;
    const key = `ratelimit:export:${userId}`;
    const now = Date.now();
    const cutoff = now - windowMs;
    const ttlSeconds = Math.ceil(windowMs / 1000) + 1;

    // Atomic pipeline: prune stale entries, count remaining, add current
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, '-inf', cutoff);   // prune expired
    pipeline.zrangebyscore(key, cutoff, '+inf');       // count in window
    pipeline.zadd(key, now, `${now}-${Math.random()}`); // add this request
    pipeline.expire(key, ttlSeconds);                  // auto-cleanup

    const results = await pipeline.exec();
    // results[1] is [err, members[]] for ZRANGEBYSCORE (before the new entry)
    const membersInWindow = results[1][1]; // array of members inside the window
    const countBeforeThis = membersInWindow.length;

    if (countBeforeThis >= maxRequests) {
        // Over limit — we added an entry optimistically; remove it to keep the set clean
        await redis.zremrangebyscore(key, now, now);
        const oldestScore = membersInWindow.length > 0 ? Number(membersInWindow[0].split('-')[0]) : now;
        return { allowed: false, count: countBeforeThis, oldestInWindow: oldestScore };
    }

    return { allowed: true, count: countBeforeThis + 1, oldestInWindow: null };
}

/**
 * Create export rate limit middleware.
 *
 * Checks `globalThis.cacheSystem?.isConnected` on each request to decide
 * whether to use Redis (distributed) or in-memory Map (local fallback).
 *
 * @param {Object} options
 * @param {number} [options.windowMs=60000]   - Sliding window in ms
 * @param {number} [options.maxRequests=5]    - Max requests per window
 * @returns {Function} Express middleware
 */
export function exportRateLimit(options = {}) {
    const config = { ...DEFAULT_CONFIG, ...options };

    // Start periodic in-memory cleanup (only once, for the fallback path)
    if (!cleanupTimer) {
        cleanupTimer = setInterval(() => purgeExpired(config.windowMs), config.cleanupIntervalMs);
        // Allow Node.js to exit even if timer is active
        if (cleanupTimer.unref) cleanupTimer.unref();
    }

    return async (req, res, next) => {
        const userId = req.user?.id;
        if (!userId) {
            // If no user (shouldn't happen – auth middleware runs first), just pass
            return next();
        }

        const now = Date.now();
        const cutoff = now - config.windowMs;

        // ── Redis path ────────────────────────────────────────────────────────
        if (globalThis.cacheSystem?.isConnected) {
            try {
                const { allowed, count, oldestInWindow } = await checkRedis(
                    userId,
                    config.windowMs,
                    config.maxRequests
                );

                if (!allowed) {
                    const retryAfterSec = oldestInWindow !== null
                        ? Math.ceil((oldestInWindow + config.windowMs - now) / 1000)
                        : 1;

                    logger.warn('Export rate limit exceeded (Redis)', {
                        userId,
                        requestCount: count,
                        limit: config.maxRequests,
                        windowMs: config.windowMs,
                        retryAfterSec
                    });

                    return sendRateLimitError(
                        res,
                        `Terlalu banyak permintaan export. Coba lagi dalam ${retryAfterSec} detik.`,
                        retryAfterSec
                    );
                }

                // Set rate-limit headers
                res.setHeader('X-RateLimit-Limit', config.maxRequests);
                res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - count));
                res.setHeader('X-RateLimit-Reset', new Date(cutoff + config.windowMs).toISOString());

                return next();

            } catch (redisErr) {
                // Redis operation failed mid-request — fall through to in-memory
                logger.warn('Redis rate-limit check failed, falling back to in-memory', {
                    userId,
                    error: redisErr.message
                });
            }
        }

        // ── In-memory fallback path ───────────────────────────────────────────
        if (!exportStore.has(userId)) {
            exportStore.set(userId, { timestamps: [] });
        }

        const data = exportStore.get(userId);

        // Drop timestamps outside the window
        data.timestamps = data.timestamps.filter(t => t > cutoff);

        if (data.timestamps.length >= config.maxRequests) {
            const oldestInWindow = Math.min(...data.timestamps);
            const retryAfterSec = Math.ceil((oldestInWindow + config.windowMs - now) / 1000);

            logger.warn('Export rate limit exceeded (in-memory)', {
                userId,
                requestCount: data.timestamps.length,
                limit: config.maxRequests,
                windowMs: config.windowMs,
                retryAfterSec
            });

            return sendRateLimitError(
                res,
                `Terlalu banyak permintaan export. Coba lagi dalam ${retryAfterSec} detik.`,
                retryAfterSec
            );
        }

        // Record this request
        data.timestamps.push(now);

        // Set rate-limit headers
        res.setHeader('X-RateLimit-Limit', config.maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - data.timestamps.length));
        res.setHeader('X-RateLimit-Reset', new Date(cutoff + config.windowMs).toISOString());

        return next();
    };
}

/**
 * Stop the background cleanup timer and clear all rate-limit state.
 * Also removes Redis rate-limit keys if Redis is available.
 * Intended for graceful shutdown / tests.
 */
export async function stopExportRateLimitCleanup() {
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
    }
    exportStore.clear();

    // Best-effort Redis cleanup
    if (globalThis.cacheSystem?.isConnected) {
        try {
            const redis = globalThis.cacheSystem.redis;
            const keys = await redis.keys('ratelimit:export:*');
            if (keys.length > 0) {
                await redis.del(...keys);
                logger.debug('Cleared Redis export rate-limit keys', { count: keys.length });
            }
        } catch (err) {
            logger.warn('Failed to clear Redis rate-limit keys during cleanup', { error: err.message });
        }
    }
}

export default exportRateLimit;
