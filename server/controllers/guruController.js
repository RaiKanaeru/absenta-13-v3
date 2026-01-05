/**
 * Guru Controller
 * Mengelola operasi CRUD guru dan layanan mandiri profil
 */

import bcrypt from 'bcrypt';
import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError, sendSuccessResponse } from '../utils/errorHandler.js';
import dotenv from 'dotenv';
import { getMySQLDateTimeWIB, getWIBTime, getMySQLDateWIB } from '../utils/timeUtils.js';
import { createLogger } from '../utils/logger.js';

dotenv.config();

const logger = createLogger('Guru');
const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;

// Validasi payload guru untuk Create/Update
async function validateGuruPayload(body, { isUpdate = false, excludeGuruId = null, excludeUserId = null } = {}) {
    const errors = [];
    const { nip, nama, username, email, mapel_id, status, password } = body;

    try {
        // Validasi NIP (wajib)
        if (!isUpdate || nip !== undefined) {
            if (!nip || typeof nip !== 'string') {
                errors.push('NIP wajib diisi');
            } else if (!/^[0-9]{10,20}$/.test(nip)) {
                errors.push('NIP harus berupa angka 10-20 digit');
            } else {
                // Cek unik NIP
                let sql = 'SELECT id FROM guru WHERE nip = ?';
                const params = [nip];
                if (isUpdate && excludeGuruId) {
                    sql += ' AND id != ?';
                    params.push(excludeGuruId);
                }
                const [existingNip] = await global.dbPool.execute(sql, params);
                if (existingNip.length > 0) {
                    errors.push('NIP sudah digunakan');
                }
            }
        }

        // Validasi nama (wajib)
        if (!isUpdate || nama !== undefined) {
            if (!nama || typeof nama !== 'string' || nama.trim().length < 2) {
                errors.push('Nama lengkap wajib diisi minimal 2 karakter');
            }
        }

        // Validasi username (wajib)
        if (!isUpdate || username !== undefined) {
            if (!username || typeof username !== 'string') {
                errors.push('Username wajib diisi');
            } else if (!/^[a-zA-Z0-9._-]{4,32}$/.test(username)) {
                errors.push('Username harus 4-32 karakter, hanya huruf, angka, titik, underscore, dan strip');
            } else {
                // Cek unik username di users
                let sql = 'SELECT id FROM users WHERE username = ?';
                const params = [username];
                if (isUpdate && excludeUserId) {
                    sql += ' AND id != ?';
                    params.push(excludeUserId);
                }
                const [existingUsers] = await global.dbPool.execute(sql, params);
                if (existingUsers.length > 0) {
                    errors.push('Username sudah digunakan');
                }
            }
        }

        // Validasi email (opsional)
        if (email !== undefined && email !== null && email !== '') {
            if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                errors.push('Format email tidak valid');
            } else {
                // Cek unik email di users
                let sql = 'SELECT id FROM users WHERE email = ?';
                const params = [email];
                if (isUpdate && excludeUserId) {
                    sql += ' AND id != ?';
                    params.push(excludeUserId);
                }
                const [existingUsers] = await global.dbPool.execute(sql, params);
                if (existingUsers.length > 0) {
                    errors.push('Email sudah digunakan');
                }
            }
        }

        // Validasi mapel_id (opsional)
        if (mapel_id !== undefined && mapel_id !== null && mapel_id !== '' && mapel_id !== 0) {
            if (!Number.isInteger(Number(mapel_id)) || Number(mapel_id) <= 0) {
                errors.push('ID mata pelajaran harus berupa angka positif');
            } else {
                const [existingMapel] = await global.dbPool.execute(
                    'SELECT id_mapel FROM mapel WHERE id_mapel = ? AND status = "aktif"',
                    [mapel_id]
                );
                if (existingMapel.length === 0) {
                    errors.push('Mata pelajaran tidak ditemukan atau tidak aktif');
                }
            }
        }

        // Validasi status
        if (status !== undefined && status !== null && status !== '') {
            if (!['aktif', 'nonaktif', 'pensiun'].includes(status)) {
                errors.push('Status harus aktif, nonaktif, atau pensiun');
            }
        }

        // Validasi password (wajib untuk create, opsional untuk update)
        if (!isUpdate && (!password || typeof password !== 'string' || password.length < 6)) {
            errors.push('Password wajib diisi minimal 6 karakter');
        }
        if (isUpdate && password !== undefined && password !== null && password !== '' && (typeof password !== 'string' || password.length < 6)) {
            errors.push('Password minimal 6 karakter');
        }

        return { isValid: errors.length === 0, errors };
    } catch (error) {
        throw new Error('Gagal memvalidasi data: ' + error.message);
    }
}

