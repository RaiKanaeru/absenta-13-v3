/**
 * Admin Dashboard Controller
 * Teacher and student management for admin dashboard
 * Migrated from server_modern.js - EXACT CODE COPY
 */

import bcrypt from 'bcrypt';
import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError } from '../utils/errorHandler.js';

import dotenv from 'dotenv';
dotenv.config();

const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;

// ================================================
// ADMIN DASHBOARD ENDPOINTS - TEACHER ACCOUNTS
// ================================================

// Get teachers for admin dashboard
export const getTeachers = async (req, res) => {
    try {
        console.log('📋 Getting teachers for admin dashboard');

        const query = `
            SELECT 
                g.id_guru as id,
                u.username, 
                g.nama, 
                g.nip,
                g.email,
                g.alamat,
                g.no_telp,
                g.jenis_kelamin,
                g.status,
                m.nama_mapel as mata_pelajaran
            FROM users u
            LEFT JOIN guru g ON u.username = g.username
            LEFT JOIN mapel m ON g.mapel_id = m.id_mapel
            WHERE u.role = 'guru'
            ORDER BY g.nama ASC
        `;

        const [results] = await global.dbPool.execute(query);
        console.log(`✅ Teachers retrieved: ${results.length} items`);
        res.json(results);
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// Add teacher account
export const addTeacher = async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { nama, username, password } = req.body;
        console.log('➕ Adding teacher account:', { nama, username });

        if (!nama || !username || !password) {
            return res.status(400).json({ error: 'Nama, username, dan password wajib diisi' });
        }

        // Check if username already exists
        const [existingUsers] = await global.dbPool.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Username sudah digunakan' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Start transaction
        await connection.beginTransaction();

        try {
            // Insert user account
            const [userResult] = await global.dbPool.execute(
                'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                [username, hashedPassword, 'guru']
            );

            // Insert guru data with generated NIP
            const nip = `G${Date.now().toString().slice(-8)}`; // Generate simple NIP
            await global.dbPool.execute(
                'INSERT INTO guru (nip, nama, username, jenis_kelamin, status) VALUES (?, ?, ?, ?, ?)',
                [nip, nama, username, 'L', 'aktif']
            );

            await connection.commit();
            console.log('✅ Teacher account added successfully');
            res.json({ message: 'Akun guru berhasil ditambahkan' });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        return sendDatabaseError(res, error);
    } finally {
        connection.release();
    }
};

// Update teacher account
export const updateTeacher = async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { id } = req.params;
        const { nama, username, password } = req.body;
        console.log('📝 Updating teacher account:', { id, nama, username });

        if (!nama || !username) {
            return res.status(400).json({ error: 'Nama dan username wajib diisi' });
        }

        // Check if username already exists (excluding current user)
        const [existingUsers] = await global.dbPool.execute(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [username, id]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Username sudah digunakan' });
        }

        await connection.beginTransaction();

        try {
            // Get current username
            const [currentUser] = await global.dbPool.execute(
                'SELECT username FROM users WHERE id = ?',
                [id]
            );

            if (currentUser.length === 0) {
                return res.status(404).json({ error: 'User tidak ditemukan' });
            }

            const oldUsername = currentUser[0].username;

            // Update user account
            if (password) {
                const hashedPassword = await bcrypt.hash(password, saltRounds);
                await global.dbPool.execute(
                    'UPDATE users SET username = ?, password = ? WHERE id = ?',
                    [username, hashedPassword, id]
                );
            } else {
                await global.dbPool.execute(
                    'UPDATE users SET username = ? WHERE id = ?',
                    [username, id]
                );
            }

            // Update guru data
            await global.dbPool.execute(
                'UPDATE guru SET nama = ?, username = ? WHERE username = ?',
                [nama, username, oldUsername]
            );

            await connection.commit();
            console.log('✅ Teacher account updated successfully');
            res.json({ message: 'Akun guru berhasil diupdate' });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        return sendDatabaseError(res, error);
    } finally {
        connection.release();
    }
};

// Delete teacher account
export const deleteTeacher = async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { id } = req.params;
        console.log('🗑️ Deleting teacher account:', { id });

        await connection.beginTransaction();

        try {
            // Get username first
            const [userResult] = await global.dbPool.execute(
                'SELECT username FROM users WHERE id = ?',
                [id]
            );

            if (userResult.length === 0) {
                return res.status(404).json({ error: 'User tidak ditemukan' });
            }

            const username = userResult[0].username;

            // Delete from guru table first (foreign key constraint)
            await global.dbPool.execute(
                'DELETE FROM guru WHERE username = ?',
                [username]
            );

            // Delete from users table
            await global.dbPool.execute(
                'DELETE FROM users WHERE id = ?',
                [id]
            );

            await connection.commit();
            console.log('✅ Teacher account deleted successfully');
            res.json({ message: 'Akun guru berhasil dihapus' });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        return sendDatabaseError(res, error);
    } finally {
        connection.release();
    }
};
