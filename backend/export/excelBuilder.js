import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLetterhead } from '../utils/letterheadService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CONSTANTS
// ============================================

const STYLES = {
    headerFont: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
    headerFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } },
    altRowFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } },
    thinBorder: { style: 'thin', color: { argb: 'FF000000' } }
};

const DEFAULT_COLUMN_WIDTH = 15;

// ============================================
// HELPER FUNCTIONS - Logo Handling
// ============================================

/**
 * Get possible paths to search for a logo file
 * @param {string} logoUrl - Original logo URL/path
 * @returns {string[]} Array of possible paths
 */
function getLogoPaths(logoUrl) {
    const cleanPath = logoUrl.replace(/^\/+/, '');
    return [
        path.join(process.cwd(), 'public', cleanPath),
        path.join(process.cwd(), 'dist', cleanPath),
        path.join(process.cwd(), cleanPath),
        logoUrl
    ];
}

/**
 * Load logo buffer from URL or file path
 * @param {string} logoUrl - Logo URL (base64 or file path)
 * @param {string} position - Logo position for logging ('kiri' or 'kanan')
 * @returns {Buffer|null} Logo buffer or null if not found
 */
function loadLogoBuffer(logoUrl, position) {
    if (!logoUrl) return null;

    // Handle base64 data URL
    if (logoUrl.startsWith('data:image/')) {
        console.log(`[LOG] Logo ${position}: Processing base64 data URL`);
        const base64Data = logoUrl.split(',')[1];
        return Buffer.from(base64Data, 'base64');
    }

    // Handle file path
    const possiblePaths = getLogoPaths(logoUrl);
    console.log(`[FILE] Searching for logo ${position} in paths:`, possiblePaths);

    for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
            console.log(`[OK] Logo ${position} found at:`, testPath);
            const buffer = fs.readFileSync(testPath);
            console.log(`[OK] Logo ${position} loaded successfully, size:`, buffer.length, 'bytes');
            return buffer;
        }
    }

    console.warn(`[WARN] Logo ${position} file not found in any path`);
    return null;
}

/**
 * Add logo to worksheet
 * @param {ExcelJS.Workbook} workbook - Excel workbook
 * @param {ExcelJS.Worksheet} worksheet - Excel worksheet
 * @param {Buffer} logoBuffer - Logo image buffer
 * @param {Object} position - Position config { col, row, colSpan, rowSpan }
 * @returns {boolean} Success status
 */
function addLogoToWorksheet(workbook, worksheet, logoBuffer, position) {
    const logoId = workbook.addImage({
        buffer: logoBuffer,
        extension: 'png'
    });
    worksheet.addImage(logoId, {
        tl: { col: position.col, row: position.row },
        br: { col: position.col + position.colSpan, row: position.row + position.rowSpan }
    });
    return true;
}

/**
 * Set logo fallback text when image not available
 * @param {ExcelJS.Row} row - Excel row
 * @param {number} cellIndex - Cell index
 * @param {string} text - Fallback text
 * @param {string} alignment - Horizontal alignment
 */
function setLogoFallback(row, cellIndex, text, alignment) {
    const cell = row.getCell(cellIndex);
    cell.value = text;
    cell.font = { italic: true, size: 10 };
    cell.alignment = { horizontal: alignment };
}

/**
 * Process and add a single logo (left or right)
 * @param {ExcelJS.Workbook} workbook - Excel workbook
 * @param {ExcelJS.Worksheet} worksheet - Excel worksheet
 * @param {ExcelJS.Row} logoRow - Row for logo placement
 * @param {string} logoUrl - Logo URL
 * @param {string} side - 'left' or 'right'
 * @param {number} currentRow - Current row number
 * @param {number} columnsCount - Number of columns
 */
