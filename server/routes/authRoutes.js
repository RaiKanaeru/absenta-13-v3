import express from 'express';
import { login, logout, logoutAll, verify, refresh } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';
import { createAuthActionLimiter, getAuthRateLimitConfig } from '../middleware/authActionRateLimit.js';

const router = express.Router();
const authRateLimitConfig = getAuthRateLimitConfig();
const refreshLimiter = createAuthActionLimiter({
    windowMs: authRateLimitConfig.windowMs,
    max: authRateLimitConfig.refreshMax,
    message: 'Terlalu banyak permintaan refresh token. Silakan coba lagi nanti.',
});
const logoutLimiter = createAuthActionLimiter({
    windowMs: authRateLimitConfig.windowMs,
    max: authRateLimitConfig.logoutMax,
    message: 'Terlalu banyak permintaan logout. Silakan coba lagi nanti.',
});
const logoutAllLimiter = createAuthActionLimiter({
    windowMs: authRateLimitConfig.windowMs,
    max: authRateLimitConfig.logoutMax,
    message: 'Terlalu banyak permintaan logout dari semua perangkat. Silakan coba lagi nanti.',
});

router.post('/login', login);
router.post('/auth/login', login); // Compatibility alias
router.post('/logout', logoutLimiter, logout);
router.post('/logout-all', authenticateToken, logoutAllLimiter, logoutAll);
router.get('/verify', authenticateToken, verify);
router.get('/verify-token', authenticateToken, verify); // Compatibility alias

router.post('/refresh', refreshLimiter, refresh);
export default router;
