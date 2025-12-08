// API Configuration with mobile support
const getBaseUrl = (): string => {
    // Prioritaskan environment variable (di-build saat production)
    if (import.meta.env.VITE_API_BASE_URL) {
        return import.meta.env.VITE_API_BASE_URL;
    }
    
    // Production fallback: jika di production dan tidak ada env var, gunakan subdomain API
    const isProduction = window.location.hostname !== 'localhost' && 
                         window.location.hostname !== '127.0.0.1' &&
                         !window.location.hostname.includes('192.168') &&
                         !window.location.hostname.includes('10.0');
    
    if (isProduction) {
        // Gunakan subdomain API untuk production
        const currentHost = window.location.hostname;
        // Jika hostname adalah absenta13.my.id, gunakan api.absenta13.my.id
        if (currentHost === 'absenta13.my.id' || currentHost === 'www.absenta13.my.id') {
            return 'https://api.absenta13.my.id';
        }
        // Fallback: coba gunakan subdomain api
        const apiHost = currentHost.replace(/^(www\.)?/, 'api.');
        return `https://${apiHost}`;
    }
    
    // Check if we're in mobile/network environment
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // If mobile and not localhost, use network IP
    if (isMobile && !isLocalhost) {
        // Extract IP from current location
        const currentHost = window.location.hostname;
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