function processLogo(workbook, worksheet, logoRow, logoUrl, side, currentRow, columnsCount) {
    if (!logoUrl) return;

    const position = side === 'left' ? 'kiri' : 'kanan';
    
    try {
        const logoBuffer = loadLogoBuffer(logoUrl, position);
        
        if (logoBuffer) {
            const colPosition = side === 'left' 
                ? { col: 0, row: currentRow - 1, colSpan: 2, rowSpan: 5 }
                : { col: Math.max(columnsCount - 1, 3), row: currentRow - 1, colSpan: 2, rowSpan: 5 };
            
            addLogoToWorksheet(workbook, worksheet, logoBuffer, colPosition);
            console.log(`[OK] Logo ${position} added to Excel successfully`);
        } else {
            const cellIndex = side === 'left' ? 1 : Math.max(columnsCount, 3);
            const alignment = side === 'left' ? 'left' : 'right';
            setLogoFallback(logoRow, cellIndex, `[LOGO ${position.toUpperCase()}]`, alignment);
        }
    } catch (error) {
        console.warn(`[WARN] Could not add ${side} logo to Excel:`, error.message);
        const cellIndex = side === 'left' ? 1 : Math.max(columnsCount, 3);
        const alignment = side === 'left' ? 'left' : 'right';
        setLogoFallback(logoRow, cellIndex, `[LOGO ${position.toUpperCase()}]`, alignment);
    }
}

// ============================================
// HELPER FUNCTIONS - Letterhead
// ============================================

/**
 * Add logos row to worksheet
 * @param {ExcelJS.Workbook} workbook - Excel workbook
 * @param {ExcelJS.Worksheet} worksheet - Excel worksheet
 * @param {Object} letterhead - Letterhead config
 * @param {number} currentRow - Current row number
 * @param {number} columnsCount - Number of columns
 * @returns {number} Updated row number
 */
function addLogosRow(workbook, worksheet, letterhead, currentRow, columnsCount) {
    const hasLogos = letterhead.logoLeftUrl || letterhead.logoRightUrl;
    if (!hasLogos) return currentRow;

    const logoRow = worksheet.getRow(currentRow);
    
    console.log('[RENDER] Rendering letterhead with logos:', {
        logoLeftUrl: letterhead.logoLeftUrl,
        logoRightUrl: letterhead.logoRightUrl
    });

    processLogo(workbook, worksheet, logoRow, letterhead.logoLeftUrl, 'left', currentRow, columnsCount);
    processLogo(workbook, worksheet, logoRow, letterhead.logoRightUrl, 'right', currentRow, columnsCount);

    return currentRow + 6; // Space for logo
}

/**
 * Add letterhead text lines
 * @param {ExcelJS.Worksheet} worksheet - Excel worksheet
 * @param {Array} lines - Letterhead lines
 * @param {string} alignment - Text alignment
 * @param {number} currentRow - Current row number
 * @param {number} columnsCount - Number of columns
 * @returns {number} Updated row number
 */
function addLetterheadLines(worksheet, lines, alignment, currentRow, columnsCount) {
    lines.forEach((line, index) => {
        const lineRow = worksheet.getRow(currentRow);
        const text = typeof line === 'string' ? line : line.text;
        const isFirstLine = index === 0;
        const defaultWeight = isFirstLine ? 'bold' : 'normal';
        const fontWeight = typeof line === 'object' ? line.fontWeight : defaultWeight;
        
        const cell = lineRow.getCell(1);
        cell.value = text;
        cell.font = fontWeight === 'bold' ? { bold: true, size: 16 } : { size: 12 };
        cell.alignment = { horizontal: alignment };
        
        worksheet.mergeCells(currentRow, 1, currentRow, Math.max(columnsCount, 1));
        currentRow++;
    });

    return currentRow + 1; // Add separator
}

// ============================================
// HELPER FUNCTIONS - Content
// ============================================

/**
 * Add title row to worksheet
 * @param {ExcelJS.Worksheet} worksheet - Excel worksheet
 * @param {string} title - Title text
 * @param {number} currentRow - Current row number
 * @param {number} columnsCount - Number of columns
 * @returns {number} Updated row number
 */
function addTitleRow(worksheet, title, currentRow, columnsCount) {
    const titleRow = worksheet.getRow(currentRow);
    titleRow.getCell(1).value = title;
    titleRow.getCell(1).font = { bold: true, size: 14 };
    titleRow.getCell(1).alignment = { horizontal: 'center' };
    worksheet.mergeCells(currentRow, 1, currentRow, columnsCount);
    return currentRow + 1;
}

