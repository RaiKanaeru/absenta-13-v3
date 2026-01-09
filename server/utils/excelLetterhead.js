/**
 * Excel Letterhead Utility
 * Reusable letterhead rendering for Excel exports
 * Extracted from server_modern.js for code reuse
 */

import path from 'path';
import fs from 'fs';
import { createLogger } from './logger.js';

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
    
    if (!letterhead?.enabled || !letterhead?.lines?.length) {
        // Fallback to hardcoded header
        worksheet.getCell('A1').value = 'PEMERINTAH DAERAH PROVINSI JAWA BARAT';
        worksheet.getCell('A2').value = 'DINAS PENDIDIKAN';
        worksheet.getCell('A3').value = 'CABANG DINAS PENDIDIKAN WILAYAH VII';
        worksheet.getCell('A4').value = 'SEKOLAH MENENGAH KEJURUAN NEGERI 13';
        return 6;
    }

    const alignment = letterhead.alignment || 'center';

    // Add logos if available
    if (letterhead.logoLeftUrl || letterhead.logoRightUrl) {
        // Left logo
        if (letterhead.logoLeftUrl) {
            try {
                const logoBuffer = await getLogoBuffer(letterhead.logoLeftUrl);
                if (logoBuffer) {
                    const logoId = workbook.addImage({
                        buffer: logoBuffer,
                        extension: 'png'
                    });
                    worksheet.addImage(logoId, {
                        tl: { col: 0, row: currentRow - 1 },
                        br: { col: 2, row: currentRow + 2 }
                    });
                }
            } catch (error) {
                logger.warn('Could not add left logo', { error: error.message });
            }
        }

        // Right logo
        if (letterhead.logoRightUrl) {
            try {
                const logoBuffer = await getLogoBuffer(letterhead.logoRightUrl);
                if (logoBuffer) {
                    const logoId = workbook.addImage({
                        buffer: logoBuffer,
                        extension: 'png'
                    });
                    const rightCol = Math.max(columnCount - 2, 3);
                    worksheet.addImage(logoId, {
                        tl: { col: rightCol, row: currentRow - 1 },
                        br: { col: rightCol + 2, row: currentRow + 2 }
                    });
                }
            } catch (error) {
                logger.warn('Could not add right logo', { error: error.message });
            }
        }

        currentRow += 4; // Space for logo
    }

    // Add letterhead lines
    letterhead.lines.forEach((line, index) => {
        const lineRow = worksheet.getRow(currentRow);
        const text = typeof line === 'string' ? line : line.text;
        const isFirstLine = index === 0;
        const fontWeight = typeof line === 'object' ? line.fontWeight : (isFirstLine ? 'bold' : 'normal');

        lineRow.getCell(1).value = text;
        lineRow.getCell(1).font = fontWeight === 'bold' 
            ? { bold: true, size: 16 } 
            : { size: 12 };
        lineRow.getCell(1).alignment = { horizontal: alignment };
        worksheet.mergeCells(currentRow, 1, currentRow, columnCount);
        currentRow++;
    });

    currentRow++; // Separator
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
