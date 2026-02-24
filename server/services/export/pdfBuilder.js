/**
 * PDF Builder Module
 * Mirrors the excelBuilder.js API for consistent PDF generation
 * Uses pdfmake with Roboto fonts bundled in node_modules
 */

import pdfmake from 'pdfmake';
import path from 'node:path';
import fs from 'node:fs';
import { getLetterhead } from '../../utils/letterheadService.js';


// ============================================
// FONT CONFIGURATION
// ============================================

const FONT_DIR = path.join(process.cwd(), 'node_modules', 'pdfmake', 'fonts', 'Roboto');

pdfmake.fonts = {
    Roboto: {
        normal: path.join(FONT_DIR, 'Roboto-Regular.ttf'),
        bold: path.join(FONT_DIR, 'Roboto-Medium.ttf'),
        italics: path.join(FONT_DIR, 'Roboto-Italic.ttf'),
        bolditalics: path.join(FONT_DIR, 'Roboto-MediumItalic.ttf')
    }
};

// ============================================
// STYLE CONSTANTS (matching excelStyles.js)
// ============================================

const COLORS = {
    headerBlue: '#1E40AF',
    headerText: '#FFFFFF',
    altRow: '#F3F4F6',
    lightBlue: '#E0E7FF',
    grayText: '#9CA3AF',
    primaryText: '#111827',
    borderColor: '#D1D5DB'
};

const PDF_STYLES = {
    letterheadLine: { fontSize: 12, alignment: 'center' },
    letterheadFirst: { fontSize: 16, bold: true, alignment: 'center' },
    title: { fontSize: 14, bold: true, alignment: 'center', margin: [0, 5, 0, 2] },
    subtitle: { fontSize: 11, alignment: 'center', margin: [0, 0, 0, 2] },
    period: { fontSize: 10, alignment: 'center', margin: [0, 0, 0, 8] },
    tableHeader: {
        bold: true,
        fontSize: 9,
        color: COLORS.headerText,
        fillColor: COLORS.headerBlue,
        alignment: 'center'
    },
    tableCell: { fontSize: 8, color: COLORS.primaryText },
    tableCellCenter: { fontSize: 8, color: COLORS.primaryText, alignment: 'center' },
    tableCellRight: { fontSize: 8, color: COLORS.primaryText, alignment: 'right' },
    footer: { fontSize: 8, italics: true, color: COLORS.grayText, alignment: 'right' }
};

// ============================================
// HELPER FUNCTIONS - Logo Handling
// ============================================

/**
 * Load logo from URL/path and convert to pdfmake image format
 * @param {string} logoUrl - Logo URL (base64 data URL or file path)
 * @returns {string|null} Base64 data URL for pdfmake or null
 */
function loadLogoForPdf(logoUrl) {
    if (!logoUrl) return null;

    // Already a base64 data URL — use directly
    if (logoUrl.startsWith('data:image/')) {
        return logoUrl;
    }

    // File path — resolve and convert to base64
    const cleanPath = logoUrl.replace(/^\/+/, '');
    const possiblePaths = [
        path.join(process.cwd(), 'public', cleanPath),
        path.join(process.cwd(), 'dist', cleanPath),
        path.join(process.cwd(), cleanPath),
        logoUrl
    ];

    for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
            const buffer = fs.readFileSync(testPath);
            const ext = path.extname(testPath).toLowerCase().replace('.', '') || 'png';
            const mime = ext === 'jpg' ? 'jpeg' : ext;
            return `data:image/${mime};base64,${buffer.toString('base64')}`;
        }
    }

    return null;
}

// ============================================
// HELPER FUNCTIONS - Content Building
// ============================================

/**
 * Build letterhead section for PDF document definition
 * @param {Object} letterhead - Letterhead configuration
 * @returns {Array} pdfmake content array for letterhead
 */
