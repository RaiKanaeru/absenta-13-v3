/**
 * Export Controller
 * Handles Excel/report generation logic
 * Refactored from server_modern.js
 */

import ExcelJS from 'exceljs';
import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError } from '../utils/errorHandler.js';

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
        console.log('📊 Exporting absensi guru:', { date_start, date_end });

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

        const [rows] = await global.dbPool.execute(query, params);

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
        res.setHeader('Content-Disposition', `attachment; filename=absensi-guru-${new Date().toISOString().split('T')[0]}.xlsx`);

        // Write to response
        await workbook.xlsx.write(res);
        res.end();

        console.log(`✅ Absensi guru exported successfully: ${rows.length} records`);

    } catch (error) {
        console.error('❌ Excel export error:', error);
        res.status(500).json({ error: 'Failed to export data to Excel' });
    }
};

/**
 * Export teacher list
 * GET /api/export/teacher-list
 */
export const exportTeacherList = async (req, res) => {
    try {
        const { academicYear = '2025-2026' } = req.query;
        console.log('🎯 Exporting teacher list...');

        // Import AbsentaExportSystem
        const AbsentaExportSystem = (await import('../../src/utils/absentaExportSystem.js')).default;
        const exportSystem = new AbsentaExportSystem();

        // Query data guru dari database
        const [teachers] = await global.dbPool.execute(`
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

        console.log(`✅ Teacher list exported successfully: ${teachers.length} records`);
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
        console.log('📊 Exporting student summary...');

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

        const [students] = await global.dbPool.execute(query, params);

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

        console.log(`✅ Student summary exported successfully: ${students.length} records`);
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
        console.log('👨‍🏫 Exporting teacher summary...');

        const [teachers] = await global.dbPool.execute(`
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

        console.log(`✅ Teacher summary exported successfully: ${teachers.length} records`);
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
        console.log('📋 Exporting banding absen...');

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

        const [bandingData] = await global.dbPool.execute(query, params);

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

        const reportPeriod = `${formatWIBDate(new Date(startDate))} - ${formatWIBDate(new Date(endDate))}`;

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

        console.log(`✅ Banding absen exported successfully: ${bandingData.length} records`);
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Export rekap ketidakhadiran guru
 * GET /api/export/rekap-ketidakhadiran-guru
 */
export const exportRekapKetidakhadiranGuru = async (req, res) => {
    try {
        const { tahun } = req.query;
        console.log('📊 Exporting rekap ketidakhadiran guru:', { tahun });

        if (!tahun) {
            return res.status(400).json({ error: 'Tahun harus diisi' });
        }

        // Query untuk mendapatkan data guru dan presensi
        const query = `
            SELECT 
                g.id_guru as id,
                g.nama,
                g.nip,
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

        const [rows] = await global.dbPool.execute(query, [tahun]);

        // Hitung persentase untuk setiap guru
        const dataWithPercentage = rows.map(row => {
            const totalKetidakhadiran = row.total_ketidakhadiran;
            const hariEfektifPerBulan = {
                7: 14, 8: 21, 9: 22, 10: 23, 11: 20, 12: 17,
                1: 15, 2: 20, 3: 22, 4: 22, 5: 21, 6: 20
            };

            let totalHariEfektif = 0;
            const bulanData = [row.jul, row.agt, row.sep, row.okt, row.nov, row.des, row.jan, row.feb, row.mar, row.apr, row.mei, row.jun];
            const bulanKeys = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

            bulanKeys.forEach((bulan, index) => {
                if (bulanData[index] > 0) {
                    totalHariEfektif += hariEfektifPerBulan[bulan];
                }
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

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.REKAP_KETIDAKHADIRAN_GURU });

        // Prepare data for Excel
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

        const reportPeriod = `Tahun ${tahun}`;

        // Generate Excel workbook
        const workbook = await buildExcel({
            title: rekapGuruSchema.default.title,
            subtitle: rekapGuruSchema.default.subtitle,
            reportPeriod: reportPeriod,
            letterhead: letterhead,
            columns: rekapGuruSchema.default.columns,
            rows: reportData
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Rekap_Ketidakhadiran_Guru_${tahun}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();

        console.log(`✅ Rekap ketidakhadiran guru exported successfully: ${dataWithPercentage.length} records`);
    } catch (error) {
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

        console.log('📊 Exporting riwayat banding absen:', { startDate, endDate, kelas_id, status, guruId });

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

        const [rows] = await global.dbPool.execute(query, params);

        // Get class name for title
        let className = 'Semua Kelas';
        if (kelas_id && kelas_id !== 'all') {
            const [kelasRows] = await global.dbPool.execute(
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

        console.log(`✅ Riwayat banding absen exported: ${rows.length} records`);
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

        console.log('📊 Exporting presensi siswa SMKN 13:', { startDate, endDate, kelas_id, guruId });

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

        const [rows] = await global.dbPool.execute(query, params);

        // Get class name for title
        let className = 'Semua Kelas';
        if (kelas_id && kelas_id !== 'all') {
            const [kelasRows] = await global.dbPool.execute(
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

        console.log(`✅ Presensi siswa SMKN 13 exported: ${rows.length} records`);
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

        console.log('📊 Exporting rekap ketidakhadiran:', { startDate, endDate, kelas_id, reportType, guruId });

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

        const [rows] = await global.dbPool.execute(query, params);

        // Get class name
        let className = 'Semua Kelas';
        if (kelas_id && kelas_id !== 'all') {
            const [kelasRows] = await global.dbPool.execute(
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

        console.log(`✅ Rekap ketidakhadiran exported: ${rows.length} records`);
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

        console.log('📊 Exporting ringkasan kehadiran siswa SMKN 13:', { startDate, endDate, kelas_id, guruId });

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

        const [rows] = await global.dbPool.execute(query, params);

        // Calculate percentage
        const dataWithPercentage = rows.map(row => {
            const total = row.H + row.I + row.S + row.A + row.D;
            const presentase = total > 0 ? ((row.H / total) * 100).toFixed(2) : '0.00';
            return { ...row, presentase: parseFloat(presentase) };
        });

        // Get class name
        let className = 'Semua Kelas';
        if (kelas_id && kelas_id !== 'all') {
            const [kelasRows] = await global.dbPool.execute('SELECT nama_kelas FROM kelas WHERE id_kelas = ?', [kelas_id]);
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
            worksheet.getCell(row, 11).value = `${parseFloat(siswa.presentase || 0).toFixed(2)}%`;
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="ringkasan-kehadiran-siswa-smkn13-${startDate}-${endDate}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();

        console.log(`✅ Ringkasan kehadiran siswa exported: ${dataWithPercentage.length} records`);
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
        console.log('📊 Exporting rekap ketidakhadiran guru SMKN 13:', { tahun });

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

        const [rows] = await global.dbPool.execute(query, [tahun]);

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

        console.log(`✅ Rekap ketidakhadiran guru SMKN13 exported: ${dataWithPercentage.length} records`);
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// ================================================
// LARGE EXPORTS - Complex monthly breakdown
// ================================================

/**
 * Export rekap ketidakhadiran siswa
 * GET /api/export/rekap-ketidakhadiran-siswa
 */
export const exportRekapKetidakhadiranSiswa = async (req, res) => {
    try {
        const { kelas_id, tahun, bulan, tanggal_awal, tanggal_akhir } = req.query;
        console.log('📊 Exporting rekap ketidakhadiran siswa:', { kelas_id, tahun, bulan, tanggal_awal, tanggal_akhir });

        // Get class name
        const [kelasRows] = await global.dbPool.execute('SELECT nama_kelas FROM kelas WHERE id_kelas = ?', [kelas_id]);
        const kelasName = kelasRows.length > 0 ? kelasRows[0].nama_kelas : 'Unknown';

        // Get students
        const [studentsRows] = await global.dbPool.execute(
            'SELECT s.id_siswa as id, s.nis, s.nama, s.jenis_kelamin, s.kelas_id FROM siswa s WHERE s.kelas_id = ? AND s.status = "aktif" ORDER BY s.nama ASC',
            [kelas_id]
        );

        // Import modules
        const { buildExcel } = await import('../../backend/export/excelBuilder.js');
        // getLetterhead and REPORT_KEYS already imported at top of file (line 11)
        const rekapSiswaSchema = await import('../../backend/export/schemas/rekap-ketidakhadiran-siswa.js');
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.REKAP_KETIDAKHADIRAN });

        // Determine report period
        let reportPeriod;
        if (tanggal_awal && tanggal_akhir) reportPeriod = `${tanggal_awal} - ${tanggal_akhir}`;
        else if (bulan) reportPeriod = `${bulan} ${tahun}`;
        else reportPeriod = `Tahun ${tahun}`;

        if (studentsRows.length === 0) {
            const workbook = await buildExcel({
                title: rekapSiswaSchema.default.title, subtitle: rekapSiswaSchema.default.subtitle,
                reportPeriod, letterhead, columns: rekapSiswaSchema.default.columns, rows: []
            });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="Rekap_Ketidakhadiran_Siswa_${kelasName}_${tahun}.xlsx"`);
            await workbook.xlsx.write(res);
            res.end();
            return;
        }

        // Get presensi data
        let presensiData = [];
        const baseQuery = `
            SELECT a.siswa_id, MONTH(a.tanggal) as bulan, YEAR(a.tanggal) as tahun,
                COUNT(CASE WHEN a.status IN ('Sakit', 'Alpa', 'Izin') THEN 1 END) as total_ketidakhadiran,
                COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as total_kehadiran,
                COUNT(*) as total_hari_efektif
            FROM absensi_siswa a INNER JOIN siswa s ON a.siswa_id = s.id_siswa WHERE s.kelas_id = ?
        `;

        if (tanggal_awal && tanggal_akhir) {
            const [rows] = await global.dbPool.execute(baseQuery + ` AND a.tanggal BETWEEN ? AND ? GROUP BY a.siswa_id, MONTH(a.tanggal), YEAR(a.tanggal)`, [kelas_id, tanggal_awal, tanggal_akhir]);
            presensiData = rows;
        } else if (bulan) {
            const [rows] = await global.dbPool.execute(baseQuery + ` AND YEAR(a.tanggal) = ? AND MONTH(a.tanggal) = ? GROUP BY a.siswa_id, MONTH(a.tanggal), YEAR(a.tanggal)`, [kelas_id, tahun, bulan]);
            presensiData = rows;
        } else {
            const [rows] = await global.dbPool.execute(baseQuery + ` AND YEAR(a.tanggal) = ? GROUP BY a.siswa_id, MONTH(a.tanggal), YEAR(a.tanggal)`, [kelas_id, tahun]);
            presensiData = rows;
        }

        // Prepare export data
        const exportData = studentsRows.map(student => {
            const studentPresensi = presensiData.filter(p => p.siswa_id === student.id);
            const totalKetidakhadiran = studentPresensi.reduce((sum, p) => sum + p.total_ketidakhadiran, 0);
            const totalHariEfektif = studentPresensi.reduce((sum, p) => sum + p.total_hari_efektif, 0);
            const persentaseKetidakhadiran = totalHariEfektif > 0 ? ((totalKetidakhadiran / totalHariEfektif) * 100).toFixed(2) : '0.00';

            const monthlyData = { jul: 0, agt: 0, sep: 0, okt: 0, nov: 0, des: 0, jan: 0, feb: 0, mar: 0, apr: 0, mei: 0, jun: 0 };
            const monthMap = { 7: 'jul', 8: 'agt', 9: 'sep', 10: 'okt', 11: 'nov', 12: 'des', 1: 'jan', 2: 'feb', 3: 'mar', 4: 'apr', 5: 'mei', 6: 'jun' };
            studentPresensi.forEach(p => { if (monthMap[p.bulan]) monthlyData[monthMap[p.bulan]] = p.total_ketidakhadiran; });

            return { nis: student.nis, nama: student.nama, jenis_kelamin: student.jenis_kelamin, ...monthlyData, total_ketidakhadiran: totalKetidakhadiran, persentase_ketidakhadiran: parseFloat(persentaseKetidakhadiran) / 100 };
        });

        // Create schema and data based on mode
        let schema = rekapSiswaSchema.default;
        let reportData = exportData.map((row, index) => ({ no: index + 1, ...row }));

        const workbook = await buildExcel({
            title: schema.title, subtitle: schema.subtitle, reportPeriod, letterhead, columns: schema.columns, rows: reportData
        });

        let filename = `Rekap_Ketidakhadiran_Siswa_${kelasName}_${tahun}`;
        if (tanggal_awal && tanggal_akhir) filename = `Rekap_Ketidakhadiran_Siswa_${kelasName}_${tanggal_awal}_${tanggal_akhir}`;
        else if (bulan) filename = `Rekap_Ketidakhadiran_Siswa_${kelasName}_${tahun}_${bulan}`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();

        console.log(`✅ Rekap ketidakhadiran siswa exported: ${exportData.length} records`);
    } catch (error) {
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
        console.log('📊 Exporting presensi siswa:', { kelas_id, bulan, tahun });

        // Get class name
        const [kelasRows] = await global.dbPool.execute('SELECT nama_kelas FROM kelas WHERE id_kelas = ?', [kelas_id]);
        const kelasName = kelasRows.length > 0 ? kelasRows[0].nama_kelas : 'Unknown';

        // Get students
        const [studentsRows] = await global.dbPool.execute(
            'SELECT s.id_siswa as id, s.nis, s.nama, s.jenis_kelamin FROM siswa s WHERE s.kelas_id = ? AND s.status = "aktif" ORDER BY s.nama ASC',
            [kelas_id]
        );

        // Get presensi data for the month
        const [presensiRows] = await global.dbPool.execute(`
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

        console.log(`✅ Presensi siswa exported: ${exportData.length} records`);
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
        console.log('📊 Exporting attendance data...');

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

        const [rows] = await global.dbPool.execute(query);

        let csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += 'Tanggal,Nama Siswa,NIS,Kelas,Status,Keterangan,Waktu Absen\n';

        rows.forEach(row => {
            csvContent += `"${row.tanggal}","${row.nama_siswa}","${row.nis}","${row.nama_kelas}","${row.status}","${row.keterangan}","${row.waktu_absen}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="data-kehadiran-siswa.csv"');
        res.send(csvContent);

        console.log(`✅ Attendance data exported: ${rows.length} records`);
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
        console.log('📅 Exporting jadwal matrix format (redesigned)...');
        const { kelas_id, hari } = req.query;

        // Use getLetterhead from top-level import (line 11)
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.JADWAL_PELAJARAN });

        // Updated query to include multi-guru data
        let query = `
            SELECT j.id_jadwal, j.hari, j.jam_ke, j.jam_mulai, j.jam_selesai, j.jenis_aktivitas,
                j.is_multi_guru, j.guru_list,
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

        const [schedules] = await global.dbPool.execute(query, params);
        console.log(`📊 Found ${schedules.length} schedules`);

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
                    
                    // Build structured cell content
                    const contentParts = daySchedules.map(s => {
                        const lines = [];
                        lines.push(s.nama_guru);
                        if (s.nama_mapel) lines.push(s.nama_mapel);
                        lines.push(s.kode_ruang || 'Ruang TBD');
                        lines.push(`${formatTime(s.jam_mulai)} - ${formatTime(s.jam_selesai)}`);
                        
                        if (s.is_multi_guru && s.guru_list) {
                            const guruNames = parseGuruList(s.guru_list);
                            if (guruNames.length > 1) {
                                lines.push('');
                                lines.push('Multi-Guru:');
                                guruNames.forEach(g => lines.push(`• ${g.name}`));
                            }
                        }
                        return lines.join('\n');
                    });
                    
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
        console.log(`✅ Jadwal matrix exported (redesigned): ${schedules.length} records, ${uniqueClasses.length} classes`);
    } catch (error) {
        console.error('❌ Export jadwal matrix error:', error);
        return sendDatabaseError(res, error);
    }
};

/**
 * Export jadwal grid format - REDESIGNED with consistent styling
 * GET /api/admin/export/jadwal-grid
 */
export const exportJadwalGrid = async (req, res) => {
    try {
        console.log('📅 Exporting jadwal grid format (styled)...');
        const { kelas_id, hari } = req.query;

        // Use getLetterhead from top-level import (line 11)
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.JADWAL_PELAJARAN });

        let query = `
            SELECT j.id_jadwal, j.hari, j.jam_ke, j.jam_mulai, j.jam_selesai, j.jenis_aktivitas,
                j.is_multi_guru, j.guru_list,
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
        query += ` ORDER BY k.nama_kelas, FIELD(j.hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'), j.jam_ke`;

        const [schedules] = await global.dbPool.execute(query, params);

        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Jadwal Grid');

        const columns = ['No', 'Kelas', 'Hari', 'Jam Ke', 'Waktu', 'Mata Pelajaran', 'Guru', 'Ruang'];
        const totalCols = columns.length;

        // Add letterhead
        let currentRow = await addLetterheadToWorksheet(workbook, worksheet, letterhead, totalCols);

        // Title with styling
        currentRow = addReportTitle(worksheet, 'JADWAL PELAJARAN GRID', `Tanggal Export: ${formatWIBDate()}`, currentRow, totalCols);
        currentRow++;

        // Headers with styling
        const headerRow = worksheet.getRow(currentRow);
        columns.forEach((col, idx) => {
            const cell = headerRow.getCell(idx + 1);
            cell.value = col;
            applyStyle(cell, excelStyles.header);
        });
        headerRow.height = 25;
        currentRow++;

        const dataStartRow = currentRow;

        // Data rows with styling
        schedules.forEach((schedule, idx) => {
            const row = worksheet.getRow(currentRow);
            
            // Parse multi-guru
            let guruDisplay = schedule.nama_guru;
            if (schedule.is_multi_guru && schedule.guru_list) {
                const guruNames = parseGuruList(schedule.guru_list);
                if (guruNames.length > 1) {
                    guruDisplay = guruNames.map(g => g.name).join('\n');
                }
            }

            const values = [
                idx + 1,
                schedule.nama_kelas,
                schedule.hari,
                schedule.jam_ke || '-',
                `${formatTime(schedule.jam_mulai)} - ${formatTime(schedule.jam_selesai)}`,
                schedule.nama_mapel,
                guruDisplay,
                schedule.kode_ruang || '-'
            ];

            values.forEach((val, colIdx) => {
                const cell = row.getCell(colIdx + 1);
                cell.value = val;
                cell.border = borders.thin;
                cell.alignment = { vertical: 'middle', wrapText: true };
                if (colIdx === 0 || colIdx === 3) {
                    cell.alignment.horizontal = 'center';
                }
            });

            // Highlight multi-guru rows
            if (schedule.is_multi_guru) {
                for (let i = 1; i <= totalCols; i++) {
                    row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.multiGuru } };
                }
            }

            row.height = schedule.is_multi_guru ? 40 : 25;
            currentRow++;
        });

        // Apply alternating colors
        applyAlternatingColors(worksheet, dataStartRow, currentRow - 1, 1, totalCols);

        // Column widths
        [5, 12, 10, 8, 16, 25, 25, 12].forEach((width, idx) => {
            worksheet.getColumn(idx + 1).width = width;
        });

        // Summary
        currentRow++;
        addSummaryRow(worksheet, `Total: ${schedules.length} jadwal`, currentRow, totalCols);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Jadwal_Grid_${formatWIBDate().replace(/\//g, '-')}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
        console.log(`✅ Jadwal grid exported (styled): ${schedules.length} records`);
    } catch (error) {
        console.error('❌ Export jadwal grid error:', error);
        return sendDatabaseError(res, error);
    }
};

