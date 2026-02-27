/**
 * PDF Export Routes
 * Handles all PDF report export endpoints
 * Mounted at /api/export/pdf
 */

import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import * as pdfExportController from '../controllers/pdfExportController.js';
import { exportRateLimit } from '../middleware/exportRateLimit.js';
import { exportPressureGuard } from '../middleware/exportPressureGuard.js';

const limiter = exportRateLimit({ windowMs: 60_000, maxRequests: 5 });

const router = Router();

// ================================================
// ADMIN PDF EXPORTS
// ================================================

// Student attendance summary PDF
router.get('/student-summary', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, pdfExportController.exportStudentSummaryPdf);

// Teacher attendance summary PDF
router.get('/teacher-summary', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, pdfExportController.exportTeacherSummaryPdf);

// Banding absen PDF
router.get('/banding-absen', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, pdfExportController.exportBandingAbsenPdf);

// Rekap ketidakhadiran siswa PDF
router.get('/rekap-ketidakhadiran-siswa', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, pdfExportController.exportRekapKetidakhadiranSiswaPdf);

// Rekap ketidakhadiran guru PDF
router.get('/rekap-ketidakhadiran-guru', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, pdfExportController.exportRekapKetidakhadiranGuruPdf);

// Presensi siswa detail PDF
router.get('/presensi-siswa', authenticateToken, requireRole(['admin']), limiter, exportPressureGuard, pdfExportController.exportPresensiSiswaPdf);

// Rekap ketidakhadiran periodik (guru/admin)
router.get('/rekap-ketidakhadiran', authenticateToken, requireRole(['guru', 'admin']), limiter, exportPressureGuard, pdfExportController.exportRekapKetidakhadiranPdf);

// Presensi siswa SMKN13 periodik (guru/admin)
router.get('/presensi-siswa-smkn13', authenticateToken, requireRole(['guru', 'admin']), limiter, exportPressureGuard, pdfExportController.exportPresensiSiswaSmkn13Pdf);

// ================================================
// GURU PDF EXPORTS
// ================================================

// Laporan kehadiran siswa (guru view)
router.get('/laporan-kehadiran-siswa', authenticateToken, requireRole(['guru', 'admin']), limiter, exportPressureGuard, pdfExportController.exportLaporanKehadiranSiswaPdf);

export default router;
