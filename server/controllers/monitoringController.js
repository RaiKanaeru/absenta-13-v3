/**
 * Monitoring Controller
 * Handles system monitoring, security, and performance endpoints
 */

import { sendDatabaseError, sendValidationError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Monitoring');

// ================================================
// SECURITY ENDPOINTS
// ================================================

/**
 * Get security stats
 * GET /api/admin/security-stats
 */
export const getSecurityStats = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetSecurityStats', {});

    try {
        const stats = global.securitySystem.getSecurityStats();
        log.success('GetSecurityStats', { blockedIPs: stats?.blockedIPs?.length || 0 });
        return sendSuccessResponse(res, stats);
    } catch (error) {
        log.error('GetSecurityStats failed', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Get security events
 * GET /api/admin/security-events
 */
export const getSecurityEvents = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { limit = 100, type = null } = req.query;
    
    log.requestStart('GetSecurityEvents', { limit, type });

    try {
        const events = global.securitySystem.getSecurityEvents(parseInt(limit), type);
        log.success('GetSecurityEvents', { count: events?.length || 0 });
        return sendSuccessResponse(res, events);
    } catch (error) {
        log.error('GetSecurityEvents failed', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Get blocked IPs
 * GET /api/admin/blocked-ips
 */
export const getBlockedIPs = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetBlockedIPs', {});

    try {
        const blockedIPs = global.securitySystem.getBlockedIPs();
        log.success('GetBlockedIPs', { count: blockedIPs?.length || 0 });
        return sendSuccessResponse(res, blockedIPs);
    } catch (error) {
        log.error('GetBlockedIPs failed', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Block IP
 * POST /api/admin/block-ip
 */
export const blockIP = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { ip, reason } = req.body;
    
    log.requestStart('BlockIP', { ip, reason });

    try {
        if (!ip) {
            log.validationFail('ip', null, 'Required');
            return sendValidationError(res, 'IP address is required', { field: 'ip' });
        }
        global.securitySystem.blockIP(ip, reason || 'Manual block by admin');
        log.success('BlockIP', { ip });
        return sendSuccessResponse(res, null, `IP ${ip} blocked successfully`);
    } catch (error) {
        log.error('BlockIP failed', { error: error.message, ip });
        return sendDatabaseError(res, error);
    }
};

/**
 * Unblock IP
 * POST /api/admin/unblock-ip
 */
export const unblockIP = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { ip } = req.body;
    
    log.requestStart('UnblockIP', { ip });

    try {
        if (!ip) {
            log.validationFail('ip', null, 'Required');
            return sendValidationError(res, 'IP address is required', { field: 'ip' });
        }
        global.securitySystem.unblockIP(ip);
        log.success('UnblockIP', { ip });
        return sendSuccessResponse(res, null, `IP ${ip} unblocked successfully`);
    } catch (error) {
        log.error('UnblockIP failed', { error: error.message, ip });
        return sendDatabaseError(res, error);
    }
};

/**
 * Clear security events
 * POST /api/admin/clear-security-events
 */
export const clearSecurityEvents = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('ClearSecurityEvents', {});

    try {
        global.securitySystem.clearSecurityEvents();
        log.success('ClearSecurityEvents', {});
        return sendSuccessResponse(res, null, 'Security events cleared successfully');
    } catch (error) {
        log.error('ClearSecurityEvents failed', { error: error.message });
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
    const log = logger.withRequest(req, res);
    log.requestStart('GetSystemMetrics', {});

    try {
        const metrics = global.systemMonitor.getMetrics();
        log.success('GetSystemMetrics', {});
        return sendSuccessResponse(res, metrics);
    } catch (error) {
        log.error('GetSystemMetrics failed', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Get system alerts
 * GET /api/admin/system-alerts
 */
export const getSystemAlerts = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetSystemAlerts', {});

    try {
        const alerts = global.systemMonitor.getAlerts();
        log.success('GetSystemAlerts', { count: alerts?.length || 0 });
        return sendSuccessResponse(res, alerts);
    } catch (error) {
        log.error('GetSystemAlerts failed', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Get performance history
 * GET /api/admin/performance-history
 */
export const getPerformanceHistory = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetPerformanceHistory', {});

    try {
        const history = global.systemMonitor.getPerformanceHistory();
        log.success('GetPerformanceHistory', { dataPoints: history?.length || 0 });
        return sendSuccessResponse(res, history);
    } catch (error) {
        log.error('GetPerformanceHistory failed', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Clear alerts
 * POST /api/admin/clear-alerts
 */
export const clearAlerts = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('ClearAlerts', {});

    try {
        global.systemMonitor.clearAlerts();
        log.success('ClearAlerts', {});
        return sendSuccessResponse(res, null, 'Alerts cleared successfully');
    } catch (error) {
        log.error('ClearAlerts failed', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Get load balancer stats
 * GET /api/admin/load-balancer-stats
 */
export const getLoadBalancerStats = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetLoadBalancerStats', {});

    try {
        const stats = global.loadBalancer ? global.loadBalancer.getStats() : null;
        log.success('GetLoadBalancerStats', { available: !!global.loadBalancer });
        return sendSuccessResponse(res, stats);
    } catch (error) {
        log.error('GetLoadBalancerStats failed', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Populate cache
 * POST /api/admin/populate-cache
 */
export const populateCache = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('PopulateCache', {});

    try {
        if (global.cacheSystem) {
            await global.cacheSystem.warmUp();
            log.success('PopulateCache', {});
            return sendSuccessResponse(res, null, 'Cache populated successfully');
        } else {
            log.warn('PopulateCache - cache system not available');
            return res.json({ success: false, message: 'Cache system not available' });
        }
    } catch (error) {
        log.error('PopulateCache failed', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Clear cache
 * POST /api/admin/clear-cache
 */
export const clearCache = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('ClearCache', {});

    try {
        if (global.cacheSystem) {
            global.cacheSystem.clear();
            log.success('ClearCache', {});
            return sendSuccessResponse(res, null, 'Cache cleared successfully');
        } else {
            log.warn('ClearCache - cache system not available');
            return res.json({ success: false, message: 'Cache system not available' });
        }
    } catch (error) {
        log.error('ClearCache failed', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Get performance metrics
 * GET /api/admin/performance-metrics
 */
export const getPerformanceMetrics = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetPerformanceMetrics', {});

    try {
        const metrics = global.performanceOptimizer ? global.performanceOptimizer.getMetrics() : null;
        log.success('GetPerformanceMetrics', { available: !!global.performanceOptimizer });
        return sendSuccessResponse(res, metrics);
    } catch (error) {
        log.error('GetPerformanceMetrics failed', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Clear performance cache
 * POST /api/admin/clear-performance-cache
 */
export const clearPerformanceCache = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('ClearPerformanceCache', {});

    try {
        if (global.performanceOptimizer) {
            global.performanceOptimizer.clearCache();
            log.success('ClearPerformanceCache', {});
            return sendSuccessResponse(res, null, 'Performance cache cleared successfully');
        } else {
            log.warn('ClearPerformanceCache - optimizer not available');
            return res.json({ success: false, message: 'Performance optimizer not available' });
        }
    } catch (error) {
        log.error('ClearPerformanceCache failed', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Toggle load balancer
 * POST /api/admin/toggle-load-balancer
 */
export const toggleLoadBalancer = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { enabled } = req.body;
    
    log.requestStart('ToggleLoadBalancer', { enabled });

    try {
        if (global.loadBalancer) {
            if (enabled) {
                await global.loadBalancer.enable();
            } else {
                await global.loadBalancer.disable();
            }
            log.success('ToggleLoadBalancer', { enabled });
            return sendSuccessResponse(res, null, `Load balancer ${enabled ? 'enabled' : 'disabled'}`);
        } else {
            log.warn('ToggleLoadBalancer - not available');
            return res.json({ success: false, message: 'Load balancer not available' });
        }
    } catch (error) {
        log.error('ToggleLoadBalancer failed', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Get circuit breaker status
 * GET /api/admin/circuit-breaker-status
 */
export const getCircuitBreakerStatus = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetCircuitBreakerStatus', {});

    try {
        const status = global.circuitBreaker ? global.circuitBreaker.getStatus() : null;
        log.success('GetCircuitBreakerStatus', { available: !!global.circuitBreaker });
        return sendSuccessResponse(res, status);
    } catch (error) {
        log.error('GetCircuitBreakerStatus failed', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Reset circuit breaker
 * POST /api/admin/reset-circuit-breaker
 */
export const resetCircuitBreaker = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('ResetCircuitBreaker', {});

    try {
        if (global.circuitBreaker) {
            global.circuitBreaker.reset();
            log.success('ResetCircuitBreaker', {});
            return sendSuccessResponse(res, null, 'Circuit breaker reset successfully');
        } else {
            log.warn('ResetCircuitBreaker - not available');
            return res.json({ success: false, message: 'Circuit breaker not available' });
        }
    } catch (error) {
        log.error('ResetCircuitBreaker failed', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Resolve alert
 * POST /api/admin/resolve-alert/:alertId
 */
export const resolveAlert = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { alertId } = req.params;
    
    log.requestStart('ResolveAlert', { alertId });

    try {
        if (global.systemMonitor) {
            global.systemMonitor.resolveAlert(alertId);
            log.success('ResolveAlert', { alertId });
            return sendSuccessResponse(res, null, `Alert ${alertId} resolved`);
        } else {
            log.warn('ResolveAlert - system monitor not available');
            return res.json({ success: false, message: 'System monitor not available' });
        }
    } catch (error) {
        log.error('ResolveAlert failed', { error: error.message, alertId });
        return sendDatabaseError(res, error);
    }
};

/**
 * Test alert
 * POST /api/admin/test-alert
 */
export const testAlert = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('TestAlert', {});

    try {
        if (global.systemMonitor) {
            global.systemMonitor.createTestAlert();
            log.success('TestAlert', {});
            return sendSuccessResponse(res, null, 'Test alert created');
        } else {
            log.warn('TestAlert - system monitor not available');
            return res.json({ success: false, message: 'System monitor not available' });
        }
    } catch (error) {
        log.error('TestAlert failed', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Get queue stats
 * GET /api/admin/queue-stats
 */
export const getQueueStats = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetQueueStats', {});

    try {
        const stats = global.downloadQueue ? await global.downloadQueue.getQueueStats() : null;
        log.success('GetQueueStats', { available: !!global.downloadQueue });
        return sendSuccessResponse(res, stats);
    } catch (error) {
        log.error('GetQueueStats failed', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Get system performance
 * GET /api/admin/system-performance
 */
export const getSystemPerformance = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetSystemPerformance', {});

    try {
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

        // Helper to format bytes
        function formatBytes(bytes) {
            if (!bytes || bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

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

        log.success('GetSystemPerformance', { cpuUsage: cpuUsagePercent.toFixed(2), memoryPercent: systemMetrics.memory.systemPercentage.toFixed(2) });
        return sendSuccessResponse(res, {
            loadBalancer: loadBalancerStats,
            queryOptimizer: queryOptimizerStats,
            redis: redisStats,
            system: systemMetrics
        });
    } catch (error) {
        log.error('GetSystemPerformance failed', { error: error.message });
        return res.status(500).json({ error: 'Internal server error', message: error.message });
    }
};

/**
 * Get monitoring dashboard
 * GET /api/admin/monitoring-dashboard
 */
export const getMonitoringDashboard = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetMonitoringDashboard', {});

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
        
        // Fallback to load average for CPU usage
        if (cpuUsage === 0 && loadAverage[0] > 0) {
            cpuUsage = Math.min(Math.max(loadAverage[0] * 100, 0), 100);
        }

        // Get load balancer stats
        const loadBalancerStats = global.loadBalancer ? global.loadBalancer.getStats() : {
            totalRequests: 0,
            activeRequests: 0,
            completedRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            circuitBreaker: { isOpen: false },
            queueSizes: { critical: 0, high: 0, normal: 0, low: 0 },
            totalQueueSize: 0
        };

        // Get database connection stats
        let dbConnectionStats = { active: 0, idle: 0, total: 0 };
        if (global.dbOptimization && global.dbOptimization.pool) {
            const pool = global.dbOptimization.pool;
            dbConnectionStats = {
                active: pool._allConnections?.length || 0,
                idle: pool._freeConnections?.length || 0,
                total: (pool._allConnections?.length || 0) + (pool._freeConnections?.length || 0)
            };
        }

        // Get system monitor data
        const systemMonitorMetrics = global.systemMonitor ? global.systemMonitor.getMetrics() : null;
        const alerts = global.systemMonitor ? global.systemMonitor.getAlerts() : [];
        const healthStatus = global.systemMonitor ? global.systemMonitor.getHealthStatus() : { status: 'unknown', issues: [] };

        // Structure response to match frontend expectations
        const responseData = {
            metrics: {
                system: {
                    memory: {
                        used: usedMemory,
                        total: totalMemory,
                        percentage: (usedMemory / totalMemory) * 100
                    },
                    cpu: {
                        usage: cpuUsage,
                        loadAverage: loadAverage
                    },
                    disk: {
                        used: 0,
                        total: 40 * 1024 * 1024 * 1024,
                        percentage: 0
                    },
                    uptime: process.uptime()
                },
                application: {
                    requests: {
                        total: loadBalancerStats.totalRequests || 0,
                        active: loadBalancerStats.activeRequests || 0,
                        completed: loadBalancerStats.completedRequests || 0,
                        failed: loadBalancerStats.failedRequests || 0
                    },
                    responseTime: {
                        average: loadBalancerStats.averageResponseTime || 0,
                        min: systemMonitorMetrics?.application?.responseTime?.min || 0,
                        max: systemMonitorMetrics?.application?.responseTime?.max || 0
                    },
                    errors: {
                        count: loadBalancerStats.failedRequests || 0,
                        lastError: null
                    }
                },
                database: {
                    connections: dbConnectionStats,
                    queries: {
                        total: systemMonitorMetrics?.database?.queries?.total || 0,
                        slow: systemMonitorMetrics?.database?.queries?.slow || 0,
                        failed: systemMonitorMetrics?.database?.queries?.failed || 0
                    },
                    responseTime: {
                        average: systemMonitorMetrics?.database?.responseTime?.average || 0,
                        min: systemMonitorMetrics?.database?.responseTime?.min || 0,
                        max: systemMonitorMetrics?.database?.responseTime?.max || 0
                    }
                }
            },
            system: {
                uptime: process.uptime(),
                memory: {
                    used: usedMemory,
                    total: totalMemory,
                    free: freeMemory,
                    percentage: (usedMemory / totalMemory) * 100
                },
                cpu: {
                    usage: cpuUsage,
                    cores: cpus.length,
                    model: cpus[0]?.model || 'Unknown',
                    loadAvg: loadAverage
                },
                platform: os.platform(),
                hostname: os.hostname()
            },
            health: healthStatus,
            loadBalancer: loadBalancerStats,
            alerts: alerts.slice(0, 10),
            alertStats: {
                total: alerts.length,
                active: alerts.filter(a => !a.resolved).length,
                resolved: alerts.filter(a => a.resolved).length,
                last24h: alerts.filter(a => new Date(a.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length,
                bySeverity: {
                    warning: alerts.filter(a => a.severity === 'warning').length,
                    critical: alerts.filter(a => a.severity === 'critical').length,
                    emergency: alerts.filter(a => a.severity === 'emergency').length
                }
            }
        };

        log.success('GetMonitoringDashboard', { alertCount: alerts.length, uptime: process.uptime() });
        return sendSuccessResponse(res, responseData);
    } catch (error) {
        log.error('GetMonitoringDashboard failed', { error: error.message });
        return res.status(500).json({ error: 'Internal server error', message: error.message });
    }
};

/**
 * Get system logs
 * GET /api/admin/logs
 */
export const getSystemLogs = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetSystemLogs', {});

    try {
        // For now, return sample log data
        const logs = [
            { timestamp: new Date().toISOString(), level: 'INFO', message: 'Sistem berjalan normal', user: 'admin' },
            { timestamp: new Date(Date.now() - 60000).toISOString(), level: 'INFO', message: 'Database backup otomatis berhasil', user: 'system' },
            { timestamp: new Date(Date.now() - 120000).toISOString(), level: 'WARNING', message: 'Tingkat kehadiran rendah hari ini', user: 'system' }
        ];
        log.success('GetSystemLogs', { count: logs.length });
        res.json({ logs });
    } catch (error) {
        log.error('GetSystemLogs failed', { error: error.message });
        return sendDatabaseError(res, error);
    }
};
