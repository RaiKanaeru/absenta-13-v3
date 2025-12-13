/**
 * Guru Reports Controller
 * Handles teacher-specific attendance reports
 * Migrated from server_modern.js
 */

import { sendDatabaseError } from '../utils/errorHandler.js';

// Get presensi siswa SMK 13 untuk laporan guru
export const getPresensiSiswaSmkn13 = async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        const guruId = req.user.guru_id;

        console.log('📊 Fetching presensi siswa SMKN 13:', { startDate, endDate, kelas_id, guruId });

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan akhir harus diisi' });
        }

        let query = `
      SELECT 
        a.tanggal,
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

        console.log(`✅ Presensi siswa SMKN 13 fetched: ${rows.length} records`);
        res.json(rows);
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// Get rekap ketidakhadiran untuk laporan guru
export const getRekapKetidakhadiran = async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, reportType } = req.query;
        const guruId = req.user.guru_id;

        console.log('📊 Fetching rekap ketidakhadiran:', { startDate, endDate, kelas_id, reportType, guruId });

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan akhir harus diisi' });
        }

        let query;
        let params;

        if (reportType === 'bulanan') {
            // Laporan bulanan - grup berdasarkan bulan dan kelas
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

            query += `
        GROUP BY DATE_FORMAT(a.tanggal, '%Y-%m'), k.nama_kelas
        ORDER BY periode DESC, k.nama_kelas
      `;
        } else {
            // Laporan tahunan - grup berdasarkan tahun dan kelas
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

            query += `
        GROUP BY YEAR(a.tanggal), k.nama_kelas
        ORDER BY periode DESC, k.nama_kelas
      `;
        }

        const [rows] = await global.dbPool.execute(query, params);

        console.log(`✅ Rekap ketidakhadiran fetched: ${rows.length} records`);
        res.json(rows);
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// ================================================
// ADDITIONAL GURU REPORTS - Migrated from server_modern.js Batch 17B
// ================================================

/**
 * Get teacher's classes
 * GET /api/guru/classes
 */
export const getGuruClasses = async (req, res) => {
    try {
        const guruId = req.user.guru_id;
        const [rows] = await global.dbPool.execute(
            `SELECT DISTINCT k.id_kelas as id, k.nama_kelas 
             FROM jadwal j JOIN kelas k ON j.kelas_id = k.id_kelas 
             WHERE j.guru_id = ? AND j.status = 'aktif' ORDER BY k.nama_kelas`,
            [guruId]
        );
        res.json(rows);
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Get attendance summary for teacher's classes
 * GET /api/guru/attendance-summary
 */
export const getAttendanceSummary = async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        const guruId = req.user.guru_id;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }

        let query = `
            SELECT 
                s.id_siswa as siswa_id, s.nama, s.nis, k.nama_kelas,
                COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END), 0) AS H,
                COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
                COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
                COALESCE(SUM(CASE WHEN a.status = 'Alpa' THEN 1 ELSE 0 END), 0) AS A,
                COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS D,
                COUNT(a.id_absensi) AS total
            FROM siswa s
            JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND a.waktu_absen BETWEEN ? AND ?
            JOIN jadwal j ON j.kelas_id = s.kelas_id AND j.guru_id = ? AND j.status = 'aktif'
            WHERE s.status = 'aktif'
        `;
        const params = [startDate, endDate + ' 23:59:59', guruId];

        if (kelas_id && kelas_id !== 'all') {
            query += ' AND s.kelas_id = ?';
            params.push(kelas_id);
        }

        query += ' GROUP BY s.id_siswa, s.nama, s.nis, k.nama_kelas ORDER BY k.nama_kelas, s.nama';
        const [rows] = await global.dbPool.execute(query, params);
        res.json(rows);
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Get jadwal pertemuan dinamis untuk guru berdasarkan kelas dan periode
 * GET /api/guru/jadwal-pertemuan
 */
export const getJadwalPertemuan = async (req, res) => {
    try {
        const { kelas_id, startDate, endDate } = req.query;
        const guruId = req.user.guru_id;

        if (!kelas_id) return res.status(400).json({ error: 'Kelas ID wajib diisi' });
        if (!startDate || !endDate) return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });

        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
        if (diffDays > 62) return res.status(400).json({ error: 'Rentang tanggal maksimal 62 hari' });

        const [jadwalData] = await global.dbPool.execute(`
            SELECT j.hari, j.jam_ke, j.jam_mulai, j.jam_selesai,
                COALESCE(mp.nama_mapel, j.keterangan_khusus) as nama_mapel,
                mp.kode_mapel, k.nama_kelas, rk.kode_ruang, rk.nama_ruang
            FROM jadwal j
            LEFT JOIN mapel mp ON j.mapel_id = mp.id_mapel
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN ruang_kelas rk ON j.ruang_id = rk.id_ruang
            WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif'
            ORDER BY CASE j.hari WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 
                WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6 WHEN 'Minggu' THEN 7 END, j.jam_ke
        `, [guruId, kelas_id]);

        const pertemuanDates = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()];
            const daySchedules = jadwalData.filter(j => j.hari === dayName);
            if (daySchedules.length > 0) {
                pertemuanDates.push({
                    tanggal: d.toISOString().split('T')[0],
                    hari: dayName,
                    jadwal: daySchedules.map(s => ({
                        jam_ke: s.jam_ke, jam_mulai: s.jam_mulai, jam_selesai: s.jam_selesai,
                        nama_mapel: s.nama_mapel, kode_mapel: s.kode_mapel,
                        ruang: s.kode_ruang ? `${s.kode_ruang} - ${s.nama_ruang}` : '-'
                    }))
                });
            }
        }

        res.json({
            success: true,
            data: {
                pertemuan_dates: pertemuanDates,
                total_pertemuan: pertemuanDates.length,
                periode: { startDate, endDate, total_days: diffDays },
                jadwal_info: jadwalData.length > 0 ? {
                    nama_kelas: jadwalData[0].nama_kelas,
                    mata_pelajaran: [...new Set(jadwalData.map(j => j.nama_mapel))]
                } : null
            }
        });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Get laporan kehadiran siswa berdasarkan jadwal pertemuan guru
 * GET /api/guru/laporan-kehadiran-siswa
 */
export const getLaporanKehadiranSiswa = async (req, res) => {
    try {
        const { kelas_id, startDate, endDate } = req.query;
        const guruId = req.user.guru_id;

        if (!kelas_id) return res.status(400).json({ error: 'Kelas ID wajib diisi' });
        if (!startDate || !endDate) return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });

        const [siswaData] = await global.dbPool.execute(
            `SELECT s.id_siswa, s.nis, s.nama, k.nama_kelas
             FROM siswa s JOIN kelas k ON s.kelas_id = k.id_kelas
             WHERE s.kelas_id = ? AND s.status = 'aktif' ORDER BY s.nama`,
            [kelas_id]
        );

        const [absensiData] = await global.dbPool.execute(`
            SELECT a.siswa_id, a.status, DATE(a.waktu_absen) as tanggal, j.jam_ke
            FROM absensi_siswa a
            JOIN jadwal j ON a.jadwal_id = j.id_jadwal
            WHERE j.guru_id = ? AND j.kelas_id = ? AND DATE(a.waktu_absen) BETWEEN ? AND ?
        `, [guruId, kelas_id, startDate, endDate]);

        const absensiMap = new Map();
        absensiData.forEach(a => {
            if (!absensiMap.has(a.siswa_id)) absensiMap.set(a.siswa_id, []);
            absensiMap.get(a.siswa_id).push(a);
        });

        const result = siswaData.map(s => {
            const riwayat = absensiMap.get(s.id_siswa) || [];
            return {
                ...s,
                rekap: {
                    H: riwayat.filter(r => r.status === 'Hadir').length,
                    I: riwayat.filter(r => r.status === 'Izin').length,
                    S: riwayat.filter(r => r.status === 'Sakit').length,
                    A: riwayat.filter(r => r.status === 'Alpa').length,
                    D: riwayat.filter(r => r.status === 'Dispen').length,
                    total: riwayat.length
                },
                riwayat_absensi: riwayat
            };
        });

        res.json({ success: true, data: result, periode: { startDate, endDate } });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};
