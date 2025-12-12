import express from 'express';
import { 
    getGuru, createGuru, updateGuru, deleteGuru, 
    updateProfile, changePassword,
    getGuruJadwal, getGuruHistory, getGuruStudentAttendanceHistory,
    guruTest, getGuruStudentAttendanceSimple
} from '../controllers/guruController.js';
import { 
    getPresensiSiswaSmkn13, getRekapKetidakhadiran,
    getGuruClasses, getAttendanceSummary, getJadwalPertemuan, getLaporanKehadiranSiswa
} from '../controllers/guruReportsController.js';
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

// Additional Guru Reports - Migrated from server_modern.js Batch 17B
router.get('/classes', authenticateToken, requireRole(['guru']), getGuruClasses);
router.get('/attendance-summary', authenticateToken, requireRole(['guru']), getAttendanceSummary);
router.get('/jadwal-pertemuan', authenticateToken, requireRole(['guru']), getJadwalPertemuan);
router.get('/laporan-kehadiran-siswa', authenticateToken, requireRole(['guru']), getLaporanKehadiranSiswa);

// Excel Download Queue Endpoints - Migrated from server_modern.js Batch 17F
import { requestExcelDownload, getDownloadStatus, exportLaporanKehadiranSiswa } from '../controllers/exportController.js';
router.post('/request-excel-download', authenticateToken, requireRole(['guru', 'admin']), requestExcelDownload);
router.get('/download-status/:jobId', authenticateToken, requireRole(['guru', 'admin']), getDownloadStatus);
router.get('/download-laporan-kehadiran-siswa', authenticateToken, requireRole(['guru']), exportLaporanKehadiranSiswa);

export default router;
