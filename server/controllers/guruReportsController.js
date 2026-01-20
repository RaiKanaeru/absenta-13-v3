/**
 * Guru Reports Controller
 * Handles teacher-specific attendance reports
 */

import { sendDatabaseError, sendValidationError } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('GuruReports');

function parseDateRange(startDate, endDate) {
    const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
    const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
    const start = new Date(sYear, sMonth - 1, sDay);
    const end = new Date(eYear, eMonth - 1, eDay);
    const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
    return { start, end, diffDays };
}

// Get presensi siswa SMK 13 untuk laporan guru
export const getPresensiSiswaSmkn13 = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { startDate, endDate, kelas_id } = req.query;
    const guruId = req.user.guru_id;

    log.requestStart('GetPresensiSiswaSmkn13', { startDate, endDate, kelas_id, guruId });

    try {
        // Validasi: Pastikan guru memiliki guru_id
        if (!guruId) {
            log.validationFail('guru_id', null, 'Guru ID tidak ditemukan dalam token');
            return sendValidationError(res, 'Data guru tidak ditemukan. Silakan login ulang.', { field: 'guru_id' });
        }

        if (!startDate || !endDate) {
            log.validationFail('dates', { startDate, endDate }, 'Required fields missing');
            return sendValidationError(res, 'Tanggal mulai dan akhir harus diisi', { fields: ['startDate', 'endDate'] });
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
        COUNT(CASE WHEN a.status IN ('Hadir', 'Dispen') THEN 1 END) as hadir,
        COUNT(CASE WHEN a.status = 'Izin' THEN 1 END) as izin,
        COUNT(CASE WHEN a.status = 'Sakit' THEN 1 END) as sakit,
        COUNT(CASE WHEN a.status = 'Alpa' THEN 1 END) as alpa,
        COUNT(CASE WHEN a.status = 'Dispen' THEN 1 END) as dispen,
        SUM(CASE WHEN a.terlambat = 1 THEN 1 ELSE 0 END) as terlambat_count
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

        log.success('GetPresensiSiswaSmkn13', { count: rows.length, guruId });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error, { startDate, endDate, kelas_id, guruId });
        return sendDatabaseError(res, error, 'Gagal mengambil data presensi siswa');
    }
};

// Get rekap ketidakhadiran untuk laporan guru
export const getRekapKetidakhadiran = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { startDate, endDate, kelas_id, reportType } = req.query;
    const guruId = req.user.guru_id;

    log.requestStart('GetRekapKetidakhadiran', { startDate, endDate, kelas_id, reportType, guruId });

    try {
        // Validasi: Pastikan guru memiliki guru_id
        if (!guruId) {
            log.validationFail('guru_id', null, 'Guru ID tidak ditemukan dalam token');
            return sendValidationError(res, 'Data guru tidak ditemukan. Silakan login ulang.', { field: 'guru_id' });
        }

        if (!startDate || !endDate) {
            log.validationFail('dates', { startDate, endDate }, 'Required fields missing');
            return sendValidationError(res, 'Tanggal mulai dan akhir harus diisi', { fields: ['startDate', 'endDate'] });
        }

        let query;
        let params;

        if (reportType === 'bulanan') {
            query = `
        SELECT 
          DATE_FORMAT(a.tanggal, '%Y-%m') as periode,
          k.nama_kelas,
          COUNT(DISTINCT s.id_siswa) as total_siswa,
          COUNT(CASE WHEN a.status IN ('Hadir', 'Dispen') THEN 1 END) as hadir,
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
            query = `
        SELECT 
          YEAR(a.tanggal) as periode,
          k.nama_kelas,
          COUNT(DISTINCT s.id_siswa) as total_siswa,
          COUNT(CASE WHEN a.status IN ('Hadir', 'Dispen') THEN 1 END) as hadir,
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

        const [rows] = await globalThis.dbPool.execute(query, params);

        log.success('GetRekapKetidakhadiran', { count: rows.length, reportType });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error, { startDate, endDate, kelas_id, reportType, guruId });
        return sendDatabaseError(res, error, 'Gagal mengambil rekap ketidakhadiran');
    }
};

/**
 * Get teacher's classes
 * GET /api/guru/classes
 */
