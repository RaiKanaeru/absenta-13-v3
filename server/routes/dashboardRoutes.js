/**
 * Dashboard Routes
 * Dashboard statistics and chart endpoints
 * Migrated from server_modern.js
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as dashboardController from '../controllers/dashboardController.js';

const router = Router();

// Dashboard statistics - all authenticated users
router.get('/stats', authenticateToken, dashboardController.getStats);

// Dashboard chart data - all authenticated users
router.get('/chart', authenticateToken, dashboardController.getChart);

// Live summary data - admin only
router.get('/live-summary', authenticateToken, dashboardController.getLiveSummary);

export default router;
