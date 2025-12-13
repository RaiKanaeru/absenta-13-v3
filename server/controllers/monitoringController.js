/**
 * Monitoring Controller
 * Handles system monitoring, security, and performance endpoints
 * Migrated from server_modern.js - Batch 17C
 */

import { sendDatabaseError } from '../utils/errorHandler.js';

// ================================================
// SECURITY ENDPOINTS
// ================================================

/**
 * Get security stats
 * GET /api/admin/security-stats
 */
export const getSecurityStats = async (req, res) => {
    try {
        const stats = global.securitySystem.getSecurityStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Get security events
 * GET /api/admin/security-events
 */
export const getSecurityEvents = async (req, res) => {
    try {
        const { limit = 100, type = null } = req.query;
        const events = global.securitySystem.getSecurityEvents(parseInt(limit), type);
        res.json({ success: true, data: events });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Get blocked IPs
 * GET /api/admin/blocked-ips
 */
export const getBlockedIPs = async (req, res) => {
    try {
        const blockedIPs = global.securitySystem.getBlockedIPs();
        res.json({ success: true, data: blockedIPs });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Block IP
 * POST /api/admin/block-ip
 */
export const blockIP = async (req, res) => {
    try {
        const { ip, reason } = req.body;
        if (!ip) return res.status(400).json({ error: 'IP address is required' });
        global.securitySystem.blockIP(ip, reason || 'Manual block by admin');
        res.json({ success: true, message: `IP ${ip} blocked successfully` });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Unblock IP
 * POST /api/admin/unblock-ip
 */
export const unblockIP = async (req, res) => {
    try {
        const { ip } = req.body;
        if (!ip) return res.status(400).json({ error: 'IP address is required' });
        global.securitySystem.unblockIP(ip);
        res.json({ success: true, message: `IP ${ip} unblocked successfully` });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Clear security events
 * POST /api/admin/clear-security-events
 */
export const clearSecurityEvents = async (req, res) => {
    try {
        global.securitySystem.clearSecurityEvents();
        res.json({ success: true, message: 'Security events cleared successfully' });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// ================================================
// SYSTEM MONITORING ENDPOINTS
// ================================================

/**
 * Get system metrics
 * GET /api/admin/system-metrics
 */
export const getSystemMetrics = async (req, res) => {
    try {
        const metrics = global.systemMonitor.getMetrics();
        res.json({ success: true, data: metrics });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Get system alerts
 * GET /api/admin/system-alerts
 */
export const getSystemAlerts = async (req, res) => {
    try {
        const alerts = global.systemMonitor.getAlerts();
        res.json({ success: true, data: alerts });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Get performance history
 * GET /api/admin/performance-history
 */
export const getPerformanceHistory = async (req, res) => {
    try {
        const history = global.systemMonitor.getPerformanceHistory();
        res.json({ success: true, data: history });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Clear alerts
 * POST /api/admin/clear-alerts
 */
export const clearAlerts = async (req, res) => {
    try {
        global.systemMonitor.clearAlerts();
        res.json({ success: true, message: 'Alerts cleared successfully' });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Get load balancer stats
 * GET /api/admin/load-balancer-stats
 */
export const getLoadBalancerStats = async (req, res) => {
    try {
        const stats = global.loadBalancer ? global.loadBalancer.getStats() : null;
        res.json({ success: true, data: stats });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Populate cache
 * POST /api/admin/populate-cache
 */
export const populateCache = async (req, res) => {
    try {
        if (global.cacheSystem) {
            await global.cacheSystem.warmUp();
            res.json({ success: true, message: 'Cache populated successfully' });
        } else {
            res.json({ success: false, message: 'Cache system not available' });
        }
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Clear cache
 * POST /api/admin/clear-cache
 */
export const clearCache = async (req, res) => {
    try {
        if (global.cacheSystem) {
            global.cacheSystem.clear();
            res.json({ success: true, message: 'Cache cleared successfully' });
        } else {
            res.json({ success: false, message: 'Cache system not available' });
        }
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Get performance metrics
 * GET /api/admin/performance-metrics
 */
export const getPerformanceMetrics = async (req, res) => {
    try {
        const metrics = global.performanceOptimizer ? global.performanceOptimizer.getMetrics() : null;
        res.json({ success: true, data: metrics });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Clear performance cache
 * POST /api/admin/clear-performance-cache
 */
export const clearPerformanceCache = async (req, res) => {
    try {
        if (global.performanceOptimizer) {
            global.performanceOptimizer.clearCache();
            res.json({ success: true, message: 'Performance cache cleared successfully' });
        } else {
            res.json({ success: false, message: 'Performance optimizer not available' });
        }
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Toggle load balancer
 * POST /api/admin/toggle-load-balancer
 */
export const toggleLoadBalancer = async (req, res) => {
    try {
        const { enabled } = req.body;
        if (global.loadBalancer) {
            global.loadBalancer.setEnabled(enabled);
            res.json({ success: true, message: `Load balancer ${enabled ? 'enabled' : 'disabled'}` });
        } else {
            res.json({ success: false, message: 'Load balancer not available' });
        }
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Get circuit breaker status
 * GET /api/admin/circuit-breaker-status
 */
export const getCircuitBreakerStatus = async (req, res) => {
    try {
        const status = global.circuitBreaker ? global.circuitBreaker.getStatus() : null;
        res.json({ success: true, data: status });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Reset circuit breaker
 * POST /api/admin/reset-circuit-breaker
 */
export const resetCircuitBreaker = async (req, res) => {
    try {
        if (global.circuitBreaker) {
            global.circuitBreaker.reset();
            res.json({ success: true, message: 'Circuit breaker reset successfully' });
        } else {
            res.json({ success: false, message: 'Circuit breaker not available' });
        }
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Resolve alert
 * POST /api/admin/resolve-alert/:alertId
 */
export const resolveAlert = async (req, res) => {
    try {
        const { alertId } = req.params;
        if (global.systemMonitor) {
            global.systemMonitor.resolveAlert(alertId);
            res.json({ success: true, message: `Alert ${alertId} resolved` });
        } else {
            res.json({ success: false, message: 'System monitor not available' });
        }
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Test alert
 * POST /api/admin/test-alert
 */
export const testAlert = async (req, res) => {
    try {
        if (global.systemMonitor) {
            global.systemMonitor.createTestAlert();
            res.json({ success: true, message: 'Test alert created' });
        } else {
            res.json({ success: false, message: 'System monitor not available' });
        }
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Get queue stats
 * GET /api/admin/queue-stats
 */
export const getQueueStats = async (req, res) => {
    try {
        const stats = global.downloadQueue ? await global.downloadQueue.getQueueStats() : null;
        res.json({ success: true, data: stats });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};
/**
 * Get system performance
 * GET /api/admin/system-performance
 */
export const getSystemPerformance = async (req, res) => {
    try {
        console.log('📊 Getting system performance data...');
        // Get load balancer stats
        const loadBalancerStats = global.loadBalancer ? global.loadBalancer.getStats() : {
            totalRequests: 0,
            activeRequests: 0,
            completedRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            circuitBreakerTrips: 0,
            burstDetections: 0,
            lastBurstTime: null,
            circuitBreaker: { isOpen: false, failureCount: 0, successCount: 0 },
            queueSizes: { critical: 0, high: 0, normal: 0, low: 0 },
            totalQueueSize: 0
        };

        // Get query optimizer stats
        const queryOptimizerStats = global.loadBalancer ? {
            queryStats: global.loadBalancer.getQueryStats(),
            cacheStats: global.loadBalancer.getCacheStats()
        } : {
            queryStats: {},
            cacheStats: { size: 0, entries: [] }
        };

        // Get system metrics
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();
        const os = await import('os');
        const cpuUsageData = process.cpuUsage();
        
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const cpus = os.cpus();
        const loadAvg = os.loadavg();

        // Calculate CPU usage
        let cpuUsagePercent = 0;
        if (global.lastCpuUsage) {
            const userDiff = cpuUsageData.user - global.lastCpuUsage.user;
            const systemDiff = cpuUsageData.system - global.lastCpuUsage.system;
            const totalDiff = userDiff + systemDiff;
            const timeElapsed = Date.now() - (global.lastCpuTime || Date.now());
            if (timeElapsed > 0) {
                cpuUsagePercent = Math.min(100, Math.max(0, (totalDiff / (timeElapsed * 1000)) * 100));
            }
        }
        global.lastCpuUsage = cpuUsageData;
        global.lastCpuTime = Date.now();

        const systemMetrics = {
            uptime: uptime,
            memory: {
                used: memoryUsage.heapUsed,
                total: memoryUsage.heapTotal,
                external: memoryUsage.external,
                arrayBuffers: memoryUsage.arrayBuffers || 0,
                systemTotal: totalMemory,
                systemUsed: usedMemory,
                systemFree: freeMemory,
                systemPercentage: totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0
            },
            cpu: {
                user: cpuUsageData.user,
                system: cpuUsageData.system,
                usage: cpuUsagePercent,
                cores: cpus.length,
                model: cpus[0]?.model || 'Unknown',
                speed: cpus[0]?.speed || 0,
                loadAverage: loadAvg
            },
            device: {
                platform: os.platform(),
                architecture: os.arch(),
                hostname: os.hostname(),
                type: os.type(),
                cores: cpus.length,
                totalMemory: totalMemory,
                memoryFormatted: formatBytes(totalMemory)
            }
        };

        // Helper to format bytes
        function formatBytes(bytes) {
            if (!bytes || bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        // Get Redis stats
        let redisStats = { connected: false, error: 'Redis not available' };
        if (global.redis && global.redis.isOpen) {
            try {
                const info = await global.redis.info();
                redisStats = { connected: true, info };
            } catch (err) {
                redisStats = { connected: false, error: err.message };
            }
        }

        res.json({
            success: true,
            data: {
                loadBalancer: loadBalancerStats,
                queryOptimizer: queryOptimizerStats,
                redis: redisStats,
                system: systemMetrics
            }
        });
    } catch (error) {
        console.error('❌ Error getting system performance:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
};

/**
 * Get monitoring dashboard
 * GET /api/admin/monitoring-dashboard
 */
export const getMonitoringDashboard = async (req, res) => {
    try {
        const os = await import('os');
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        
        const cpuUsageData = process.cpuUsage();
        const cpus = os.cpus();
        const loadAverage = os.loadavg();

        let cpuUsage = 0;
        if (global.lastCpuUsage) {
            const userDiff = cpuUsageData.user - global.lastCpuUsage.user;
            const systemDiff = cpuUsageData.system - global.lastCpuUsage.system;
            const totalDiff = userDiff + systemDiff;
            const timeElapsed = Date.now() - (global.lastCpuTime || Date.now());
            if (timeElapsed > 0) {
                cpuUsage = Math.min(100, Math.max(0, (totalDiff / (timeElapsed * 1000)) * 100));
            }
        }
        global.lastCpuUsage = cpuUsageData;
        global.lastCpuTime = Date.now();
        
        // Fallback to load average
        if (cpuUsage === 0 && loadAverage[0] > 0) {
            cpuUsage = Math.min(Math.max(loadAverage[0] * 100, 0), 100);
        }

        const metrics = {
            system: {
                cpu: {
                    usage: cpuUsage,
                    cores: cpus.length,
                    model: cpus[0]?.model || 'Unknown',
                    loadAvg: loadAverage
                },
                memory: {
                    total: totalMemory,
                    used: usedMemory,
                    free: freeMemory,
                    percentage: (usedMemory / totalMemory) * 100
                },
                uptime: process.uptime(),
                platform: os.platform(),
                hostname: os.hostname()
            },
            process: {
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                version: process.version,
                pid: process.pid
            }
        };

        res.json({ success: true, data: metrics });
    } catch (error) {
        console.error('❌ Error getting monitoring dashboard:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
};

/**
 * Get system logs
 * GET /api/admin/logs
 */
export const getSystemLogs = async (req, res) => {
    try {
        console.log('📝 Retrieving system logs...');
        // For now, return sample log data (migrated from server_modern.js)
        const logs = [
            { timestamp: new Date().toISOString(), level: 'INFO', message: 'Sistem berjalan normal', user: 'admin' },
            { timestamp: new Date(Date.now() - 60000).toISOString(), level: 'INFO', message: 'Database backup otomatis berhasil', user: 'system' },
            { timestamp: new Date(Date.now() - 120000).toISOString(), level: 'WARNING', message: 'Tingkat kehadiran rendah hari ini', user: 'system' }
        ];
        res.json({ logs });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};
