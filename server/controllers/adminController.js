import bcrypt from 'bcrypt';
import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError } from '../utils/errorHandler.js';

import dotenv from 'dotenv';
import { getMySQLDateTimeWIB } from '../utils/timeUtils.js';

dotenv.config();

const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;

// Update profile for admin
export const updateAdminProfile = async (req, res) => {
    try {
        const { nama, username, email } = req.body;
        const userId = req.user.id;

        console.log('📝 Admin profile update request:', { nama, username, email, userId });

        // Validate required fields
        if (!nama || !username) {
            return res.status(400).json({ error: 'Nama dan username wajib diisi' });
        }

        // Validate email format if provided
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Format email tidak valid' });
        }

        // Check if username is already taken by another user
        const [existingUser] = await global.dbPool.execute(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [username, userId]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'Username sudah digunakan oleh user lain' });
        }

        // Update profile in users table
        const [updateResult] = await global.dbPool.execute(
            `UPDATE users SET 
                nama = ?, 
                username = ?, 
                email = ?,
                updated_at = ?
            WHERE id = ?`,
            [nama, username, email || null, getMySQLDateTimeWIB(), userId]
        );

        console.log('✅ Admin profile update result:', updateResult);

        // Get updated user data
        const [updatedUser] = await global.dbPool.execute(
            'SELECT id, username, nama, email, role, created_at, updated_at FROM users WHERE id = ?',
            [userId]
        );

        if (updatedUser.length === 0) {
            return res.status(404).json({ error: 'Data admin tidak ditemukan setelah update' });
        }

        console.log('✅ Admin profile updated successfully:', updatedUser[0]);

        res.json({
            success: true,
            message: 'Profil berhasil diperbarui',
            data: updatedUser[0]
        });
    } catch (error) {
        return sendDatabaseError(res, error, 'Internal server error');
    }
};

// Change password for admin
export const changeAdminPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!newPassword) {
            return res.status(400).json({ error: 'Password baru wajib diisi' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        await global.dbPool.execute(
            'UPDATE users SET password = ?, updated_at = ? WHERE id = ?',
            [hashedPassword, getMySQLDateTimeWIB(), userId]
        );

        res.json({
            success: true,
            message: 'Password berhasil diubah'
        });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};
