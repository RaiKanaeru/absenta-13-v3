/**
 * @fileoverview Auth Controller - Modul Autentikasi ABSENTA
 * @module controllers/authController
 * 
 * Menangani proses autentikasi pengguna:
 * - Login dengan username/password → issues Access Token (15m) + Refresh Token (7d)
 * - Refresh token rotation via POST /api/refresh
 * - Logout dengan revokasi refresh token dari Redis
 * - Verifikasi token JWT
 * - Rate limiting multi-key Redis-backed (per-akun, per-device, per-IP fallback)
 * - Verifikasi hCaptcha server-side
 * 
 * @requires bcrypt - Untuk hashing password
 * @requires jsonwebtoken - Untuk generate/verify JWT
 * @requires crypto - Untuk hashing refresh token (built-in Node.js)
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { AppError, ERROR_CODES, sendErrorResponse, sendRateLimitError, sendValidationError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';
import db from '../config/db.js';

dotenv.config();

/** Secret key untuk signing JWT token - WAJIB diset via environment variable */
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    process.stderr.write('FATAL: JWT_SECRET environment variable is not set\n');
    process.exit(1);
}

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';
const REFRESH_TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

const logger = createLogger('Auth');

// ============================================================
// RATE LIMITING - Multi-Key Brute Force Protection
// ============================================================
// Dirancang untuk lingkungan sekolah: banyak siswa 1 jaringan WiFi.
// Lockout utama per-akun (username), BUKAN per-IP,
// agar 1 siswa salah password tidak memblokir seluruh sekolah.
// Redis-backed untuk persistence across restarts; graceful fallback
// ke in-memory Map jika Redis tidak tersedia.
// ============================================================

/** 
 * Fallback in-memory Map untuk rate limiting ketika Redis tidak tersedia.
 * Key format: "account:<username>" | "client:<clientId>" | "ip:<address>"
 * @type {Map<string, {count: number, firstAttempt: number, lastAttempt: number, lockedUntil?: number}>}
 */
const fallbackAttempts = new Map();

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
 * Cek apakah ada key yang sedang lockout (Redis-backed, async).
 * Juga mengembalikan info captcha requirement berdasarkan jumlah gagal per-akun.
 * @param {string|null} username
 * @param {string|null} clientId
 * @param {string} ip
 * @returns {Promise<{allowed: boolean, count: number, remainingTime?: number, remainingMinutes?: number, lockType?: string, requireCaptcha?: boolean}>}
 */
