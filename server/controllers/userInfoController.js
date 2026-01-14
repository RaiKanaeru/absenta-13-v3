/**
 * User Info Controller
 * Self-service info endpoints for siswa perwakilan, guru, admin
 */

import { getWIBTime, getMySQLDateWIB, HARI_INDONESIA } from '../utils/timeUtils.js';
import { sendDatabaseError, sendNotFoundError, sendValidationError } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('UserInfo');

/** SQL query to get student's class by ID (S1192 duplicate literal fix) */
const SQL_GET_SISWA_KELAS = 'SELECT kelas_id FROM siswa WHERE id_siswa = ?';

async function executeScheduleQuery(kelasId, dateStr, dayName) {
    const [rows] = await globalThis.dbPool.execute(`
        SELECT 
            j.id_jadwal,
            j.guru_id,
            j.jam_ke,
            j.jam_mulai,
            j.jam_selesai,
            COALESCE(mp.nama_mapel, j.keterangan_khusus) as nama_mapel,
            COALESCE(mp.kode_mapel, '') as kode_mapel,
            COALESCE(g.nama, '') as nama_guru,
            COALESCE(g.nip, '') as nip,
            k.nama_kelas,
            COALESCE(ag.status, 'belum_diambil') as status_kehadiran,
            COALESCE(ag.keterangan, '') as keterangan,
            COALESCE(ag.waktu_catat, '') as waktu_catat,
            COALESCE(ag.ada_tugas, 0) as ada_tugas,
            rk.kode_ruang,
            rk.nama_ruang,
            j.jenis_aktivitas,
            j.is_absenable,
            j.keterangan_khusus,
            j.is_multi_guru,
            GROUP_CONCAT(
                CONCAT(
                    g2.id_guru, ':', 
                    COALESCE(g2.nama, ''), ':', 
                    COALESCE(g2.nip, ''), ':', 
                    COALESCE(ag2.status, 'belum_diambil'), ':', 
                    COALESCE(ag2.keterangan, ''), ':',
                    COALESCE(ag2.waktu_catat, ''), ':',
                    COALESCE(jg2.is_primary, 0), ':',
                    COALESCE(ag2.ada_tugas, 0)
                ) 
                ORDER BY jg2.is_primary DESC, g2.nama ASC 
                SEPARATOR '||'
            ) as guru_list,
            ? as tanggal_target
        FROM jadwal j
        LEFT JOIN mapel mp ON j.mapel_id = mp.id_mapel
        LEFT JOIN guru g ON j.guru_id = g.id_guru
        JOIN kelas k ON j.kelas_id = k.id_kelas
        LEFT JOIN ruang_kelas rk ON j.ruang_id = rk.id_ruang
        LEFT JOIN absensi_guru ag ON j.id_jadwal = ag.jadwal_id 
            AND ag.tanggal = ?
            AND ag.guru_id = j.guru_id
        LEFT JOIN jadwal_guru jg2 ON j.id_jadwal = jg2.jadwal_id
        LEFT JOIN guru g2 ON jg2.guru_id = g2.id_guru
        LEFT JOIN absensi_guru ag2 ON j.id_jadwal = ag2.jadwal_id 
            AND ag2.tanggal = ?
            AND ag2.guru_id = g2.id_guru
        WHERE j.kelas_id = ? AND j.hari = ?
        GROUP BY j.id_jadwal, j.guru_id, j.jam_ke, j.jam_mulai, j.jam_selesai, mp.nama_mapel, mp.kode_mapel, g.nama, g.nip, k.nama_kelas, ag.status, ag.keterangan, ag.waktu_catat, ag.ada_tugas, rk.kode_ruang, rk.nama_ruang, j.jenis_aktivitas, j.is_absenable, j.keterangan_khusus, j.is_multi_guru
        ORDER BY j.jam_ke
    `, [dateStr, dateStr, dateStr, kelasId, dayName]);
    return rows;
}

