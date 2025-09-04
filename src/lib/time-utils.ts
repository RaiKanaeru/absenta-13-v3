/**
 * Utility functions for consistent time formatting across the application
 * All functions use 24-hour format (no AM/PM)
 */

/**
 * Format time to 24-hour format (HH:mm)
 * @param date - Date object or date string
 * @returns Formatted time string in 24-hour format
 */
export const formatTime24 = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

/**
 * Format time to 24-hour format with seconds (HH:mm:ss)
 * @param date - Date object or date string
 * @returns Formatted time string in 24-hour format with seconds
 */
export const formatTime24WithSeconds = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

/**
 * Format date with time in 24-hour format
 * @param date - Date object or date string
 * @param includeTime - Whether to include time in the output
 * @returns Formatted date string with optional time
 */
export const formatDateTime24 = (date: Date | string, includeTime: boolean = false): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (includeTime) {
    return dateObj.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }
  
  return dateObj.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Format date only (without time)
 * @param date - Date object or date string
 * @returns Formatted date string
 */
export const formatDateOnly = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Format time range in 24-hour format
 * @param startTime - Start time string (HH:mm)
 * @param endTime - End time string (HH:mm)
 * @returns Formatted time range string
 */
export const formatTimeRange24 = (startTime: string, endTime: string): string => {
  return `${startTime} - ${endTime}`;
};

/**
 * Get current time in 24-hour format
 * @returns Current time string in 24-hour format
 */
export const getCurrentTime24 = (): string => {
  return new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

/**
 * Get current date and time in 24-hour format
 * @returns Current date and time string
 */
export const getCurrentDateTime24 = (): string => {
  return new Date().toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};