/**
 * Add subtitle row to worksheet
 * @param {ExcelJS.Worksheet} worksheet - Excel worksheet
 * @param {string} subtitle - Subtitle text
 * @param {number} currentRow - Current row number
 * @param {number} columnsCount - Number of columns
 * @returns {number} Updated row number
 */
function addSubtitleRow(worksheet, subtitle, currentRow, columnsCount) {
    if (!subtitle) return currentRow;
    
    const subtitleRow = worksheet.getRow(currentRow);
    subtitleRow.getCell(1).value = subtitle;
    subtitleRow.getCell(1).font = { size: 12 };
    subtitleRow.getCell(1).alignment = { horizontal: 'center' };
    worksheet.mergeCells(currentRow, 1, currentRow, columnsCount);
    return currentRow + 1;
}

/**
 * Add report period row to worksheet
 * @param {ExcelJS.Worksheet} worksheet - Excel worksheet
 * @param {string} reportPeriod - Report period text
 * @param {number} currentRow - Current row number
 * @param {number} columnsCount - Number of columns
 * @returns {number} Updated row number
 */
function addReportPeriodRow(worksheet, reportPeriod, currentRow, columnsCount) {
    if (!reportPeriod) return currentRow;
    
    const periodRow = worksheet.getRow(currentRow);
    periodRow.getCell(1).value = `Periode: ${reportPeriod}`;
    periodRow.getCell(1).font = { size: 11 };
    periodRow.getCell(1).alignment = { horizontal: 'center' };
    worksheet.mergeCells(currentRow, 1, currentRow, columnsCount);
    return currentRow + 1;
}

/**
 * Get cell border style
 * @returns {Object} Border style object
 */
function getCellBorder() {
    return {
        top: STYLES.thinBorder,
        left: STYLES.thinBorder,
        bottom: STYLES.thinBorder,
        right: STYLES.thinBorder
    };
}

/**
 * Add column headers row
 * @param {ExcelJS.Worksheet} worksheet - Excel worksheet
 * @param {Array} columns - Column definitions
 * @param {number} currentRow - Current row number
 * @returns {number} Updated row number
 */
function addHeaderRow(worksheet, columns, currentRow) {
    const headerRow = worksheet.getRow(currentRow);
    
    columns.forEach((col, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = col.label;
        cell.font = STYLES.headerFont;
        cell.alignment = { horizontal: col.align || 'center', vertical: 'middle' };
        cell.fill = STYLES.headerFill;
        cell.border = getCellBorder();
    });
    
    return currentRow + 1;
}

/**
 * Format cell value based on column format
 * @param {any} value - Raw value
 * @param {Object} col - Column definition
 * @param {ExcelJS.Cell} cell - Excel cell
 * @returns {any} Formatted value
 */
function formatCellValue(value, col, cell) {
    if (col.format === 'number') {
        return Number(value) || 0;
    }
    
    if (col.format === 'percentage') {
        cell.numFmt = '0.00%';
        return Number(value) || 0;
    }
    
    if (col.format === 'date' && value) {
        const date = new Date(value);
        return date.toLocaleDateString('id-ID');
    }
    
    return value;
}

/**
 * Add data rows to worksheet
 * @param {ExcelJS.Worksheet} worksheet - Excel worksheet
 * @param {Array} columns - Column definitions
 * @param {Array} rows - Data rows
 * @param {number} currentRow - Current row number
 * @returns {number} Updated row number
 */
function addDataRows(worksheet, columns, rows, currentRow) {
    rows.forEach((row, rowIndex) => {
        const dataRow = worksheet.getRow(currentRow);
        
        columns.forEach((col, colIndex) => {
            const cell = dataRow.getCell(colIndex + 1);
            const value = row[col.key];
            
            cell.value = formatCellValue(value, col, cell);
            cell.alignment = { horizontal: col.align || 'left', vertical: 'middle' };
            cell.border = getCellBorder();

            // Alternate row colors
            if (rowIndex % 2 === 0) {
                cell.fill = STYLES.altRowFill;
            }
        });
        
        currentRow++;
    });
    
    return currentRow;
}

