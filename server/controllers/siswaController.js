/**
 * Siswa Controller
 * Operasi CRUD untuk manajemen siswa dengan pembuatan akun
 */

import bcrypt from 'bcrypt';
import { sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError, sendSuccessResponse } from '../utils/errorHandler.js';
import { getMySQLDateTimeWIB } from '../utils/timeUtils.js';
import { createLogger } from '../utils/logger.js';
import db from '../config/db.js';

import dotenv from 'dotenv';
dotenv.config();

const saltRounds = Number.parseInt(process.env.SALT_ROUNDS) || 10;
const logger = createLogger('Siswa');

/**
 * Register NIS validation check
 * @private
 */
function registerNISValidation(nis, isUpdate, excludeStudentId, errors, promises, checks) {
    if (isUpdate && nis === undefined) return;
    
    if (!nis || typeof nis !== 'string') {
        errors.push('NIS wajib diisi');
        return;
    }
    
    if (!/^\d{8,15}$/.test(nis)) {
        errors.push('NIS harus berupa angka 8-15 digit');
        return;
    }
    
    const sql = isUpdate && excludeStudentId
        ? 'SELECT id FROM siswa WHERE nis = ? AND id != ? LIMIT 1'
        : 'SELECT id FROM siswa WHERE nis = ? LIMIT 1';
    const params = isUpdate && excludeStudentId ? [nis, excludeStudentId] : [nis];
    
    promises.push(db.execute(sql, params));
    checks.push({ type: 'nis', errorMsg: 'NIS sudah digunakan' });
}

/**
 * Register username validation check
 * @private
 */
function registerUsernameValidation(username, isUpdate, excludeUserId, errors, promises, checks) {
    if (isUpdate && username === undefined) return;
    
    if (!username || typeof username !== 'string') {
        errors.push('Username wajib diisi');
        return;
    }
    
    if (!/^[a-z0-9._-]{4,30}$/.test(username)) {
        errors.push('Username harus 4-30 karakter, hanya huruf kecil, angka, titik, underscore, dan strip');
        return;
    }
    
    const sql = isUpdate && excludeUserId
        ? 'SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1'
        : 'SELECT id FROM users WHERE username = ? LIMIT 1';
    const params = isUpdate && excludeUserId ? [username, excludeUserId] : [username];
    
    promises.push(db.execute(sql, params));
    checks.push({ type: 'username', errorMsg: 'Username sudah digunakan' });
}

/**
 * Register email validation check
 * @private
 */
function registerEmailValidation(email, isUpdate, excludeUserId, errors, promises, checks) {
    if (email === undefined || email === null || email === '') return;
    
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Format email tidak valid');
        return;
    }
    
    const sql = isUpdate && excludeUserId
        ? 'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1'
        : 'SELECT id FROM users WHERE email = ? LIMIT 1';
    const params = isUpdate && excludeUserId ? [email, excludeUserId] : [email];
    
    promises.push(db.execute(sql, params));
    checks.push({ type: 'email', errorMsg: 'Email sudah digunakan' });
}

/**
 * Register kelas validation check
 * @private
 */
function registerKelasValidation(kelas_id, isUpdate, errors, promises, checks) {
    if (isUpdate && kelas_id === undefined) return;
    
    if (!kelas_id || !Number.isInteger(Number(kelas_id)) || Number(kelas_id) <= 0) {
        errors.push('Kelas wajib dipilih');
        return;
    }
    
    promises.push(db.execute(
        'SELECT id_kelas FROM kelas WHERE id_kelas = ? AND status = "aktif" LIMIT 1',
        [kelas_id]
    ));
    checks.push({ type: 'kelas', errorMsg: 'Kelas tidak ditemukan atau tidak aktif', expectEmpty: true });
}

/**
 * Validate simple fields (gender, jabatan, phone, password)
 * @private
 */
/**
 * Validate basic rules for simple fields
 * @private
 */
