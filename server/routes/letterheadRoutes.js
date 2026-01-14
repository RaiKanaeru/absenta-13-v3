/**
 * Letterhead Routes
 * All letterhead/KOP related endpoints
 * Migrated from server_modern.js
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import * as letterheadController from '../controllers/letterheadController.js';

const router = Router();

// Allowed image extensions whitelist
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

// Allowed logo type prefixes (strict whitelist - no user input in filename)
const ALLOWED_LOGO_PREFIXES = {
    'logo_left': 'logo_left',
    'logo_right': 'logo_right', 
    'logo_center': 'logo_center',
    'logo': 'logo'
};

// Multer configuration for logo upload
const uploadLogo = multer({
    storage: multer.diskStorage({
        destination(req, file, cb) {
            cb(null, 'public/uploads/letterheads');
        },
        filename(req, file, cb) {
            // Get extension from original filename (use basename to strip path)
            const safeName = path.basename(file.originalname);
            const rawExt = path.extname(safeName).toLowerCase();
            const ext = ALLOWED_IMAGE_EXTENSIONS.includes(rawExt) ? rawExt : '.png';
            
            // Use strict whitelist lookup - no user input reaches the filename
            const logoType = String(req.body.logoType || '').toLowerCase();
            const prefix = ALLOWED_LOGO_PREFIXES[logoType] || 'logo';

            // Generate filename using only safe pre-defined values
            const fileName = `${prefix}_${Date.now()}${ext}`;
            cb(null, fileName);
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
