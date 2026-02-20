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

    getUserMessage(): string { return this.message; }

    getDetailedMessage(): string {
        if (this.details) {
            const detailStr = Array.isArray(this.details) ? this.details.join(', ') : this.details;
            return `${this.message}: ${detailStr}`;
        }
        return this.message;
    }
}

// ================================================
// CONSTANTS & HELPERS
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

interface ApiCallOptions extends RequestInit {
    onLogout?: () => void;
    retries?: number;
    retryDelay?: number;
    showErrorToast?: boolean;
    responseType?: 'json' | 'blob' | 'text';
}

/**
 * Parse response based on requested type or content type
 */
async function parseResponseData(response: Response, responseType?: 'json' | 'blob' | 'text'): Promise<unknown> {
    if (responseType === 'blob') return response.blob();
    if (responseType === 'text') return response.text();
    
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) return response.json();
    return response.text();
}

/**
 * Create ApiError from response data
 */
function createApiErrorFromResponse(response: Response, responseData: unknown): ApiError {
    const errorInfo = (typeof responseData === 'object' && responseData !== null)
        ? responseData as Record<string, unknown>
        : { error: responseData };
    
    const errorObj = (typeof errorInfo.error === 'object' && errorInfo.error !== null)
        ? errorInfo.error as Record<string, unknown>
        : undefined;

    let errorMessage = HTTP_STATUS_MESSAGES[response.status] || `Error: ${response.status}`;
    if (typeof errorObj?.message === 'string') {
        errorMessage = errorObj.message;
    } else if (typeof errorInfo.message === 'string') {
        errorMessage = errorInfo.message;
    } else if (typeof errorInfo.error === 'string') {
        errorMessage = errorInfo.error;
    }

    const errorCode = typeof errorObj?.code === 'number' ? errorObj.code : response.status;
    let errorDetails;
    if (typeof errorObj?.details === 'string' || Array.isArray(errorObj?.details)) {
        errorDetails = errorObj.details;
    } else if (typeof errorInfo.details === 'string' || Array.isArray(errorInfo.details)) {
        errorDetails = errorInfo.details;
    }
    const requestId = typeof errorInfo.requestId === 'string' ? errorInfo.requestId : undefined;
    
    return new ApiError(
        errorMessage,
        errorCode,
        response.status,
        errorDetails,
        requestId
    );
}

/**
 * Prepare request headers
 */
function prepareHeaders(options: ApiCallOptions): Headers {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }
    if (!headers.has('Authorization')) {
        const token = getCleanToken();
        if (token) headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
}

// ================================================
// MAIN API CALL FUNCTION
// ================================================

/**
 * Centralized API call utility with enhanced error handling
 */
export const apiCall = async <T = unknown>(endpoint: string, options: ApiCallOptions = {}): Promise<T> => {
    const { onLogout, retries = 2, retryDelay = 1000, ...fetchOptions } = options;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(getApiUrl(endpoint), {
                credentials: 'include',
                headers: prepareHeaders(options),
                ...fetchOptions,
            });

            if (response.ok) {
                return await parseResponseData(response, options.responseType) as T;
            }

            // Handle Error Response
            const responseData = await parseResponseData(response);
            const apiError = createApiErrorFromResponse(response, responseData);

            if (response.status === 401 && onLogout) {
                setTimeout(() => onLogout(), 1500);
            }

            throw apiError;

        } catch (error) {
            lastError = error;
            if (error instanceof ApiError) throw error;
            
            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
            }
        }
    }

    throw lastError instanceof ApiError ? lastError : new ApiError('Tidak dapat terhubung ke server.', 5001, 0);
};

export function isApiError(error: unknown): error is ApiError { return error instanceof ApiError; }

export function getErrorMessage(error: unknown): string {
    if (isApiError(error)) return error.getUserMessage();
    return error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui';
}

export function getErrorCode(error: unknown): number | null {
    return isApiError(error) ? error.code : null;
}

export default apiCall;
