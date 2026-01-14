/**
 * Authentication Utilities
 * Centralized token handling to eliminate duplication across components
 */

/**
 * Get authentication token with fallback to sessionStorage
 * Handles mobile browsers where localStorage may be unavailable
 */
export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  } catch (error) {
    console.error('❌ Error accessing storage:', error);
    return null;
  }
};

/**
 * Get cleaned auth token (removes quotes that may be present)
 * @returns Clean token string or empty string if not found
 */
export const getCleanToken = (): string => {
  const token = getAuthToken();
  return token ? token.split(/['"]/).join('') : '';
};

/**
 * Get authorization header object ready to use in fetch
 * @returns HeadersInit object with Authorization and Content-Type
 */
export const getAuthHeaders = (): HeadersInit => ({
  'Authorization': `Bearer ${getCleanToken()}`,
  'Content-Type': 'application/json'
});

/**
 * Get just the Authorization header (useful when Content-Type varies)
 * @returns Object with just Authorization header
 */
export const getAuthorizationHeader = (): { Authorization: string } => ({
  'Authorization': `Bearer ${getCleanToken()}`
});

/**
 * Check if user has a valid token stored
 * @returns boolean indicating if token exists
 */
export const hasAuthToken = (): boolean => {
  return !!getAuthToken();
};

/**
 * Store authentication token with fallback
 * @param token - The token to store
 */
export const setAuthToken = (token: string): void => {
  try {
    localStorage.setItem('token', token);
  } catch (error) {
    console.error('❌ localStorage failed, trying sessionStorage:', error);
    try {
      sessionStorage.setItem('token', token);
    } catch (sessionError) {
      console.error('❌ Both localStorage and sessionStorage failed:', sessionError);
    }
  }
};

/**
 * Clear authentication token from all storage
 */
export const clearAuthToken = (): void => {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('authToken');
  } catch (error) {
    console.error('❌ Error clearing tokens:', error);
  }
};

export default {
  getAuthToken,
  getCleanToken,
  getAuthHeaders,
  getAuthorizationHeader,
  hasAuthToken,
  setAuthToken,
  clearAuthToken
};
