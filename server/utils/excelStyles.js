/**
 * Excel Styling Module
 * Shared styles for consistent Excel export formatting across all reports
 * 
 * Usage:
 * import { excelStyles, applyHeaderStyle, applyCellBorder, formatTime } from '../utils/excelStyles.js';
 */

// ================================================
// COLOR PALETTE (ARGB format for ExcelJS)
// ================================================
export const colors = {
    // Primary colors
    headerBlue: 'FF1E40AF',      // Deep blue for headers
    headerText: 'FFFFFFFF',      // White text
    
    // Background colors
    lightBlue: 'FFE0E7FF',       // Light blue for alternating rows
    lightGray: 'FFF3F4F6',       // Light gray for sections
    multiGuru: 'FFDBEAFE',       // Light blue tint for multi-guru
    warning: 'FFFEF3C7',         // Yellow for warnings
    success: 'FFD1FAE5',         // Green for success
    danger: 'FFFEE2E2',          // Red for danger/errors
    
    // Text colors
    grayText: 'FF9CA3AF',        // Gray for secondary text
    primaryText: 'FF111827',     // Dark text
    
    // Status colors
    hadir: 'FF10B981',           // Green - Hadir
    izin: 'FF3B82F6',            // Blue - Izin
    sakit: 'FFF59E0B',           // Yellow - Sakit
    alpa: 'FFEF4444',            // Red - Alpa
    dispen: 'FF8B5CF6'           // Purple - Dispen
};

// ================================================
// BORDER STYLES
// ================================================
export const borders = {
    thin: {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
    },
    medium: {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        right: { style: 'medium', color: { argb: 'FF000000' } }
    },
    headerBottom: {
        bottom: { style: 'medium', color: { argb: 'FF1E40AF' } }
    }
};

// ================================================
// COMPLETE STYLE OBJECTS
// ================================================
export const excelStyles = {
    // Header row style (blue background, white text)
    header: {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.headerBlue } },
        font: { bold: true, color: { argb: colors.headerText }, size: 11 },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: borders.thin
    },
    
    // Sub-header style (light gray)
    subHeader: {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.lightGray } },
        font: { bold: true, size: 10 },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: borders.thin
    },
    
    // Category/group header style
    category: {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.lightBlue } },
        font: { bold: true, size: 10 },
        alignment: { horizontal: 'left', vertical: 'middle' },
        border: borders.thin
    },
    
    // Standard data cell
    cell: {
        alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
        border: borders.thin,
        font: { size: 10 }
    },
    
    // Centered data cell
    cellCenter: {
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: borders.thin,
        font: { size: 10 }
    },
    
    // Number cell (right aligned)
    cellNumber: {
        alignment: { horizontal: 'right', vertical: 'middle' },
        border: borders.thin,
        font: { size: 10 }
    },
    
    // Percentage cell
    cellPercent: {
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: borders.thin,
        font: { size: 10, bold: true }
    },
    
    // Empty/placeholder cell
    cellEmpty: {
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: borders.thin,
        font: { size: 9, color: { argb: colors.grayText } }
    },
    
    // Multi-guru indicator
    multiGuru: {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.multiGuru } },
        alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
        border: borders.thin,
        font: { size: 9 }
    },
    
    // Summary/footer row
    summary: {
        font: { italic: true, size: 9 },
        alignment: { horizontal: 'left', vertical: 'middle' }
    },
    
    // Title style
    title: {
        font: { bold: true, size: 14 },
        alignment: { horizontal: 'center', vertical: 'middle' }
    },
    
    // Subtitle style
    subtitle: {
        font: { size: 11 },
        alignment: { horizontal: 'center', vertical: 'middle' }
    }
};

// ================================================
// STATUS-BASED STYLES
// ================================================
export const statusStyles = {
    hadir: {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.success } },
        font: { size: 10, color: { argb: 'FF065F46' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: borders.thin
    },
    izin: {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } },
        font: { size: 10, color: { argb: 'FF1E40AF' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: borders.thin
    },
    sakit: {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.warning } },
        font: { size: 10, color: { argb: 'FF92400E' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: borders.thin
    },
    alpa: {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.danger } },
        font: { size: 10, color: { argb: 'FF991B1B' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: borders.thin
    },
    dispen: {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } },
        font: { size: 10, color: { argb: 'FF5B21B6' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: borders.thin
    }
};

// ================================================
// HELPER FUNCTIONS
// ================================================

/**
 * Apply style to a cell
 * @param {Object} cell - ExcelJS cell object
 * @param {Object} style - Style object from excelStyles
 */
export function applyStyle(cell, style) {
    if (style.fill) cell.fill = style.fill;
    if (style.font) cell.font = style.font;
    if (style.alignment) cell.alignment = style.alignment;
    if (style.border) cell.border = style.border;
}

/**
 * Apply header style to a row
 * @param {Object} row - ExcelJS row object
 * @param {number} startCol - Starting column (1-indexed)
 * @param {number} endCol - Ending column (1-indexed)
 */
export function applyHeaderRow(row, startCol = 1, endCol = null) {
    const lastCol = endCol || row.cellCount;
    for (let i = startCol; i <= lastCol; i++) {
        applyStyle(row.getCell(i), excelStyles.header);
    }
    row.height = 25;
}

