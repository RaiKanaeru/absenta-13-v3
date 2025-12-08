import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Build Excel workbook with styled header and data
 * @param {Object} options - Configuration options
 * @param {string} options.title - Main title
 * @param {string} options.subtitle - Subtitle
 * @param {string} options.reportPeriod - Report period string
 * @param {boolean} options.showLetterhead - Whether to show letterhead (deprecated, use letterhead.enabled)
 * @param {Object} options.letterhead - Letterhead configuration
 * @param {string} options.letterhead.logoLeftUrl - URL logo kiri
 * @param {string} options.letterhead.logoRightUrl - URL logo kanan
 * @param {Array} options.letterhead.lines - Array baris teks KOP
 * @param {string} options.letterhead.alignment - Perataan teks (left/center/right)
 * @param {boolean} options.letterhead.enabled - Status aktif KOP
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

    // Set column widths
    columns.forEach((col, index) => {
        worksheet.getColumn(index + 1).width = col.width || 15;
    });

    let currentRow = 1;

    // Letterhead (if enabled)
    const shouldShowLetterhead = letterhead.enabled !== undefined ? letterhead.enabled : showLetterhead;
    if (shouldShowLetterhead && letterhead.lines && letterhead.lines.length > 0) {
        // Render dynamic letterhead
        const alignment = letterhead.alignment || 'center';
        
        console.log('🎨 Rendering letterhead with logos:', {
            logoLeftUrl: letterhead.logoLeftUrl,
            logoRightUrl: letterhead.logoRightUrl,
            enabled: shouldShowLetterhead
        });
        
        // Add logo row if logos are provided
        if (letterhead.logoLeftUrl || letterhead.logoRightUrl) {
            const logoRow = worksheet.getRow(currentRow);
            
            // Logo kiri
            if (letterhead.logoLeftUrl) {
                try {
                    // Convert base64 to buffer if needed
                    let logoBuffer;
                    if (letterhead.logoLeftUrl.startsWith('data:image/')) {
                        // Handle base64 data URL
                        console.log('📸 Logo kiri: Processing base64 data URL');
                        const base64Data = letterhead.logoLeftUrl.split(',')[1];
                        logoBuffer = Buffer.from(base64Data, 'base64');
                    } else {
                        // Handle file path - check multiple possible locations
                        let logoPath;
                        
                        // Remove leading slash for proper path joining
                        const cleanPath = letterhead.logoLeftUrl.replace(/^\/+/, '');
                        
                        // Try different possible paths
                        const possiblePaths = [
                            path.join(process.cwd(), 'public', cleanPath),
                            path.join(process.cwd(), 'dist', cleanPath),
                            path.join(process.cwd(), cleanPath),
                            letterhead.logoLeftUrl
                        ];
                        
                        console.log('📁 Searching for logo kiri in paths:', possiblePaths);
                        
                        for (const testPath of possiblePaths) {
                            if (fs.existsSync(testPath)) {
                                logoPath = testPath;
                                console.log('✅ Logo kiri found at:', logoPath);
                                break;
                            }
                        }
                        
                        if (logoPath && fs.existsSync(logoPath)) {
                            logoBuffer = fs.readFileSync(logoPath);
                            console.log('✅ Logo kiri loaded successfully, size:', logoBuffer.length, 'bytes');
                        } else {
                            console.warn('⚠️ Logo kiri file not found in any path');
                        }
                    }
                    
                    if (logoBuffer) {
                        const logoId = workbook.addImage({
                            buffer: logoBuffer,
                            extension: 'png'
                        });
                        worksheet.addImage(logoId, {
                            tl: { col: 0, row: currentRow - 1 },
                            br: { col: 2, row: currentRow + 2 }
                        });
                        console.log('✅ Logo kiri added to Excel successfully');
                    } else {
                        console.warn('⚠️ Logo kiri tidak ditemukan:', letterhead.logoLeftUrl);
                        // Fallback to text
                        logoRow.getCell(1).value = '[LOGO KIRI]';
                        logoRow.getCell(1).font = { italic: true, size: 10 };
                        logoRow.getCell(1).alignment = { horizontal: 'left' };
                    }
                } catch (error) {
                    console.warn('⚠️ Could not add left logo to Excel:', error.message);
                    console.error(error);
                    // Fallback to text
                    logoRow.getCell(1).value = '[LOGO KIRI]';
                    logoRow.getCell(1).font = { italic: true, size: 10 };
                    logoRow.getCell(1).alignment = { horizontal: 'left' };
                }
            }
            
            // Logo kanan
            if (letterhead.logoRightUrl) {
                try {
                    // Convert base64 to buffer if needed
                    let logoBuffer;
                    if (letterhead.logoRightUrl.startsWith('data:image/')) {
                        // Handle base64 data URL
                        console.log('📸 Logo kanan: Processing base64 data URL');
                        const base64Data = letterhead.logoRightUrl.split(',')[1];
                        logoBuffer = Buffer.from(base64Data, 'base64');
                    } else {
                        // Handle file path - check multiple possible locations
                        let logoPath;
                        
                        // Remove leading slash for proper path joining
                        const cleanPath = letterhead.logoRightUrl.replace(/^\/+/, '');
                        
                        // Try different possible paths
                        const possiblePaths = [
                            path.join(process.cwd(), 'public', cleanPath),
                            path.join(process.cwd(), 'dist', cleanPath),
                            path.join(process.cwd(), cleanPath),
                            letterhead.logoRightUrl
                        ];
                        
                        console.log('📁 Searching for logo kanan in paths:', possiblePaths);
                        
                        for (const testPath of possiblePaths) {
                            if (fs.existsSync(testPath)) {
                                logoPath = testPath;
                                console.log('✅ Logo kanan found at:', logoPath);
                                break;
                            }
                        }
                        
                        if (logoPath && fs.existsSync(logoPath)) {
                            logoBuffer = fs.readFileSync(logoPath);
                            console.log('✅ Logo kanan loaded successfully, size:', logoBuffer.length, 'bytes');
                        } else {
                            console.warn('⚠️ Logo kanan file not found in any path');
                        }
                    }
                    
                    if (logoBuffer) {
                        const logoId = workbook.addImage({
                            buffer: logoBuffer,
                            extension: 'png'
                        });
                        const rightCol = Math.max(columns.length - 1, 3);
                        worksheet.addImage(logoId, {
                            tl: { col: rightCol, row: currentRow - 1 },
                            br: { col: rightCol + 2, row: currentRow + 2 }
                        });
                        console.log('✅ Logo kanan added to Excel successfully at column:', rightCol);
                    } else {
                        console.warn('⚠️ Logo kanan tidak ditemukan:', letterhead.logoRightUrl);
                        // Fallback to text
                        const rightCell = Math.max(columns.length, 3);
                        logoRow.getCell(rightCell).value = '[LOGO KANAN]';
                        logoRow.getCell(rightCell).font = { italic: true, size: 10 };
                        logoRow.getCell(rightCell).alignment = { horizontal: 'right' };
                    }
                } catch (error) {
                    console.warn('⚠️ Could not add right logo to Excel:', error.message);
                    console.error(error);
                    // Fallback to text
                    const rightCell = Math.max(columns.length, 3);
                    logoRow.getCell(rightCell).value = '[LOGO KANAN]';
                    logoRow.getCell(rightCell).font = { italic: true, size: 10 };
                    logoRow.getCell(rightCell).alignment = { horizontal: 'right' };
                }
            }
            
            currentRow += 4; // Space for logo
        }

        // Add letterhead lines
        letterhead.lines.forEach((line, index) => {
            const lineRow = worksheet.getRow(currentRow);
            // Handle both old format (string) and new format (object)
            const text = typeof line === 'string' ? line : line.text;
            const fontWeight = typeof line === 'object' ? line.fontWeight : (index === 0 ? 'bold' : 'normal');
            
            lineRow.getCell(1).value = text;
            
            if (fontWeight === 'bold') {
                lineRow.getCell(1).font = { bold: true, size: 16 };
            } else {
                lineRow.getCell(1).font = { size: 12 };
            }
            
            lineRow.getCell(1).alignment = { horizontal: alignment };
            worksheet.mergeCells(currentRow, 1, currentRow, Math.max(columns.length, 1));
            currentRow++;
        });

        // Separator
        currentRow++;
    } else if (showLetterhead) {
        // Fallback to old hardcoded letterhead for backward compatibility
        const schoolHeader = worksheet.getRow(currentRow);
        schoolHeader.getCell(1).value = 'SMK NEGERI 13 JAKARTA';
        schoolHeader.getCell(1).font = { bold: true, size: 16 };
        schoolHeader.getCell(1).alignment = { horizontal: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, columns.length);
        currentRow++;

        const addressHeader = worksheet.getRow(currentRow);
        addressHeader.getCell(1).value = 'Jl. Raya Bekasi Km. 18, Cakung, Jakarta Timur 13910';
        addressHeader.getCell(1).font = { size: 12 };
        addressHeader.getCell(1).alignment = { horizontal: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, columns.length);
        currentRow++;

        // Separator
        currentRow++;
    }

    // Title
    const titleRow = worksheet.getRow(currentRow);
    titleRow.getCell(1).value = title;
    titleRow.getCell(1).font = { bold: true, size: 14 };
    titleRow.getCell(1).alignment = { horizontal: 'center' };
    worksheet.mergeCells(currentRow, 1, currentRow, columns.length);
    currentRow++;

    // Subtitle
    if (subtitle) {
        const subtitleRow = worksheet.getRow(currentRow);
        subtitleRow.getCell(1).value = subtitle;
        subtitleRow.getCell(1).font = { size: 12 };
        subtitleRow.getCell(1).alignment = { horizontal: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, columns.length);
        currentRow++;
    }

    // Report period
    if (reportPeriod) {
        const periodRow = worksheet.getRow(currentRow);
        periodRow.getCell(1).value = `Periode: ${reportPeriod}`;
        periodRow.getCell(1).font = { size: 11 };
        periodRow.getCell(1).alignment = { horizontal: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, columns.length);
        currentRow++;
    }

    // Separator
    currentRow++;

    // Column headers
    const headerRow = worksheet.getRow(currentRow);
    columns.forEach((col, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = col.label;
        cell.font = { bold: true, size: 11 };
        cell.alignment = { 
            horizontal: col.align || 'left',
            vertical: 'middle'
        };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE6F3FF' }
        };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });
    currentRow++;

    // Data rows
    rows.forEach((row, rowIndex) => {
        const dataRow = worksheet.getRow(currentRow);
        columns.forEach((col, colIndex) => {
            const cell = dataRow.getCell(colIndex + 1);
            let value = row[col.key];

            // Format value based on column format
            if (col.format === 'number') {
                value = Number(value) || 0;
            } else if (col.format === 'percentage') {
                value = Number(value) || 0;
                cell.numFmt = '0.00%';
            } else if (col.format === 'date') {
                if (value) {
                    const date = new Date(value);
                    value = date.toLocaleDateString('id-ID');
                }
            }

            cell.value = value;
            cell.alignment = { 
                horizontal: col.align || 'left',
                vertical: 'middle'
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };

            // Alternate row colors
            if (rowIndex % 2 === 0) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF8F9FA' }
                };
            }
        });
        currentRow++;
    });

    // Auto-fit columns
    columns.forEach((col, index) => {
        const column = worksheet.getColumn(index + 1);
        if (col.width) {
            column.width = col.width;
        } else {
            column.width = 15;
        }
    });

    return workbook;
}

export {
    buildExcel
};
