/**
 * Advanced Error Handler Utility
 * Provides comprehensive error handling with categorization, logging, and user-friendly messages
 * 
 * Features:
 * - Error code mapping for MySQL errors
 * - Request ID tracking for debugging
 * - Categorized error types
 * - Bilingual messages (ID/EN)
 * - Structured logging for monitoring
 */

import { v4 as uuidv4 } from 'uuid';

// ================================================
// ERROR CODES & MESSAGES
// ================================================

export const ERROR_CODES = {
    // Database Errors (1xxx)
    DB_CONNECTION_FAILED: { code: 1001, message: 'Koneksi database gagal', en: 'Database connection failed' },
    DB_QUERY_FAILED: { code: 1002, message: 'Query database gagal', en: 'Database query failed' },
    DB_DUPLICATE_ENTRY: { code: 1003, message: 'Data sudah ada di sistem', en: 'Duplicate entry exists' },
    DB_FOREIGN_KEY: { code: 1004, message: 'Referensi data tidak valid', en: 'Invalid foreign key reference' },
    DB_NOT_FOUND: { code: 1005, message: 'Data tidak ditemukan', en: 'Data not found' },
    
    // Validation Errors (2xxx)
    VALIDATION_FAILED: { code: 2001, message: 'Data tidak valid', en: 'Validation failed' },
    VALIDATION_REQUIRED_FIELD: { code: 2002, message: 'Field wajib tidak terisi', en: 'Required field missing' },
    VALIDATION_INVALID_FORMAT: { code: 2003, message: 'Format data tidak valid', en: 'Invalid data format' },
    VALIDATION_OUT_OF_RANGE: { code: 2004, message: 'Nilai di luar rentang yang diizinkan', en: 'Value out of allowed range' },
    
    // Authentication Errors (3xxx)
    AUTH_UNAUTHORIZED: { code: 3001, message: 'Sesi Anda telah berakhir. Silakan login kembali', en: 'Session expired. Please login again' },
    AUTH_FORBIDDEN: { code: 3002, message: 'Anda tidak memiliki akses untuk operasi ini', en: 'You do not have permission for this operation' },
    AUTH_INVALID_CREDENTIALS: { code: 3003, message: 'Username atau password salah', en: 'Invalid username or password' },
    AUTH_TOKEN_EXPIRED: { code: 3004, message: 'Token telah kadaluarsa', en: 'Token has expired' },
    RATE_LIMIT_EXCEEDED: { code: 3005, message: 'Terlalu banyak permintaan. Silakan coba lagi nanti', en: 'Too many requests. Please try again later' },
    
    // Business Logic Errors (4xxx)
    BUSINESS_RULE_VIOLATION: { code: 4001, message: 'Operasi melanggar aturan bisnis', en: 'Business rule violation' },
    RESOURCE_CONFLICT: { code: 4002, message: 'Konflik dengan data yang sudah ada', en: 'Conflict with existing data' },
    OPERATION_NOT_ALLOWED: { code: 4003, message: 'Operasi tidak diizinkan', en: 'Operation not allowed' },
    ENDPOINT_DEPRECATED: { code: 4004, message: 'Endpoint sudah tidak digunakan', en: 'Endpoint deprecated' },
    
    // Server Errors (5xxx)
    INTERNAL_ERROR: { code: 5001, message: 'Terjadi kesalahan sistem. Silakan coba lagi', en: 'System error occurred. Please try again' },
    SERVICE_UNAVAILABLE: { code: 5002, message: 'Layanan sedang tidak tersedia', en: 'Service temporarily unavailable' },
    TIMEOUT: { code: 5003, message: 'Request timeout. Silakan coba lagi', en: 'Request timeout. Please try again' },
    
    // File Errors (6xxx)
    FILE_NOT_FOUND: { code: 6001, message: 'File tidak ditemukan', en: 'File not found' },
    FILE_TOO_LARGE: { code: 6002, message: 'Ukuran file terlalu besar', en: 'File size too large' },
    FILE_INVALID_TYPE: { code: 6003, message: 'Tipe file tidak didukung', en: 'Invalid file type' },
};

