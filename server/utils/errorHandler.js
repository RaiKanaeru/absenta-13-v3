/**
 * Centralized Error Handler Utility
 * Provides consistent error responses for development vs production
 * 
 * Usage:
 *   import { sendErrorResponse } from '../utils/errorHandler.js';
 *   sendErrorResponse(res, error, 'Pesan untuk user', 500);
 */

/**
 * Send standardized error response
 * @param {Response} res - Express response object
 * @param {Error} error - The error object
 * @param {string} userMessage - User-friendly message in Bahasa Indonesia
 * @param {number} statusCode - HTTP status code (default: 500)
 */
export function sendErrorResponse(res, error, userMessage = 'Terjadi kesalahan sistem', statusCode = 500) {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    // Log error for server monitoring
    console.error('❌ Error:', error);
    
    if (isDevelopment) {
        // Development mode: detailed error for developers
        return res.status(statusCode).json({
            success: false,
            error: error.message || 'Internal server error',
            message: userMessage,
            devInfo: {
                errorType: error.name,
                errorMessage: error.message,
                errorCode: error.code,
                stack: error.stack?.split('\n').slice(0, 5).join('\n'),
                timestamp: new Date().toISOString()
            }
        });
    }
    
    // Production mode: user-friendly message only
    return res.status(statusCode).json({
        success: false,
        error: 'Terjadi kesalahan',
        message: userMessage
    });
}

/**
 * Database error helper
 */
export function sendDatabaseError(res, error, customMessage = null) {
    const userMessage = customMessage || 'Tidak dapat mengakses data. Silakan coba lagi atau hubungi administrator.';
    return sendErrorResponse(res, error, userMessage, 500);
}

/**
 * Validation error helper
 */
export function sendValidationError(res, message = 'Data yang dimasukkan tidak valid') {
    return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: message
    });
}

/**
 * Not found error helper
 */
export function sendNotFoundError(res, message = 'Data tidak ditemukan') {
    return res.status(404).json({
        success: false,
        error: 'Not found',
        message: message
    });
}

/**
 * Duplicate entry error helper
 */
export function sendDuplicateError(res, message = 'Data sudah ada di sistem') {
    return res.status(409).json({
        success: false,
        error: 'Duplicate entry',
        message: message
    });
}

/**
 * Permission error helper
 */
export function sendPermissionError(res, message = 'Anda tidak memiliki akses untuk operasi ini') {
    return res.status(403).json({
        success: false,
        error: 'Permission denied',
        message: message
    });
}

/**
 * Success response helper
 */
export function sendSuccessResponse(res, data = null, message = 'Operasi berhasil', statusCode = 200) {
    const response = {
        success: true,
        message: message
    };
    
    if (data !== null) {
        response.data = data;
    }
    
    return res.status(statusCode).json(response);
}
