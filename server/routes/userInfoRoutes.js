/**
 * User Info Routes
 * Self-service info endpoints for siswa perwakilan, guru, admin
 * Migrated from server_modern.js
 */

import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import * as userInfoController from '../controllers/userInfoController.js';

const router = Router();

// Siswa Perwakilan endpoints
router.get('/siswa-perwakilan/info', authenticateToken, requireRole(['siswa']), userInfoController.getSiswaPerwakilanInfo);
router.get('/siswa/:siswa_id/jadwal-hari-ini', authenticateToken, requireRole(['siswa']), userInfoController.getSiswaJadwalHariIni);
router.get('/siswa/:siswa_id/jadwal-rentang', authenticateToken, requireRole(['siswa']), userInfoController.getSiswaJadwalRentang);

// Guru info endpoint
router.get('/guru/info', authenticateToken, requireRole(['guru']), userInfoController.getGuruInfo);

// Admin info endpoint
router.get('/admin/info', authenticateToken, requireRole(['admin']), userInfoController.getAdminInfo);

export default router;
