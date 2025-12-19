import { getApiUrl } from '@/config/api';
import { getCleanToken } from './authUtils';

// ================================================
// ERROR TYPES & CODES
// ================================================

export interface ApiErrorInfo {
    code: number;
    message: string;
    details?: string | string[];
    requestId?: string;
    timestamp?: string;
}

/**
 * Custom API Error class with enhanced information
 */
export class ApiError extends Error {
    public code: number;
    public httpStatus: number;
    public details?: string | string[];
    public requestId?: string;
    public timestamp: string;
    public isNetworkError: boolean;
    public isServerError: boolean;
    public isAuthError: boolean;
    public isValidationError: boolean;

    constructor(
        message: string,
        code: number = 5001,
        httpStatus: number = 500,
        details?: string | string[],
        requestId?: string
    ) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.httpStatus = httpStatus;
        this.details = details;
        this.requestId = requestId;
        this.timestamp = new Date().toISOString();
        
        // Helper flags for UI handling
        this.isNetworkError = code >= 5001 && code <= 5003;
        this.isServerError = httpStatus >= 500;
        this.isAuthError = code >= 3001 && code <= 3004;
        this.isValidationError = code >= 2001 && code <= 2004;
    }

    /**
     * Get user-friendly message in Bahasa Indonesia
     */
    getUserMessage(): string {
        return this.message;
    }

    /**
     * Get detailed error string for display
     */
    getDetailedMessage(): string {
        if (this.details) {
            if (Array.isArray(this.details)) {
                return `${this.message}: ${this.details.join(', ')}`;
            }
            return `${this.message}: ${this.details}`;
        }
        return this.message;
    }
}

// ================================================
// ERROR MESSAGE MAPPING
// ================================================

const HTTP_STATUS_MESSAGES: Record<number, string> = {
    400: 'Data yang dikirim tidak valid',
    401: 'Sesi Anda telah berakhir. Silakan login kembali',
    403: 'Anda tidak memiliki akses untuk operasi ini',
    404: 'Data atau halaman tidak ditemukan',
    409: 'Konflik dengan data yang sudah ada',
    422: 'Data tidak dapat diproses',
    429: 'Terlalu banyak permintaan. Silakan tunggu sebentar',
    500: 'Terjadi kesalahan server. Silakan coba lagi',
    502: 'Server sedang tidak tersedia. Silakan coba lagi',
    503: 'Layanan sedang dalam pemeliharaan',
    504: 'Request timeout. Silakan coba lagi',
};

// ================================================
// API CALL OPTIONS
// ================================================

interface ApiCallOptions extends RequestInit {
    onLogout?: () => void;
    retries?: number;
    retryDelay?: number;
    showErrorToast?: boolean;
}

// ================================================
// MAIN API CALL FUNCTION
// ================================================

/**
 * Centralized API call utility with enhanced error handling
 * 
 * Features:
 * - Automatic retry for network errors
 * - Structured error responses
 * - Request ID tracking
 * - User-friendly error messages
 */
export const apiCall = async <T = any>(
    endpoint: string, 
    options: ApiCallOptions = {}
): Promise<T> => {
    const { 
        onLogout, 
        retries = 2, 
        retryDelay = 1000,
        showErrorToast = true,
        ...fetchOptions 
    } = options;

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(getApiUrl(endpoint), {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getCleanToken()}`,
                    ...options.headers,
                },
                ...fetchOptions,
            });

            // Parse response
            let responseData: any;
            const contentType = response.headers.get('content-type');
            
            if (contentType?.includes('application/json')) {
                responseData = await response.json();
            } else {
                responseData = await response.text();
            }

            // Handle successful response
            if (response.ok) {
                return responseData;
            }

            // Handle error response
            const errorInfo = typeof responseData === 'object' ? responseData : { error: responseData };
            const errorMessage = errorInfo.error?.message 
                || errorInfo.message 
                || errorInfo.error 
                || HTTP_STATUS_MESSAGES[response.status] 
                || `Error: ${response.status}`;
            
            const apiError = new ApiError(
                errorMessage,
                errorInfo.error?.code || response.status,
                response.status,
                errorInfo.error?.details || errorInfo.details,
                errorInfo.requestId
            );

            // Handle 401 - Unauthorized
            if (response.status === 401) {
                console.warn('🔐 Session expired, triggering logout...');
                if (onLogout) {
                    setTimeout(() => onLogout(), 1500);
                }
                throw apiError;
            }

            // Log error for debugging
            console.error('❌ API Error:', {
                endpoint,
                status: response.status,
                code: apiError.code,
                message: apiError.message,
                requestId: apiError.requestId
            });

            throw apiError;

        } catch (error) {
            lastError = error as Error;
            
            // Don't retry for API errors (only retry network errors)
            if (error instanceof ApiError) {
                throw error;
            }

            // Network error - retry if attempts remaining
            if (attempt < retries) {
                console.warn(`⚠️ Network error, retrying (${attempt + 1}/${retries})...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
            }

            // All retries exhausted - throw network error
            const networkError = new ApiError(
                'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.',
                5001,
                0
            );
            throw networkError;
        }
    }

    // This shouldn't happen, but just in case
    throw lastError || new Error('Unknown error occurred');
};

// ================================================
// HELPER FUNCTIONS
// ================================================

/**
 * Check if error is an API error
 */
export function isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
}

/**
 * Get user-friendly error message from any error
 */
export function getErrorMessage(error: unknown): string {
    if (isApiError(error)) {
        return error.getUserMessage();
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'Terjadi kesalahan yang tidak diketahui';
}

/**
 * Get error code from any error
 */
export function getErrorCode(error: unknown): number | null {
    if (isApiError(error)) {
        return error.code;
    }
    return null;
}

export default apiCall;
