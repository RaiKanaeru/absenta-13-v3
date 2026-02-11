import express from 'express';
import { getAuditLogs, getAuditLogFilters } from '../controllers/auditLogController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Semua rute di sini memerlukan login dan role admin
router.use(authenticateToken, requireRole(['admin']));

router.get('/', getAuditLogs);
router.get('/filters', getAuditLogFilters);

export default router;
