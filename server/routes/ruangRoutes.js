/**
 * Ruang Routes
 * Room/classroom CRUD endpoints
 * Migrated from server_modern.js
 */

import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import * as ruangController from '../controllers/ruangController.js';

const router = Router();

// Ruang CRUD - Admin only
router.get('/', authenticateToken, requireRole(['admin']), ruangController.getRuang);
router.get('/:id', authenticateToken, requireRole(['admin']), ruangController.getRuangById);
router.post('/', authenticateToken, requireRole(['admin']), ruangController.createRuang);
router.put('/:id', authenticateToken, requireRole(['admin']), ruangController.updateRuang);
router.delete('/:id', authenticateToken, requireRole(['admin']), ruangController.deleteRuang);

export default router;
