/**
 * Export Controller
 * Handles Excel/report generation logic
 * Refactored from server_modern.js
 */

import ExcelJS from 'exceljs';
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
        const { getLetterhead, REPORT_KEYS } = await import('../../backend/utils/letterheadService.js');
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
        console.error('❌ Error exporting teacher list:', error);
        res.status(500).json({ error: 'Internal server error' });
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
        const { getLetterhead, REPORT_KEYS } = await import('../../backend/utils/letterheadService.js');
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
        console.error('❌ Error exporting student summary:', error);
        res.status(500).json({ error: 'Internal server error' });
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
        const { getLetterhead, REPORT_KEYS } = await import('../../backend/utils/letterheadService.js');
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
        console.error('❌ Error exporting teacher summary:', error);
        res.status(500).json({ error: 'Internal server error' });
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
        const { getLetterhead, REPORT_KEYS } = await import('../../backend/utils/letterheadService.js');
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
        console.error('❌ Error exporting banding absen:', error);
        res.status(500).json({ error: 'Internal server error' });
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
        const { getLetterhead, REPORT_KEYS } = await import('../../backend/utils/letterheadService.js');
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
        console.error('❌ Error exporting rekap ketidakhadiran guru:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ================================================
// GURU & ADMIN EXPORTS - Using excelLetterhead utility
// ================================================

import { addLetterheadToWorksheet, addReportTitle, addHeaders } from '../utils/excelLetterhead.js';

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
        const { getLetterhead, REPORT_KEYS } = await import('../../backend/utils/letterheadService.js');
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
        console.error('❌ Error exporting riwayat banding absen:', error);
        res.status(500).json({ error: 'Internal server error' });
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
        const { getLetterhead, REPORT_KEYS } = await import('../../backend/utils/letterheadService.js');

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
        console.error('❌ Error exporting presensi siswa SMKN 13:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ================================================
// REMAINING EXPORTS - To be migrated
// ================================================
// - exportRekapKetidakhadiran
// - exportRingkasanKehadiranSiswaSmkn13
// - exportRekapKetidakhadiranGuruSmkn13
// - exportRekapKetidakhadiranSiswa
// - exportPresensiSiswa
// - exportAdminAttendance
// - exportJadwalMatrix
// - exportJadwalGrid
// - exportJadwalPrint



