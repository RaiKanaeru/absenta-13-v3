import { getApiUrl } from '@/config/api';

interface ApiCallOptions extends RequestInit {
    onLogout?: () => void;
}

/**
 * Centralized API call utility
 * Handles all API requests with consistent error handling and authentication
 */
export const apiCall = async <T = any>(
    endpoint: string, 
    options: ApiCallOptions = {}
): Promise<T> => {
    const { onLogout, ...fetchOptions } = options;
    
    const response = await fetch(getApiUrl(endpoint), {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...fetchOptions,
    });

    if (!response.ok) {
        if (response.status === 401) {
            const error = new Error('Sesi Anda telah berakhir. Silakan login kembali.');
            if (onLogout) {
                setTimeout(() => onLogout(), 2000);
            }
            throw error;
        }
        
        const errorData = await response.json().catch(() => ({ 
            error: `HTTP ${response.status}` 
        }));
        
        console.error('❌ API Error:', { 
            status: response.status, 
            errorData 
        });
        
        const error = new Error(errorData.error || `Error: ${response.status}`);
        if (errorData.details) {
            (error as any).details = errorData.details;
        }
        throw error;
    }

    return response.json();
};

export default apiCall;


