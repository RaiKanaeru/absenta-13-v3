/**
 * @fileoverview Auth Controller - Modul Autentikasi ABSENTA
 * @module controllers/authController
 * 
 * Menangani proses autentikasi pengguna:
 * - Login dengan username/password
 * - Logout dan invalidasi session
 * - Verifikasi token JWT
 * - Rate limiting multi-key (per-akun, per-device, per-IP fallback)
 * - Verifikasi hCaptcha server-side
 * 
 * @requires bcrypt - Untuk hashing password
 * @requires jsonwebtoken - Untuk generate/verify JWT
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { sendErrorResponse, sendRateLimitError, sendValidationError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';
import db from '../config/db.js';

dotenv.config();

/** Secret key untuk signing JWT token - WAJIB diset via environment variable */
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    process.stderr.write('FATAL: JWT_SECRET environment variable is not set\n');
    process.exit(1);
}
const logger = createLogger('Auth');

// ============================================================
// RATE LIMITING - Multi-Key Brute Force Protection
// ============================================================
// Dirancang untuk lingkungan sekolah: banyak siswa 1 jaringan WiFi.
// Lockout utama per-akun (username), BUKAN per-IP,
// agar 1 siswa salah password tidak memblokir seluruh sekolah.
// ============================================================

/** 
 * Map untuk menyimpan riwayat percobaan login per key
 * Key format: "account:<username>" | "client:<clientId>" | "ip:<address>"
 * @type {Map<string, {count: number, firstAttempt: number, lastAttempt: number, lockedUntil?: number}>}
 */
const loginAttempts = new Map();

/** 
 * Konfigurasi lockout per tipe key.
 * - account: per username — threshold ketat, target utama brute-force
 * - client:  per device/browser — threshold sedang
 * - ip:      fallback jika client-id tidak ada — threshold longgar untuk shared network
 */
const LOCKOUT_CONFIG = {
    account: { maxAttempts: 5,  duration: 15 * 60 * 1000 },
    client:  { maxAttempts: 10, duration: 15 * 60 * 1000 },
    ip:      { maxAttempts: 20, duration: 15 * 60 * 1000 },
};

/** Jumlah gagal login per-akun sebelum captcha diwajibkan */
const CAPTCHA_THRESHOLD = 3;

/** hCaptcha secret untuk verifikasi server-side (opsional, graceful fallback) */
const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET || '';

/**
 * Bangun daftar key lockout dari konteks request.
 * @param {string|null} username - Username yang dicoba login
 * @param {string|null} clientId - Device/browser identifier dari header X-Client-ID
 * @param {string} ip - IP address (fallback terakhir)
 * @returns {Array<{key: string, type: string}>}
 */
function buildLockoutKeys(username, clientId, ip) {
    const keys = [];
    if (username) keys.push({ key: `account:${username.toLowerCase()}`, type: 'account' });
    if (clientId) keys.push({ key: `client:${clientId}`, type: 'client' });
    else if (ip) keys.push({ key: `ip:${ip}`, type: 'ip' });
    return keys;
}

/**
 * Cek apakah ada key yang sedang lockout.
 * Juga mengembalikan info captcha requirement berdasarkan jumlah gagal per-akun.
 * @param {string|null} username
 * @param {string|null} clientId
 * @param {string} ip
 * @returns {{allowed: boolean, count: number, remainingTime?: number, remainingMinutes?: number, lockType?: string, requireCaptcha?: boolean}}
 */
function checkLoginAttempts(username, clientId, ip) {
    const keys = buildLockoutKeys(username, clientId, ip);

    for (const { key, type } of keys) {
        const attempts = loginAttempts.get(key);
        if (!attempts) continue;

        // Lockout sudah expired → hapus
        if (attempts.lockedUntil && Date.now() >= attempts.lockedUntil) {
            loginAttempts.delete(key);
            continue;
        }

        // Sedang locked
        if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
            const remainingMs = attempts.lockedUntil - Date.now();
            return {
                allowed: false,
                count: attempts.count,
                remainingTime: Math.ceil(remainingMs / 1000),
                remainingMinutes: Math.ceil(remainingMs / 60000),
                lockType: type
            };
        }
    }

    // Tidak ada yang locked — cek apakah captcha diperlukan
    const accountKey = `account:${(username || '').toLowerCase()}`;
    const accountAttempts = loginAttempts.get(accountKey);
    const count = accountAttempts?.count || 0;

    return {
        allowed: true,
        count,
        requireCaptcha: count >= CAPTCHA_THRESHOLD
    };
}

