/**
 * Export Routes
 * Handles all Excel/report export endpoints
 * Refactored from server_modern.js
 * 
 * MIGRATION STATUS:
 * ✅ MIGRATED (7 endpoints) - routed to exportController
 * ⏳ PENDING (10 endpoints) - still in server_modern.js
 */

import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import * as exportController from '../controllers/exportController.js';

const router = Router();

// ================================================
// FULLY MIGRATED EXPORTS - Using Controller
// ================================================

// General attendance export
router.get('/absensi', authenticateToken, requireRole(['admin']), exportController.exportAbsensi);

// Teacher list export
router.get('/teacher-list', authenticateToken, requireRole(['admin']), exportController.exportTeacherList);

// Student summary export
router.get('/student-summary', authenticateToken, requireRole(['admin']), exportController.exportStudentSummary);

// Teacher summary export
router.get('/teacher-summary', authenticateToken, requireRole(['admin']), exportController.exportTeacherSummary);

// Banding absen export
router.get('/banding-absen', authenticateToken, requireRole(['admin']), exportController.exportBandingAbsen);

// Rekap ketidakhadiran guru export
router.get('/rekap-ketidakhadiran-guru', authenticateToken, requireRole(['admin']), exportController.exportRekapKetidakhadiranGuru);

// Riwayat banding absen export
router.get('/riwayat-banding-absen', authenticateToken, requireRole(['guru', 'admin']), exportController.exportRiwayatBandingAbsen);

// Presensi siswa SMKN13 format
router.get('/presensi-siswa-smkn13', authenticateToken, requireRole(['guru', 'admin']), exportController.exportPresensiSiswaSmkn13);

// Rekap ketidakhadiran export
router.get('/rekap-ketidakhadiran', authenticateToken, requireRole(['guru', 'admin']), exportController.exportRekapKetidakhadiran);

// Ringkasan kehadiran siswa SMKN13
router.get('/ringkasan-kehadiran-siswa-smkn13', authenticateToken, requireRole(['guru', 'admin']), exportController.exportRingkasanKehadiranSiswaSmkn13);

// Rekap ketidakhadiran guru SMKN13
router.get('/rekap-ketidakhadiran-guru-smkn13', authenticateToken, requireRole(['admin']), exportController.exportRekapKetidakhadiranGuruSmkn13);

// Rekap ketidakhadiran siswa export
router.get('/rekap-ketidakhadiran-siswa', authenticateToken, requireRole(['admin']), exportController.exportRekapKetidakhadiranSiswa);

// Presensi siswa export
router.get('/presensi-siswa', authenticateToken, requireRole(['admin']), exportController.exportPresensiSiswa);

// ================================================
// PENDING MIGRATION - Admin routes in server_modern.js
// ================================================
// - /admin/attendance
// - /admin/jadwal-matrix
// - /admin/jadwal-grid
// - /admin/jadwal-print

export default router;
