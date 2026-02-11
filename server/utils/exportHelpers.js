/**
 * Export Helpers - Shared utilities for standardized Excel exports
 * Ensures consistency across all report exports
 */

import { getLetterhead } from '../../backend/utils/letterheadService.js';
import { buildExcel } from '../../backend/export/excelBuilder.js';
import { createLogger } from './logger.js';

const logger = createLogger('ExportHelpers');

/**
 * Standard export wrapper that ensures letterhead is always included
 * @param {Object} options - Export configuration
 * @param {string} options.reportKey - Report key for letterhead lookup
 * @param {string} options.title - Report title
 * @param {string} options.subtitle - Report subtitle
 * @param {string} options.reportPeriod - Report period string
 * @param {Array} options.columns - Column definitions
 * @param {Array} options.rows - Data rows
 * @returns {Promise<ExcelJS.Workbook>} Excel workbook
 */
export async function createStandardExport(options) {
    const { reportKey, title, subtitle, reportPeriod, columns, rows } = options;
    
    // Always fetch letterhead from database
    const letterhead = await getLetterhead({ reportKey });
    
    // Use buildExcel with letterhead enabled
    return buildExcel({
        title,
        subtitle,
        reportPeriod,
        letterhead: { ...letterhead, enabled: true },
        columns,
        rows
    });
}

/**
 * Safe percentage calculation with validation and bounds checking
 * Prevents division by zero and caps values between 0-100%
 * @param {number} value - Numerator value
 * @param {number} total - Denominator value
 * @param {number} decimals - Number of decimal places (default 2)
 * @param {Object} options - Additional options
 * @param {string} options.context - Context for logging warnings
 * @returns {number} Safe percentage value (0-100)
 */
export function calculateSafePercentage(value, total, decimals = 2, options = {}) {
    // Guard against zero or negative total
    if (!total || total <= 0) {
        if (options.context) {
            logger.warn(`[PERCENTAGE] Zero or negative total in ${options.context}: total=${total}`);
        }
        return 0;
    }
    
    // Calculate percentage
    const percentage = (value / total) * 100;
    
    // Warn if percentage exceeds 100% (data issue)
    if (percentage > 100) {
        logger.warn(`[PERCENTAGE] Value exceeds 100% in ${options.context || 'unknown'}: ${percentage.toFixed(2)}% (value=${value}, total=${total})`);
    }
    
    // Cap between 0-100 and format
    const safePercentage = Math.min(Math.max(percentage, 0), 100);
    return Number(safePercentage.toFixed(decimals));
}

/**
 * Create summary/total row for attendance reports
 * Automatically sums numeric columns and formats the row
 * @param {Array} data - Data rows
 * @param {Array} columns - Column definitions
 * @param {string} label - Label for the summary row (default 'TOTAL')
 * @returns {Object} Summary row object
 */
export function createSummaryRow(data, columns, label = 'TOTAL') {
    const summary = { no: '', nama: label };
    
    // Attendance column keys that should be summed
    const numericKeys = ['sakit', 'izin', 'alpa', 'hadir', 'dispen', 'total', 
                         'S', 'I', 'A', 'H', 'D', 
                         'jul', 'agt', 'sep', 'okt', 'nov', 'des',
                         'jan', 'feb', 'mar', 'apr', 'mei', 'jun',
                         'total_ketidakhadiran', 'total_kehadiran'];
    
    columns.forEach(col => {
        if (numericKeys.includes(col.key)) {
            summary[col.key] = data.reduce((sum, row) => sum + (Number(row[col.key]) || 0), 0);
        }
    });
    
    return summary;
}

/**
 * Create average row for percentage-based reports
 * @param {Array} data - Data rows
 * @param {Array} columns - Column definitions
 * @param {string} label - Label for the average row (default 'RATA-RATA')
 * @returns {Object} Average row object
 */
export function createAverageRow(data, columns, label = 'RATA-RATA') {
    const average = { no: '', nama: label };
    
    if (data.length === 0) return average;
    
    // Percentage column keys that should be averaged
    const percentageKeys = ['persentase', 'presentase', 'persentase_kehadiran', 'persentase_ketidakhadiran'];
    
    columns.forEach(col => {
        if (percentageKeys.includes(col.key)) {
            const sum = data.reduce((total, row) => total + (Number(row[col.key]) || 0), 0);
            average[col.key] = Number((sum / data.length).toFixed(2));
        }
    });
    
    return average;
}

/**
 * Validate and sanitize export data before sending to Excel builder
 * @param {Array} rows - Data rows
 * @param {Array} columns - Column definitions
 * @returns {Array} Sanitized rows
 */
export function sanitizeExportData(rows, columns) {
    return rows.map(row => {
        const sanitized = {};
        
        columns.forEach(col => {
            const value = row[col.key];
            
            // Handle null/undefined
            if (value === null || value === undefined) {
                sanitized[col.key] = col.format === 'number' ? 0 : '';
                return;
            }
            
            // Handle numbers
            if (col.format === 'number' || col.format === 'percentage') {
                sanitized[col.key] = Number(value) || 0;
                return;
            }
            
            // Handle dates
            if (col.format === 'date' && value instanceof Date) {
                sanitized[col.key] = value;
                return;
            }
            
            // Default: convert to string
            sanitized[col.key] = String(value);
        });
        
        return sanitized;
    });
}

/**
 * Get safe effective days count (minimum 1 to prevent division by zero)
 * @param {number} effectiveDays - Total effective days
 * @param {Object} options - Additional options
 * @param {string} options.context - Context for logging
 * @returns {number} Safe effective days (minimum 1)
 */
export function getSafeEffectiveDays(effectiveDays, options = {}) {
    const days = Number(effectiveDays) || 0;
    
    if (days <= 0) {
        logger.warn(`[EFFECTIVE_DAYS] Zero or negative effective days in ${options.context || 'unknown'}: ${days}. Using minimum value of 1.`);
        return 1;
    }
    
    return days;
}