/**
 * Catat percobaan login gagal pada semua key yang relevan.
 * @param {string|null} username
 * @param {string|null} clientId
 * @param {string} ip
 * @returns {{count: number, lockedUntil?: number, requireCaptcha: boolean}}
 */
function recordFailedAttempt(username, clientId, ip) {
    const keys = buildLockoutKeys(username, clientId, ip);
    let accountCount = 0;
    let accountLocked = false;

    for (const { key, type } of keys) {
        const config = LOCKOUT_CONFIG[type];
        const attempts = loginAttempts.get(key) || { count: 0, firstAttempt: Date.now() };
        attempts.count += 1;
        attempts.lastAttempt = Date.now();

        if (attempts.count >= config.maxAttempts && !attempts.lockedUntil) {
            attempts.lockedUntil = Date.now() + config.duration;
            let identifier = ip;
            if (type === 'account') {
                identifier = username;
            } else if (type === 'client') {
                identifier = '[client-id]';
            }

            logger.warn('Lockout triggered', {
                type,
                identifier,
                count: attempts.count,
                durationMin: config.duration / 60000
            });
        }

        loginAttempts.set(key, attempts);

        if (type === 'account') {
            accountCount = attempts.count;
            accountLocked = !!attempts.lockedUntil;
        }
    }

    return {
        count: accountCount,
        lockedUntil: accountLocked ? Date.now() + LOCKOUT_CONFIG.account.duration : undefined,
        requireCaptcha: accountCount >= CAPTCHA_THRESHOLD
    };
}

/**
 * Reset semua key lockout terkait setelah login berhasil.
 * @param {string|null} username
 * @param {string|null} clientId
 * @param {string} ip
 */
function resetLoginAttempts(username, clientId, ip) {
    const keys = buildLockoutKeys(username, clientId, ip);
    for (const { key } of keys) {
        loginAttempts.delete(key);
    }
}

/**
 * Verifikasi token hCaptcha via API hCaptcha.
 * Mengembalikan true jika valid, false jika gagal.
 * Jika HCAPTCHA_SECRET tidak dikonfigurasi, selalu return true (graceful fallback).
 * @param {string} token - Token dari widget hCaptcha di frontend
 * @returns {Promise<boolean>}
 */
