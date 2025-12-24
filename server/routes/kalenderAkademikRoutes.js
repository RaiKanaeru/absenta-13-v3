/**
 * Kalender Akademik Routes
 * API endpoints for managing academic calendar effective days
 */

import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
    getKalenderAkademik,
    getHariEfektif,
    upsertKalenderAkademik,
    updateKalenderAkademik,
    deleteKalenderAkademik,
    seedKalenderAkademik
} from '../controllers/kalenderAkademikController.js';

const router = express.Router();

/**
 * @route GET /api/admin/kalender-akademik
 * @desc Get all kalender akademik entries (optional filter by tahun_pelajaran)
 * @access Admin
 */
router.get('/', authenticateToken, requireRole(['admin']), getKalenderAkademik);

/**
 * @route GET /api/admin/kalender-akademik/hari-efektif
 * @desc Get effective days for a specific month
 * @access Admin, Guru
 */
router.get('/hari-efektif', authenticateToken, requireRole(['admin', 'guru']), getHariEfektif);

/**
 * @route POST /api/admin/kalender-akademik
 * @desc Create or update kalender akademik entry
 * @access Admin
 */
router.post('/', authenticateToken, requireRole(['admin']), upsertKalenderAkademik);

/**
 * @route PUT /api/admin/kalender-akademik/:id
 * @desc Update kalender akademik by ID
 * @access Admin
 */
router.put('/:id', authenticateToken, requireRole(['admin']), updateKalenderAkademik);

/**
 * @route DELETE /api/admin/kalender-akademik/:id
 * @desc Delete kalender akademik entry
 * @access Admin
 */
router.delete('/:id', authenticateToken, requireRole(['admin']), deleteKalenderAkademik);

/**
 * @route POST /api/admin/kalender-akademik/seed
 * @desc Seed default kalender for a tahun pelajaran
 * @access Admin
 */
router.post('/seed', authenticateToken, requireRole(['admin']), seedKalenderAkademik);

export default router;
