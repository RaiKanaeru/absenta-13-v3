/**
 * Excel Streaming Builder
 * Optimized for large datasets using ExcelJS Streaming Interface
 */

import ExcelJS from 'exceljs';

/**
 * Apply row mapper or return item as-is
 * @param {*} item - Data item
 * @param {Function|undefined} rowMapper - Mapper function
 * @param {number} rowIndex - Current row index
 * @returns {Object} Mapped row data
 */
function applyRowMapper(item, rowMapper, rowIndex) {
    return rowMapper ? rowMapper(item, rowIndex - 6) : item;
}

function writeMappedRow(worksheet, columns, mappedRow, rowIndex) {
    const row = worksheet.getRow(rowIndex);

    columns.forEach((col, colIdx) => {
        row.getCell(colIdx + 1).value = mappedRow[col.key];
    });

    row.commit();
}

async function streamAsyncRows(dataIterator, rowMapper, worksheet, columns, startRowIdx) {
    let currentRowIdx = startRowIdx;

    for await (const item of dataIterator) {
        const mappedRow = applyRowMapper(item, rowMapper, currentRowIdx);
        writeMappedRow(worksheet, columns, mappedRow, currentRowIdx);
        currentRowIdx += 1;
    }

    return currentRowIdx;
}

function streamIterableRows(dataIterator, rowMapper, worksheet, columns, startRowIdx) {
    let currentRowIdx = startRowIdx;

    for (const item of dataIterator) {
        const mappedRow = applyRowMapper(item, rowMapper, currentRowIdx);
        writeMappedRow(worksheet, columns, mappedRow, currentRowIdx);
        currentRowIdx += 1;
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
 * @param {Array} options.columns - Column definitions
 * @param {AsyncIterable|Array} options.dataIterator - Async iterator or array of data rows
 * @param {Function} options.rowMapper - Function to map data item to row object
 */
export async function streamExcel(res, options) {
    const {
        title,
        subtitle,
        reportPeriod,
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
    // Simplified streaming header due to merge limitations

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
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E40AF' }
        };
    });
    headerRow.commit();

    // --- 3. Stream Data ---
    let currentRowIdx = 6;
    const isAsyncIterable = dataIterator && typeof dataIterator[Symbol.asyncIterator] === 'function';
    const isIterable = dataIterator && typeof dataIterator[Symbol.iterator] === 'function';

    if (isAsyncIterable) {
        currentRowIdx = await streamAsyncRows(dataIterator, rowMapper, worksheet, columns, currentRowIdx);
    } else if (Array.isArray(dataIterator) || isIterable) {
        currentRowIdx = streamIterableRows(dataIterator, rowMapper, worksheet, columns, currentRowIdx);
    }

    // --- 4. Finalize ---
    await workbook.commit();
}
