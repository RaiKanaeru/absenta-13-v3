/**
 * Export Controller
 * Menangani logika pembuatan Excel/laporan
 * Direfaktor dari server_modern.js
 */

import ExcelJS from 'exceljs';
import { AppError, ERROR_CODES, sendDatabaseError, sendErrorResponse, sendNotFoundError, sendPermissionError, sendServiceUnavailableError, sendValidationError } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';
import ExportService from '../services/ExportService.js';
import {
    getSemesterEffectiveDays,
    getEffectiveDaysMapFromDB,
    calculateAbsencePercentage,
    buildTahunPelajaran
} from '../utils/attendanceCalculator.js';


const logger = createLogger('Export');

// Constants to avoid duplicate literals
const ERROR_DATE_REQUIRED = 'Tanggal mulai dan akhir harus diisi';
const ERROR_YEAR_REQUIRED = 'Tahun harus diisi';
const ERROR_TEMPLATE_NOT_FOUND = 'Template file tidak ditemukan';

// Import constants from config
import { 
    EXCEL_MIME_TYPE, 
    CONTENT_TYPE, 
    CONTENT_DISPOSITION,
    EXPORT_TITLES,
    MONTH_NAMES_SHORT,
    EXPORT_HEADERS,
    HARI_EFEKTIF
} from '../config/exportConfig.js';
import { ABSENT_STATUSES } from '../config/attendanceConstants.js';


import { getLetterhead, REPORT_KEYS } from '../../backend/utils/letterheadService.js';
import { getWIBTime } from '../utils/timeUtils.js';
import { isSafeFilename } from '../utils/downloadAccess.js';

// ================================================
// HELPER: Common Excel setup
// ================================================
const getCommonExcelSetup = async (reportKey) => {
    const letterhead = await getLetterhead({ reportKey });
    return { letterhead };
};

/**
 * Map attendance status string to single-letter code
 * @param {string} status - Attendance status
 * @returns {string} Single letter code (H, I, S, A, D, or -)
 */
const mapStatusToCode = (status) => {
    const statusMap = {
        'Hadir': 'H',
        'Izin': 'I',
        'Sakit': 'S',
        'Alpa': 'A',
        'Dispen': 'D'
    };
    return statusMap[status] || '-';
};

/**
 * Build schedule content lines for Excel cell (S2004 - extracted to avoid deep nesting)
 * @param {Object} schedule - Schedule object
 * @param {Function} parseGuruList - Function to parse guru list
 * @param {Function} formatTime - Function to format time
 * @returns {string} Formatted schedule content
 */
const buildScheduleContentLines = (schedule, parseGuruList, formatTime) => {
    const lines = [
        schedule.nama_guru,
        ...(schedule.nama_mapel ? [schedule.nama_mapel] : []),
        schedule.kode_ruang || 'Ruang TBD',
        `${formatTime(schedule.jam_mulai)} - ${formatTime(schedule.jam_selesai)}`
    ];
    
    if (schedule.is_multi_guru && schedule.guru_list) {
        const guruNames = parseGuruList(schedule.guru_list);
        if (guruNames.length > 1) {
            lines.push('', 'Multi-Guru:', ...guruNames.map(g => `• ${g.name}`));
        }
    }
    return lines.join('\n');
};

// ================================================
// HELPER: Reusable Excel Styles for Rekap Reports
// ================================================
const REKAP_HEADER_STYLE = {
    font: { bold: true, size: 11 },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }
};

const REKAP_DATA_STYLE = {
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    }
};

const MONTH_NAMES = {
    1: 'JAN', 2: 'FEB', 3: 'MAR', 4: 'APR', 5: 'MEI', 6: 'JUN',
    7: 'JUL', 8: 'AGT', 9: 'SEP', 10: 'OKT', 11: 'NOV', 12: 'DES'
};
// Use MONTH_NAMES_SHORT from config where applicable if needed, but keeping this map for index lookup consistency

/**
 * Calculate attendance percentages for a student
 * @param {number} totalS - Sakit count
 * @param {number} totalI - Izin count
 * @param {number} totalA - Alpha count
 * @param {number} totalHariEfektif - Total effective days
 * @returns {Object} { persenTidakHadir, persenHadir }
 */
const calculateAttendancePercentages = (totalS, totalI, totalA, totalHariEfektif) => {
    const jumlahTotal = totalS + totalI + totalA;
    const persenTidakHadir = totalHariEfektif > 0 ? ((jumlahTotal / totalHariEfektif) * 100).toFixed(2) : '0.00';
    const persenHadir = (100 - Number.parseFloat(persenTidakHadir)).toFixed(2);
    return { jumlahTotal, persenTidakHadir, persenHadir };
};

/**
 * Apply style to a cell
 * @param {Object} cell - ExcelJS cell object
 * @param {Object} style - Style object to apply
 */
const applyCellStyle = (cell, style) => {
    Object.assign(cell, style);
};

/** SQL query to get class name by ID (S1192 duplicate literal) */
const SQL_GET_KELAS_NAME_BY_ID = 'SELECT nama_kelas FROM kelas WHERE id_kelas = ?';

// NOTE: addLetterheadToWorksheet, addReportTitle, addHeaders are imported from excelLetterhead.js
// at line ~608 for exports that use them. Top-level imports removed to avoid redeclaration.


// ================================================
// ADMIN EXPORTS
// ================================================

/**
 * Export general attendance data
 * GET /api/export/absensi
 */
export const exportAbsensi = async (req, res) => {
    try {
        const { date_start, date_end } = req.query;
        const rows = await ExportService.getAbsensiGuru(date_start, date_end);

        // Import required modules
        const { buildExcel } = await import('../../backend/export/excelBuilder.js');
        // getLetterhead and REPORT_KEYS already imported at top of file (line 11)
        const absensiGuruSchema = await import('../../backend/export/schemas/absensi-guru.js');

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.ABSENSI_GURU });

        // Prepare data for Excel
        const reportData = rows.map((row, index) => ({
            no: index + 1,
            tanggal: row.tanggal,
            hari: row.hari,
            jam_ke: row.jam_ke,
            waktu: `${row.jam_mulai} - ${row.jam_selesai}`,
            nama_kelas: row.nama_kelas,
            nama_mapel: row.nama_mapel,
            nama_guru: row.nama_guru,
            nip: row.nip,
            status: row.status,
            keterangan: row.keterangan || '-',
            nama_pencatat: row.nama_pencatat
        }));

        const reportPeriod = date_start && date_end
            ? `${date_start} - ${date_end}`
            : 'Semua Periode';

        // Generate Excel workbook
        const workbook = await buildExcel({
            title: absensiGuruSchema.default.title,
            subtitle: absensiGuruSchema.default.subtitle,
            reportPeriod: reportPeriod,
            letterhead: letterhead,
            columns: absensiGuruSchema.default.columns,
            rows: reportData
        });

        // Set response headers
        res.setHeader(CONTENT_TYPE, EXCEL_MIME_TYPE);
        res.setHeader(CONTENT_DISPOSITION, `attachment; filename=absensi-guru-${formatWIBDate()}.xlsx`);

        // Write to response
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        logger.error('Excel export error', { error: error.message });
        return sendDatabaseError(res, error, 'Gagal mengekspor data ke Excel');
    }
};

/**
 * Export teacher list
 * GET /api/export/teacher-list
 */