/**
 * Apply borders to all cells in a range
 * @param {Object} worksheet - ExcelJS worksheet
 * @param {number} startRow - Starting row (1-indexed)
 * @param {number} endRow - Ending row (1-indexed)
 * @param {number} startCol - Starting column (1-indexed)
 * @param {number} endCol - Ending column (1-indexed)
 */
export function applyBordersToRange(worksheet, startRow, endRow, startCol, endCol) {
    for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
            worksheet.getCell(row, col).border = borders.thin;
        }
    }
}

/**
 * Apply alternating row colors
 * @param {Object} worksheet - ExcelJS worksheet
 * @param {number} startRow - Starting row (1-indexed)
 * @param {number} endRow - Ending row (1-indexed)
 * @param {number} startCol - Starting column (1-indexed)
 * @param {number} endCol - Ending column (1-indexed)
 */
export function applyAlternatingColors(worksheet, startRow, endRow, startCol, endCol) {
    for (let row = startRow; row <= endRow; row++) {
        if ((row - startRow) % 2 === 1) {
            for (let col = startCol; col <= endCol; col++) {
                const cell = worksheet.getCell(row, col);
                if (!cell.fill || cell.fill.pattern === 'none') {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.lightGray } };
                }
            }
        }
    }
}

/**
 * Format time string to HH:MM
 * @param {string} time - Time string (HH:MM:SS or HH:MM)
 * @returns {string} - Formatted time HH:MM
 */
export function formatTime(time) {
    if (!time) return '';
    const parts = time.toString().split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
}

/**
 * Parse guru_list string to array
 * Format: "1:Budi Santoso||2:Ahmad Wijaya"
 * @param {string} guruList - Guru list string
 * @returns {Array} - Array of {id, name} objects
 */
export function parseGuruList(guruList) {
    if (!guruList) return [];
    return guruList.split('||').map(item => {
        const [id, name] = item.split(':');
        return { id: Number.parseInt(id), name: name || 'Unknown' };
    }).filter(g => g.name);
}

/**
 * Get status style based on attendance status
 * @param {string} status - Status (Hadir, Izin, Sakit, Alpa, Dispen)
 * @returns {Object} - Style object
 */
export function getStatusStyle(status) {
    const statusLower = (status || '').toLowerCase();
    return statusStyles[statusLower] || excelStyles.cellCenter;
}

/**
 * Get percentage color based on value
 * @param {number} percentage - Percentage value (0-100)
 * @returns {string} - ARGB color code
 */
export function getPercentageColor(percentage) {
    if (percentage >= 90) return colors.success;
    if (percentage >= 75) return colors.warning;
    return colors.danger;
}

/**
 * Set standard column widths based on content type
 * @param {Object} worksheet - ExcelJS worksheet
 * @param {Array} columns - Array of {col, width, type} objects
 */
export function setColumnWidths(worksheet, columns) {
    const defaultWidths = {
        no: 5,
        nama: 25,
        nis: 12,
        nip: 18,
        kelas: 12,
        mapel: 20,
        status: 10,
        tanggal: 12,
        waktu: 12,
        keterangan: 30,
        persentase: 12
    };
    
    columns.forEach(({ col, width, type }) => {
        worksheet.getColumn(col).width = width || defaultWidths[type] || 15;
    });
}

// ================================================
// REPORT HEADER BUILDER
// ================================================

/**
 * Add styled report header with title and info
 * @param {Object} worksheet - ExcelJS worksheet
 * @param {string} title - Main report title
 * @param {string} subtitle - Subtitle or date range
 * @param {number} startRow - Starting row (1-indexed)
 * @param {number} totalCols - Total number of columns
 * @returns {number} - Next available row
 */
export function addStyledHeader(worksheet, title, subtitle, startRow, totalCols) {
    let currentRow = startRow;
    
    // Title
    const titleRow = worksheet.getRow(currentRow);
    titleRow.getCell(1).value = title;
    applyStyle(titleRow.getCell(1), excelStyles.title);
    worksheet.mergeCells(currentRow, 1, currentRow, totalCols);
    titleRow.height = 25;
    currentRow++;
    
    // Subtitle
    if (subtitle) {
        const subtitleRow = worksheet.getRow(currentRow);
        subtitleRow.getCell(1).value = subtitle;
        applyStyle(subtitleRow.getCell(1), excelStyles.subtitle);
        worksheet.mergeCells(currentRow, 1, currentRow, totalCols);
        subtitleRow.height = 20;
        currentRow++;
    }
    
    // Empty row for spacing
    currentRow++;
    
    return currentRow;
}

/**
 * Add summary row at the end of the report
 * @param {Object} worksheet - ExcelJS worksheet
 * @param {string} summary - Summary text
 * @param {number} row - Row number
 * @param {number} totalCols - Total columns
 */
export function addSummaryRow(worksheet, summary, row, totalCols) {
    const summaryRow = worksheet.getRow(row);
    summaryRow.getCell(1).value = summary;
    applyStyle(summaryRow.getCell(1), excelStyles.summary);
    worksheet.mergeCells(row, 1, row, totalCols);
}

export default {
    colors,
    borders,
    excelStyles,
    statusStyles,
    applyStyle,
    applyHeaderRow,
    applyBordersToRange,
    applyAlternatingColors,
    formatTime,
    parseGuruList,
    getStatusStyle,
    getPercentageColor,
    setColumnWidths,
    addStyledHeader,
    addSummaryRow
};
