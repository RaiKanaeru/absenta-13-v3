/**
 * Validation Utilities
 * Helper functions for common validation tasks
 */

import { sendValidationError, sendPermissionError } from './errorHandler.js';

/**
 * Validates if the authenticated user has the required context (role-specific ID)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Boolean} - Returns true if valid, false if response sent
 */
export function validateUserContext(req, res) {
    const { role } = req.user;

    if (role === 'siswa') {
        if (!req.user.siswa_id) {
            sendPermissionError(res, 'Data akun siswa tidak lengkap (ID tidak ditemukan). Hubungi admin.');
            return false;
        }
        if (!req.user.kelas_id) {
            sendValidationError(res, 'Data kelas siswa tidak ditemukan. Hubungi admin.');
            return false;
        }
    } else if (role === 'guru') {
        if (!req.user.guru_id) {
            sendPermissionError(res, 'Data akun guru tidak lengkap (ID tidak ditemukan). Hubungi admin.');
            return false;
        }
    }

    return true;
}

/**
 * Validates if the request ID matches the authenticated user ID for the given role
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {String|Number} targetId - ID to check against
 * @param {String} idType - 'siswa_id' or 'guru_id'
 * @returns {Boolean} - Returns true if valid, false if response sent
 */
export function validateSelfAccess(req, res, targetId, idType = 'siswa_id') {
    const currentId = req.user[idType];
    
    if (!currentId) {
        sendPermissionError(res, 'Sesi tidak valid. Silakan login ulang.');
        return false;
    }

    if (Number(currentId) !== Number(targetId)) {
        sendPermissionError(res, 'Anda tidak diizinkan mengakses data pengguna lain.');
        return false;
    }

    return true;
}

export function validatePerwakilanAccess(req, res) {
    if (!req.user || req.user.role !== 'siswa') {
        sendPermissionError(res, 'Akses ini hanya untuk siswa perwakilan.');
        return false;
    }

    if (!req.user.is_perwakilan) {
        sendPermissionError(res, 'Akun ini bukan perwakilan siswa.');
        return false;
    }

    return true;
}
