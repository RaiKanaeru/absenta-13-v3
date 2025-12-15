/**
 * Ruang Controller
 * CRUD operations for classroom/room management
 */

import { sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Ruang');

// Get all rooms
export const getRuang = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { search } = req.query;
    
    log.requestStart('GetAll', { search: search || null });

    try {
        let query = `
            SELECT 
                id_ruang as id,
                kode_ruang,
                nama_ruang,
                lokasi,
                kapasitas,
                status,
                created_at
            FROM ruang_kelas
        `;

        const params = [];
        if (search) {
            query += ` WHERE kode_ruang LIKE ? OR nama_ruang LIKE ? OR lokasi LIKE ?`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        query += ` ORDER BY kode_ruang`;

        const [rows] = await global.dbPool.execute(query, params);
        log.success('GetAll', { count: rows.length, hasSearch: !!search });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error, { search });
        return sendDatabaseError(res, error, 'Gagal mengambil data ruang');
    }
};

// Get single room
export const getRuangById = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    
    log.requestStart('GetById', { id });

    try {
        const [rows] = await global.dbPool.execute(
            'SELECT * FROM ruang_kelas WHERE id_ruang = ?',
            [id]
        );

        if (rows.length === 0) {
            log.warn('GetById failed - not found', { id });
            return sendNotFoundError(res, 'Ruang tidak ditemukan');
        }

        log.success('GetById', { id });
        res.json(rows[0]);
    } catch (error) {
        log.dbError('query', error, { id });
        return sendDatabaseError(res, error, 'Gagal mengambil data ruang');
    }
};

// Create new room
export const createRuang = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { kode_ruang, nama_ruang, lokasi, kapasitas, status } = req.body;
    
    log.requestStart('Create', { kode_ruang, nama_ruang });

    try {
        // Validation
        if (!kode_ruang) {
            log.validationFail('kode_ruang', null, 'Required field missing');
            return sendValidationError(res, 'Kode ruang wajib diisi', { field: 'kode_ruang' });
        }

        // Convert to uppercase and validate format
        const kodeUpper = kode_ruang.toUpperCase().trim();
        if (kodeUpper.length > 10) {
            log.validationFail('kode_ruang', kodeUpper, 'Exceeds max length');
            return sendValidationError(res, 'Kode ruang maksimal 10 karakter', { 
                field: 'kode_ruang',
                maxLength: 10,
                actualLength: kodeUpper.length
            });
        }

        // Check for duplicate kode_ruang
        const [existing] = await global.dbPool.execute(
            'SELECT id_ruang FROM ruang_kelas WHERE kode_ruang = ?',
            [kodeUpper]
        );

        if (existing.length > 0) {
            log.warn('Create failed - duplicate code', { kode_ruang: kodeUpper });
            return sendDuplicateError(res, 'Kode ruang sudah digunakan');
        }

        // Insert new room
        const [result] = await global.dbPool.execute(
            `INSERT INTO ruang_kelas (kode_ruang, nama_ruang, lokasi, kapasitas, status) 
             VALUES (?, ?, ?, ?, ?)`,
            [kodeUpper, nama_ruang || null, lokasi || null, kapasitas || null, status || 'aktif']
        );

        log.success('Create', { id: result.insertId, kode_ruang: kodeUpper });
        return sendSuccessResponse(res, { id: result.insertId }, 'Ruang berhasil ditambahkan', 201);
    } catch (error) {
        log.dbError('insert', error, { kode_ruang });
        return sendDatabaseError(res, error, 'Gagal menambahkan ruang');
    }
};

// Update room
export const updateRuang = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    const { kode_ruang, nama_ruang, lokasi, kapasitas, status } = req.body;
    
    log.requestStart('Update', { id, kode_ruang });

    try {
        // Validation
        if (!kode_ruang) {
            log.validationFail('kode_ruang', null, 'Required field missing');
            return sendValidationError(res, 'Kode ruang wajib diisi', { field: 'kode_ruang' });
        }

        // Convert to uppercase and validate format
        const kodeUpper = kode_ruang.toUpperCase().trim();
        if (kodeUpper.length > 10) {
            log.validationFail('kode_ruang', kodeUpper, 'Exceeds max length');
            return sendValidationError(res, 'Kode ruang maksimal 10 karakter', { 
                field: 'kode_ruang',
                maxLength: 10 
            });
        }

        // Check for duplicate kode_ruang (excluding current room)
        const [existing] = await global.dbPool.execute(
            'SELECT id_ruang FROM ruang_kelas WHERE kode_ruang = ? AND id_ruang != ?',
            [kodeUpper, id]
        );

        if (existing.length > 0) {
            log.warn('Update failed - duplicate code', { id, kode_ruang: kodeUpper });
            return sendDuplicateError(res, 'Kode ruang sudah digunakan');
        }

        // Update room
        const [result] = await global.dbPool.execute(
            `UPDATE ruang_kelas 
             SET kode_ruang = ?, nama_ruang = ?, lokasi = ?, kapasitas = ?, status = ?
             WHERE id_ruang = ?`,
            [kodeUpper, nama_ruang || null, lokasi || null, kapasitas || null, status || 'aktif', id]
        );

        if (result.affectedRows === 0) {
            log.warn('Update failed - not found', { id });
            return sendNotFoundError(res, 'Ruang tidak ditemukan');
        }

        log.success('Update', { id, kode_ruang: kodeUpper });
        return sendSuccessResponse(res, null, 'Ruang berhasil diperbarui');
    } catch (error) {
        log.dbError('update', error, { id, kode_ruang });
        return sendDatabaseError(res, error, 'Gagal mengupdate ruang');
    }
};

// Delete room
export const deleteRuang = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    
    log.requestStart('Delete', { id });

    try {
        // Check if room is used in jadwal
        const [jadwalUsage] = await global.dbPool.execute(
            'SELECT COUNT(*) as count FROM jadwal WHERE ruang_id = ?',
            [id]
        );

        if (jadwalUsage[0].count > 0) {
            log.warn('Delete failed - room in use', { id, jadwalCount: jadwalUsage[0].count });
            return sendValidationError(res, 'Tidak dapat menghapus ruang yang sedang digunakan dalam jadwal', {
                reason: 'in_use',
                jadwalCount: jadwalUsage[0].count
            });
        }

        // Delete room
        const [result] = await global.dbPool.execute(
            'DELETE FROM ruang_kelas WHERE id_ruang = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            log.warn('Delete failed - not found', { id });
            return sendNotFoundError(res, 'Ruang tidak ditemukan');
        }

        log.success('Delete', { id, affectedRows: result.affectedRows });
        return sendSuccessResponse(res, null, 'Ruang berhasil dihapus');
    } catch (error) {
        log.dbError('delete', error, { id });
        return sendDatabaseError(res, error, 'Gagal menghapus ruang');
    }
};
