/**
 * Monitoring Controller
 * Menangani monitoring sistem, keamanan, dan performa
 */

import os from 'node:os';
import { sendDatabaseError, sendErrorResponse, sendNotFoundError, sendServiceUnavailableError, sendValidationError, sendSuccessResponse } from '../utils/errorHandler.js';
import { formatBytes } from '../utils/formatUtils.js';
import { createLogger } from '../utils/logger.js';
import db from '../config/db.js';

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
        const stats = globalThis.securitySystem.getSecurityStats();
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
        const events = globalThis.securitySystem.getSecurityEvents(Number.parseInt(limit), type);
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
        const blockedIPs = globalThis.securitySystem.getBlockedIPs();
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
        globalThis.securitySystem.blockIP(ip, reason || 'Manual block by admin');
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
        globalThis.securitySystem.unblockIP(ip);
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
        globalThis.securitySystem.clearSecurityEvents();
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
 * Helper to calculate CPU usage percentage
 */
function calculateCpuUsage(cpuUsageData) {
    let cpuUsagePercent = 0;
    if (globalThis.lastCpuUsage) {
        const userDiff = cpuUsageData.user - globalThis.lastCpuUsage.user;
        const systemDiff = cpuUsageData.system - globalThis.lastCpuUsage.system;
        const totalDiff = userDiff + systemDiff;
        const timeElapsed = Date.now() - (globalThis.lastCpuTime || Date.now());
        if (timeElapsed > 0) {
            cpuUsagePercent = Math.min(100, Math.max(0, (totalDiff / (timeElapsed * 1000)) * 100));
        }
    }
    return cpuUsagePercent;
}

/**
 * Helper to get safe Load Balancer stats
 */
