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
// TOKEN REFRESH MECHANISM
// ================================================

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onRefreshed(token: string): void {
    refreshSubscribers.forEach(callback => callback(token));
    refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (token: string) => void): void {
    refreshSubscribers.push(callback);
}

/**
 * Attempt to refresh the access token using the refresh token cookie.
 * Returns the new access token on success, or null on failure.
 */
async function refreshAccessToken(): Promise<string | null> {
    try {
        const response = await fetch(getApiUrl('/api/refresh'), {
            method: 'POST',
            credentials: 'include',
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json() as Record<string, unknown>;
        if (data.success && typeof data.token === 'string') {
            // Store the new access token
            const { setAuthToken } = await import('./authUtils');
            setAuthToken(data.token);
            return data.token;
        }
        return null;
    } catch {
        return null;
    }
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

            // Handle 401 - check if token refresh is possible
            if (response.status === 401) {
                // Only attempt refresh for token expired errors (code 3004)
                if (apiError.code === 3004) {
                    if (!isRefreshing) {
                        isRefreshing = true;
                        const newToken = await refreshAccessToken();
                        isRefreshing = false;

                        if (newToken) {
                            onRefreshed(newToken);
                            // Retry the original request with new token
                            const retryHeaders = new Headers(options.headers || {});
                            if (!(options.body instanceof FormData)) {
                                retryHeaders.set('Content-Type', 'application/json');
                            }
                            retryHeaders.set('Authorization', `Bearer ${newToken}`);

                            const retryResponse = await fetch(getApiUrl(endpoint), {
                                credentials: 'include',
                                ...fetchOptions,
                                headers: retryHeaders,
                            });

                            if (retryResponse.ok) {
                                return await parseResponseData(retryResponse, options.responseType) as T;
                            }
                            // Retry also failed — fall through to logout
                        }

                        // Refresh failed or retry failed — force logout
                        if (onLogout) {
                            setTimeout(() => onLogout(), 100);
                        }
                        throw apiError;
                    } else {
                        // Another request is already refreshing — wait for it
                        return new Promise<T>((resolve, reject) => {
                            addRefreshSubscriber(async (newToken: string) => {
                                try {
                                    const retryHeaders = new Headers(options.headers || {});
                                    if (!(options.body instanceof FormData)) {
                                        retryHeaders.set('Content-Type', 'application/json');
                                    }
                                    retryHeaders.set('Authorization', `Bearer ${newToken}`);

                                    const retryResponse = await fetch(getApiUrl(endpoint), {
                                        credentials: 'include',
                                        ...fetchOptions,
                                        headers: retryHeaders,
                                    });

                                    if (retryResponse.ok) {
                                        resolve(await parseResponseData(retryResponse, options.responseType) as T);
                                    } else {
                                        reject(apiError);
                                    }
                                } catch (retryError) {
                                    reject(retryError);
                                }
                            });
                        });
                    }
                }

                // Non-expired auth error (3001, etc.) — force logout, no retry
                if (onLogout) {
                    setTimeout(() => onLogout(), 100);
                }
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