async function verifyCaptchaToken(token) {
    if (!HCAPTCHA_SECRET) {
        logger.debug('hCaptcha secret not configured, skipping verification');
        return true;
    }
    if (!token) return false;

    try {
        const params = new URLSearchParams({
            secret: HCAPTCHA_SECRET,
            response: token
        });
        const resp = await fetch('https://api.hcaptcha.com/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });
        const data = await resp.json();
        return data.success === true;
    } catch (err) {
        logger.error('hCaptcha verification request failed', err);
        // Fail-open: jangan blokir login hanya karena hCaptcha API down
        return true;
    }
}

/**
 * Cleanup expired entries (run periodically)
 */
setInterval(() => {
    const now = Date.now();
    for (const [key, attempts] of loginAttempts.entries()) {
        if (!attempts.lockedUntil && now - attempts.lastAttempt > 3600000) {
            loginAttempts.delete(key);
        }
        if (attempts.lockedUntil && now >= attempts.lockedUntil) {
            loginAttempts.delete(key);
        }
    }
}, 60000);

// Constants
const ERROR_INVALID_CREDENTIALS = 'Username atau password salah';
const MSG_LOGIN_SUCCESS = 'Login berhasil';
const MSG_LOGOUT_SUCCESS = 'Logout berhasil';

/**
 * Fetch role-specific additional data for a user after successful authentication.
 * @param {Object} user - The authenticated user row from DB
 * @param {string} user.role - User role ('guru', 'siswa', 'admin')
 * @param {string} user.username - Username
 * @param {number} user.id - User ID
 * @returns {Promise<Object>} Additional data to merge into JWT payload
 */
async function enrichUserData(user) {
    if (user.role === 'guru') {
        const [guruData] = await db.execute(
            `SELECT g.*, m.nama_mapel 
             FROM guru g 
             LEFT JOIN mapel m ON g.mapel_id = m.id_mapel 
             WHERE g.username = ?`,
            [user.username]
        );
        if (guruData.length > 0) {
            return {
                guru_id: guruData[0].id_guru,
                nip: guruData[0].nip,
                mapel: guruData[0].nama_mapel || null
            };
        }
    } else if (user.role === 'siswa') {
        const [siswaData] = await db.execute(
            `SELECT s.*, k.nama_kelas 
             FROM siswa s 
             JOIN kelas k ON s.kelas_id = k.id_kelas 
             WHERE s.user_id = ?`,
            [user.id]
        );
        if (siswaData.length > 0) {
            return {
                siswa_id: siswaData[0].id_siswa,
                nis: siswaData[0].nis,
                kelas: siswaData[0].nama_kelas,
                kelas_id: siswaData[0].kelas_id
            };
        }
    }
    return {};
}

/**
 * Login user
 * POST /api/login
 */
export const login = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { username, password, captchaToken } = req.body;
    const startTime = Date.now();
    const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';
    const clientId = req.headers['x-client-id'] || null;
    
    log.info('Login attempt', { username, ip: clientIP, hasClientId: !!clientId });

    // Check multi-key lockout (per-akun, per-device, per-IP fallback)
    const lockoutCheck = checkLoginAttempts(username, clientId, clientIP);
    if (!lockoutCheck.allowed) {
        log.warn('Login blocked - lockout active', { 
            lockType: lockoutCheck.lockType,
            ip: clientIP, 
            attempts: lockoutCheck.count,
            remainingMinutes: lockoutCheck.remainingMinutes 
        });
        return sendRateLimitError(
            res,
            `Terlalu banyak percobaan login. Coba lagi dalam ${lockoutCheck.remainingMinutes} menit.`,
            lockoutCheck.remainingTime
        );
    }

    // Captcha verification gate (setelah CAPTCHA_THRESHOLD percobaan gagal per-akun)
    if (lockoutCheck.requireCaptcha) {
        const captchaValid = await verifyCaptchaToken(captchaToken);
        if (!captchaValid) {
            log.warn('Captcha verification failed', { username, ip: clientIP });
            return res.status(400).json({
                success: false,
                message: 'Verifikasi keamanan gagal. Silakan selesaikan captcha.',
                requireCaptcha: true,
                remainingAttempts: Math.max(0, LOCKOUT_CONFIG.account.maxAttempts - lockoutCheck.count)
            });
        }
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
        const [rows] = await db.execute(
            'SELECT id, id as id_user, username, password, nama, role, email, status, is_perwakilan FROM users WHERE username = ? AND status = "aktif" LIMIT 1',
            [username]
        );

        if (rows.length === 0) {
            const attempts = recordFailedAttempt(username, clientId, clientIP);
            log.warn('Login failed - user not found', { username, ip: clientIP });
            return res.status(401).json({
                success: false,
                message: ERROR_INVALID_CREDENTIALS,
                requireCaptcha: attempts.requireCaptcha,
                remainingAttempts: Math.max(0, LOCKOUT_CONFIG.account.maxAttempts - attempts.count)
            });
        }

        const user = rows[0];

        // Verify password with bcrypt
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            const attempts = recordFailedAttempt(username, clientId, clientIP);
            log.warn('Login failed - invalid password', { 
                username, 
                userId: user.id, 
                ip: clientIP,
                attemptCount: attempts.count 
            });
            
            // Check if this attempt triggered lockout
            if (attempts.lockedUntil) {
                return sendRateLimitError(
                    res,
                    `Terlalu banyak percobaan login. Akun terkunci selama ${Math.ceil(LOCKOUT_CONFIG.account.duration / 60000)} menit.`,
                    Math.ceil(LOCKOUT_CONFIG.account.duration / 1000)
                );
            }
            
            return res.status(401).json({
                success: false,
                message: ERROR_INVALID_CREDENTIALS,
                requireCaptcha: attempts.requireCaptcha,
                remainingAttempts: Math.max(0, LOCKOUT_CONFIG.account.maxAttempts - attempts.count)
            });
        }

        // SUCCESS - Reset login attempts for all keys
        resetLoginAttempts(username, clientId, clientIP);

        // Get additional user data based on role
        const additionalData = await enrichUserData(user);

        // Generate JWT token
        const tokenPayload = {
            id: user.id,
            username: user.username,
            nama: user.nama,
            role: user.role,
            is_perwakilan: Number(user.is_perwakilan) === 1,
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
            message: MSG_LOGIN_SUCCESS,
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
    
    return sendSuccessResponse(res, null, MSG_LOGOUT_SUCCESS);
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

