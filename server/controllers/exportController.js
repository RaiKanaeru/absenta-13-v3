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
// PENDING MIGRATION - Functions defined but not yet implemented
// These endpoints are still handled inline in server_modern.js
// ================================================
// Export the following as placeholders for future migration:
// - exportRekapKetidakhadiranGuruSmkn13
// - exportRekapKetidakhadiranSiswa
// - exportPresensiSiswa
// - exportRiwayatBandingAbsen
// - exportPresensiSiswaSmkn13
// - exportRekapKetidakhadiran
// - exportRingkasanKehadiranSiswaSmkn13
// - exportAdminAttendance
// - exportJadwalMatrix
// - exportJadwalGrid
// - exportJadwalPrint

