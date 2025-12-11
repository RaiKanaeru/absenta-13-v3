/**
 * Admin Dashboard Routes
 * Teacher and student management endpoints
 * Migrated from server_modern.js
 */

import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import * as adminDashboardController from '../controllers/adminDashboardController.js';

const router = Router();

// Teacher Account CRUD - Admin only
router.get('/teachers', authenticateToken, requireRole(['admin']), adminDashboardController.getTeachers);
router.post('/teachers', authenticateToken, requireRole(['admin']), adminDashboardController.addTeacher);
router.put('/teachers/:id', authenticateToken, requireRole(['admin']), adminDashboardController.updateTeacher);
router.delete('/teachers/:id', authenticateToken, requireRole(['admin']), adminDashboardController.deleteTeacher);

export default router;
