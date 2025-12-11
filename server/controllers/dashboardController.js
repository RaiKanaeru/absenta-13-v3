/**
 * Dashboard Controller
 * Handles dashboard statistics and chart data
 * Migrated from server_modern.js
 */

import { getWIBTime, formatWIBDate, getMySQLDateWIB } from '../utils/timeUtils.js';

// ================================================
// DASHBOARD ENDPOINTS
// ================================================

/**
 * Get dashboard statistics based on user role
 * GET /api/dashboard/stats
 */
export const getStats = async (req, res) => {
    try {
        const stats = {};

        if (req.user.role === 'admin') {
            // Admin statistics
            const [totalSiswa] = await global.dbPool.execute(
                'SELECT COUNT(*) as count FROM siswa WHERE status = "aktif"'
            );
            const [totalGuru] = await global.dbPool.execute(
                'SELECT COUNT(*) as count FROM guru WHERE status = "aktif"'
            );
            const [totalKelas] = await global.dbPool.execute(
                'SELECT COUNT(*) as count FROM kelas WHERE status = "aktif"'
            );
            const [totalMapel] = await global.dbPool.execute(
                'SELECT COUNT(*) as count FROM mapel WHERE status = "aktif"'
            );

            const todayWIB = getMySQLDateWIB();
            const [absensiHariIni] = await global.dbPool.execute(
                'SELECT COUNT(*) as count FROM absensi_guru WHERE tanggal = ?',
                [todayWIB]
            );

            const sevenDaysAgoWIB = formatWIBDate(new Date(getWIBTime().getTime() - 7 * 24 * 60 * 60 * 1000));
            const [persentaseKehadiran] = await global.dbPool.execute(
                `SELECT ROUND((SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2) as persentase
                 FROM absensi_guru WHERE tanggal >= ?`,
                [sevenDaysAgoWIB]
            );

            stats.totalSiswa = totalSiswa[0].count;
            stats.totalGuru = totalGuru[0].count;
            stats.totalKelas = totalKelas[0].count;
            stats.totalMapel = totalMapel[0].count;
            stats.absensiHariIni = absensiHariIni[0].count;
            stats.persentaseKehadiran = persentaseKehadiran[0].persentase || 0;

        } else if (req.user.role === 'guru') {
            // Guru statistics
            const wibNow = getWIBTime();
            const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const currentDayWIB = dayNames[wibNow.getDay()];

            const [jadwalHariIni] = await global.dbPool.execute(
                `SELECT COUNT(*) as count FROM jadwal WHERE guru_id = ? AND hari = ? AND status = 'aktif'`,
                [req.user.guru_id, currentDayWIB]
            );

            const sevenDaysAgoWIB = formatWIBDate(new Date(wibNow.getTime() - 7 * 24 * 60 * 60 * 1000));
            const [absensiMingguIni] = await global.dbPool.execute(
                `SELECT COUNT(*) as count FROM absensi_guru WHERE guru_id = ? AND tanggal >= ?`,
                [req.user.guru_id, sevenDaysAgoWIB]
            );

            const thirtyDaysAgoWIB = formatWIBDate(new Date(wibNow.getTime() - 30 * 24 * 60 * 60 * 1000));
            const [persentaseKehadiran] = await global.dbPool.execute(
                `SELECT ROUND((SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2) as persentase
                 FROM absensi_guru WHERE guru_id = ? AND tanggal >= ?`,
                [req.user.guru_id, thirtyDaysAgoWIB]
            );

            stats.jadwalHariIni = jadwalHariIni[0].count;
            stats.absensiMingguIni = absensiMingguIni[0].count;
            stats.persentaseKehadiran = persentaseKehadiran[0].persentase || 0;

        } else if (req.user.role === 'siswa') {
            // Siswa statistics
            const wibNow = getWIBTime();
            const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const currentDayWIB = dayNames[wibNow.getDay()];

            const [jadwalHariIni] = await global.dbPool.execute(
                `SELECT COUNT(*) as count FROM jadwal WHERE kelas_id = ? AND hari = ? AND status = 'aktif'`,
                [req.user.kelas_id, currentDayWIB]
            );

            const sevenDaysAgoWIB = formatWIBDate(new Date(wibNow.getTime() - 7 * 24 * 60 * 60 * 1000));
            const [absensiMingguIni] = await global.dbPool.execute(
                `SELECT COUNT(*) as count FROM absensi_guru WHERE kelas_id = ? AND tanggal >= ?`,
                [req.user.kelas_id, sevenDaysAgoWIB]
            );

            stats.jadwalHariIni = jadwalHariIni[0].count;
            stats.absensiMingguIni = absensiMingguIni[0].count;
        }

        console.log(`📊 Dashboard stats retrieved for ${req.user.role}: ${req.user.username}`);
        res.json({ success: true, data: stats });

    } catch (error) {
        console.error('❌ Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to retrieve dashboard statistics' });
    }
};

/**
 * Get dashboard chart data
 * GET /api/dashboard/chart
 */
export const getChart = async (req, res) => {
    try {
        const { period = '7days' } = req.query;
        let chartData = [];

        if (req.user.role === 'admin') {
            // Admin chart - Weekly attendance overview
            const sevenDaysAgoWIB = formatWIBDate(new Date(getWIBTime().getTime() - 7 * 24 * 60 * 60 * 1000));
            const [weeklyData] = await global.dbPool.execute(
                `SELECT DATE(tanggal) as tanggal,
                    SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
                    SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
                 FROM absensi_guru WHERE tanggal >= ?
                 GROUP BY DATE(tanggal) ORDER BY tanggal`,
                [sevenDaysAgoWIB]
            );

            chartData = weeklyData.map(row => ({
                date: row.tanggal,
                hadir: row.hadir,
                tidakHadir: row.tidak_hadir,
                total: row.hadir + row.tidak_hadir
            }));

        } else if (req.user.role === 'guru') {
            // Guru chart - Personal attendance
            const sevenDaysAgoWIB = formatWIBDate(new Date(getWIBTime().getTime() - 7 * 24 * 60 * 60 * 1000));
            const [personalData] = await global.dbPool.execute(
                `SELECT DATE(tanggal) as tanggal,
                    SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
                    SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
                 FROM absensi_guru WHERE guru_id = ? AND tanggal >= ?
                 GROUP BY DATE(tanggal) ORDER BY tanggal`,
                [req.user.guru_id, sevenDaysAgoWIB]
            );

            chartData = personalData.map(row => ({
                date: row.tanggal,
                hadir: row.hadir,
                tidakHadir: row.tidak_hadir
            }));
        }

        console.log(`📈 Chart data retrieved for ${req.user.role}: ${req.user.username}`);
        res.json({ success: true, data: chartData });

    } catch (error) {
        console.error('❌ Chart data error:', error);
        res.status(500).json({ error: 'Failed to retrieve chart data' });
    }
};