// MySQL Error Code Mapping
const MYSQL_ERROR_MAP = {
    'ER_DUP_ENTRY': ERROR_CODES.DB_DUPLICATE_ENTRY,
    'ER_NO_REFERENCED_ROW': ERROR_CODES.DB_FOREIGN_KEY,
    'ER_NO_REFERENCED_ROW_2': ERROR_CODES.DB_FOREIGN_KEY,
    'ER_ROW_IS_REFERENCED': ERROR_CODES.RESOURCE_CONFLICT,
    'ER_ROW_IS_REFERENCED_2': ERROR_CODES.RESOURCE_CONFLICT,
    'ER_BAD_FIELD_ERROR': ERROR_CODES.VALIDATION_INVALID_FORMAT,
    'ER_PARSE_ERROR': ERROR_CODES.DB_QUERY_FAILED,
    'ER_ACCESS_DENIED_ERROR': ERROR_CODES.AUTH_FORBIDDEN,
    'ECONNREFUSED': ERROR_CODES.DB_CONNECTION_FAILED,
    'ETIMEDOUT': ERROR_CODES.TIMEOUT,
    'ER_WRONG_ARGUMENTS': ERROR_CODES.DB_QUERY_FAILED,
};

// ================================================
// CUSTOM ERROR CLASS
// ================================================

export class AppError extends Error {
    constructor(errorCode, customMessage = null, details = null) {
        super(customMessage || errorCode.message);
        this.name = 'AppError';
        this.code = errorCode.code;
        this.httpStatus = this.getHttpStatus(errorCode.code);
        this.errorCode = errorCode;
        this.details = details;
        this.timestamp = new Date().toISOString();
        this.requestId = null; // Set by middleware
    }

    getHttpStatus(code) {
        // Special case for Not Found (DB)
        if (code === ERROR_CODES.DB_NOT_FOUND.code) return 404;
        // Special case for Duplicate Entry (DB)
        if (code === ERROR_CODES.DB_DUPLICATE_ENTRY.code) return 409;
        // Special case for Rate Limit
        if (code === ERROR_CODES.RATE_LIMIT_EXCEEDED.code) return 429;
        // Special case for Deprecated Endpoint
        if (code === ERROR_CODES.ENDPOINT_DEPRECATED.code) return 410;

        const codePrefix = Math.floor(code / 1000);
        switch (codePrefix) {
            case 1: return 500; // Database errors
            case 2: return 400; // Validation errors
            case 3: return code === 3002 ? 403 : 401; // Auth errors
            case 4: return 409; // Business logic errors
            case 5: return 500; // Server errors
            case 6: return code === 6001 ? 404 : 400; // File errors
            default: return 500;
        }
    }

    toJSON() {
        return {
            success: false,
            error: {
                code: this.code,
                message: this.message,
                details: this.details
            },
            requestId: this.requestId,
            timestamp: this.timestamp
        };
    }
}

// ================================================
// ERROR RESPONSE HELPERS
// ================================================

/**
 * Generate request ID for tracking
 */
export function generateRequestId() {
    return `req_${Date.now()}_${uuidv4().substring(0, 8)}`;
}

/**
 * Map MySQL error to AppError
 */
export function mapMySQLError(error) {
    const errorCode = MYSQL_ERROR_MAP[error.code] || ERROR_CODES.DB_QUERY_FAILED;
    
    // Extract useful info from MySQL error
    let details = null;
    if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage) {
        const match = error.sqlMessage.match(/Duplicate entry '(.+)' for key/);
        if (match) {
            details = `Nilai '${match[1]}' sudah digunakan`;
        }
    }
    
    return new AppError(errorCode, null, details);
}

/**
 * Send standardized error response
 */
export function sendErrorResponse(res, error, userMessage = null, statusCode = null, extra = null) {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const requestId = res.locals?.requestId || generateRequestId();
    const errorToLog = error || new Error(userMessage || ERROR_CODES.INTERNAL_ERROR.message);
    
    // Log error
    console.error(`[${requestId}] Error:`, {
        message: errorToLog.message,
        code: errorToLog.code,
        stack: isDevelopment ? errorToLog.stack : undefined
    });
    
    // Handle AppError
    if (error instanceof AppError) {
        error.requestId = requestId;
        const payload = error.toJSON();
        if (extra && typeof extra === 'object') {
            Object.assign(payload, extra);
        }
        return res.status(error.httpStatus).json(payload);
    }
    
    // Handle MySQL errors
    if (error?.code && MYSQL_ERROR_MAP[error.code]) {
        const appError = mapMySQLError(error);
        appError.requestId = requestId;
        const payload = appError.toJSON();
        if (extra && typeof extra === 'object') {
            Object.assign(payload, extra);
        }
        return res.status(appError.httpStatus).json(payload);
    }
    
    // Handle generic errors
    const httpStatus = statusCode || 500;
    const response = {
        success: false,
        error: {
            code: ERROR_CODES.INTERNAL_ERROR.code,
            message: userMessage || ERROR_CODES.INTERNAL_ERROR.message
        },
        requestId,
        timestamp: new Date().toISOString()
    };
    
    if (isDevelopment) {
        response.devInfo = {
            errorType: errorToLog.name,
            errorMessage: errorToLog.message,
            errorCode: errorToLog.code,
            stack: errorToLog.stack?.split('\n').slice(0, 10)
        };
    }

    if (extra && typeof extra === 'object') {
        Object.assign(response, extra);
    }
    
    return res.status(httpStatus).json(response);
}

