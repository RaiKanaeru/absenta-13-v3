/**
 * Admin Dashboard Controller
 * Mengelola akun guru dan siswa untuk dashboard admin
 */

import bcrypt from 'bcrypt';
import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const logger = createLogger('AdminDashboard');
const saltRounds = Number.parseInt(process.env.SALT_ROUNDS) || 10;

// ================================================
// ADMIN DASHBOARD ENDPOINTS - TEACHER ACCOUNTS
// ================================================

/**
 * Mengambil daftar guru untuk dashboard admin
 * GET /api/admin/teachers
 * @returns {Array} Daftar guru dengan data akun
 */
export const getTeachers = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetTeachers', {});

    try {
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

        const [results] = await globalThis.dbPool.execute(query);
        log.success('GetTeachers', { count: results.length });
        res.json(results);
    } catch (error) {
        log.dbError('getTeachers', error);
        return sendDatabaseError(res, error);
    }
};

/**
 * Menambahkan akun guru baru
 * POST /api/admin/teachers
 * @param {Object} req.body - {nama, username, password}
 * @returns {Object} ID guru yang dibuat
 */
export const addTeacher = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { nama, username, password } = req.body;
    log.requestStart('AddTeacher', { nama, username });

    if (!nama || !username || !password) {
        log.validationFail('required_fields', null, 'Missing nama, username, or password');
        return sendValidationError(res, 'Nama, username, dan password wajib diisi');
    }

    const connection = await globalThis.dbPool.getConnection();

    try {
        // Check if username already exists
        const [existingUsers] = await connection.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existingUsers.length > 0) {
            log.validationFail('username', username, 'Already exists');
            connection.release();
            return sendDuplicateError(res, 'Username sudah digunakan');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Start transaction
        await connection.beginTransaction();

        try {
            // Insert user account
            const [userResult] = await connection.execute(
                'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                [username, hashedPassword, 'guru']
            );

            // Insert guru data with generated NIP
            const nip = `G${Date.now().toString().slice(-8)}`;
            await connection.execute(
                'INSERT INTO guru (nip, nama, username, jenis_kelamin, status) VALUES (?, ?, ?, ?, ?)',
                [nip, nama, username, 'L', 'aktif']
            );

            await connection.commit();
            log.success('AddTeacher', { nama, username, nip });
            return sendSuccessResponse(res, { id: userResult.insertId }, 'Akun guru berhasil ditambahkan', 201);
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        log.dbError('addTeacher', error, { nama, username });
        return sendDatabaseError(res, error);
    } finally {
        connection.release();
    }
};

/**
 * Memperbarui akun guru
 * PUT /api/admin/teachers/:id
 * @param {Object} req.body - {nama, username, password?}
 * @returns {null} Success message
 */
export const updateTeacher = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    const { nama, username, password } = req.body;
    log.requestStart('UpdateTeacher', { id, nama, username });

    if (!nama || !username) {
        log.validationFail('required_fields', null, 'Missing nama or username');
        return sendValidationError(res, 'Nama dan username wajib diisi');
    }

    const connection = await globalThis.dbPool.getConnection();

    try {
        // Check if username already exists (excluding current user)
        const [existingUsers] = await connection.execute(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [username, id]
        );

        if (existingUsers.length > 0) {
            log.validationFail('username', username, 'Already used by another user');
            connection.release();
            return sendDuplicateError(res, 'Username sudah digunakan');
        }

        await connection.beginTransaction();

        try {
            // Get current username
            const [currentUser] = await connection.execute(
                'SELECT username FROM users WHERE id = ?',
                [id]
            );

            if (currentUser.length === 0) {
                await connection.rollback();
                log.warn('UpdateTeacher - user not found', { id });
                connection.release();
                return sendNotFoundError(res, 'User tidak ditemukan');
            }

            const oldUsername = currentUser[0].username;

            // Update user account
            if (password) {
                const hashedPassword = await bcrypt.hash(password, saltRounds);
                await connection.execute(
                    'UPDATE users SET username = ?, password = ? WHERE id = ?',
                    [username, hashedPassword, id]
                );
            } else {
                await connection.execute(
                    'UPDATE users SET username = ? WHERE id = ?',
                    [username, id]
                );
            }

            // Update guru data
            await connection.execute(
                'UPDATE guru SET nama = ?, username = ? WHERE username = ?',
                [nama, username, oldUsername]
            );

            await connection.commit();
            log.success('UpdateTeacher', { id, nama, username });
            return sendSuccessResponse(res, null, 'Akun guru berhasil diupdate');
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        log.dbError('updateTeacher', error, { id });
        return sendDatabaseError(res, error);
    } finally {
        connection.release();
    }
};

/**
 * Menghapus akun guru
 * DELETE /api/admin/teachers/:id
 * @returns {null} Success message
 */
export const deleteTeacher = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { id } = req.params;
    log.requestStart('DeleteTeacher', { id });

    const connection = await globalThis.dbPool.getConnection();

    try {
        await connection.beginTransaction();

        try {
            // Get username first
            const [userResult] = await connection.execute(
                'SELECT username FROM users WHERE id = ?',
                [id]
            );

            if (userResult.length === 0) {
                await connection.rollback();
                log.warn('DeleteTeacher - user not found', { id });
                connection.release();
                return sendNotFoundError(res, 'User tidak ditemukan');
            }

            const username = userResult[0].username;

            // Delete from guru table first (foreign key constraint)
            await connection.execute(
                'DELETE FROM guru WHERE username = ?',
                [username]
            );

            // Delete from users table
            await connection.execute(
                'DELETE FROM users WHERE id = ?',
                [id]
            );

            await connection.commit();
            log.success('DeleteTeacher', { id, username });
            return sendSuccessResponse(res, null, 'Akun guru berhasil dihapus');
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        log.dbError('deleteTeacher', error, { id });
        return sendDatabaseError(res, error);
    } finally {
        connection.release();
    }
};