/**
 * Export jadwal print format
 * GET /api/admin/export/jadwal-print
 */
export const exportJadwalPrint = async (req, res) => {
    try {
        console.log('📅 Exporting jadwal print format...');
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

        const [schedules] = await global.dbPool.execute(query, params);

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
        console.log(`✅ Jadwal print exported: ${schedules.length} records`);
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

        console.log(`📥 Requesting Excel download for user ${userId} (${userRole})`);

        const jobData = {
            userId,
            userRole,
            startDate,
            endDate,
            kelas_id,
            mapel_id,
            timestamp: new Date().toISOString()
        };

        const job = await global.downloadQueue.addDownloadJob(jobData);

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

        const jobStatus = await global.downloadQueue.getJobStatus(jobId, userId);

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

        const filePath = path.default.join(global.downloadQueue.downloadDir, filename);

        // Check if file exists
        try {
            await fs.default.access(filePath);
        } catch (error) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Verify user has access to this file
        const hasAccess = await global.downloadQueue.verifyFileAccess(filename, userId);
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

        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));

        if (diffDays > 62) return res.status(400).json({ error: 'Rentang tanggal maksimal 62 hari' });

        // Get mapel info
        const [mapelInfo] = await global.dbPool.execute(`
            SELECT DISTINCT g.mata_pelajaran as nama_mapel, g.nama as nama_guru, g.nip
            FROM guru g WHERE g.id_guru = ? AND g.status = 'aktif' LIMIT 1
        `, [guruId]);

        // Get scheduled dates
        const [jadwalData] = await global.dbPool.execute(`
            SELECT j.hari FROM jadwal j WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif'
        `, [guruId, kelas_id]);

        const pertemuanDates = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()];
            if (jadwalData.some(j => j.hari === dayName)) {
                pertemuanDates.push(d.toISOString().split('T')[0]);
            }
        }

        // Get actual attendance dates
        const [actualDates] = await global.dbPool.execute(`
            SELECT DISTINCT DATE(a.tanggal) as tanggal
            FROM absensi_siswa a
            WHERE a.jadwal_id IN (SELECT j.id_jadwal FROM jadwal j WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif')
            AND DATE(a.tanggal) BETWEEN ? AND ?
            ORDER BY DATE(a.tanggal)
        `, [guruId, kelas_id, startDate, endDate]);

        const allDates = new Set(pertemuanDates);
        actualDates.forEach(r => { if (r.tanggal) allDates.add(r.tanggal.toISOString().split('T')[0]); });
        const finalDates = Array.from(allDates).sort();

        // Get student summary stats
        const [siswaData] = await global.dbPool.execute(`
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
        const [detailKehadiran] = await global.dbPool.execute(`
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
                            const p = path.default.join(process.cwd(), 'public', url);
                            if (fs.existsSync(p)) buffer = fs.readFileSync(p);
                        }
                        if (buffer) {
                            const imgId = workbook.addImage({ buffer, extension: 'png' });
                            sheet.addImage(imgId, { tl: { col, row: currentRow - 1 }, br: { col: col + 2, row: currentRow + 2 } });
                        }
                    } catch (e) {
                         console.warn('Logo error:', e.message);
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
            const daily = finalDates.map(d => {
                const st = attendanceMap[s.id_siswa]?.[d];
                return st === 'Hadir' ? 'H' : st === 'Izin' ? 'I' : st === 'Sakit' ? 'S' : st === 'Alpa' ? 'A' : st === 'Dispen' ? 'D' : '-';
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
