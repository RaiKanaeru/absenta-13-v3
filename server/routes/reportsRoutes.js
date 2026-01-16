/**
 * Reports Routes
 * Analytics and attendance reports
 * Mounted at /api/admin
 */

import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
    updatePermissionStatus,
    getAnalyticsDashboard,
    getLiveTeacherAttendance,
    getLiveStudentAttendance,
    getTeacherAttendanceReport,
    downloadTeacherAttendanceReport,
    getStudentAttendanceReport,
    downloadStudentAttendanceReport,
    getStudentAttendanceSummary,
    downloadStudentAttendanceExcel,
    getTeacherAttendanceSummary,
    getRekapKetidakhadiranGuru,
    getRekapKetidakhadiranSiswa,
    getStudentsByClass,
    getPresensiSiswa
} from '../controllers/reportsController.js';

const router = express.Router();

// Middleware applied to all routes in this router
router.use(authenticateToken);
router.use(requireRole(['admin']));

// ===========================
// Dashboard Analytics
// ===========================

// Update permission request status (Deprecated)
router.put('/izin/:id', updatePermissionStatus);

// Main Analytics Dashboard
/**
 * @swagger
 * /admin/analytics:
 *   get:
 *     summary: Get dashboard analytics overview
 *     description: Retrieve summary stats for students, teachers, and attendance
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 */
router.get('/analytics', getAnalyticsDashboard);

// Live Attendance
router.get('/live-teacher-attendance', getLiveTeacherAttendance);
router.get('/live-student-attendance', getLiveStudentAttendance);

// ===========================
// Reports & Exports
// ===========================

// Teacher Attendance
router.get('/teacher-attendance-report', getTeacherAttendanceReport);
router.get('/download-teacher-attendance', downloadTeacherAttendanceReport);
router.get('/download-teacher-attendance-excel', downloadTeacherAttendanceReport); // Alias for frontend compatibility
router.get('/teacher-attendance-summary', getTeacherAttendanceSummary);
router.get('/teacher-summary', getTeacherAttendanceSummary); // Alias for frontend
router.get('/rekap-ketidakhadiran-guru', getRekapKetidakhadiranGuru);

// Student Attendance
router.get('/student-attendance-report', getStudentAttendanceReport);
router.get('/download-student-attendance', downloadStudentAttendanceReport);
router.get('/student-attendance-summary', getStudentAttendanceSummary);
router.get('/student-summary', getStudentAttendanceSummary); // Alias for frontend
router.get('/download-student-attendance-excel', downloadStudentAttendanceExcel);
router.get('/rekap-ketidakhadiran', getRekapKetidakhadiranSiswa);
router.get('/presensi-siswa', getPresensiSiswa);

// Helper Routes
router.get('/students-by-class/:kelasId', getStudentsByClass);

export default router;
