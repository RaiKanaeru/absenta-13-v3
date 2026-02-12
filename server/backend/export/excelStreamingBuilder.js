/**
 * Excel Streaming Builder
 * Optimized for large datasets using ExcelJS Streaming Interface
 */

import ExcelJS from 'exceljs';
import { getLetterhead } from '../utils/letterheadService.js';

/**
 * Write a single data row with column mapping
 * @param {Object} worksheet - ExcelJS worksheet
 * @param {number} rowIdx - Current row index
 * @param {Array} columns - Column definitions
 * @param {Object} mappedRow - Data object for row
 */
function writeDataRow(worksheet, rowIdx, columns, mappedRow) {
    const row = worksheet.getRow(rowIdx);
    columns.forEach((col, colIdx) => {
        row.getCell(colIdx + 1).value = mappedRow[col.key];
    });
    row.commit();
}

/**
 * Stream data to worksheet (async or sync)
 * @param {Object} worksheet - ExcelJS worksheet
 * @param {AsyncIterable|Array} dataIterator - Data source
 * @param {Array} columns - Column definitions
 * @param {Function} rowMapper - Optional row mapper function
 * @returns {Promise<number>} Final row index
 */
async function streamDataRows(worksheet, dataIterator, columns, rowMapper) {
    let currentRowIdx = 6;
    const isAsyncIterable = (typeof dataIterator[Symbol.asyncIterator] === 'function');
    const isIterable = (typeof dataIterator[Symbol.iterator] === 'function');

    if (isAsyncIterable) {
        for await (const item of dataIterator) {
            const mappedRow = rowMapper ? rowMapper(item, currentRowIdx - 6) : item;
            writeDataRow(worksheet, currentRowIdx, columns, mappedRow);
            currentRowIdx++;
        }
    } else if (Array.isArray(dataIterator) || isIterable) {
        for (const item of dataIterator) {
            const mappedRow = rowMapper ? rowMapper(item, currentRowIdx - 6) : item;
            writeDataRow(worksheet, currentRowIdx, columns, mappedRow);
            currentRowIdx++;
        }
    }
    
    return currentRowIdx;
}

/**
 * Stream Excel response directly to client
 * @param {Object} res - Express response object
 * @param {Object} options - Configuration options
 * @param {string} options.title - Main title
 * @param {string} options.subtitle - Subtitle
 * @param {string} options.reportPeriod - Report period string
 * @param {Object} options.letterhead - Letterhead configuration
 * @param {Array} options.columns - Column definitions
 * @param {AsyncIterable|Array} options.dataIterator - Async iterator or array of data rows
 * @param {Function} options.rowMapper - Function to map data item to row object
 */
export async function streamExcel(res, options) {
    const {
        title,
        subtitle,
        reportPeriod,
        letterhead = {},
        columns = [],
        dataIterator,
        rowMapper
    } = options;

    // Set headers for streaming response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${options.filename || 'export.xlsx'}"`);

    // Create streaming workbook writer
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        stream: res,
        useStyles: true,
        useSharedStrings: true
    });

    const worksheet = workbook.addWorksheet('Laporan');

    // --- 1. Setup Columns ---
    worksheet.columns = columns.map(col => ({
        header: col.label,
        key: col.key,
        width: col.width || 15
    }));

    // --- 2. Write Headers & Letterhead ---
    // Row 1: Title
    const titleRow = worksheet.getRow(1);
    titleRow.getCell(1).value = title;
    titleRow.commit();

    // Row 2: Subtitle
    if (subtitle) {
        const subRow = worksheet.getRow(2);
        subRow.getCell(1).value = subtitle;
        subRow.commit();
    }

    // Row 3: Period
    if (reportPeriod) {
        const periodRow = worksheet.getRow(3);
        periodRow.getCell(1).value = reportPeriod;
        periodRow.commit();
    }

    // Row 4: Empty
    worksheet.getRow(4).commit();

    // Row 5: Column Headers
    const headerRow = worksheet.getRow(5);
    columns.forEach((col, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = col.label;
        cell.font = { bold: true };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E40AF' }
        };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    });
    headerRow.commit();

    // --- 3. Stream Data ---
    await streamDataRows(worksheet, dataIterator, columns, rowMapper);

    // --- 4. Finalize ---
    await workbook.commit();
}
