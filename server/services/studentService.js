/**
 * Student Service
 * Handles database operations for student data management and promotion
 */
import bcrypt from 'bcrypt';
import { getMySQLDateTimeWIB } from '../utils/timeUtils.js';
import db from '../config/db.js';

const SALT_ROUNDS = Number.parseInt(process.env.SALT_ROUNDS) || 10;

// Custom Error Classes for Service Layer
export class ServiceError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
    }
}

/**
 * Get all students (without pagination - for backwards compatibility)
 */
export const getAllStudents = async () => {
    const query = `
        SELECT 
            s.id_siswa as id,
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
    const [results] = await db.execute(query);
    return results;
};

/**
 * Get students with pagination and search
 * @param {number} page - Page number (starts from 1)
 * @param {number} limit - Number of items per page
 * @param {string} search - Search term for filtering by name, NIS, or class
 * @returns {Promise<{data: Array, pagination: Object}>} Paginated student data
 */
export const getStudentsPaginated = async (page = 1, limit = 15, search = '') => {
    const offset = (page - 1) * limit;
    
    let query = `
        SELECT 
            s.id_siswa as id,
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
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM siswa s LEFT JOIN kelas k ON s.kelas_id = k.id_kelas';
    let params = [];
    
    if (search) {
        query += ' WHERE (s.nama LIKE ? OR s.nis LIKE ? OR k.nama_kelas LIKE ?)';
        countQuery += ' WHERE (s.nama LIKE ? OR s.nis LIKE ? OR k.nama_kelas LIKE ?)';
        params = [`%${search}%`, `%${search}%`, `%${search}%`];
    }
    
    // Use parameterized query for LIMIT/OFFSET to prevent SQL injection
    query += ` ORDER BY s.nama ASC LIMIT ? OFFSET ?`;
    const queryParams = [...params, parseInt(limit, 10), parseInt(offset, 10)];
    
    const [rows] = await db.execute(query, queryParams);
    const [countResult] = await db.execute(countQuery, params);
    
    return {
        data: rows,
        pagination: {
            current_page: Number.parseInt(page),
            per_page: Number.parseInt(limit),
            total: countResult[0].total,
            total_pages: Math.ceil(countResult[0].total / limit)
        }
    };
};

/**
 * Create a new student (and associated user account)
 */
