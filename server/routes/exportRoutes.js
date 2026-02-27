/**
 * Export Routes
 * Handles all Excel/report export endpoints
 * Refactored from server_modern.js
 * 
 * MIGRATION STATUS:
 * MIGRATED (7 endpoints) - routed to exportController
 * PENDING (10 endpoints) - still in server_modern.js
 */

import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { exportRateLimit } from '../middleware/exportRateLimit.js';
import { exportPressureGuard } from '../middleware/exportPressureGuard.js';
import * as exportController from '../controllers/exportController.js';

const router = Router();

// Export rate limiter: max 5 exports per 60 seconds per user
const limiter = exportRateLimit({ windowMs: 60_000, maxRequests: 5 });

// ================================================
// FULLY MIGRATED EXPORTS - Using Controller
// ================================================

// General attendance export
router.get('/absensi', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, exportController.exportAbsensi);

// Teacher list export
router.get('/teacher-list', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, exportController.exportTeacherList);

// Student summary export
router.get('/student-summary', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, exportController.exportStudentSummary);

// Teacher summary export
router.get('/teacher-summary', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, exportController.exportTeacherSummary);

// Banding absen export
router.get('/banding-absen', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, exportController.exportBandingAbsen);

// Rekap ketidakhadiran guru export
router.get('/rekap-ketidakhadiran-guru', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, exportController.exportRekapKetidakhadiranGuru);

// Riwayat banding absen export
router.get('/riwayat-banding-absen', authenticateToken, requireRole(['guru', 'admin']), limiter, exportPressureGuard, exportController.exportRiwayatBandingAbsen);

// Presensi siswa SMKN13 format
router.get('/presensi-siswa-smkn13', authenticateToken, requireRole(['guru', 'admin']), limiter, exportPressureGuard, exportController.exportPresensiSiswaSmkn13);

// Rekap ketidakhadiran export
router.get('/rekap-ketidakhadiran', authenticateToken, requireRole(['guru', 'admin']), limiter, exportPressureGuard, exportController.exportRekapKetidakhadiran);

// Ringkasan kehadiran siswa SMKN13
router.get('/ringkasan-kehadiran-siswa-smkn13', authenticateToken, requireRole(['guru', 'admin']), limiter, exportPressureGuard, exportController.exportRingkasanKehadiranSiswaSmkn13);

// Rekap ketidakhadiran guru SMKN13
router.get('/rekap-ketidakhadiran-guru-smkn13', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, exportController.exportRekapKetidakhadiranGuruSmkn13);

// Rekap ketidakhadiran siswa export
router.get('/rekap-ketidakhadiran-siswa', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, exportController.exportRekapKetidakhadiranSiswa);

// Presensi siswa export
router.get('/presensi-siswa', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, exportController.exportPresensiSiswa);

// ================================================
// ADMIN EXPORT ROUTES (mounted at /api/admin/export)
// ================================================
router.get('/attendance', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, exportController.exportAdminAttendance);
// Jadwal Matrix and Grid exports - uses distinct handlers for different formats
router.get('/jadwal-matrix', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, exportController.exportJadwalMatrix);
router.get('/jadwal-grid', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, exportController.exportJadwalGrid);
router.get('/jadwal-print', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, exportController.exportJadwalPrint);
router.get('/rekap-jadwal-guru', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, exportController.exportRekapJadwalGuru);

// ================================================
// TEMPLATE-BASED EXPORTS (per guidelines)
// Load .xlsx template -> Fill data -> Preserve formulas
// ================================================
router.get('/templates', authenticateToken, requireRole(['admin']), exportController.listExportTemplates);
router.get('/rekap-ketidakhadiran-guru-template', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, exportController.exportRekapKetidakhadiranGuruTemplate);
router.get('/rekap-ketidakhadiran-kelas-template', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, exportController.exportRekapKetidakhadiranKelasTemplate);
router.get('/checklist-jadwal', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, exportController.exportScheduleExcel);

// ================================================
// ALL EXPORTS MIGRATED
// ================================================

// ================================================
// ADMIN: Download directory management
// ================================================
router.get('/download-stats', authenticateToken, requireRole(['admin']), exportController.getDownloadStats);
router.post('/cleanup-downloads', authenticateToken, requireRole(['admin']), exportController.triggerCleanupDownloads);

export default router;
