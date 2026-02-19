import DatabaseOptimization from './database-optimization.js';
import QueryOptimizer from './query-optimizer.js';
import BackupSystem from './backup-system.js';
import DownloadQueue from './queue-system.js';
import CacheSystem from './cache-system.js';
import SystemMonitor from './monitoring-system.js';
import SecuritySystem from './security-system.js';
import PerformanceOptimizer from './performance-optimizer.js';
import { formatWIBTime } from '../../utils/timeUtils.js';
import { setPool } from '../../config/db.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('Initializer');

export async function initializeDatabase(ddosProtectionInstance = null) {
    console.log('Initializing optimized database connection...');

    // Systems variables
    const dbOptimization = new DatabaseOptimization();
    let queryOptimizer = null;
    let backupSystem = null;
    let downloadQueue = null;
    let cacheSystem = null;
    let systemMonitor = null;
    let securitySystem = null;
    let performanceOptimizer = null;

    try {
        // Initialize database optimization system
        await dbOptimization.initialize();
        globalThis.dbOptimization = dbOptimization;
        globalThis.dbPool = dbOptimization.pool;
        console.log('Database optimization system initialized successfully');

        // Initialize query optimizer
        queryOptimizer = new QueryOptimizer(dbOptimization.pool);
        await queryOptimizer.initialize();
        console.log('Query optimizer initialized successfully');

        // Initialize backup system with shared database pool
        backupSystem = new BackupSystem();
        await backupSystem.initialize(dbOptimization.pool);
        globalThis.backupSystem = backupSystem;
        console.log('Backup system initialized successfully');

        // Initialize download queue system
        downloadQueue = new DownloadQueue();
        await downloadQueue.initialize();
        console.log('Download queue system initialized successfully');

        // Initialize cache system
        cacheSystem = new CacheSystem();
        await cacheSystem.initialize();
        console.log('Cache system initialized successfully');

        // Initialize system monitor
        systemMonitor = new SystemMonitor({
            monitoringInterval: 5000,
            alertThresholds: {
                memory: 1.5 * 1024 * 1024 * 1024, // 1.5GB
                cpu: 80, // 80%
                disk: 35 * 1024 * 1024 * 1024, // 35GB
                responseTime: 5000, // 5 seconds
                dbConnections: 15 // 15 connections
            },
            alertCooldown: 60000, // 1 minute
            logFile: 'logs/monitoring.log'
        });
        systemMonitor.start();
        globalThis.systemMonitor = systemMonitor;
        console.log('System monitor initialized and started');

        // Initialize security system
        securitySystem = new SecuritySystem({
            rateLimiting: {
                enabled: true,
                windowMs: 60000, // 1 minute
                maxRequests: 1000,
                skipSuccessfulRequests: false,
                skipFailedRequests: false
            },
            inputValidation: {
                enabled: true,
                maxLength: 10000000, // 10MB untuk mengakomodasi base64 data
                allowedChars: /^[a-zA-Z0-9\s_@.!#$%^&*()+=[\]{};':"\\|,<>/?`~-]+$/,
                sqlInjectionPatterns: [
                    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
                    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
                    /(\b(OR|AND)\s+['"]\s*=\s*['"])/i,
                    /(\b(OR|AND)\s+1\s*=\s*1)/i,
                    /(\b(OR|AND)\s+0\s*=\s*0)/i,
                    /(\b(OR|AND)\s+true)/i,
                    /(\b(OR|AND)\s+false)/i,
                    /(UNION\s+SELECT)/i,
                    /(DROP\s+TABLE)/i,
                    /(DELETE\s+FROM)/i,
                    /(INSERT\s+INTO)/i,
                    /(UPDATE\s+SET)/i,
                    /(CREATE\s+TABLE)/i,
                    /(ALTER\s+TABLE)/i,
                    /(EXEC\s*\()/i,
                    /(SCRIPT\s*>)/i,
                    /(<\s*SCRIPT)/i,
                    /(JAVASCRIPT\s*:)/i,
                    /(ON\s+LOAD\s*=)/i,
                    /(ON\s+ERROR\s*=)/i,
                    /(ON\s+FOCUS\s*=)/i,
                    /(ON\s+CLICK\s*=)/i
                ],
                xssPatterns: [
                    /<script[^>]*>.*?<\/script>/gi,
                    /<script[^>]*>/gi,
                    /javascript:/gi,
                    /on\w+\s*=/gi,
                    /<iframe[^>]*>.*?<\/iframe>/gi,
                    /<object[^>]*>.*?<\/object>/gi,
                    /<embed[^>]*>.*?<\/embed>/gi,
                    /<link[^>]*>.*?<\/link>/gi,
                    /<meta[^>]*>.*?<\/meta>/gi,
                    /<style[^>]*>.*?<\/style>/gi
                ]
            }
        });
        globalThis.securitySystem = securitySystem;

        // Initialize performance optimizer
        performanceOptimizer = new PerformanceOptimizer({
            queryOptimization: {
                enabled: true,
                maxCacheSize: 1000,
                defaultTTL: 300000, // 5 minutes
                slowQueryThreshold: 1000 // 1 second
            },
            memoryOptimization: {
                enabled: true,
                gcInterval: 300000, // 5 minutes
                maxMemoryUsage: 1.8 * 1024 * 1024 * 1024, // 1.8GB
                enableMemoryMonitoring: true
            }
        });
        await performanceOptimizer.initialize();
        console.log('Performance optimizer initialized successfully');

        // Get connection pool for use in endpoints
        globalThis.dbPool = dbOptimization.pool;  // Use the actual pool, not the class instance

        // Wrap database pool to monitor all queries
        if (globalThis.dbPool) {
            const originalExecute = globalThis.dbPool.execute.bind(globalThis.dbPool);
            globalThis.dbPool.execute = async function(sql, params) {
                const start = Date.now();
                try {
                    const result = await originalExecute(sql, params);
                    if (globalThis.systemMonitor) globalThis.systemMonitor.recordQuery(Date.now() - start, true);
                    return result;
                } catch (err) {
                    if (globalThis.systemMonitor) globalThis.systemMonitor.recordQuery(Date.now() - start, false);
                    throw err;
                }
            };

            const originalQuery = globalThis.dbPool.query.bind(globalThis.dbPool);
            globalThis.dbPool.query = async function(sql, params) {
                const start = Date.now();
                try {
                    const result = await originalQuery(sql, params);
                    if (globalThis.systemMonitor) globalThis.systemMonitor.recordQuery(Date.now() - start, true);
                    return result;
                } catch (err) {
                    if (globalThis.systemMonitor) globalThis.systemMonitor.recordQuery(Date.now() - start, false);
                    throw err;
                }
            };
            logger.info('Database pool wrapped for monitoring');
            
            // Register pool to centralized config
            setPool(globalThis.dbPool);
        }
        globalThis.dbOptimization = dbOptimization;
        globalThis.queryOptimizer = queryOptimizer;
        globalThis.performanceOptimizer = performanceOptimizer;
        globalThis.backupSystem = backupSystem;
        globalThis.downloadQueue = downloadQueue;
        globalThis.cacheSystem = cacheSystem;
        globalThis.systemMonitor = systemMonitor;
        globalThis.securitySystem = securitySystem;

        // Handle DDoS Protection reference if passed
        if (ddosProtectionInstance) {
            globalThis.ddosProtection = ddosProtectionInstance;
        }

        globalThis.testAlerts = [];

        // Set database pool reference for monitoring
        systemMonitor.setDatabasePool(dbOptimization);

        console.log('All systems initialized and ready');

    } catch (error) {
        console.error('Failed to initialize database optimization:', error.message);
        console.log('Retrying initialization in 5 seconds...');

        return new Promise((resolve, reject) => {
            setTimeout(() => {
                initializeDatabase(ddosProtectionInstance).then(resolve).catch(reject);
            }, 5000);
        });
    }
}
