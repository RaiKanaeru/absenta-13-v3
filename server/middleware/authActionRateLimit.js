import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { sendRateLimitError } from '../utils/errorHandler.js';

/**
 * Parse numeric env/config values safely.
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function parsePositiveInt(value, fallback) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Create a lightweight auth action limiter for refresh/logout style endpoints.
 * Uses X-Client-ID when available, otherwise falls back to IP.
 *
 * @param {Object} options
 * @param {number} [options.windowMs=60000]
 * @param {number} [options.max=30]
 * @param {string} [options.message]
 * @returns {import('express').RequestHandler}
 */
export function createAuthActionLimiter(options = {}) {
    const windowMs = parsePositiveInt(options.windowMs, 60_000);
    const max = parsePositiveInt(options.max, 30);
    const message = options.message || 'Terlalu banyak permintaan autentikasi. Silakan coba lagi nanti.';

    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            const clientId = typeof req.headers['x-client-id'] === 'string'
                ? req.headers['x-client-id'].trim()
                : '';
            return clientId || ipKeyGenerator(req.ip || req.socket?.remoteAddress || 'unknown');
        },
        handler: (req, res) => {
            const retryAfter = Math.ceil(windowMs / 1000);
            return sendRateLimitError(res, message, retryAfter);
        },
    });
}

export function getAuthRateLimitConfig(env = process.env) {
    return {
        windowMs: parsePositiveInt(env.AUTH_ACTION_RATE_LIMIT_WINDOW_MS, 60_000),
        refreshMax: parsePositiveInt(env.AUTH_REFRESH_RATE_LIMIT_MAX, env.NODE_ENV === 'production' ? 30 : 60),
        logoutMax: parsePositiveInt(env.AUTH_LOGOUT_RATE_LIMIT_MAX, env.NODE_ENV === 'production' ? 60 : 120),
    };
}