export const exportTeacherList = async (req, res) => {
    try {
        const { academicYear = '2025-2026' } = req.query;
        // Import AbsentaExportSystem
        const AbsentaExportSystem = (await import('../../src/utils/absentaExportSystem.js')).default;
        const exportSystem = new AbsentaExportSystem();

        // Query data guru dari database
        const teachers = await ExportService.getTeacherList();

        const workbook = await exportSystem.exportTeacherList(teachers, academicYear);

        res.setHeader(CONTENT_TYPE, EXCEL_MIME_TYPE);
        res.setHeader(CONTENT_DISPOSITION, `attachment; filename="Daftar_Guru_${academicYear.replace('-', '_')}_${Date.now()}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Export student summary
 * GET /api/export/student-summary
 */
export const exportStudentSummary = async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        const students = await ExportService.getStudentSummary(startDate, endDate, kelas_id);

        // Import required modules
        const { buildExcel } = await import('../../backend/export/excelBuilder.js');
        // getLetterhead and REPORT_KEYS already imported at top of file (line 11)
        const studentSummarySchema = await import('../../backend/export/schemas/student-summary.js');

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.KEHADIRAN_SISWA });

        // Prepare data for Excel
        const reportData = students.map((row, index) => ({
            no: index + 1,
            nama: row.nama,
            nis: row.nis,
            kelas: row.nama_kelas,
            hadir: row.H,
            izin: row.I,
            sakit: row.S,
            alpa: row.A,
            dispen: row.D,
            presentase: row.presentase / 100 // Convert to decimal for percentage format
        }));

        const reportPeriod = `${startDate} - ${endDate}`;

        // Generate Excel workbook
        const workbook = await buildExcel({
            title: rekapGuruSchema.default.title,
            subtitle: rekapGuruSchema.default.subtitle,
            reportPeriod: `Tahun ${tahun}`,
            letterhead: letterhead,
            columns: rekapGuruSchema.default.columns,
            rows: reportData
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="REKAP_KETIDAKHADIRAN_GURU_SMKN13_${tahun}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Export riwayat banding absen
 * GET /api/export/riwayat-banding-absen
 */
export const exportRiwayatBandingAbsen = async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, status, guru_id } = req.query;
        const role = req.user?.role;
        let guruId = null;

        if (role === 'guru') {
            guruId = req.user.guru_id;
        } else if (role === 'admin' && guru_id) {
            const parsedGuruId = Number(guru_id);
            if (Number.isNaN(parsedGuruId)) {
                return sendValidationError(res, 'guru_id tidak valid', { field: 'guru_id' });
            }
            guruId = parsedGuruId;
        }

        const rows = await ExportService.getRiwayatBandingAbsen(startDate, endDate, guruId, kelas_id, status);

        const { buildExcel } = await import('../../backend/export/excelBuilder.js');
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.BANDING_ABSEN });

        const columns = [
            { key: 'no', label: 'No', width: 5 },
            { key: 'tanggal_pengajuan', label: 'Tanggal Pengajuan', width: 15 },
            { key: 'tanggal_absen', label: 'Tanggal Absen', width: 15 },
            { key: 'nama_siswa', label: 'Nama Siswa', width: 30 },
            { key: 'nama_kelas', label: 'Kelas', width: 10 },
            { key: 'status_absen', label: 'Status Awal', width: 15 },
            { key: 'alasan_banding', label: 'Alasan', width: 30 },
            { key: 'status', label: 'Status Pengajuan', width: 15 },
            { key: 'tanggal_disetujui', label: 'Tanggal Disetujui', width: 15 },
            { key: 'catatan', label: 'Catatan', width: 30 }
        ];

        const reportData = rows.map((row, index) => ({
            no: index + 1,
            tanggal_pengajuan: row.tanggal_pengajuan,
            tanggal_absen: row.tanggal_absen,
            nama_siswa: row.nama_siswa,
            nama_kelas: row.nama_kelas,
            status_absen: row.status_absen,
            alasan_banding: row.alasan_banding,
            status: row.status_banding || row.status,
            tanggal_disetujui: row.tanggal_disetujui,
            catatan: row.catatan
        }));

        const workbook = await buildExcel({
            title: 'RIWAYAT BANDING ABSEN',
            subtitle: `Periode: ${startDate} s/d ${endDate}`,
            reportPeriod: `${startDate} - ${endDate}`,
            letterhead,
            columns,
            rows: reportData
        });

        res.setHeader(CONTENT_TYPE, EXCEL_MIME_TYPE);
        res.setHeader(CONTENT_DISPOSITION, `attachment; filename="Riwayat_Banding_${startDate}_${endDate}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Export presensi siswa format SMKN 13
 * GET /api/export/presensi-siswa-smkn13
 */
export const exportPresensiSiswaSmkn13 = async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        const guruId = req.user.id;

        const rows = await ExportService.getPresensiSiswaSmkn13(startDate, endDate, guruId, kelas_id);

        const { buildExcel } = await import('../../backend/export/excelBuilder.js');
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.PRESENSI_SISWA });

        const columns = [
            { key: 'no', label: 'No', width: 5 },
            { key: 'tanggal', label: 'Tanggal', width: 15 },
            { key: 'hari', label: 'Hari', width: 10 },
            { key: 'jam_mulai', label: 'Jam Mulai', width: 10 },
            { key: 'jam_selesai', label: 'Jam Selesai', width: 10 },
            { key: 'mata_pelajaran', label: 'Mata Pelajaran', width: 25 },
            { key: 'nama_kelas', label: 'Kelas', width: 10 },
            { key: 'total_siswa', label: 'Total Siswa', width: 10 },
            { key: 'hadir', label: 'Hadir', width: 8 },
            { key: 'izin', label: 'Izin', width: 8 },
            { key: 'sakit', label: 'Sakit', width: 8 },
            { key: 'alpa', label: 'Alpa', width: 8 },
            { key: 'dispen', label: 'Dispen', width: 8 }
        ];

        const reportData = rows.map((row, index) => ({
            no: index + 1,
            ...row
        }));

        const workbook = await buildExcel({
            title: 'LAPORAN PRESENSI SISWA (FORMAT SMKN 13)',
            subtitle: `Periode: ${startDate} s/d ${endDate}`,
            reportPeriod: `${startDate} - ${endDate}`,
            letterhead,
            columns,
            rows: reportData
        });

        res.setHeader(CONTENT_TYPE, EXCEL_MIME_TYPE);
        res.setHeader(CONTENT_DISPOSITION, `attachment; filename="Presensi_Siswa_SMKN13_${startDate}_${endDate}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Export rekap ketidakhadiran (general)
 * @route GET /api/export/rekap-ketidakhadiran
 * @access Guru, Admin
 */
export const exportRekapKetidakhadiran = async (req, res) => {
    try {
        const { kelas_id, bulan, tahun, tipe = 'siswa' } = req.query;

        if (!bulan || !tahun) {
            return sendValidationError(res, 'bulan dan tahun wajib diisi');
        }

        const startDate = `${tahun}-${String(bulan).padStart(2, '0')}-01`;
        const endDate = new Date(tahun, bulan, 0).toISOString().split('T')[0];

        let query, params;
        
        if (tipe === 'guru') {
            query = `
                SELECT 
                    g.nama,
                    g.nip,
                    COUNT(CASE WHEN ag.status = 'Sakit' THEN 1 END) as sakit,
                    COUNT(CASE WHEN ag.status = 'Izin' THEN 1 END) as izin,
                    COUNT(CASE WHEN ag.status = 'Tidak Hadir' THEN 1 END) as alpha,
                    COUNT(CASE WHEN ag.status != 'Hadir' THEN 1 END) as total_tidak_hadir
                FROM guru g
                LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id 
                    AND ag.tanggal BETWEEN ? AND ?
                GROUP BY g.id_guru, g.nama, g.nip
                ORDER BY g.nama
            `;
            params = [startDate, endDate];
        } else {
            query = `
                SELECT 
                    s.nama,
                    s.nis,
                    k.nama_kelas as kelas,
                    COUNT(CASE WHEN a.status = 'Sakit' THEN 1 END) as sakit,
                    COUNT(CASE WHEN a.status = 'Izin' THEN 1 END) as izin,
                    COUNT(CASE WHEN a.status = 'Alpa' THEN 1 END) as alpha,
                    COUNT(CASE WHEN a.status != 'Hadir' THEN 1 END) as total_tidak_hadir
                FROM siswa s
                JOIN kelas k ON s.kelas_id = k.id_kelas
                LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                    AND a.tanggal BETWEEN ? AND ?
                WHERE 1=1
            `;
            params = [startDate, endDate];
            
            if (kelas_id) {
                query += ' AND s.kelas_id = ?';
                params.push(kelas_id);
            }
            
            query += ' GROUP BY s.id_siswa, s.nama, s.nis, k.nama_kelas ORDER BY k.nama_kelas, s.nama';
        }

        const [rows] = await globalThis.dbPool.execute(query, params);

        // Build Excel
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Rekap Ketidakhadiran');

        if (tipe === 'guru') {
            worksheet.columns = [
                { header: 'No', key: 'no', width: 5 },
                { header: 'Nama', key: 'nama', width: 30 },
                { header: 'NIP', key: 'nip', width: 20 },
                { header: 'Sakit', key: 'sakit', width: 8 },
                { header: 'Izin', key: 'izin', width: 8 },
                { header: 'Alpha', key: 'alpha', width: 8 },
                { header: 'Total Tidak Hadir', key: 'total_tidak_hadir', width: 18 }
            ];
        } else {
            worksheet.columns = [
                { header: 'No', key: 'no', width: 5 },
                { header: 'Nama', key: 'nama', width: 30 },
                { header: 'NIS', key: 'nis', width: 15 },
                { header: 'Kelas', key: 'kelas', width: 12 },
                { header: 'Sakit', key: 'sakit', width: 8 },
                { header: 'Izin', key: 'izin', width: 8 },
                { header: 'Alpha', key: 'alpha', width: 8 },
                { header: 'Total Tidak Hadir', key: 'total_tidak_hadir', width: 18 }
            ];
        }

        rows.forEach((row, index) => {
            worksheet.addRow({
                no: index + 1,
                ...row
            });
        });

        // Style header
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        const bulanNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                           'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Rekap_Ketidakhadiran_${tipe}_${bulanNames[parseInt(bulan)]}_${tahun}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Export ringkasan kehadiran siswa format SMKN13
 * @route GET /api/export/ringkasan-kehadiran-siswa-smkn13
 * @access Guru, Admin
 */
export const exportRingkasanKehadiranSiswaSmkn13 = async (req, res) => {
    try {
        const { kelas_id, semester, tahun_ajaran } = req.query;

        if (!kelas_id) {
            return sendValidationError(res, 'kelas_id wajib diisi');
        }

        // Get class info
        const [kelasRows] = await globalThis.dbPool.execute(
            'SELECT nama_kelas FROM kelas WHERE id_kelas = ?',
            [kelas_id]
        );
        const namaKelas = kelasRows[0]?.nama_kelas || 'Unknown';

        // Determine date range based on semester
        let startMonth, endMonth, year;
        if (semester === '1') {
            // Semester 1: July - December
            startMonth = 7;
            endMonth = 12;
            year = tahun_ajaran ? tahun_ajaran.split('/')[0] : new Date().getFullYear();
        } else {
            // Semester 2: January - June
            startMonth = 1;
            endMonth = 6;
            year = tahun_ajaran ? tahun_ajaran.split('/')[1] : new Date().getFullYear();
        }

        const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(endMonth).padStart(2, '0')}-${new Date(year, endMonth, 0).getDate()}`;

        // Get students with attendance summary
        const [rows] = await globalThis.dbPool.execute(`
            SELECT 
                s.nis,
                s.nama,
                COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as hadir,
                COUNT(CASE WHEN a.status = 'Sakit' THEN 1 END) as sakit,
                COUNT(CASE WHEN a.status = 'Izin' THEN 1 END) as izin,
                COUNT(CASE WHEN a.status = 'Alpa' THEN 1 END) as alpha,
                COUNT(a.id) as total_hari
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND a.tanggal BETWEEN ? AND ?
            WHERE s.kelas_id = ?
            GROUP BY s.id_siswa, s.nis, s.nama
            ORDER BY s.nama
        `, [startDate, endDate, kelas_id]);

        // Build Excel with SMKN13 format
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Ringkasan Kehadiran');

        // Add header info
        worksheet.mergeCells('A1:H1');
        worksheet.getCell('A1').value = 'RINGKASAN KEHADIRAN SISWA';
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:H2');
        worksheet.getCell('A2').value = `Kelas: ${namaKelas} | Semester: ${semester || '-'} | Tahun Ajaran: ${tahun_ajaran || '-'}`;
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        // Add empty row
        worksheet.addRow([]);

        // Column headers
        worksheet.columns = [
            { key: 'no', width: 5 },
            { key: 'nis', width: 15 },
            { key: 'nama', width: 30 },
            { key: 'hadir', width: 10 },
            { key: 'sakit', width: 10 },
            { key: 'izin', width: 10 },
            { key: 'alpha', width: 10 },
            { key: 'persentase', width: 15 }
        ];

        const headerRow = worksheet.addRow(['No', 'NIS', 'Nama Siswa', 'Hadir', 'Sakit', 'Izin', 'Alpha', '% Kehadiran']);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Add data rows
        rows.forEach((row, index) => {
            const totalHari = row.total_hari || 1;
            const persentase = ((row.hadir / totalHari) * 100).toFixed(1);
            
            worksheet.addRow([
                index + 1,
                row.nis,
                row.nama,
                row.hadir || 0,
                row.sakit || 0,
                row.izin || 0,
                row.alpha || 0,
                `${persentase}%`
            ]);
        });

        // Add borders
        const lastRow = worksheet.rowCount;
        for (let i = 4; i <= lastRow; i++) {
            for (let j = 1; j <= 8; j++) {
                worksheet.getCell(i, j).border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            }
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Ringkasan_Kehadiran_${namaKelas}_Semester${semester || ''}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Export teacher summary
 * GET /api/export/teacher-summary
 */
export const exportTeacherSummary = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const teachers = await ExportService.getTeacherSummary(startDate, endDate);

        // Import required modules
        const { buildExcel } = await import('../../backend/export/excelBuilder.js');
        // getLetterhead and REPORT_KEYS already imported at top of file (line 11)
        const teacherSummarySchema = await import('../../backend/export/schemas/teacher-summary.js');

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.LAPORAN_GURU });

        // Prepare data for Excel
        const reportData = teachers.map((row, index) => ({
            no: index + 1,
            nama: row.nama,
            nip: row.nip,
            hadir: row.H,
            izin: row.I,
            sakit: row.S,
            alpa: row.A,
            presentase: row.presentase / 100
        }));

        const reportPeriod = `${startDate} - ${endDate}`;

        // Generate Excel workbook
        const workbook = await buildExcel({
            title: teacherSummarySchema.default.title,
            subtitle: teacherSummarySchema.default.subtitle,
            reportPeriod: reportPeriod,
            letterhead: letterhead,
            columns: teacherSummarySchema.default.columns,
            rows: reportData
        });

        res.setHeader(CONTENT_TYPE, EXCEL_MIME_TYPE);
        res.setHeader(CONTENT_DISPOSITION, `attachment; filename="Ringkasan_Kehadiran_Guru_${startDate}_${endDate}_${Date.now()}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Export banding absen data
 * GET /api/export/banding-absen
 */
export const exportBandingAbsen = async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, status } = req.query;

        const bandingData = await ExportService.getBandingAbsen(startDate, endDate, kelas_id, status);

        // Import required modules
        const { buildExcel } = await import('../../backend/export/excelBuilder.js');
        // getLetterhead and REPORT_KEYS already imported at top of file (line 11)
        const bandingAbsenSchema = await import('../../backend/export/schemas/banding-absen.js');

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.BANDING_ABSEN });

        // Prepare data for Excel
        const reportData = bandingData.map((row, index) => ({
            no: index + 1,
            tanggal_pengajuan: row.tanggal_pengajuan,
            tanggal_absen: row.tanggal_absen,
            pengaju: row.nama_pengaju,
            kelas: row.nama_kelas,
            mata_pelajaran: row.nama_mapel,
            guru: row.nama_guru,
            jadwal: row.jadwal,
            status_asli: row.status_asli,
            status_diajukan: row.status_diajukan,
            status_banding: row.status_banding,
            jenis_banding: row.jenis_banding,
            alasan_banding: row.alasan_banding,
            catatan_guru: row.catatan_guru,
            tanggal_keputusan: row.tanggal_keputusan,
            diproses_oleh: row.diproses_oleh
        }));

        const reportPeriod = `${startDate} - ${endDate}`;

        // Generate Excel workbook
        const workbook = await buildExcel({
            title: bandingAbsenSchema.default.title,
            subtitle: bandingAbsenSchema.default.subtitle,
            reportPeriod: reportPeriod,
            letterhead: letterhead,
            columns: bandingAbsenSchema.default.columns,
            rows: reportData
        });

        res.setHeader(CONTENT_TYPE, EXCEL_MIME_TYPE);
        res.setHeader(CONTENT_DISPOSITION, `attachment; filename="Banding_Absen_${startDate}_${endDate}_${Date.now()}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Export rekap ketidakhadiran guru - format tahunan
 * GET /api/export/rekap-ketidakhadiran-guru
 */
export const exportRekapKetidakhadiranGuru = async (req, res) => {
    try {
        const { tahun } = req.query;
        if (!tahun) {
            return sendValidationError(res, ERROR_YEAR_REQUIRED);
        }

        const tahunInput = String(tahun).trim();
        let tahunAwal;
        let tahunAkhir;

        if (/^\d{4}\s*-\s*\d{4}$/.test(tahunInput)) {
            const [awal, akhir] = tahunInput.split('-').map((value) => Number.parseInt(value.trim(), 10));
            tahunAwal = awal;
            tahunAkhir = akhir;
        } else if (/^\d{4}$/.test(tahunInput)) {
            tahunAwal = Number.parseInt(tahunInput, 10);
            tahunAkhir = tahunAwal + 1;
        } else {
            return sendValidationError(res, 'Format tahun ajaran tidak valid');
        }

        const tahunAjaran = `${tahunAwal}-${tahunAkhir}`;
        const tahunPelajaran = `${tahunAwal}/${tahunAkhir}`; // Format untuk kalender_akademik
        const startDate = `${tahunAwal}-07-01`;
        const endDate = `${tahunAkhir}-06-30`;
        const statusPlaceholders = ABSENT_STATUSES.map(() => '?').join(', ');

        // Fetch hari efektif dari kalender_akademik
        const { getEffectiveDaysMap } = await import('./kalenderAkademikController.js');
        const hariEfektifMap = await getEffectiveDaysMap(tahunPelajaran);
        
        // Calculate total hari efektif from database
        const totalHariEfektif = Object.values(hariEfektifMap).reduce((sum, days) => sum + days, 0);
        
        logger.info('Fetched hari efektif from kalender_akademik', { 
            tahunPelajaran, 
            hariEfektifMap, 
            totalHariEfektif 
        });

        const query = `
            SELECT 
                g.id_guru as id,
                g.nama,
                g.nip,
                COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 7 THEN 1 ELSE 0 END), 0) as jul,
                COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 8 THEN 1 ELSE 0 END), 0) as agt,
                COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 9 THEN 1 ELSE 0 END), 0) as sep,
                COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 10 THEN 1 ELSE 0 END), 0) as okt,
                COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 11 THEN 1 ELSE 0 END), 0) as nov,
                COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 12 THEN 1 ELSE 0 END), 0) as des,
                COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 1 THEN 1 ELSE 0 END), 0) as jan,
                COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 2 THEN 1 ELSE 0 END), 0) as feb,
                COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 3 THEN 1 ELSE 0 END), 0) as mar,
                COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 4 THEN 1 ELSE 0 END), 0) as apr,
                COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 5 THEN 1 ELSE 0 END), 0) as mei,
                COALESCE(SUM(CASE WHEN MONTH(ag.tanggal) = 6 THEN 1 ELSE 0 END), 0) as jun
            FROM guru g
            LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id 
                AND ag.tanggal BETWEEN ? AND ?
                AND ag.status IN (${statusPlaceholders})
            WHERE g.status = 'aktif'
            GROUP BY g.id_guru, g.nama, g.nip
            ORDER BY g.nama
        `;

        const [rows] = await globalThis.dbPool.execute(query, [startDate, endDate, ...ABSENT_STATUSES]);
        const mapping = templateExportService.REKAP_GURU_MAPPING;
        const templateAvailable = await templateExportService.templateExists(mapping.templateFile);

        if (templateAvailable) {
            const workbook = await templateExportService.loadTemplate(mapping.templateFile);
            const worksheet = workbook.worksheets[0];

            worksheet.getCell('A3').value = `${EXPORT_TITLES.YEAR_PREFIX} ${tahunAjaran}`;

            const hariEfektifRow = mapping.startRow - 1;
            const monthColumns = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
            const monthKeys = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

            // Use hari efektif from database
            monthColumns.forEach((col, index) => {
                worksheet.getCell(`${col}${hariEfektifRow}`).value = hariEfektifMap[monthKeys[index]] ?? 0;
            });

            const templateRowCount = 20;
            if (rows.length > templateRowCount) {
                for (let i = templateRowCount; i < rows.length; i++) {
                    templateExportService.cloneRowStyle(worksheet, mapping.startRow, mapping.startRow + i);
                }
            }

            const templateData = rows.map((row, index) => ({
                no: index + 1,
                nama: row.nama,
                jul: row.jul || 0,
                agt: row.agt || 0,
                sep: row.sep || 0,
                okt: row.okt || 0,
                nov: row.nov || 0,
                des: row.des || 0,
                jan: row.jan || 0,
                feb: row.feb || 0,
                mar: row.mar || 0,
                apr: row.apr || 0,
                mei: row.mei || 0,
                jun: row.jun || 0
            }));

            templateExportService.fillCells(worksheet, templateData, mapping, mapping.startRow);

            const applyFormulas = (rowIndex) => {
                worksheet.getCell(`O${rowIndex}`).value = { formula: `SUM(C${rowIndex}:N${rowIndex})`, result: 0 };
                worksheet.getCell(`P${rowIndex}`).value = { formula: `IF(O${rowIndex}=0,0,(O${rowIndex}/${totalHariEfektif})*100)`, result: 0 };
                worksheet.getCell(`Q${rowIndex}`).value = { formula: `IF(P${rowIndex}=0,100,100-P${rowIndex})`, result: 0 };
            };

            for (let i = 0; i < templateData.length; i++) {
                applyFormulas(mapping.startRow + i);
            }

            res.setHeader(CONTENT_TYPE, EXCEL_MIME_TYPE);
            res.setHeader(CONTENT_DISPOSITION, `attachment; filename="REKAP_KETIDAKHADIRAN_GURU_TAHUNAN_${tahunAjaran}.xlsx"`);

            await workbook.xlsx.write(res);
            res.end();
            return;
        }

        const dataWithPercentage = rows.map((row) => {
            const totalKetidakhadiran = (row.jul || 0) + (row.agt || 0) + (row.sep || 0) + (row.okt || 0) + (row.nov || 0) + (row.des || 0)
                + (row.jan || 0) + (row.feb || 0) + (row.mar || 0) + (row.apr || 0) + (row.mei || 0) + (row.jun || 0);
            const persentaseKetidakhadiran = totalHariEfektif > 0 ? (totalKetidakhadiran / totalHariEfektif) * 100 : 0;
            const persentaseKehadiran = 100 - persentaseKetidakhadiran;

            return {
                ...row,
                total_ketidakhadiran: totalKetidakhadiran,
                persentase_ketidakhadiran: Number.parseFloat(persentaseKetidakhadiran.toFixed(2)),
                persentase_kehadiran: Number.parseFloat(persentaseKehadiran.toFixed(2))
            };
        });

        const { buildExcel } = await import('../../backend/export/excelBuilder.js');
        const rekapGuruSchema = await import('../../backend/export/schemas/rekap-ketidakhadiran-guru-bulanan.js');
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.REKAP_KETIDAKHADIRAN_GURU });

        const reportData = dataWithPercentage.map((row, index) => ({
            no: index + 1,
            nama: row.nama,
            nip: row.nip,
            jul: row.jul,
            agt: row.agt,
            sep: row.sep,
            okt: row.okt,
            nov: row.nov,
            des: row.des,
            jan: row.jan,
            feb: row.feb,
            mar: row.mar,
            apr: row.apr,
            mei: row.mei,
            jun: row.jun,
            total_ketidakhadiran: row.total_ketidakhadiran,
            persentase_ketidakhadiran: row.persentase_ketidakhadiran / 100,
            persentase_kehadiran: row.persentase_kehadiran / 100
        }));

        const workbook = await buildExcel({
            title: rekapGuruSchema.default.title,
            subtitle: `Rekap Ketidakhadiran Guru Tahun Pelajaran ${tahunPelajaran}`,
            reportPeriod: `Tahun Ajaran ${tahunAjaran} (Total ${totalHariEfektif} Hari Efektif)`,
            letterhead: letterhead,
            columns: rekapGuruSchema.default.columns,
            rows: reportData
        });

        res.setHeader(CONTENT_TYPE, EXCEL_MIME_TYPE);
        res.setHeader(CONTENT_DISPOSITION, `attachment; filename="REKAP_KETIDAKHADIRAN_GURU_TAHUNAN_${tahunAjaran}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// ================================================
// LARGE EXPORTS - Complex monthly breakdown
// ================================================

/**
 * Export rekap ketidakhadiran siswa - Format SMK13
 * GET /api/export/rekap-ketidakhadiran-siswa
 * Columns: NO, NIS/NISN, NAMA, L/P, S-I-A-JML per bulan (Jul-Des), TOTAL S-I-A, JUMLAH TOTAL, % TIDAK HADIR, % HADIR
 * 
 * Memory optimization: Logs warning for large datasets (>500 students)
 * Note: Full streaming not implemented due to complex merge cells requirements
 */
export const exportRekapKetidakhadiranSiswa = async (req, res) => {
    try {
        const { kelas_id, tahun, semester = 'gasal' } = req.query;
        // Get class info and wali kelas
        const [kelasRows] = await globalThis.dbPool.execute(`
            SELECT k.nama_kelas, g.nama as wali_kelas 
            FROM kelas k 
            LEFT JOIN guru g ON k.id_kelas = g.id_guru 
            WHERE k.id_kelas = ?
        `, [kelas_id]);
        const kelasName = kelasRows.length > 0 ? kelasRows[0].nama_kelas : 'Unknown';
        const waliKelas = kelasRows.length > 0 ? kelasRows[0].wali_kelas : '-';

        // Get students
        const [studentsRows] = await globalThis.dbPool.execute(
            'SELECT s.id_siswa as id, s.nis, s.nama, s.jenis_kelamin FROM siswa s WHERE s.kelas_id = ? AND s.status = "aktif" ORDER BY s.nama ASC',
            [kelas_id]
        );

        // Memory warning for large datasets
        const LARGE_DATASET_THRESHOLD = 500;
        if (studentsRows.length > LARGE_DATASET_THRESHOLD) {
            logger.warn('Large dataset detected for Excel export - may cause memory pressure', {
                studentCount: studentsRows.length,
                kelas_id,
                semester,
                tahun
            });
        }

        // Determine months based on semester
        const months = semester === 'gasal' 
            ? [7, 8, 9, 10, 11, 12] // Juli - Desember
            : [1, 2, 3, 4, 5, 6];   // Januari - Juni
        
        // Use centralized month names from top of file
        const monthNames = MONTH_NAMES;

        // Get attendance data with S/I/A breakdown per month
        const presensiData = await ExportService.getRekapKetidakhadiranSiswa(tahun, kelas_id, semester);

        // Get total hari efektif from kalender_akademik (dynamic, not hardcoded)
        const tahunPelajaran = buildTahunPelajaran(tahun);
        const { totalDays: TOTAL_HARI_EFEKTIF, monthlyBreakdown } = await getSemesterEffectiveDays(tahunPelajaran, semester);
        
        logger.info('Fetched semester effective days from DB', {
            tahunPelajaran,
            semester,
            TOTAL_HARI_EFEKTIF,
            monthlyBreakdown,
            studentCount: studentsRows.length
        });

        // Build Excel using ExcelJS directly for precise control
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('REKAP KETIDAKHADIRAN');

        // Use centralized styles from top of file
        const headerStyle = REKAP_HEADER_STYLE;
        const dataStyle = REKAP_DATA_STYLE;

        // Title Headers (Row 1-4)
        worksheet.mergeCells('A1:AH1');
        worksheet.getCell('A1').value = 'PERSENTASE KETIDAKHADIRAN PESERTA DIDIK';
        worksheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFCC0000' } };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:AH2');
        worksheet.getCell('A2').value = EXPORT_TITLES.SCHOOL_NAME;
        worksheet.getCell('A2').font = { bold: true, size: 12, color: { argb: 'FFCC0000' } };
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A3:AH3');
        worksheet.getCell('A3').value = `TAHUN PELAJARAN ${tahun}-${Number.parseInt(tahun) + 1}`;
        worksheet.getCell('A3').font = { bold: true, size: 11, color: { argb: 'FFCC0000' } };
        worksheet.getCell('A3').alignment = { horizontal: 'center' };

        // Class and Wali Kelas info (Row 5-6)
        worksheet.getCell('A5').value = 'KELAS';
        worksheet.getCell('B5').value = ':';
        worksheet.getCell('C5').value = kelasName;
        worksheet.getCell('A6').value = 'NAMA WALI KELAS';
        worksheet.getCell('B6').value = ':';
        worksheet.getCell('C6').value = waliKelas;

        // Header Row 1 - Main headers (Row 8)
        const headerRow1 = 8;
        worksheet.getCell(`A${headerRow1}`).value = '';
        worksheet.getCell(`B${headerRow1}`).value = '';
        worksheet.getCell(`C${headerRow1}`).value = '';
        worksheet.getCell(`D${headerRow1}`).value = '';
        
        // Merge "JUMLAH KETIDAKHADIRAN PESERTA DIDIK" across month columns
        worksheet.mergeCells(`E${headerRow1}:AB${headerRow1}`);
        worksheet.getCell(`E${headerRow1}`).value = 'JUMLAH KETIDAKHADIRAN PESERTA DIDIK';
        Object.assign(worksheet.getCell(`E${headerRow1}`), headerStyle);

        // Header Row 2 - Column headers (Row 9)
        const headerRow2 = 9;
        worksheet.getCell(`A${headerRow2}`).value = 'NO.';
        worksheet.getCell(`B${headerRow2}`).value = 'NIS/NISN';
        worksheet.getCell(`C${headerRow2}`).value = 'NAMA PESERTA DIDIK';
        worksheet.getCell(`D${headerRow2}`).value = 'L/P';

        // Month headers with S-I-A-JML
        let col = 5; // Column E
        months.forEach(month => {
            worksheet.mergeCells(headerRow2, col, headerRow2, col + 3);
            worksheet.getCell(headerRow2, col).value = monthNames[month];
            Object.assign(worksheet.getCell(headerRow2, col), headerStyle);
            col += 4;
        });

        // JUMLAH TOTAL header
        worksheet.mergeCells(headerRow2, col, headerRow2, col + 2);
        worksheet.getCell(headerRow2, col).value = 'JUMLAH TOTAL';
        Object.assign(worksheet.getCell(headerRow2, col), headerStyle);
        col += 3;

        // Final columns
        worksheet.getCell(headerRow2, col).value = 'JUMLAH\nTOTAL';
        worksheet.getCell(headerRow2, col + 1).value = 'JUMLAH\nTIDAK\nHADIR';
        worksheet.getCell(headerRow2, col + 2).value = 'JUMLAH\nPROSENT\nHADIR\n(%)';

        // Header Row 3 - Sub headers S-I-A-JML (Row 10)
        const headerRow3 = 10;
        worksheet.getCell(`A${headerRow3}`).value = '';
        worksheet.getCell(`B${headerRow3}`).value = '';
        worksheet.getCell(`C${headerRow3}`).value = '';
        worksheet.getCell(`D${headerRow3}`).value = '';

        col = 5;
        months.forEach(() => {
            worksheet.getCell(headerRow3, col).value = 'S';
            worksheet.getCell(headerRow3, col + 1).value = 'I';
            worksheet.getCell(headerRow3, col + 2).value = 'A';
            worksheet.getCell(headerRow3, col + 3).value = 'JML';
            for (let i = 0; i < 4; i++) {
                Object.assign(worksheet.getCell(headerRow3, col + i), headerStyle);
            }
            col += 4;
        });

        // Total S-I-A sub headers
        worksheet.getCell(headerRow3, col).value = 'S';
        worksheet.getCell(headerRow3, col + 1).value = 'I';
        worksheet.getCell(headerRow3, col + 2).value = 'A';
        for (let i = 0; i < 3; i++) {
            Object.assign(worksheet.getCell(headerRow3, col + i), headerStyle);
        }

        // Apply header styles to main columns
        ['A', 'B', 'C', 'D'].forEach(colLetter => {
            for (let headerRowNum = headerRow1; headerRowNum <= headerRow3; headerRowNum++) {
                Object.assign(worksheet.getCell(`${colLetter}${headerRowNum}`), headerStyle);
            }
        });

        // Merge NO, NIS, NAMA, L/P across 3 rows
        ['A', 'B', 'C', 'D'].forEach(colLetter => {
            worksheet.mergeCells(`${colLetter}${headerRow1}:${colLetter}${headerRow3}`);
        });
        worksheet.getCell(`A${headerRow1}`).value = 'NO.';
        worksheet.getCell(`B${headerRow1}`).value = 'NIS/NISN';
        worksheet.getCell(`C${headerRow1}`).value = 'NAMA PESERTA DIDIK';
        worksheet.getCell(`D${headerRow1}`).value = 'L/P';

        // Data rows starting at row 11
        let dataRow = 11;
        const totals = { S: 0, I: 0, A: 0 };
        const monthlyTotals = {};
        months.forEach(m => monthlyTotals[m] = { S: 0, I: 0, A: 0 });

        studentsRows.forEach((student, index) => {
            const studentPresensi = presensiData.filter(p => p.siswa_id === student.id);
            
            worksheet.getCell(`A${dataRow}`).value = index + 1;
            worksheet.getCell(`B${dataRow}`).value = student.nis;
            worksheet.getCell(`C${dataRow}`).value = student.nama;
            worksheet.getCell(`D${dataRow}`).value = student.jenis_kelamin === 'L' ? 'L' : 'P';

            let totalS = 0, totalI = 0, totalA = 0;
            col = 5;

            months.forEach(month => {
                const monthData = studentPresensi.find(p => p.bulan === month) || { S: 0, I: 0, A: 0 };
                const sakitCount = Number.parseInt(monthData.S) || 0;
                const izinCount = Number.parseInt(monthData.I) || 0;
                const alpaCount = Number.parseInt(monthData.A) || 0;
                const monthlyTotal = sakitCount + izinCount + alpaCount;

                worksheet.getCell(dataRow, col).value = sakitCount || 0;
                worksheet.getCell(dataRow, col + 1).value = izinCount || 0;
                worksheet.getCell(dataRow, col + 2).value = alpaCount || 0;
                worksheet.getCell(dataRow, col + 3).value = monthlyTotal || 0;

                // Apply cell styles
                for (let columnOffset = 0; columnOffset < 4; columnOffset++) {
                    Object.assign(worksheet.getCell(dataRow, col + columnOffset), dataStyle);
                }

                totalS += sakitCount;
                totalI += izinCount;
                totalA += alpaCount;

                monthlyTotals[month].S += sakitCount;
                monthlyTotals[month].I += izinCount;
                monthlyTotals[month].A += alpaCount;

                col += 4;
            });

            // Total S, I, A
            worksheet.getCell(dataRow, col).value = totalS;
            worksheet.getCell(dataRow, col + 1).value = totalI;
            worksheet.getCell(dataRow, col + 2).value = totalA;

            const jumlahTotal = totalS + totalI + totalA;
            worksheet.getCell(dataRow, col + 3).value = jumlahTotal;

            // Use centralized calculation with warning logging
            const { ketidakhadiran: persenTidakHadir, kehadiran: persenHadir, capped } = calculateAbsencePercentage(
                jumlahTotal,
                TOTAL_HARI_EFEKTIF,
                { context: `Student Export: ${student.nama} (${student.nis})` }
            );

            worksheet.getCell(dataRow, col + 4).value = persenTidakHadir;
            worksheet.getCell(dataRow, col + 5).value = persenHadir;

            // Apply styles to summary columns
            for (let columnOffset = 0; columnOffset < 6; columnOffset++) {
                Object.assign(worksheet.getCell(dataRow, col + columnOffset), dataStyle);
            }

            totals.S += totalS;
            totals.I += totalI;
            totals.A += totalA;

            // Apply styles to identity columns
            ['A', 'B', 'C', 'D'].forEach(c => {
                Object.assign(worksheet.getCell(`${c}${dataRow}`), dataStyle);
            });

            dataRow++;
        });

        // RATA-RATA row
        worksheet.getCell(`A${dataRow}`).value = '';
        worksheet.mergeCells(`A${dataRow}:D${dataRow}`);
        worksheet.getCell(`A${dataRow}`).value = 'RATA-RATA';
        Object.assign(worksheet.getCell(`A${dataRow}`), { ...dataStyle, font: { bold: true } });

        // Calculate and fill RATA-RATA for % Hadir using centralized helper
        let avgPersenHadir = 100;
        if (studentsRows.length > 0) {
            const avgAbsence = (totals.S + totals.I + totals.A) / studentsRows.length;
            const { kehadiran } = calculateAbsencePercentage(
                avgAbsence,
                TOTAL_HARI_EFEKTIF,
                { context: 'Class Average Export' }
            );
            avgPersenHadir = kehadiran;
        }

        const lastCol = col + 5;
        worksheet.getCell(dataRow, lastCol).value = Number.parseFloat(avgPersenHadir);
        Object.assign(worksheet.getCell(dataRow, lastCol), { ...dataStyle, font: { bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } } });

        // Set column widths
        worksheet.getColumn(1).width = 5;  // NO
        worksheet.getColumn(2).width = 15; // NIS
        worksheet.getColumn(3).width = 30; // NAMA
        worksheet.getColumn(4).width = 5;  // L/P
        for (let i = 5; i <= 40; i++) {
            worksheet.getColumn(i).width = 5;
        }

        // Set row heights
        worksheet.getRow(headerRow1).height = 20;
        worksheet.getRow(headerRow2).height = 20;
        worksheet.getRow(headerRow3).height = 30;

        const filename = `Persentase_Ketidakhadiran_${kelasName}_${semester === 'gasal' ? 'Gasal' : 'Genap'}_${tahun}`.replaceAll(/\s/g, '_');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        logger.error('Error exporting rekap ketidakhadiran', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Export presensi siswa with daily detail
 * GET /api/export/presensi-siswa
 */
export const exportPresensiSiswa = async (req, res) => {
    try {
        const { kelas_id, bulan, tahun } = req.query;
        // Get class name
        const [kelasRows] = await globalThis.dbPool.execute(SQL_GET_KELAS_NAME_BY_ID, [kelas_id]);
        const kelasName = kelasRows.length > 0 ? kelasRows[0].nama_kelas : 'Unknown';

        // Get students
        const [studentsRows] = await globalThis.dbPool.execute(
            'SELECT s.id_siswa as id, s.nis, s.nama, s.jenis_kelamin FROM siswa s WHERE s.kelas_id = ? AND s.status = "aktif" ORDER BY s.nama ASC',
            [kelas_id]
        );

        // Get presensi data for the month
        const presensiRows = await ExportService.getPresensiSiswaDetail(tahun, bulan, kelas_id);

        // Prepare export data
        const daysInMonth = new Date(Number.parseInt(tahun), Number.parseInt(bulan), 0).getDate();
        const exportData = studentsRows.map(student => {
            const studentPresensi = presensiRows.filter(p => p.siswa_id === student.id);
            const attendanceRecord = {};
            const keteranganList = [];

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${tahun}-${String(bulan).padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                const presensi = studentPresensi.find(p => p.tanggal === dateStr);
                attendanceRecord[`hari_${day}`] = presensi ? presensi.status : '';
                if (presensi && presensi.keterangan) keteranganList.push(`${day}: ${presensi.keterangan}`);
            }

            return { nis: student.nis, nama: student.nama, jenis_kelamin: student.jenis_kelamin, keterangan: keteranganList.join('; '), ...attendanceRecord };
        });

        // Import modules
        const { buildExcel } = await import('../../backend/export/excelBuilder.js');
        // getLetterhead and REPORT_KEYS already imported at top of file (line 11)
        const { generatePresensiColumns } = await import('../../backend/export/schemas/presensi-siswa-detail.js');

        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.PRESENSI_SISWA });
        const columns = generatePresensiColumns(daysInMonth);
        const reportData = exportData.map((row, index) => ({ no: index + 1, ...row }));

        const workbook = await buildExcel({
            title: 'Presensi Siswa', subtitle: 'Format Presensi Siswa SMKN 13',
            reportPeriod: `${bulan}/${tahun}`, showLetterhead: letterhead.enabled, letterhead, columns, rows: reportData
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Presensi_Siswa_${kelasName}_${bulan}_${tahun}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// ================================================
// ADMIN EXPORTS
// ================================================

/**
 * Export admin attendance CSV
 * GET /api/admin/export/attendance
 */
export const exportAdminAttendance = async (req, res) => {
    try {
        const rows = await ExportService.getAdminAttendance();

        let csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += 'Tanggal,Nama Siswa,NIS,Kelas,Status,Keterangan,Waktu Absen\n';

        rows.forEach(row => {
            csvContent += `"${row.tanggal}","${row.nama_siswa}","${row.nis}","${row.nama_kelas}","${row.status}","${row.keterangan}","${row.waktu_absen}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="data-kehadiran-siswa.csv"');
        res.send(csvContent);
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// ================================================
// JADWAL EXPORTS - Migrated from server_modern.js
// ================================================

/**
 * Export jadwal matrix format - REDESIGNED to match web preview
 * GET /api/admin/export/jadwal-matrix
 * 
 * Features:
 * - Multi-guru support with guru_list parsing
 * - Styled cells with colors, borders, rich text
 * - Proper cell structure (Guru, Mapel, Ruang, Time separated)
 * - Matching web matrix layout
 */
export const exportJadwalMatrix = async (req, res) => {
    try {
        const { kelas_id, hari } = req.query;

        // Use getLetterhead from top-level import (line 11)
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.JADWAL_PELAJARAN });

        // Updated query to include multi-guru data
        const schedules = await ExportService.getJadwalMatrix(kelas_id, hari);
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Jadwal Pelajaran Matrix');

        const daysOfWeek = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const totalCols = daysOfWeek.length + 1;

        // Style definitions
        const headerStyle = {
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } },
            font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            }
        };

        const kelasStyle = {
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } },
            font: { bold: true, size: 10 },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            }
        };

        const cellBorder = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
        };

        // Add letterhead
        let currentRow = await addLetterheadToWorksheet(workbook, worksheet, letterhead, totalCols);

        // Title
        currentRow = addReportTitle(worksheet, 'JADWAL PELAJARAN MATRIX', `Tanggal Export: ${formatWIBDate()}`, currentRow, totalCols);
        currentRow++;

        // Matrix headers with styling
        const headerRow = worksheet.getRow(currentRow);
        ['KELAS', ...daysOfWeek].forEach((header, idx) => {
            const cell = headerRow.getCell(idx + 1);
            cell.value = header;
            cell.fill = headerStyle.fill;
            cell.font = headerStyle.font;
            cell.alignment = headerStyle.alignment;
            cell.border = headerStyle.border;
        });
        headerRow.height = 25;
        currentRow++;

        // Helper function to parse guru_list
        const parseGuruList = (guruList) => {
            if (!guruList) return [];
            return guruList.split('||').map(item => {
                const [id, name] = item.split(':');
                return { id: Number.parseInt(id), name: name || 'Unknown' };
            }).filter(g => g.name);
        };

        // Helper function to format time
        const formatTime = (time) => {
            if (!time) return '';
            const parts = time.toString().split(':');
            return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
        };

        // Matrix data with proper styling
        const uniqueClasses = [...new Set(schedules.map(s => s.nama_kelas))].sort();
        
        uniqueClasses.forEach(className => {
            const dataRow = worksheet.getRow(currentRow);
            
            // Kelas column
            const kelasCell = dataRow.getCell(1);
            kelasCell.value = className;
            kelasCell.fill = kelasStyle.fill;
            kelasCell.font = kelasStyle.font;
            kelasCell.alignment = kelasStyle.alignment;
            kelasCell.border = kelasStyle.border;

            let maxSlots = 1;

            daysOfWeek.forEach((day, dayIndex) => {
                const daySchedules = schedules
                    .filter(s => s.nama_kelas === className && s.hari === day)
                    .sort((a, b) => (a.jam_ke || 0) - (b.jam_ke || 0));
                
                const cell = dataRow.getCell(dayIndex + 2);
                
                if (daySchedules.length > 0) {
                    maxSlots = Math.max(maxSlots, daySchedules.length);
                    
                    // Use file-level helper function (S2004 - avoid deep nesting)
                    const contentParts = daySchedules.map(s => buildScheduleContentLines(s, parseGuruList, formatTime));
                    
                    cell.value = contentParts.join('\n\n────────────\n\n');
                    cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
                    cell.border = cellBorder;
                    cell.font = { size: 9 };
                    
                    if (daySchedules.some(s => s.is_multi_guru)) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
                    }
                } else {
                    cell.value = '-';
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = cellBorder;
                    cell.font = { size: 9, color: { argb: 'FF9CA3AF' } };
                }
            });

            dataRow.height = Math.max(60, maxSlots * 70);
            currentRow++;
        });

        // Column widths
        worksheet.getColumn(1).width = 14;
        for (let i = 2; i <= totalCols; i++) worksheet.getColumn(i).width = 28;

        // Summary row
        currentRow++;
        const summaryRow = worksheet.getRow(currentRow);
        summaryRow.getCell(1).value = `Total: ${schedules.length} jadwal dari ${uniqueClasses.length} kelas`;
        summaryRow.getCell(1).font = { italic: true, size: 9 };
        worksheet.mergeCells(currentRow, 1, currentRow, totalCols);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Jadwal_Pelajaran_Matrix_${formatWIBDate().replaceAll('/', '-')}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        logger.error('Export jadwal matrix error', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Export jadwal grid format - MASTER GRID (Colorful)
 * GET /api/admin/export/jadwal-grid
 * Layout: Rows = Class (3 rows: Mapel, Ruang, Guru), Columns = Day > Jam
 */
export const exportJadwalGrid = async (req, res) => {
    try {
        const { kelas_id, hari } = req.query;

        // Use getLetterhead from top-level import
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.JADWAL_PELAJARAN });

        const schedules = await ExportService.getJadwalMatrix(kelas_id, hari);
        // Ensure nama_guru prioritizes kode_guru if available
        schedules.forEach(s => {
            if (s.kode_guru) s.nama_guru = s.kode_guru;
        });

        if (schedules.length === 0) {
            throw new Error('Tidak ada data jadwal untuk diexport');
        }

        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Master Jadwal');

        // 1. Analyze Data to determine Columns (Max Jam per Day)
        const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const dayConfig = {};
        
        // Default minimal slots if no data
        days.forEach(d => dayConfig[d] = { maxJam: 0, slots: {} });

        schedules.forEach(s => {
            if (dayConfig[s.hari]) {
                dayConfig[s.hari].maxJam = Math.max(dayConfig[s.hari].maxJam, s.jam_ke);
                // Store time string for header
                if (!dayConfig[s.hari].slots[s.jam_ke]) {
                    dayConfig[s.hari].slots[s.jam_ke] = `${formatTime(s.jam_mulai)}-${formatTime(s.jam_selesai)}`;
                }
            }
        });

        // Filter days that have data (or keep all standard school days)
        const activeDays = days.filter(d => dayConfig[d].maxJam > 0);

        // 2. Setup Headers
        // Row A: Letterhead (handled by helper)
        // Row B: "JADWAL PELAJARAN..." Title
        // Row C: "SENIN" ...... "SELASA" ......
        // Row D: "1", "2"...   "1", "2"...
        // Row E: "07.00"...    "07.00"...

        // Calculate total columns
        // Fixed: No, Kelas, Jenis (3 cols)
        let colOffset = 4; // Start after fixed cols
        const colMap = {}; // Maps "Hari-Jam" to Column Index

        activeDays.forEach(day => {
            const width = dayConfig[day].maxJam;
            dayConfig[day].startCol = colOffset;
            dayConfig[day].endCol = colOffset + width - 1;
            
            for (let i = 1; i <= width; i++) {
                colMap[`${day}-${i}`] = colOffset + i - 1;
            }
            colOffset += width;
        });
        const totalCols = colOffset - 1;

        // Add Letterhead
        let currentRow = await addLetterheadToWorksheet(workbook, worksheet, letterhead, totalCols);
        
        // Title
        currentRow = addReportTitle(worksheet, 'MASTER JADWAL PELAJARAN', `Tanggal Export: ${formatWIBDate()}`, currentRow, totalCols);
        currentRow++; // Spacing

        // --- Build Header Rows ---
        const dayRow = worksheet.getRow(currentRow);
        const jamRow = worksheet.getRow(currentRow + 1);
        const timeRow = worksheet.getRow(currentRow + 2);

        // Fixed Headers
        ['NO', 'KELAS', 'DATA'].forEach((label, idx) => {
            const cell = dayRow.getCell(idx + 1);
            cell.value = label;
            worksheet.mergeCells(currentRow, idx + 1, currentRow + 2, idx + 1);
            applyStyle(cell, excelStyles.header);
        });

        // Dynamic Day Headers
        activeDays.forEach((day, idx) => {
            const config = dayConfig[day];
            
            // Day Label (Merged)
            const dayCell = dayRow.getCell(config.startCol);
            dayCell.value = day.toUpperCase();
            worksheet.mergeCells(currentRow, config.startCol, currentRow, config.endCol);
            
            // Styling based on day (Alternating colors for distinction)
            const dayColor = idx % 2 === 0 ? 'FFFDE047' : 'FF86EFAC'; // Yellow / Green
            applyStyle(dayCell, { ...excelStyles.header, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: dayColor } }, font: { bold: true, color: { argb: 'FF000000' } } });

            // Slot Headers
            for (let j = 1; j <= config.maxJam; j++) {
                const colIdx = config.startCol + j - 1;
                
                // Jam Ke
                const jamCell = jamRow.getCell(colIdx);
                jamCell.value = j;
                applyStyle(jamCell, { ...excelStyles.subHeader, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: dayColor } } });

                // Time Range
                const timeCell = timeRow.getCell(colIdx);
                timeCell.value = config.slots[j] || '-';
                applyStyle(timeCell, { ...excelStyles.subHeader, font: { size: 8 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: dayColor } } });
            }
        });

        currentRow += 3;

        // 3. Process Data Rows (3 Rows per Class)
        // Group by Kelas
        const classGroups = {};
        schedules.forEach(s => {
            if (!classGroups[s.nama_kelas]) classGroups[s.nama_kelas] = [];
            classGroups[s.nama_kelas].push(s);
        });

        let no = 1;
        Object.keys(classGroups).sort().forEach(className => {
            const classSchedules = classGroups[className];
            const startRow = currentRow;
            
            // Create 3 rows: Mapel, Ruang, Guru
            const mapelRow = worksheet.getRow(currentRow);
            const ruangRow = worksheet.getRow(currentRow + 1);
            const guruRow = worksheet.getRow(currentRow + 2);

            // Fixed Columns Data
            // No
            const noCell = mapelRow.getCell(1);
            noCell.value = no++;
            worksheet.mergeCells(startRow, 1, startRow + 2, 1);
            applyStyle(noCell, excelStyles.cellCenter);

            // Kelas
            const kelasCell = mapelRow.getCell(2);
            kelasCell.value = className;
            worksheet.mergeCells(startRow, 2, startRow + 2, 2);
            applyStyle(kelasCell, { ...excelStyles.cellCenter, font: { bold: true } });

            // Labels
            mapelRow.getCell(3).value = 'MAPEL';
            ruangRow.getCell(3).value = 'RUANG';
            guruRow.getCell(3).value = 'GURU';
            [mapelRow, ruangRow, guruRow].forEach(r => applyStyle(r.getCell(3), excelStyles.cell));

            // Populate Data Cells
            classSchedules.forEach(s => {
                const colIdx = colMap[`${s.hari}-${s.jam_ke}`];
                if (colIdx) {
                    // Check for special events (Upacara, Istirahat)
                    let cellColor = null;
                    const activity = (s.jenis_aktivitas || '').toLowerCase();
                    const mapelName = (s.nama_mapel || '').toLowerCase();

                    if (activity === 'upacara' || mapelName.includes('upacara')) cellColor = 'FFFFF00'; // Yellow
                    else if (activity === 'istirahat' || mapelName.includes('istirahat')) cellColor = 'FFFFC0CB'; // Pink
                    else if (s.jenis_aktivitas === 'kbm') cellColor = 'FFFFFFFF'; // White

                    // Mapel
                    const cellM = mapelRow.getCell(colIdx);
                    cellM.value = s.nama_mapel;
                    if (cellColor) cellM.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cellColor } };
                    
                    // Ruang
                    const cellR = ruangRow.getCell(colIdx);
                    cellR.value = s.kode_ruang;
                    if (cellColor) cellR.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cellColor } };

                    // Guru
                    const cellG = guruRow.getCell(colIdx);
                    cellG.value = s.nama_guru;
                    if (cellColor) cellG.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cellColor } };
                }
            });

            // Styling for data cells
            for (let colIdx = 4; colIdx <= totalCols; colIdx++) {
                [mapelRow, ruangRow, guruRow].forEach(dataRow => {
                    const cell = dataRow.getCell(colIdx);
                    cell.border = borders.thin;
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                });
            }

            currentRow += 3;
        });

        // Set Column Widths
        worksheet.getColumn(1).width = 5;  // No
        worksheet.getColumn(2).width = 12; // Kelas
        worksheet.getColumn(3).width = 10; // Type
        for (let i = 4; i <= totalCols; i++) {
            worksheet.getColumn(i).width = 15; // Time slots
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Master_Jadwal_Grid_${Date.now()}.xlsx"`);
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        logger.error('Export jadwal grid error', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Export jadwal print format
 * GET /api/admin/export/jadwal-print
 */
export const exportJadwalPrint = async (req, res) => {
    try {
        const { kelas_id, hari } = req.query;

        // getLetterhead and REPORT_KEYS already imported at top of file (line 11)
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.JADWAL_PELAJARAN });

        let query = `
            SELECT j.id_jadwal, j.hari, j.jam_ke, j.jam_mulai, j.jam_selesai, j.jenis_aktivitas,
                k.nama_kelas, COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel,
                COALESCE(g.nama, 'Sistem') as nama_guru, rk.kode_ruang, rk.nama_ruang
            FROM jadwal j
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN ruang_kelas rk ON j.ruang_id = rk.id_ruang
            WHERE j.status = 'aktif'
        `;
        const params = [];
        if (kelas_id && kelas_id !== 'all') { query += ' AND j.kelas_id = ?'; params.push(kelas_id); }
        if (hari && hari !== 'all') { query += ' AND j.hari = ?'; params.push(hari); }
        query += ` ORDER BY k.nama_kelas, FIELD(j.hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'), j.jam_ke`;

        const [schedules] = await globalThis.dbPool.execute(query, params);

        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Jadwal Print');

        const totalCols = 8;
        let currentRow = await addLetterheadToWorksheet(workbook, worksheet, letterhead, totalCols);
        currentRow = addReportTitle(worksheet, 'JADWAL PELAJARAN - PRINT', `Tanggal Export: ${formatWIBDate()}`, currentRow, totalCols);

        // Group by class
        const classesSeen = new Set();
        schedules.forEach((schedule, index) => {
            if (!classesSeen.has(schedule.nama_kelas)) {
                if (classesSeen.size > 0) currentRow++; // Space between classes
                classesSeen.add(schedule.nama_kelas);
                worksheet.getCell(currentRow, 1).value = `KELAS: ${schedule.nama_kelas}`;
                worksheet.getCell(currentRow, 1).font = { bold: true, size: 12 };
                worksheet.mergeCells(currentRow, 1, currentRow, totalCols);
                currentRow++;
                addHeaders(worksheet, ['NO', 'HARI', 'JAM', 'WAKTU', 'MAPEL', 'GURU', 'RUANG', 'AKTIVITAS'], currentRow);
                currentRow++;
            }
            worksheet.getCell(currentRow, 1).value = index + 1;
            worksheet.getCell(currentRow, 2).value = schedule.hari;
            worksheet.getCell(currentRow, 3).value = schedule.jam_ke;
            worksheet.getCell(currentRow, 4).value = `${schedule.jam_mulai}-${schedule.jam_selesai}`;
            worksheet.getCell(currentRow, 5).value = schedule.nama_mapel;
            worksheet.getCell(currentRow, 6).value = schedule.nama_guru;
            worksheet.getCell(currentRow, 7).value = schedule.kode_ruang || '-';
            worksheet.getCell(currentRow, 8).value = schedule.jenis_aktivitas;
            currentRow++;
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Jadwal_Print_${formatWIBDate().replaceAll('/', '-')}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// ================================================
// ALL EXPORTS MIGRATED - 17/17 COMPLETE
// ================================================











// ================================================
// ASYNC DOWNLOAD ENDPOINTS - Batch 17F
// ================================================

/**
 * Request Excel download
 * POST /api/guru/request-excel-download
 */
export const requestExcelDownload = async (req, res) => {
    try {
        const { type, filters, startDate, endDate, kelas_id, mapel_id, guru_id, semester, year } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;
        if (!globalThis.downloadQueue) {
            return sendServiceUnavailableError(res, 'Download queue tidak tersedia');
        }

        const downloadType = type || 'student-attendance';
        const normalizedFilters = {
            ...(filters && typeof filters === 'object' ? filters : {})
        };

        if (!filters) {
            if (startDate) normalizedFilters.tanggal_mulai = startDate;
            if (endDate) normalizedFilters.tanggal_selesai = endDate;
            if (kelas_id) normalizedFilters.kelas_id = kelas_id;
            if (mapel_id) normalizedFilters.mapel_id = mapel_id;
            if (guru_id) normalizedFilters.guru_id = guru_id;
            if (semester) normalizedFilters.semester = semester;
            if (year) normalizedFilters.year = year;
        }

        if (!['student-attendance', 'teacher-attendance', 'analytics-report'].includes(downloadType)) {
            return sendValidationError(res, 'Jenis download tidak valid', { type: downloadType });
        }

        if (downloadType === 'student-attendance' || downloadType === 'teacher-attendance') {
            if (!normalizedFilters.tanggal_mulai || !normalizedFilters.tanggal_selesai) {
                return sendValidationError(res, 'Tanggal mulai dan akhir wajib diisi');
            }
        }

        if (downloadType === 'teacher-attendance' && userRole !== 'admin') {
            normalizedFilters.guru_id = req.user.guru_id;
        }

        if (downloadType === 'analytics-report') {
            if (!normalizedFilters.semester || !normalizedFilters.year) {
                return sendValidationError(res, 'Semester dan tahun wajib diisi');
            }
        }

        const job = await globalThis.downloadQueue.addExcelDownloadJob({
            type: downloadType,
            userId,
            userRole,
            filters: normalizedFilters
        });

        res.json({
            success: true,
            message: 'Download request queued successfully',
            data: job
        });

    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Get download status
 * GET /api/guru/download-status/:jobId
 */
export const getDownloadStatus = async (req, res) => {
    try {
        const { jobId } = req.params;
        const userId = req.user.id;

        if (!globalThis.downloadQueue) {
            return sendServiceUnavailableError(res, 'Download queue tidak tersedia');
        }

        const jobStatus = await globalThis.downloadQueue.getJobStatus(jobId, userId);

        if (!jobStatus) {
            return sendPermissionError(res, 'Akses ditolak');
        }

        if (jobStatus.status === 'not_found') {
            return sendNotFoundError(res, 'Job tidak ditemukan');
        }

        res.json({
            success: true,
            data: jobStatus
        });

    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Download file
 * GET /api/downloads/:filename
 */
export const downloadFile = async (req, res) => {
    try {
        const { filename } = req.params;
        const userId = req.user.id;

        if (!globalThis.downloadQueue) {
            return sendServiceUnavailableError(res, 'Download queue tidak tersedia');
        }

        if (!isSafeFilename(filename)) {
            return sendValidationError(res, 'Nama file tidak valid');
        }
        
        // Use path and fs imports (will need to be added to top of file)
        const path = await import('node:path');
        const fs = await import('node:fs/promises');

        // Verify user has access to this file
        const hasAccess = await globalThis.downloadQueue.verifyFileAccess(filename, userId);
        if (!hasAccess) {
            return sendPermissionError(res, 'Akses ditolak');
        }

        const baseDir = await fs.default.realpath(globalThis.downloadQueue.downloadDir);
        const filePath = path.default.resolve(baseDir, filename);
        const relativePath = path.default.relative(baseDir, filePath);

        if (relativePath.startsWith('..') || path.default.isAbsolute(relativePath)) {
            return sendValidationError(res, 'Nama file tidak valid');
        }

        // Check if file exists and prevent symlink access
        let fileStats;
        try {
            fileStats = await fs.default.lstat(filePath);
        } catch (error) {
             logger.debug('File not found check', { filePath, error: error.message });
            return sendErrorResponse(res, new AppError(ERROR_CODES.FILE_NOT_FOUND, 'File tidak ditemukan'));
        }

        if (fileStats.isSymbolicLink()) {
            return sendValidationError(res, 'Nama file tidak valid');
        }

        const realFilePath = await fs.default.realpath(filePath);
        const relativeRealPath = path.default.relative(baseDir, realFilePath);
        if (relativeRealPath.startsWith('..') || path.default.isAbsolute(relativeRealPath)) {
            return sendValidationError(res, 'Nama file tidak valid');
        }

        res.download(realFilePath, filename);

    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Export laporan kehadiran siswa complete with daily detail (Guru View)
 * GET /api/guru/download-laporan-kehadiran-siswa
 */
export const exportLaporanKehadiranSiswa = async (req, res) => {
    try {
        const { kelas_id, startDate, endDate } = req.query;
        const guruId = req.user.guru_id;

        if (!kelas_id) return sendValidationError(res, 'Kelas ID wajib diisi');
        if (!startDate || !endDate) return sendValidationError(res, 'Tanggal mulai dan tanggal selesai wajib diisi');

        // Parse dates manually to avoid timezone issues
        const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
        const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
        const start = new Date(sYear, sMonth - 1, sDay);
        const end = new Date(eYear, eMonth - 1, eDay);
        const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));

        if (diffDays > 62) return sendValidationError(res, 'Rentang tanggal maksimal 62 hari');

        // Get mapel info
        const [mapelInfo] = await globalThis.dbPool.execute(`
            SELECT DISTINCT g.mata_pelajaran as nama_mapel, g.nama as nama_guru, g.nip
            FROM guru g WHERE g.id_guru = ? AND g.status = 'aktif' LIMIT 1
        `, [guruId]);

        // Get scheduled dates
        const [jadwalData] = await globalThis.dbPool.execute(`
            SELECT j.hari FROM jadwal j WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif'
        `, [guruId, kelas_id]);

        // Helper to get scheduled dates based on jadwal days
        const getScheduledDates = (start, end, jadwalDays) => {
            const dates = [];
            const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const endTime = end.getTime();
            let currentTime = start.getTime();
            
            while (currentTime <= endTime) {
                const currentDate = new Date(currentTime);
                const dayName = dayNames[currentDate.getDay()];
                if (jadwalDays.some(j => j.hari === dayName)) {
                    const year = currentDate.getFullYear();
                    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                    const day = String(currentDate.getDate()).padStart(2, '0');
                    dates.push(`${year}-${month}-${day}`);
                }
                currentTime += 24 * 60 * 60 * 1000;
            }
            return dates;
        };

        const pertemuanDates = getScheduledDates(start, end, jadwalData);

        // Get actual attendance dates
        const [actualDates] = await globalThis.dbPool.execute(`
            SELECT DISTINCT DATE(a.tanggal) as tanggal
            FROM absensi_siswa a
            WHERE a.jadwal_id IN (SELECT j.id_jadwal FROM jadwal j WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif')
            AND DATE(a.tanggal) BETWEEN ? AND ?
            ORDER BY DATE(a.tanggal)
        `, [guruId, kelas_id, startDate, endDate]);

        const allDates = new Set(pertemuanDates);
        actualDates.forEach(r => {
            if (r.tanggal) {
                // Format date manually for MySQL DATE type
                const d = new Date(r.tanggal);
                const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                allDates.add(dateStr);
            }
        });
        const finalDates = Array.from(allDates).sort();

        // Get student summary stats
        const [siswaData] = await globalThis.dbPool.execute(`
            SELECT s.id_siswa, s.nama, s.nis, s.jenis_kelamin,
                COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END), 0) AS total_hadir,
                COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) AS total_izin,
                COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS total_sakit,
                COALESCE(SUM(CASE WHEN a.status = 'Alpa' OR a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) AS total_alpa,
                COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS total_dispen,
                CASE 
                    WHEN ? = 0 THEN '0%'
                    ELSE CONCAT(ROUND((SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / ?), 1), '%')
                END AS persentase_kehadiran
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND DATE(a.tanggal) BETWEEN ? AND ?
                AND a.jadwal_id IN (SELECT j.id_jadwal FROM jadwal j WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif')
            WHERE s.kelas_id = ? AND s.status = 'aktif'
            GROUP BY s.id_siswa, s.nama, s.nis, s.jenis_kelamin
            ORDER BY s.nama
        `, [finalDates.length, finalDates.length, startDate, endDate, guruId, kelas_id, kelas_id]);

        // Get detailed daily attendance
        const [detailKehadiran] = await globalThis.dbPool.execute(`
            SELECT s.id_siswa, DATE(a.tanggal) as tanggal, a.status
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND DATE(a.tanggal) BETWEEN ? AND ?
                AND a.jadwal_id IN (SELECT j.id_jadwal FROM jadwal j WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif')
            WHERE s.kelas_id = ? AND s.status = 'aktif'
        `, [startDate, endDate, guruId, kelas_id, kelas_id]);

        const attendanceMap = {};
        detailKehadiran.forEach(r => {
            if (!attendanceMap[r.id_siswa]) attendanceMap[r.id_siswa] = {};
            if (r.tanggal && r.status) attendanceMap[r.id_siswa][r.tanggal.toISOString().split('T')[0]] = r.status;
        });

        // Generate Excel
        const ExcelJS = (await import('exceljs')).default;
        const fs = await import('node:fs');
        const path = await import('node:path');
        // getLetterhead and REPORT_KEYS already imported at top of file (line 11)
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.KEHADIRAN_SISWA });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Laporan Kehadiran Siswa');
        let currentRow = 1;

        // Custom Letterhead Logic (Simplified from original)
        if (letterhead.enabled && letterhead.lines?.length > 0) {
            const alignment = letterhead.alignment || 'center';
            // Logos
            if (letterhead.logoLeftUrl || letterhead.logoRightUrl) {
                const addLogo = (url, col) => {
                    try {
                        let buffer;
                        if (url.startsWith('data:image/')) buffer = Buffer.from(url.split(',')[1], 'base64');
                        else {
                            const logoFilePath = path.default.join(process.cwd(), 'public', url);
                            if (fs.existsSync(logoFilePath)) buffer = fs.readFileSync(logoFilePath);
                        }
                        if (buffer) {
                            const imgId = workbook.addImage({ buffer, extension: 'png' });
                            sheet.addImage(imgId, { tl: { col, row: currentRow - 1 }, br: { col: col + 2, row: currentRow + 2 } });
                        }
                    } catch (e) {
                         logger.warn('Logo error', { error: e.message });
                         sheet.getCell(currentRow, col + 1).value = '[LOGO]';
                    }
                };
                if (letterhead.logoLeftUrl) addLogo(letterhead.logoLeftUrl, 0);
                if (letterhead.logoRightUrl) addLogo(letterhead.logoRightUrl, Math.max(9, finalDates.length + 5)); // Put right logo at end
            }
            // Text Lines
            letterhead.lines.forEach((line, idx) => {
                const text = typeof line === 'string' ? line : line.text;
                const bold = typeof line === 'object' ? line.fontWeight === 'bold' : idx === 0;
                const cell = sheet.getCell(currentRow, 1);
                cell.value = text;
                cell.font = { bold, size: bold ? 14 : 12 };
                cell.alignment = { horizontal: alignment };
                sheet.mergeCells(currentRow, 1, currentRow, finalDates.length + 10);
                currentRow++;
            });
            currentRow++;
        }

        // Title & Info
        const addInfoRow = (text) => {
            sheet.getCell(currentRow, 1).value = text;
            sheet.getCell(currentRow, 1).font = { bold: true };
            sheet.getCell(currentRow, 1).alignment = { horizontal: 'center' };
            sheet.mergeCells(currentRow, 1, currentRow, finalDates.length + 10);
            currentRow++;
        };
        addInfoRow('LAPORAN KEHADIRAN SISWA');
        if (mapelInfo[0]) {
            addInfoRow(`Mata Pelajaran: ${mapelInfo[0].nama_mapel}`);
            addInfoRow(`Guru: ${mapelInfo[0].nama_guru}`);
        }
        currentRow++;

        // Headers
        const headerRow = currentRow;
        const headers = ['No', 'Nama', 'NIS', 'L/P', ...finalDates.map(d => new Date(d).getDate()), 'H', 'I', 'S', 'A', 'D', '%'];
        headers.forEach((h, i) => {
            const cell = sheet.getCell(headerRow, i + 1);
            cell.value = h;
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center' };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        });

        // Data
        siswaData.forEach((s, idx) => {
            const row = headerRow + 1 + idx;
            const basic = [idx + 1, s.nama, s.nis, s.jenis_kelamin];
            const daily = finalDates.map(dateStr => {
                const attendanceStatus = attendanceMap[s.id_siswa]?.[dateStr];
                return mapStatusToCode(attendanceStatus);
            });
            const summary = [s.total_hadir, s.total_izin, s.total_sakit, s.total_alpa, s.total_dispen, s.persentase_kehadiran];
            
            [...basic, ...daily, ...summary].forEach((val, colIds) => {
                const cell = sheet.getCell(row, colIds + 1);
                cell.value = val;
                cell.alignment = { horizontal: 'center' };
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            });
        });

        // Widths
        sheet.getColumn(1).width = 5;
        sheet.getColumn(2).width = 25;
        sheet.getColumn(3).width = 12;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="laporan-kehadiran-siswa-${startDate}-${endDate}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Export rekap jadwal guru mingguan (Availability Matrix)
 * GET /api/admin/export/rekap-jadwal-guru
 * Layout: Rows = Guru, Columns = Days, Value = ADA/Empty
 */
export const exportRekapJadwalGuru = async (req, res) => {
    try {
        const { tahun_ajar } = req.query;

        // Letterhead
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.LAPORAN_GURU });

        // Query: Get valid days for each active teacher
        const query = `
            SELECT DISTINCT g.id_guru, g.nama, g.kode_guru, j.hari
            FROM guru g
            LEFT JOIN jadwal j ON g.id_guru = j.guru_id AND j.status = 'aktif'
            WHERE g.status = 'aktif'
            ORDER BY g.nama, FIELD(j.hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu')
        `;

        const [rows] = await globalThis.dbPool.execute(query);

        // Transform Data
        const teachers = {};
        rows.forEach(row => {
            if (!teachers[row.id_guru]) {
                teachers[row.id_guru] = {
                    nama: row.nama,
                    kode: row.kode_guru || `G${row.id_guru}`,
                    days: new Set()
                };
            }
            if (row.hari) {
                teachers[row.id_guru].days.add(row.hari);
            }
        });

        // Build Excel
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Rekap Jadwal Guru');

        const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
        const totalCols = 3 + days.length; // No, Nama, Kode + Days

        // 1. Add Letterhead
        let currentRow = await addLetterheadToWorksheet(workbook, worksheet, letterhead, totalCols);

        // 2. Add Title
        currentRow = addReportTitle(worksheet, 'REKAP JADWAL GURU - MINGGUAN', `TAHUN PELAJARAN ${tahun_ajar || '2024-2025'}`, currentRow, totalCols);
        currentRow++;

        // 3. Add Header Row
        const headerRow = worksheet.getRow(currentRow);
        ['NO', 'NAMA GURU', 'KODE', ...days.map(d => d.toUpperCase())].forEach((label, idx) => {
            const cell = headerRow.getCell(idx + 1);
            cell.value = label;
            applyStyle(cell, excelStyles.header);
            // Greenish header for days similar to image
            if (idx >= 3) {
                 cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF86EFAC' } }; // Light green
                 cell.font = { bold: true, color: { argb: 'FF000000' } };
            }
        });
        headerRow.height = 25;
        currentRow++;


        let no = 1;

        // 4. Data Rows
        Object.values(teachers).forEach(t => {
            const row = worksheet.getRow(currentRow);
            
            // Fixed Info
            const cellNo = row.getCell(1); cellNo.value = no++; applyStyle(cellNo, excelStyles.cellCenter);
            const cellName = row.getCell(2); cellName.value = t.nama; applyStyle(cellName, excelStyles.cell);
            const cellKode = row.getCell(3); cellKode.value = t.kode; applyStyle(cellKode, excelStyles.cellCenter);

            // Days Columns
            days.forEach((day, idx) => {
                const cell = row.getCell(4 + idx);
                const hasSchedule = t.days.has(day);
                
                cell.value = hasSchedule ? 'ADA' : '';
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = borders.thin;
                cell.font = { bold: true };

                if (hasSchedule) {
                     // White/Plain background for ADA
                     cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                } else {
                    // Grey for empty slots (meaning No Schedule)
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D5DB' } }; // Light Gray
                }
            });
            currentRow++;
        });

        // Widths
        worksheet.getColumn(1).width = 5;
        worksheet.getColumn(2).width = 35;
        worksheet.getColumn(3).width = 10;
        for(let i=4; i<=totalCols; i++) worksheet.getColumn(i).width = 12;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Rekap_Jadwal_Guru_${Date.now()}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        logger.error('Export rekap jadwal guru error', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

// ================================================
// TEMPLATE-BASED EXPORTS (per guidelines)
// Load .xlsx template → Fill data → Preserve formulas
// ================================================

import templateExportService from '../services/templateExportService.js';

/**
 * Export rekap ketidakhadiran guru TEMPLATE-BASED
 * GET /api/export/rekap-ketidakhadiran-guru-template
 * 
 * Uses actual template from sekolah, preserving formulas and formatting
 */
export const exportRekapKetidakhadiranGuruTemplate = async (req, res) => {
    return exportRekapKetidakhadiranGuru(req, res);
};

/**
 * Export rekap ketidakhadiran kelas TEMPLATE-BASED
 * GET /api/export/rekap-ketidakhadiran-kelas-template
 * 
 * Uses actual template from sekolah, preserving formulas and formatting
 */
export const exportRekapKetidakhadiranKelasTemplate = async (req, res) => {
    try {
        const { kelas_id, tahun } = req.query;
        if (!kelas_id || !tahun) {
            return sendValidationError(res, 'kelas_id dan tahun harus diisi');
        }

        // Get kelas info
        const [kelasRows] = await globalThis.dbPool.execute(
            SQL_GET_KELAS_NAME_BY_ID,
            [kelas_id]
        );
        if (kelasRows.length === 0) {
            return sendNotFoundError(res, 'Kelas tidak ditemukan');
        }
        const namaKelas = kelasRows[0].nama_kelas;

        // Determine tingkat (X, XI, XII, XIII) from kelas name
        let tingkat = 'X'; // Default fallback for kelas X
        if (namaKelas.includes('XIII')) tingkat = 'XIII';
        else if (namaKelas.includes('XII')) tingkat = 'XII';
        else if (namaKelas.includes('XI')) tingkat = 'XI';
        // else: already 'X' by default, no need to reassign

        const mapping = templateExportService.REKAP_KELAS_GASAL_MAPPING;
        const templateFile = mapping.templateFile(tingkat);
        
        // Check if template exists
        const hasTemplate = await templateExportService.templateExists(templateFile);
        if (!hasTemplate) {
            const error = new AppError(
                ERROR_CODES.FILE_NOT_FOUND,
                ERROR_TEMPLATE_NOT_FOUND,
                `Please copy "${templateFile}" to server/templates/excel/`
            );
            return sendErrorResponse(res, error, null, null, {
                fallback: '/api/export/rekap-ketidakhadiran-siswa'
            });
        }

        // Load template
        const workbook = await templateExportService.loadTemplate(templateFile);
        
        // Find or use first sheet
        let worksheet = workbook.worksheets.find(ws => ws.name.includes(namaKelas.split(' ').pop()));
        if (!worksheet) worksheet = workbook.worksheets[0];

        // Set header cells (kelas name, wali kelas)
        if (mapping.headerCells) {
            templateExportService.setCell(worksheet, mapping.headerCells.namaKelas, namaKelas);
            
            // Get wali kelas from DB
            const [waliKelasResult] = await globalThis.dbPool.execute(
                `SELECT g.nama as wali_kelas_nama
                 FROM kelas k 
                 LEFT JOIN guru g ON k.wali_kelas_id = g.id_guru 
                 WHERE k.id_kelas = ?`,
                [kelas_id]
            );
            const waliKelasNama = waliKelasResult[0]?.wali_kelas_nama || '-';
            if (mapping.headerCells.waliKelas) {
                templateExportService.setCell(worksheet, mapping.headerCells.waliKelas, waliKelasNama);
            }
        }

        // Query siswa and attendance data
        const query = `
            SELECT 
                s.id_siswa,
                s.nis,
                s.nama,
                s.jenis_kelamin,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 7 AND a.status = 'Sakit' THEN 1 ELSE 0 END), 0) as jul_s,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 7 AND a.status = 'Izin' THEN 1 ELSE 0 END), 0) as jul_i,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 7 AND a.status = 'Alpa' THEN 1 ELSE 0 END), 0) as jul_a,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 8 AND a.status = 'Sakit' THEN 1 ELSE 0 END), 0) as agt_s,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 8 AND a.status = 'Izin' THEN 1 ELSE 0 END), 0) as agt_i,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 8 AND a.status = 'Alpa' THEN 1 ELSE 0 END), 0) as agt_a,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 9 AND a.status = 'Sakit' THEN 1 ELSE 0 END), 0) as sep_s,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 9 AND a.status = 'Izin' THEN 1 ELSE 0 END), 0) as sep_i,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 9 AND a.status = 'Alpa' THEN 1 ELSE 0 END), 0) as sep_a,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 10 AND a.status = 'Sakit' THEN 1 ELSE 0 END), 0) as okt_s,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 10 AND a.status = 'Izin' THEN 1 ELSE 0 END), 0) as okt_i,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 10 AND a.status = 'Alpa' THEN 1 ELSE 0 END), 0) as okt_a,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 11 AND a.status = 'Sakit' THEN 1 ELSE 0 END), 0) as nov_s,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 11 AND a.status = 'Izin' THEN 1 ELSE 0 END), 0) as nov_i,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 11 AND a.status = 'Alpa' THEN 1 ELSE 0 END), 0) as nov_a,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 12 AND a.status = 'Sakit' THEN 1 ELSE 0 END), 0) as des_s,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 12 AND a.status = 'Izin' THEN 1 ELSE 0 END), 0) as des_i,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 12 AND a.status = 'Alpa' THEN 1 ELSE 0 END), 0) as des_a
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND YEAR(a.tanggal) = ?
                AND MONTH(a.tanggal) BETWEEN 7 AND 12
            WHERE s.kelas_id = ? AND s.status = 'aktif'
            GROUP BY s.id_siswa, s.nis, s.nama, s.jenis_kelamin
            ORDER BY s.nama
        `;

        const [siswaRows] = await globalThis.dbPool.execute(query, [tahun, kelas_id]);

        // Transform data
        const templateData = siswaRows.map((row, index) => ({
            no: index + 1,
            nis: row.nis || '',
            nama: row.nama,
            jk: row.jenis_kelamin === 'Laki-laki' ? 'L' : 'P',
            jul_s: row.jul_s || 0,
            jul_i: row.jul_i || 0,
            jul_a: row.jul_a || 0,
            agt_s: row.agt_s || 0,
            agt_i: row.agt_i || 0,
            agt_a: row.agt_a || 0,
            sep_s: row.sep_s || 0,
            sep_i: row.sep_i || 0,
            sep_a: row.sep_a || 0,
            okt_s: row.okt_s || 0,
            okt_i: row.okt_i || 0,
            okt_a: row.okt_a || 0,
            nov_s: row.nov_s || 0,
            nov_i: row.nov_i || 0,
            nov_a: row.nov_a || 0,
            des_s: row.des_s || 0,
            des_i: row.des_i || 0,
            des_a: row.des_a || 0
        }));

        // Clone row styles if needed
        const templateRowCount = 40;
        if (templateData.length > templateRowCount) {
            for (let i = templateRowCount; i < templateData.length; i++) {
                templateExportService.cloneRowStyle(worksheet, mapping.startRow, mapping.startRow + i);
            }
        }

        // Fill data (preserves formulas in JML columns)
        templateExportService.fillCells(worksheet, templateData, mapping, mapping.startRow);

        // Send response
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="REKAP_KETIDAKHADIRAN_${namaKelas.replaceAll(/\s+/g, '_')}_${tahun}_GASAL.xlsx"`);
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        logger.error('Template export rekap ketidakhadiran kelas error', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * List available templates
 * GET /api/export/templates
 */
export const listExportTemplates = async (req, res) => {
    try {
        const templates = await templateExportService.listTemplates();
        res.json({
            success: true,
            templates,
            templateDir: 'server/templates/excel/',
            message: templates.length === 0 
                ? 'No templates found. Please copy template files to server/templates/excel/'
                : `Found ${templates.length} template(s)`
        });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

const getExcelStyles = () => ({
    headerStyle: {
        font: { bold: true, size: 10 },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCCCCC' } }
    },
    cellStyle: {
        font: { size: 9 },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    },
    classStyle: {
        font: { bold: true, size: 10 },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF99' } }
    },
    specialStyle: {
         fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFA500' } },
         font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
    }
});

const fillScheduleData = (worksheet, cls, scheduleMap, dayNames, maxJam, currentRow, styles) => {
    const { cellStyle, specialStyle } = styles;
    
    // Labels: MAPEL, RUANG, GURU
    worksheet.getCell(`B${currentRow}`).value = 'MAPEL';
    worksheet.getCell(`B${currentRow + 1}`).value = 'RUANG';
    worksheet.getCell(`B${currentRow + 2}`).value = 'GURU';

    [0, 1, 2].forEach(offset => {
        worksheet.getCell(`B${currentRow + offset}`).style = { 
            ...cellStyle, 
            font: { bold: true }, 
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } } 
        };
    });

    // Fill Data
    let dayColOffset = 3;
    dayNames.forEach(day => {
        for (let j = 1; j <= maxJam; j++) {
            const data = scheduleMap[cls.id_kelas]?.[day]?.[j];
            const targetCol = dayColOffset + (j - 1);
            const isSpecial = data && data.jenis_aktivitas !== 'pelajaran';
            
            if (isSpecial) {
                 // Only process on the first row (MAPEL row) to merge downwards
                 const cell = worksheet.getCell(currentRow, targetCol);
                 worksheet.mergeCells(currentRow, targetCol, currentRow + 2, targetCol);
                 cell.value = data.nama_mapel || data.keterangan_khusus || data.jenis_aktivitas.toUpperCase();
                 cell.style = { ...cellStyle, ...specialStyle };
            } else {
                // MAPEL
                const cellMapel = worksheet.getCell(currentRow, targetCol);
                cellMapel.value = data ? (data.nama_mapel || '-') : '';
                cellMapel.style = cellStyle;
                
                // RUANG
                const cellRuang = worksheet.getCell(currentRow + 1, targetCol);
                cellRuang.value = data ? (data.kode_ruang || data.nama_ruang || '-') : '';
                cellRuang.style = cellStyle;

                // GURU
                const cellGuru = worksheet.getCell(currentRow + 2, targetCol);
                cellGuru.value = data ? (data.nama_guru || '-') : '';
                cellGuru.style = cellStyle;
            }
        }
        dayColOffset += maxJam;
    });
};

/**
 * Export Schedule Matrix to Excel
 * GET /api/export/checklist-jadwal
 */
export const exportScheduleExcel = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('ExportScheduleExcel', {});

    try {
        const { classes, scheduleMap } = await ExportService.getScheduleMatrixData();
        
        // Setup Workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('JADWAL PELAJARAN');
        const styles = getExcelStyles();
        const { headerStyle, classStyle } = styles;

        // Define Days and Slots
        const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
        const maxJam = 11;

        // ROW 1: DAY HEADERS
        worksheet.mergeCells(`A1:A2`);
        worksheet.getCell('A1').value = 'KELAS';
        worksheet.getCell('A1').style = headerStyle;

        worksheet.mergeCells(`B1:B2`);
        worksheet.getCell('B1').value = 'JAM KE';
        worksheet.getCell('B1').style = headerStyle;

        let colIdx = 3;
        dayNames.forEach(day => {
            const startCol = colIdx;
            const endCol = colIdx + maxJam - 1;
            worksheet.mergeCells(1, startCol, 1, endCol);
            const cell = worksheet.getCell(1, startCol);
            cell.value = day.toUpperCase();
            cell.style = { ...headerStyle, fill: { ...headerStyle.fill, fgColor: { argb: 'FF4472C4' } }, font: { ...headerStyle.font, color: { argb: 'FFFFFFFF' } } }; // Blue header
            
            // Sub-headers for Jam Ke
            for (let j = 1; j <= maxJam; j++) {
                const subCell = worksheet.getCell(2, colIdx + j - 1);
                subCell.value = j;
                subCell.style = { ...headerStyle, fill: { ...headerStyle.fill, fgColor: { argb: 'FFD9D9D9' } } }; 
            }
            colIdx += maxJam;
        });

        // ROW 3+: DATA
        let currentRow = 3;

        for (const cls of classes) {
            // Merge Class Name Cell (3 Rows)
            worksheet.mergeCells(`A${currentRow}:A${currentRow + 2}`);
            const classCell = worksheet.getCell(`A${currentRow}`);
            classCell.value = cls.nama_kelas;
            classCell.style = classStyle;

            fillScheduleData(worksheet, cls, scheduleMap, dayNames, maxJam, currentRow, styles);
            currentRow += 3;
        }

        // Auto Width
        worksheet.getColumn('A').width = 15;
        worksheet.getColumn('B').width = 10;
        for(let c = 3; c < colIdx; c++) {
            worksheet.getColumn(c).width = 12;
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="JADWAL_PELAJARAN_${new Date().getFullYear()}.xlsx"`);
        
        await workbook.xlsx.write(res);
        res.end();
        log.success('ExportScheduleExcel', { rows: classes.length });

    } catch (error) {
        log.error('ExportScheduleExcel Error', error);
        return sendDatabaseError(res, error);
    }
};

/**
 * Export rekap ketidakhadiran guru SMKN13
 * GET /api/export/rekap-ketidakhadiran-guru-smkn13
 */
export const exportRekapKetidakhadiranGuruSmkn13 = async (req, res) => {
    return exportRekapKetidakhadiranGuru(req, res);
};
