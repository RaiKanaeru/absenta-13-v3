// API Configuration with mobile support
const getBaseUrl = (): string => {
    // Prioritaskan environment variable (di-build saat production)
    if (import.meta.env.VITE_API_BASE_URL) {
        return import.meta.env.VITE_API_BASE_URL;
    }
    
    // Production: Use relative URL (same-origin) to avoid CORS issues
    // Frontend nginx will proxy /api/* requests to backend
    const isProduction = globalThis.location.hostname !== 'localhost' && 
                         globalThis.location.hostname !== '127.0.0.1' &&
                         !globalThis.location.hostname.includes('192.168') &&
                         !globalThis.location.hostname.includes('10.0');
    
    if (isProduction) {
        // Use empty string for same-origin requests (relative URLs)
        // Nginx will proxy /api/* to backend service
        return '';
    }
    
    // Check if we're in mobile/network environment
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(globalThis.navigator?.userAgent || '');
    const isLocalhost = globalThis.location.hostname === 'localhost' || globalThis.location.hostname === '127.0.0.1';
    
    // If mobile and not localhost, use network IP
    if (isMobile && !isLocalhost) {
        // Extract IP from current location
        const currentHost = globalThis.location.hostname;
        if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
            return `http://${currentHost}:3001`;
        }
    }
    
    // Fallback to localhost for development
    return 'http://localhost:3001';
};

const API_BASE_URL = getBaseUrl();

export const getApiUrl = (endpoint: string): string => {
    // Remove leading slash if present
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${API_BASE_URL}${cleanEndpoint}`;
};

export const apiConfig = {
    baseUrl: API_BASE_URL,
    credentials: 'include' as RequestCredentials,
    headers: {
        'Content-Type': 'application/json',
    },
};

export default apiConfig;