async function checkLoginAttempts(username, clientId, ip) {
    const redis = globalThis.cacheSystem?.redis;
    const useRedis = globalThis.cacheSystem?.isConnected && redis;
    const keys = buildLockoutKeys(username, clientId, ip);

    for (const { key, type } of keys) {
        const redisKey = `lockout:${type}:${key.split(':')[1]}`;
        let attempts;

        if (useRedis) {
            try {
                const data = await redis.get(redisKey);
                if (!data) continue;
                attempts = JSON.parse(data);
            } catch { continue; }
        } else {
            attempts = fallbackAttempts.get(key);
            if (!attempts) continue;
        }

        // Lockout sudah expired → hapus
        if (attempts.lockedUntil && Date.now() >= attempts.lockedUntil) {
            if (useRedis) { try { await redis.del(redisKey); } catch (e) { logger.debug('Redis lockout cleanup failed', { key: redisKey, error: e.message }); } }
            else { fallbackAttempts.delete(key); }
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
    const redisAccountKey = `lockout:account:${(username || '').toLowerCase()}`;
    let count = 0;

    if (useRedis) {
        try {
            const data = await redis.get(redisAccountKey);
            if (data) count = JSON.parse(data).count || 0;
        } catch (e) { logger.debug('Redis attempt count fetch failed', { key: redisAccountKey, error: e.message }); }
    } else {
        count = fallbackAttempts.get(accountKey)?.count || 0;
    }

    return {
        allowed: true,
        count,
        requireCaptcha: count >= CAPTCHA_THRESHOLD
    };
}

/**
 * Catat percobaan login gagal pada semua key yang relevan (Redis-backed, async).
 * @param {string|null} username
 * @param {string|null} clientId
 * @param {string} ip
 * @returns {Promise<{count: number, lockedUntil?: number, requireCaptcha: boolean}>}
 */
async function recordFailedAttempt(username, clientId, ip) {
    const redis = globalThis.cacheSystem?.redis;
    const useRedis = globalThis.cacheSystem?.isConnected && redis;
    const keys = buildLockoutKeys(username, clientId, ip);
    let accountCount = 0;
    let accountLocked = false;

    for (const { key, type } of keys) {
        const config = LOCKOUT_CONFIG[type];
        const redisKey = `lockout:${type}:${key.split(':')[1]}`;

        if (useRedis) {
            try {
                const data = await redis.get(redisKey);
                const attempts = data ? JSON.parse(data) : { count: 0, firstAttempt: Date.now() };
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

                const ttlSeconds = Math.ceil(config.duration / 1000);
                await redis.setex(redisKey, ttlSeconds, JSON.stringify(attempts));

                if (type === 'account') {
                    accountCount = attempts.count;
                    accountLocked = !!attempts.lockedUntil;
                }
            } catch (err) {
                logger.warn('Redis recordFailedAttempt error, falling back to in-memory', { error: err.message });
                // Fallback to in-memory for this key
                const attempts = fallbackAttempts.get(key) || { count: 0, firstAttempt: Date.now() };
                attempts.count += 1;
                attempts.lastAttempt = Date.now();
                if (attempts.count >= config.maxAttempts && !attempts.lockedUntil) {
                    attempts.lockedUntil = Date.now() + config.duration;
                }
                fallbackAttempts.set(key, attempts);
                if (type === 'account') {
                    accountCount = attempts.count;
                    accountLocked = !!attempts.lockedUntil;
                }
            }
        } else {
            const attempts = fallbackAttempts.get(key) || { count: 0, firstAttempt: Date.now() };
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

            fallbackAttempts.set(key, attempts);

            if (type === 'account') {
                accountCount = attempts.count;
                accountLocked = !!attempts.lockedUntil;
            }
        }
    }

    return {
        count: accountCount,
        lockedUntil: accountLocked ? Date.now() + LOCKOUT_CONFIG.account.duration : undefined,
        requireCaptcha: accountCount >= CAPTCHA_THRESHOLD
    };
}

/**
 * Reset semua key lockout terkait setelah login berhasil (Redis-backed, async).
 * @param {string|null} username
 * @param {string|null} clientId
 * @param {string} ip
 * @returns {Promise<void>}
 */
async function resetLoginAttempts(username, clientId, ip) {
    const redis = globalThis.cacheSystem?.redis;
    const useRedis = globalThis.cacheSystem?.isConnected && redis;
    const keys = buildLockoutKeys(username, clientId, ip);

    for (const { key, type } of keys) {
        const redisKey = `lockout:${type}:${key.split(':')[1]}`;
        if (useRedis) {
            try {
                await redis.del(redisKey);
            } catch (err) {
                logger.warn('Redis resetLoginAttempts error', { error: err.message });
                fallbackAttempts.delete(key);
            }
        } else {
            fallbackAttempts.delete(key);
        }
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
        logger.warn('hCaptcha secret not configured — captcha verification disabled. Set HCAPTCHA_SECRET in production.');
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
            `SELECT g.id_guru, g.nip, m.nama_mapel
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
            `SELECT s.id_siswa, s.nis, s.kelas_id, k.nama_kelas
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
 * Login user — issues Access Token (15m) + Refresh Token (7d, Redis-backed)
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
    const lockoutCheck = await checkLoginAttempts(username, clientId, clientIP);
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
            return sendErrorResponse(
                res,
                new AppError(ERROR_CODES.VALIDATION_FAILED, 'Verifikasi keamanan gagal. Silakan selesaikan captcha.'),
                null, null,
                { requireCaptcha: true, remainingAttempts: Math.max(0, LOCKOUT_CONFIG.account.maxAttempts - lockoutCheck.count) }
            );
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
            const attempts = await recordFailedAttempt(username, clientId, clientIP);
            log.warn('Login failed - user not found', { username, ip: clientIP });
            return sendErrorResponse(
                res,
                new AppError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, ERROR_INVALID_CREDENTIALS),
                null, null,
                { requireCaptcha: attempts.requireCaptcha, remainingAttempts: Math.max(0, LOCKOUT_CONFIG.account.maxAttempts - attempts.count) }
            );
        }

        const user = rows[0];

        // Verify password with bcrypt
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            const attempts = await recordFailedAttempt(username, clientId, clientIP);
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
            
            return sendErrorResponse(
                res,
                new AppError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, ERROR_INVALID_CREDENTIALS),
                null, null,
                { requireCaptcha: attempts.requireCaptcha, remainingAttempts: Math.max(0, LOCKOUT_CONFIG.account.maxAttempts - attempts.count) }
            );
        }

        // SUCCESS - Reset login attempts for all keys
        await resetLoginAttempts(username, clientId, clientIP);

        // Get additional user data based on role
        const additionalData = await enrichUserData(user);

        // Generate JWT tokens
        const tokenPayload = {
            id: user.id,
            username: user.username,
            nama: user.nama,
            role: user.role,
            is_perwakilan: Number(user.is_perwakilan) === 1,
            ...additionalData
        };

        // Generate Access Token (short-lived)
        const accessToken = jwt.sign(tokenPayload, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

        // Generate Refresh Token (long-lived)
        const refreshPayload = { id: user.id, username: user.username, type: 'refresh' };
        const refreshToken = jwt.sign(refreshPayload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

        // Store refresh token hash in Redis for revocation capability
        const rtHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const cacheSystem = globalThis.cacheSystem;
        if (cacheSystem?.isConnected) {
            try {
                await cacheSystem.redis.setex(`rt:${rtHash}`, 7 * 24 * 3600, JSON.stringify({
                    userId: user.id,
                    username: user.username,
                    createdAt: Date.now()
                }));
            } catch (err) {
                logger.warn('Failed to store refresh token in Redis', { error: err.message });
            }
        }

        // Set cookies
        res.cookie('token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000 // 15 minutes
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
            path: '/' // accessible from all paths
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
            token: accessToken  // Keep 'token' key for frontend backward compat
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
 * Logout user — revokes refresh token from Redis
 * POST /api/logout
 */
export const logout = async (req, res) => {
    const log = logger.withRequest(req, res);
    
    // Revoke refresh token from Redis
    const refreshTokenValue = req.cookies?.refreshToken;
    if (refreshTokenValue) {
        const cacheSystem = globalThis.cacheSystem;
        if (cacheSystem?.isConnected) {
            try {
                const rtHash = crypto.createHash('sha256').update(refreshTokenValue).digest('hex');
                await cacheSystem.redis.del(`rt:${rtHash}`);
            } catch (err) {
                logger.warn('Failed to revoke refresh token from Redis', { error: err.message });
            }
        }
    }
    
    res.clearCookie('token');
    res.clearCookie('refreshToken', { path: '/' });
    log.info('User logged out', { userId: req.user?.id, username: req.user?.username });
    
    return sendSuccessResponse(res, null, MSG_LOGOUT_SUCCESS);
};

/**
 * Refresh access token using refresh token
 * POST /api/refresh
 */
export const refresh = async (req, res) => {
    const log = logger.withRequest(req, res);
    const refreshTokenValue = req.cookies?.refreshToken;

    if (!refreshTokenValue) {
        log.warn('Refresh attempt without refresh token');
        return sendErrorResponse(res, new AppError(ERROR_CODES.AUTH_UNAUTHORIZED, 'Refresh token diperlukan'));
    }

    try {
        // Verify refresh token signature
        const decoded = jwt.verify(refreshTokenValue, JWT_REFRESH_SECRET);
        
        if (decoded.type !== 'refresh') {
            return sendErrorResponse(res, new AppError(ERROR_CODES.AUTH_UNAUTHORIZED, 'Token tidak valid'));
        }

        // Check if refresh token hash exists in Redis (revocation check)
        const rtHash = crypto.createHash('sha256').update(refreshTokenValue).digest('hex');
        const cacheSystem = globalThis.cacheSystem;
        
        if (cacheSystem?.isConnected) {
            try {
                const stored = await cacheSystem.redis.get(`rt:${rtHash}`);
                if (!stored) {
                    log.warn('Refresh token not found in Redis (possibly revoked)', { userId: decoded.id });
                    return sendErrorResponse(res, new AppError(ERROR_CODES.AUTH_UNAUTHORIZED, 'Refresh token telah dicabut'));
                }
            } catch (err) {
                logger.warn('Redis lookup failed during refresh, allowing refresh', { error: err.message });
                // Fail-open: allow refresh if Redis is temporarily down
            }
        }

        // Fetch fresh user data from database
        const [rows] = await db.execute(
            'SELECT id, id as id_user, username, password, nama, role, email, status, is_perwakilan FROM users WHERE id = ? AND status = "aktif" LIMIT 1',
            [decoded.id]
        );

        if (rows.length === 0) {
            log.warn('User not found during token refresh', { userId: decoded.id });
            return sendErrorResponse(res, new AppError(ERROR_CODES.AUTH_UNAUTHORIZED, 'Pengguna tidak ditemukan'));
        }

        const user = rows[0];
        const additionalData = await enrichUserData(user);

        // Build fresh token payload
        const tokenPayload = {
            id: user.id,
            username: user.username,
            nama: user.nama,
            role: user.role,
            is_perwakilan: Number(user.is_perwakilan) === 1,
            ...additionalData
        };

        // Generate new access token
        const newAccessToken = jwt.sign(tokenPayload, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

        // Rotate refresh token: delete old, create new
        const newRefreshPayload = { id: user.id, username: user.username, type: 'refresh' };
        const newRefreshToken = jwt.sign(newRefreshPayload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
        const newRtHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

        if (cacheSystem?.isConnected) {
            try {
                const pipeline = cacheSystem.redis.pipeline();
                pipeline.del(`rt:${rtHash}`);          // Delete old
                pipeline.setex(`rt:${newRtHash}`, 7 * 24 * 3600, JSON.stringify({
                    userId: user.id,
                    username: user.username,
                    createdAt: Date.now()
                }));
                await pipeline.exec();
            } catch (err) {
                logger.warn('Redis pipeline failed during token rotation', { error: err.message });
            }
        }

        // Set new cookies
        res.cookie('token', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000
        });

        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
            path: '/'
        });

        log.info('Token refreshed successfully', { userId: user.id });

        res.json({
            success: true,
            token: newAccessToken,
            user: tokenPayload
        });

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            log.warn('Refresh token expired');
            res.clearCookie('refreshToken');
            return sendErrorResponse(res, new AppError(ERROR_CODES.AUTH_TOKEN_EXPIRED, 'Refresh token telah kadaluarsa. Silakan login ulang'));
        }
        if (error.name === 'JsonWebTokenError') {
            log.warn('Invalid refresh token');
            return sendErrorResponse(res, new AppError(ERROR_CODES.AUTH_UNAUTHORIZED, 'Refresh token tidak valid'));
        }
        log.dbError('refresh', error);
        return sendErrorResponse(res, error, 'Terjadi kesalahan saat memperbarui token', 500);
    }
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
