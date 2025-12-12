/**
 * Letterhead Routes
 * All letterhead/KOP related endpoints
 * Migrated from server_modern.js
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import * as letterheadController from '../controllers/letterheadController.js';

const router = Router();

// Multer configuration for logo upload
const uploadLogo = multer({
    storage: multer.diskStorage({
        destination(req, file, cb) {
            cb(null, 'public/uploads/letterheads');
        },
        filename(req, file, cb) {
            const ext = path.extname(file.originalname);
            const prefix = req.body.logoType || 'logo';
            cb(null, `${prefix}_${Date.now()}${ext}`);
        }
    }),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
    fileFilter(req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('File harus berupa gambar'));
        }
    }
});

// ================================================
// REPORT LETTERHEAD ROUTES
// ================================================
router.get('/report-letterhead', authenticateToken, requireRole(['admin']), letterheadController.getReportLetterhead);
router.put('/report-letterhead', authenticateToken, requireRole(['admin']), letterheadController.updateReportLetterhead);

// ================================================
// LETTERHEAD SERVICE ROUTES
// ================================================
router.get('/letterhead', authenticateToken, requireRole(['admin', 'guru', 'siswa']), letterheadController.getLetterheadConfig);
router.get('/letterhead/all', authenticateToken, requireRole(['admin']), letterheadController.getAllLetterheadConfigs);
router.put('/letterhead/global', authenticateToken, requireRole(['admin']), letterheadController.setGlobalLetterhead);
router.put('/letterhead/report/:reportKey', authenticateToken, requireRole(['admin']), letterheadController.setReportLetterhead);
router.post('/letterhead/upload', authenticateToken, requireRole(['admin']), uploadLogo.single('logo'), letterheadController.uploadLogo);
router.delete('/letterhead/delete-file', authenticateToken, requireRole(['admin']), letterheadController.deleteFile);
router.delete('/letterhead/logo/:logoType', authenticateToken, requireRole(['admin']), letterheadController.deleteLogo);
router.delete('/letterhead/:id', authenticateToken, requireRole(['admin']), letterheadController.deleteLetterheadConfig);
router.post('/init-letterhead', authenticateToken, requireRole(['admin']), letterheadController.initializeDefaults);

export default router;
