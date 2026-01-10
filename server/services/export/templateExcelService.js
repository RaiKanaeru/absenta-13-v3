/**
 * Template-Based Excel Export Service
 * 
 * PRINSIP UTAMA:
 * - Load template .xlsx yang sudah ada dari sekolah
 * - Isi HANYA cell input (data siswa/guru)
 * - JANGAN overwrite cell yang berisi rumus
 * - Preserve semua formatting, merge, border, warna
 */

import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import {
    TAHUN_PELAJARAN,
    HARI_EFEKTIF,
    BULAN_GASAL,
    BULAN_TAHUNAN,
    TEMPLATE_PATHS,
    REKAP_KELAS_MAPPING,
    REKAP_GURU_MAPPING,
    getTemplatePathByTingkat,
    extractTingkatFromKelas
} from '../../config/exportConfig.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('TemplateExcel');

// ================================================
// HELPER FUNCTIONS
// ================================================

/**
 * Load template Excel dari file
 * @param {string} templatePath - Path ke template .xlsx
 * @returns {Promise<ExcelJS.Workbook>}
 */
async function loadTemplate(templatePath) {
    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template tidak ditemukan: ${templatePath}`);
    }
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    
    logger.info('Template loaded', { templatePath: path.basename(templatePath) });
    logger.debug('Sheets found', { sheets: workbook.worksheets.map(ws => ws.name) });
    
    return workbook;
}

/**
 * Find sheet by class name (fuzzy match)
 * @param {ExcelJS.Workbook} workbook
 * @param {string} namaKelas - Contoh: "XII RPL 1"
 * @returns {ExcelJS.Worksheet}
 */
function findSheetByClassName(workbook, namaKelas) {
    // Try exact match first
    let sheet = workbook.getWorksheet(namaKelas);
    if (sheet) return sheet;
    
    // Try partial match (e.g., "RPL 1" for "XII RPL 1")
    const parts = namaKelas.split(' ');
    if (parts.length >= 2) {
        const shortName = parts.slice(1).join(' '); // "RPL 1"
        sheet = workbook.getWorksheet(shortName);
        if (sheet) return sheet;
    }
    
    // Try finding sheet that contains the class name
    for (const ws of workbook.worksheets) {
        if (ws.name.includes(namaKelas) || namaKelas.includes(ws.name)) {
            return ws;
        }
    }
    
    throw new Error(`Sheet untuk kelas "${namaKelas}" tidak ditemukan dalam template`);
}

/**
 * Set cell value tanpa menghapus formatting
 * @param {ExcelJS.Worksheet} sheet
 * @param {string} cellAddress - e.g., "A1" or "D6"
 * @param {any} value
 */
function setCellValue(sheet, cellAddress, value) {
    const cell = sheet.getCell(cellAddress);
    cell.value = value;
}

/**
 * Set cell value by row and column
 * @param {ExcelJS.Worksheet} sheet
 * @param {number} row - 1-indexed
 * @param {string} col - Column letter (A, B, C, ...)
 * @param {any} value
 */
function setCellByRowCol(sheet, row, col, value) {
    const cell = sheet.getCell(`${col}${row}`);
    // Only set if cell doesn't have a formula
    if (!cell.formula) {
        cell.value = value;
    }
}

// ================================================
// REKAP KELAS GASAL EXPORT
// ================================================

/**
 * Export Rekap Ketidakhadiran Kelas Semester Gasal
 * 
 * @param {Object} params
 * @param {string} params.namaKelas - Contoh: "XII RPL 1"
 * @param {string} params.waliKelas - Nama wali kelas
 * @param {Array} params.siswaData - Array of { nis, nama, jenisKelamin, ketidakhadiran: { JULI: {S,I,A}, ... } }
 * @returns {Promise<Buffer>} - Excel file buffer
 */
export async function exportRekapKelasGasal({ namaKelas, waliKelas, siswaData }) {
    logger.info('Generating rekap kelas gasal', { namaKelas });
    
    // Get template based on tingkat
    const tingkat = extractTingkatFromKelas(namaKelas);
    if (!tingkat) {
        throw new Error(`Tidak dapat menentukan tingkat dari nama kelas: ${namaKelas}`);
    }
    
    const templatePath = getTemplatePathByTingkat(tingkat);
    const workbook = await loadTemplate(templatePath);
    
    // Find the correct sheet for this class
    const sheet = findSheetByClassName(workbook, namaKelas);
    logger.debug('Using sheet', { sheetName: sheet.name });
    
    // Fill wali kelas
    if (waliKelas) {
        setCellValue(sheet, REKAP_KELAS_MAPPING.HEADER.WALI_KELAS_CELL, waliKelas);
    }
    
    // Fill student data
    const { DATA_START_ROW, KOLOM_IDENTITAS, KOLOM_BULAN } = REKAP_KELAS_MAPPING;
    
    siswaData.forEach((siswa, index) => {
        const row = DATA_START_ROW + index;
        
        // Identitas siswa
        setCellByRowCol(sheet, row, KOLOM_IDENTITAS.NO, index + 1);
        setCellByRowCol(sheet, row, KOLOM_IDENTITAS.NIS, siswa.nis || '');
        setCellByRowCol(sheet, row, KOLOM_IDENTITAS.NAMA, siswa.nama || '');
        setCellByRowCol(sheet, row, KOLOM_IDENTITAS.LP, siswa.jenisKelamin || '');
        
        // Ketidakhadiran per bulan
        for (const bulan of BULAN_GASAL) {
            const bulanData = siswa.ketidakhadiran?.[bulan] || { S: 0, I: 0, A: 0 };
            const kolom = KOLOM_BULAN[bulan];
            
            if (kolom) {
                setCellByRowCol(sheet, row, kolom.S, bulanData.S || 0);
                setCellByRowCol(sheet, row, kolom.I, bulanData.I || 0);
                setCellByRowCol(sheet, row, kolom.A, bulanData.A || 0);
            }
        }
    });
    
    logger.info('Filled students data', { count: siswaData.length });
    
    // Return as buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
}

// ================================================
// REKAP GURU TAHUNAN EXPORT
// ================================================

/**
 * Export Rekap Ketidakhadiran Guru Tahunan
 * 
 * @param {Object} params
 * @param {Array} params.guruData - Array of { nama, ketidakhadiran: { JULI: 0, AGUSTUS: 0, ... } }
 * @returns {Promise<Buffer>} - Excel file buffer
 */
export async function exportRekapGuruTahunan({ guruData }) {
    logger.info('Generating rekap guru tahunan');
    
    const workbook = await loadTemplate(TEMPLATE_PATHS.REKAP_GURU);
    
    // Use first sheet (should be the main data sheet)
    const sheet = workbook.worksheets[0];
    logger.debug('Using sheet', { sheetName: sheet.name });
    
    const { DATA_START_ROW, KOLOM_IDENTITAS, KOLOM_BULAN } = REKAP_GURU_MAPPING;
    
    // Fill guru data
    guruData.forEach((guru, index) => {
        const row = DATA_START_ROW + index;
        
        // Identitas
        setCellByRowCol(sheet, row, KOLOM_IDENTITAS.NO, index + 1);
        setCellByRowCol(sheet, row, KOLOM_IDENTITAS.NAMA, guru.nama || '');
        
        // Ketidakhadiran per bulan
        for (const bulan of BULAN_TAHUNAN) {
            const kolom = KOLOM_BULAN[bulan];
            if (kolom) {
                const jumlah = guru.ketidakhadiran?.[bulan] || 0;
                setCellByRowCol(sheet, row, kolom, jumlah);
            }
        }
    });
    
    logger.info('Filled teachers data', { count: guruData.length });
    
    // Return as buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
}

// ================================================
// DATA FETCHING HELPERS
// ================================================

/**
 * Fetch rekap ketidakhadiran siswa per kelas dari database
 * @param {Object} dbPool - Database connection pool
 * @param {string} kelasId - ID kelas
 * @param {string} semester - 'gasal' atau 'genap'
 * @param {string} tahunAjaran - e.g., "2025-2026"
 * @returns {Promise<Array>}
 */
export async function fetchRekapSiswaByKelas(dbPool, kelasId, semester = 'gasal', tahunAjaran = TAHUN_PELAJARAN) {
    const { startDate, endDate } = getSemesterDateRange(tahunAjaran, semester);
    logger.debug('Fetching data for period', { startDate, endDate });
    
    const query = `
        SELECT 
            s.id_siswa,
            s.nis,
            s.nama,
            s.jenis_kelamin,
            MONTH(a.waktu_absen) AS bulan,
            a.status,
            COUNT(*) AS jumlah
        FROM siswa s
        LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
            AND DATE(a.waktu_absen) BETWEEN ? AND ?
            AND a.status IN ('Sakit', 'S', 'Izin', 'I', 'Alpha', 'Alpa', 'A')
        WHERE s.kelas_id = ? AND s.status = 'aktif'
        GROUP BY s.id_siswa, s.nis, s.nama, s.jenis_kelamin, MONTH(a.waktu_absen), a.status
        ORDER BY s.nama
    `;
    
    const [rows] = await dbPool.execute(query, [startDate, endDate, kelasId]);
    return transformSiswaRows(rows);
}

function getSemesterDateRange(tahunAjaran, semester) {
    const [tahunAwal, tahunAkhir] = tahunAjaran.split('-');
    
    if (semester === 'gasal') {
        return { startDate: `${tahunAwal}-07-01`, endDate: `${tahunAwal}-12-31` };
    }
    return { startDate: `${tahunAkhir}-01-01`, endDate: `${tahunAkhir}-06-30` };
}

const BULAN_NAMES = ['', 'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 
                     'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];

function transformSiswaRows(rows) {
    const siswaMap = new Map();
    
    for (const row of rows) {
        if (!siswaMap.has(row.id_siswa)) {
            siswaMap.set(row.id_siswa, {
                nis: row.nis,
                nama: row.nama,
                jenisKelamin: row.jenis_kelamin === 'L' ? 'L' : 'P',
                ketidakhadiran: {}
            });
        }
        
        processKetidakhadiranRow(row, siswaMap.get(row.id_siswa));
    }
    
    return Array.from(siswaMap.values());
}

function processKetidakhadiranRow(row, siswa) {
    const bulanName = BULAN_NAMES[row.bulan];
    if (!bulanName || !row.status) return;
    
    if (!siswa.ketidakhadiran[bulanName]) {
        siswa.ketidakhadiran[bulanName] = { S: 0, I: 0, A: 0 };
    }
    
    const statusKey = mapStatusToKey(row.status);
    if (statusKey) {
        siswa.ketidakhadiran[bulanName][statusKey] += row.jumlah;
    }
}

function mapStatusToKey(status) {
    const first = status.toUpperCase().charAt(0);
    if (first === 'S') return 'S';
    if (first === 'I') return 'I';
    if (first === 'A') return 'A';
    return null;
}

/**
 * Fetch rekap ketidakhadiran guru dari database
 * @param {Object} dbPool - Database connection pool
 * @param {string} tahunAjaran - e.g., "2025-2026"
 * @returns {Promise<Array>}
 */
export async function fetchRekapGuru(dbPool, tahunAjaran = TAHUN_PELAJARAN) {
    const [tahunAwal, tahunAkhir] = tahunAjaran.split('-');
    const startDate = `${tahunAwal}-07-01`;
    const endDate = `${tahunAkhir}-06-30`;
    
    logger.debug('Fetching guru data for period', { startDate, endDate });
    
    const query = `
        SELECT 
            g.id_guru,
            g.nama,
            MONTH(ag.tanggal) AS bulan,
            YEAR(ag.tanggal) AS tahun,
            COUNT(*) AS jumlah
        FROM guru g
        LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id 
            AND ag.tanggal BETWEEN ? AND ?
            AND ag.status IN ('Tidak Hadir', 'Sakit', 'Izin', 'Alpha')
        WHERE g.status = 'aktif'
        GROUP BY g.id_guru, g.nama, MONTH(ag.tanggal), YEAR(ag.tanggal)
        ORDER BY g.nama
    `;
    
    const [rows] = await dbPool.execute(query, [startDate, endDate]);
    
    // Transform to required format
    const guruMap = new Map();
    
    for (const row of rows) {
        if (!guruMap.has(row.id_guru)) {
            guruMap.set(row.id_guru, {
                nama: row.nama,
                ketidakhadiran: {}
            });
        }
        
        const bulanNames = ['', 'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
                           'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
        const bulanName = bulanNames[row.bulan];
        
        if (bulanName) {
            const guru = guruMap.get(row.id_guru);
            guru.ketidakhadiran[bulanName] = (guru.ketidakhadiran[bulanName] || 0) + row.jumlah;
        }
    }
    
    return Array.from(guruMap.values());
}

/**
 * Get wali kelas for a class
 * @param {Object} dbPool
 * @param {string} kelasId
 * @returns {Promise<string>}
 */
export async function getWaliKelas(dbPool, kelasId) {
    try {
        const [rows] = await dbPool.execute(
            `SELECT g.nama FROM guru g 
             JOIN kelas k ON k.wali_kelas_id = g.id_guru 
             WHERE k.id_kelas = ?`,
            [kelasId]
        );
        return rows[0]?.nama || '';
    } catch (error) {
        logger.warn('Could not fetch wali kelas', { error: error.message });
        return '';
    }
}

/**
 * Get class info
 * @param {Object} dbPool
 * @param {string} kelasId
 * @returns {Promise<Object>}
 */
export async function getKelasInfo(dbPool, kelasId) {
    const [rows] = await dbPool.execute(
        `SELECT id_kelas, nama_kelas, tingkat FROM kelas WHERE id_kelas = ?`,
        [kelasId]
    );
    return rows[0] || null;
}

// ================================================
// REKAP GURU MINGGUAN EXPORT
// ================================================

/**
 * Export Rekap Jadwal Guru Mingguan
 * Menampilkan guru yang hadir per hari (SENIN-JUMAT)
 * 
 * @param {Object} params
 * @param {Array} params.guruData - Array of { no, nama, kode, namaSingkat, jadwal: { SENIN: true, ... } }
 * @returns {Promise<Buffer>} - Excel file buffer
 */
export async function exportRekapGuruMingguan({ guruData }) {
    logger.info('Generating rekap guru mingguan');
    
    // Create new workbook (simpler than loading template for this format)
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.default.Workbook();
    const sheet = workbook.addWorksheet('REKAP JADWAL GURU');
    
    // Header styling
    const headerStyle = {
        font: { bold: true, color: { argb: 'FF000000' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90EE90' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        }
    };
    
    // Title
    sheet.mergeCells('A1:I1');
    sheet.getCell('A1').value = 'REKAP JADWAL GURU - MINGGUAN';
    sheet.getCell('A1').font = { bold: true, size: 14 };
    sheet.getCell('A1').alignment = { horizontal: 'center' };
    
    sheet.mergeCells('A2:I2');
    sheet.getCell('A2').value = `TAHUN PELAJARAN ${TAHUN_PELAJARAN}`;
    sheet.getCell('A2').alignment = { horizontal: 'center' };
    
    // Headers
    const headers = ['NO', 'NAMA GURU', 'KODE', '', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT'];
    const headerRow = sheet.getRow(4);
    headers.forEach((h, i) => {
        headerRow.getCell(i + 1).value = h;
        Object.assign(headerRow.getCell(i + 1), headerStyle);
    });
    
    // Column widths
    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 35;
    sheet.getColumn(3).width = 8;
    sheet.getColumn(4).width = 12;
    sheet.getColumn(5).width = 10;
    sheet.getColumn(6).width = 10;
    sheet.getColumn(7).width = 10;
    sheet.getColumn(8).width = 10;
    sheet.getColumn(9).width = 10;
    
    // Data rows
    guruData.forEach((guru, index) => {
        const row = sheet.getRow(5 + index);
        row.getCell(1).value = index + 1;
        row.getCell(2).value = guru.nama || '';
        row.getCell(3).value = guru.kode || `G${index + 1}`;
        row.getCell(4).value = guru.namaSingkat || '';
        row.getCell(5).value = guru.jadwal?.SENIN ? 'ADA' : '';
        row.getCell(6).value = guru.jadwal?.SELASA ? 'ADA' : '';
        row.getCell(7).value = guru.jadwal?.RABU ? 'ADA' : '';
        row.getCell(8).value = guru.jadwal?.KAMIS ? 'ADA' : '';
        row.getCell(9).value = guru.jadwal?.JUMAT ? 'ADA' : '';
        
        // Apply borders
        for (let i = 1; i <= 9; i++) {
            row.getCell(i).border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            row.getCell(i).alignment = { horizontal: 'center', vertical: 'middle' };
        }
        row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    });
    
    logger.info('Filled teachers schedule', { count: guruData.length });
    
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
}

// ================================================
// JADWAL PELAJARAN EXPORT (Complex Format - Exact Template Match)
// ================================================

// Time slots for jadwal (10 jam pelajaran per hari)
const JAM_PELAJARAN = [
    { jam: 1, mulai: '06:30', selesai: '07:15' },
    { jam: 2, mulai: '07:15', selesai: '08:00' },
    { jam: 3, mulai: '08:00', selesai: '08:45' },
    { jam: 4, mulai: '08:45', selesai: '09:30' },
    { jam: 5, mulai: '09:45', selesai: '10:30' },
    { jam: 6, mulai: '10:30', selesai: '11:15' },
    { jam: 7, mulai: '11:15', selesai: '12:00' },
    { jam: 8, mulai: '12:00', selesai: '12:45' },
    { jam: 9, mulai: '13:00', selesai: '13:45' },
    { jam: 10, mulai: '13:45', selesai: '14:30' }
];

const HARI_LIST = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];

// Color palette for mapel (ARGB format) - matching school template colors
const MAPEL_COLORS = {
    default: [
        'FFFF6B6B', // Red
        'FF4ECDC4', // Teal  
        'FF45B7D1', // Blue
        'FFFFD93D', // Yellow
        'FF95E1D3', // Mint
        'FFF38181', // Coral
        'FFAA96DA', // Purple
        'FFFCBAD3', // Pink
        'FFA8D8EA', // Sky Blue
        'FFFF9A8B', // Peach
        'FF88D8B0', // Green
        'FFFFCC5C', // Orange
        'FF96CEB4', // Sage
        'FFFFEAA7', // Light Yellow
        'FF00FF00', // Lime
        'FFFF00FF', // Magenta
        'FF00FFFF', // Cyan
        'FFFFB6C1', // Light Pink
    ]
};

// Map to store consistent colors per mapel
const mapelColorCache = new Map();

function getMapelColor(mapelId, mapelName) {
    if (!mapelId) return 'FFFFFFFF'; // White for empty
    
    if (!mapelColorCache.has(mapelId)) {
        const colorIndex = mapelColorCache.size % MAPEL_COLORS.default.length;
        mapelColorCache.set(mapelId, MAPEL_COLORS.default[colorIndex]);
    }
    return mapelColorCache.get(mapelId);
}

/**
 * Export Jadwal Pelajaran - Complex Format (Exact Template Match)
 * Format: Time slots header, 3 rows per kelas (MAPEL, RUANG, GURU), colorful cells
 * 
 * @param {Object} params
 * @param {Array} params.jadwalData - Data jadwal dari DB
 * @returns {Promise<Buffer>} - Excel file buffer
 */
export async function exportJadwalPelajaranComplex({ jadwalData }) {
    logger.info('Generating complex jadwal', { count: jadwalData?.length || 0 });
    
    mapelColorCache.clear();
    
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.default.Workbook();
    const sheet = workbook.addWorksheet('JADWAL');
    
    const styles = getJadwalStyles();
    const totalJamPerHari = JAM_PELAJARAN.length;
    const startDataCol = 3;
    
    setupJadwalColumnWidths(sheet, startDataCol, totalJamPerHari);
    buildJadwalHeaders(sheet, styles, startDataCol, totalJamPerHari);
    
    const jadwalByKelas = groupJadwalByKelas(jadwalData);
    const sortedKelas = Array.from(jadwalByKelas.keys()).sort();
    
    let currentRow = 4;
    for (const kelasName of sortedKelas) {
        fillKelasData(sheet, kelasName, jadwalByKelas.get(kelasName), currentRow, startDataCol, totalJamPerHari, styles.cellStyle);
        currentRow += 3;
    }
    
    if (sortedKelas.length === 0) {
        sheet.getCell(4, 1).value = 'Tidak ada data jadwal';
        sheet.mergeCells('A4:G4');
    }
    
    logger.info('Generated complex jadwal', { classCount: sortedKelas.length });
    return workbook.xlsx.writeBuffer();
}

function getJadwalStyles() {
    return {
        headerStyle: {
            font: { bold: true, size: 8, color: { argb: 'FF000000' } },
            alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
            border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90EE90' } }
        },
        cellStyle: {
            font: { size: 7 },
            alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
            border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
        }
    };
}

function setupJadwalColumnWidths(sheet, startDataCol, totalJamPerHari) {
    sheet.getColumn(1).width = 10;
    sheet.getColumn(2).width = 8;
    for (let i = startDataCol; i <= startDataCol + (HARI_LIST.length * totalJamPerHari); i++) {
        sheet.getColumn(i).width = 6;
    }
}

function buildJadwalHeaders(sheet, styles, startDataCol, totalJamPerHari) {
    buildHariHeader(sheet, styles.headerStyle, startDataCol, totalJamPerHari);
    buildJamKeHeader(sheet, styles.headerStyle, startDataCol, totalJamPerHari);
    buildWaktuHeader(sheet, styles.headerStyle, startDataCol, totalJamPerHari);
}

function buildHariHeader(sheet, headerStyle, startDataCol, totalJamPerHari) {
    let colOffset = startDataCol;
    for (const hari of HARI_LIST) {
        sheet.mergeCells(1, colOffset, 1, colOffset + totalJamPerHari - 1);
        const cell = sheet.getCell(1, colOffset);
        cell.value = hari;
        Object.assign(cell, headerStyle);
        colOffset += totalJamPerHari;
    }
    sheet.getRow(1).height = 18;
}

function buildJamKeHeader(sheet, headerStyle, startDataCol, totalJamPerHari) {
    sheet.getCell(2, 1).value = 'KELAS';
    Object.assign(sheet.getCell(2, 1), headerStyle);
    sheet.getCell(2, 2).value = 'JAM KE';
    Object.assign(sheet.getCell(2, 2), headerStyle);
    
    let colOffset = startDataCol;
    for (const hari of HARI_LIST) {
        for (let j = 0; j < totalJamPerHari; j++) {
            const cell = sheet.getCell(2, colOffset + j);
            cell.value = j + 1;
            Object.assign(cell, headerStyle);
        }
        colOffset += totalJamPerHari;
    }
    sheet.getRow(2).height = 15;
}

function buildWaktuHeader(sheet, headerStyle, startDataCol, totalJamPerHari) {
    sheet.getCell(3, 2).value = 'WAKTU';
    Object.assign(sheet.getCell(3, 2), headerStyle);
    
    let colOffset = startDataCol;
    for (const hari of HARI_LIST) {
        for (let j = 0; j < totalJamPerHari; j++) {
            const cell = sheet.getCell(3, colOffset + j);
            cell.value = `${JAM_PELAJARAN[j].mulai}-${JAM_PELAJARAN[j].selesai}`;
            cell.font = { size: 6 };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = headerStyle.border;
        }
        colOffset += totalJamPerHari;
    }
    sheet.getRow(3).height = 20;
}

function groupJadwalByKelas(jadwalData) {
    const jadwalByKelas = new Map();
    if (jadwalData && jadwalData.length > 0) {
        for (const j of jadwalData) {
            const kelasKey = j.nama_kelas || `Kelas ${j.kelas_id}`;
            if (!jadwalByKelas.has(kelasKey)) jadwalByKelas.set(kelasKey, []);
            jadwalByKelas.get(kelasKey).push(j);
        }
    }
    return jadwalByKelas;
}

function fillKelasData(sheet, kelasName, kelasJadwal, currentRow, startDataCol, totalJamPerHari, cellStyle) {
    const jadwalLookup = buildJadwalLookup(kelasJadwal);
    
    setupKelasLabels(sheet, kelasName, currentRow, cellStyle);
    fillJadwalCells(sheet, jadwalLookup, currentRow, startDataCol, totalJamPerHari, cellStyle);
    
    sheet.getRow(currentRow).height = 15;
    sheet.getRow(currentRow + 1).height = 12;
    sheet.getRow(currentRow + 2).height = 12;
}

function buildJadwalLookup(kelasJadwal) {
    const lookup = {};
    for (const hari of HARI_LIST) lookup[hari] = {};
    for (const j of kelasJadwal) {
        const hari = (j.hari || '').toUpperCase();
        if (lookup[hari]) lookup[hari][j.jam_ke || 1] = j;
    }
    return lookup;
}

function setupKelasLabels(sheet, kelasName, currentRow, cellStyle) {
    sheet.mergeCells(currentRow, 1, currentRow + 2, 1);
    const kelasCell = sheet.getCell(currentRow, 1);
    kelasCell.value = kelasName;
    kelasCell.font = { bold: true, size: 8 };
    kelasCell.alignment = { horizontal: 'center', vertical: 'middle' };
    kelasCell.border = cellStyle.border;
    
    ['MAPEL', 'RUANG', 'GURU'].forEach((label, idx) => {
        const cell = sheet.getCell(currentRow + idx, 2);
        cell.value = label;
        Object.assign(cell, cellStyle);
        cell.font = { bold: true, size: 7 };
    });
}

function fillJadwalCells(sheet, jadwalLookup, currentRow, startDataCol, totalJamPerHari, cellStyle) {
    let colOffset = startDataCol;
    for (const hari of HARI_LIST) {
        for (let j = 0; j < totalJamPerHari; j++) {
            const jadwal = jadwalLookup[hari][j + 1];
            const cells = [
                sheet.getCell(currentRow, colOffset + j),
                sheet.getCell(currentRow + 1, colOffset + j),
                sheet.getCell(currentRow + 2, colOffset + j)
            ];
            
            if (jadwal) {
                const color = getMapelColor(jadwal.mapel_id, jadwal.nama_mapel);
                cells[0].value = jadwal.kode_mapel || jadwal.nama_mapel?.substring(0, 6) || '-';
                cells[1].value = jadwal.nama_ruang?.substring(0, 6) || '-';
                cells[2].value = jadwal.nama_guru?.split(' ')[0] || '-';
                cells.forEach(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }; });
            }
            
            cells.forEach(c => {
                c.font = { size: 6 };
                c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                c.border = cellStyle.border;
            });
        }
        colOffset += totalJamPerHari;
    }
}


/**
 * Fetch jadwal lengkap dari database untuk export
 * @param {Object} dbPool
 * @returns {Promise<Array>}
 */
export async function fetchJadwalForExport(dbPool) {
    const query = `
        SELECT 
            j.id_jadwal,
            j.kelas_id,
            j.mapel_id,
            j.guru_id,
            j.hari,
            j.jam_ke,
            TIME_FORMAT(j.jam_mulai, '%H:%i') as jam_mulai,
            TIME_FORMAT(j.jam_selesai, '%H:%i') as jam_selesai,
            j.jenis_aktivitas,
            j.keterangan_khusus,
            k.nama_kelas,
            m.nama_mapel,
            m.kode_mapel,
            g.nama as nama_guru,
            r.nama_ruang
        FROM jadwal j
        LEFT JOIN kelas k ON j.kelas_id = k.id_kelas
        LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
        LEFT JOIN guru g ON j.guru_id = g.id_guru
        LEFT JOIN ruang_kelas r ON j.ruang_id = r.id_ruang
        WHERE j.status = 'aktif'
        ORDER BY k.nama_kelas, 
            FIELD(j.hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'),
            j.jam_ke
    `;
    
    const [rows] = await dbPool.execute(query);
    logger.debug('Fetched jadwal items for export', { count: rows.length });
    return rows;
}

/**
 * Fetch guru jadwal mingguan dari database
 * @param {Object} dbPool
 * @returns {Promise<Array>}
 */
export async function fetchGuruJadwalMingguan(dbPool) {
    const query = `
        SELECT 
            g.id_guru,
            g.nama,
            g.nip,
            SUBSTRING(g.nama, 1, 10) as nama_singkat,
            GROUP_CONCAT(DISTINCT j.hari SEPARATOR ',') as hari_mengajar
        FROM guru g
        LEFT JOIN jadwal j ON g.id_guru = j.guru_id AND j.status = 'aktif'
        WHERE g.status = 'aktif'
        GROUP BY g.id_guru, g.nama, g.nip
        ORDER BY g.nama
    `;
    
    const [rows] = await dbPool.execute(query);
    
    return rows.map((row, index) => {
        const hariArray = (row.hari_mengajar || '').split(',');
        return {
            no: index + 1,
            nama: row.nama,
            kode: `G${index + 1}`,
            namaSingkat: row.nama_singkat,
            jadwal: {
                SENIN: hariArray.includes('Senin'),
                SELASA: hariArray.includes('Selasa'),
                RABU: hariArray.includes('Rabu'),
                KAMIS: hariArray.includes('Kamis'),
                JUMAT: hariArray.includes('Jumat')
            }
        };
    });
}

export default {
    loadTemplate,
    findSheetByClassName,
    exportRekapKelasGasal,
    exportRekapGuruTahunan,
    exportRekapGuruMingguan,
    exportJadwalPelajaranComplex,
    fetchRekapSiswaByKelas,
    fetchRekapGuru,
    fetchGuruJadwalMingguan,
    fetchJadwalForExport,
    getWaliKelas,
    getKelasInfo
};


