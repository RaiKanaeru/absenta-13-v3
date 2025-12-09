import express from 'express';
import { getGuru, createGuru, updateGuru, deleteGuru } from '../controllers/guruController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, requireRole(['admin']), getGuru);
router.post('/', authenticateToken, requireRole(['admin']), createGuru);
router.put('/:id', authenticateToken, requireRole(['admin']), updateGuru);
router.delete('/:id', authenticateToken, requireRole(['admin']), deleteGuru);

export default router;
