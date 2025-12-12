/**
 * Import Routes
 * Routes for Excel file import operations
 * Migrated from server_modern.js - Batch 16
 */

import express from 'express';
import multer from 'multer';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import * as importController from '../controllers/importController.js';

const router = express.Router();

// Configure multer for Excel file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowed = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
        if (allowed.includes(file.mimetype)) return cb(null, true);
        cb(new Error('File harus .xlsx'));
    }
});

// ================================================
// IMPORT ROUTES
// ================================================

// Import Mapel (Subject)
router.post('/import/mapel', authenticateToken, requireRole(['admin']), upload.single('file'), importController.importMapel);

// Import Kelas (Class)
router.post('/import/kelas', authenticateToken, requireRole(['admin']), upload.single('file'), importController.importKelas);

// Import Ruang (Room)
router.post('/import/ruang', authenticateToken, requireRole(['admin']), upload.single('file'), importController.importRuang);

// Import Jadwal (Schedule) - with multi-guru support
router.post('/import/jadwal', authenticateToken, requireRole(['admin']), upload.single('file'), importController.importJadwal);

// Import Student Account (with bcrypt password hashing)
router.post('/import/student-account', authenticateToken, requireRole(['admin']), upload.single('file'), importController.importStudentAccount);

// Import Teacher Account (with bcrypt password hashing)
router.post('/import/teacher-account', authenticateToken, requireRole(['admin']), upload.single('file'), importController.importTeacherAccount);

// Import Siswa Data (data-only, no password)
router.post('/import/siswa', authenticateToken, requireRole(['admin']), upload.single('file'), importController.importSiswa);

// Import Guru Data (data-only, no password)
router.post('/import/guru', authenticateToken, requireRole(['admin']), upload.single('file'), importController.importGuru);

export default router;