function getLoadBalancerSafeStats() {
    return globalThis.loadBalancer ? globalThis.loadBalancer.getStats() : {
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
}

/**
 * Helper to build system metrics object
 */
function buildSystemMetrics({ memoryUsage, uptime, cpuUsageData, cpus, loadAvg, totalMemory, freeMemory, usedMemory, cpuUsagePercent }) {
    return {
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
}

/**
 * Helper to calculate health status from metrics
 */
function calculateHealthFromMetrics(memoryPercent, heapPercent, cpuUsage, diskMetrics) {
    const issues = [];
    let status = 'healthy';
    
    const checkThreshold = (value, highThreshold, warnThreshold, label) => {
        if (value > highThreshold) {
            if (status !== 'critical') status = 'critical';
            issues.push(`${label} usage critical: ${value.toFixed(1)}%`);
        } else if (value > warnThreshold) {
            if (status === 'healthy') status = 'warning';
            issues.push(`${label} usage high: ${value.toFixed(1)}%`);
        }
    };
    
    checkThreshold(memoryPercent, 90, 75, 'System memory');
    checkThreshold(heapPercent, 90, 75, 'Heap memory');
    checkThreshold(cpuUsage, 90, 75, 'CPU');
    
    if (diskMetrics) {
        checkThreshold(diskMetrics.percentage, 90, 80, 'Disk');
    }
    
    return { status, issues, timestamp: new Date().toISOString() };
}


/**
 * Helper to build dashboard response object
 */
function buildDashboardResponse(systemData, appData, dbData, otherData) {
    const { totalMemory, usedMemory, freeMemory, cpuUsage, loadAverage, cpus, diskMetrics, heapInfo } = systemData;
    const { systemMonitorMetrics, dbConnectionStats } = dbData;
    const { loadBalancerStats, alerts, healthStatus } = otherData;

    // Calculate percentages
    const memoryPercent = (usedMemory / totalMemory) * 100;
    const heapPercent = heapInfo ? (heapInfo.used / heapInfo.total) * 100 : 0;
    
    // Use existing healthStatus or calculate from metrics
    const calculatedHealth = (healthStatus && healthStatus.status !== 'unknown') 
        ? healthStatus 
        : calculateHealthFromMetrics(memoryPercent, heapPercent, cpuUsage, diskMetrics);


    return {
        metrics: {
            system: {
                memory: {
                    used: usedMemory,
                    total: totalMemory,
                    percentage: memoryPercent
                },
                heap: heapInfo ? {
                    used: heapInfo.used,
                    total: heapInfo.total,
                    percentage: heapPercent
                } : null,
                cpu: {
                    usage: cpuUsage,
                    loadAverage: loadAverage
                },
                disk: diskMetrics || {
                    used: 0,
                    total: 40 * 1024 * 1024 * 1024,
                    percentage: 0
                },
                uptime: process.uptime()
            },
            application: {
                requests: {
                    total: systemMonitorMetrics?.application?.requests?.total || loadBalancerStats?.totalRequests || 0,
                    active: systemMonitorMetrics?.application?.requests?.active || loadBalancerStats?.activeRequests || 0,
                    completed: systemMonitorMetrics?.application?.requests?.completed || loadBalancerStats?.completedRequests || 0,
                    failed: systemMonitorMetrics?.application?.requests?.failed || loadBalancerStats?.failedRequests || 0
                },
                responseTime: {
                    average: systemMonitorMetrics?.application?.responseTime?.average || loadBalancerStats?.averageResponseTime || 0,
                    min: systemMonitorMetrics?.application?.responseTime?.min || 0,
                    max: systemMonitorMetrics?.application?.responseTime?.max || 0
                },
                errors: {
                    count: systemMonitorMetrics?.application?.requests?.failed || loadBalancerStats?.failedRequests || 0,
                    lastError: systemMonitorMetrics?.application?.errors?.lastError || null
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
                percentage: memoryPercent
            },
            heap: heapInfo,
            cpu: {
                usage: cpuUsage,
                cores: cpus.length,
                model: cpus[0]?.model || 'Unknown',
                loadAvg: loadAverage
            },
            disk: diskMetrics,
            platform: os.platform(),
            hostname: os.hostname(),
            nodeVersion: process.version,
            pid: process.pid
        },
        health: calculatedHealth,
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
}



/**
 * Get system metrics
 * GET /api/admin/system-metrics
 */
export const getSystemMetrics = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetSystemMetrics', {});

    try {
        const metrics = globalThis.systemMonitor.getMetrics();
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
        const alerts = globalThis.systemMonitor.getAlerts();
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
        const history = globalThis.systemMonitor.getPerformanceHistory();
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
        globalThis.systemMonitor.clearAlerts();
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
        const stats = globalThis.loadBalancer ? globalThis.loadBalancer.getStats() : null;
        log.success('GetLoadBalancerStats', { available: !!globalThis.loadBalancer });
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
        if (globalThis.cacheSystem) {
            await globalThis.cacheSystem.warmUp();
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
        if (globalThis.cacheSystem) {
            globalThis.cacheSystem.clear();
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
        const metrics = globalThis.performanceOptimizer ? globalThis.performanceOptimizer.getMetrics() : null;
        log.success('GetPerformanceMetrics', { available: !!globalThis.performanceOptimizer });
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
        if (globalThis.performanceOptimizer) {
            globalThis.performanceOptimizer.clearCache();
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
        if (globalThis.loadBalancer) {
            if (enabled) {
                await globalThis.loadBalancer.enable();
            } else {
                await globalThis.loadBalancer.disable();
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
        const status = globalThis.circuitBreaker ? globalThis.circuitBreaker.getStatus() : null;
        log.success('GetCircuitBreakerStatus', { available: !!globalThis.circuitBreaker });
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
        if (globalThis.circuitBreaker) {
            globalThis.circuitBreaker.reset();
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
        if (!globalThis.systemMonitor) {
            log.warn('ResolveAlert - system monitor not available');
            return sendServiceUnavailableError(res, 'System monitor tidak tersedia');
        }
        
        const resolved = globalThis.systemMonitor.resolveAlert(alertId);
        
        if (resolved) {
            log.success('ResolveAlert', { alertId });
            return sendSuccessResponse(res, null, `Alert ${alertId} resolved`);
        } else {
            log.warn('ResolveAlert - alert not found', { alertId });
            return sendNotFoundError(res, `Alert ${alertId} tidak ditemukan atau sudah diselesaikan`);
        }
    } catch (error) {
        log.error('ResolveAlert failed', { error: error.message, alertId });
        return sendErrorResponse(res, error, 'Gagal menyelesaikan alert');
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
        if (globalThis.systemMonitor) {
            globalThis.systemMonitor.createTestAlert();
            log.success('TestAlert', {});
            return sendSuccessResponse(res, null, 'Test alert created');
        } else {
            log.warn('TestAlert - system monitor not available');
            return sendServiceUnavailableError(res, 'System monitor tidak tersedia');
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
        const stats = globalThis.downloadQueue ? await globalThis.downloadQueue.getQueueStats() : null;
        log.success('GetQueueStats', { available: !!globalThis.downloadQueue });
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
        const loadBalancerStats = getLoadBalancerSafeStats();

        // Get query optimizer stats
        const queryOptimizerStats = globalThis.loadBalancer ? {
            queryStats: globalThis.loadBalancer.getQueryStats(),
            cacheStats: globalThis.loadBalancer.getCacheStats()
        } : {
            queryStats: {},
            cacheStats: { size: 0, entries: [] }
        };

        // Get system metrics
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();
        // os is imported at top level now
        const cpuUsageData = process.cpuUsage();
        
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const cpus = os.cpus();
        const loadAvg = os.loadavg();

        // Calculate CPU usage
        const cpuUsagePercent = calculateCpuUsage(cpuUsageData);
        globalThis.lastCpuUsage = cpuUsageData;
        globalThis.lastCpuTime = Date.now();

        // Use shared formatBytes utility

        const systemMetrics = buildSystemMetrics({
            memoryUsage, uptime, cpuUsageData, cpus, loadAvg, 
            totalMemory, freeMemory, usedMemory, cpuUsagePercent
        });

        // Get Redis stats
        let redisStats = { connected: false, error: 'Redis not available' };
        if (globalThis.redis && globalThis.redis.isOpen) {
            try {
                const info = await globalThis.redis.info();
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
        return sendDatabaseError(res, error, 'Gagal memuat performa sistem');
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
        // System memory (os level)
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        
        // Node.js heap memory
        const memUsage = process.memoryUsage();
        const heapInfo = {
            used: memUsage.heapUsed,
            total: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss
        };
        
        // CPU usage
        const cpuUsageData = process.cpuUsage();
        const cpus = os.cpus();
        const loadAverage = os.loadavg();

        let cpuUsage = calculateCpuUsage(cpuUsageData);
        globalThis.lastCpuUsage = cpuUsageData;
        globalThis.lastCpuTime = Date.now();
        
        // Fallback to load average for CPU usage (relevant for Unix systems)
        if (cpuUsage === 0 && loadAverage[0] > 0) {
            // Scale by number of cores for percentage
            cpuUsage = Math.min(Math.max((loadAverage[0] / cpus.length) * 100, 0), 100);
        }

        // Disk metrics - try to get actual usage
        let diskMetrics = { used: 0, total: 0, percentage: 0 };
        try {
            // For Windows, use a rough estimate based on current drive
            const platform = os.platform();
            if (platform === 'win32') {
                // Approximate disk usage - server's process memory as reference
                diskMetrics = {
                    used: 0,
                    total: 100 * 1024 * 1024 * 1024, // Assume 100GB default
                    percentage: 0,
                    note: 'Disk metrics not available on Windows in Node.js'
                };
            } else if (globalThis.systemMonitor) {
                // Unix-like systems - get from systemMonitor if available
                const monitorMetrics = globalThis.systemMonitor.getMetrics();
                if (monitorMetrics?.system?.disk) {
                    diskMetrics = monitorMetrics.system.disk;
                }
            }
        } catch {
            // Fallback to defaults
        }

        // Get load balancer stats
        const loadBalancerStats = getLoadBalancerSafeStats();

        // Get database connection stats
        let dbConnectionStats = { active: 0, idle: 0, total: 0 };
        if (globalThis.dbOptimization && globalThis.dbOptimization.pool) {
            const pool = globalThis.dbOptimization.pool;
            dbConnectionStats = {
                active: pool._allConnections?.length || 0,
                idle: pool._freeConnections?.length || 0,
                total: (pool._allConnections?.length || 0) + (pool._freeConnections?.length || 0)
            };
        } else if (db) {
            // Alternative: use main dbPool
            const pool = db.pool;
            if (pool) {
                dbConnectionStats = {
                    active: pool._allConnections?.length || 0,
                    idle: pool._freeConnections?.length || 0,
                    total: (pool._allConnections?.length || 0) + (pool._freeConnections?.length || 0)
                };
            }
        }

        // Get system monitor data
        const systemMonitorMetrics = globalThis.systemMonitor ? globalThis.systemMonitor.getMetrics() : null;
        const alerts = globalThis.systemMonitor ? globalThis.systemMonitor.getAlerts() : [];
        const healthStatus = globalThis.systemMonitor ? globalThis.systemMonitor.getHealthStatus() : { status: 'unknown', issues: [] };

        // Structure response to match frontend expectations
        const responseData = buildDashboardResponse(
            { totalMemory, usedMemory, freeMemory, cpuUsage, loadAverage, cpus, diskMetrics, heapInfo },
            {}, // appData is handled inside helper via systemMonitorMetrics
            { systemMonitorMetrics, dbConnectionStats },
            { loadBalancerStats, alerts, healthStatus }
        );

        log.success('GetMonitoringDashboard', { 
            alertCount: alerts.length, 
            uptime: process.uptime(),
            memoryPercent: ((usedMemory / totalMemory) * 100).toFixed(1),
            heapPercent: ((heapInfo.used / heapInfo.total) * 100).toFixed(1)
        });
        return sendSuccessResponse(res, responseData);
    } catch (error) {
        log.error('GetMonitoringDashboard failed', { error: error.message });
        return sendDatabaseError(res, error, 'Gagal memuat dashboard monitoring');
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

// ================================================
// DDOS PROTECTION ENDPOINTS
// ================================================

/**
 * Get DDoS protection stats
 * GET /api/admin/ddos-stats
 */
export const getDDoSStats = async (req, res) => {
    const log = logger.withRequest(req, res);
    log.requestStart('GetDDoSStats', {});

    try {
        if (!globalThis.ddosProtection) {
            return res.json({
                enabled: false,
                message: 'DDoS Protection tidak diaktifkan'
            });
        }

        const stats = globalThis.ddosProtection.getStats();
        log.success('GetDDoSStats', { 
            totalRequests: stats.totalRequests,
            blockedRequests: stats.blockedRequests,
            activeBlocks: stats.activeBlocks
        });
        
        return sendSuccessResponse(res, {
            enabled: true,
            ...stats
        });
    } catch (error) {
        log.error('GetDDoSStats failed', { error: error.message });
        return sendDatabaseError(res, error);
    }
};

/**
 * Unblock IP from DDoS protection
 * POST /api/admin/ddos-unblock
 */
export const unblockDDoSIP = async (req, res) => {
    const log = logger.withRequest(req, res);
    const { ip } = req.body;
    
    log.requestStart('UnblockDDoSIP', { ip });

    try {
        if (!ip) {
            return sendValidationError(res, 'IP address diperlukan');
        }

        if (!globalThis.ddosProtection) {
            return res.json({
                success: false,
                message: 'DDoS Protection tidak diaktifkan'
            });
        }

        const result = globalThis.ddosProtection.unblockIP(ip);
        
        if (result) {
            log.success('UnblockDDoSIP', { ip });
            return sendSuccessResponse(res, null, `IP ${ip} berhasil di-unblock`);
        } else {
            return res.json({
                success: false,
                message: `IP ${ip} tidak dalam daftar blokir`
            });
        }
    } catch (error) {
        log.error('UnblockDDoSIP failed', { error: error.message });
        return sendDatabaseError(res, error);
    }
};