function buildLetterheadContent(letterhead) {
    if (!letterhead?.enabled || !letterhead?.lines?.length) return [];

    const content = [];

    // Logo row (table with left logo | text | right logo)
    const leftLogo = loadLogoForPdf(letterhead.logoLeftUrl);
    const rightLogo = loadLogoForPdf(letterhead.logoRightUrl);

    if (leftLogo || rightLogo) {
        const logoTable = {
            table: {
                widths: [60, '*', 60],
                body: [[
                    leftLogo
                        ? { image: leftLogo, width: 50, height: 50, alignment: 'center' }
                        : { text: '', border: [false, false, false, false] },
                    {
                        stack: letterhead.lines.map((line, idx) => {
                            const text = typeof line === 'string' ? line : line.text;
                            const isFirst = idx === 0;
                            return {
                                text,
                                style: isFirst ? 'letterheadFirst' : 'letterheadLine'
                            };
                        }),
                        alignment: letterhead.alignment || 'center',
                        border: [false, false, false, false]
                    },
                    rightLogo
                        ? { image: rightLogo, width: 50, height: 50, alignment: 'center' }
                        : { text: '', border: [false, false, false, false] }
                ]]
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 5]
        };
        content.push(logoTable);
    } else {
        // Text-only letterhead
        letterhead.lines.forEach((line, idx) => {
            const text = typeof line === 'string' ? line : line.text;
            const isFirst = idx === 0;
            content.push({
                text,
                style: isFirst ? 'letterheadFirst' : 'letterheadLine'
            });
        });
    }

    // Separator line
    content.push({
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: COLORS.headerBlue }],
        margin: [0, 5, 0, 10]
    });

    return content;
}

/**
 * Map column alignment from Excel schema to pdfmake alignment
 * @param {string} align - Column alignment ('left', 'center', 'right')
 * @returns {string} pdfmake alignment
 */
function mapAlignment(align) {
    if (align === 'right') return 'right';
    if (align === 'center') return 'center';
    return 'left';
}

/**
 * Calculate column widths for pdfmake from schema columns
 * @param {Array} columns - Column definitions with width
 * @returns {Array} pdfmake width specifications
 */
function calculatePdfWidths(columns) {
    // Convert Excel character widths to proportional pdfmake widths
    const totalWidth = columns.reduce((sum, col) => sum + (col.width || 15), 0);

    return columns.map(col => {
        const excelWidth = col.width || 15;
        // Use '*' for the widest column, fixed for smaller ones
        if (excelWidth >= 25) return '*';
        // Proportional mapping: Excel width -> approximate points
        return Math.max(30, Math.round((excelWidth / totalWidth) * 500));
    });
}

/**
 * Format cell value based on column format spec
 * @param {any} value - Raw cell value
 * @param {Object} col - Column definition
 * @returns {string} Formatted value string
 */
function formatValue(value, col) {
    if (value === null || value === undefined) return '';

    if (col.format === 'number') {
        return String(Number(value) || 0);
    }

    if (col.format === 'percentage') {
        const num = Number(value) || 0;
        // If it's already a decimal (0-1), multiply by 100
        const pct = num <= 1 && num >= 0 ? (num * 100) : num;
        return `${pct.toFixed(2)}%`;
    }

    if (col.format === 'date' && value) {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
            return date.toLocaleDateString('id-ID');
        }
    }

    return String(value);
}

/**
 * Build data table for PDF
 * @param {Array} columns - Column definitions
 * @param {Array} rows - Data rows
 * @returns {Object} pdfmake table definition
 */