/**
 * Mengambil daftar semua guru
 * GET /api/admin/guru
 * @param {Object} req.query - Filter: page, limit, search
 * @returns {Array} Daftar guru dengan pagination
 */
export const getGuru = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { page = 1, limit = 10, search = '' } = req.query;
    
    log.requestStart('GetGuru', { page, limit, search: search ? '***' : '' });

    try {
        const offset = (page - 1) * limit;

        let query = `
            SELECT g.id, g.nip, g.nama, g.username, g.email, g.no_telp, g.jenis_kelamin, g.alamat,
                   g.mapel_id, COALESCE(m.nama_mapel, g.mata_pelajaran) AS nama_mapel,
                   g.status, u.id AS user_id, u.username AS user_username, u.email AS user_email, u.status AS user_status
            FROM guru g
            LEFT JOIN mapel m ON g.mapel_id = m.id_mapel
            LEFT JOIN users u ON g.user_id = u.id
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM guru g';
        let params = [];

        if (search) {
            query += ' WHERE (g.nama LIKE ? OR g.nip LIKE ? OR g.username LIKE ? OR COALESCE(m.nama_mapel, g.mata_pelajaran) LIKE ?)';
            countQuery += ' WHERE (g.nama LIKE ? OR g.nip LIKE ? OR g.username LIKE ?)';
            params = [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`];
        }

        query += ` ORDER BY g.created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;

        const [rows] = await global.dbPool.query(query, params);
        const [countResult] = await global.dbPool.query(countQuery, search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []);

        log.success('GetGuru', { count: rows.length, total: countResult[0].total });
        return sendSuccessResponse(res, rows, 'Data guru berhasil dimuat', 200, {
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total: countResult[0].total,
                total_pages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        log.dbError('getGuru', error);
        return sendDatabaseError(res, error, 'Gagal memuat data guru');
    }
};

/**
 * Membuat guru baru dengan akun user
 * POST /api/admin/guru
 * @param {Object} req.body - Data guru (nip, nama, username, password, mapel_id, dll)
 * @returns {Object} ID guru yang dibuat
 */
export const createGuru = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { nip, nama, mapel_id, username, password, email, no_telp, jenis_kelamin, alamat, status = 'aktif' } = req.body;
    
    log.requestStart('CreateGuru', { nip, nama, username });

    const connection = await global.dbPool.getConnection();

    try {
        // Validasi payload
        const validation = await validateGuruPayload(req.body, { isUpdate: false });
        
        if (!validation.isValid) {
            log.validationFail('payload', null, validation.errors.join(', '));
            connection.release();
            return sendValidationError(res, 'Data tidak valid', { details: validation.errors });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        await connection.beginTransaction();

        try {
            // Create user account
            const [userResult] = await connection.execute(
                'INSERT INTO users (username, password, role, nama, email, status) VALUES (?, ?, "guru", ?, ?, ?)',
                [username, hashedPassword, nama, email || null, status]
            );

            // Create guru record
            const mapelIdValue = (mapel_id && mapel_id > 0) ? mapel_id : null;
            
            await connection.execute(
                'INSERT INTO guru (id_guru, nip, nama, username, email, no_telp, jenis_kelamin, alamat, mapel_id, user_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [userResult.insertId, nip, nama, username, email || null, no_telp || null, jenis_kelamin || null, alamat || null, mapelIdValue, userResult.insertId, status]
            );

            await connection.commit();
            log.success('CreateGuru', { nama, nip, userId: userResult.insertId });
            return sendSuccessResponse(res, { id: userResult.insertId }, 'Guru berhasil ditambahkan', 201);

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        log.dbError('createGuru', error, { nip, nama });
        
        if (error.code === 'ER_DUP_ENTRY') {
            return sendDuplicateError(res, 'NIP atau username sudah digunakan');
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return sendValidationError(res, 'Mata pelajaran tidak ditemukan');
        } else {
            return sendDatabaseError(res, error, 'Gagal membuat akun guru');
        }
    } finally {
        connection.release();
    }
};

/**
 * Memperbarui data guru
 * PUT /api/admin/guru/:id
 * @param {Object} req.body - Data guru yang diupdate
 * @returns {null} Success message
 */
export const updateGuru = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    const { nip, nama, mapel_id, username, password, email, no_telp, jenis_kelamin, alamat, status } = req.body;

    log.requestStart('UpdateGuru', { id, nip, nama, username });

    const connection = await global.dbPool.getConnection();

    try {
        // Cek apakah guru ada
        const [existingGuru] = await connection.execute(
            'SELECT g.*, u.id as user_id FROM guru g LEFT JOIN users u ON g.user_id = u.id WHERE g.id = ?',
            [id]
        );

        if (existingGuru.length === 0) {
            connection.release();
            log.warn('UpdateGuru - guru not found', { id });
            return sendNotFoundError(res, 'Guru tidak ditemukan');
        }

        const guru = existingGuru[0];

        // Validasi payload
        const validation = await validateGuruPayload(req.body, {
            isUpdate: true,
            excludeGuruId: guru.id,
            excludeUserId: guru.user_id
        });

        if (!validation.isValid) {
            connection.release();
            log.validationFail('payload', null, validation.errors.join(', '));
            return sendValidationError(res, 'Data tidak valid', { details: validation.errors });
        }

        await connection.beginTransaction();

        try {
            // Update guru record
            const updateFields = [];
            const updateValues = [];

            if (nip !== undefined) { updateFields.push('nip = ?'); updateValues.push(nip); }
            if (nama !== undefined) { updateFields.push('nama = ?'); updateValues.push(nama); }
            if (username !== undefined) { updateFields.push('username = ?'); updateValues.push(username); }
            if (email !== undefined) { updateFields.push('email = ?'); updateValues.push(email); }
            if (no_telp !== undefined) { updateFields.push('no_telp = ?'); updateValues.push(no_telp); }
            if (jenis_kelamin !== undefined) { updateFields.push('jenis_kelamin = ?'); updateValues.push(jenis_kelamin); }
            if (alamat !== undefined) { updateFields.push('alamat = ?'); updateValues.push(alamat); }
            if (mapel_id !== undefined) { updateFields.push('mapel_id = ?'); updateValues.push(mapel_id); }
            if (status !== undefined) { updateFields.push('status = ?'); updateValues.push(status); }

            if (updateFields.length > 0) {
                updateValues.push(id);
                await connection.execute(
                    `UPDATE guru SET ${updateFields.join(', ')} WHERE id = ?`,
                    updateValues
                );
            }

            // Update users record
            const userUpdateFields = [];
            const userUpdateValues = [];

            if (nama !== undefined) { userUpdateFields.push('nama = ?'); userUpdateValues.push(nama); }
            if (username !== undefined) { userUpdateFields.push('username = ?'); userUpdateValues.push(username); }
            if (email !== undefined) { userUpdateFields.push('email = ?'); userUpdateValues.push(email); }
            if (status !== undefined) { userUpdateFields.push('status = ?'); userUpdateValues.push(status); }
            if (password !== undefined && password !== '') {
                const hashedPassword = await bcrypt.hash(password, saltRounds);
                userUpdateFields.push('password = ?');
                userUpdateValues.push(hashedPassword);
            }

            if (userUpdateFields.length > 0 && guru.user_id) {
                userUpdateValues.push(guru.user_id);
                await connection.execute(
                    `UPDATE users SET ${userUpdateFields.join(', ')} WHERE id = ?`,
                    userUpdateValues
                );
            }

            await connection.commit();
            log.success('UpdateGuru', { id, nama: nama || guru.nama });
            return sendSuccessResponse(res, null, 'Guru berhasil diperbarui');

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        log.dbError('updateGuru', error, { id });
        
        if (error.code === 'ER_DUP_ENTRY') {
            return sendDuplicateError(res, 'NIP atau username sudah digunakan');
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return sendValidationError(res, 'Referensi data tidak valid');
        } else {
            return sendDatabaseError(res, error, 'Gagal memperbarui guru');
        }
    } finally {
        connection.release();
    }
};

/**
 * Menghapus guru
 * DELETE /api/admin/guru/:id
 * @returns {null} Success message
 */
export const deleteGuru = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;

    log.requestStart('DeleteGuru', { id });

    const connection = await global.dbPool.getConnection();

    try {
        // Cek apakah guru ada
        const [existingGuru] = await connection.execute(
            'SELECT g.*, u.id as user_id FROM guru g LEFT JOIN users u ON g.user_id = u.id WHERE g.id = ?',
            [id]
        );

        if (existingGuru.length === 0) {
            connection.release();
            log.warn('DeleteGuru - guru not found', { id });
            return sendNotFoundError(res, 'Guru tidak ditemukan');
        }

        const guru = existingGuru[0];

        await connection.beginTransaction();

        try {
            // Delete guru record
            await connection.execute('DELETE FROM guru WHERE id = ?', [id]);

            // Delete user record jika masih ada
            if (guru.user_id) {
                await connection.execute('DELETE FROM users WHERE id = ?', [guru.user_id]);
            }

            await connection.commit();
            log.success('DeleteGuru', { id, nama: guru.nama, nip: guru.nip });
            return sendSuccessResponse(res, null, 'Guru berhasil dihapus');

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        log.dbError('deleteGuru', error, { id });

        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({ error: 'Tidak dapat menghapus guru karena masih memiliki relasi dengan data lain' });
        } else {
            return sendDatabaseError(res, error, 'Gagal menghapus guru');
        }
    } finally {
        connection.release();
    }
};

// ================================================
// PROFILE UPDATE FUNCTIONS
// ================================================

// Update profile for guru (self-service)
export const updateProfile = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { nama, username, email, alamat, no_telepon, jenis_kelamin, mata_pelajaran, jabatan } = req.body;
    const userId = req.user.id;

    log.requestStart('UpdateProfile', { userId, username });

    try {
        // Validate required fields
        if (!nama || !username) {
            log.validationFail('required_fields', null, 'Nama and username required');
            return sendValidationError(res, 'Nama dan username wajib diisi');
        }

        // Check if username is already taken by another user
        const [existingUser] = await global.dbPool.execute(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [username, userId]
        );

        if (existingUser.length > 0) {
            log.validationFail('username', username, 'Already taken');
            return sendDuplicateError(res, 'Username sudah digunakan oleh user lain');
        }

        const connection = await global.dbPool.getConnection();
        await connection.beginTransaction();

        try {
            // Update profile in users table
            await connection.execute(
                `UPDATE users SET nama = ?, username = ?, email = ?, updated_at = ? WHERE id = ?`,
                [nama, username, email || null, getMySQLDateTimeWIB(), userId]
            );

            // Update additional profile data in guru table
            await connection.execute(
                `UPDATE guru SET nama = ?, alamat = ?, no_telp = ?, jenis_kelamin = ?, mata_pelajaran = ?, updated_at = ? WHERE user_id = ?`,
                [nama, alamat || null, no_telepon || null, jenis_kelamin || null, mata_pelajaran || null, getMySQLDateTimeWIB(), userId]
            );

            await connection.commit();

            // Get updated user data
            const [updatedUser] = await global.dbPool.execute(
                `SELECT u.id, u.username, u.nama, u.email, u.role, g.alamat, g.no_telp as no_telepon, 
                        g.nip, g.jenis_kelamin, g.mata_pelajaran, u.created_at, u.updated_at 
                 FROM users u LEFT JOIN guru g ON u.id = g.user_id WHERE u.id = ?`,
                [userId]
            );

            log.success('UpdateProfile', { userId });
            return sendSuccessResponse(res, updatedUser[0], 'Profil berhasil diperbarui');
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        log.dbError('updateProfile', error, { userId });
        return sendDatabaseError(res, error, 'Gagal memperbarui profil');
    }
};

// Change password for guru (self-service)
export const changePassword = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { newPassword } = req.body;
    const userId = req.user.id;

    log.requestStart('ChangePassword', { userId });

    try {
        if (!newPassword) {
            log.validationFail('newPassword', null, 'Required');
            return sendValidationError(res, 'Password baru wajib diisi');
        }

        if (newPassword.length < 6) {
            log.validationFail('newPassword', null, 'Too short');
            return sendValidationError(res, 'Password baru minimal 6 karakter');
        }

        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        await global.dbPool.execute(
            'UPDATE users SET password = ?, updated_at = ? WHERE id = ?',
            [hashedPassword, getMySQLDateTimeWIB(), userId]
        );

        log.success('ChangePassword', { userId });
        return sendSuccessResponse(res, null, 'Password berhasil diubah');
    } catch (error) {
        log.dbError('changePassword', error, { userId });
        return sendDatabaseError(res, error, 'Gagal mengubah password');
    }
};

// ================================================
// GURU SELF-SERVICE ENDPOINTS
// ================================================

// Helper function to build jadwal query
const buildJadwalQuery = (role = 'admin', guruId = null) => {
    let query = `
        SELECT 
            j.id_jadwal, j.hari, j.jam_ke, j.jam_mulai, j.jam_selesai,
            j.jenis_aktivitas, j.is_absenable, j.keterangan_khusus, j.is_multi_guru, j.status,
            COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel,
            COALESCE(m.kode_mapel, '') as kode_mapel,
            k.id_kelas, k.nama_kelas,
            COALESCE(r.kode_ruang, '') as kode_ruang,
            COALESCE(r.nama_ruang, '') as nama_ruang,
            COALESCE(g.id_guru, 0) as guru_id,
            COALESCE(g.nama, '') as nama_guru,
            COALESCE(g.nip, '') as nip_guru
        FROM jadwal j
        LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
        JOIN kelas k ON j.kelas_id = k.id_kelas
        LEFT JOIN ruang_kelas r ON j.ruang_id = r.id_ruang
        LEFT JOIN guru g ON j.guru_id = g.id_guru
        WHERE j.status = 'aktif'
    `;

    const params = [];
    if (role === 'guru' && guruId) {
        query += ' AND j.guru_id = ?';
        params.push(guruId);
    }

    query += ' ORDER BY j.hari, j.jam_ke';
    return { query, params };
};

// Get teacher schedule
export const getGuruJadwal = async (req, res) => {
    const log = logger.withRequest(req, res);
    const guruId = req.user.guru_id;

    log.requestStart('GetGuruJadwal', { guruId });

    if (!guruId) {
        log.validationFail('guru_id', null, 'Not found in token');
        return sendValidationError(res, 'guru_id tidak ditemukan pada token pengguna');
    }

    try {
        const { query, params } = buildJadwalQuery('guru', guruId);
        const [jadwal] = await global.dbPool.execute(query, params);

        log.success('GetGuruJadwal', { count: jadwal.length, guruId });
        return sendSuccessResponse(res, jadwal);
    } catch (error) {
        log.dbError('getJadwal', error, { guruId });
        return sendDatabaseError(res, error, 'Gagal memuat jadwal guru');
    }
};

// Get teacher attendance history
export const getGuruHistory = async (req, res) => {
    const log = logger.withRequest(req, res);
    const guruId = req.user.guru_id;

    log.requestStart('GetGuruHistory', { guruId });

    if (!guruId) {
        log.validationFail('guru_id', null, 'Not found in token');
        return sendValidationError(res, 'guru_id tidak ditemukan pada token pengguna');
    }

    try {
        const [history] = await global.dbPool.execute(`
            SELECT ag.tanggal, ag.status, ag.keterangan, k.nama_kelas, 
                   COALESCE(mp.nama_mapel, j.keterangan_khusus) as nama_mapel
            FROM absensi_guru ag
            JOIN jadwal j ON ag.jadwal_id = j.id_jadwal
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN mapel mp ON j.mapel_id = mp.id_mapel
            WHERE j.guru_id = ?
            ORDER BY ag.tanggal DESC, j.jam_mulai ASC
            LIMIT 50
        `, [guruId]);

        log.success('GetGuruHistory', { count: history.length, guruId });
        return sendSuccessResponse(res, history);
    } catch (error) {
        log.dbError('getHistory', error, { guruId });
        return sendDatabaseError(res, error, 'Gagal memuat riwayat absensi');
    }
};

// Get student attendance history for teacher
export const getGuruStudentAttendanceHistory = async (req, res) => {
    const log = logger.withRequest(req, res);
    const guruId = req.user.guru_id;
    const { page = 1, limit = 5 } = req.query;

    log.requestStart('GetStudentHistory', { guruId, page, limit });

    if (!guruId) {
        log.validationFail('guru_id', null, 'Not found in token');
        return sendValidationError(res, 'guru_id tidak ditemukan pada token pengguna');
    }

    try {
        const todayWIB = getMySQLDateWIB();
        // Calculate 30 days ago in WIB timezone
        const wibNow = getWIBTime();
        const thirtyDaysAgoDate = new Date(wibNow.getTime() - 30 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgoWIB = `${thirtyDaysAgoDate.getFullYear()}-${String(thirtyDaysAgoDate.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysAgoDate.getDate()).padStart(2, '0')}`;

        const countQuery = `
            SELECT COUNT(DISTINCT DATE(absensi.waktu_absen)) as total_days
            FROM absensi_siswa absensi
            INNER JOIN jadwal ON absensi.jadwal_id = jadwal.id_jadwal
            WHERE jadwal.guru_id = ? AND absensi.waktu_absen >= ?
        `;

        const [countResult] = await global.dbPool.execute(countQuery, [guruId, thirtyDaysAgoWIB]);
        const totalDays = countResult[0].total_days;
        const totalPages = Math.ceil(totalDays / parseInt(limit));
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const datesQuery = `
            SELECT DISTINCT DATE(absensi.waktu_absen) as tanggal
            FROM absensi_siswa absensi
            INNER JOIN jadwal ON absensi.jadwal_id = jadwal.id_jadwal
            WHERE jadwal.guru_id = ? AND absensi.waktu_absen >= ?
            ORDER BY tanggal DESC LIMIT ? OFFSET ?
        `;

        const [datesResult] = await global.dbPool.execute(datesQuery, [guruId, thirtyDaysAgoWIB, parseInt(limit), offset]);
        const dates = datesResult.map(row => row.tanggal);

        if (dates.length === 0) {
            log.success('GetStudentHistory', { count: 0, guruId });
            return sendSuccessResponse(res, [], 'Data riwayat kosong', 200, {
                totalDays, totalPages, currentPage: parseInt(page),
                pagination: { currentPage: parseInt(page), totalPages, totalDays, limit: parseInt(limit) }
            });
        }

        const datePlaceholders = dates.map(() => '?').join(',');
        const query = `
            SELECT DATE(absensi.waktu_absen) as tanggal, jadwal.jam_ke, jadwal.jam_mulai, jadwal.jam_selesai,
                   mapel.nama_mapel, kelas.nama_kelas, siswa.nama as nama_siswa, siswa.nis,
                   absensi.status as status_kehadiran, absensi.keterangan, absensi.waktu_absen,
                   guru_absen.status as status_guru, guru_absen.keterangan as keterangan_guru,
                   ruang.kode_ruang, ruang.nama_ruang, ruang.lokasi
            FROM absensi_siswa absensi
            INNER JOIN jadwal ON absensi.jadwal_id = jadwal.id_jadwal
            LEFT JOIN mapel ON jadwal.mapel_id = mapel.id_mapel
            INNER JOIN kelas ON jadwal.kelas_id = kelas.id_kelas
            INNER JOIN siswa siswa ON absensi.siswa_id = siswa.id_siswa
            LEFT JOIN ruang_kelas ruang ON jadwal.ruang_id = ruang.id_ruang
            LEFT JOIN absensi_guru guru_absen ON jadwal.id_jadwal = guru_absen.jadwal_id 
                AND DATE(guru_absen.tanggal) = DATE(absensi.waktu_absen)
            WHERE jadwal.guru_id = ? AND DATE(absensi.waktu_absen) IN (${datePlaceholders})
            ORDER BY absensi.waktu_absen DESC, jadwal.jam_ke ASC
        `;

        const [history] = await global.dbPool.execute(query, [guruId, ...dates]);

        log.success('GetStudentHistory', { count: history.length, totalDays, guruId });
        return sendSuccessResponse(res, history, 'Riwayat absensi siswa', 200, {
            totalDays, totalPages, currentPage: parseInt(page),
            pagination: { currentPage: parseInt(page), totalPages, totalDays, limit: parseInt(limit) }
        });
    } catch (error) {
        log.dbError('getStudentHistory', error, { guruId });
        return sendDatabaseError(res, error, 'Gagal memuat riwayat absensi siswa');
    }
};

// Test endpoint for debugging
export const guruTest = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GuruTest', {});

    try {
        log.success('GuruTest', { user: req.user?.id });
        return sendSuccessResponse(res, { user: req.user }, 'Test endpoint working');
    } catch (error) {
        log.error('GuruTest failed', { error: error.message });
        return sendDatabaseError(res, error, 'Test endpoint error');
    }
};

// Simple student attendance endpoint
export const getGuruStudentAttendanceSimple = async (req, res) => {
    const log = logger.withRequest(req, res);
    const guruId = req.user.guru_id;

    log.requestStart('SimpleAttendance', { guruId });

    if (!guruId) {
        log.validationFail('guru_id', null, 'Not found');
        return sendValidationError(res, 'guru_id tidak ditemukan');
    }

    try {
        const [result] = await global.dbPool.execute(`
            SELECT COUNT(*) as total FROM jadwal j WHERE j.guru_id = ?
        `, [guruId]);

        log.success('SimpleAttendance', { total: result[0].total, guruId });
        return sendSuccessResponse(res, result, 'Simple endpoint working');
    } catch (error) {
        log.dbError('simpleAttendance', error, { guruId });
        return sendDatabaseError(res, error, 'Simple endpoint error');
    }
};
