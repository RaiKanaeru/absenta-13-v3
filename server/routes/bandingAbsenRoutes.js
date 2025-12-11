/**
 * Banding Absen Routes
 * Attendance appeal report endpoints
 * Migrated from server_modern.js
 */

import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import * as bandingAbsenController from '../controllers/bandingAbsenController.js';

const router = Router();

// Banding Absen Report - Admin only
router.get('/banding-absen-report', authenticateToken, requireRole(['admin']), bandingAbsenController.getBandingAbsenReport);
router.get('/download-banding-absen', authenticateToken, requireRole(['admin']), bandingAbsenController.downloadBandingAbsen);

// Compatibility endpoints for schedule management
router.get('/subjects', authenticateToken, requireRole(['admin']), bandingAbsenController.getSubjects);
router.get('/classes', authenticateToken, requireRole(['admin']), bandingAbsenController.getClasses);

export default router;
