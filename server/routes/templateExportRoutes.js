/**
 * Template Export Routes
 * Routes for Excel export using school templates
 */

import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
    downloadRekapKelasGasal,
    downloadRekapGuruTahunan,
    downloadRekapGuruMingguan,
    downloadJadwalPelajaran,
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

/**
 * @route   GET /api/admin/export/rekap-guru-mingguan
 * @desc    Export rekap jadwal guru mingguan
 * @access  Admin
 */
router.get('/rekap-guru-mingguan', downloadRekapGuruMingguan);

/**
 * @route   GET /api/admin/export/jadwal-pelajaran
 * @desc    Export jadwal pelajaran dengan warna per mapel
 * @access  Admin
 */
router.get('/jadwal-pelajaran', downloadJadwalPelajaran);

// NOTE: jadwal-matrix and jadwal-grid routes moved back to exportRoutes.js
// They use distinct handlers (exportJadwalMatrix, exportJadwalGrid) for different formats
// router.get('/jadwal-matrix', downloadJadwalPelajaran);
// router.get('/jadwal-grid', downloadJadwalPelajaran);

export default router;


