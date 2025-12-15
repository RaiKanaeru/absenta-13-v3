/**
 * Kelas Controller
 * CRUD operations for class management
 */

import dotenv from 'dotenv';
import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

dotenv.config();

const logger = createLogger('Kelas');

// Get Active Kelas (Public - for dropdowns)
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

        const [rows] = await global.dbPool.execute(query);
        log.success('GetActive', { count: rows.length });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error);
        return sendDatabaseError(res, error, 'Gagal mengambil data kelas');
    }
};

// Get All Kelas (Admin)
export const getKelas = async (req, res) => {
    const log = logger.withRequest(req, res);
    
    log.requestStart('GetAll');

    try {
        const query = `
            SELECT id_kelas as id, nama_kelas, tingkat, status
            FROM kelas 
            ORDER BY tingkat, nama_kelas
        `;

        const [rows] = await global.dbPool.execute(query);
        log.success('GetAll', { count: rows.length });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error);
        return sendDatabaseError(res, error, 'Gagal mengambil data kelas');
    }
};

// Create Kelas
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

        const [result] = await global.dbPool.execute(insertQuery, [nama_kelas, tingkat]);
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

// Update Kelas
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

        const [result] = await global.dbPool.execute(updateQuery, [nama_kelas, tingkat, id]);

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

// Delete Kelas
export const deleteKelas = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    
    log.requestStart('Delete', { id });

    try {
        const [result] = await global.dbPool.execute(
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