// Get siswa perwakilan info
export const getSiswaPerwakilanInfo = async (req, res) => {
    const log = logger.withRequest(req, res);
    
    log.requestStart('GetSiswaPerwakilanInfo', { userId: req.user.id });

    try {
        const [siswaData] = await globalThis.dbPool.execute(
            `SELECT u.id, u.username, u.nama, u.email, u.role, s.id_siswa, s.nis, s.kelas_id, 
                    k.nama_kelas, s.alamat, s.telepon_orangtua, s.nomor_telepon_siswa, s.jenis_kelamin, s.jabatan, 
                    u.created_at, u.updated_at
             FROM users u
             LEFT JOIN siswa s ON u.id = s.user_id
             LEFT JOIN kelas k ON s.kelas_id = k.id_kelas
             WHERE u.id = ?`,
            [req.user.id]
        );

        if (siswaData.length === 0) {
            log.warn('Siswa perwakilan not found', { userId: req.user.id });
            return sendNotFoundError(res, 'Data siswa perwakilan tidak ditemukan');
        }

        const info = siswaData[0];
        log.success('GetSiswaPerwakilanInfo', { siswaId: info.id_siswa, nama: info.nama });

        res.json({
            success: true,
            id: info.id,
            username: info.username,
            nama: info.nama,
            email: info.email,
            role: info.role,
            id_siswa: info.id_siswa,
            nis: info.nis,
            kelas_id: info.kelas_id,
            nama_kelas: info.nama_kelas,
            alamat: info.alamat,
            telepon_orangtua: info.telepon_orangtua,
            nomor_telepon_siswa: info.nomor_telepon_siswa,
            jenis_kelamin: info.jenis_kelamin,
            jabatan: info.jabatan,
            created_at: info.created_at,
            updated_at: info.updated_at
        });

    } catch (error) {
        log.dbError('query', error, { userId: req.user.id });
        return sendDatabaseError(res, error, 'Gagal memuat informasi siswa perwakilan');
    }
};

// Get guru info
export const getGuruInfo = async (req, res) => {
    const log = logger.withRequest(req, res);
    
    log.requestStart('GetGuruInfo', { userId: req.user.id });

    try {
        const [guruData] = await globalThis.dbPool.execute(
            `SELECT u.id, u.username, u.nama, u.email, u.role, g.id_guru, g.nip, g.mapel_id, 
                    m.nama_mapel, g.alamat, g.no_telp, g.jenis_kelamin, g.status, 
                    u.created_at, u.updated_at
             FROM users u
             LEFT JOIN guru g ON u.id = g.user_id
             LEFT JOIN mapel m ON g.mapel_id = m.id_mapel
             WHERE u.id = ?`,
            [req.user.id]
        );

        if (guruData.length === 0) {
            log.warn('Guru not found', { userId: req.user.id });
            return sendNotFoundError(res, 'Data guru tidak ditemukan');
        }

        const info = guruData[0];
        log.success('GetGuruInfo', { guruId: info.id_guru, nama: info.nama });

        res.json({
            success: true,
            id: info.id,
            username: info.username,
            nama: info.nama,
            email: info.email,
            role: info.role,
            guru_id: info.id_guru,
            nip: info.nip,
            mapel_id: info.mapel_id,
            mata_pelajaran: info.nama_mapel,
            alamat: info.alamat,
            no_telepon: info.no_telp,
            jenis_kelamin: info.jenis_kelamin,
            status: info.status,
            created_at: info.created_at,
            updated_at: info.updated_at
        });

    } catch (error) {
        log.dbError('query', error, { userId: req.user.id });
        return sendDatabaseError(res, error, 'Gagal memuat informasi guru');
    }
};

// Get admin info
export const getAdminInfo = async (req, res) => {
    const log = logger.withRequest(req, res);
    
    log.requestStart('GetAdminInfo', { userId: req.user.id });

    try {
        const [adminData] = await globalThis.dbPool.execute(
            `SELECT id, username, nama, email, role, created_at, updated_at
             FROM users
             WHERE id = ?`,
            [req.user.id]
        );

        if (adminData.length === 0) {
            log.warn('Admin not found', { userId: req.user.id });
            return sendNotFoundError(res, 'Data admin tidak ditemukan');
        }

        const info = adminData[0];
        log.success('GetAdminInfo', { adminId: info.id, nama: info.nama });

        res.json({
            success: true,
            id: info.id,
            username: info.username,
            nama: info.nama,
            email: info.email,
            role: info.role,
            created_at: info.created_at,
            updated_at: info.updated_at
        });

    } catch (error) {
        log.dbError('query', error, { userId: req.user.id });
        return sendDatabaseError(res, error, 'Gagal memuat informasi admin');
    }
};

