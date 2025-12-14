/**
 * Professional Logger Utility
 * 
 * Features:
 * - Structured log format (semi-JSON for readability)
 * - Log levels: DEBUG, INFO, WARN, ERROR
 * - Request context tracking (requestId, method, path, userId)
 * - Timestamps with timezone
 * - Environment-aware (verbose in dev, structured in prod)
 * - Performance timing support
 * 
 * Usage:
 *   import { Logger } from '../utils/logger.js';
 *   const logger = new Logger('JamPelajaran');
 *   logger.info('Operation started', { kelasId: 5 });
 *   logger.error('Database failed', error, { query: 'SELECT...' });
 */

// ================================================
// LOG LEVELS
// ================================================

const LOG_LEVELS = {
    DEBUG: { value: 0, label: 'DEBUG', color: '\x1b[36m' },  // Cyan
    INFO:  { value: 1, label: 'INFO ', color: '\x1b[32m' },  // Green
    WARN:  { value: 2, label: 'WARN ', color: '\x1b[33m' },  // Yellow
    ERROR: { value: 3, label: 'ERROR', color: '\x1b[31m' }   // Red
};

const RESET_COLOR = '\x1b[0m';

// Get minimum log level from environment
const MIN_LOG_LEVEL = process.env.LOG_LEVEL 
    ? (LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()]?.value ?? 1)
    : (process.env.NODE_ENV === 'production' ? 1 : 0);

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ================================================
// LOGGER CLASS
// ================================================

export class Logger {
    /**
     * Create a logger instance for a specific module/controller
     * @param {string} module - Module name (e.g., 'JamPelajaran', 'Export', 'Auth')
     */
    constructor(module) {
        this.module = module;
        this.requestContext = null;
    }

    /**
     * Set request context for tracing
     * @param {object} context - { requestId, method, path, userId }
     */
    setContext(context) {
        this.requestContext = context;
        return this;
    }

    /**
     * Create child logger with request context
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     */
    withRequest(req, res) {
        const child = new Logger(this.module);
        child.requestContext = {
            requestId: res?.locals?.requestId || req?.headers?.['x-request-id'] || this._generateId(),
            method: req?.method,
            path: req?.path || req?.originalUrl,
            userId: req?.user?.id || req?.user?.userId,
            userRole: req?.user?.role
        };
        return child;
    }

    /**
     * Generate short request ID
     */
    _generateId() {
        return `req_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
    }

    /**
     * Get formatted timestamp
     */
    _getTimestamp() {
        const now = new Date();
        // Format: 2025-12-14 16:30:45.123
        return now.toISOString().replace('T', ' ').replace('Z', '');
    }

    /**
     * Format log output
     */
    _format(level, message, data = null, error = null) {
        const timestamp = this._getTimestamp();
        const levelInfo = LOG_LEVELS[level];
        
        // Build log object
        const logObj = {
            time: timestamp,
            level: levelInfo.label.trim(),
            module: this.module
        };

        // Add request context if available
        if (this.requestContext) {
            if (this.requestContext.requestId) logObj.reqId = this.requestContext.requestId;
            if (this.requestContext.method) logObj.method = this.requestContext.method;
            if (this.requestContext.path) logObj.path = this.requestContext.path;
            if (this.requestContext.userId) logObj.userId = this.requestContext.userId;
        }

        logObj.msg = message;

        // Add data if provided
        if (data && Object.keys(data).length > 0) {
            logObj.data = data;
        }

        // Add error details if provided
        if (error) {
            logObj.error = {
                name: error.name,
                message: error.message,
                code: error.code
            };
            if (!IS_PRODUCTION && error.stack) {
                logObj.error.stack = error.stack.split('\n').slice(0, 5);
            }
        }

        // Format output
        if (IS_PRODUCTION) {
            // JSON format for production (easier to parse by log aggregators)
            return JSON.stringify(logObj);
        } else {
            // Colored readable format for development
            const color = levelInfo.color;
            const ctx = this.requestContext?.requestId ? `[${this.requestContext.requestId}]` : '';
            const dataStr = data ? ` ${JSON.stringify(data)}` : '';
            const errorStr = error ? ` | Error: ${error.message}` : '';
            
            return `${color}${timestamp} | ${levelInfo.label} | ${this.module} ${ctx} | ${message}${dataStr}${errorStr}${RESET_COLOR}`;
        }
    }

    /**
     * Check if log level should be output
     */
    _shouldLog(level) {
        return LOG_LEVELS[level].value >= MIN_LOG_LEVEL;
    }

    // ================================================
    // LOG METHODS
    // ================================================

    /**
     * Debug level - detailed information for debugging
     */
    debug(message, data = null) {
        if (!this._shouldLog('DEBUG')) return;
        console.log(this._format('DEBUG', message, data));
    }

    /**
     * Info level - general operational information
     */
    info(message, data = null) {
        if (!this._shouldLog('INFO')) return;
        console.log(this._format('INFO', message, data));
    }

    /**
     * Warn level - potential issues or validation failures
     */
    warn(message, data = null) {
        if (!this._shouldLog('WARN')) return;
        console.warn(this._format('WARN', message, data));
    }

    /**
     * Error level - errors and exceptions
     */
    error(message, error = null, data = null) {
        if (!this._shouldLog('ERROR')) return;
        console.error(this._format('ERROR', message, data, error));
    }

    // ================================================
    // CONVENIENCE METHODS
    // ================================================

    /**
     * Log request start
     */
    requestStart(action, params = {}) {
        this.info(`${action} started`, params);
    }

    /**
     * Log successful completion
     */
    success(action, result = {}) {
        this.info(`${action} completed`, result);
    }

    /**
     * Log validation failure
     */
    validationFail(field, value, reason) {
        this.warn('Validation failed', { field, value, reason });
    }

    /**
     * Log database error
     */
    dbError(operation, error, context = {}) {
        this.error(`Database ${operation} failed`, error, context);
    }

    /**
     * Log with timing (for performance monitoring)
     */
    timed(action, startTime, data = {}) {
        const duration = Date.now() - startTime;
        this.info(`${action} completed`, { ...data, durationMs: duration });
    }
}

// ================================================
// SINGLETON LOGGERS FOR COMMON MODULES
// ================================================

export const loggers = {
    auth: new Logger('Auth'),
    database: new Logger('Database'),
    export: new Logger('Export'),
    import: new Logger('Import'),
    backup: new Logger('Backup'),
    system: new Logger('System')
};

// ================================================
// HELPER FUNCTION FOR QUICK LOGGING
// ================================================

/**
 * Create a logger for a specific module
 * @param {string} module - Module name
 */
export function createLogger(module) {
    return new Logger(module);
}

// Default export
export default Logger;
