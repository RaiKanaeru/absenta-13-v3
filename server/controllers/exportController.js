/**
 * Export Controller
 * Menangani logika pembuatan Excel/laporan
 * Direfaktor dari server_modern.js
 */

import ExcelJS from 'exceljs';
import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Export');

import { buildExcel } from '../../backend/export/excelBuilder.js';
import { getLetterhead, REPORT_KEYS } from '../../backend/utils/letterheadService.js';
import { formatWIBTime, formatWIBDate, getWIBTime } from '../utils/timeUtils.js';

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
        let query = `
            SELECT ag.tanggal, ag.status, ag.keterangan, ag.waktu_catat,
                   j.jam_ke, j.jam_mulai, j.jam_selesai, j.hari,
                   COALESCE(g.nama, 'Sistem') as nama_guru, g.nip,
                   k.nama_kelas, COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel,
                   s.nama as nama_pencatat, s.nis
            FROM absensi_guru ag
            JOIN jadwal j ON ag.jadwal_id = j.id_jadwal
            LEFT JOIN guru g ON ag.guru_id = g.id_guru
            JOIN kelas k ON ag.kelas_id = k.id_kelas
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            JOIN siswa s ON ag.siswa_pencatat_id = s.id_siswa
        `;

        let params = [];
        let whereConditions = [];

        if (date_start) {
            whereConditions.push('ag.tanggal >= ?');
            params.push(date_start);
        }
        if (date_end) {
            whereConditions.push('ag.tanggal <= ?');
            params.push(date_end);
        }

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        query += ' ORDER BY ag.tanggal DESC, k.nama_kelas, j.jam_ke';

        const [rows] = await globalThis.dbPool.execute(query, params);

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
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=absensi-guru-${formatWIBDate()}.xlsx`);

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
        const [teachers] = await globalThis.dbPool.execute(`
            SELECT 
                nama,
                nip
            FROM guru 
            WHERE status = 'aktif'
            ORDER BY nama
        `);

        const workbook = await exportSystem.exportTeacherList(teachers, academicYear);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Daftar_Guru_${academicYear.replace('-', '_')}_${Date.now()}.xlsx"`);

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
        let query = `
            SELECT 
                s.nama,
                s.nis,
                k.nama_kelas,
                COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END), 0) as H,
                COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) as I,
                COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) as S,
                COALESCE(SUM(CASE WHEN a.status = 'Alpa' THEN 1 ELSE 0 END), 0) as A,
                COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) as D,
                COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(a.id), 0), 0) as presentase
            FROM siswa s
            LEFT JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND a.tanggal BETWEEN ? AND ?
            WHERE s.status = 'aktif'
        `;

        const params = [startDate, endDate];

        if (kelas_id && kelas_id !== 'all') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }

        query += ' GROUP BY s.id_siswa, s.nama, s.nis, k.nama_kelas ORDER BY k.nama_kelas, s.nama';

        const [students] = await globalThis.dbPool.execute(query, params);

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
            title: studentSummarySchema.default.title,
            subtitle: studentSummarySchema.default.subtitle,
            reportPeriod: reportPeriod,
            letterhead: letterhead,
            columns: studentSummarySchema.default.columns,
            rows: reportData
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Ringkasan_Kehadiran_Siswa_${startDate}_${endDate}_${Date.now()}.xlsx"`);

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
        const [teachers] = await globalThis.dbPool.execute(`
            SELECT 
                g.nama,
                g.nip,
                COALESCE(SUM(CASE WHEN kg.status = 'hadir' THEN 1 ELSE 0 END), 0) as H,
                COALESCE(SUM(CASE WHEN kg.status = 'izin' THEN 1 ELSE 0 END), 0) as I,
                COALESCE(SUM(CASE WHEN kg.status = 'sakit' THEN 1 ELSE 0 END), 0) as S,
                COALESCE(SUM(CASE WHEN kg.status = 'alpa' THEN 1 ELSE 0 END), 0) as A,
                COALESCE(SUM(CASE WHEN kg.status = 'hadir' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(kg.id), 0), 0) as presentase
            FROM guru g
            LEFT JOIN kehadiran_guru kg ON g.id_guru = kg.guru_id 
                AND kg.tanggal BETWEEN ? AND ?
            WHERE g.status = 'aktif'
            GROUP BY g.id_guru, g.nama, g.nip
            ORDER BY g.nama
        `, [startDate, endDate]);

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

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Ringkasan_Kehadiran_Guru_${startDate}_${endDate}_${Date.now()}.xlsx"`);

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
        const { formatWIBDate } = await import('../utils/timeUtils.js');

        let query = `
            SELECT 
                pba.id_banding,
                DATE_FORMAT(pba.tanggal_pengajuan, '%Y-%m-%d') as tanggal_pengajuan,
                DATE_FORMAT(pba.tanggal_absen, '%Y-%m-%d') as tanggal_absen,
                s.nama as nama_pengaju,
                COALESCE(k.nama_kelas, '-') as nama_kelas,
                COALESCE(m.nama_mapel, 'Umum') as nama_mapel,
                COALESCE(g.nama, 'Belum Ditentukan') as nama_guru,
                COALESCE(j.jam_mulai, '00:00') as jam_mulai,
                COALESCE(j.jam_selesai, '00:00') as jam_selesai,
                COALESCE(CONCAT(j.jam_mulai, ' - ', j.jam_selesai), '-') as jadwal,
                pba.status_asli,
                pba.status_diajukan,
                pba.alasan_banding,
                pba.status_banding,
                COALESCE(pba.catatan_guru, '-') as catatan_guru,
                COALESCE(DATE_FORMAT(pba.tanggal_keputusan, '%Y-%m-%d %H:%i'), '-') as tanggal_keputusan,
                COALESCE(guru_proses.nama, 'Belum Diproses') as diproses_oleh,
                pba.jenis_banding
            FROM pengajuan_banding_absen pba
            JOIN siswa s ON pba.siswa_id = s.id_siswa
            LEFT JOIN kelas k ON s.kelas_id = k.id_kelas OR pba.kelas_id = k.id_kelas
            LEFT JOIN jadwal j ON pba.jadwal_id = j.id_jadwal
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru guru_proses ON pba.diproses_oleh = guru_proses.id_guru
            WHERE DATE(pba.tanggal_pengajuan) BETWEEN ? AND ?
        `;

        const params = [startDate, endDate];

        if (kelas_id && kelas_id !== 'all') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }

        if (status && status !== 'all') {
            query += ' AND pba.status_banding = ?';
            params.push(status);
        }

        query += ' ORDER BY pba.tanggal_pengajuan DESC';

        const [bandingData] = await globalThis.dbPool.execute(query, params);

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

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Banding_Absen_${startDate}_${endDate}_${Date.now()}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Export rekap ketidakhadiran guru - Format SMK13
 * GET /api/export/rekap-ketidakhadiran-guru
 * Template: REKAP KETIDAKHADIRAN GURU with BULAN/JUMLAH HARI EFEKTIF KERJA header
 */
