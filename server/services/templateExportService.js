/**
 * Template Export Service
 * Handles template-based Excel export with preserved formatting and formulas
 * 
 * Guidelines compliance:
 * - Load template .xlsx files from sekolah
 * - Fill data into specific cells only
 * - Preserve formulas, formatting, merges, colors
 */

import ExcelJS from 'exceljs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from '../utils/logger.js';
import { TAHUN_PELAJARAN, HARI_EFEKTIF } from '../config/exportConfig.js';

const logger = createLogger('TemplateExport');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Template directory path
const TEMPLATE_DIR = path.join(__dirname, '../templates/excel');

/**
 * Load an Excel template file
 * @param {string} templateName - Name of template file (e.g., 'REKAP KETIDAKHADIRAN GURU 2025-2026.xlsx')
 * @returns {Promise<ExcelJS.Workbook>} - Loaded workbook
 */
export async function loadTemplate(templateName) {
    const templatePath = path.join(TEMPLATE_DIR, templateName);
    
    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.readFile(templatePath);
        logger.info('Template loaded', { templateName });
        return workbook;
    } catch (error) {
        logger.error('Failed to load template', { templateName, error: error.message });
        throw new Error(`Template file not found: ${templateName}. Please copy template files to server/templates/excel/`);
    }
}

/**
 * Check if template file exists
 * @param {string} templateName - Name of template file
 * @returns {Promise<boolean>}
 */
export async function templateExists(templateName) {
    const templatePath = path.join(TEMPLATE_DIR, templateName);
    try {
        const fs = await import('node:fs/promises');
        await fs.access(templatePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Fill cells in worksheet with data, preserving formulas
 * @param {ExcelJS.Worksheet} worksheet - Target worksheet
 * @param {Array<Object>} data - Array of row data objects
 * @param {Object} mapping - Column mapping configuration
 * @param {number} startRow - Starting row for data (1-indexed)
 */
export function fillCells(worksheet, data, mapping, startRow) {
    const { columns, formulaColumns = [] } = mapping;
    
    data.forEach((rowData, index) => {
        const rowNum = startRow + index;
        
        Object.entries(columns).forEach(([col, dataKey]) => {
            // Skip formula columns - DO NOT OVERWRITE
            if (formulaColumns.includes(col)) {
                return;
            }
            
            const cell = worksheet.getCell(`${col}${rowNum}`);
            const value = rowData[dataKey];
            
            // Set value, use 0 for empty numbers (so formulas work)
            if (value === null || value === undefined) {
                cell.value = typeof rowData[dataKey] === 'number' ? 0 : '';
            } else {
                cell.value = value;
            }
        });
    });
    
    logger.debug('Filled rows', { count: data.length, startRow });
}

/**
 * Clone row style for additional data rows
 * Use this when data exceeds template rows
 * @param {ExcelJS.Worksheet} worksheet - Target worksheet
 * @param {number} sourceRow - Row to clone style from
 * @param {number} targetRow - Row to apply style to
 */
export function cloneRowStyle(worksheet, sourceRow, targetRow) {
    const source = worksheet.getRow(sourceRow);
    const target = worksheet.getRow(targetRow);
    
    source.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const targetCell = target.getCell(colNumber);
        
        // Copy style
        targetCell.style = { ...cell.style };
        
        // Copy number format
        if (cell.numFmt) {
            targetCell.numFmt = cell.numFmt;
        }
    });
    
    // Copy row height
    target.height = source.height;
}

/**
 * Set cell value by address (e.g., 'C5', 'D6')
 * For header metadata like kelas name, wali kelas, etc.
 * @param {ExcelJS.Worksheet} worksheet - Target worksheet
 * @param {string} address - Cell address (e.g., 'C5')
 * @param {*} value - Value to set
 */
export function setCell(worksheet, address, value) {
    const cell = worksheet.getCell(address);
    cell.value = value;
}

/**
 * Generate export buffer from workbook
 * @param {ExcelJS.Workbook} workbook - The workbook to export
 * @returns {Promise<Buffer>} - Excel file buffer
 */
export async function toBuffer(workbook) {
    return await workbook.xlsx.writeBuffer();
}

/**
 * Get list of available templates
 * @returns {Promise<string[]>} - Array of template filenames
 */
export async function listTemplates() {
    try {
        const fs = await import('node:fs/promises');
        const files = await fs.readdir(TEMPLATE_DIR);
        return files.filter(f => f.endsWith('.xlsx'));
    } catch {
        return [];
    }
}

// ================================================
// PRESET MAPPINGS (per guidelines)
// ================================================

export const REKAP_GURU_MAPPING = {
    templateFile: `REKAP KETIDAKHADIRAN GURU ${TAHUN_PELAJARAN}.xlsx`,
    startRow: 8,
    columns: {
        A: 'no',
        B: 'nama',
        C: 'jul', D: 'agt', E: 'sep', F: 'okt', G: 'nov', H: 'des',
        I: 'jan', J: 'feb', K: 'mar', L: 'apr', M: 'mei', N: 'jun'
    },
    formulaColumns: ['O', 'P', 'Q'], // JUMLAH, % TIDAK HADIR, % HADIR
    totalHariEfektif: HARI_EFEKTIF.TAHUNAN
};

export const REKAP_KELAS_GASAL_MAPPING = {
    templateFile: (tingkat) => `REKAP KETIDAKHADIRAN KELAS ${tingkat} ${TAHUN_PELAJARAN}.xlsx`,
    startRow: 11,
    columns: {
        A: 'no',
        B: 'nis',
        C: 'nama',
        D: 'jk', // L/P
        // JULI
        E: 'jul_s', F: 'jul_i', G: 'jul_a',
        // AGUSTUS
        I: 'agt_s', J: 'agt_i', K: 'agt_a',
        // SEPTEMBER
        M: 'sep_s', N: 'sep_i', O: 'sep_a',
        // OKTOBER
        Q: 'okt_s', R: 'okt_i', S: 'okt_a',
        // NOVEMBER
        U: 'nov_s', V: 'nov_i', W: 'nov_a',
        // DESEMBER
        Y: 'des_s', Z: 'des_i', AA: 'des_a'
    },
    formulaColumns: ['H', 'L', 'P', 'T', 'X', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH'],
    totalHariEfektif: HARI_EFEKTIF.GASAL,
    // Header cells to fill
    headerCells: {
        namaKelas: 'C5',
        waliKelas: 'D6'
    }
};

export default {
    loadTemplate,
    templateExists,
    fillCells,
    cloneRowStyle,
    setCell,
    toBuffer,
    listTemplates,
    REKAP_GURU_MAPPING,
    REKAP_KELAS_GASAL_MAPPING,
    TEMPLATE_DIR
};
