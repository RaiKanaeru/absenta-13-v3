/**
 * User Info Controller
 * Self-service info endpoints for siswa perwakilan, guru, admin
 * Migrated from server_modern.js - EXACT CODE COPY
 */

import { getWIBTime, getMySQLDateWIB } from '../utils/timeUtils.js';

import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError } from '../utils/errorHandler.js';

// ================================================
// SISWA PERWAKILAN ENDPOINTS
// ================================================

// Get siswa perwakilan info
export const getSiswaPerwakilanInfo = async (req, res) => {
    try {
        console.log('📋 Getting siswa perwakilan info for user:', req.user.id);

        const [siswaData] = await global.dbPool.execute(
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
            return res.status(404).json({ error: 'Data siswa perwakilan tidak ditemukan' });
        }

        const info = siswaData[0];
        console.log('✅ Siswa perwakilan info retrieved:', info);

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
        console.error('❌ Error getting siswa perwakilan info:', error);
        res.status(500).json({ error: 'Gagal memuat informasi siswa perwakilan' });
    }
};

// Get guru info
export const getGuruInfo = async (req, res) => {
    try {
        console.log('📋 Getting guru info for user:', req.user.id);

        const [guruData] = await global.dbPool.execute(
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
            return res.status(404).json({ error: 'Data guru tidak ditemukan' });
        }

        const info = guruData[0];
        console.log('✅ Guru info retrieved:', info);

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
        console.error('❌ Error getting guru info:', error);
        res.status(500).json({ error: 'Gagal memuat informasi guru' });
    }
};

// Get admin info
export const getAdminInfo = async (req, res) => {
    try {
        console.log('📋 Getting admin info for user:', req.user.id);

        const [adminData] = await global.dbPool.execute(
            `SELECT id, username, nama, email, role, created_at, updated_at
             FROM users
             WHERE id = ?`,
            [req.user.id]
        );

        if (adminData.length === 0) {
            return res.status(404).json({ error: 'Data admin tidak ditemukan' });
        }

        const info = adminData[0];
        console.log('✅ Admin info retrieved:', info);

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
        return sendDatabaseError(res, error, 'Gagal memuat informasi admin');
    }
};

// Get jadwal hari ini untuk siswa
export const getSiswaJadwalHariIni = async (req, res) => {
    try {
        const { siswa_id } = req.params;
        console.log('📅 Getting jadwal hari ini for siswa:', siswa_id);

        // FIX: Get current day in Indonesian using WIB timezone
        const wibTime = getWIBTime();
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const currentDay = dayNames[wibTime.getDay()];
        const todayWIB = getMySQLDateWIB();

        console.log('📅 Current day (WIB):', currentDay, 'Date:', todayWIB);

        // Get siswa's class
        const [siswaData] = await global.dbPool.execute(
            'SELECT kelas_id FROM siswa WHERE id_siswa = ?',
            [siswa_id]
        );

        if (siswaData.length === 0) {
            return res.status(404).json({ error: 'Siswa tidak ditemukan' });
        }

        const kelasId = siswaData[0].kelas_id;

        // Get today's schedule for the class with multi-guru support
        const [jadwalData] = await global.dbPool.execute(`
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
                        COALESCE(jg2.is_primary, 0)
                    ) 
                    ORDER BY jg2.is_primary DESC, g2.nama ASC 
                    SEPARATOR '||'
                ) as guru_list
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
            GROUP BY j.id_jadwal, j.jam_ke, j.jam_mulai, j.jam_selesai, mp.nama_mapel, mp.kode_mapel, g.nama, g.nip, k.nama_kelas, ag.status, ag.keterangan, ag.waktu_catat, rk.kode_ruang, rk.nama_ruang, j.jenis_aktivitas, j.is_absenable, j.keterangan_khusus, j.is_multi_guru
            ORDER BY j.jam_ke
        `, [todayWIB, todayWIB, kelasId, currentDay]);

        console.log('✅ Jadwal retrieved:', jadwalData.length, 'items');

        res.json(jadwalData);

    } catch (error) {
        console.error('❌ Error getting jadwal hari ini:', error);
        res.status(500).json({ error: 'Gagal memuat jadwal hari ini' });
    }
};

// Get jadwal dengan rentang tanggal untuk siswa (7 hari terakhir)
export const getSiswaJadwalRentang = async (req, res) => {
    try {
        const { siswa_id } = req.params;
        const { tanggal } = req.query;
        console.log('📅 Getting jadwal rentang for siswa:', siswa_id, 'tanggal:', tanggal);

        // Get siswa's class
        const [siswaData] = await global.dbPool.execute(
            'SELECT kelas_id FROM siswa WHERE id_siswa = ?',
            [siswa_id]
        );

        if (siswaData.length === 0) {
            return res.status(404).json({ error: 'Siswa tidak ditemukan' });
        }

        const kelasId = siswaData[0].kelas_id;

        // Validate date range (max 7 days ago)
        const today = new Date();
        const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
        const targetDate = tanggal ? new Date(tanggal) : today;

        if (targetDate > today) {
            return res.status(400).json({ error: 'Tidak dapat melihat jadwal untuk tanggal masa depan' });
        }

        if (targetDate < sevenDaysAgo) {
            return res.status(400).json({ error: 'Tidak dapat melihat jadwal lebih dari 7 hari yang lalu' });
        }

        // Get day name for the target date
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const targetDay = dayNames[targetDate.getDay()];
        const targetDateStr = targetDate.toISOString().split('T')[0];

        console.log('📅 Target day:', targetDay, 'Target date:', targetDateStr);

        // Get schedule for the target date with multi-guru support
        const [jadwalData] = await global.dbPool.execute(`
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
                        COALESCE(jg2.is_primary, 0)
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
            GROUP BY j.id_jadwal, j.jam_ke, j.jam_mulai, j.jam_selesai, mp.nama_mapel, mp.kode_mapel, g.nama, g.nip, k.nama_kelas, ag.status, ag.keterangan, ag.waktu_catat, rk.kode_ruang, rk.nama_ruang, j.jenis_aktivitas, j.is_absenable, j.keterangan_khusus, j.is_multi_guru
            ORDER BY j.jam_ke
        `, [targetDateStr, targetDateStr, targetDateStr, kelasId, targetDay]);

        console.log('✅ Jadwal rentang retrieved:', jadwalData.length, 'items for date:', targetDateStr);

        res.json({
            success: true,
            data: jadwalData,
            tanggal: targetDateStr,
            hari: targetDay
        });

    } catch (error) {
        console.error('❌ Error getting jadwal rentang:', error);
        res.status(500).json({ error: 'Gagal memuat jadwal rentang' });
    }
};
