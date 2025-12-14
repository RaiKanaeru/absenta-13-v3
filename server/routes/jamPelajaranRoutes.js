/**
 * Jam Pelajaran Routes
 * Routes for dynamic jam pelajaran per kelas configuration
 */

import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
    getJamPelajaranByKelas,
    getAllJamPelajaran,
    upsertJamPelajaran,
    deleteJamPelajaranByKelas,
    copyJamPelajaran,
    getDefaultJamPelajaran
} from '../controllers/jamPelajaranController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(requireRole(['admin']));

// Get default template
router.get('/default', getDefaultJamPelajaran);

// Get all jam pelajaran grouped by kelas
router.get('/', getAllJamPelajaran);

// Copy jam pelajaran from one kelas to others
router.post('/copy', copyJamPelajaran);

// Get jam pelajaran for specific kelas
router.get('/:kelasId', getJamPelajaranByKelas);

// Create/Update jam pelajaran for kelas (bulk upsert)
router.post('/:kelasId', upsertJamPelajaran);

// Delete all jam pelajaran for kelas (reset)
router.delete('/:kelasId', deleteJamPelajaranByKelas);

export default router;
