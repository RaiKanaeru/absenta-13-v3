/**
 * Banding Absen Siswa Guru Routes
 * Handles attendance appeal endpoints for students and teachers
 * 
 * @requires authenticateToken - JWT authentication middleware
 * @requires requireRole - Role-based access control
 */

import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
    getSiswaBandingAbsen,
    submitSiswaBandingAbsen,
    getDaftarSiswa,
    getGuruBandingAbsen,
    respondBandingAbsen,
    getGuruBandingAbsenHistory
} from '../controllers/bandingAbsenSiswaGuruController.js';

const router = express.Router();

// ===========================
// Siswa Endpoints
// ===========================

// Get banding absen history for siswa
router.get('/siswa/:siswaId/banding-absen', authenticateToken, requireRole(['siswa']), getSiswaBandingAbsen);

// Submit banding absen (individual)
router.post('/siswa/:siswaId/banding-absen', authenticateToken, requireRole(['siswa']), submitSiswaBandingAbsen);

// Get daftar siswa for banding absen
router.get('/siswa/:siswaId/daftar-siswa', authenticateToken, requireRole(['siswa']), getDaftarSiswa);


// ===========================
// Guru Endpoints
// ===========================

// Get banding absen for teacher to process
router.get('/guru/:guruId/banding-absen', authenticateToken, requireRole(['guru']), getGuruBandingAbsen);

// Get banding absen history (report)
router.get('/guru/banding-absen-history', authenticateToken, requireRole(['guru', 'admin']), getGuruBandingAbsenHistory);

// Respond to banding absen (approve/reject)
// Note: This route is strictly /api/banding-absen/... in original server_modern.js
// We will mount this router at /api so we need to include /banding-absen prefix here for this specific route
// or rely on how we mount it in server.js. 
// If we mount at /api, then the path here should be /banding-absen/:bandingId/respond
router.put('/banding-absen/:bandingId/respond', authenticateToken, requireRole(['guru']), respondBandingAbsen);

export default router;
