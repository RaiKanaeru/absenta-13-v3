/**
 * Download Routes
 * Secure file download endpoints
 */

import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { downloadFile } from '../controllers/exportController.js';

const router = Router();

router.get('/:filename', authenticateToken, requireRole(['guru', 'admin']), downloadFile);

export default router;
