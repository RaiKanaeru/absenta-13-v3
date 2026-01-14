/**
 * Teacher Data Controller
 * Mengelola operasi CRUD untuk Data Guru (Profil + Sinkronisasi Akun User)
 */

import { sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';
import * as teacherService from '../services/teacherService.js';

const logger = createLogger('TeacherData');

/**
 * Mengambil data semua guru untuk dashboard admin
 * GET /api/admin/teachers/data
 */
export const getTeachersData = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetAll');

    try {
        const results = await teacherService.getAllTeachers();
        log.success('GetAll', { count: results.length });
        res.json(results);
    } catch (error) {
        log.dbError('query', error);
        return sendDatabaseError(res, error, 'Gagal mengambil data guru');
    }
};

/**
 * Menambahkan data guru baru
 * POST /api/admin/teachers/data
 */
export const addTeacherData = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { nip, nama, mata_pelajaran, jenis_kelamin } = req.body;
    
    log.requestStart('Create', { nip, nama, mata_pelajaran });

    try {
        if (!nip || !nama || !jenis_kelamin) {
            log.validationFail('required_fields', null, 'NIP, nama, jenis_kelamin required');
            return sendValidationError(res, 'NIP, nama, dan jenis kelamin wajib diisi', { fields: ['nip', 'nama', 'jenis_kelamin'] });
        }

        const result = await teacherService.createTeacher(req.body);

        log.success('Create', { guruId: result.id, nip, nama });
        return sendSuccessResponse(res, { id: result.id }, 'Data guru berhasil ditambahkan', 201);
    } catch (error) {
        if (error instanceof teacherService.ServiceError) {
            if (error.code === 'DUPLICATE_NIP') {
                log.warn('Create failed - NIP exists', { nip });
                return sendDuplicateError(res, error.message);
            }
        }
        log.dbError('insert', error, { nip, nama });
        return sendDatabaseError(res, error, 'Gagal menambahkan data guru');
    }
};

/**
 * Memperbarui data guru
 * PUT /api/admin/teachers/data/:id
 */
export const updateTeacherData = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    const { nip, nama } = req.body;
    
    log.requestStart('Update', { id, nip, nama });

    try {
        if (!nip || !nama || !req.body.jenis_kelamin) {
            log.validationFail('required_fields', null, 'NIP, nama, jenis_kelamin required');
            return sendValidationError(res, 'NIP, nama, dan jenis kelamin wajib diisi', { fields: ['nip', 'nama', 'jenis_kelamin'] });
        }

        await teacherService.updateTeacher(id, req.body);

        log.success('Update', { id, nip, nama });
        return sendSuccessResponse(res, null, 'Data guru berhasil diupdate');
    } catch (error) {
        if (error instanceof teacherService.ServiceError) {
            if (error.code === 'DUPLICATE_NIP') {
                log.warn('Update failed - NIP taken', { nip, id });
                return sendDuplicateError(res, error.message);
            }
            if (error.code === 'NOT_FOUND') {
                log.warn('Update failed - not found', { id });
                return sendNotFoundError(res, error.message);
            }
        }
        log.dbError('update', error, { id, nip, nama });
        return sendDatabaseError(res, error, 'Gagal mengupdate data guru');
    }
};

/**
 * Menghapus data guru
 * DELETE /api/admin/teachers/data/:id
 */
export const deleteTeacherData = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    
    log.requestStart('Delete', { id });

    try {
        await teacherService.deleteTeacher(id);
        log.success('Delete', { id });
        return sendSuccessResponse(res, null, 'Data guru berhasil dihapus');
    } catch (error) {
         if (error instanceof teacherService.ServiceError) {
            if (error.code === 'NOT_FOUND') {
                log.warn('Delete failed - not found', { id });
                return sendNotFoundError(res, error.message);
            }
        }
        log.dbError('delete', error, { id });
        return sendDatabaseError(res, error, 'Gagal menghapus data guru');
    }
};