export const createStudent = async (data) => {
    const { nis, nama, kelas_id, jenis_kelamin, alamat, telepon_orangtua, nomor_telepon_siswa, status } = data;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Check if NIS exists
        const [existing] = await connection.execute('SELECT id_siswa FROM siswa WHERE nis = ?', [nis]);
        if (existing.length > 0) {
            throw new ServiceError('NIS sudah terdaftar', 'DUPLICATE_NIS');
        }

        // Create dummy user
        const username = `siswa_${nis}`;
        const email = `${nis}@student.absenta.com`;
        const createdAtWIB = getMySQLDateTimeWIB();
        const dummyPassword = await bcrypt.hash('Siswa123!', SALT_ROUNDS);

        const [userResult] = await connection.execute(
            'INSERT INTO users (username, password, email, role, nama, status, created_at) VALUES (?, ?, ?, "siswa", ?, "ditangguhkan", ?)',
            [username, dummyPassword, email, nama, createdAtWIB]
        );
        const userId = userResult.insertId;

        // Get next id_siswa
        const [maxIdResult] = await connection.execute('SELECT COALESCE(MAX(id_siswa), 0) + 1 as next_id FROM siswa');
        const nextIdSiswa = maxIdResult[0].next_id;

        // Insert into siswa table
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
        return {
            id: studentResult.insertId,
            userId: userId,
            username: username
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

/**
 * Update student data
 */
export const updateStudent = async (id, data) => {
    const { nis, nama, kelas_id, jenis_kelamin, alamat, telepon_orangtua, status, nomor_telepon_siswa } = data;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Duplicate phone check
        if (nomor_telepon_siswa) {
            const [existingPhone] = await connection.execute(
                'SELECT id_siswa FROM siswa WHERE nomor_telepon_siswa = ? AND id_siswa != ?',
                [nomor_telepon_siswa, id]
            );
            if (existingPhone.length > 0) {
                throw new ServiceError('Nomor telepon siswa sudah digunakan', 'DUPLICATE_PHONE');
            }
        }

        // Check if student exists
        const [studentExists] = await connection.execute('SELECT user_id FROM siswa WHERE id_siswa = ?', [id]);
        if (studentExists.length === 0) {
            throw new ServiceError('Data siswa tidak ditemukan', 'NOT_FOUND');
        }

        // Check duplicate NIS
        const [existing] = await connection.execute('SELECT id_siswa FROM siswa WHERE nis = ? AND id_siswa != ?', [nis, id]);
        if (existing.length > 0) {
            throw new ServiceError('NIS sudah digunakan oleh siswa lain', 'DUPLICATE_NIS');
        }

        // Update siswa table
        const updatedAtWIB = getMySQLDateTimeWIB();
        const updateQuery = `
            UPDATE siswa 
            SET nis = ?, nama = ?, kelas_id = ?, jenis_kelamin = ?, 
                alamat = ?, telepon_orangtua = ?, nomor_telepon_siswa = ?, status = ?, updated_at = ?
            WHERE id_siswa = ?
        `;

        const [result] = await connection.execute(updateQuery, [
            nis, nama, kelas_id, jenis_kelamin,
            alamat || null, telepon_orangtua || null, nomor_telepon_siswa || null, status || 'aktif', updatedAtWIB, id
        ]);

        if (result.affectedRows === 0) {
            throw new ServiceError('Data siswa tidak ditemukan', 'NOT_FOUND');
        }

        // Update users table with nama
        if (studentExists[0].user_id) {
            await connection.execute('UPDATE users SET nama = ?, updated_at = ? WHERE id = ?', [nama, updatedAtWIB, studentExists[0].user_id]);
        }

        await connection.commit();
        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

/**
 * Delete student data
 */
export const deleteStudent = async (id) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [studentData] = await connection.execute('SELECT user_id FROM siswa WHERE id_siswa = ?', [id]);
        if (studentData.length === 0) {
            throw new ServiceError('Data siswa tidak ditemukan', 'NOT_FOUND');
        }

        const [studentResult] = await connection.execute('DELETE FROM siswa WHERE id_siswa = ?', [id]);
        if (studentResult.affectedRows === 0) {
            throw new ServiceError('Data siswa tidak ditemukan', 'NOT_FOUND');
        }

        if (studentData[0].user_id) {
            await connection.execute('DELETE FROM users WHERE id = ?', [studentData[0].user_id]);
        }

        await connection.commit();
        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

/**
 * Promote students (Mass update class)
 */
export const promoteStudents = async (fromClassId, toClassId, studentIds) => {
     const connection = await db.getConnection();
     try {
        await connection.beginTransaction();

        // Verify classes exist
        const [fromClass] = await connection.execute('SELECT id_kelas, nama_kelas, tingkat FROM kelas WHERE id_kelas = ? AND status = "aktif"', [fromClassId]);
        const [toClass] = await connection.execute('SELECT id_kelas, nama_kelas, tingkat FROM kelas WHERE id_kelas = ? AND status = "aktif"', [toClassId]);

        if (fromClass.length === 0) throw new ServiceError('Kelas asal tidak ditemukan atau tidak aktif', 'CLASS_NOT_FOUND');
        if (toClass.length === 0) throw new ServiceError('Kelas tujuan tidak ditemukan atau tidak aktif', 'CLASS_NOT_FOUND');

        // Business Logic: Promotion Rules
        if (fromClass[0].tingkat === 'XII') {
             throw new ServiceError('Kelas XII tidak dapat dinaikkan', 'INVALID_PROMOTION_LEVEL');
        }

        const validPromotions = { 'X': 'XI', 'XI': 'XII' };
        if (validPromotions[fromClass[0].tingkat] !== toClass[0].tingkat) {
            throw new ServiceError(`Kelas ${fromClass[0].tingkat} hanya bisa dinaikkan ke kelas ${validPromotions[fromClass[0].tingkat]}`, 'INVALID_PROMOTION_PATH');
        }

        // Verify students exist in fromClass
        const placeholders = studentIds.map(() => '?').join(',');
        const [students] = await connection.execute(
            `SELECT id_siswa FROM siswa WHERE id_siswa IN (${placeholders}) AND kelas_id = ? AND status = 'aktif'`,
            [...studentIds, fromClassId]
        );

        if (students.length !== studentIds.length) {
            throw new ServiceError(`Beberapa siswa tidak ditemukan di kelas asal (Found: ${students.length}/${studentIds.length})`, 'STUDENT_MISMATCH');
        }

        // Update
        const updatePlaceholders = studentIds.map(() => '?').join(',');
        const [updateResult] = await connection.execute(
            `UPDATE siswa SET kelas_id = ? WHERE id_siswa IN (${updatePlaceholders})`,
            [toClassId, ...studentIds]
        );

        await connection.commit();
        return {
            promotedCount: updateResult.affectedRows,
            fromClass: fromClass[0].nama_kelas,
            toClass: toClass[0].nama_kelas
        };
     } catch (error) {
         await connection.rollback();
         throw error;
     } finally {
         connection.release();
     }
};