export const getGuruClasses = async (req, res) => {
    const log = logger.withRequest(req, res);
    const guruId = req.user.guru_id;
    
    log.requestStart('GetGuruClasses', { guruId });

    try {
        // Validasi: Pastikan guru memiliki guru_id
        if (!guruId) {
            log.validationFail('guru_id', null, 'Guru ID tidak ditemukan dalam token');
            return sendValidationError(res, 'Data guru tidak ditemukan. Silakan login ulang.', { field: 'guru_id' });
        }

        const [rows] = await globalThis.dbPool.execute(
            `SELECT DISTINCT k.id_kelas as id, k.nama_kelas 
             FROM jadwal j JOIN kelas k ON j.kelas_id = k.id_kelas 
             WHERE j.guru_id = ? AND j.status = 'aktif' ORDER BY k.nama_kelas`,
            [guruId]
        );
        
        log.success('GetGuruClasses', { count: rows.length, guruId });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error, { guruId });
        return sendDatabaseError(res, error, 'Gagal mengambil data kelas guru');
    }
};

/**
 * Get attendance summary for teacher's classes
 * GET /api/guru/attendance-summary
 */
export const getAttendanceSummary = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { startDate, endDate, kelas_id } = req.query;
    const guruId = req.user.guru_id;
    
    log.requestStart('GetAttendanceSummary', { startDate, endDate, kelas_id, guruId });

    try {
        // Validasi: Pastikan guru memiliki guru_id
        if (!guruId) {
            log.validationFail('guru_id', null, 'Guru ID tidak ditemukan dalam token');
            return sendValidationError(res, 'Data guru tidak ditemukan. Silakan login ulang.', { field: 'guru_id' });
        }

        if (!startDate || !endDate) {
            log.validationFail('dates', { startDate, endDate }, 'Required fields missing');
            return sendValidationError(res, 'Tanggal mulai dan tanggal selesai wajib diisi', { fields: ['startDate', 'endDate'] });
        }

        let query = `
            SELECT 
                s.id_siswa as siswa_id, s.nama, s.nis, k.nama_kelas,
                COALESCE(SUM(CASE WHEN a.status IN ('Hadir', 'Dispen') THEN 1 ELSE 0 END), 0) AS H,
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
        const [rows] = await globalThis.dbPool.execute(query, params);
        
        log.success('GetAttendanceSummary', { count: rows.length, guruId });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error, { startDate, endDate, kelas_id, guruId });
        return sendDatabaseError(res, error, 'Gagal mengambil summary kehadiran');
    }
};

/**
 * Get jadwal pertemuan dinamis untuk guru berdasarkan kelas dan periode
 * GET /api/guru/jadwal-pertemuan
 */
export const getJadwalPertemuan = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { kelas_id, startDate, endDate } = req.query;
    const guruId = req.user.guru_id;

    log.requestStart('GetJadwalPertemuan', { kelas_id, startDate, endDate, guruId });

    try {
        // Validasi: Pastikan guru memiliki guru_id
        if (!guruId) {
            log.validationFail('guru_id', null, 'Guru ID tidak ditemukan dalam token');
            return sendValidationError(res, 'Data guru tidak ditemukan. Silakan login ulang.', { field: 'guru_id' });
        }

        if (!kelas_id) {
            log.validationFail('kelas_id', null, 'Required field missing');
            return sendValidationError(res, 'Kelas ID wajib diisi', { field: 'kelas_id' });
        }
        if (!startDate || !endDate) {
            log.validationFail('dates', { startDate, endDate }, 'Required fields missing');
            return sendValidationError(res, 'Tanggal mulai dan tanggal selesai wajib diisi', { fields: ['startDate', 'endDate'] });
        }

        // Parse dates manually to avoid timezone issues
        const { start, end, diffDays } = parseDateRange(startDate, endDate);
        
        if (diffDays > 62) {
            log.validationFail('dateRange', { diffDays }, 'Exceeds max 62 days');
            return sendValidationError(res, 'Rentang tanggal maksimal 62 hari', { maxDays: 62, requestedDays: diffDays });
        }

        const [jadwalData] = await globalThis.dbPool.execute(`
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
        const endTime = end.getTime();
        const currentDate = new Date(start);

        while (currentDate.getTime() <= endTime) {
            const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][currentDate.getDay()];
            const daySchedules = jadwalData.filter(j => j.hari === dayName);
            if (daySchedules.length > 0) {
                // Format date manually to avoid timezone shifts
                const year = currentDate.getFullYear();
                const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                const day = String(currentDate.getDate()).padStart(2, '0');
                pertemuanDates.push({
                    tanggal: `${year}-${month}-${day}`,
                    hari: dayName,
                    jadwal: daySchedules.map(s => ({
                        jam_ke: s.jam_ke, jam_mulai: s.jam_mulai, jam_selesai: s.jam_selesai,
                        nama_mapel: s.nama_mapel, kode_mapel: s.kode_mapel,
                        ruang: s.kode_ruang ? `${s.kode_ruang} - ${s.nama_ruang}` : '-'
                    }))
                });
            }

            currentDate.setDate(currentDate.getDate() + 1);
            
            // Safety break for infinite loop
            if (currentDate.getTime() > endTime + (1000 * 60 * 60 * 24 * 7)) break; // Buffer 1 week
        }

        log.success('GetJadwalPertemuan', { totalPertemuan: pertemuanDates.length, guruId });
        
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
        log.dbError('query', error, { kelas_id, startDate, endDate, guruId });
        return sendDatabaseError(res, error, 'Gagal mengambil jadwal pertemuan');
    }
};

