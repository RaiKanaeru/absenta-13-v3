/**
 * Auth Controller
 * Handles user authentication: login, logout, verify
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { sendErrorResponse, sendValidationError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'absenta-super-secret-key-2025';
const logger = createLogger('Auth');

/**
 * Login user
 * POST /api/login
 */
export const login = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { username, password } = req.body;
    const startTime = Date.now();
    
    log.info('Login attempt', { username, ip: req.ip });

    try {
        // Validation
        if (!username || !password) {
            log.validationFail('credentials', null, 'Username or password missing');
            return sendValidationError(res, 'Username dan password wajib diisi', { 
                fields: ['username', 'password'] 
            });
        }

        // Query user from database
        const [rows] = await global.dbPool.execute(
            'SELECT * FROM users WHERE username = ? AND status = "aktif"',
            [username]
        );

        if (rows.length === 0) {
            log.warn('Login failed - user not found', { username });
            return res.status(401).json({ 
                success: false,
                error: 'Username atau password salah' 
            });
        }

        const user = rows[0];

        // Verify password with bcrypt
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            log.warn('Login failed - invalid password', { username, userId: user.id });
            return res.status(401).json({ 
                success: false,
                error: 'Username atau password salah' 
            });
        }

        // Get additional user data based on role
        let additionalData = {};

        if (user.role === 'guru') {
            const [guruData] = await global.dbPool.execute(
                `SELECT g.*, m.nama_mapel 
                 FROM guru g 
                 LEFT JOIN mapel m ON g.mapel_id = m.id_mapel 
                 WHERE g.user_id = ?`,
                [user.id]
            );
            if (guruData.length > 0) {
                additionalData = {
                    guru_id: guruData[0].id_guru,
                    nip: guruData[0].nip,
                    mapel: guruData[0].nama_mapel || null
                };
            }
        } else if (user.role === 'siswa') {
            const [siswaData] = await global.dbPool.execute(
                `SELECT s.*, k.nama_kelas 
                 FROM siswa s 
                 JOIN kelas k ON s.kelas_id = k.id_kelas 
                 WHERE s.user_id = ?`,
                [user.id]
            );
            if (siswaData.length > 0) {
                additionalData = {
                    siswa_id: siswaData[0].id_siswa,
                    nis: siswaData[0].nis,
                    kelas: siswaData[0].nama_kelas,
                    kelas_id: siswaData[0].kelas_id
                };
            }
        }

        // Generate JWT token
        const tokenPayload = {
            id: user.id,
            username: user.username,
            nama: user.nama,
            role: user.role,
            ...additionalData
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

        // Set cookie and return response
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', 
            sameSite: 'lax', 
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        log.timed('Login successful', startTime, { 
            userId: user.id, 
            username: user.username, 
            role: user.role 
        });

        res.json({
            success: true,
            message: 'Login berhasil',
            user: tokenPayload,
            token
        });

    } catch (error) {
        log.dbError('login', error, { username });
        return sendErrorResponse(
            res, 
            error, 
            'Terjadi kesalahan saat memproses login. Silakan coba lagi.',
            500
        );
    }
};

/**
 * Logout user
 * POST /api/logout
 */
export const logout = (req, res) => {
    const log = logger.withRequest(req, res);
    
    res.clearCookie('token');
    log.info('User logged out', { userId: req.user?.id, username: req.user?.username });
    
    return sendSuccessResponse(res, null, 'Logout berhasil');
};

/**
 * Verify token
 * GET /api/verify
 */
export const verify = (req, res) => {
    const log = logger.withRequest(req, res);
    
    log.debug('Token verified', { userId: req.user?.id, role: req.user?.role });
    
    res.json({
        success: true,
        user: req.user,
        message: 'Token valid'
    });
};
