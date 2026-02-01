/**
 * Admin Controller
 * Mengelola operasi profil dan password admin
 */

import bcrypt from 'bcrypt';
import db from '../config/db.js';
import { sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError, sendSuccessResponse } from '../utils/errorHandler.js';
import { getMySQLDateTimeWIB } from '../utils/timeUtils.js';
import { createLogger } from '../utils/logger.js';

import dotenv from 'dotenv';
dotenv.config();

const saltRounds = Number.parseInt(process.env.SALT_ROUNDS) || 10;
const logger = createLogger('Admin');

/**
 * Memperbarui profil admin
 * PUT /api/admin/profile
 * @param {Object} req - Express request dengan body {nama, username, email?}
 * @param {Object} res - Express response object
 * @returns {Object} Data profil yang diperbarui
 */
export const updateAdminProfile = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { nama, username, email } = req.body;
    const userId = req.user.id;

    log.requestStart('UpdateProfile', { nama, username, email, userId });

    try {
        // Validate required fields
        if (!nama || !username) {
            log.validationFail('nama/username', null, 'Required fields missing');
            return sendValidationError(res, 'Nama dan username wajib diisi', { fields: ['nama', 'username'] });
        }

        // Validate email format if provided
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            log.validationFail('email', email, 'Invalid format');
            return sendValidationError(res, 'Format email tidak valid', { field: 'email' });
        }

        // Check if username is already taken by another user
        const [existingUser] = await db.execute(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [username, userId]
        );

        if (existingUser.length > 0) {
            log.warn('UpdateProfile failed - username taken', { username });
            return sendDuplicateError(res, 'Username sudah digunakan oleh user lain');
        }

        // Update profile in users table
        const [updateResult] = await db.execute(
            `UPDATE users SET 
                nama = ?, 
                username = ?, 
                email = ?,
                updated_at = ?
            WHERE id = ?`,
            [nama, username, email || null, getMySQLDateTimeWIB(), userId]
        );

        log.debug('Profile update result', { affectedRows: updateResult.affectedRows });

        // Get updated user data
        const [updatedUser] = await db.execute(
            'SELECT id, username, nama, email, role, created_at, updated_at FROM users WHERE id = ?',
            [userId]
        );

        if (updatedUser.length === 0) {
            log.warn('UpdateProfile - user not found after update', { userId });
            return sendNotFoundError(res, 'Data admin tidak ditemukan setelah update');
        }

        log.success('UpdateProfile', { userId, username, nama });
        return sendSuccessResponse(res, updatedUser[0], 'Profil berhasil diperbarui');
    } catch (error) {
        log.dbError('updateProfile', error, { userId });
        return sendDatabaseError(res, error, 'Gagal mengupdate profil admin');
    }
};

/**
 * Mengubah password admin
 * PUT /api/admin/change-password
 * @param {Object} req - Express request dengan body {newPassword}
 * @param {Object} res - Express response object
 * @returns {null} Success message
 */
export const changeAdminPassword = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { newPassword } = req.body;
    const userId = req.user.id;

    log.requestStart('ChangePassword', { userId });

    try {
        // Validate required fields
        if (!newPassword) {
            log.validationFail('newPassword', null, 'Required field missing');
            return sendValidationError(res, 'Password baru wajib diisi', { field: 'newPassword' });
        }

        if (newPassword.length < 6) {
            log.validationFail('newPassword', null, 'Password too short');
            return sendValidationError(res, 'Password baru minimal 6 karakter', { minLength: 6 });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        await db.execute(
            'UPDATE users SET password = ?, updated_at = ? WHERE id = ?',
            [hashedPassword, getMySQLDateTimeWIB(), userId]
        );

        log.success('ChangePassword', { userId });
        return sendSuccessResponse(res, null, 'Password berhasil diubah');
    } catch (error) {
        log.dbError('changePassword', error, { userId });
        return sendDatabaseError(res, error, 'Gagal mengubah password');
    }
};
