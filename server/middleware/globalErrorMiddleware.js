/**
 * Global Error Middleware
 * Catches all unhandled errors and provides consistent error responses
 * 
 * Usage in server_modern.js:
 *   import { notFoundHandler, globalErrorHandler, asyncHandler } from './server/middleware/globalErrorMiddleware.js';
 *   
 *   // All routes here...
 *   
 *   // After all routes (IMPORTANT - must be at the end)
 *   app.use(notFoundHandler);
 *   app.use(globalErrorHandler);
 */

import { ERROR_CODES, AppError, generateRequestId } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';
export { asyncHandler } from '../utils/asyncHandler.js';
export { asyncMiddleware } from '../utils/asyncHandler.js';

const logger = createLogger('ErrorMiddleware');

// ================================================
// REQUEST ID MIDDLEWARE
// ================================================

/**
 * Attach request ID to all requests for tracking
 */
export function requestIdMiddleware(req, res, next) {
    const requestId = req.headers['x-request-id'] || generateRequestId();
    req.requestId = requestId;
    res.locals.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
}

// ================================================
// 404 NOT FOUND HANDLER
// ================================================

/**
 * Handle 404 - Route not found
 * Place this AFTER all valid routes
 */
export function notFoundHandler(req, res, next) {
    const requestId = res.locals?.requestId || generateRequestId();
    
    logger.warn('404 Not Found', { requestId, method: req.method, url: req.originalUrl });
    
    res.status(404).json({
        success: false,
        error: {
            code: 404,
            message: 'Endpoint tidak ditemukan',
            path: req.originalUrl,
            method: req.method
        },
        suggestion: 'Periksa kembali URL dan method yang digunakan',
        requestId,
        timestamp: new Date().toISOString()
    });
}

// ================================================
// GLOBAL ERROR HANDLER
// ================================================

/**
 * Global error handler - catches all unhandled errors
 * Place this as THE LAST middleware
 */
export function globalErrorHandler(err, req, res, next) {
    const requestId = res.locals?.requestId || generateRequestId();
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    // Log error details
    logger.error('Unhandled Error', {
        requestId,
        message: err.message,
        code: err.code,
        name: err.name,
        url: req.originalUrl,
        method: req.method,
        body: isDevelopment ? req.body : undefined,
        stack: isDevelopment ? err.stack : undefined
    });
    
    // Handle known AppError
    if (err instanceof AppError) {
        err.requestId = requestId;
        return res.status(err.httpStatus).json(err.toJSON());
    }
    
    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            error: {
                code: ERROR_CODES.AUTH_UNAUTHORIZED.code,
                message: 'Token tidak valid'
            },
            requestId,
            timestamp: new Date().toISOString()
        });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            error: {
                code: ERROR_CODES.AUTH_TOKEN_EXPIRED.code,
                message: 'Sesi Anda telah berakhir. Silakan login kembali'
            },
            requestId,
            timestamp: new Date().toISOString()
        });
    }
    
    // Handle syntax errors (bad JSON)
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            error: {
                code: ERROR_CODES.VALIDATION_INVALID_FORMAT.code,
                message: 'Format JSON tidak valid'
            },
            requestId,
            timestamp: new Date().toISOString()
        });
    }
    
    // Handle multer file upload errors
    if (err.name === 'MulterError') {
        logger.warn('Multer Error', { code: err.code, field: err.field, message: err.message });
        return res.status(400).json({
            success: false,
            error: {
                code: ERROR_CODES.VALIDATION_INVALID_FORMAT.code,
                message: `Upload Error: ${err.message} (${err.code})`
            },
            requestId,
            timestamp: new Date().toISOString()
        });
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            error: {
                code: ERROR_CODES.FILE_TOO_LARGE.code,
                message: 'Ukuran file terlalu besar'
            },
            requestId,
            timestamp: new Date().toISOString()
        });
    }
    
    // Default 500 error
    const response = {
        success: false,
        error: {
            code: ERROR_CODES.INTERNAL_ERROR.code,
            // FORCE SHOW ERROR MESSAGE FOR DEBUGGING - USER REQUESTED
            message: err.message || 'Terjadi kesalahan sistem.'
        },
        requestId,
        timestamp: new Date().toISOString()
    };
    
    if (isDevelopment) {
        response.devInfo = {
            name: err.name,
            message: err.message,
            code: err.code,
            stack: err.stack?.split('\n').slice(0, 10)
        };
    }
    
    return res.status(500).json(response);
}

// ================================================
// ASYNC HANDLER - Re-exported from asyncHandler.js
// ================================================
// asyncHandler and asyncMiddleware are re-exported from '../utils/asyncHandler.js'
// for backward compatibility

// ================================================
// ERROR THROWING HELPERS
// ================================================

/**
 * Throw 404 error
 */
export function throwNotFound(message = 'Data tidak ditemukan') {
    throw new AppError(ERROR_CODES.DB_NOT_FOUND, message);
}

/**
 * Throw validation error
 */
export function throwValidationError(message = 'Data tidak valid', details = null) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, message, details);
}

/**
 * Throw unauthorized error
 */
export function throwUnauthorized(message = 'Sesi Anda telah berakhir') {
    throw new AppError(ERROR_CODES.AUTH_UNAUTHORIZED, message);
}

/**
 * Throw forbidden error
 */
export function throwForbidden(message = 'Anda tidak memiliki akses') {
    throw new AppError(ERROR_CODES.AUTH_FORBIDDEN, message);
}

export default {
    requestIdMiddleware,
    notFoundHandler,
    globalErrorHandler,
    throwNotFound,
    throwValidationError,
    throwUnauthorized,
    throwForbidden
};
