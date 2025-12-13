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
    
    console.log(`📂 Template loaded: ${path.basename(templatePath)}`);
    console.log(`📊 Sheets found: ${workbook.worksheets.map(ws => ws.name).join(', ')}`);
    
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
    console.log(`📊 Generating rekap kelas gasal for: ${namaKelas}`);
    
    // Get template based on tingkat
    const tingkat = extractTingkatFromKelas(namaKelas);
    if (!tingkat) {
        throw new Error(`Tidak dapat menentukan tingkat dari nama kelas: ${namaKelas}`);
    }
    
    const templatePath = getTemplatePathByTingkat(tingkat);
    const workbook = await loadTemplate(templatePath);
    
    // Find the correct sheet for this class
    const sheet = findSheetByClassName(workbook, namaKelas);
    console.log(`📄 Using sheet: ${sheet.name}`);
    
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
    
    console.log(`✅ Filled ${siswaData.length} students data`);
    
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
    console.log(`📊 Generating rekap guru tahunan`);
    
    const workbook = await loadTemplate(TEMPLATE_PATHS.REKAP_GURU);
    
    // Use first sheet (should be the main data sheet)
    const sheet = workbook.worksheets[0];
    console.log(`📄 Using sheet: ${sheet.name}`);
    
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
    
    console.log(`✅ Filled ${guruData.length} teachers data`);
    
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
    // Determine date range based on semester
    const [tahunAwal, tahunAkhir] = tahunAjaran.split('-');
    
    let startDate, endDate;
    if (semester === 'gasal') {
        startDate = `${tahunAwal}-07-01`; // Juli
        endDate = `${tahunAwal}-12-31`;   // Desember
    } else {
        startDate = `${tahunAkhir}-01-01`; // Januari
        endDate = `${tahunAkhir}-06-30`;   // Juni
    }
    
    console.log(`📅 Fetching data for period: ${startDate} to ${endDate}`);
    
    // Query untuk mendapatkan siswa dan ketidakhadiran mereka
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
    
    // Transform to required format
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
        
        // Map bulan number to name
        const bulanNames = ['', 'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 
                           'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
        const bulanName = bulanNames[row.bulan];
        
        if (bulanName && row.status) {
            const siswa = siswaMap.get(row.id_siswa);
            if (!siswa.ketidakhadiran[bulanName]) {
                siswa.ketidakhadiran[bulanName] = { S: 0, I: 0, A: 0 };
            }
            
            // Map status to S/I/A
            const statusUpper = row.status.toUpperCase();
            if (statusUpper.startsWith('S')) {
                siswa.ketidakhadiran[bulanName].S += row.jumlah;
            } else if (statusUpper.startsWith('I')) {
                siswa.ketidakhadiran[bulanName].I += row.jumlah;
            } else if (statusUpper.startsWith('A')) {
                siswa.ketidakhadiran[bulanName].A += row.jumlah;
            }
        }
    }
    
    return Array.from(siswaMap.values());
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
    
    console.log(`📅 Fetching guru data for period: ${startDate} to ${endDate}`);
    
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
        console.warn('⚠️ Could not fetch wali kelas:', error.message);
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
    console.log(`📊 Generating rekap guru mingguan`);
    
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
    
    console.log(`✅ Filled ${guruData.length} teachers schedule`);
    
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
}

// ================================================
// JADWAL PELAJARAN EXPORT
// ================================================

/**
 * Export Jadwal Pelajaran
 * Menggunakan template yang sudah ada dengan warna-warna per mapel
 * 
 * @param {Object} params
 * @param {Array} params.jadwalData - Data jadwal per kelas
 * @returns {Promise<Buffer>} - Excel file buffer
 */
export async function exportJadwalPelajaran({ jadwalData }) {
    console.log(`📊 Generating jadwal pelajaran`);
    
    const workbook = await loadTemplate(TEMPLATE_PATHS.JADWAL);
    
    // Get JADWAL sheet
    const sheet = workbook.getWorksheet('JADWAL');
    if (!sheet) {
        throw new Error('Sheet JADWAL tidak ditemukan dalam template');
    }
    
    console.log(`📄 Using sheet: ${sheet.name}`);
    console.log(`ℹ️ Template jadwal loaded - preserving formatting and colors`);
    
    // Note: For jadwal, the template usually has complex merging and coloring
    // We preserve the template as-is since it's manually maintained
    // This function is mainly for reading/exporting the current state
    
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
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
            GROUP_CONCAT(DISTINCT DAYNAME(j.hari) SEPARATOR ',') as hari_mengajar
        FROM guru g
        LEFT JOIN jadwal j ON g.id_guru = j.guru_id
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
                SENIN: hariArray.includes('Monday'),
                SELASA: hariArray.includes('Tuesday'),
                RABU: hariArray.includes('Wednesday'),
                KAMIS: hariArray.includes('Thursday'),
                JUMAT: hariArray.includes('Friday')
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
    exportJadwalPelajaran,
    fetchRekapSiswaByKelas,
    fetchRekapGuru,
    fetchGuruJadwalMingguan,
    getWaliKelas,
    getKelasInfo
};

