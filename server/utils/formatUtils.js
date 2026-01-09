/**
 * Format Utilities
 * Centralized formatting functions to avoid code duplication
 */

/**
 * Format bytes to human readable string
 * @param {number} bytes - Number of bytes
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "1.5 MB", "256 KB")
 */
export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const BYTES_PER_KB = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const unitIndex = Math.floor(Math.log(bytes) / Math.log(BYTES_PER_KB));
    
    return.parseFloat((bytes / Math.pow(BYTES_PER_KB, unitIndex)).toFixed(decimals)) + ' ' + sizes[unitIndex];
}

/**
 * Format number with thousand separators (Indonesian locale)
 * @param {number} num - Number to format
 * @returns Formatted string (e.g., "1.234.567")
 */
export function formatNumber(num) {
    return num.toLocaleString('id-ID');
}

/**
 * Format percentage
 * @param {number} value - Value to format
 * @param {number} decimals - Decimal places (default: 2)
 * @returns Formatted percentage string (e.g., "85.50%")
 */
export function formatPercentage(value, decimals = 2) {
    return `${value.toFixed(decimals)}%`;
}
