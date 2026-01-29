/**
 * Attendance Settings Routes
 * Admin routes for managing attendance configuration
 */

import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import * as attendanceSettingsController from '../controllers/attendanceSettingsController.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireRole(['admin']));

// GET /api/admin/attendance-settings - Get all settings
router.get('/', attendanceSettingsController.getAttendanceSettings);

// GET /api/admin/attendance-settings/:key - Get single setting
router.get('/:key', attendanceSettingsController.getSettingByKey);

// PUT /api/admin/attendance-settings - Bulk update
router.put('/', attendanceSettingsController.updateMultipleSettings);

// PUT /api/admin/attendance-settings/:key - Update single setting
router.put('/:key', attendanceSettingsController.updateSetting);

export default router;
