/**
 * Kelas Controller
 * Mengelola operasi CRUD untuk manajemen kelas
 */

import dotenv from 'dotenv';
import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

dotenv.config();

const logger = createLogger('Kelas');

/**
 * Mengambil kelas aktif (untuk dropdown)
 * GET /api/kelas/aktif
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Array} Daftar kelas aktif
 */
export const getActiveKelas = async (req, res) => {
    const log = logger.withRequest(req, res);
    
    log.requestStart('GetActive');

    try {
        const query = `
            SELECT id_kelas as id, nama_kelas, tingkat, status
            FROM kelas 
            WHERE status = 'aktif'
            ORDER BY tingkat, nama_kelas
        `;

        const [rows] = await globalThis.dbPool.execute(query);
        log.success('GetActive', { count: rows.length });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error);
        return sendDatabaseError(res, error, 'Gagal mengambil data kelas');
    }
};

/**
 * Mengambil semua kelas (admin)
 * GET /api/admin/kelas
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Array} Daftar semua kelas
 */
export const getKelas = async (req, res) => {
    const log = logger.withRequest(req, res);
    
    log.requestStart('GetAll');

    try {
        const query = `
            SELECT id_kelas as id, nama_kelas, tingkat, status
            FROM kelas 
            ORDER BY tingkat, nama_kelas
        `;

        const [rows] = await globalThis.dbPool.execute(query);
        log.success('GetAll', { count: rows.length });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error);
        return sendDatabaseError(res, error, 'Gagal mengambil data kelas');
    }
};

/**
 * Menambahkan kelas baru
 * POST /api/admin/kelas
 * @param {Object} req - Express request dengan body {nama_kelas}
 * @param {Object} res - Express response object
 * @returns {Object} ID kelas yang dibuat
 */
export const createKelas = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { nama_kelas } = req.body;
    
    log.requestStart('Create', { nama_kelas });

    try {
        if (!nama_kelas) {
            log.validationFail('nama_kelas', null, 'Required field missing');
            return sendValidationError(res, 'Nama kelas wajib diisi', { field: 'nama_kelas' });
        }

        // Extract tingkat from nama_kelas (contoh: "X IPA 1" -> tingkat = "X")
        const tingkat = nama_kelas.split(' ')[0];

        const insertQuery = `
            INSERT INTO kelas (nama_kelas, tingkat, status) 
            VALUES (?, ?, 'aktif')
        `;

        const [result] = await globalThis.dbPool.execute(insertQuery, [nama_kelas, tingkat]);
        log.success('Create', { id: result.insertId, nama_kelas, tingkat });
        return sendSuccessResponse(res, { id: result.insertId }, 'Kelas berhasil ditambahkan', 201);
    } catch (error) {
        log.dbError('insert', error, { nama_kelas });
        if (error.code === 'ER_DUP_ENTRY') {
            return sendDuplicateError(res, 'Nama kelas sudah ada');
        }
        return sendDatabaseError(res, error, 'Gagal menambahkan kelas');
    }
};

/**
 * Memperbarui data kelas
 * PUT /api/admin/kelas/:id
 * @param {Object} req - Express request dengan params.id dan body
 * @param {Object} res - Express response object
 * @returns {null} Success message
 */
export const updateKelas = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    const { nama_kelas } = req.body;
    
    log.requestStart('Update', { id, nama_kelas });

    try {
        if (!nama_kelas) {
            log.validationFail('nama_kelas', null, 'Required field missing');
            return sendValidationError(res, 'Nama kelas wajib diisi', { field: 'nama_kelas' });
        }

        // Extract tingkat from nama_kelas
        const tingkat = nama_kelas.split(' ')[0];

        const updateQuery = `
            UPDATE kelas 
            SET nama_kelas = ?, tingkat = ?
            WHERE id_kelas = ?
        `;

        const [result] = await globalThis.dbPool.execute(updateQuery, [nama_kelas, tingkat, id]);

        if (result.affectedRows === 0) {
            log.warn('Update failed - not found', { id });
            return sendNotFoundError(res, 'Kelas tidak ditemukan');
        }

        log.success('Update', { id, nama_kelas, tingkat });
        return sendSuccessResponse(res, null, 'Kelas berhasil diupdate');
    } catch (error) {
        log.dbError('update', error, { id, nama_kelas });
        return sendDatabaseError(res, error, 'Gagal mengupdate kelas');
    }
};

/**
 * Menghapus kelas
 * DELETE /api/admin/kelas/:id
 * @param {Object} req - Express request dengan params.id
 * @param {Object} res - Express response object
 * @returns {null} Success message
 */
export const deleteKelas = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    
    log.requestStart('Delete', { id });

    try {
        // Check if class is used by students
        const [siswaUsage] = await globalThis.dbPool.execute(
            'SELECT COUNT(*) as count FROM siswa WHERE kelas_id = ?',
            [id]
        );

        if (siswaUsage[0].count > 0) {
            log.warn('Delete failed - class has students', { id, siswaCount: siswaUsage[0].count });
            return sendValidationError(res, 'Tidak dapat menghapus kelas yang masih memiliki siswa', {
                reason: 'has_students',
                siswaCount: siswaUsage[0].count
            });
        }

        // Check if class is used in schedules
        const [jadwalUsage] = await globalThis.dbPool.execute(
            'SELECT COUNT(*) as count FROM jadwal WHERE kelas_id = ?',
            [id]
        );

        if (jadwalUsage[0].count > 0) {
            log.warn('Delete failed - class has schedules', { id, jadwalCount: jadwalUsage[0].count });
            return sendValidationError(res, 'Tidak dapat menghapus kelas yang masih memiliki jadwal', {
                reason: 'has_jadwal',
                jadwalCount: jadwalUsage[0].count
            });
        }

        const [result] = await globalThis.dbPool.execute(
            'DELETE FROM kelas WHERE id_kelas = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            log.warn('Delete failed - not found', { id });
            return sendNotFoundError(res, 'Kelas tidak ditemukan');
        }

        log.success('Delete', { id, affectedRows: result.affectedRows });
        return sendSuccessResponse(res, null, 'Kelas berhasil dihapus');
    } catch (error) {
        log.dbError('delete', error, { id });
        return sendDatabaseError(res, error, 'Gagal menghapus kelas');
    }
};
