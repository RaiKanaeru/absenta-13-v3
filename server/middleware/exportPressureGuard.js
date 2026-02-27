/**
 * Export pressure guard middleware.
 * Blocks direct export endpoints when queue pressure indicates overload risk.
 */

import { sendRateLimitError } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ExportPressureGuard');

const DEFAULTS = {
    retryAfterSeconds: 15,
    enabledByDefault: true
};

const parseBoolean = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return fallback;
};

const isGuardEnabled = () => parseBoolean(process.env.EXPORT_PRESSURE_GUARD_ENABLED, DEFAULTS.enabledByDefault);

export const exportPressureGuard = async (req, res, next) => {
    if (!isGuardEnabled()) {
        return next();
    }

    const queue = globalThis.downloadQueue;
    if (!queue || typeof queue.getQueueStatistics !== 'function') {
        return next();
    }

    try {
        const stats = await queue.getQueueStatistics();
        const pressure = stats?.pressure;

        if (!pressure) {
            return next();
        }

        if (pressure.admissionOpen !== false) {
            return next();
        }

        const retryAfter = Number.isFinite(pressure.retryAfterSeconds)
            ? Math.max(1, pressure.retryAfterSeconds)
            : DEFAULTS.retryAfterSeconds;

        const reason = pressure.reason || 'Sistem export sedang padat, silakan coba beberapa saat lagi';

        logger.warn('Export request throttled due to pressure', {
            path: req.path,
            method: req.method,
            userId: req.user?.id,
            cpuUsage: pressure.cpuUsage,
            cpuLevel: pressure.cpuLevel,
            queueDepth: pressure.queueDepth,
            queueUtilizationPercent: pressure.queueUtilizationPercent,
            retryAfter
        });

        return sendRateLimitError(res, reason, retryAfter);
    } catch (error) {
        logger.warn('Export pressure guard check failed, request allowed', {
            path: req.path,
            method: req.method,
            error: error.message
        });
        return next();
    }
};

export default exportPressureGuard;
