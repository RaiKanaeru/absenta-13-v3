/**
 * Export Rate Limit Middleware
 * Prevents abuse of export endpoints which are CPU/memory heavy.
 * Per-user sliding window: max N export requests per time window.
 */

import { sendRateLimitError } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ExportRateLimit');

/**
 * In-memory store for per-user export request tracking
 * Key: userId, Value: { timestamps: number[] }
 */
const exportStore = new Map();

/** Cleanup interval reference for graceful shutdown */
let cleanupTimer = null;

/** Default configuration */
const DEFAULT_CONFIG = {
    windowMs: 60 * 1000,  // 1 minute window
    maxRequests: 5,        // 5 exports per window
    cleanupIntervalMs: 5 * 60 * 1000 // purge stale entries every 5 min
};

/**
 * Purge expired entries from the store
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
 * Create export rate limit middleware
 * @param {Object} options
 * @param {number} options.windowMs   - Sliding window in ms (default 60000)
 * @param {number} options.maxRequests - Max requests per window (default 5)
 * @returns {Function} Express middleware
 */
export function exportRateLimit(options = {}) {
    const config = { ...DEFAULT_CONFIG, ...options };

    // Start periodic cleanup (only once)
    if (!cleanupTimer) {
        cleanupTimer = setInterval(() => purgeExpired(config.windowMs), config.cleanupIntervalMs);
        // Allow Node.js to exit even if timer is active
        if (cleanupTimer.unref) cleanupTimer.unref();
    }

    return (req, res, next) => {
        const userId = req.user?.id;
        if (!userId) {
            // If no user (shouldn't happen – auth middleware runs first), just pass
            return next();
        }

        const now = Date.now();
        const cutoff = now - config.windowMs;

        if (!exportStore.has(userId)) {
            exportStore.set(userId, { timestamps: [] });
        }

        const data = exportStore.get(userId);

        // Drop timestamps outside the window
        data.timestamps = data.timestamps.filter(t => t > cutoff);

        if (data.timestamps.length >= config.maxRequests) {
            const oldestInWindow = Math.min(...data.timestamps);
            const retryAfterSec = Math.ceil((oldestInWindow + config.windowMs - now) / 1000);

            logger.warn('Export rate limit exceeded', {
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

        next();
    };
}

/**
 * Stop the background cleanup timer (for graceful shutdown / tests)
 */
export function stopExportRateLimitCleanup() {
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
    }
    exportStore.clear();
}

export default exportRateLimit;