// Get jadwal hari ini untuk siswa
export const getSiswaJadwalHariIni = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { siswa_id } = req.params;
    
    log.requestStart('GetSiswaJadwalHariIni', { siswaId: siswa_id });

    try {
        const wibTime = getWIBTime();
        const currentDay = HARI_INDONESIA[wibTime.getDay()];
        const todayWIB = getMySQLDateWIB();

        log.debug('Date context', { currentDay, todayWIB });

        // Get siswa's class
        const [siswaData] = await globalThis.dbPool.execute(
            SQL_GET_SISWA_KELAS,
            [siswa_id]
        );

        if (siswaData.length === 0) {
            log.warn('Siswa not found', { siswaId: siswa_id });
            return sendNotFoundError(res, 'Siswa tidak ditemukan');
        }

        const kelasId = siswaData[0].kelas_id;

        // Get today's schedule for the class with multi-guru support
        const jadwalData = await executeScheduleQuery(kelasId, todayWIB, currentDay);

        log.success('GetSiswaJadwalHariIni', { siswaId: siswa_id, kelasId, count: jadwalData.length });
        res.json(jadwalData);

    } catch (error) {
        log.dbError('query', error, { siswaId: siswa_id });
        return sendDatabaseError(res, error, 'Gagal memuat jadwal hari ini');
    }
};

// Get jadwal dengan rentang tanggal untuk siswa (7 hari terakhir)
export const getSiswaJadwalRentang = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { siswa_id } = req.params;
    const { tanggal } = req.query;
    
    log.requestStart('GetSiswaJadwalRentang', { siswaId: siswa_id, tanggal });

    try {
        // Get siswa's class
        const [siswaData] = await globalThis.dbPool.execute(
            SQL_GET_SISWA_KELAS,
            [siswa_id]
        );

        if (siswaData.length === 0) {
            log.warn('Siswa not found', { siswaId: siswa_id });
            return sendNotFoundError(res, 'Siswa tidak ditemukan');
        }

        const kelasId = siswaData[0].kelas_id;

        // Use WIB time for all calculations
        const todayWIB = getWIBTime();
        const todayDateStr = getMySQLDateWIB();
        
        // Parse target date in WIB context
        let targetDateStr;
        let targetDate;
        
        if (tanggal) {
            // Parse the input date string (YYYY-MM-DD format)
            const [year, month, day] = tanggal.split('-').map(Number);
            if (!year || !month || !day || Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
                log.validationFail('tanggal', tanggal, 'Invalid date format');
                return sendValidationError(res, 'Format tanggal tidak valid (gunakan YYYY-MM-DD)');
            }
            // Create date in WIB context (month is 0-indexed)
            targetDate = new Date(year, month - 1, day);
            targetDateStr = tanggal;
        } else {
            targetDate = todayWIB;
            targetDateStr = todayDateStr;
        }

        // Validate date range (max 7 days ago) using WIB
        const sevenDaysAgo = new Date(todayWIB.getTime() - (7 * 24 * 60 * 60 * 1000));
        
        // Compare dates using date strings to avoid timezone issues
        if (targetDateStr > todayDateStr) {
            log.validationFail('tanggal', tanggal, 'Future date not allowed');
            return sendValidationError(res, 'Tidak dapat melihat jadwal untuk tanggal masa depan');
        }

        const sevenDaysAgoStr = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgo.getDate()).padStart(2, '0')}`;
        if (targetDateStr < sevenDaysAgoStr) {
            log.validationFail('tanggal', tanggal, 'Date more than 7 days ago');
            return sendValidationError(res, 'Tidak dapat melihat jadwal lebih dari 7 hari yang lalu');
        }

        // Get day name for the target date
        const targetDay = HARI_INDONESIA[targetDate.getDay()];

        log.debug('Target date context', { targetDay, targetDateStr });

        // Get schedule for the target date with multi-guru support
        const jadwalData = await executeScheduleQuery(kelasId, targetDateStr, targetDay);

        log.success('GetSiswaJadwalRentang', { siswaId: siswa_id, targetDateStr, count: jadwalData.length });

        res.json({
            success: true,
            data: jadwalData,
            tanggal: targetDateStr,
            hari: targetDay
        });

    } catch (error) {
        log.dbError('query', error, { siswaId: siswa_id, tanggal });
        return sendDatabaseError(res, error, 'Gagal memuat jadwal rentang');
    }
};
