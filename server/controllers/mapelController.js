/**
 * Mapel Controller
 * Mengelola operasi CRUD untuk mata pelajaran
 */

import { sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Mapel');

/**
 * Mengambil semua data mata pelajaran
 * GET /api/admin/mapel
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Array} Daftar semua mata pelajaran
 */
export const getMapel = async (req, res) => {
    const log = logger.withRequest(req, res);
    
    log.requestStart('GetAll');

    try {
        const query = `
            SELECT id_mapel as id, kode_mapel, nama_mapel, deskripsi, status
            FROM mapel 
            ORDER BY nama_mapel
        `;

        const [rows] = await globalThis.dbPool.execute(query);
        log.success('GetAll', { count: rows.length });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error);
        return sendDatabaseError(res, error, 'Gagal mengambil data mata pelajaran');
    }
};

/**
 * Menambahkan mata pelajaran baru
 * POST /api/admin/mapel
 * @param {Object} req - Express request dengan body {kode_mapel, nama_mapel, deskripsi?, status?}
 * @param {Object} res - Express response object
 * @returns {Object} ID mata pelajaran yang dibuat
 */
export const createMapel = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { kode_mapel, nama_mapel, deskripsi, status } = req.body;
    
    log.requestStart('Create', { kode_mapel, nama_mapel });

    try {
        if (!kode_mapel || !nama_mapel) {
            log.validationFail('kode_mapel/nama_mapel', null, 'Required fields missing');
            return sendValidationError(res, 'Kode dan nama mata pelajaran wajib diisi', { 
                fields: ['kode_mapel', 'nama_mapel'] 
            });
        }

        // Check if kode_mapel already exists
        const [existing] = await globalThis.dbPool.execute(
            'SELECT id_mapel FROM mapel WHERE kode_mapel = ?',
            [kode_mapel]
        );

        if (existing.length > 0) {
            log.warn('Create failed - duplicate code', { kode_mapel });
            return sendDuplicateError(res, 'Kode mata pelajaran sudah digunakan');
        }

        const insertQuery = `
            INSERT INTO mapel (kode_mapel, nama_mapel, deskripsi, status) 
            VALUES (?, ?, ?, ?)
        `;

        const [result] = await globalThis.dbPool.execute(insertQuery, [
            kode_mapel,
            nama_mapel,
            deskripsi || null,
            status || 'aktif'
        ]);
        
        log.success('Create', { id: result.insertId, kode_mapel, nama_mapel });
        return sendSuccessResponse(res, { id: result.insertId }, 'Mata pelajaran berhasil ditambahkan', 201);
    } catch (error) {
        log.dbError('insert', error, { kode_mapel, nama_mapel });
        if (error.code === 'ER_DUP_ENTRY') {
            return sendDuplicateError(res, 'Kode mata pelajaran sudah digunakan');
        }
        return sendDatabaseError(res, error, 'Gagal menambahkan mata pelajaran');
    }
};

/**
 * Memperbarui data mata pelajaran
 * PUT /api/admin/mapel/:id
 * @param {Object} req - Express request dengan params.id dan body
 * @param {Object} res - Express response object
 * @returns {null} Success message
 */
export const updateMapel = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    const { kode_mapel, nama_mapel, deskripsi, status } = req.body;
    
    log.requestStart('Update', { id, kode_mapel, nama_mapel });

    try {
        if (!kode_mapel || !nama_mapel) {
            log.validationFail('kode_mapel/nama_mapel', null, 'Required fields missing');
            return sendValidationError(res, 'Kode dan nama mata pelajaran wajib diisi', { 
                fields: ['kode_mapel', 'nama_mapel'] 
            });
        }

        // Check if kode_mapel already exists for other records
        const [existing] = await globalThis.dbPool.execute(
            'SELECT id_mapel FROM mapel WHERE kode_mapel = ? AND id_mapel != ?',
            [kode_mapel, id]
        );

        if (existing.length > 0) {
            log.warn('Update failed - duplicate code', { id, kode_mapel });
            return sendDuplicateError(res, 'Kode mata pelajaran sudah digunakan oleh mata pelajaran lain');
        }

        const updateQuery = `
            UPDATE mapel 
            SET kode_mapel = ?, nama_mapel = ?, deskripsi = ?, status = ?
            WHERE id_mapel = ?
        `;

        const [result] = await globalThis.dbPool.execute(updateQuery, [
            kode_mapel,
            nama_mapel,
            deskripsi || null,
            status || 'aktif',
            id
        ]);

        if (result.affectedRows === 0) {
            log.warn('Update failed - not found', { id });
            return sendNotFoundError(res, 'Mata pelajaran tidak ditemukan');
        }

        log.success('Update', { id, kode_mapel, nama_mapel });
        return sendSuccessResponse(res, null, 'Mata pelajaran berhasil diupdate');
    } catch (error) {
        log.dbError('update', error, { id, kode_mapel });
        return sendDatabaseError(res, error, 'Gagal mengupdate mata pelajaran');
    }
};

/**
 * Menghapus mata pelajaran
 * DELETE /api/admin/mapel/:id
 * @param {Object} req - Express request dengan params.id
 * @param {Object} res - Express response object
 * @returns {null} Success message
 */
export const deleteMapel = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    
    log.requestStart('Delete', { id });

    try {
        const [result] = await globalThis.dbPool.execute(
            'DELETE FROM mapel WHERE id_mapel = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            log.warn('Delete failed - not found', { id });
            return sendNotFoundError(res, 'Mata pelajaran tidak ditemukan');
        }

        log.success('Delete', { id, affectedRows: result.affectedRows });
        return sendSuccessResponse(res, null, 'Mata pelajaran berhasil dihapus');
    } catch (error) {
        log.dbError('delete', error, { id });
        return sendDatabaseError(res, error, 'Gagal menghapus mata pelajaran');
    }
};
