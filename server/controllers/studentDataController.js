/**
 * Student Data Controller
 * Handles CRUD operations for Student Data (Profile + User Account Sync) and Promotion
 */

import bcrypt from 'bcrypt';
import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError, sendSuccessResponse } from '../utils/errorHandler.js';
import { getMySQLDateTimeWIB } from '../utils/timeUtils.js';
import { createLogger } from '../utils/logger.js';

const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;
const logger = createLogger('StudentData');

// Get students data for admin dashboard
export const getStudentsData = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetAll');

    try {
        const query = `
            SELECT 
                s.id_siswa as id_siswa,
                s.id,
                s.nis, 
                s.nama, 
                s.kelas_id, 
                k.nama_kelas,
                s.jenis_kelamin,
                s.alamat,
                s.telepon_orangtua,
                s.nomor_telepon_siswa,
                COALESCE(s.status, 'aktif') as status
            FROM siswa s
            LEFT JOIN kelas k ON s.kelas_id = k.id_kelas
            ORDER BY s.nama ASC
        `;

        const [results] = await global.dbPool.execute(query);
        log.success('GetAll', { count: results.length });
        res.json(results);
    } catch (error) {
        log.dbError('query', error);
        return sendDatabaseError(res, error, 'Gagal mengambil data siswa');
    }
};

