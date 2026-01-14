/**
 * Ruang Controller
 * Mengelola operasi CRUD untuk manajemen ruang kelas
 */

import { sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';
import * as ruangService from '../services/ruangService.js';

const logger = createLogger('Ruang');

/**
 * Mengambil semua data ruang
 * GET /api/admin/ruang
 */
export const getRuang = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { search } = req.query;
    
    log.requestStart('GetAll', { search: search || null });

    try {
        const rows = await ruangService.getAllRuang(search);
        log.success('GetAll', { count: rows.length, hasSearch: !!search });
        res.json(rows);
    } catch (error) {
        log.dbError('query', error, { search });
        return sendDatabaseError(res, error, 'Gagal mengambil data ruang');
    }
};

/**
 * Mengambil data ruang berdasarkan ID
 * GET /api/admin/ruang/:id
 */
export const getRuangById = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    
    log.requestStart('GetById', { id });

    try {
        const ruang = await ruangService.getRuangById(id);

        if (!ruang) {
            log.warn('GetById failed - not found', { id });
            return sendNotFoundError(res, 'Ruang tidak ditemukan');
        }

        log.success('GetById', { id });
        res.json(ruang);
    } catch (error) {
        log.dbError('query', error, { id });
        return sendDatabaseError(res, error, 'Gagal mengambil data ruang');
    }
};

/**
 * Menambahkan ruang baru
 * POST /api/admin/ruang
 */
export const createRuang = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { kode_ruang, nama_ruang } = req.body;
    
    log.requestStart('Create', { kode_ruang, nama_ruang });

    try {
        if (!kode_ruang) {
            log.validationFail('kode_ruang', null, 'Required field missing');
            return sendValidationError(res, 'Kode ruang wajib diisi', { field: 'kode_ruang' });
        }
        if (kode_ruang.length > 10) { // Pre-check before service to keep validation structure if needed, or rely on service
             // Keeping it here for specific error format response match
             const kodeUpper = kode_ruang.toUpperCase().trim();
             if (kodeUpper.length > 10) {
                log.validationFail('kode_ruang', kodeUpper, 'Exceeds max length');
                return sendValidationError(res, 'Kode ruang maksimal 10 karakter', { field: 'kode_ruang', maxLength: 10 });
             }
        }

        const result = await ruangService.createRuang(req.body);

        log.success('Create', { id: result.id, kode_ruang: result.kode_ruang });
        return sendSuccessResponse(res, { id: result.id }, 'Ruang berhasil ditambahkan', 201);
    } catch (error) {
        if (error instanceof ruangService.ServiceError) {
             if (error.code === 'DUPLICATE_CODE') return sendDuplicateError(res, error.message);
        }
        log.dbError('insert', error, { kode_ruang });
        return sendDatabaseError(res, error, 'Gagal menambahkan ruang');
    }
};

/**
 * Memperbarui data ruang
 * PUT /api/admin/ruang/:id
 */
export const updateRuang = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    const { kode_ruang } = req.body;
    
    log.requestStart('Update', { id, kode_ruang });

    try {
        if (!kode_ruang) {
            log.validationFail('kode_ruang', null, 'Required field missing');
            return sendValidationError(res, 'Kode ruang wajib diisi', { field: 'kode_ruang' });
        }
        if (kode_ruang.length > 10) {
             const kodeUpper = kode_ruang.toUpperCase().trim();
             if (kodeUpper.length > 10) {
                log.validationFail('kode_ruang', kodeUpper, 'Exceeds max length');
                return sendValidationError(res, 'Kode ruang maksimal 10 karakter', { field: 'kode_ruang', maxLength: 10 });
             }
        }

        await ruangService.updateRuang(id, req.body);

        log.success('Update', { id, kode_ruang: kode_ruang.toUpperCase() });
        return sendSuccessResponse(res, null, 'Ruang berhasil diperbarui');
    } catch (error) {
        if (error instanceof ruangService.ServiceError) {
             if (error.code === 'DUPLICATE_CODE') return sendDuplicateError(res, error.message);
             if (error.code === 'NOT_FOUND') return sendNotFoundError(res, error.message);
        }
        log.dbError('update', error, { id, kode_ruang });
        return sendDatabaseError(res, error, 'Gagal mengupdate ruang');
    }
};

/**
 * Menghapus ruang
 * DELETE /api/admin/ruang/:id
 */
export const deleteRuang = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    
    log.requestStart('Delete', { id });

    try {
        await ruangService.deleteRuang(id);
        log.success('Delete', { id });
        return sendSuccessResponse(res, null, 'Ruang berhasil dihapus');
    } catch (error) {
        if (error instanceof ruangService.ServiceError) {
            if (error.code === 'IN_USE') {
                log.warn('Delete failed - room in use', { id, details: error.details });
                return sendValidationError(res, error.message, { reason: 'in_use', ...error.details });
            }
            if (error.code === 'NOT_FOUND') return sendNotFoundError(res, error.message);
        }
        log.dbError('delete', error, { id });
        return sendDatabaseError(res, error, 'Gagal menghapus ruang');
    }
};
