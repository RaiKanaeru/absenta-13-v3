/**
 * Template Routes
 * Routes for Excel template generation
 * Migrated from server_modern.js - Batch 16
 */

import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import * as templateController from '../controllers/templateController.js';

const router = express.Router();

// ================================================
// TEMPLATE DOWNLOAD ROUTES
// ================================================

// Mapel (Subject) template
router.get('/templates/mapel', authenticateToken, requireRole(['admin']), templateController.getMapelTemplate);

// Kelas (Class) template
router.get('/templates/kelas', authenticateToken, requireRole(['admin']), templateController.getKelasTemplate);

// Ruang (Room) template
router.get('/templates/ruang', authenticateToken, requireRole(['admin']), templateController.getRuangTemplate);

// Jadwal (Schedule) template
router.get('/templates/jadwal', authenticateToken, requireRole(['admin']), templateController.getJadwalTemplate);

// Guru (Teacher) template
router.get('/templates/guru', authenticateToken, requireRole(['admin']), templateController.getGuruTemplate);

// ================================================
// EXTENDED TEMPLATES - Basic & Friendly Variants
// ================================================

// Student Account templates (with username/password)
router.get('/student-account/template-basic', authenticateToken, requireRole(['admin']), templateController.getStudentAccountTemplateBasic);
router.get('/student-account/template-friendly', authenticateToken, requireRole(['admin']), templateController.getStudentAccountTemplateFriendly);

// Teacher Account templates (with username/password)
router.get('/teacher-account/template-basic', authenticateToken, requireRole(['admin']), templateController.getTeacherAccountTemplateBasic);
router.get('/teacher-account/template-friendly', authenticateToken, requireRole(['admin']), templateController.getTeacherAccountTemplateFriendly);

// Siswa Data templates (no account)
router.get('/siswa/template-basic', authenticateToken, requireRole(['admin']), templateController.getSiswaTemplateBasic);
router.get('/siswa/template-friendly', authenticateToken, requireRole(['admin']), templateController.getSiswaTemplateFriendly);

// Guru Data templates (no account)
router.get('/guru/template-basic', authenticateToken, requireRole(['admin']), templateController.getGuruTemplateBasic);
router.get('/guru/template-friendly', authenticateToken, requireRole(['admin']), templateController.getGuruTemplateFriendly);

// Mapel templates
router.get('/mapel/template-basic', authenticateToken, requireRole(['admin']), templateController.getMapelTemplateBasic);
router.get('/mapel/template-friendly', authenticateToken, requireRole(['admin']), templateController.getMapelTemplateFriendly);

// Kelas templates
router.get('/kelas/template-basic', authenticateToken, requireRole(['admin']), templateController.getKelasTemplateBasic);
router.get('/kelas/template-friendly', authenticateToken, requireRole(['admin']), templateController.getKelasTemplateFriendly);

// Ruang templates
router.get('/ruang/template-basic', authenticateToken, requireRole(['admin']), templateController.getRuangTemplateBasic);
router.get('/ruang/template-friendly', authenticateToken, requireRole(['admin']), templateController.getRuangTemplateFriendly);

// Jadwal templates
router.get('/jadwal/template-basic', authenticateToken, requireRole(['admin']), templateController.getJadwalTemplateBasic);
router.get('/jadwal/template-friendly', authenticateToken, requireRole(['admin']), templateController.getJadwalTemplateFriendly);

export default router;
