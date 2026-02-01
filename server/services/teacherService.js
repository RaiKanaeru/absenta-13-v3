/**
 * Teacher Service
 * Handles database operations for teacher data management
 */
import bcrypt from 'bcrypt';
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
 * Get all teachers
 */
export const getAllTeachers = async () => {
    const query = `
        SELECT g.id, g.nip, g.nama, g.email, g.mata_pelajaran, 
               g.alamat, g.no_telp as telepon, g.jenis_kelamin, 
               COALESCE(g.status, 'aktif') as status
        FROM guru g
        ORDER BY g.nama ASC
    `;
    const [results] = await db.execute(query);
    return results;
};

/**
 * Create a new teacher (and associated user account)
 */
export const createTeacher = async (data) => {
    const { nip, nama, email, mata_pelajaran, alamat, telepon, jenis_kelamin, status } = data;
    const connection = await db.getConnection();
    
    try {
        // Check if NIP exists
        const [existing] = await connection.execute('SELECT id FROM guru WHERE nip = ?', [nip]);
        if (existing.length > 0) {
            throw new ServiceError('NIP sudah terdaftar', 'DUPLICATE_NIP');
        }

        await connection.beginTransaction();

        try {
            // Create dummy user
            const dummyUsername = `guru_${nip}_${Date.now()}`;
            const dummyPassword = await bcrypt.hash('dummy123', SALT_ROUNDS);

            const [userResult] = await connection.execute(
                'INSERT INTO users (username, password, role, nama, status) VALUES (?, ?, ?, ?, ?)',
                [dummyUsername, dummyPassword, 'guru', nama, 'ditangguhkan']
            );

            // Insert guru
            const query = `
                INSERT INTO guru (id_guru, user_id, username, nip, nama, email, mata_pelajaran, alamat, no_telp, jenis_kelamin, status)
                VALUES ((SELECT COALESCE(MAX(id_guru), 0) + 1 FROM guru g2), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const [result] = await connection.execute(query, [
                userResult.insertId, dummyUsername, nip, nama, email || null, mata_pelajaran || null,
                alamat || null, telepon || null, jenis_kelamin, status || 'aktif'
            ]);

            await connection.commit();
            return { id: result.insertId };
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } finally {
        connection.release();
    }
};

/**
 * Update teacher data
 */
export const updateTeacher = async (id, data) => {
    const { nip, nama, email, mata_pelajaran, alamat, telepon, jenis_kelamin, status } = data;
    const connection = await db.getConnection();

    try {
        // Check duplicate NIP
        const [existing] = await connection.execute(
            'SELECT id FROM guru WHERE nip = ? AND id != ?',
            [nip, id]
        );
        if (existing.length > 0) {
            throw new ServiceError('NIP sudah digunakan oleh guru lain', 'DUPLICATE_NIP');
        }

        await connection.beginTransaction();

        try {
            // Update user name if linked
            const [guruData] = await connection.execute('SELECT user_id FROM guru WHERE id = ?', [id]);
            
            if (guruData.length > 0 && guruData[0].user_id) {
                await connection.execute('UPDATE users SET nama = ? WHERE id = ?', [nama, guruData[0].user_id]);
            }

            // Update guru
            const updateQuery = `
                UPDATE guru 
                SET nip = ?, nama = ?, email = ?, mata_pelajaran = ?, 
                    alamat = ?, no_telp = ?, jenis_kelamin = ?, status = ?
                WHERE id = ?
            `;

            const [result] = await connection.execute(updateQuery, [
                nip, nama, email || null, mata_pelajaran || null,
                alamat || null, telepon || null, jenis_kelamin, status || 'aktif', id
            ]);

            if (result.affectedRows === 0) {
                throw new ServiceError('Data guru tidak ditemukan', 'NOT_FOUND');
            }

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } finally {
        connection.release();
    }
};

/**
 * Delete teacher data
 */
export const deleteTeacher = async (id) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        try {
            const [guruData] = await connection.execute('SELECT user_id FROM guru WHERE id = ?', [id]);
             if (guruData.length === 0) {
                 await connection.rollback();
                 throw new ServiceError('Data guru tidak ditemukan', 'NOT_FOUND');
             }

            // Delete guru
            const [result] = await connection.execute('DELETE FROM guru WHERE id = ?', [id]);
            if (result.affectedRows === 0) {
                await connection.rollback();
                throw new ServiceError('Data guru tidak ditemukan', 'NOT_FOUND');
            }

            // Delete user
            if (guruData[0].user_id) {
                await connection.execute('DELETE FROM users WHERE id = ?', [guruData[0].user_id]);
            }

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } finally {
        connection.release();
    }
};
