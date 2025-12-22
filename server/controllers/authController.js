/**
 * @fileoverview Auth Controller - Modul Autentikasi ABSENTA
 * @module controllers/authController
 * 
 * Menangani proses autentikasi pengguna:
 * - Login dengan username/password
 * - Logout dan invalidasi session
 * - Verifikasi token JWT
 * - Rate limiting untuk mencegah brute force
 * 
 * @requires bcrypt - Untuk hashing password
 * @requires jsonwebtoken - Untuk generate/verify JWT
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { sendErrorResponse, sendValidationError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

dotenv.config();

/** Secret key untuk signing JWT token */
const JWT_SECRET = process.env.JWT_SECRET || 'absenta-super-secret-key-2025';
const logger = createLogger('Auth');

// ============================================================
// RATE LIMITING - Mencegah Brute Force Attack
// ============================================================

/** 
 * Map untuk menyimpan riwayat percobaan login per IP
 * @type {Map<string, {count: number, firstAttempt: number, lastAttempt: number, lockedUntil?: number}>}
 */
const loginAttempts = new Map();

/** Maksimal percobaan login sebelum lockout */
const MAX_LOGIN_ATTEMPTS = 5;

/** Durasi lockout dalam milliseconds (15 menit) */
const LOCKOUT_DURATION = 15 * 60 * 1000;

/**
 * Check if IP is locked out from login attempts
 */
function checkLoginAttempts(ip) {
    const attempts = loginAttempts.get(ip);
    if (!attempts) return { allowed: true, count: 0 };
    
    // Check if lockout has expired
    if (attempts.lockedUntil && Date.now() >= attempts.lockedUntil) {
        // Reset after lockout expires
        loginAttempts.delete(ip);
        return { allowed: true, count: 0 };
    }
    
    // Check if currently locked
    if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
        const remainingMs = attempts.lockedUntil - Date.now();
        return { 
            allowed: false, 
            count: attempts.count,
            remainingTime: Math.ceil(remainingMs / 1000),
            remainingMinutes: Math.ceil(remainingMs / 60000)
        };
    }
    
    return { allowed: true, count: attempts.count };
}

/**
 * Record a failed login attempt
 */
function recordFailedAttempt(ip) {
    const attempts = loginAttempts.get(ip) || { count: 0, firstAttempt: Date.now() };
    attempts.count += 1;
    attempts.lastAttempt = Date.now();
    
    // Lock if exceeded max attempts
    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
        attempts.lockedUntil = Date.now() + LOCKOUT_DURATION;
        logger.warn(`🔒 IP ${ip} locked for ${LOCKOUT_DURATION / 60000} minutes after ${attempts.count} failed attempts`);
    }
    
    loginAttempts.set(ip, attempts);
    return attempts;
}

/**
 * Reset login attempts on successful login
 */
function resetLoginAttempts(ip) {
    loginAttempts.delete(ip);
}

/**
 * Cleanup expired entries (run periodically)
 */
setInterval(() => {
    const now = Date.now();
    for (const [ip, attempts] of loginAttempts.entries()) {
        // Remove entries older than 1 hour with no lockout
        if (!attempts.lockedUntil && now - attempts.lastAttempt > 3600000) {
            loginAttempts.delete(ip);
        }
        // Remove expired lockouts
        if (attempts.lockedUntil && now >= attempts.lockedUntil) {
            loginAttempts.delete(ip);
        }
    }
}, 60000); // Run every minute

/**
 * Login user
 * POST /api/login
 */
export const login = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { username, password } = req.body;
    const startTime = Date.now();
    const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';
    
    log.info('Login attempt', { username, ip: clientIP });

    // Check if IP is locked out
    const lockoutCheck = checkLoginAttempts(clientIP);
    if (!lockoutCheck.allowed) {
        log.warn('Login blocked - IP locked out', { 
            ip: clientIP, 
            attempts: lockoutCheck.count,
            remainingMinutes: lockoutCheck.remainingMinutes 
        });
        return res.status(429).json({ 
            success: false,
            error: `Terlalu banyak percobaan login. Coba lagi dalam ${lockoutCheck.remainingMinutes} menit.`,
            retryAfter: lockoutCheck.remainingTime
        });
    }

    try {
        // Validation
        if (!username || !password) {
            log.validationFail('credentials', null, 'Username or password missing');
            return sendValidationError(res, 'Username dan password wajib diisi', { 
                fields: ['username', 'password'] 
            });
        }

        // Query user from database (select only needed columns)
        // Select 'id' (real column) AND 'id as id_user' (alias) because:
        // 1. 'user.id' is used in token generation (fixes 500 error)
        // 2. 'id_user' is expected by some parts of the backend
        const [rows] = await global.dbPool.execute(
            'SELECT id, id as id_user, username, password, nama, role, email, status FROM users WHERE username = ? AND status = "aktif" LIMIT 1',
            [username]
        );

        if (rows.length === 0) {
            recordFailedAttempt(clientIP);
            log.warn('Login failed - user not found', { username, ip: clientIP });
            return res.status(401).json({ 
                success: false,
                error: 'Username atau password salah' 
            });
        }

        const user = rows[0];

        // Verify password with bcrypt
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            const attempts = recordFailedAttempt(clientIP);
            log.warn('Login failed - invalid password', { 
                username, 
                userId: user.id, 
                ip: clientIP,
                attemptCount: attempts.count 
            });
            
            // Check if this attempt triggered lockout
            if (attempts.lockedUntil) {
                return res.status(429).json({ 
                    success: false,
                    error: `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(LOCKOUT_DURATION / 60000)} menit.`,
                    retryAfter: Math.ceil(LOCKOUT_DURATION / 1000)
                });
            }
            
            return res.status(401).json({ 
                success: false,
                error: 'Username atau password salah' 
            });
        }

        // SUCCESS - Reset login attempts
        resetLoginAttempts(clientIP);

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