function buildDataTable(columns, rows) {
    const widths = calculatePdfWidths(columns);

    // Header row
    const headerRow = columns.map(col => ({
        text: col.label,
        style: 'tableHeader',
        alignment: 'center'
    }));

    // Data rows
    const dataRows = rows.map((row, rowIdx) => {
        return columns.map(col => {
            const value = row[col.key];
            const formatted = formatValue(value, col);
            return {
                text: formatted,
                style: 'tableCell',
                alignment: mapAlignment(col.align),
                fillColor: rowIdx % 2 === 0 ? COLORS.altRow : null
            };
        });
    });

    return {
        table: {
            headerRows: 1,
            widths,
            body: [headerRow, ...dataRows]
        },
        layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => COLORS.borderColor,
            vLineColor: () => COLORS.borderColor,
            paddingLeft: () => 4,
            paddingRight: () => 4,
            paddingTop: () => 3,
            paddingBottom: () => 3
        }
    };
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

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Build PDF buffer with styled header and data
 * Mirrors the buildExcel() API from excelBuilder.js
 *
 * @param {Object} options - Configuration options
 * @param {string} options.title - Main title
 * @param {string} [options.subtitle] - Subtitle
 * @param {string} [options.reportPeriod] - Report period string
 * @param {boolean} [options.showLetterhead=false] - Whether to show letterhead
 * @param {Object} [options.letterhead={}] - Letterhead configuration
 * @param {Array} options.columns - Column definitions [{key, label, width, align, format}]
 * @param {Array} options.rows - Data rows
 * @param {string} [options.orientation='portrait'] - Page orientation ('portrait' or 'landscape')
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function buildPdf(options) {
    const {
        title,
        subtitle,
        reportPeriod,
        showLetterhead = false,
        letterhead = {},
        columns = [],
        rows = [],
        orientation = 'portrait'
    } = options;

    // Determine letterhead visibility and fetch from DB if needed
    let activeLetterhead = letterhead;
    const shouldShowLetterhead = letterhead.enabled ?? showLetterhead;
    let hasLetterheadLines = letterhead.lines?.length > 0;

    if (shouldShowLetterhead && !hasLetterheadLines) {
        try {
            activeLetterhead = await getLetterhead({ reportKey: null });
            hasLetterheadLines = activeLetterhead?.lines?.length > 0;
        } catch (error) {
            console.warn('Could not fetch letterhead from database:', error.message);
        }
    }

    // Build content array
    const content = [];

    // 1. Letterhead
    if (shouldShowLetterhead && hasLetterheadLines && activeLetterhead) {
        content.push(...buildLetterheadContent(activeLetterhead));
    }

    // 2. Title
    content.push({ text: title, style: 'title' });

    // 3. Subtitle
    if (subtitle) {
        content.push({ text: subtitle, style: 'subtitle' });
    }

    // 4. Report period
    if (reportPeriod) {
        content.push({ text: `Periode: ${reportPeriod}`, style: 'period' });
    }

    // 5. Data table
    if (columns.length > 0) {
        content.push(buildDataTable(columns, rows));
    }

    // 6. Footer info
    const printDate = formatIndonesianDate(new Date());
    content.push({
        text: `Dicetak oleh Sistem Absenta13, ${printDate}`,
        style: 'footer',
        margin: [0, 15, 0, 0]
    });

    // Build document definition
    const docDefinition = {
        pageSize: 'A4',
        pageOrientation: orientation,
        pageMargins: [40, 40, 40, 40],
        content,
        styles: PDF_STYLES,
        defaultStyle: {
            font: 'Roboto',
            fontSize: 10
        },
        footer: (currentPage, pageCount) => ({
            text: `Halaman ${currentPage} dari ${pageCount}`,
            alignment: 'center',
            fontSize: 8,
            color: COLORS.grayText,
            margin: [0, 0, 0, 10]
        }),
        info: {
            title: title || 'Laporan Absenta13',
            author: 'Sistem Absenta13',
            subject: subtitle || 'Laporan',
            creator: 'Absenta13 PDF Builder'
        }
    };

    // Generate PDF buffer
    const pdfDoc = pdfmake.createPdf(docDefinition);
    const buffer = await pdfDoc.getBuffer();

    return buffer;
}

export {
    buildPdf,
    buildLetterheadContent,
    buildDataTable,
    formatValue,
    loadLogoForPdf,
    COLORS as PDF_COLORS,
    PDF_STYLES
};
