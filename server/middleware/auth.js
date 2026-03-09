import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { AppError, ERROR_CODES, sendErrorResponse } from '../utils/errorHandler.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('CRITICAL: JWT_ACCESS_SECRET or JWT_SECRET environment variable is required for security');
}

// Middleware to authenticate JWT token
export async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1] || req.cookies?.token;

    if (!token) {
        return sendErrorResponse(res, new AppError(ERROR_CODES.AUTH_UNAUTHORIZED, 'Token akses diperlukan'));
    }

    try {
        const user = jwt.verify(token, JWT_SECRET);
        
        // Check for session invalidation (password changes/logout all)
        if (globalThis.cacheSystem?.redis) {
            try {
                const validAfterStr = await globalThis.cacheSystem.redis.get(`user_token_valid_after:${user.id}`);
                if (validAfterStr) {
                    const validAfter = parseInt(validAfterStr, 10);
                    // iat is in seconds, validAfter should also be in seconds
                    if (user.iat < validAfter) {
                        return sendErrorResponse(res, new AppError(ERROR_CODES.AUTH_UNAUTHORIZED, 'Sesi telah berakhir atau password diubah'));
                    }
                }
            } catch (redisError) {
                // Fail-open: if Redis is down, allow access but log error
                if (globalThis.logger) {
                    globalThis.logger.error('Redis error in authenticateToken:', redisError);
                }
            }
        }

        req.user = user;
        next();
    } catch (err) {
        const errorCode = err.name === 'TokenExpiredError'
            ? ERROR_CODES.AUTH_TOKEN_EXPIRED
            : ERROR_CODES.AUTH_UNAUTHORIZED;
        return sendErrorResponse(res, new AppError(errorCode, 'Token tidak valid atau kadaluarsa'));
    }
}

// Role-based access control middleware
export function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return sendErrorResponse(res, new AppError(ERROR_CODES.AUTH_UNAUTHORIZED, 'Pengguna belum terautentikasi'));
        }
        if (!roles.includes(req.user.role)) {
            return sendErrorResponse(res, new AppError(ERROR_CODES.AUTH_FORBIDDEN, 'Anda tidak memiliki izin untuk akses ini'));
        }
        next();
    };
}