/**
 * Database error helper
 */
export function sendDatabaseError(res, error, customMessage = null) {
    return sendErrorResponse(res, error, customMessage);
}

/**
 * Validation error helper
 */
export function sendValidationError(res, message = 'Data yang dimasukkan tidak valid', details = null) {
    const error = new AppError(ERROR_CODES.VALIDATION_FAILED, message, details);
    return sendErrorResponse(res, error);
}

/**
 * Not found error helper
 */
export function sendNotFoundError(res, message = 'Data tidak ditemukan') {
    const error = new AppError(ERROR_CODES.DB_NOT_FOUND, message);
    return sendErrorResponse(res, error);
}

/**
 * Duplicate entry error helper
 */
export function sendDuplicateError(res, message = 'Data sudah ada di sistem') {
    const error = new AppError(ERROR_CODES.DB_DUPLICATE_ENTRY, message);
    return sendErrorResponse(res, error);
}

/**
 * Permission error helper
 */
export function sendPermissionError(res, message = 'Anda tidak memiliki akses untuk operasi ini') {
    const error = new AppError(ERROR_CODES.AUTH_FORBIDDEN, message);
    return sendErrorResponse(res, error);
}

/**
 * Success response helper
 */
export function sendSuccessResponse(res, data = null, message = 'Operasi berhasil', statusCode = 200) {
    const response = {
        success: true,
        message
    };
    
    if (data !== null) {
        response.data = data;
    }
    
    return res.status(statusCode).json(response);
}

/**
 * Paginated response helper
 */
export function sendPaginatedResponse(res, data, pagination, message = 'Data berhasil diambil') {
    return res.status(200).json({
        success: true,
        message,
        data,
        pagination
    });
}

/**
 * Service unavailable error helper (503)
 */
export function sendServiceUnavailableError(res, message = 'Layanan sedang tidak tersedia', retryAfter = null) {
    const error = new AppError(ERROR_CODES.SERVICE_UNAVAILABLE, message);
    error.requestId = res.locals?.requestId || generateRequestId();
    const response = error.toJSON();
    
    if (retryAfter) {
        res.setHeader('Retry-After', retryAfter);
        response.retryAfter = retryAfter;
    }
    
    return res.status(503).json(response);
}

/**
 * Conflict error helper (409)
 */
export function sendConflictError(res, message = 'Konflik dengan data yang sudah ada') {
    const error = new AppError(ERROR_CODES.RESOURCE_CONFLICT, message);
    return sendErrorResponse(res, error);
}

/**
 * Timeout error helper (408/504)
 */
export function sendTimeoutError(res, message = 'Request timeout. Silakan coba lagi') {
    const error = new AppError(ERROR_CODES.TIMEOUT, message);
    error.requestId = res.locals?.requestId || generateRequestId();
    return res.status(504).json(error.toJSON());
}

/**
 * Business rule violation error helper (409)
 */
export function sendBusinessRuleError(res, message = 'Operasi melanggar aturan bisnis') {
    const error = new AppError(ERROR_CODES.BUSINESS_RULE_VIOLATION, message);
    return sendErrorResponse(res, error);
}

/**
 * Rate limit error helper (429)
 */
export function sendRateLimitError(res, message = ERROR_CODES.RATE_LIMIT_EXCEEDED.message, retryAfter = null) {
    const error = new AppError(ERROR_CODES.RATE_LIMIT_EXCEEDED, message);
    error.requestId = res.locals?.requestId || generateRequestId();
    const response = error.toJSON();
    if (retryAfter) {
        res.setHeader('Retry-After', retryAfter);
        response.retryAfter = retryAfter;
    }
    return res.status(429).json(response);
}

/**
 * Deprecated endpoint helper (410)
 */
export function sendDeprecatedError(res, message = ERROR_CODES.ENDPOINT_DEPRECATED.message) {
    const error = new AppError(ERROR_CODES.ENDPOINT_DEPRECATED, message);
    return sendErrorResponse(res, error);
}
