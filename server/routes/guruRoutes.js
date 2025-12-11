import express from 'express';
import { getGuru, createGuru, updateGuru, deleteGuru, updateProfile, changePassword } from '../controllers/guruController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Admin CRUD routes (for /api/admin/guru)
router.get('/', authenticateToken, requireRole(['admin']), getGuru);
router.post('/', authenticateToken, requireRole(['admin']), createGuru);
router.put('/:id', authenticateToken, requireRole(['admin']), updateGuru);
router.delete('/:id', authenticateToken, requireRole(['admin']), deleteGuru);

// Self-service profile routes (for /api/guru/)
router.put('/update-profile', authenticateToken, requireRole(['guru']), updateProfile);
router.put('/change-password', authenticateToken, requireRole(['guru']), changePassword);

export default router;
