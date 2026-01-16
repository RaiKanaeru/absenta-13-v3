/**
 * Excel Letterhead Utility
 * Reusable letterhead rendering for Excel exports
 * Extracted from server_modern.js for code reuse
 */

import path from 'node:path';
import fs from 'node:fs';
import { createLogger } from './logger.js';
import { getLetterhead } from '../../backend/utils/letterheadService.js';

const logger = createLogger('ExcelLetterhead');

/**
 * Add letterhead to Excel worksheet
 * @param {Object} workbook - ExcelJS workbook
 * @param {Object} worksheet - ExcelJS worksheet  
 * @param {Object} letterhead - Letterhead configuration from getLetterhead()
 * @param {number} columnCount - Number of columns in the table
 * @returns {number} - Next row number after letterhead
 */
export async function addLetterheadToWorksheet(workbook, worksheet, letterhead, columnCount = 11) {
    let currentRow = 1;
    let activeLetterhead = letterhead;
    
    // If no letterhead provided or empty, fetch from database
    if (!letterhead?.enabled || !letterhead?.lines?.length) {
        try {
            activeLetterhead = await getLetterhead({ reportKey: null }); // Get global letterhead
            if (!activeLetterhead?.enabled || !activeLetterhead?.lines?.length) {
                logger.warn('No letterhead configuration found in database');
                return currentRow; // Return without letterhead
            }
        } catch (error) {
            logger.warn('Could not fetch letterhead from database:', error.message);
            return currentRow; // Return without letterhead
        }
    }

    const alignment = activeLetterhead.alignment || 'center';

    // Add logos if available
    if (activeLetterhead.logoLeftUrl || activeLetterhead.logoRightUrl) {
        await addLogosToWorksheet(workbook, worksheet, activeLetterhead, columnCount, currentRow);
        currentRow += 4; // Space for logo
    }

    // Add letterhead lines
    currentRow = addLetterheadLines(worksheet, activeLetterhead.lines, alignment, currentRow, columnCount);

    return currentRow + 1; // Separator
}

/**
 * Add logos to worksheet
 */
async function addLogosToWorksheet(workbook, worksheet, letterhead, columnCount, currentRow) {
    if (letterhead.logoLeftUrl) {
        await addSingleLogo(workbook, worksheet, letterhead.logoLeftUrl, 0, currentRow);
    }
    if (letterhead.logoRightUrl) {
        const rightCol = Math.max(columnCount - 2, 3);
        await addSingleLogo(workbook, worksheet, letterhead.logoRightUrl, rightCol, currentRow);
    }
}

/**
 * Add single logo to worksheet
 */
async function addSingleLogo(workbook, worksheet, logoUrl, col, row) {
    try {
        const logoBuffer = await getLogoBuffer(logoUrl);
        if (logoBuffer) {
            const logoId = workbook.addImage({ buffer: logoBuffer, extension: 'png' });
            worksheet.addImage(logoId, {
                tl: { col: col, row: row - 1 },
                br: { col: col + 2, row: row + 2 }
            });
        }
    } catch (error) {
        logger.warn('Could not add logo', { error: error.message });
    }
}

/**
 * Add letterhead lines to worksheet
 */
function addLetterheadLines(worksheet, lines, alignment, startRow, columnCount) {
    let currentRow = startRow;
    lines.forEach((line, index) => {
        const text = typeof line === 'string' ? line : line.text;
        const isFirstLine = index === 0;
        const defaultWeight = isFirstLine ? 'bold' : 'normal';
        const fontWeight = typeof line === 'object' ? line.fontWeight : defaultWeight;

        const cell = worksheet.getRow(currentRow).getCell(1);
        cell.value = text;
        cell.font = fontWeight === 'bold' ? { bold: true, size: 16 } : { size: 12 };
        cell.alignment = { horizontal: alignment };
        worksheet.mergeCells(currentRow, 1, currentRow, columnCount);
        currentRow++;
    });
    return currentRow;
}

/**
 * Get logo buffer from URL or file path
 * @param {string} logoUrl - Logo URL (can be base64 data URL or file path)
 * @returns {Buffer|null}
 */
function getLogoBuffer(logoUrl) {
    if (!logoUrl) return null;
    
    if (logoUrl.startsWith('data:image/')) {
        // Handle base64 data URL
        const base64Data = logoUrl.split(',')[1];
        return Buffer.from(base64Data, 'base64');
    } else {
        // Handle file path
        const logoPath = path.join(process.cwd(), 'public', logoUrl);
        if (fs.existsSync(logoPath)) {
            return fs.readFileSync(logoPath);
        }
    }
    return null;
}

/**
 * Add report title and period to worksheet
 * @param {Object} worksheet - ExcelJS worksheet
 * @param {string} title - Report title
 * @param {string} period - Report period
 * @param {number} startRow - Starting row
 * @param {number} columnCount - Number of columns
 * @returns {number} - Next row number
 */
export function addReportTitle(worksheet, title, period, startRow, columnCount = 11) {
    let currentRow = startRow;
    
    worksheet.getCell(currentRow, 1).value = title;
    worksheet.getCell(currentRow, 1).font = { bold: true, size: 14 };
    worksheet.getCell(currentRow, 1).alignment = { horizontal: 'center' };
    worksheet.mergeCells(currentRow, 1, currentRow, columnCount);
    currentRow++;

    worksheet.getCell(currentRow, 1).value = period;
    worksheet.getCell(currentRow, 1).font = { size: 11 };
    worksheet.getCell(currentRow, 1).alignment = { horizontal: 'center' };
    worksheet.mergeCells(currentRow, 1, currentRow, columnCount);
    currentRow++;

    currentRow++; // Separator
    return currentRow;
}

/**
 * Add headers to worksheet
 * @param {Object} worksheet - ExcelJS worksheet
 * @param {Array} headers - Array of header strings
 * @param {number} row - Row number
 */
export function addHeaders(worksheet, headers, row) {
    headers.forEach((header, index) => {
        worksheet.getCell(row, index + 1).value = header;
        worksheet.getCell(row, index + 1).font = { bold: true };
        worksheet.getCell(row, index + 1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };
        worksheet.getCell(row, index + 1).border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
        };
    });
}

export default {
    addLetterheadToWorksheet,
    addReportTitle,
    addHeaders
};