// Add student data
export const addStudentData = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { nis, nama, kelas_id, jenis_kelamin, alamat, telepon_orangtua, nomor_telepon_siswa, status } = req.body;
    
    log.requestStart('Create', { nis, nama, kelas_id });

    const connection = await global.dbPool.getConnection();
    try {
        if (!nis || !nama || !kelas_id || !jenis_kelamin) {
            log.validationFail('required_fields', null, 'NIS, nama, kelas_id, jenis_kelamin required');
            return sendValidationError(res, 'NIS, nama, kelas, dan jenis kelamin wajib diisi', { fields: ['nis', 'nama', 'kelas_id', 'jenis_kelamin'] });
        }

        await connection.beginTransaction();

        // Check if NIS already exists
        const [existing] = await connection.execute(
            'SELECT id FROM siswa WHERE nis = ?',
            [nis]
        );

        if (existing.length > 0) {
            await connection.rollback();
            log.warn('Create failed - NIS exists', { nis });
            return sendDuplicateError(res, 'NIS sudah terdaftar');
        }

        // Generate username from NIS
        const username = `siswa_${nis}`;
        const email = `${nis}@student.absenta.com`;

        // First, insert into users table
        const createdAtWIB = getMySQLDateTimeWIB();
        const dummyPassword = await bcrypt.hash('Siswa123!', saltRounds);

        const userInsertQuery = `
            INSERT INTO users (username, password, email, role, nama, status, created_at)
            VALUES (?, ?, ?, 'siswa', ?, 'aktif', ?)
        `;

        const [userResult] = await connection.execute(userInsertQuery, [
            username, dummyPassword, email, nama, createdAtWIB
        ]);

        const userId = userResult.insertId;
        log.debug('User created', { userId });

        // Get next id_siswa
        const [maxIdResult] = await connection.execute(
            'SELECT COALESCE(MAX(id_siswa), 0) + 1 as next_id FROM siswa'
        );
        const nextIdSiswa = maxIdResult[0].next_id;

        // Then, insert into siswa table
        const studentInsertQuery = `
            INSERT INTO siswa (id, id_siswa, user_id, username, nis, nama, kelas_id, jenis_kelamin, alamat, telepon_orangtua, nomor_telepon_siswa, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [studentResult] = await connection.execute(studentInsertQuery, [
            nextIdSiswa, nextIdSiswa, userId, username, nis, nama, kelas_id, jenis_kelamin,
            alamat || null, telepon_orangtua || null, nomor_telepon_siswa || null,
            status || 'aktif', createdAtWIB
        ]);

        await connection.commit();

        log.success('Create', { siswaId: studentResult.insertId, userId, nis, nama });
        return sendSuccessResponse(res, {
            id: studentResult.insertId,
            userId: userId,
            username: username
        }, 'Data siswa berhasil ditambahkan', 201);
    } catch (error) {
        await connection.rollback();
        log.dbError('insert', error, { nis, nama });

        if (error.code === 'ER_DUP_ENTRY') {
            return sendDuplicateError(res, 'NIS atau username sudah terdaftar');
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return sendValidationError(res, 'Kelas tidak ditemukan', { field: 'kelas_id' });
        }
        return sendDatabaseError(res, error, 'Gagal menambahkan data siswa');
    } finally {
        connection.release();
    }
};

// Update student data
export const updateStudentData = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    const { nis, nama, kelas_id, jenis_kelamin, alamat, telepon_orangtua, status, nomor_telepon_siswa } = req.body;
    
    log.requestStart('Update', { id, nis, nama });

    const connection = await global.dbPool.getConnection();
    try {
        if (!nis || !nama || !kelas_id || !jenis_kelamin) {
            log.validationFail('required_fields', null, 'NIS, nama, kelas_id, jenis_kelamin required');
            return sendValidationError(res, 'NIS, nama, kelas, dan jenis kelamin wajib diisi', { fields: ['nis', 'nama', 'kelas_id', 'jenis_kelamin'] });
        }

        // Validasi nomor telepon jika diisi
        if (nomor_telepon_siswa && !/^[0-9]{10,15}$/.test(nomor_telepon_siswa)) {
            log.validationFail('nomor_telepon_siswa', nomor_telepon_siswa, 'Invalid phone format');
            return sendValidationError(res, 'Nomor telepon harus berupa angka 10-15 digit', { field: 'nomor_telepon_siswa' });
        }

        // Cek unik nomor telepon jika diisi
        if (nomor_telepon_siswa) {
            const [existingPhone] = await connection.execute(
                'SELECT id FROM siswa WHERE nomor_telepon_siswa = ? AND id != ?',
                [nomor_telepon_siswa, id]
            );
            if (existingPhone.length > 0) {
                log.warn('Update failed - phone taken', { nomor_telepon_siswa });
                return sendDuplicateError(res, 'Nomor telepon siswa sudah digunakan');
            }
        }

        await connection.beginTransaction();

        // Check if student exists
        const [studentExists] = await connection.execute(
            'SELECT user_id, username FROM siswa WHERE id = ?',
            [id]
        );

        if (studentExists.length === 0) {
            await connection.rollback();
            log.warn('Update failed - not found', { id });
            return sendNotFoundError(res, 'Data siswa tidak ditemukan');
        }

        // Check if NIS already exists for other records
        const [existing] = await connection.execute(
            'SELECT id FROM siswa WHERE nis = ? AND id != ?',
            [nis, id]
        );

        if (existing.length > 0) {
            await connection.rollback();
            log.warn('Update failed - NIS taken by other', { nis, id });
            return sendDuplicateError(res, 'NIS sudah digunakan oleh siswa lain');
        }

        // Update siswa table
        const updatedAtWIB = getMySQLDateTimeWIB();
        const updateQuery = `
            UPDATE siswa 
            SET nis = ?, nama = ?, kelas_id = ?, jenis_kelamin = ?, 
                alamat = ?, telepon_orangtua = ?, nomor_telepon_siswa = ?, status = ?, updated_at = ?
            WHERE id = ?
        `;

        const [result] = await connection.execute(updateQuery, [
            nis, nama, kelas_id, jenis_kelamin,
            alamat || null, telepon_orangtua || null, nomor_telepon_siswa || null, status || 'aktif', updatedAtWIB, id
        ]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return sendNotFoundError(res, 'Data siswa tidak ditemukan');
        }

        // Update users table with nama
        await connection.execute(
            'UPDATE users SET nama = ?, updated_at = ? WHERE id = ?',
            [nama, updatedAtWIB, studentExists[0].user_id]
        );

        await connection.commit();
        log.success('Update', { id, nis, nama });
        return sendSuccessResponse(res, null, 'Data siswa berhasil diupdate');
    } catch (error) {
        await connection.rollback();
        log.dbError('update', error, { id, nis, nama });

        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return sendValidationError(res, 'Kelas tidak ditemukan', { field: 'kelas_id' });
        }
        return sendDatabaseError(res, error, 'Gagal mengupdate data siswa');
    } finally {
        connection.release();
    }
};

// Delete student data
export const deleteStudentData = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    
    log.requestStart('Delete', { id });

    const connection = await global.dbPool.getConnection();
    try {
        await connection.beginTransaction();

        // Get user_id before deleting
        const [studentData] = await connection.execute(
            'SELECT user_id FROM siswa WHERE id = ?',
            [id]
        );

        if (studentData.length === 0) {
            await connection.rollback();
            log.warn('Delete failed - not found', { id });
            return sendNotFoundError(res, 'Data siswa tidak ditemukan');
        }

        const userId = studentData[0].user_id;

        // Delete from siswa first (due to foreign key constraint)
        const [studentResult] = await connection.execute(
            'DELETE FROM siswa WHERE id = ?',
            [id]
        );

        if (studentResult.affectedRows === 0) {
            await connection.rollback();
            return sendNotFoundError(res, 'Data siswa tidak ditemukan');
        }

        // Delete from users table
        if (userId) {
            await connection.execute(
                'DELETE FROM users WHERE id = ?',
                [userId]
            );
        }

        await connection.commit();
        log.success('Delete', { id });
        return sendSuccessResponse(res, null, 'Data siswa berhasil dihapus');
    } catch (error) {
        await connection.rollback();
        log.dbError('delete', error, { id });
        return sendDatabaseError(res, error, 'Gagal menghapus data siswa');
    } finally {
        connection.release();
    }
};

// Student promotion (naik kelas)
export const promoteStudents = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { fromClassId, toClassId, studentIds } = req.body;
    
    log.requestStart('PromoteStudents', { fromClassId, toClassId, studentCount: studentIds?.length });

    const connection = await global.dbPool.getConnection();
    try {
        // Validasi input yang lebih ketat
        if (!fromClassId || !toClassId || !studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            log.validationFail('required_fields', null, 'fromClassId, toClassId, studentIds required');
            return sendValidationError(res, 'fromClassId, toClassId, dan studentIds wajib diisi', {
                details: 'studentIds harus berupa array yang tidak kosong'
            });
        }

        // Validasi tipe data
        if (typeof fromClassId !== 'string' && typeof fromClassId !== 'number') {
            log.validationFail('fromClassId', fromClassId, 'Invalid type');
            return sendValidationError(res, 'fromClassId harus berupa string atau number', { field: 'fromClassId' });
        }
        if (typeof toClassId !== 'string' && typeof toClassId !== 'number') {
            log.validationFail('toClassId', toClassId, 'Invalid type');
            return sendValidationError(res, 'toClassId harus berupa string atau number', { field: 'toClassId' });
        }
        if (!studentIds.every(id => typeof id === 'number' && Number.isInteger(id) && id > 0)) {
            log.validationFail('studentIds', null, 'Invalid student IDs');
            return sendValidationError(res, 'Semua studentIds harus berupa integer positif', { field: 'studentIds' });
        }

        await connection.beginTransaction();

        // Verify classes exist and get detailed info
        const [fromClass] = await connection.execute(
            'SELECT id_kelas, nama_kelas, tingkat FROM kelas WHERE id_kelas = ? AND status = "aktif"',
            [fromClassId]
        );

        const [toClass] = await connection.execute(
            'SELECT id_kelas, nama_kelas, tingkat FROM kelas WHERE id_kelas = ? AND status = "aktif"',
            [toClassId]
        );

        if (fromClass.length === 0) {
            await connection.rollback();
            log.warn('Promote failed - fromClass not found', { fromClassId });
            return sendNotFoundError(res, 'Kelas asal tidak ditemukan atau tidak aktif');
        }

        if (toClass.length === 0) {
            await connection.rollback();
            log.warn('Promote failed - toClass not found', { toClassId });
            return sendNotFoundError(res, 'Kelas tujuan tidak ditemukan atau tidak aktif');
        }

        // Validasi aturan bisnis: kelas XII tidak bisa dinaikkan
        if (fromClass[0].tingkat === 'XII') {
            await connection.rollback();
            log.validationFail('tingkat', 'XII', 'Cannot promote from XII');
            return sendValidationError(res, 'Kelas XII tidak dapat dinaikkan', {
                details: 'Siswa kelas XII sudah lulus dan tidak dapat dipromosikan'
            });
        }

        // Validasi tingkat promosi (X->XI, XI->XII)
        const validPromotions = { 'X': 'XI', 'XI': 'XII' };

        if (validPromotions[fromClass[0].tingkat] !== toClass[0].tingkat) {
            await connection.rollback();
            log.validationFail('promotion_path', null, 'Invalid promotion path');
            return sendValidationError(res, 'Promosi tidak valid', {
                details: `Kelas ${fromClass[0].tingkat} hanya bisa dinaikkan ke kelas ${validPromotions[fromClass[0].tingkat]}`
            });
        }

        // Verify students exist and belong to fromClass
        const placeholders = studentIds.map(() => '?').join(',');
        const [students] = await connection.execute(
            `SELECT id_siswa, nama, nis, kelas_id FROM siswa 
             WHERE id_siswa IN (${placeholders}) AND kelas_id = ? AND status = 'aktif'`,
            [...studentIds, fromClassId]
        );

        if (students.length !== studentIds.length) {
            await connection.rollback();
            log.warn('Promote failed - students mismatch', { found: students.length, requested: studentIds.length });
            return sendValidationError(res, 'Beberapa siswa tidak ditemukan atau tidak berada di kelas asal', {
                details: `Ditemukan ${students.length} siswa dari ${studentIds.length} yang diminta`
            });
        }

        // Perform promotion (update class)
        const updatePlaceholders = studentIds.map(() => '?').join(',');
        const [updateResult] = await connection.execute(
            `UPDATE siswa SET kelas_id = ? WHERE id_siswa IN (${updatePlaceholders})`,
            [toClassId, ...studentIds]
        );

        await connection.commit();

        log.success('PromoteStudents', {
            promotedCount: updateResult.affectedRows,
            fromClass: fromClass[0].nama_kelas,
            toClass: toClass[0].nama_kelas
        });
        
        return sendSuccessResponse(res, {
            promotedCount: updateResult.affectedRows,
            fromClass: fromClass[0].nama_kelas,
            toClass: toClass[0].nama_kelas
        }, 'Siswa berhasil dinaikkan kelas');
    } catch (error) {
        await connection.rollback();
        log.dbError('promote', error, { fromClassId, toClassId });
        return sendDatabaseError(res, error, 'Gagal mempromosikan siswa');
    } finally {
        connection.release();
    }
};
