import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { AppError, ERROR_CODES, sendErrorResponse } from '../utils/errorHandler.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('CRITICAL: JWT_SECRET environment variable is required for security');
}

// Middleware to authenticate JWT token
export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1] || req.cookies?.token;

    if (!token) {
        return sendErrorResponse(res, new AppError(ERROR_CODES.AUTH_UNAUTHORIZED, 'Token akses diperlukan'));
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            const errorCode = err.name === 'TokenExpiredError'
                ? ERROR_CODES.AUTH_TOKEN_EXPIRED
                : ERROR_CODES.AUTH_UNAUTHORIZED;
            return sendErrorResponse(res, new AppError(errorCode, 'Token tidak valid atau kadaluarsa'));
        }

        req.user = user;
        next();
    });
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
