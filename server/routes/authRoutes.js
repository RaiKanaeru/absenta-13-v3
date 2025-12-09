import express from 'express';
import { login, logout, verify } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/auth/login', login); // Compatibility alias
router.post('/logout', logout);
router.get('/verify', authenticateToken, verify);
router.get('/verify-token', authenticateToken, verify); // Compatibility alias

export default router;
