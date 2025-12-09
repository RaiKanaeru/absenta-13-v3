/**
 * Absensi Routes
 * Handles all attendance-related API endpoints
 * 
 * @description Route organization:
 * - /submit                       - Teacher submitting student attendance
 * - /schedule/:id/students        - Get students for attendance (today)
 * - /schedule/:id/students-by-date - Get students for past date editing
 * - /siswa/submit-kehadiran-guru  - Class rep submitting teacher attendance
 * - /siswa/update-status-guru     - Class rep real-time status update
 * - /siswa/:id/riwayat-kehadiran  - Class attendance history
 * - /siswa/:id/status-kehadiran   - Student's own attendance status
 * 
 * @requires authenticateToken - JWT authentication middleware
 * @requires requireRole - Role-based access control
 */

import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
    getStudentsForSchedule,
    getStudentsForScheduleByDate,
    submitStudentAttendance,
    submitTeacherAttendance,
    updateTeacherStatus,
    getClassAttendanceHistory,
    getStudentAttendanceStatus
} from '../controllers/absensiController.js';

const router = express.Router();

// ===========================
// Student Attendance (by Teacher)
// ===========================

/**
 * @route POST /api/attendance/submit
 * @desc Submit student attendance for a schedule
 * @access Teacher, Admin
 * @body scheduleId, attendance (object), notes (object), guruId, tanggal_absen
 */
router.post('/submit', authenticateToken, requireRole(['guru', 'admin']), submitStudentAttendance);

/**
 * @route GET /api/schedule/:id/students
 * @desc Get students with today's attendance for a schedule
 * @access Teacher, Admin
 * @param id - Schedule ID
 */
router.get('/schedule/:id/students', authenticateToken, requireRole(['guru', 'admin']), getStudentsForSchedule);

/**
 * @route GET /api/schedule/:id/students-by-date
 * @desc Get students with attendance for a specific date (max 30 days ago)
 * @access Teacher, Admin
 * @param id - Schedule ID
 * @query tanggal - Target date (YYYY-MM-DD)
 */
router.get('/schedule/:id/students-by-date', authenticateToken, requireRole(['guru', 'admin']), getStudentsForScheduleByDate);

// ===========================
// Teacher Attendance (by Class Representative)
// ===========================

/**
 * @route POST /api/siswa/submit-kehadiran-guru
 * @desc Submit teacher attendance (bulk) by class representative
 * @access Siswa (Class Representative)
 * @body siswa_id, kehadiran_data (object), tanggal_absen
 */
router.post('/siswa/submit-kehadiran-guru', authenticateToken, requireRole(['siswa']), submitTeacherAttendance);

/**
 * @route POST /api/siswa/update-status-guru
 * @desc Update single teacher status in real-time
 * @access Siswa (Class Representative)
 * @body jadwal_id, guru_id, status, keterangan, tanggal_absen, ada_tugas
 */
router.post('/siswa/update-status-guru', authenticateToken, requireRole(['siswa']), updateTeacherStatus);

// ===========================
// Attendance History & Reports
// ===========================

/**
 * @route GET /api/siswa/:siswa_id/riwayat-kehadiran
 * @desc Get class attendance history with statistics
 * @access Siswa
 * @param siswa_id - Student ID (used to determine class)
 */
router.get('/siswa/:siswa_id/riwayat-kehadiran', authenticateToken, requireRole(['siswa']), getClassAttendanceHistory);

/**
 * @route GET /api/siswa/:siswaId/status-kehadiran
 * @desc Get student's own attendance status for a specific date and schedule
 * @access Siswa
 * @param siswaId - Student ID
 * @query tanggal - Target date (YYYY-MM-DD)
 * @query jadwal_id - Schedule ID
 */
router.get('/siswa/:siswaId/status-kehadiran', authenticateToken, requireRole(['siswa']), getStudentAttendanceStatus);

export default router;