export const exportRekapKetidakhadiranGuru = async (req, res) => {
    try {
        const { tahun } = req.query;
        const tahunAjaran = tahun || getWIBTime().getFullYear();
        // Hari efektif per bulan (configurable)
        const hariEfektifPerBulan = {
            7: 14, 8: 21, 9: 22, 10: 23, 11: 20, 12: 17,  // Jul-Des
            1: 15, 2: 20, 3: 22, 4: 22, 5: 21, 6: 20     // Jan-Jun
        };

        // Calculate total hari efektif
        const totalHariEfektif = Object.values(hariEfektifPerBulan).reduce((sum, h) => sum + h, 0);

        // Query data guru dengan ketidakhadiran per bulan
        const query = `
            SELECT 
                g.id_guru as id,
                g.nama,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 7 AND a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) as jul,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 8 AND a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) as agt,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 9 AND a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) as sep,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 10 AND a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) as okt,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 11 AND a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) as nov,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 12 AND a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) as des,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 1 AND a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) as jan,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 2 AND a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) as feb,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 3 AND a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) as mar,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 4 AND a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) as apr,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 5 AND a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) as mei,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 6 AND a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) as jun
            FROM guru g
            LEFT JOIN absensi_guru a ON g.id_guru = a.guru_id 
                AND (
                    (MONTH(a.tanggal) >= 7 AND YEAR(a.tanggal) = ?)
                    OR (MONTH(a.tanggal) <= 6 AND YEAR(a.tanggal) = ? + 1)
                )
            WHERE g.status = 'aktif'
            GROUP BY g.id_guru, g.nama
            ORDER BY g.nama
        `;

        const [rows] = await globalThis.dbPool.execute(query, [tahunAjaran, tahunAjaran]);

        // Build Excel using ExcelJS directly
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('REKAP KETIDAKHADIRAN GURU');

        // Styles
        const titleStyle = { font: { bold: true, size: 12, color: { argb: 'FFCC0000' } }, alignment: { horizontal: 'center' } };
        const headerStyle = {
            font: { bold: true, size: 10 },
            alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
            border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
        };
        const dataStyle = {
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
        };

        // Color fills for columns
        const greenFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };
        const cyanFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B0F0' } };
        const yellowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
        const lightGreenFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };

        // Title Headers (Row 1-3)
        worksheet.mergeCells('A1:Q1');
        worksheet.getCell('A1').value = 'REKAP KETIDAKHADIRAN GURU';
        Object.assign(worksheet.getCell('A1'), titleStyle);

        worksheet.mergeCells('A2:Q2');
        worksheet.getCell('A2').value = 'SMK NEGERI 13 BANDUNG';
        Object.assign(worksheet.getCell('A2'), titleStyle);

        worksheet.mergeCells('A3:Q3');
        worksheet.getCell('A3').value = `TAHUN PELAJARAN ${tahunAjaran}-${parseInt(tahunAjaran) + 1}`;
        Object.assign(worksheet.getCell('A3'), titleStyle);

        // Header Row 1 - BULAN / JUMLAH HARI EFEKTIF KERJA (Row 5)
        const headerRow1 = 5;
        worksheet.mergeCells(`A${headerRow1}:B${headerRow1}`);
        worksheet.getCell(`A${headerRow1}`).value = '';
        
        worksheet.mergeCells(`C${headerRow1}:N${headerRow1}`);
        worksheet.getCell(`C${headerRow1}`).value = 'BULAN/ JUMLAH HARI EFEKTIF KERJA';
        Object.assign(worksheet.getCell(`C${headerRow1}`), headerStyle);

        // Kolom summary headers di row 5
        worksheet.getCell(`O${headerRow1}`).value = 'JUMLAH SE KETIDAK\nHADIRAN';
        worksheet.getCell(`P${headerRow1}`).value = 'PERSENTA SE KETIDAKH ADIRAN';
        worksheet.getCell(`Q${headerRow1}`).value = 'PERSENTA SE KEHADIRA N (%)';
        
        [`O${headerRow1}`, `P${headerRow1}`, `Q${headerRow1}`].forEach(cell => {
            Object.assign(worksheet.getCell(cell), { ...headerStyle, fill: yellowFill });
        });

        // Header Row 2 - Month names with hari efektif (Row 6)
        const headerRow2 = 6;
        const monthOrder = ['JUL', 'AGT', 'SEP', 'OKT', 'NOV', 'DES', 'JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN'];
        const monthCols = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // C-N

        worksheet.getCell(`A${headerRow2}`).value = 'NO.';
        worksheet.getCell(`B${headerRow2}`).value = 'NAMA GURU';
        Object.assign(worksheet.getCell(`A${headerRow2}`), { ...headerStyle, fill: yellowFill });
        Object.assign(worksheet.getCell(`B${headerRow2}`), { ...headerStyle, fill: yellowFill });

        monthOrder.forEach((month, idx) => {
            const col = monthCols[idx];
            worksheet.getCell(headerRow2, col).value = month;
            Object.assign(worksheet.getCell(headerRow2, col), { ...headerStyle, fill: greenFill });
        });

        // Header Row 3 - Hari efektif numbers (Row 7)
        const headerRow3 = 7;
        worksheet.mergeCells(`A${headerRow1}:A${headerRow3}`);
        worksheet.mergeCells(`B${headerRow1}:B${headerRow3}`);
        worksheet.getCell(`A${headerRow1}`).value = 'NO.';
        worksheet.getCell(`B${headerRow1}`).value = 'NAMA GURU';
        Object.assign(worksheet.getCell(`A${headerRow1}`), { ...headerStyle, fill: yellowFill });
        Object.assign(worksheet.getCell(`B${headerRow1}`), { ...headerStyle, fill: yellowFill });

        const hariPerMonth = [14, 21, 22, 23, 20, 17, 15, 20, 22, 22, 21, 20]; // Jul-Jun
        monthCols.forEach((col, idx) => {
            worksheet.getCell(headerRow3, col).value = hariPerMonth[idx];
            Object.assign(worksheet.getCell(headerRow3, col), { ...headerStyle, fill: cyanFill });
        });

        // Merge summary column headers across 3 rows
        ['O', 'P', 'Q'].forEach(c => {
            worksheet.mergeCells(`${c}${headerRow1}:${c}${headerRow3}`);
        });

        // Data rows starting at row 8
        let dataRow = 8;
        rows.forEach((guru, index) => {
            const monthlyData = [guru.jul, guru.agt, guru.sep, guru.okt, guru.nov, guru.des, guru.jan, guru.feb, guru.mar, guru.apr, guru.mei, guru.jun];
            const totalKetidakhadiran = monthlyData.reduce((sum, val) => sum + (parseInt(val) || 0), 0);
            const persenKetidakhadiran = totalHariEfektif > 0 ? ((totalKetidakhadiran / totalHariEfektif) * 100).toFixed(2) : '0.00';
            const persenKehadiran = (100 - parseFloat(persenKetidakhadiran)).toFixed(2);

            worksheet.getCell(`A${dataRow}`).value = index + 1;
            worksheet.getCell(`B${dataRow}`).value = guru.nama;
            Object.assign(worksheet.getCell(`A${dataRow}`), dataStyle);
            Object.assign(worksheet.getCell(`B${dataRow}`), { ...dataStyle, alignment: { horizontal: 'left', vertical: 'middle' } });

            monthCols.forEach((col, idx) => {
                worksheet.getCell(dataRow, col).value = parseInt(monthlyData[idx]) || 0;
                Object.assign(worksheet.getCell(dataRow, col), { ...dataStyle, fill: idx < 6 ? lightGreenFill : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0FFFF' } } });
            });

            worksheet.getCell(`O${dataRow}`).value = totalKetidakhadiran;
            worksheet.getCell(`P${dataRow}`).value = parseFloat(persenKetidakhadiran);
            worksheet.getCell(`Q${dataRow}`).value = parseFloat(persenKehadiran);
            ['O', 'P', 'Q'].forEach(c => Object.assign(worksheet.getCell(`${c}${dataRow}`), dataStyle));

            dataRow++;
        });

        // Set column widths
        worksheet.getColumn(1).width = 5;   // NO
        worksheet.getColumn(2).width = 35;  // NAMA GURU
        for (let i = 3; i <= 14; i++) worksheet.getColumn(i).width = 5; // Months
        worksheet.getColumn(15).width = 10; // JUMLAH
        worksheet.getColumn(16).width = 10; // % KETIDAKHADIRAN
        worksheet.getColumn(17).width = 10; // % KEHADIRAN

        // Set row heights
        worksheet.getRow(headerRow1).height = 25;
        worksheet.getRow(headerRow2).height = 20;
        worksheet.getRow(headerRow3).height = 20;

        const filename = `Rekap_Ketidakhadiran_Guru_${tahunAjaran}-${parseInt(tahunAjaran) + 1}`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        logger.error('Error exporting rekap ketidakhadiran guru', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

// ================================================
// GURU & ADMIN EXPORTS - Using excelLetterhead utility
// ================================================

import { addLetterheadToWorksheet, addReportTitle, addHeaders } from '../utils/excelLetterhead.js';
import { excelStyles, applyStyle, applyHeaderRow, borders, colors, formatTime, parseGuruList, getStatusStyle, addSummaryRow, applyAlternatingColors } from '../utils/excelStyles.js';

/**
 * Export riwayat banding absen
 * GET /api/export/riwayat-banding-absen
 */
export const exportRiwayatBandingAbsen = async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, status } = req.query;
        const guruId = req.user.guru_id;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan akhir harus diisi' });
        }

        let query = `
            SELECT 
                ba.id,
                DATE_FORMAT(ba.tanggal_pengajuan, '%Y-%m-%d') as tanggal_pengajuan,
                DATE_FORMAT(ba.tanggal_absen, '%Y-%m-%d') as tanggal_absen,
                ba.status_absen,
                ba.alasan_banding,
                ba.status,
                DATE_FORMAT(ba.tanggal_disetujui, '%Y-%m-%d') as tanggal_disetujui,
                ba.catatan,
                s.nama as nama_siswa,
                s.nis,
                k.nama_kelas
            FROM pengajuan_banding_absen ba
            JOIN siswa s ON ba.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE ba.tanggal_pengajuan BETWEEN ? AND ?
                AND ba.guru_id = ?
        `;

        const params = [startDate, endDate, guruId];

        if (kelas_id && kelas_id !== 'all') {
            query += ` AND s.kelas_id = ?`;
            params.push(kelas_id);
        }

        if (status && status !== 'all') {
            query += ` AND ba.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY ba.tanggal_pengajuan DESC, s.nama`;

        const [rows] = await globalThis.dbPool.execute(query, params);

        // Get class name for title
        let className = 'Semua Kelas';
        if (kelas_id && kelas_id !== 'all') {
            const [kelasRows] = await globalThis.dbPool.execute(
                'SELECT nama_kelas FROM kelas WHERE id_kelas = ?',
                [kelas_id]
            );
            if (kelasRows.length > 0) {
                className = kelasRows[0].nama_kelas;
            }
        }

        // Load letterhead
        // getLetterhead and REPORT_KEYS already imported at top of file (line 11)
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.BANDING_ABSEN });

        // Create Excel
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('RIWAYAT BANDING ABSEN');

        // Add letterhead
        let currentRow = await addLetterheadToWorksheet(workbook, worksheet, letterhead, 11);

        // Add title
        currentRow = addReportTitle(
            worksheet, 
            'RIWAYAT PENGAJUAN BANDING ABSEN',
            `Periode: ${startDate} s/d ${endDate} - Kelas: ${className}`,
            currentRow,
            11
        );

        // Headers
        const headers = ['NO', 'TANGGAL', 'NAMA SISWA', 'NIS', 'KELAS', 'TANGGAL ABSEN', 'STATUS ABSEN', 'ALASAN BANDING', 'STATUS', 'TGL DISETUJUI', 'CATATAN'];
        addHeaders(worksheet, headers, currentRow);
        currentRow++;

        // Data rows
        rows.forEach((item, index) => {
            const row = currentRow + index;
            worksheet.getCell(row, 1).value = index + 1;
            worksheet.getCell(row, 2).value = item.tanggal_pengajuan;
            worksheet.getCell(row, 3).value = item.nama_siswa;
            worksheet.getCell(row, 4).value = item.nis;
            worksheet.getCell(row, 5).value = item.nama_kelas;
            worksheet.getCell(row, 6).value = item.tanggal_absen;
            worksheet.getCell(row, 7).value = item.status_absen;
            worksheet.getCell(row, 8).value = item.alasan_banding;
            worksheet.getCell(row, 9).value = item.status === 'approved' ? 'Disetujui' :
                item.status === 'rejected' ? 'Ditolak' : 'Pending';
            worksheet.getCell(row, 10).value = item.tanggal_disetujui || '-';
            worksheet.getCell(row, 11).value = item.catatan || '-';
        });

        // Response
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="riwayat-banding-absen-${startDate}-${endDate}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// ================================================
// MORE GURU & ADMIN EXPORTS
// ================================================