function validateSiswaBasicRules(body, isUpdate, errors) {
    const { jenis_kelamin, jabatan, nomor_telepon_siswa, password } = body;
    const isPresent = (val) => val !== undefined && val !== null && val !== '';
    const VALID_JABATAN = ['Siswa', 'Ketua Kelas', 'Wakil Ketua', 'Sekretaris Kelas', 'Bendahara', 'Anggota'];

    if (isPresent(jenis_kelamin) && !['L', 'P'].includes(jenis_kelamin)) {
        errors.push('Jenis kelamin harus L atau P');
    }
    
    if (isPresent(jabatan) && !VALID_JABATAN.includes(jabatan)) {
        errors.push(`Jabatan harus salah satu dari: ${VALID_JABATAN.join(', ')}`);
    }


    if (isPresent(nomor_telepon_siswa) && !/^\d{10,15}$/.test(nomor_telepon_siswa)) {
        errors.push('Nomor telepon siswa harus berupa angka 10-15 digit');
    }

    if (!isUpdate && !(typeof password === 'string' && password.length >= 6)) {
        errors.push('Password wajib diisi minimal 6 karakter');
    } else if (isUpdate && isPresent(password) && !(typeof password === 'string' && password.length >= 6)) {
        errors.push('Password minimal 6 karakter');
    }
}

/**
 * Register phone validation check
 * @private
 */
function registerPhoneValidation(phone, isUpdate, excludeStudentId, promises, checks) {
    if (!phone || !/^\d{10,15}$/.test(phone)) return;

    const useExclude = isUpdate && excludeStudentId;
    const sql = useExclude
        ? 'SELECT id FROM siswa WHERE nomor_telepon_siswa = ? AND id != ? LIMIT 1'
        : 'SELECT id FROM siswa WHERE nomor_telepon_siswa = ? LIMIT 1';
    
    promises.push(db.execute(sql, useExclude ? [phone, excludeStudentId] : [phone]));
    checks.push({ type: 'phone', errorMsg: 'Nomor telepon siswa sudah digunakan' });
}

/**
 * Validate simple fields (gender, jabatan, phone, password)
 * @private
 */
function validateSimpleFields(body, isUpdate, excludeStudentId, promises, checks) {
    const errors = [];
    
    // 1. Basic validation (sync)
    validateSiswaBasicRules(body, isUpdate, errors);
    
    // 2. DB uniqueness check for phone
    const { nomor_telepon_siswa } = body;
    registerPhoneValidation(nomor_telepon_siswa, isUpdate, excludeStudentId, promises, checks);
    
    return errors;
}

/**
 * Process validation results from parallel DB queries
 * @private
 */
async function processValidationResults(promises, checks) {
    const errors = [];
    if (promises.length === 0) return errors;
    
    try {
        const results = await Promise.all(promises);
        
        for (let i = 0; i < results.length; i++) {
            const [rows] = results[i];
            const check = checks[i];
            
            const hasRows = rows.length > 0;
            const shouldFail = check.expectEmpty ? !hasRows : hasRows;
            
            if (shouldFail) {
                errors.push(check.errorMsg);
            }
        }
    } catch (validationError) {
        // Log validation error but return user-friendly message
        logger.error('Validation query error', validationError, { context: 'validateSiswaPayload' });
        errors.push('Gagal memvalidasi data');
    }
    
    return errors;
}

