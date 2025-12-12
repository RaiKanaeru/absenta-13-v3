/**
 * Monitoring Routes
 * Routes for system monitoring, security, and performance endpoints
 * Migrated from server_modern.js - Batch 17C
 */

import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
    // Security endpoints
    getSecurityStats,
    getSecurityEvents,
    getBlockedIPs,
    blockIP,
    unblockIP,
    clearSecurityEvents,
    // System monitoring endpoints
    getSystemMetrics,
    getSystemAlerts,
    getPerformanceHistory,
    clearAlerts,
    getLoadBalancerStats,
    populateCache,
    clearCache,
    getPerformanceMetrics,
    clearPerformanceCache,
    toggleLoadBalancer,
    getCircuitBreakerStatus,
    resetCircuitBreaker,
    resolveAlert,
    testAlert,
    getQueueStats,
    getSystemPerformance,
    getMonitoringDashboard,
    getSystemLogs
} from '../controllers/monitoringController.js';

const router = express.Router();

// ================================================
// SECURITY ENDPOINTS
// ================================================
router.get('/security-stats', authenticateToken, requireRole(['admin']), getSecurityStats);
router.get('/security-events', authenticateToken, requireRole(['admin']), getSecurityEvents);
router.get('/blocked-ips', authenticateToken, requireRole(['admin']), getBlockedIPs);
router.post('/block-ip', authenticateToken, requireRole(['admin']), blockIP);
router.post('/unblock-ip', authenticateToken, requireRole(['admin']), unblockIP);
router.post('/clear-security-events', authenticateToken, requireRole(['admin']), clearSecurityEvents);

// ================================================
// SYSTEM MONITORING ENDPOINTS
// ================================================
router.get('/system-metrics', authenticateToken, requireRole(['admin']), getSystemMetrics);
router.get('/system-alerts', authenticateToken, requireRole(['admin']), getSystemAlerts);
router.get('/performance-history', authenticateToken, requireRole(['admin']), getPerformanceHistory);
router.post('/clear-alerts', authenticateToken, requireRole(['admin']), clearAlerts);
router.get('/load-balancer-stats', authenticateToken, requireRole(['admin']), getLoadBalancerStats);
router.post('/populate-cache', authenticateToken, requireRole(['admin']), populateCache);
router.post('/clear-cache', authenticateToken, requireRole(['admin']), clearCache);
router.get('/performance-metrics', authenticateToken, requireRole(['admin']), getPerformanceMetrics);
router.post('/clear-performance-cache', authenticateToken, requireRole(['admin']), clearPerformanceCache);
router.post('/toggle-load-balancer', authenticateToken, requireRole(['admin']), toggleLoadBalancer);
router.get('/circuit-breaker-status', authenticateToken, requireRole(['admin']), getCircuitBreakerStatus);
router.post('/reset-circuit-breaker', authenticateToken, requireRole(['admin']), resetCircuitBreaker);
router.post('/resolve-alert/:alertId', authenticateToken, requireRole(['admin']), resolveAlert);
router.post('/test-alert', authenticateToken, requireRole(['admin']), testAlert);
router.get('/queue-stats', authenticateToken, requireRole(['admin']), getQueueStats);
router.get('/system-performance', authenticateToken, requireRole(['admin']), getSystemPerformance);
router.get('/monitoring-dashboard', authenticateToken, requireRole(['admin']), getMonitoringDashboard);
router.get('/logs', authenticateToken, requireRole(['admin']), getSystemLogs);

export default router;
