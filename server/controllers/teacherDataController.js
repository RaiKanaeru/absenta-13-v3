/**
 * Teacher Data Controller
 * Handles CRUD operations for Teacher Data (Profile + User Account Sync)
 */

import bcrypt from 'bcrypt';
import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;
const logger = createLogger('TeacherData');

// Get teachers data for admin dashboard
export const getTeachersData = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetAll');

    try {
        const query = `
            SELECT g.id, g.nip, g.nama, g.email, g.mata_pelajaran, 
                   g.alamat, g.no_telp as telepon, g.jenis_kelamin, 
                   COALESCE(g.status, 'aktif') as status
            FROM guru g
            ORDER BY g.nama ASC
        `;

        const [results] = await global.dbPool.execute(query);
        log.success('GetAll', { count: results.length });
        res.json(results);
    } catch (error) {
        log.dbError('query', error);
        return sendDatabaseError(res, error, 'Gagal mengambil data guru');
    }
};

// Add teacher data
export const addTeacherData = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { nip, nama, email, mata_pelajaran, alamat, telepon, jenis_kelamin, status } = req.body;
    
    log.requestStart('Create', { nip, nama, mata_pelajaran });

    const connection = await global.dbPool.getConnection();
    try {
        if (!nip || !nama || !jenis_kelamin) {
            connection.release(); // Release before early return
            log.validationFail('required_fields', null, 'NIP, nama, jenis_kelamin required');
            return sendValidationError(res, 'NIP, nama, dan jenis kelamin wajib diisi', { fields: ['nip', 'nama', 'jenis_kelamin'] });
        }

        // Check if NIP already exists
        const [existing] = await connection.execute(
            'SELECT id FROM guru WHERE nip = ?',
            [nip]
        );

        if (existing.length > 0) {
            log.warn('Create failed - NIP exists', { nip });
            return sendDuplicateError(res, 'NIP sudah terdaftar');
        }

        // Start transaction
        await connection.beginTransaction();

        try {
            // Create a dummy user account for data-only records
            const dummyUsername = `guru_${nip}_${Date.now()}`;
            const dummyPassword = await bcrypt.hash('dummy123', saltRounds);

            const [userResult] = await connection.execute(
                'INSERT INTO users (username, password, role, nama, status) VALUES (?, ?, ?, ?, ?)',
                [dummyUsername, dummyPassword, 'guru', nama, 'aktif']
            );

            // Insert guru data with user_id
            const query = `
                INSERT INTO guru (id_guru, user_id, username, nip, nama, email, mata_pelajaran, alamat, no_telp, jenis_kelamin, status)
                VALUES ((SELECT COALESCE(MAX(id_guru), 0) + 1 FROM guru g2), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const [result] = await connection.execute(query, [
                userResult.insertId, dummyUsername, nip, nama, email || null, mata_pelajaran || null,
                alamat || null, telepon || null, jenis_kelamin, status || 'aktif'
            ]);

            await connection.commit();
            log.success('Create', { guruId: result.insertId, nip, nama });
            return sendSuccessResponse(res, { id: result.insertId }, 'Data guru berhasil ditambahkan', 201);
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        log.dbError('insert', error, { nip, nama });
        if (error.code === 'ER_DUP_ENTRY') {
            return sendDuplicateError(res, 'NIP sudah terdaftar');
        }
        return sendDatabaseError(res, error, 'Gagal menambahkan data guru');
    } finally {
        connection.release();
    }
};

// Update teacher data
export const updateTeacherData = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    const { nip, nama, email, mata_pelajaran, alamat, telepon, jenis_kelamin, status } = req.body;
    
    log.requestStart('Update', { id, nip, nama });

    const connection = await global.dbPool.getConnection();
    try {
        if (!nip || !nama || !jenis_kelamin) {
            connection.release(); // Release before early return
            log.validationFail('required_fields', null, 'NIP, nama, jenis_kelamin required');
            return sendValidationError(res, 'NIP, nama, dan jenis kelamin wajib diisi', { fields: ['nip', 'nama', 'jenis_kelamin'] });
        }

        // Check if NIP already exists for other records
        const [existing] = await connection.execute(
            'SELECT id FROM guru WHERE nip = ? AND id != ?',
            [nip, id]
        );

        if (existing.length > 0) {
            log.warn('Update failed - NIP taken by other', { nip, id });
            return sendDuplicateError(res, 'NIP sudah digunakan oleh guru lain');
        }

        await connection.beginTransaction();

        try {
            // Update user account name if it exists
            const [guruData] = await connection.execute(
                'SELECT user_id FROM guru WHERE id = ?',
                [id]
            );

            if (guruData.length > 0 && guruData[0].user_id) {
                await connection.execute(
                    'UPDATE users SET nama = ? WHERE id = ?',
                    [nama, guruData[0].user_id]
                );
            }

            // Update guru data
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
                log.warn('Update failed - not found', { id });
                return sendNotFoundError(res, 'Data guru tidak ditemukan');
            }

            await connection.commit();
            log.success('Update', { id, nip, nama });
            return sendSuccessResponse(res, null, 'Data guru berhasil diupdate');
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        log.dbError('update', error, { id, nip, nama });
        return sendDatabaseError(res, error, 'Gagal mengupdate data guru');
    } finally {
        connection.release();
    }
};

// Delete teacher data
export const deleteTeacherData = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    
    log.requestStart('Delete', { id });

    const connection = await global.dbPool.getConnection();
    try {
        await connection.beginTransaction();

        try {
            // Get user_id first
            const [guruData] = await connection.execute(
                'SELECT user_id FROM guru WHERE id = ?',
                [id]
            );

            if (guruData.length === 0) {
                log.warn('Delete failed - not found', { id });
                return sendNotFoundError(res, 'Data guru tidak ditemukan');
            }

            // Delete guru data first (foreign key constraint)
            const [result] = await connection.execute(
                'DELETE FROM guru WHERE id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                await connection.rollback();
                return sendNotFoundError(res, 'Data guru tidak ditemukan');
            }

            // Delete from users table
            if (guruData[0].user_id) {
                await connection.execute(
                    'DELETE FROM users WHERE id = ?',
                    [guruData[0].user_id]
                );
            }

            await connection.commit();
            log.success('Delete', { id });
            return sendSuccessResponse(res, null, 'Data guru berhasil dihapus');
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        log.dbError('delete', error, { id });
        return sendDatabaseError(res, error, 'Gagal menghapus data guru');
    } finally {
        connection.release();
    }
};