// Validasi payload siswa untuk Create/Update (optimized with parallel queries)
async function validateSiswaPayload(body, { isUpdate = false, excludeStudentId = null, excludeUserId = null } = {}) {
    const errors = [];
    const { nis, nama, username, email, kelas_id } = body;

    // Collect validation queries to run in parallel
    const validationPromises = [];
    const validationChecks = [];

    // Register field validations
    registerNISValidation(nis, isUpdate, excludeStudentId, errors, validationPromises, validationChecks);
    registerUsernameValidation(username, isUpdate, excludeUserId, errors, validationPromises, validationChecks);
    registerEmailValidation(email, isUpdate, excludeUserId, errors, validationPromises, validationChecks);
    registerKelasValidation(kelas_id, isUpdate, errors, validationPromises, validationChecks);
    
    // Validate nama
    if ((!isUpdate || nama !== undefined) && (!nama || typeof nama !== 'string' || nama.trim().length < 2)) {
        errors.push('Nama lengkap wajib diisi minimal 2 karakter');
    }
    
    // Validate simple fields and collect their DB checks
    const simpleFieldErrors = validateSimpleFields(body, isUpdate, excludeStudentId, validationPromises, validationChecks);
    errors.push(...simpleFieldErrors);

    // Execute all validation queries in parallel and process results
    const dbErrors = await processValidationResults(validationPromises, validationChecks);
    errors.push(...dbErrors);

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
            SELECT s.*, k.nama_kelas, u.username, u.email as user_email, u.status as user_status, u.is_perwakilan
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

        const [rows] = await db.query(query, params);
        const [countResult] = await db.query(countQuery, search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []);

        log.success('GetAll', { count: rows.length, total: countResult[0].total, page });

        res.json({
            success: true,
            data: rows,
            pagination: {
                current_page: Number.parseInt(page),
                per_page: Number.parseInt(limit),
                total: countResult[0].total,
                total_pages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        log.dbError('query', error, { page, limit, search });
        return sendDatabaseError(res, error, 'Gagal mengambil data siswa');
    }
};

/**
 * Menambahkan akun siswa perwakilan berdasarkan data siswa yang sudah ada
 * POST /api/admin/siswa
 */
export const createSiswa = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { nis, username, password, email, status } = req.body;
    
    // Normalize input
    const trimmedNis = nis?.trim() || '';
    const trimmedUsername = username?.trim() || '';
    const trimmedEmail = email?.trim() || '';
    const accountStatus = status || 'aktif';

    log.requestStart('Create', { nis: trimmedNis, username: trimmedUsername });

    // 1. Basic Input Validation
    const validationErrors = validateCreateSiswaInput({ trimmedNis, trimmedUsername, password, trimmedEmail, accountStatus });
    if (validationErrors) {
        const [field, value, message] = validationErrors;
        log.validationFail(field, value, 'Invalid input');
        return sendValidationError(res, message);
    }

    const connection = await db.getConnection();

    try {
        // 2. Business Logic Validation (Database checks)
        const siswa = await validateSiswaForAccountCreation(connection, trimmedNis);
        if (!siswa) {
            log.validationFail('nis', trimmedNis, 'Student not found');
            return sendValidationError(res, 'Data siswa belum ada. Tambahkan di Data Siswa terlebih dahulu.');
        }

        if (siswa.user_id) {
            log.validationFail('user_id', siswa.user_id, 'Account exists');
            return sendDuplicateError(res, 'Akun siswa sudah terdaftar');
        }

        // Check availability of username and email
        const isAvailable = await checkUserCredentialsAvailability(connection, trimmedUsername, trimmedEmail);
        if (!isAvailable.success) {
            log.validationFail(isAvailable.field, isAvailable.value, 'Already used');
            return sendDuplicateError(res, isAvailable.message);
        }

        // 3. Execution (Transaction)
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        await connection.beginTransaction();

        try {
            const userId = await insertUserAndLinkSiswa(connection, {
                username: trimmedUsername,
                password: hashedPassword,
                nama: siswa.nama,
                email: trimmedEmail,
                status: accountStatus,
                siswaId: siswa.id
            });

            await connection.commit();
            log.success('Create', { userId, nis: trimmedNis, nama: siswa.nama });
            return sendSuccessResponse(res, { id: userId }, 'Akun siswa berhasil ditambahkan', 201);

        } catch (txError) {
            await connection.rollback();
            throw txError;
        }

    } catch (error) {
        log.dbError('insert', error, { nis: trimmedNis, username: trimmedUsername });
        if (error.code === 'ER_DUP_ENTRY') {
            return sendDuplicateError(res, 'NIS, Username, atau Email sudah digunakan');
        }
        return sendDatabaseError(res, error, 'Gagal membuat akun siswa');
    } finally {
        connection.release();
    }
};

/**
 * Helper: Validate input for createSiswa
 */
function validateCreateSiswaInput({ trimmedNis, trimmedUsername, password, trimmedEmail, accountStatus }) {
    if (!trimmedNis) return ['nis', null, 'NIS wajib diisi'];
    if (!/^\d{8,15}$/.test(trimmedNis)) return ['nis', trimmedNis, 'NIS harus berupa angka 8-15 digit'];
    
    if (!trimmedUsername) return ['username', null, 'Username wajib diisi'];
    if (!/^[a-z0-9._-]{4,30}$/.test(trimmedUsername)) return ['username', trimmedUsername, 'Username harus 4-30 karakter, huruf kecil, angka, ., _, -'];
    
    if (!password || typeof password !== 'string' || password.length < 6) return ['password', null, 'Password wajib diisi minimal 6 karakter'];
    
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return ['email', trimmedEmail, 'Format email tidak valid'];
    
    const validStatuses = ['aktif', 'tidak_aktif', 'ditangguhkan'];
    if (accountStatus && !validStatuses.includes(accountStatus)) return ['status', accountStatus, 'Status akun tidak valid'];

    return null;
}

/**
 * Helper: Check if student exists and get details
 */
async function validateSiswaForAccountCreation(connection, nis) {
    const [rows] = await connection.execute(
        'SELECT id, nama, kelas_id, user_id FROM siswa WHERE nis = ? LIMIT 1',
        [nis]
    );
    return rows.length > 0 ? rows[0] : null;
}

/**
 * Helper: Check username and email availability
 */
async function checkUserCredentialsAvailability(connection, username, email) {
    const [existingUser] = await connection.execute('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
    if (existingUser.length > 0) return { success: false, field: 'username', value: username, message: 'Username sudah digunakan' };

    if (email) {
        const [existingEmail] = await connection.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
        if (existingEmail.length > 0) return { success: false, field: 'email', value: email, message: 'Email sudah digunakan' };
    }
    return { success: true };
}

/**
 * Helper: Insert User and Update Siswa Link
 */
async function insertUserAndLinkSiswa(connection, { username, password, nama, email, status, siswaId }) {
    const [userResult] = await connection.execute(
        'INSERT INTO users (username, password, role, nama, email, status, is_perwakilan) VALUES (?, ?, "siswa", ?, ?, ?, ?)',
        [username, password, nama, email || null, status, 1]
    );
    
    await connection.execute(
        'UPDATE siswa SET user_id = ?, username = ?, updated_at = ? WHERE id = ?',
        [userResult.insertId, username, getMySQLDateTimeWIB(), siswaId]
    );
    
    return userResult.insertId;
}

/**
 * Helper: Fetch siswa by NIS
 */
async function fetchSiswaByNis(connection, nis) {
    const [rows] = await connection.execute(
        'SELECT s.*, u.id as user_id FROM siswa s LEFT JOIN users u ON s.user_id = u.id WHERE s.nis = ?',
        [nis]
    );

    return rows.length > 0 ? rows[0] : null;
}

/**
 * Helper: Build siswa update fields
 */
function buildSiswaUpdateFields(data) {
    const fields = {
        nis: { flag: data.nis !== undefined ? 1 : 0, value: data.nis ?? null },
        nama: { flag: data.nama !== undefined ? 1 : 0, value: data.nama ?? null },
        kelas_id: { flag: data.kelas_id !== undefined ? 1 : 0, value: data.kelas_id ?? null },
        jabatan: { flag: data.jabatan !== undefined ? 1 : 0, value: data.jabatan ?? null },
        telepon_orangtua: { flag: data.telepon_orangtua !== undefined ? 1 : 0, value: data.telepon_orangtua ?? null },
        nomor_telepon_siswa: { flag: data.nomor_telepon_siswa !== undefined ? 1 : 0, value: data.nomor_telepon_siswa ?? null },
        jenis_kelamin: { flag: data.jenis_kelamin !== undefined ? 1 : 0, value: data.jenis_kelamin ?? null },
        alamat: { flag: data.alamat !== undefined ? 1 : 0, value: data.alamat ?? null },
        status: { flag: data.status !== undefined ? 1 : 0, value: data.status ?? null }
    };

    const hasChanges = Object.values(fields).some((field) => field.flag === 1);

    return { hasChanges, fields };
}

/**
 * Helper: Build user update fields
 */
async function buildSiswaUserUpdateFields(data, saltRounds) {
    let hashedPassword = null;
    let passwordFlag = 0;
    let normalizedIsPerwakilan = null;

    if (data.password !== undefined && data.password !== '') {
        hashedPassword = await bcrypt.hash(data.password, saltRounds);
        passwordFlag = 1;
    }

    if (data.is_perwakilan !== undefined) {
        const isPerwakilan = Boolean(data.is_perwakilan);
        normalizedIsPerwakilan = isPerwakilan ? 1 : 0;
    }

    const fields = {
        nama: { flag: data.nama !== undefined ? 1 : 0, value: data.nama ?? null },
        username: { flag: data.username !== undefined ? 1 : 0, value: data.username ?? null },
        email: { flag: data.email !== undefined ? 1 : 0, value: data.email ?? null },
        status: { flag: data.status !== undefined ? 1 : 0, value: data.status ?? null },
        is_perwakilan: { flag: data.is_perwakilan !== undefined ? 1 : 0, value: normalizedIsPerwakilan },
        password: { flag: passwordFlag, value: hashedPassword }
    };

    const hasChanges = Object.values(fields).some((field) => field.flag === 1);

    return { hasChanges, fields };
}

/**
 * Helper: Apply siswa and user updates in a transaction
 */
async function applySiswaUpdates(connection, siswa, payload) {
    const siswaUpdate = buildSiswaUpdateFields(payload);
    if (siswaUpdate.hasChanges) {
        const siswaUpdateQuery =
            'UPDATE siswa SET ' +
            'nis = CASE WHEN ? = 1 THEN ? ELSE nis END, ' +
            'nama = CASE WHEN ? = 1 THEN ? ELSE nama END, ' +
            'kelas_id = CASE WHEN ? = 1 THEN ? ELSE kelas_id END, ' +
            'jabatan = CASE WHEN ? = 1 THEN ? ELSE jabatan END, ' +
            'telepon_orangtua = CASE WHEN ? = 1 THEN ? ELSE telepon_orangtua END, ' +
            'nomor_telepon_siswa = CASE WHEN ? = 1 THEN ? ELSE nomor_telepon_siswa END, ' +
            'jenis_kelamin = CASE WHEN ? = 1 THEN ? ELSE jenis_kelamin END, ' +
            'alamat = CASE WHEN ? = 1 THEN ? ELSE alamat END, ' +
            'status = CASE WHEN ? = 1 THEN ? ELSE status END, ' +
            'updated_at = ? ' +
            'WHERE id = ?';

        const siswaParams = [
            siswaUpdate.fields.nis.flag, siswaUpdate.fields.nis.value,
            siswaUpdate.fields.nama.flag, siswaUpdate.fields.nama.value,
            siswaUpdate.fields.kelas_id.flag, siswaUpdate.fields.kelas_id.value,
            siswaUpdate.fields.jabatan.flag, siswaUpdate.fields.jabatan.value,
            siswaUpdate.fields.telepon_orangtua.flag, siswaUpdate.fields.telepon_orangtua.value,
            siswaUpdate.fields.nomor_telepon_siswa.flag, siswaUpdate.fields.nomor_telepon_siswa.value,
            siswaUpdate.fields.jenis_kelamin.flag, siswaUpdate.fields.jenis_kelamin.value,
            siswaUpdate.fields.alamat.flag, siswaUpdate.fields.alamat.value,
            siswaUpdate.fields.status.flag, siswaUpdate.fields.status.value,
            getMySQLDateTimeWIB(), siswa.id
        ];

        await connection.execute(siswaUpdateQuery, siswaParams);
    }

    if (siswa.user_id) {
        const userUpdate = await buildSiswaUserUpdateFields(payload, saltRounds);
        if (userUpdate.hasChanges) {
            const userUpdateQuery =
                'UPDATE users SET ' +
                'nama = CASE WHEN ? = 1 THEN ? ELSE nama END, ' +
                'username = CASE WHEN ? = 1 THEN ? ELSE username END, ' +
                'email = CASE WHEN ? = 1 THEN ? ELSE email END, ' +
                'status = CASE WHEN ? = 1 THEN ? ELSE status END, ' +
                'is_perwakilan = CASE WHEN ? = 1 THEN ? ELSE is_perwakilan END, ' +
                'password = CASE WHEN ? = 1 THEN ? ELSE password END, ' +
                'updated_at = ? ' +
                'WHERE id = ?';

            const userParams = [
                userUpdate.fields.nama.flag, userUpdate.fields.nama.value,
                userUpdate.fields.username.flag, userUpdate.fields.username.value,
                userUpdate.fields.email.flag, userUpdate.fields.email.value,
                userUpdate.fields.status.flag, userUpdate.fields.status.value,
                userUpdate.fields.is_perwakilan.flag, userUpdate.fields.is_perwakilan.value,
                userUpdate.fields.password.flag, userUpdate.fields.password.value,
                getMySQLDateTimeWIB(), siswa.user_id
            ];

            await connection.execute(userUpdateQuery, userParams);
        }

        if (payload.username !== undefined) {
            await connection.execute(
                'UPDATE siswa SET username = ?, updated_at = ? WHERE id = ?',
                [payload.username, getMySQLDateTimeWIB(), siswa.id]
            );
        }
    }
}

// Update Siswa
export const updateSiswa = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { nis: paramNis } = req.params;
    const { nama, username } = req.body;

    log.requestStart('Update', { nis: paramNis, nama, username });

    const connection = await db.getConnection();
    try {
        // Cek apakah siswa ada
        const siswa = await fetchSiswaByNis(connection, paramNis);

        if (!siswa) {
            log.warn('Update failed - not found', { nis: paramNis });
            return sendNotFoundError(res, 'Siswa tidak ditemukan');
        }

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
            await applySiswaUpdates(connection, siswa, req.body);

            await connection.commit();
            log.success('Update', { nis: paramNis, nama: nama || siswa.nama });
            return sendSuccessResponse(res, null, 'Data siswa berhasil diperbarui');

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        log.dbError('update', error, { nis: paramNis, nama });
        
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
    const { nis: paramNis } = req.params;

    log.requestStart('Delete', { nis: paramNis });

    const connection = await db.getConnection();
    try {
        // Cek apakah siswa ada
        const [existingSiswa] = await connection.execute(
            'SELECT s.*, u.id as user_id FROM siswa s LEFT JOIN users u ON s.user_id = u.id WHERE s.nis = ?',
            [paramNis]
        );

        if (existingSiswa.length === 0) {
            log.warn('Delete failed - not found', { nis: paramNis });
            return sendNotFoundError(res, 'Siswa tidak ditemukan');
        }

        const siswa = existingSiswa[0];

        // Start transaction
        await connection.beginTransaction();

        try {
            // Delete siswa record
            await connection.execute('DELETE FROM siswa WHERE id = ?', [siswa.id]);

            // Delete user record if exists
            if (siswa.user_id) {
                await connection.execute('DELETE FROM users WHERE id = ?', [siswa.user_id]);
            }

            await connection.commit();
            log.success('Delete', { nis: paramNis, nama: siswa.nama });
            return sendSuccessResponse(res, null, 'Siswa berhasil dihapus');

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        log.dbError('delete', error, { nis: paramNis });

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
        const [existingUser] = await db.execute(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [username, userId]
        );

        if (existingUser.length > 0) {
            log.warn('UpdateProfile failed - username taken', { username });
            return sendDuplicateError(res, 'Username sudah digunakan oleh user lain');
        }

        // Check if nomor_telepon_siswa is already taken
        if (nomor_telepon_siswa && nomor_telepon_siswa.trim()) {
            const [existingPhone] = await db.execute(
                'SELECT user_id FROM siswa WHERE nomor_telepon_siswa = ? AND user_id != ?',
                [nomor_telepon_siswa.trim(), userId]
            );

            if (existingPhone.length > 0) {
                log.warn('UpdateProfile failed - phone taken', { nomor_telepon_siswa });
                return sendDuplicateError(res, 'Nomor telepon siswa sudah digunakan oleh siswa lain');
            }
        }

        // Start transaction
        const connection = await db.getConnection();
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
            const [updatedUser] = await db.execute(
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
        await db.execute(
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
