import express from 'express';
import { 
    getGuru, createGuru, updateGuru, deleteGuru, 
    updateProfile, changePassword,
    getGuruJadwal, getGuruHistory, getGuruStudentAttendanceHistory,
    guruTest, getGuruStudentAttendanceSimple
} from '../controllers/guruController.js';
import { getPresensiSiswaSmkn13, getRekapKetidakhadiran } from '../controllers/guruReportsController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Admin CRUD routes (for /api/admin/guru)
router.get('/', authenticateToken, requireRole(['admin']), getGuru);
router.post('/', authenticateToken, requireRole(['admin']), createGuru);
router.put('/:id', authenticateToken, requireRole(['admin']), updateGuru);
router.delete('/:id', authenticateToken, requireRole(['admin']), deleteGuru);

// Self-service profile routes (for /api/guru/)
router.put('/update-profile', authenticateToken, requireRole(['guru']), updateProfile);
router.put('/change-password', authenticateToken, requireRole(['guru']), changePassword);

// Guru self-service endpoints (for /api/guru/) - Migrated from server_modern.js
router.get('/jadwal', authenticateToken, requireRole(['guru', 'admin']), getGuruJadwal);
router.get('/history', authenticateToken, requireRole(['guru', 'admin']), getGuruHistory);
router.get('/student-attendance-history', authenticateToken, requireRole(['guru', 'admin']), getGuruStudentAttendanceHistory);
router.get('/test', authenticateToken, requireRole(['guru', 'admin']), guruTest);
router.get('/student-attendance-simple', authenticateToken, requireRole(['guru', 'admin']), getGuruStudentAttendanceSimple);

// Guru Reports endpoints - Migrated from server_modern.js
router.get('/presensi-siswa-smkn13', authenticateToken, requireRole(['guru', 'admin']), getPresensiSiswaSmkn13);
router.get('/rekap-ketidakhadiran', authenticateToken, requireRole(['guru', 'admin']), getRekapKetidakhadiran);

export default router;
