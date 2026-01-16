import express from 'express';
import { updateAdminProfile, changeAdminPassword } from '../controllers/adminController.js';
import { importMasterSchedule } from '../controllers/importMasterScheduleController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.put('/update-profile', authenticateToken, requireRole(['admin']), updateAdminProfile);
router.put('/change-password', authenticateToken, requireRole(['admin']), changeAdminPassword);

export default router;
