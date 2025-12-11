import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getSiswa, createSiswa, updateSiswa, deleteSiswa, updateProfile, changePassword } from '../controllers/siswaController.js';

const router = express.Router();

// Admin CRUD routes (middleware applied manually to allow different roles for profile routes)
router.get('/', authenticateToken, requireRole(['admin']), getSiswa);
router.post('/', authenticateToken, requireRole(['admin']), createSiswa);
router.put('/:id', authenticateToken, requireRole(['admin']), updateSiswa);
router.delete('/:id', authenticateToken, requireRole(['admin']), deleteSiswa);

// Self-service profile routes (for /api/siswa/)
router.put('/update-profile', authenticateToken, requireRole(['siswa']), updateProfile);
router.put('/change-password', authenticateToken, requireRole(['siswa']), changePassword);

export default router;
