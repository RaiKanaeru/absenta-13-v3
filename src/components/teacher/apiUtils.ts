/**
 * API utility function for teacher dashboard components
 */
import { apiCall as baseApiCall } from '@/utils/apiClient';

export const apiCall = async <T = unknown>(
  endpoint: string,
  options: Parameters<typeof baseApiCall>[1] = {}
) => {
  return baseApiCall<T>(endpoint, options);
};
