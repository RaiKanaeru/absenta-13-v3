/**
 * Excel Streaming Builder
 * Optimized for large datasets using ExcelJS Streaming Interface
 */

import ExcelJS from 'exceljs';
import { getLetterhead } from '../utils/letterheadService.js';

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

    // --- 2. Write Headers & Letterhead (Complex merging not fully supported in stream without commit management) ---
    // For streaming simplicity, we simplify the header. 
    // Ideally, we should write rows manually to handle merges before committing.
    
    // Hack: We can't easily do complex merged letterheads in simple streaming without careful row management.
    // So we will stick to a simpler header or handle it row by row.
    
    // Let's implement row-by-row writing for headers to support basic merging
    
    // Row 1: Title
    const titleRow = worksheet.getRow(1);
    titleRow.getCell(1).value = title;
    titleRow.commit(); // Commit immediately

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
    let currentRowIdx = 6;
    
    // Check if dataIterator is array or iterable
    const isAsyncIterable = (typeof dataIterator[Symbol.asyncIterator] === 'function');
    const isIterable = (typeof dataIterator[Symbol.iterator] === 'function');

    if (isAsyncIterable) {
        for await (const item of dataIterator) {
            const mappedRow = rowMapper ? rowMapper(item, currentRowIdx - 6) : item;
            const row = worksheet.getRow(currentRowIdx);
            
            columns.forEach((col, colIdx) => {
                row.getCell(colIdx + 1).value = mappedRow[col.key];
            });
            
            row.commit(); // Commit row to free memory
            currentRowIdx++;
        }
    } else if (Array.isArray(dataIterator) || isIterable) {
        // Normal array processing but still row-by-row commit
        for (const item of dataIterator) {
            const mappedRow = rowMapper ? rowMapper(item, currentRowIdx - 6) : item;
            const row = worksheet.getRow(currentRowIdx);
            
            columns.forEach((col, colIdx) => {
                row.getCell(colIdx + 1).value = mappedRow[col.key];
            });
            
            row.commit();
            currentRowIdx++;
        }
    }

    // --- 4. Finalize ---
    await workbook.commit();
    // Note: res.end() is handled by workbook.commit() closing the stream usually, but sometimes needed.
    // In ExcelJS stream, commit ends the stream.
}
