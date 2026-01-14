/**
 * Student Data Controller
 * Mengelola operasi CRUD untuk Data Siswa (Profil + Sinkronisasi Akun User) dan Promosi (Kenaikan Kelas)
 */

import { sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';
import * as studentService from '../services/studentService.js';

const logger = createLogger('StudentData');

/**
 * Mengambil data semua siswa untuk dashboard admin
 * GET /api/admin/students/data
 */
export const getStudentsData = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetAll');

    try {
        const results = await studentService.getAllStudents();
        log.success('GetAll', { count: results.length });
        res.json(results);
    } catch (error) {
        log.dbError('query', error);
        return sendDatabaseError(res, error, 'Gagal mengambil data siswa');
    }
};

/**
 * Menambahkan data siswa baru
 * POST /api/admin/students/data
 */
export const addStudentData = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { nis, nama, kelas_id, jenis_kelamin } = req.body;
    
    log.requestStart('Create', { nis, nama, kelas_id });

    try {
        if (!nis || !nama || !kelas_id || !jenis_kelamin) {
            log.validationFail('required_fields', null, 'NIS, nama, kelas_id, jenis_kelamin required');
            return sendValidationError(res, 'NIS, nama, kelas, dan jenis kelamin wajib diisi', { fields: ['nis', 'nama', 'kelas_id', 'jenis_kelamin'] });
        }

        const result = await studentService.createStudent(req.body);

        log.success('Create', { siswaId: result.id, userId: result.userId, nis, nama });
        return sendSuccessResponse(res, result, 'Data siswa berhasil ditambahkan', 201);
    } catch (error) {
        if (error instanceof studentService.ServiceError) {
             if (error.code === 'DUPLICATE_NIS') return sendDuplicateError(res, error.message);
        }
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
             return sendValidationError(res, 'Kelas tidak ditemukan', { field: 'kelas_id' });
        }
        log.dbError('insert', error, { nis, nama });
        return sendDatabaseError(res, error, 'Gagal menambahkan data siswa');
    }
};

/**
 * Memperbarui data siswa
 * PUT /api/admin/students/data/:id
 */
export const updateStudentData = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    const { nis, nama, kelas_id, jenis_kelamin, nomor_telepon_siswa } = req.body;
    
    log.requestStart('Update', { id, nis, nama });

    try {
        if (!nis || !nama || !kelas_id || !jenis_kelamin) {
            log.validationFail('required_fields', null, 'NIS, nama, kelas_id, jenis_kelamin required');
            return sendValidationError(res, 'NIS, nama, kelas, dan jenis kelamin wajib diisi', { fields: ['nis', 'nama', 'kelas_id', 'jenis_kelamin'] });
        }
        if (nomor_telepon_siswa && !/^\d{10,15}$/.test(nomor_telepon_siswa)) {
             log.validationFail('nomor_telepon_siswa', nomor_telepon_siswa, 'Invalid phone format');
             return sendValidationError(res, 'Nomor telepon harus berupa angka 10-15 digit', { field: 'nomor_telepon_siswa' });
        }

        await studentService.updateStudent(id, req.body);

        log.success('Update', { id, nis, nama });
        return sendSuccessResponse(res, null, 'Data siswa berhasil diupdate');
    } catch (error) {
        if (error instanceof studentService.ServiceError) {
             if (error.code === 'DUPLICATE_PHONE') return sendDuplicateError(res, error.message);
             if (error.code === 'DUPLICATE_NIS') return sendDuplicateError(res, error.message);
             if (error.code === 'NOT_FOUND') return sendNotFoundError(res, error.message);
        }
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
             return sendValidationError(res, 'Kelas tidak ditemukan', { field: 'kelas_id' });
        }
        log.dbError('update', error, { id, nis, nama });
        return sendDatabaseError(res, error, 'Gagal mengupdate data siswa');
    }
};

/**
 * Menghapus data siswa
 * DELETE /api/admin/students/data/:id
 */
export const deleteStudentData = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    
    log.requestStart('Delete', { id });

    try {
        await studentService.deleteStudent(id);
        log.success('Delete', { id });
        return sendSuccessResponse(res, null, 'Data siswa berhasil dihapus');
    } catch (error) {
        if (error instanceof studentService.ServiceError) {
             if (error.code === 'NOT_FOUND') return sendNotFoundError(res, error.message);
        }
        log.dbError('delete', error, { id });
        return sendDatabaseError(res, error, 'Gagal menghapus data siswa');
    }
};

/**
 * Mempromosikan siswa (Kenaikan Kelas)
 * POST /api/admin/students/promote
 */
export const promoteStudents = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { fromClassId, toClassId, studentIds } = req.body;
    
    log.requestStart('PromoteStudents', { fromClassId, toClassId, studentCount: studentIds?.length });

    try {
        // Validasi input
        if (!fromClassId || !toClassId || !studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            log.validationFail('required_fields', null, 'fromClassId, toClassId, studentIds required');
            return sendValidationError(res, 'fromClassId, toClassId, dan studentIds wajib diisi (array tidak kosong)');
        }
        if (typeof fromClassId !== 'string' && typeof fromClassId !== 'number') return sendValidationError(res, 'Invalid fromClassId type');
        if (typeof toClassId !== 'string' && typeof toClassId !== 'number') return sendValidationError(res, 'Invalid toClassId type');
        if (!studentIds.every(id => typeof id === 'number' && Number.isInteger(id) && id > 0)) {
            return sendValidationError(res, 'studentIds harus berupa integer positif');
        }

        const result = await studentService.promoteStudents(fromClassId, toClassId, studentIds);

        log.success('PromoteStudents', result);
        return sendSuccessResponse(res, result, 'Siswa berhasil dinaikkan kelas');
    } catch (error) {
        if (error instanceof studentService.ServiceError) {
             if (error.code === 'CLASS_NOT_FOUND') return sendNotFoundError(res, error.message);
             if (error.code === 'INVALID_PROMOTION_LEVEL') return sendValidationError(res, error.message);
             if (error.code === 'INVALID_PROMOTION_PATH') return sendValidationError(res, error.message);
             if (error.code === 'STUDENT_MISMATCH') return sendValidationError(res, error.message);
        }
        log.dbError('promote', error, { fromClassId, toClassId });
        return sendDatabaseError(res, error, 'Gagal mempromosikan siswa');
    }
};
