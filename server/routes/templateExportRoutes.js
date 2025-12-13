/**
 * Template Export Routes
 * Routes for Excel export using school templates
 */

import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
    downloadRekapKelasGasal,
    downloadRekapGuruTahunan,
    getExportTemplates
} from '../controllers/templateExportController.js';

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole(['admin']));

// ================================================
// TEMPLATE EXPORT ENDPOINTS
// ================================================

/**
 * @route   GET /api/admin/export/templates
 * @desc    Get list of available export templates
 * @access  Admin
 */
router.get('/templates', getExportTemplates);

/**
 * @route   GET /api/admin/export/rekap-kelas-gasal
 * @desc    Export rekap ketidakhadiran kelas semester gasal
 * @access  Admin
 * @query   kelas_id (required) - ID kelas
 * @query   tahun_ajaran (optional) - Tahun ajaran, default: 2025-2026
 */
router.get('/rekap-kelas-gasal', downloadRekapKelasGasal);

/**
 * @route   GET /api/admin/export/rekap-guru-tahunan
 * @desc    Export rekap ketidakhadiran guru tahunan
 * @access  Admin
 * @query   tahun_ajaran (optional) - Tahun ajaran, default: 2025-2026
 */
router.get('/rekap-guru-tahunan', downloadRekapGuruTahunan);

export default router;