/**
 * Get laporan kehadiran siswa berdasarkan jadwal pertemuan guru
 * GET /api/guru/laporan-kehadiran-siswa
 */
export const getLaporanKehadiranSiswa = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { kelas_id, startDate, endDate } = req.query;
    const guruId = req.user.guru_id;

    log.requestStart('GetLaporanKehadiranSiswa', { kelas_id, startDate, endDate, guruId });

    try {
        // Validasi: Pastikan guru memiliki guru_id
        if (!guruId) {
            log.validationFail('guru_id', null, 'Guru ID tidak ditemukan dalam token');
            return sendValidationError(res, 'Data guru tidak ditemukan. Silakan login ulang.', { field: 'guru_id' });
        }

        if (!kelas_id) {
            log.validationFail('kelas_id', null, 'Required field missing');
            return sendValidationError(res, 'Kelas ID wajib diisi', { field: 'kelas_id' });
        }
        if (!startDate || !endDate) {
            log.validationFail('dates', { startDate, endDate }, 'Required fields missing');
            return sendValidationError(res, 'Tanggal mulai dan tanggal selesai wajib diisi', { fields: ['startDate', 'endDate'] });
        }

        const [siswaData] = await globalThis.dbPool.execute(
            `SELECT s.id_siswa, s.nis, s.nama, k.nama_kelas
             FROM siswa s JOIN kelas k ON s.kelas_id = k.id_kelas
             WHERE s.kelas_id = ? AND s.status = 'aktif' ORDER BY s.nama`,
            [kelas_id]
        );

        const [absensiData] = await globalThis.dbPool.execute(`
            SELECT a.siswa_id, a.status, a.terlambat, DATE(a.waktu_absen) as tanggal, j.jam_ke
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
                    H: riwayat.filter(r => ['Hadir', 'Dispen'].includes(r.status)).length,
                    I: riwayat.filter(r => r.status === 'Izin').length,
                    S: riwayat.filter(r => r.status === 'Sakit').length,
                    A: riwayat.filter(r => r.status === 'Alpa').length,
                    D: riwayat.filter(r => r.status === 'Dispen').length,
                    total: riwayat.length,
                    terlambat: riwayat.filter(r => r.terlambat === 1).length
                },
                riwayat_absensi: riwayat.map(r => ({
                    ...r,
                    is_late: r.terlambat === 1
                }))
            };
        });

        log.success('GetLaporanKehadiranSiswa', { siswaCount: result.length, guruId });
        res.json({ success: true, data: result, periode: { startDate, endDate } });
    } catch (error) {
        log.dbError('query', error, { kelas_id, startDate, endDate, guruId });
        return sendDatabaseError(res, error, 'Gagal mengambil laporan kehadiran siswa');
    }
};
