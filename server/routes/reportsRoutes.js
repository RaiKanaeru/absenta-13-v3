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
    getTeacherAttendanceSummary
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

// Student Attendance
router.get('/student-attendance-report', getStudentAttendanceReport);
router.get('/download-student-attendance', downloadStudentAttendanceReport);
router.get('/student-attendance-summary', getStudentAttendanceSummary);
router.get('/download-student-attendance-excel', downloadStudentAttendanceExcel);

export default router;