/**
 * Export presensi siswa SMKN13 format
 * GET /api/export/presensi-siswa-smkn13
 */
export const exportPresensiSiswaSmkn13 = async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        const guruId = req.user.guru_id;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan akhir harus diisi' });
        }

        let query = `
            SELECT 
                DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal,
                j.hari,
                j.jam_mulai,
                j.jam_selesai,
                COALESCE(m.nama_mapel, j.keterangan_khusus) as mata_pelajaran,
                k.nama_kelas,
                COALESCE(g.nama, 'Sistem') as nama_guru,
                COUNT(DISTINCT s.id_siswa) as total_siswa,
                COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as hadir,
                COUNT(CASE WHEN a.status = 'Izin' THEN 1 END) as izin,
                COUNT(CASE WHEN a.status = 'Sakit' THEN 1 END) as sakit,
                COUNT(CASE WHEN a.status = 'Alpa' THEN 1 END) as alpa,
                COUNT(CASE WHEN a.status = 'Dispen' THEN 1 END) as dispen
            FROM absensi_siswa a
            JOIN jadwal j ON a.jadwal_id = j.id_jadwal
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN siswa s ON j.kelas_id = s.kelas_id AND s.status = 'aktif'
            WHERE a.tanggal BETWEEN ? AND ?
                AND j.guru_id = ?
        `;

        const params = [startDate, endDate, guruId];

        if (kelas_id && kelas_id !== 'all') {
            query += ` AND j.kelas_id = ?`;
            params.push(kelas_id);
        }

        query += `
            GROUP BY a.tanggal, j.hari, j.jam_mulai, j.jam_selesai, m.nama_mapel, k.nama_kelas, g.nama
            ORDER BY a.tanggal DESC, j.jam_mulai
        `;

        const [rows] = await globalThis.dbPool.execute(query, params);

        // Get class name for title
        let className = 'Semua Kelas';
        if (kelas_id && kelas_id !== 'all') {
            const [kelasRows] = await globalThis.dbPool.execute(
                'SELECT nama_kelas FROM kelas WHERE id_kelas = ?',
                [kelas_id]
            );
            if (kelasRows.length > 0) {
                className = kelasRows[0].nama_kelas;
            }
        }

        // Import required modules
        const { buildExcel } = await import('../../backend/export/excelBuilder.js');
        // getLetterhead and REPORT_KEYS already imported at top of file (line 11)
        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.PRESENSI_SISWA });

        // Prepare data for Excel
        const reportData = rows.map((item, index) => {
            const total = item.total_siswa || 0;
            const hadir = item.hadir || 0;
            const presentase = total > 0 ? ((hadir / total) * 100).toFixed(1) : '0.0';

            return {
                no: index + 1,
                tanggal: item.tanggal,
                hari: item.hari,
                jam: `${item.jam_mulai} - ${item.jam_selesai}`,
                mata_pelajaran: item.mata_pelajaran,
                kelas: item.nama_kelas,
                guru: item.nama_guru,
                total_siswa: total,
                hadir: hadir,
                izin: item.izin || 0,
                sakit: item.sakit || 0,
                alpa: item.alpa || 0,
                dispen: item.dispen || 0,
                persentase: `${presentase}%`
            };
        });

        // Define columns
        const columns = [
            { key: 'no', label: 'NO', width: 5, align: 'center' },
            { key: 'tanggal', label: 'TANGGAL', width: 12, align: 'center' },
            { key: 'hari', label: 'HARI', width: 10, align: 'center' },
            { key: 'jam', label: 'JAM', width: 15, align: 'center' },
            { key: 'mata_pelajaran', label: 'MATA PELAJARAN', width: 20, align: 'left' },
            { key: 'kelas', label: 'KELAS', width: 12, align: 'center' },
            { key: 'guru', label: 'GURU', width: 20, align: 'left' },
            { key: 'total_siswa', label: 'TOTAL SISWA', width: 12, align: 'center' },
            { key: 'hadir', label: 'HADIR', width: 8, align: 'center' },
            { key: 'izin', label: 'IZIN', width: 8, align: 'center' },
            { key: 'sakit', label: 'SAKIT', width: 8, align: 'center' },
            { key: 'alpa', label: 'ALPA', width: 8, align: 'center' },
            { key: 'dispen', label: 'DISPEN', width: 8, align: 'center' },
            { key: 'persentase', label: 'PERSENTASE (%)', width: 12, align: 'center' }
        ];

        const reportPeriod = `Periode: ${startDate} s/d ${endDate} - Kelas: ${className}`;

        // Generate Excel workbook
        const workbook = await buildExcel({
            title: 'PRESENSI SISWA',
            subtitle: 'Laporan Presensi Siswa SMKN 13',
            reportPeriod: reportPeriod,
            showLetterhead: letterhead.enabled,
            letterhead: letterhead,
            columns: columns,
            rows: reportData
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="presensi-siswa-smkn13-${startDate}-${endDate}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// ================================================
// MORE EXPORTS - Using excelLetterhead utility
// ================================================

/**
 * Export rekap ketidakhadiran
 * GET /api/export/rekap-ketidakhadiran
 */
export const exportRekapKetidakhadiran = async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, reportType } = req.query;
        const guruId = req.user.guru_id;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan akhir harus diisi' });
        }

        let query;
        let params;

        if (reportType === 'bulanan') {
            query = `
                SELECT 
                    DATE_FORMAT(a.tanggal, '%Y-%m') as periode,
                    k.nama_kelas,
                    COUNT(DISTINCT s.id_siswa) as total_siswa,
                    COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as hadir,
                    COUNT(CASE WHEN a.status = 'Izin' THEN 1 END) as izin,
                    COUNT(CASE WHEN a.status = 'Sakit' THEN 1 END) as sakit,
                    COUNT(CASE WHEN a.status = 'Alpa' THEN 1 END) as alpa,
                    COUNT(CASE WHEN a.status = 'Dispen' THEN 1 END) as dispen
                FROM absensi_siswa a
                JOIN siswa s ON a.siswa_id = s.id_siswa
                JOIN kelas k ON s.kelas_id = k.id_kelas
                JOIN jadwal j ON a.jadwal_id = j.id_jadwal
                WHERE a.tanggal BETWEEN ? AND ?
                    AND j.guru_id = ?
            `;
            params = [startDate, endDate, guruId];

            if (kelas_id && kelas_id !== 'all') {
                query += ` AND s.kelas_id = ?`;
                params.push(kelas_id);
            }

            query += ` GROUP BY DATE_FORMAT(a.tanggal, '%Y-%m'), k.nama_kelas ORDER BY periode DESC, k.nama_kelas`;
        } else {
            query = `
                SELECT 
                    YEAR(a.tanggal) as periode,
                    k.nama_kelas,
                    COUNT(DISTINCT s.id_siswa) as total_siswa,
                    COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as hadir,
                    COUNT(CASE WHEN a.status = 'Izin' THEN 1 END) as izin,
                    COUNT(CASE WHEN a.status = 'Sakit' THEN 1 END) as sakit,
                    COUNT(CASE WHEN a.status = 'Alpa' THEN 1 END) as alpa,
                    COUNT(CASE WHEN a.status = 'Dispen' THEN 1 END) as dispen
                FROM absensi_siswa a
                JOIN siswa s ON a.siswa_id = s.id_siswa
                JOIN kelas k ON s.kelas_id = k.id_kelas
                JOIN jadwal j ON a.jadwal_id = j.id_jadwal
                WHERE a.tanggal BETWEEN ? AND ?
                    AND j.guru_id = ?
            `;
            params = [startDate, endDate, guruId];

            if (kelas_id && kelas_id !== 'all') {
                query += ` AND s.kelas_id = ?`;
                params.push(kelas_id);
            }

            query += ` GROUP BY YEAR(a.tanggal), k.nama_kelas ORDER BY periode DESC, k.nama_kelas`;
        }

        const [rows] = await globalThis.dbPool.execute(query, params);

        // Get class name
        let className = 'Semua Kelas';
        if (kelas_id && kelas_id !== 'all') {
            const [kelasRows] = await globalThis.dbPool.execute(
                'SELECT nama_kelas FROM kelas WHERE id_kelas = ?',
                [kelas_id]
            );
            if (kelasRows.length > 0) className = kelasRows[0].nama_kelas;
        }

        // Load letterhead
        // getLetterhead and REPORT_KEYS already imported at top of file (line 11)
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.REKAP_KETIDAKHADIRAN });

        // Create Excel
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('REKAP KETIDAKHADIRAN');

        // Add letterhead
        let currentRow = await addLetterheadToWorksheet(workbook, worksheet, letterhead, 12);

        // Add title
        currentRow = addReportTitle(
            worksheet,
            `REKAP KETIDAKHADIRAN ${reportType === 'bulanan' ? 'BULANAN' : 'TAHUNAN'}`,
            `Periode: ${startDate} s/d ${endDate} - Kelas: ${className}`,
            currentRow,
            12
        );

        // Headers
        const headers = ['NO', 'PERIODE', 'KELAS', 'TOTAL SISWA', 'HADIR', 'IZIN', 'SAKIT', 'ALPA', 'DISPEN', 'TOTAL ABSEN', '% HADIR', '% ABSEN'];
        addHeaders(worksheet, headers, currentRow);
        currentRow++;

        // Data rows
        rows.forEach((item, index) => {
            const row = currentRow + index;
            const totalSiswa = item.total_siswa || 0;
            const hadir = item.hadir || 0;
            const totalAbsen = (item.izin || 0) + (item.sakit || 0) + (item.alpa || 0) + (item.dispen || 0);
            const presentaseHadir = totalSiswa > 0 ? ((hadir / totalSiswa) * 100).toFixed(1) : '0.0';
            const presentaseAbsen = totalSiswa > 0 ? ((totalAbsen / totalSiswa) * 100).toFixed(1) : '0.0';

            worksheet.getCell(row, 1).value = index + 1;
            worksheet.getCell(row, 2).value = item.periode;
            worksheet.getCell(row, 3).value = item.nama_kelas;
            worksheet.getCell(row, 4).value = totalSiswa;
            worksheet.getCell(row, 5).value = hadir;
            worksheet.getCell(row, 6).value = item.izin || 0;
            worksheet.getCell(row, 7).value = item.sakit || 0;
            worksheet.getCell(row, 8).value = item.alpa || 0;
            worksheet.getCell(row, 9).value = item.dispen || 0;
            worksheet.getCell(row, 10).value = totalAbsen;
            worksheet.getCell(row, 11).value = `${presentaseHadir}%`;
            worksheet.getCell(row, 12).value = `${presentaseAbsen}%`;
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="rekap-ketidakhadiran-${reportType}-${startDate}-${endDate}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// ================================================
// MORE EXPORTS
// ================================================

/**
 * Export ringkasan kehadiran siswa SMKN13
 * GET /api/export/ringkasan-kehadiran-siswa-smkn13
 */
export const exportRingkasanKehadiranSiswaSmkn13 = async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        const guruId = req.user.guru_id;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan akhir harus diisi' });
        }

        let query = `
            SELECT 
                s.id_siswa as id, s.nis, s.nama, k.nama_kelas,
                COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END), 0) as H,
                COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) as I,
                COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) as S,
                COALESCE(SUM(CASE WHEN a.status = 'Alpa' THEN 1 ELSE 0 END), 0) as A,
                COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) as D,
                COUNT(a.id) as total_absen
            FROM siswa s
            LEFT JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND a.tanggal BETWEEN ? AND ?
                AND a.jadwal_id IN (SELECT j.id_jadwal FROM jadwal j WHERE j.guru_id = ?)
            WHERE s.status = 'aktif'
        `;

        const params = [startDate, endDate, guruId];
        if (kelas_id && kelas_id !== 'all') {
            query += ` AND s.kelas_id = ?`;
            params.push(kelas_id);
        }
        query += ` GROUP BY s.id_siswa, s.nis, s.nama, k.nama_kelas ORDER BY k.nama_kelas, s.nama`;

        const [rows] = await globalThis.dbPool.execute(query, params);

        // Calculate percentage
        const dataWithPercentage = rows.map(row => {
            const total = row.H + row.I + row.S + row.A + row.D;
            const presentase = total > 0 ? ((row.H / total) * 100).toFixed(2) : '0.00';
            return { ...row, presentase: parseFloat(presentase) };
        });

        // Get class name
        let className = 'Semua Kelas';
        if (kelas_id && kelas_id !== 'all') {
            const [kelasRows] = await globalThis.dbPool.execute('SELECT nama_kelas FROM kelas WHERE id_kelas = ?', [kelas_id]);
            if (kelasRows.length > 0) className = kelasRows[0].nama_kelas;
        }

        // Load letterhead
        // getLetterhead and REPORT_KEYS already imported at top of file (line 11)
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.REKAP_KETIDAKHADIRAN });

        // Create Excel
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('RINGKASAN KEHADIRAN SISWA');

        // Add letterhead
        let currentRow = await addLetterheadToWorksheet(workbook, worksheet, letterhead, 11);

        // Add title
        currentRow = addReportTitle(worksheet, 'RINGKASAN KEHADIRAN SISWA', `Periode: ${startDate} s/d ${endDate} - Kelas: ${className}`, currentRow, 11);

        // Headers
        const headers = ['NO', 'NAMA SISWA', 'NIS', 'KELAS', 'HADIR', 'IZIN', 'SAKIT', 'ALPA', 'DISPEN', 'TOTAL', '%'];
        addHeaders(worksheet, headers, currentRow);
        currentRow++;

        // Data rows
        dataWithPercentage.forEach((siswa, index) => {
            const row = currentRow + index;
            const total = siswa.H + siswa.I + siswa.S + siswa.A + siswa.D;
            worksheet.getCell(row, 1).value = index + 1;
            worksheet.getCell(row, 2).value = siswa.nama;
            worksheet.getCell(row, 3).value = siswa.nis;
            worksheet.getCell(row, 4).value = siswa.nama_kelas;
            worksheet.getCell(row, 5).value = siswa.H || 0;
            worksheet.getCell(row, 6).value = siswa.I || 0;
            worksheet.getCell(row, 7).value = siswa.S || 0;
            worksheet.getCell(row, 8).value = siswa.A || 0;
            worksheet.getCell(row, 9).value = siswa.D || 0;
            worksheet.getCell(row, 10).value = total;
            worksheet.getCell(row, 11).value = `$.parseFloat(siswa.presentase || 0).toFixed(2)}%`;
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="ringkasan-kehadiran-siswa-smkn13-${startDate}-${endDate}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// ================================================
// MORE EXPORTS
// ================================================

/**
 * Export rekap ketidakhadiran guru SMKN13
 * GET /api/export/rekap-ketidakhadiran-guru-smkn13
 */
export const exportRekapKetidakhadiranGuruSmkn13 = async (req, res) => {
    try {
        const { tahun } = req.query;
        if (!tahun) {
            return res.status(400).json({ error: 'Tahun harus diisi' });
        }

        const query = `
            SELECT 
                g.id_guru as id, g.nama, g.nip,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 7 THEN 1 ELSE 0 END), 0) as jul,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 8 THEN 1 ELSE 0 END), 0) as agt,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 9 THEN 1 ELSE 0 END), 0) as sep,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 10 THEN 1 ELSE 0 END), 0) as okt,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 11 THEN 1 ELSE 0 END), 0) as nov,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 12 THEN 1 ELSE 0 END), 0) as des,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 1 THEN 1 ELSE 0 END), 0) as jan,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 2 THEN 1 ELSE 0 END), 0) as feb,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 3 THEN 1 ELSE 0 END), 0) as mar,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 4 THEN 1 ELSE 0 END), 0) as apr,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 5 THEN 1 ELSE 0 END), 0) as mei,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 6 THEN 1 ELSE 0 END), 0) as jun,
                COALESCE(SUM(CASE WHEN a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) as total_ketidakhadiran
            FROM guru g
            LEFT JOIN absensi_guru a ON g.id_guru = a.guru_id 
                AND YEAR(a.tanggal) = ? 
                AND a.status = 'Tidak Hadir'
            GROUP BY g.id_guru, g.nama, g.nip
            ORDER BY g.nama
        `;

        const [rows] = await globalThis.dbPool.execute(query, [tahun]);

        // Calculate percentages
        const hariEfektifPerBulan = { 7: 14, 8: 21, 9: 22, 10: 23, 11: 20, 12: 17, 1: 15, 2: 20, 3: 22, 4: 22, 5: 21, 6: 20 };
        const dataWithPercentage = rows.map(row => {
            const totalKetidakhadiran = row.total_ketidakhadiran;
            let totalHariEfektif = 0;
            const bulanData = [row.jul, row.agt, row.sep, row.okt, row.nov, row.des, row.jan, row.feb, row.mar, row.apr, row.mei, row.jun];
            const bulanKeys = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

            bulanKeys.forEach((bulan, index) => {
                if (bulanData[index] > 0) totalHariEfektif += hariEfektifPerBulan[bulan];
            });

            if (totalHariEfektif === 0) {
                totalHariEfektif = Object.values(hariEfektifPerBulan).reduce((sum, hari) => sum + hari, 0);
            }
            const persentaseKetidakhadiran = totalHariEfektif > 0 ? (totalKetidakhadiran / totalHariEfektif) * 100 : 0;
            const persentaseKehadiran = 100 - persentaseKetidakhadiran;

            return {
                ...row,
                persentase_ketidakhadiran: parseFloat(persentaseKetidakhadiran.toFixed(2)),
                persentase_kehadiran: parseFloat(persentaseKehadiran.toFixed(2))
            };
        });

        // Import required modules
        const { buildExcel } = await import('../../backend/export/excelBuilder.js');
        // getLetterhead and REPORT_KEYS already imported at top of file (line 11)
        const rekapGuruSchema = await import('../../backend/export/schemas/rekap-ketidakhadiran-guru-bulanan.js');

        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.REKAP_KETIDAKHADIRAN_GURU });

        const reportData = dataWithPercentage.map((row, index) => ({
            no: index + 1, nama: row.nama, nip: row.nip,
            jul: row.jul, agt: row.agt, sep: row.sep, okt: row.okt, nov: row.nov, des: row.des,
            jan: row.jan, feb: row.feb, mar: row.mar, apr: row.apr, mei: row.mei, jun: row.jun,
            total_ketidakhadiran: row.total_ketidakhadiran,
            persentase_ketidakhadiran: row.persentase_ketidakhadiran / 100,
            persentase_kehadiran: row.persentase_kehadiran / 100
        }));

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

// ================================================
// LARGE EXPORTS - Complex monthly breakdown
// ================================================

/**
 * Export rekap ketidakhadiran siswa - Format SMK13
 * GET /api/export/rekap-ketidakhadiran-siswa
 * Columns: NO, NIS/NISN, NAMA, L/P, S-I-A-JML per bulan (Jul-Des), TOTAL S-I-A, JUMLAH TOTAL, % TIDAK HADIR, % HADIR
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

        // Determine months based on semester
        const months = semester === 'gasal' 
            ? [7, 8, 9, 10, 11, 12] // Juli - Desember
            : [1, 2, 3, 4, 5, 6];   // Januari - Juni
        
        const monthNames = {
            1: 'JAN', 2: 'FEB', 3: 'MAR', 4: 'APR', 5: 'MEI', 6: 'JUN',
            7: 'JUL', 8: 'AGT', 9: 'SEP', 10: 'OKT', 11: 'NOV', 12: 'DES'
        };

        // Get attendance data with S/I/A breakdown per month
        const [presensiData] = await globalThis.dbPool.execute(`
            SELECT 
                a.siswa_id, 
                MONTH(a.tanggal) as bulan,
                SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END) as S,
                SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END) as I,
                SUM(CASE WHEN a.status IN ('Alpa', 'Alpha', 'Tanpa Keterangan') THEN 1 ELSE 0 END) as A
            FROM absensi_siswa a 
            INNER JOIN siswa s ON a.siswa_id = s.id_siswa 
            WHERE s.kelas_id = ? AND YEAR(a.tanggal) = ? AND MONTH(a.tanggal) IN (${months.join(',')})
            GROUP BY a.siswa_id, MONTH(a.tanggal)
        `, [kelas_id, tahun]);

        // Total hari efektif (configurable, default 95 for gasal)
        const TOTAL_HARI_EFEKTIF = semester === 'gasal' ? 95 : 95;

        // Build Excel using ExcelJS directly for precise control
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('REKAP KETIDAKHADIRAN');

        // Styles
        const headerStyle = {
            font: { bold: true, size: 11 },
            alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } } // Yellow
        };

        const dataStyle = {
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };

        // Title Headers (Row 1-4)
        worksheet.mergeCells('A1:AH1');
        worksheet.getCell('A1').value = 'PERSENTASE KETIDAKHADIRAN PESERTA DIDIK';
        worksheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFCC0000' } };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:AH2');
        worksheet.getCell('A2').value = 'SMK NEGERI 13 BANDUNG';
        worksheet.getCell('A2').font = { bold: true, size: 12, color: { argb: 'FFCC0000' } };
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A3:AH3');
        worksheet.getCell('A3').value = `TAHUN PELAJARAN ${tahun}-${parseInt(tahun) + 1}`;
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
                const sakitCount = parseInt(monthData.S) || 0;
                const izinCount = parseInt(monthData.I) || 0;
                const alpaCount = parseInt(monthData.A) || 0;
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

            const persenTidakHadir = TOTAL_HARI_EFEKTIF > 0 ? ((jumlahTotal / TOTAL_HARI_EFEKTIF) * 100).toFixed(2) : '0.00';
            const persenHadir = (100 - parseFloat(persenTidakHadir)).toFixed(2);

            worksheet.getCell(dataRow, col + 4).value = parseFloat(persenTidakHadir);
            worksheet.getCell(dataRow, col + 5).value = parseFloat(persenHadir);

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

        // Calculate and fill RATA-RATA for % Hadir
        const avgPersenHadir = studentsRows.length > 0 
            ? (100 - ((totals.S + totals.I + totals.A) / studentsRows.length / TOTAL_HARI_EFEKTIF * 100)).toFixed(2)
            : '100.00';

        const lastCol = col + 5;
        worksheet.getCell(dataRow, lastCol).value = parseFloat(avgPersenHadir);
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

        const filename = `Persentase_Ketidakhadiran_${kelasName}_${semester === 'gasal' ? 'Gasal' : 'Genap'}_${tahun}`.replace(/\s/g, '_');
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
        const [kelasRows] = await globalThis.dbPool.execute('SELECT nama_kelas FROM kelas WHERE id_kelas = ?', [kelas_id]);
        const kelasName = kelasRows.length > 0 ? kelasRows[0].nama_kelas : 'Unknown';

        // Get students
        const [studentsRows] = await globalThis.dbPool.execute(
            'SELECT s.id_siswa as id, s.nis, s.nama, s.jenis_kelamin FROM siswa s WHERE s.kelas_id = ? AND s.status = "aktif" ORDER BY s.nama ASC',
            [kelas_id]
        );

        // Get presensi data for the month
        const [presensiRows] = await globalThis.dbPool.execute(`
            SELECT a.siswa_id, DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal, a.status, a.keterangan
            FROM absensi_siswa a INNER JOIN siswa s ON a.siswa_id = s.id_siswa
            WHERE s.kelas_id = ? AND YEAR(a.tanggal) = ? AND MONTH(a.tanggal) = ?
            ORDER BY a.siswa_id, a.tanggal
        `, [kelas_id, tahun, bulan]);

        // Prepare export data
        const daysInMonth = new Date(parseInt(tahun), parseInt(bulan), 0).getDate();
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
        const query = `
            SELECT 
                DATE_FORMAT(a.waktu_absen, '%d/%m/%Y') as tanggal,
                s.nama as nama_siswa, s.nis, k.nama_kelas, a.status,
                COALESCE(a.keterangan, '-') as keterangan,
                DATE_FORMAT(a.waktu_absen, '%H:%i:%s') as waktu_absen
            FROM absensi_siswa a
            JOIN siswa s ON a.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            ORDER BY a.tanggal DESC, k.nama_kelas, s.nama
        `;

        const [rows] = await globalThis.dbPool.execute(query);

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
        let query = `
            SELECT j.id_jadwal, j.hari, j.jam_ke, j.jam_mulai, j.jam_selesai, j.jenis_aktivitas,
                k.nama_kelas, COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel,
                COALESCE(g.nama, 'Sistem') as nama_guru, rk.kode_ruang
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
        query += ` ORDER BY FIELD(j.hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'), j.jam_ke, k.nama_kelas`;

        const [schedules] = await globalThis.dbPool.execute(query, params);
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
                return { id: parseInt(id), name: name || 'Unknown' };
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
                    
                    // Build structured cell content using helper
                    const buildScheduleContentLines = (schedule, parseGuruList, formatTime) => {
                        const lines = [];
                        lines.push(schedule.nama_guru);
                        if (schedule.nama_mapel) lines.push(schedule.nama_mapel);
                        lines.push(schedule.kode_ruang || 'Ruang TBD');
                        lines.push(`${formatTime(schedule.jam_mulai)} - ${formatTime(schedule.jam_selesai)}`);
                        
                        if (schedule.is_multi_guru && schedule.guru_list) {
                            const guruNames = parseGuruList(schedule.guru_list);
                            if (guruNames.length > 1) {
                                lines.push('');
                                lines.push('Multi-Guru:');
                                for (const g of guruNames) {
                                    lines.push(`• ${g.name}`);
                                }
                            }
                        }
                        return lines.join('\n');
                    };
                    
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
        res.setHeader('Content-Disposition', `attachment; filename="Jadwal_Pelajaran_Matrix_${formatWIBDate().replace(/\//g, '-')}.xlsx"`);
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

        let query = `
            SELECT j.id_jadwal, j.hari, j.jam_ke, j.jam_mulai, j.jam_selesai, j.jenis_aktivitas,
                k.nama_kelas, k.id_kelas, 
                COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel,
                COALESCE(g.kode_guru, g.nama, 'Sistem') as nama_guru, 
                rk.kode_ruang
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
        
        // Order by Class, Day, Time
        query += ` ORDER BY k.nama_kelas, FIELD(j.hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'), j.jam_ke`;

        const [schedules] = await globalThis.dbPool.execute(query, params);

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
        res.setHeader('Content-Disposition', `attachment; filename="Jadwal_Print_${formatWIBDate().replace(/\//g, '-')}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// ================================================
// ALL EXPORTS MIGRATED - 17/17 COMPLETE! 🎉
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
        const { startDate, endDate, kelas_id, mapel_id } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;
        const jobData = {
            userId,
            userRole,
            startDate,
            endDate,
            kelas_id,
            mapel_id,
            timestamp: new Date().toISOString()
        };

        const job = await globalThis.downloadQueue.addDownloadJob(jobData);

        res.json({
            success: true,
            message: 'Download request queued successfully',
            data: {
                jobId: job.id,
                status: 'queued',
                estimatedTime: '2-5 minutes'
            }
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

        const jobStatus = await globalThis.downloadQueue.getJobStatus(jobId, userId);

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
        
        // Use path and fs imports (will need to be added to top of file)
        const path = await import('path');
        const fs = await import('fs/promises');

        const filePath = path.default.join(globalThis.downloadQueue.downloadDir, filename);

        // Check if file exists
        try {
            await fs.default.access(filePath);
        } catch (error) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Verify user has access to this file
        const hasAccess = await globalThis.downloadQueue.verifyFileAccess(filename, userId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.download(filePath, filename);

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

        if (!kelas_id) return res.status(400).json({ error: 'Kelas ID wajib diisi' });
        if (!startDate || !endDate) return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });

        // Parse dates manually to avoid timezone issues
        const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
        const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
        const start = new Date(sYear, sMonth - 1, sDay);
        const end = new Date(eYear, eMonth - 1, eDay);
        const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));

        if (diffDays > 62) return res.status(400).json({ error: 'Rentang tanggal maksimal 62 hari' });

        // Get mapel info
        const [mapelInfo] = await globalThis.dbPool.execute(`
            SELECT DISTINCT g.mata_pelajaran as nama_mapel, g.nama as nama_guru, g.nip
            FROM guru g WHERE g.id_guru = ? AND g.status = 'aktif' LIMIT 1
        `, [guruId]);

        // Get scheduled dates
        const [jadwalData] = await globalThis.dbPool.execute(`
            SELECT j.hari FROM jadwal j WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif'
        `, [guruId, kelas_id]);

        const pertemuanDates = [];
        const endTime = end.getTime();
        let currentTime = start.getTime();
        
        while (currentTime <= endTime) {
            const currentDate = new Date(currentTime);
            const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][currentDate.getDay()];
            if (jadwalData.some(j => j.hari === dayName)) {
                // Format date manually to avoid timezone shift
                const year = currentDate.getFullYear();
                const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                const day = String(currentDate.getDate()).padStart(2, '0');
                pertemuanDates.push(`${year}-${month}-${day}`);
            }
            // Increment by one day in milliseconds
            currentTime += 24 * 60 * 60 * 1000;
        }

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
        const fs = await import('fs');
        const path = await import('path');
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

        const dataStartRow = currentRow;
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
    try {
        const { tahun } = req.query;
        if (!tahun) {
            return res.status(400).json({ error: 'Tahun harus diisi' });
        }

        const mapping = templateExportService.REKAP_GURU_MAPPING;
        
        // Check if template exists
        const hasTemplate = await templateExportService.templateExists(mapping.templateFile);
        if (!hasTemplate) {
            return res.status(404).json({ 
                error: 'Template file tidak ditemukan',
                message: `Please copy "${mapping.templateFile}" to server/templates/excel/`,
                fallback: '/api/export/rekap-ketidakhadiran-guru' // Fallback to schema-based
            });
        }

        // Load template
        const workbook = await templateExportService.loadTemplate(mapping.templateFile);
        const worksheet = workbook.worksheets[0]; // First sheet

        // Query data (same as schema-based version)
        const query = `
            SELECT 
                g.id_guru as id,
                g.nama,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 7 AND a.status IN ('Tidak Hadir', 'S', 'I', 'A') THEN 1 ELSE 0 END), 0) as jul,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 8 AND a.status IN ('Tidak Hadir', 'S', 'I', 'A') THEN 1 ELSE 0 END), 0) as agt,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 9 AND a.status IN ('Tidak Hadir', 'S', 'I', 'A') THEN 1 ELSE 0 END), 0) as sep,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 10 AND a.status IN ('Tidak Hadir', 'S', 'I', 'A') THEN 1 ELSE 0 END), 0) as okt,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 11 AND a.status IN ('Tidak Hadir', 'S', 'I', 'A') THEN 1 ELSE 0 END), 0) as nov,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 12 AND a.status IN ('Tidak Hadir', 'S', 'I', 'A') THEN 1 ELSE 0 END), 0) as des,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 1 AND a.status IN ('Tidak Hadir', 'S', 'I', 'A') THEN 1 ELSE 0 END), 0) as jan,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 2 AND a.status IN ('Tidak Hadir', 'S', 'I', 'A') THEN 1 ELSE 0 END), 0) as feb,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 3 AND a.status IN ('Tidak Hadir', 'S', 'I', 'A') THEN 1 ELSE 0 END), 0) as mar,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 4 AND a.status IN ('Tidak Hadir', 'S', 'I', 'A') THEN 1 ELSE 0 END), 0) as apr,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 5 AND a.status IN ('Tidak Hadir', 'S', 'I', 'A') THEN 1 ELSE 0 END), 0) as mei,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 6 AND a.status IN ('Tidak Hadir', 'S', 'I', 'A') THEN 1 ELSE 0 END), 0) as jun
            FROM guru g
            LEFT JOIN absensi_guru a ON g.id_guru = a.guru_id 
                AND (YEAR(a.tanggal) = ? OR (YEAR(a.tanggal) = ? - 1 AND MONTH(a.tanggal) >= 7))
            WHERE g.status = 'aktif'
            GROUP BY g.id_guru, g.nama
            ORDER BY g.nama
        `;

        const tahunInt = parseInt(tahun);
        const [rows] = await globalThis.dbPool.execute(query, [tahunInt, tahunInt]);

        // Transform data for template
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

        // Clone row styles for additional data rows if needed
        const templateRowCount = 20; // Assume template has ~20 preset rows
        if (templateData.length > templateRowCount) {
            for (let i = templateRowCount; i < templateData.length; i++) {
                templateExportService.cloneRowStyle(worksheet, mapping.startRow, mapping.startRow + i);
            }
        }

        // Fill data using mapping (preserves formulas in O, P, Q)
        templateExportService.fillCells(worksheet, templateData, mapping, mapping.startRow);

        // Send response
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="REKAP_KETIDAKHADIRAN_GURU_${tahun}.xlsx"`);
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        logger.error('Template export rekap ketidakhadiran guru error', { error: error.message });
        return sendDatabaseError(res, error);
    }
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
            return res.status(400).json({ error: 'kelas_id dan tahun harus diisi' });
        }

        // Get kelas info
        const [kelasRows] = await globalThis.dbPool.execute(
            'SELECT nama_kelas FROM kelas WHERE id_kelas = ?',
            [kelas_id]
        );
        if (kelasRows.length === 0) {
            return res.status(404).json({ error: 'Kelas tidak ditemukan' });
        }
        const namaKelas = kelasRows[0].nama_kelas;

        // Determine tingkat (X, XI, XII, XIII) from kelas name
        let tingkat = 'X';
        if (namaKelas.includes('XIII')) tingkat = 'XIII';
        else if (namaKelas.includes('XII')) tingkat = 'XII';
        else if (namaKelas.includes('XI')) tingkat = 'XI';
        else if (namaKelas.includes('X')) tingkat = 'X';

        const mapping = templateExportService.REKAP_KELAS_GASAL_MAPPING;
        const templateFile = mapping.templateFile(tingkat);
        
        // Check if template exists
        const hasTemplate = await templateExportService.templateExists(templateFile);
        if (!hasTemplate) {
            return res.status(404).json({ 
                error: 'Template file tidak ditemukan',
                message: `Please copy "${templateFile}" to server/templates/excel/`,
                fallback: '/api/export/rekap-ketidakhadiran-siswa' // Fallback
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
        res.setHeader('Content-Disposition', `attachment; filename="REKAP_KETIDAKHADIRAN_${namaKelas.replace(/\s+/g, '_')}_${tahun}_GASAL.xlsx"`);
        
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
