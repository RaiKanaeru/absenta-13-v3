import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getActiveKelas, getKelas, createKelas, updateKelas, deleteKelas } from '../controllers/kelasController.js';

const router = express.Router();

// Public endpoint (no auth required) - for dropdowns
router.get('/public', getActiveKelas);

// Admin routes
router.get('/', authenticateToken, requireRole(['admin']), getKelas);
router.post('/', authenticateToken, requireRole(['admin']), createKelas);
router.put('/:id', authenticateToken, requireRole(['admin']), updateKelas);
router.delete('/:id', authenticateToken, requireRole(['admin']), deleteKelas);

export default router;