/**
 * Format date to Indonesian locale string
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
function formatIndonesianDate(date) {
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta'
    };
    return date.toLocaleDateString('id-ID', options) + ' WIB';
}

/**
 * Add print footer to worksheet
 * @param {ExcelJS.Worksheet} worksheet - Excel worksheet
 * @param {number} currentRow - Current row number
 * @param {number} columnsCount - Number of columns
 * @returns {number} Updated row number
 */
function addPrintFooter(worksheet, currentRow, columnsCount) {
    // Add empty row for spacing
    currentRow += 2;
    
    const footerRow = worksheet.getRow(currentRow);
    const printDate = formatIndonesianDate(new Date());
    const footerText = `Dicetak oleh Sistem Absenta13, ${printDate}`;
    
    footerRow.getCell(1).value = footerText;
    footerRow.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF666666' } };
    footerRow.getCell(1).alignment = { horizontal: 'right' };
    
    // Merge cells for footer
    if (columnsCount > 1) {
        worksheet.mergeCells(currentRow, 1, currentRow, columnsCount);
    }
    
    return currentRow + 1;
}

/**
 * Set column widths
 * @param {ExcelJS.Worksheet} worksheet - Excel worksheet
 * @param {Array} columns - Column definitions
 */
function setColumnWidths(worksheet, columns) {
    columns.forEach((col, index) => {
        const column = worksheet.getColumn(index + 1);
        column.width = col.width || DEFAULT_COLUMN_WIDTH;
    });
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Build Excel workbook with styled header and data
 * @param {Object} options - Configuration options
 * @param {string} options.title - Main title
 * @param {string} options.subtitle - Subtitle
 * @param {string} options.reportPeriod - Report period string
 * @param {boolean} options.showLetterhead - Whether to show letterhead (deprecated)
 * @param {Object} options.letterhead - Letterhead configuration
 * @param {Array} options.columns - Column definitions
 * @param {Array} options.rows - Data rows
 * @returns {Promise<ExcelJS.Workbook>} - Excel workbook
 */
async function buildExcel(options) {
    const {
        title,
        subtitle,
        reportPeriod,
        showLetterhead = false,
        letterhead = {},
        columns = [],
        rows = []
    } = options;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Laporan');
    const columnsCount = columns.length;

    // Set initial column widths
    setColumnWidths(worksheet, columns);

    let currentRow = 1;

    // Determine letterhead visibility and fetch from DB if needed
    let activeLetterhead = letterhead;
    const shouldShowLetterhead = letterhead.enabled ?? showLetterhead;
    let hasLetterheadLines = letterhead.lines?.length > 0;

    // If showLetterhead is requested but no letterhead data, fetch from database
    if (shouldShowLetterhead && !hasLetterheadLines) {
        try {
            activeLetterhead = await getLetterhead({ reportKey: null }); // Get global letterhead
            hasLetterheadLines = activeLetterhead?.lines?.length > 0;
        } catch (error) {
            console.warn('Could not fetch letterhead from database:', error.message);
        }
    }

    // Add letterhead section
    if (shouldShowLetterhead && hasLetterheadLines && activeLetterhead) {
        currentRow = addLogosRow(workbook, worksheet, activeLetterhead, currentRow, columnsCount);
        currentRow = addLetterheadLines(worksheet, activeLetterhead.lines, activeLetterhead.alignment || 'center', currentRow, columnsCount);
    }

    // Add title section
    currentRow = addTitleRow(worksheet, title, currentRow, columnsCount);
    currentRow = addSubtitleRow(worksheet, subtitle, currentRow, columnsCount);
    currentRow = addReportPeriodRow(worksheet, reportPeriod, currentRow, columnsCount);
    currentRow++; // Separator

    // Add data section
    currentRow = addHeaderRow(worksheet, columns, currentRow);
    currentRow = addDataRows(worksheet, columns, rows, currentRow);

    // Add print footer
    addPrintFooter(worksheet, currentRow, columnsCount);

    // Final column width adjustment
    setColumnWidths(worksheet, columns);

    return workbook;
}

export {
    buildExcel
};
