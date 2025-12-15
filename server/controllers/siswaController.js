/**
 * Siswa Controller
 * CRUD operations for student management with account creation
 */

import bcrypt from 'bcrypt';
import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError, sendSuccessResponse } from '../utils/errorHandler.js';
import { getMySQLDateTimeWIB } from '../utils/timeUtils.js';
import { createLogger } from '../utils/logger.js';

import dotenv from 'dotenv';
dotenv.config();

const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;
const logger = createLogger('Siswa');

// Validasi payload siswa untuk Create/Update
async function validateSiswaPayload(body, { isUpdate = false, excludeStudentId = null, excludeUserId = null } = {}) {
    const errors = [];
    const { nis, nama, username, email, kelas_id, jenis_kelamin, jabatan, nomor_telepon_siswa, telepon_orangtua, password } = body;

    // Validasi NIS (wajib)
    if (!isUpdate || nis !== undefined) {
        if (!nis || typeof nis !== 'string') {
            errors.push('NIS wajib diisi');
        } else if (!/^\d{8,15}$/.test(nis)) {
            errors.push('NIS harus berupa angka 8-15 digit');
        } else {
            try {
                let sql = 'SELECT id FROM siswa WHERE nis = ?';
                const params = [nis];
                if (isUpdate && excludeStudentId) {
                    sql += ' AND id != ?';
                    params.push(excludeStudentId);
                }
                const [existingNis] = await global.dbPool.execute(sql, params);
                if (existingNis.length > 0) {
                    errors.push('NIS sudah digunakan');
                }
            } catch (error) {
                errors.push('Gagal memvalidasi NIS');
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
        } else if (!/^[a-z0-9._-]{4,30}$/.test(username)) {
            errors.push('Username harus 4-30 karakter, hanya huruf kecil, angka, titik, underscore, dan strip');
        } else {
            try {
                let sql = 'SELECT id FROM users WHERE username = ?';
                const params = [username];
                if (isUpdate && excludeUserId) {
                    sql += ' AND id != ?';
                    params.push(excludeUserId);
                }
                const [existingUsername] = await global.dbPool.execute(sql, params);
                if (existingUsername.length > 0) {
                    errors.push('Username sudah digunakan');
                }
            } catch (error) {
                errors.push('Gagal memvalidasi username');
            }
        }
    }

    // Validasi email (opsional)
    if (email !== undefined && email !== null && email !== '') {
        if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('Format email tidak valid');
        } else {
            try {
                let sql = 'SELECT id FROM users WHERE email = ?';
                const params = [email];
                if (isUpdate && excludeUserId) {
                    sql += ' AND id != ?';
                    params.push(excludeUserId);
                }
                const [existingEmail] = await global.dbPool.execute(sql, params);
                if (existingEmail.length > 0) {
                    errors.push('Email sudah digunakan');
                }
            } catch (error) {
                errors.push('Gagal memvalidasi email');
            }
        }
    }

    // Validasi kelas_id (wajib)
    if (!isUpdate || kelas_id !== undefined) {
        if (!kelas_id || !Number.isInteger(Number(kelas_id)) || Number(kelas_id) <= 0) {
            errors.push('Kelas wajib dipilih');
        } else {
            try {
                const [existingKelas] = await global.dbPool.execute(
                    'SELECT id_kelas FROM kelas WHERE id_kelas = ? AND status = "aktif"',
                    [kelas_id]
                );
                if (existingKelas.length === 0) {
                    errors.push('Kelas tidak ditemukan atau tidak aktif');
                }
            } catch (error) {
                errors.push('Gagal memvalidasi kelas');
            }
        }
    }

    // Validasi jenis kelamin
    if (jenis_kelamin !== undefined && jenis_kelamin !== null && jenis_kelamin !== '') {
        if (!['L', 'P'].includes(jenis_kelamin)) {
            errors.push('Jenis kelamin harus L atau P');
        }
    }

    // Validasi jabatan (opsional)
    if (jabatan !== undefined && jabatan !== null && jabatan !== '') {
        const validJabatan = ['Ketua Kelas', 'Wakil Ketua', 'Sekretaris Kelas', 'Bendahara', 'Anggota'];
        if (!validJabatan.includes(jabatan)) {
            errors.push(`Jabatan harus salah satu dari: ${validJabatan.join(', ')}`);
        }
    }

    // Validasi nomor telepon siswa (opsional)
    if (nomor_telepon_siswa !== undefined && nomor_telepon_siswa !== null && nomor_telepon_siswa !== '') {
        if (!/^[0-9]{10,15}$/.test(nomor_telepon_siswa)) {
            errors.push('Nomor telepon siswa harus berupa angka 10-15 digit');
        } else {
            try {
                let sql = 'SELECT id FROM siswa WHERE nomor_telepon_siswa = ?';
                const params = [nomor_telepon_siswa];
                if (isUpdate && excludeStudentId) {
                    sql += ' AND id != ?';
                    params.push(excludeStudentId);
                }
                const [existingPhone] = await global.dbPool.execute(sql, params);
                 if (existingPhone.length > 0) {
                    errors.push('Nomor telepon siswa sudah digunakan');
                }
            } catch (error) {
                 errors.push('Gagal memvalidasi nomor telepon siswa');
            }
        }
    }

    // Validasi password (wajib untuk create, opsional untuk update)
    if (!isUpdate && (!password || typeof password !== 'string' || password.length < 6)) {
        errors.push('Password wajib diisi minimal 6 karakter');
    }
    if (isUpdate && password !== undefined && password !== null && password !== '' && (typeof password !== 'string' || password.length < 6)) {
        errors.push('Password minimal 6 karakter');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

// Get All Siswa
export const getSiswa = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    log.requestStart('GetAll', { page, limit, search: search || null });

    try {
        let query = `
            SELECT s.*, k.nama_kelas, u.username, u.email as user_email, u.status as user_status
            FROM siswa s
            JOIN kelas k ON s.kelas_id = k.id_kelas
            JOIN users u ON s.user_id = u.id
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM siswa s JOIN kelas k ON s.kelas_id = k.id_kelas JOIN users u ON s.user_id = u.id';
        let params = [];

        if (search) {
            query += ' WHERE (s.nama LIKE ? OR s.nis LIKE ? OR k.nama_kelas LIKE ?)';
            countQuery += ' WHERE (s.nama LIKE ? OR s.nis LIKE ? OR k.nama_kelas LIKE ?)';
            params = [`%${search}%`, `%${search}%`, `%${search}%`];
        }

        query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
        params.push(Number(limit), Number(offset));

        const [rows] = await global.dbPool.query(query, params);
        const [countResult] = await global.dbPool.query(countQuery, search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []);

        log.success('GetAll', { count: rows.length, total: countResult[0].total, page });

        res.json({
            success: true,
            data: rows,
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total: countResult[0].total,
                total_pages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        log.dbError('query', error, { page, limit, search });
        return sendDatabaseError(res, error, 'Gagal mengambil data siswa');
    }
};

// Create Siswa
export const createSiswa = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { nis, nama, kelas_id, username, password, email, jabatan, nomor_telepon_siswa, telepon_orangtua, jenis_kelamin, alamat, status = 'aktif' } = req.body;
    
    log.requestStart('Create', { nis, nama, username, kelas_id });
    
    const connection = await global.dbPool.getConnection();
    try {
        // Validasi payload
        const validation = await validateSiswaPayload(req.body, { isUpdate: false });
        if (!validation.isValid) {
            log.validationFail('payload', null, validation.errors.join(', '));
            return sendValidationError(res, 'Data tidak valid', { details: validation.errors });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Start transaction
        await connection.beginTransaction();

        try {
            // Create user account
            const [userResult] = await connection.execute(
                'INSERT INTO users (username, password, role, nama, email, status) VALUES (?, ?, "siswa", ?, ?, ?)',
                [username, hashedPassword, nama, email || null, status]
            );

            // Create siswa record
            await connection.execute(
                'INSERT INTO siswa (nis, nama, kelas_id, user_id, jabatan, telepon_orangtua, nomor_telepon_siswa, jenis_kelamin, alamat, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    nis, 
                    nama, 
                    kelas_id, 
                    userResult.insertId, 
                    jabatan || 'Anggota', 
                    telepon_orangtua || null, 
                    nomor_telepon_siswa || null,
                    jenis_kelamin || null,
                    alamat || null,
                    status
                ]
            );

            await connection.commit();

            log.success('Create', { userId: userResult.insertId, nis, nama });
            return sendSuccessResponse(res, { id: userResult.insertId }, 'Siswa berhasil ditambahkan', 201);

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        log.dbError('insert', error, { nis, nama });

        if (error.code === 'ER_DUP_ENTRY') {
            return sendDuplicateError(res, 'NIS, Username, atau Email sudah digunakan');
        }
        return sendDatabaseError(res, error, 'Gagal membuat akun siswa');
    } finally {
        connection.release();
    }
};

// Update Siswa
export const updateSiswa = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    const { nis, nama, kelas_id, username, password, email, jabatan, nomor_telepon_siswa, telepon_orangtua, jenis_kelamin, alamat, status } = req.body;

    log.requestStart('Update', { id, nis, nama, username });

    const connection = await global.dbPool.getConnection();
    try {
        // Cek apakah siswa ada
        const [existingSiswa] = await connection.execute(
            'SELECT s.*, u.id as user_id FROM siswa s LEFT JOIN users u ON s.user_id = u.id WHERE s.id = ?',
            [id]
        );

        if (existingSiswa.length === 0) {
            log.warn('Update failed - not found', { id });
            return sendNotFoundError(res, 'Siswa tidak ditemukan');
        }

        const siswa = existingSiswa[0];

        // Validasi payload
        const validation = await validateSiswaPayload(req.body, {
            isUpdate: true,
            excludeStudentId: siswa.id,
            excludeUserId: siswa.user_id
        });

        if (!validation.isValid) {
            log.validationFail('payload', null, validation.errors.join(', '));
            return sendValidationError(res, 'Data tidak valid', { details: validation.errors });
        }

        // Start transaction
        await connection.beginTransaction();

        try {
            // Update siswa record
            const updateFields = [];
            const updateValues = [];

            if (nis !== undefined) { updateFields.push('nis = ?'); updateValues.push(nis); }
            if (nama !== undefined) { updateFields.push('nama = ?'); updateValues.push(nama); }
            if (kelas_id !== undefined) { updateFields.push('kelas_id = ?'); updateValues.push(kelas_id); }
            if (jabatan !== undefined) { updateFields.push('jabatan = ?'); updateValues.push(jabatan); }
            if (telepon_orangtua !== undefined) { updateFields.push('telepon_orangtua = ?'); updateValues.push(telepon_orangtua); }
            if (nomor_telepon_siswa !== undefined) { updateFields.push('nomor_telepon_siswa = ?'); updateValues.push(nomor_telepon_siswa); }
            if (jenis_kelamin !== undefined) { updateFields.push('jenis_kelamin = ?'); updateValues.push(jenis_kelamin); }
            if (alamat !== undefined) { updateFields.push('alamat = ?'); updateValues.push(alamat); }
            if (status !== undefined) { updateFields.push('status = ?'); updateValues.push(status); }

            if (updateFields.length > 0) {
                updateValues.push(id);
                await connection.execute(
                    `UPDATE siswa SET ${updateFields.join(', ')} WHERE id = ?`,
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

            if (userUpdateFields.length > 0 && siswa.user_id) {
                userUpdateValues.push(siswa.user_id);
                await connection.execute(
                    `UPDATE users SET ${userUpdateFields.join(', ')} WHERE id = ?`,
                    userUpdateValues
                );
            }

            await connection.commit();
            log.success('Update', { id, nama: nama || siswa.nama });
            return sendSuccessResponse(res, null, 'Data siswa berhasil diperbarui');

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        log.dbError('update', error, { id, nis, nama });
        
        if (error.code === 'ER_DUP_ENTRY') {
            return sendDuplicateError(res, 'NIS, Username, atau Nomor Telepon sudah digunakan');
        }
        return sendDatabaseError(res, error, 'Gagal memperbarui data siswa');
    } finally {
        connection.release();
    }
};

// Delete Siswa
export const deleteSiswa = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;

    log.requestStart('Delete', { id });

    const connection = await global.dbPool.getConnection();
    try {
        // Cek apakah siswa ada
        const [existingSiswa] = await connection.execute(
            'SELECT s.*, u.id as user_id FROM siswa s LEFT JOIN users u ON s.user_id = u.id WHERE s.id = ?',
            [id]
        );

        if (existingSiswa.length === 0) {
            log.warn('Delete failed - not found', { id });
            return sendNotFoundError(res, 'Siswa tidak ditemukan');
        }

        const siswa = existingSiswa[0];

        // Start transaction
        await connection.beginTransaction();

        try {
            // Delete siswa record
            await connection.execute('DELETE FROM siswa WHERE id = ?', [id]);

            // Delete user record if exists
            if (siswa.user_id) {
                await connection.execute('DELETE FROM users WHERE id = ?', [siswa.user_id]);
            }

            await connection.commit();
            log.success('Delete', { id, nama: siswa.nama });
            return sendSuccessResponse(res, null, 'Siswa berhasil dihapus');

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        log.dbError('delete', error, { id });

        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return sendValidationError(res, 'Tidak dapat menghapus siswa karena memiliki data terkait (absensi/jurnal)', { reason: 'has_references' });
        }
        return sendDatabaseError(res, error, 'Gagal menghapus siswa');
    } finally {
        connection.release();
    }
};

// Update profile for siswa (self-service)
export const updateProfile = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { nama, username, email, alamat, telepon_orangtua, nomor_telepon_siswa, jenis_kelamin } = req.body;
    const userId = req.user.id;

    log.requestStart('UpdateProfile', { userId, nama, username });

    try {
        // Validate required fields
        if (!nama || !username) {
            log.validationFail('nama/username', null, 'Required fields missing');
            return sendValidationError(res, 'Nama dan username wajib diisi', { fields: ['nama', 'username'] });
        }

        // Check if username is already taken by another user
        const [existingUser] = await global.dbPool.execute(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [username, userId]
        );

        if (existingUser.length > 0) {
            log.warn('UpdateProfile failed - username taken', { username });
            return sendDuplicateError(res, 'Username sudah digunakan oleh user lain');
        }

        // Check if nomor_telepon_siswa is already taken
        if (nomor_telepon_siswa && nomor_telepon_siswa.trim()) {
            const [existingPhone] = await global.dbPool.execute(
                'SELECT user_id FROM siswa WHERE nomor_telepon_siswa = ? AND user_id != ?',
                [nomor_telepon_siswa.trim(), userId]
            );

            if (existingPhone.length > 0) {
                log.warn('UpdateProfile failed - phone taken', { nomor_telepon_siswa });
                return sendDuplicateError(res, 'Nomor telepon siswa sudah digunakan oleh siswa lain');
            }
        }

        // Start transaction
        const connection = await global.dbPool.getConnection();
        await connection.beginTransaction();

        try {
            // Update profile in users table
            await connection.execute(
                `UPDATE users SET 
                    nama = ?, 
                    username = ?, 
                    email = ?,
                    updated_at = ?
                WHERE id = ?`,
                [nama, username, email || null, getMySQLDateTimeWIB(), userId]
            );

            // Update additional profile data in siswa table
            await connection.execute(
                `UPDATE siswa SET 
                    nama = ?, 
                    alamat = ?, 
                    telepon_orangtua = ?,
                    nomor_telepon_siswa = ?,
                    jenis_kelamin = ?,
                    updated_at = ?
                WHERE user_id = ?`,
                [nama, alamat || null, telepon_orangtua || null, nomor_telepon_siswa || null, jenis_kelamin || null, getMySQLDateTimeWIB(), userId]
            );

            await connection.commit();

            // Get updated user data
            const [updatedUser] = await global.dbPool.execute(
                `SELECT u.id, u.username, u.nama, u.email, u.role, s.alamat, s.telepon_orangtua, s.nomor_telepon_siswa,
                        s.nis, k.nama_kelas as kelas, s.jenis_kelamin, u.created_at, u.updated_at
                 FROM users u
                 LEFT JOIN siswa s ON u.id = s.user_id
                 LEFT JOIN kelas k ON s.kelas_id = k.id_kelas
                 WHERE u.id = ?`,
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
        return sendDatabaseError(res, error, 'Gagal mengupdate profil');
    }
};

// Change password for siswa (self-service)
export const changePassword = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { newPassword } = req.body;
    const userId = req.user.id;

    log.requestStart('ChangePassword', { userId });

    try {
        // Validate required fields
        if (!newPassword) {
            log.validationFail('newPassword', null, 'Required field missing');
            return sendValidationError(res, 'Password baru wajib diisi', { field: 'newPassword' });
        }

        if (newPassword.length < 6) {
            log.validationFail('newPassword', null, 'Password too short');
            return sendValidationError(res, 'Password baru minimal 6 karakter', { minLength: 6 });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password in users table
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
