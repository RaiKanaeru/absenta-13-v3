/**
 * API utility function for teacher dashboard components
 */
import { getApiUrl } from '@/config/api';

export const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const response = await fetch(getApiUrl(endpoint), {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(errorData.error || `Error: ${response.status}`);
  }

  return response.json();
};
