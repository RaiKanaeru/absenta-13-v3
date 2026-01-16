// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

console.log('🚀 ABSENTA Modern Server Starting...');
console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🌐 API Base URL: ${process.env.API_BASE_URL || 'http://localhost:3001'}`);

import express from 'express';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import DatabaseOptimization from './server/services/system/database-optimization.js';

import QueryOptimizer from './server/services/system/query-optimizer.js';
import BackupSystem from './server/services/system/backup-system.js';
import DownloadQueue from './server/services/system/queue-system.js';
import CacheSystem from './server/services/system/cache-system.js';
import SystemMonitor from './server/services/system/monitoring-system.js';
import SecuritySystem from './server/services/system/security-system.js';
import PerformanceOptimizer from './server/services/system/performance-optimizer.js';
import DDoSProtection from './server/utils/ddos-protection.js';
import rateLimit from 'express-rate-limit';
import authRoutes from './server/routes/authRoutes.js';
import adminRoutes from './server/routes/adminRoutes.js';
import guruRoutes from './server/routes/guruRoutes.js';
import siswaRoutes from './server/routes/siswaRoutes.js';
import mapelRoutes from './server/routes/mapelRoutes.js';
import kelasRoutes from './server/routes/kelasRoutes.js';
import jadwalRoutes from './server/routes/jadwalRoutes.js';
import ruangRoutes from './server/routes/ruangRoutes.js';
import userInfoRoutes from './server/routes/userInfoRoutes.js';
import bandingAbsenRoutes from './server/routes/bandingAbsenRoutes.js';
import adminDashboardRoutes from './server/routes/adminDashboardRoutes.js';
import bandingAbsenSiswaGuruRoutes from './server/routes/bandingAbsenSiswaGuruRoutes.js';
import reportsRoutes from './server/routes/reportsRoutes.js';
import teacherDataRoutes from './server/routes/teacherDataRoutes.js';
import studentDataRoutes from './server/routes/studentDataRoutes.js';
import absensiRoutes from './server/routes/absensiRoutes.js';
import exportRoutes from './server/routes/exportRoutes.js';
import letterheadRoutes from './server/routes/letterheadRoutes.js';
import dashboardRoutes from './server/routes/dashboardRoutes.js';
import backupRoutes from './server/routes/backupRoutes.js';
import templateRoutes from './server/routes/templateRoutes.js';
import importRoutes from './server/routes/importRoutes.js';
import monitoringRoutes from './server/routes/monitoringRoutes.js';
import jamPelajaranRoutes from './server/routes/jamPelajaranRoutes.js';
import templateExportRoutes from './server/routes/templateExportRoutes.js';
import attendanceSettingsRoutes from './server/routes/attendanceSettingsRoutes.js';
import kalenderAkademikRoutes from './server/routes/kalenderAkademikRoutes.js';
import { requestIdMiddleware, notFoundHandler, globalErrorHandler } from './server/middleware/globalErrorMiddleware.js';
import { 
    formatWIBTime, getWIBTimestamp 
} from './server/utils/timeUtils.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './server/config/swaggerConfig.js';

// Configuration from environment variables
const port = Number.parseInt(process.env.PORT) || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'absenta-super-secret-key-2025';
const saltRounds = Number.parseInt(process.env.SALT_ROUNDS) || 10;
const uploadDir = process.env.UPLOAD_DIR || 'public/uploads';

// Validate critical environment variables in production
if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'absenta-super-secret-key-2025') {
        console.error('❌ CRITICAL: JWT_SECRET must be set in production!');
        process.exit(1);
    }
    if (!process.env.DB_PASSWORD) {
        console.warn('⚠️  WARNING: DB_PASSWORD is empty in production!');
    }
}

// Multer configuration for logo upload
const uploadLogo = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, `${uploadDir}/letterheads/`);
        },
        filename: (req, file, cb) => {
            const timestamp = getWIBTimestamp();
            const extension = path.extname(file.originalname);
            const logoType = req.body.logoType || 'logo';
            cb(null, `${logoType}_${timestamp}${extension}`);
        }
    }),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error('Format file tidak didukung. Gunakan JPG, PNG, atau GIF'));
    }
});

// Ensure upload directory exists
try {
    await mkdir(`${uploadDir}/letterheads`, { recursive: true });
} catch (err) {
    console.error(err);
}

const app = express();
app.set('trust proxy', 2);

// ================================================
// TIMEZONE CONFIGURATION
// ================================================
// Time functions are now imported from server/utils/timeUtils.js

// Parse allowed origins from environment
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [
        // Production domains
        'https://absenta13.my.id',
        'https://api.absenta13.my.id',
        // Development domains
        'http://localhost:8080',
        'http://localhost:8081',
        'http://localhost:5173',
        'http://localhost:3000',
        // Allow network access - replace with your actual IP
        'http://192.168.1.100:8080',
        'http://192.168.1.100:8081',
        'http://192.168.1.100:5173',
        'http://192.168.1.100:3000'
    ];

console.log('🔐 CORS Allowed Origins:', allowedOrigins);

// CORS configuration with proper preflight handling
const corsOptions = {
    credentials: true,
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, Postman)
        if (!origin) {
            return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        // Log blocked origin for debugging
        console.log(`⚠️ CORS blocked origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    optionsSuccessStatus: 200 // For legacy browser support
};

// Middleware setup

// CRITICAL: Manual CORS headers FIRST - ensures CORS works even if error occurs later
// This catches preflight OPTIONS and sets headers before any other middleware
app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    // Check if origin is allowed
    if (!origin || allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin || '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
        res.header('Access-Control-Expose-Headers', 'Content-Disposition');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Max-Age', '86400'); // 24 hours preflight cache
    }
    
    // Handle preflight OPTIONS request immediately
    if (req.method === 'OPTIONS') {
        console.log(`✅ CORS preflight handled for origin: ${origin}`);
        return res.status(200).end();
    }
    
    next();
});

// Security Headers middleware (CSP, HSTS, COOP, COEP) for PageSpeed optimization
app.use((req, res, next) => {
    // HSTS - Force HTTPS
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    
    // Content Security Policy
    res.header('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://static.cloudflareinsights.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://api.absenta13.my.id https://www.google-analytics.com https://static.cloudflareinsights.com",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'"
    ].join('; '));
    
    // Cross-Origin-Opener-Policy
    res.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    
    // X-Content-Type-Options
    res.header('X-Content-Type-Options', 'nosniff');
    
    // X-Frame-Options
    res.header('X-Frame-Options', 'SAMEORIGIN');
    
    // X-XSS-Protection
    res.header('X-XSS-Protection', '1; mode=block');
    
    // Referrer-Policy
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions-Policy
    res.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    next();
});

// Standard CORS middleware (backup)
app.use(cors(corsOptions));

// Handle preflight requests implies by above middleware or explicit options if needed
// app.options('*', cors(corsOptions)); // Removing this to prevent path-to-regexp error

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(requestIdMiddleware);  // Add request ID tracking for debugging

// Real-time Request Monitoring Middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const success = res.statusCode < 400;
        if (globalThis.systemMonitor) {
            globalThis.systemMonitor.recordRequest(duration, success);
        }
    });
    next();
});

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 2000 : 5000,
    message: 'Terlalu banyak request, coba lagi nanti.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// DDoS Protection middleware - enhanced anti-spam/DDoS
let ddosProtection = null;
if (process.env.ENABLE_DDOS_PROTECTION !== 'false') {
    ddosProtection = new DDoSProtection({
        maxRequestsPerWindow: process.env.NODE_ENV === 'production' ? 2000 : 5000,
        maxRequestsPerSecond: process.env.NODE_ENV === 'production' ? 100 : 200,
        spikeThreshold: process.env.NODE_ENV === 'production' ? 50 : 100,
        blockDurationMs: 300000 // 5 minutes
    });
    app.use(ddosProtection.middleware());
}

// Serve static files from public directory
app.use('/uploads', express.static(`${uploadDir}`));

// ================================================
// SYSTEM INITIALIZATION
// ================================================
// DATABASE OPTIMIZATION SYSTEM - Connection Pool
// ================================================
const dbOptimization = new DatabaseOptimization();
let queryOptimizer = null;
let backupSystem = null;
let downloadQueue = null;
let cacheSystem = null;
let systemMonitor = null;
let securitySystem = null;
let ddosStats = null;
let performanceOptimizer = null;


async function initializeDatabase() {
    console.log('🔄 Initializing optimized database connection...');
    try {
        // Initialize database optimization system
        await dbOptimization.initialize();
        console.log('✅ Database optimization system initialized successfully');

        // Initialize query optimizer
        queryOptimizer = new QueryOptimizer(dbOptimization.pool);
        await queryOptimizer.initialize();
        console.log('✅ Query optimizer initialized successfully');

        // Initialize backup system with shared database pool
        backupSystem = new BackupSystem();
        await backupSystem.initialize(dbOptimization.pool);
        console.log('✅ Backup system initialized successfully');

        // Initialize download queue system
        downloadQueue = new DownloadQueue();
        await downloadQueue.initialize();
        console.log('✅ Download queue system initialized successfully');

        // Initialize cache system
        cacheSystem = new CacheSystem();
        await cacheSystem.initialize();
        console.log('✅ Cache system initialized successfully');


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
        console.log('✅ System monitor initialized and started');


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
                allowedChars: /^[a-zA-Z0-9\s_@.!#$%^&*()+=[\]{};':"\\|,.<>\x2F?`~=-]+$/, // Menambahkan +/= untuk base64
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
            },
            auditLogging: {
                enabled: true,
                logFile: 'logs/security-audit.log',
                logLevel: 'info',
                sensitiveFields: ['password', 'token', 'secret', 'key'],
                maxLogSize: 10 * 1024 * 1024, // 10MB
                maxLogFiles: 5
            }
        });

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
        console.log('✅ Performance optimizer initialized successfully');

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
            console.log('✅ Database pool wrapped for monitoring');
        }
        globalThis.dbOptimization = dbOptimization;  // Keep reference to full class for methods like getPoolStats()
        globalThis.queryOptimizer = queryOptimizer;
        globalThis.performanceOptimizer = performanceOptimizer;
        globalThis.backupSystem = backupSystem;
        globalThis.downloadQueue = downloadQueue;
        globalThis.cacheSystem = cacheSystem;
        globalThis.systemMonitor = systemMonitor;
        globalThis.securitySystem = securitySystem;
        globalThis.ddosProtection = ddosProtection;
        globalThis.testAlerts = [];
        
        // Set database pool reference for monitoring
        systemMonitor.setDatabasePool(dbOptimization);
        
        console.log('✅ All systems initialized and ready');

    } catch (error) {
        console.error('❌ Failed to initialize database optimization:', error.message);
        console.log('🔄 Retrying initialization in 5 seconds...');
        
        // Correctly chain the promise for retry so server doesn't start prematurely
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                initializeDatabase().then(resolve).catch(reject);
            }, 5000);
        });
    }
}

// ================================================
// SECURITY MIDDLEWARE
// ================================================

// Security middleware
app.use((req, res, next) => {
    if (globalThis.securitySystem) {
        // Use the rate limit middleware from SecuritySystem
        globalThis.securitySystem.rateLimitMiddleware()(req, res, (err) => {
            if (err) {
                return res.status(500).json({ error: 'Security middleware error' });
            }

            // Input validation (skip for letterhead endpoints due to large base64 data)
            if (req.body && typeof req.body === 'object' && !req.path.includes('/letterhead')) {
                const validationResult = globalThis.securitySystem.validateInput(req.body, 'body');
                if (validationResult.violations && validationResult.violations.length > 0) {
                    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
                    globalThis.securitySystem.logSecurityEvent('input_validation_failed', {
                        ip: clientIP,
                        path: req.path,
                        method: req.method,
                        violations: validationResult.violations,
                        timestamp: formatWIBTime()
                    });

                    return res.status(400).json({
                        error: 'Invalid input',
                        message: 'Input validation failed',
                        violations: validationResult.violations
                    });
                }
            }

            // Audit logging
            const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
            globalThis.securitySystem.logSecurityEvent('request', {
                ip: clientIP,
                path: req.path,
                method: req.method,
                userAgent: req.get('User-Agent'),
                timestamp: formatWIBTime()
            });

            next();
        });
    } else {
        next();
    }
});


// ================================================
// MIDDLEWARE - JWT Authentication & Authorization
// ================================================


// ================================================
// AUTHENTICATION ENDPOINTS
// ================================================

// Login endpoint - Real authentication with MySQL
// ================================================
// HEALTH CHECK ENDPOINT
// ================================================

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
console.log('📄 Swagger Docs available at /api-docs');

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// ================================================
// AUTHENTICATION ENDPOINTS
// ================================================

// Auth Routes (Modularized)
app.use('/api', authRoutes);

// ================================================
// PROFILE MANAGEMENT ENDPOINTS
// ================================================

// ================================================
// PROFILE MANAGEMENT ENDPOINTS
// ================================================

// Admin Routes (Modularized)
app.use('/api/admin', adminRoutes);

// ================================================
// MODULARIZED ENDPOINTS
// ================================================

// Update profile for guru
// ================================================




// ================================================
// CRUD ENDPOINTS - ADMIN ONLY
// ================================================

// BACKUP, TEMPLATE, IMPORT, MONITORING ROUTES
// Must be defined BEFORE entity CRUD routes to avoid "template-basic" being caught as ":id"
app.use('/api/admin', backupRoutes); // Backup endpoints
app.use('/api/admin', templateRoutes); // Template download endpoints
app.use('/api/admin', importRoutes); // Import Excel endpoints
app.use('/api/admin', monitoringRoutes); // Monitoring endpoints
app.use('/api/admin/export', templateExportRoutes); // Template-based Excel export

// SISWA CRUD
// SISWA CRUD (Modularized)
app.use('/api/admin/siswa', siswaRoutes);
app.use('/api/siswa', siswaRoutes); // Profile routes for self-service
// Guru Routes (Modularized)
app.use('/api/admin/guru', guruRoutes);
app.use('/api/guru', guruRoutes); // Profile routes for self-service

// MAPEL CRUD
// MAPEL CRUD (Modularized)
app.use('/api/admin/mapel', mapelRoutes);

// KELAS CRUD (Modularized)
app.use('/api/kelas', kelasRoutes); // Public route for dropdown uses /public sub-route
app.use('/api/admin/kelas', kelasRoutes);

// JADWAL CRUD (Modularized)
app.use('/api/admin/jadwal', jadwalRoutes);

// JAM PELAJARAN (Dynamic Time Slots per Kelas)
app.use('/api/admin/jam-pelajaran', jamPelajaranRoutes);

// RUANG CRUD (Modularized)
app.use('/api/admin/ruang', ruangRoutes);
app.use('/api', userInfoRoutes); // User self-service info endpoints
app.use('/api', bandingAbsenRoutes);
app.use('/api/admin', bandingAbsenRoutes); // Alias for frontend compatibility
app.use('/api', bandingAbsenSiswaGuruRoutes); // Siswa & Guru banding endpoints
app.use('/api/admin', reportsRoutes); // Analytics & Reports endpoints
app.use('/api/admin', adminDashboardRoutes); // Admin dashboard teacher/student management (User Accounts)
app.use('/api/admin/teachers-data', teacherDataRoutes); // Teacher Data Master
app.use('/api/admin', studentDataRoutes); // Student Data Master & Promotion

// ABSENSI CRUD (Modularized)
app.use('/api/attendance', absensiRoutes); // Attendance submit endpoints
app.use('/api', absensiRoutes); // Schedule and siswa endpoints (uses /schedule/:id/... and /siswa/...)

// EXPORT ROUTES (Modularized)
app.use('/api/export', exportRoutes); // All export endpoints
app.use('/api/admin/export', exportRoutes); // Alias for frontend compatibility
app.use('/api/admin', letterheadRoutes); // All letterhead endpoints
app.use('/api/dashboard', dashboardRoutes); // Dashboard stats and chart
app.use('/api/admin', dashboardRoutes); // Alias: /api/admin/live-summary
app.use('/api/admin/attendance-settings', attendanceSettingsRoutes); // Attendance settings config
app.use('/api/admin/kalender-akademik', kalenderAkademikRoutes); // Kalender akademik (hari efektif)


// Route Aliases for Frontend Compatibility
app.use('/api/admin/classes', kelasRoutes); // Alias: /api/admin/classes -> kelas
app.use('/api/admin/subjects', mapelRoutes); // Alias: /api/admin/subjects -> mapel
app.use('/api/admin/students', siswaRoutes); // Alias: /api/admin/students -> siswa

// ================================================
// GLOBAL ERROR HANDLERS (MUST BE AFTER ALL ROUTES)
// ================================================
app.use(notFoundHandler);  // Handle 404 - API routes not found
app.use(globalErrorHandler);  // Handle all unhandled errors



// ================================================
// ALL API ENDPOINTS MODULARIZED
// See server/routes/ and server/controllers/ for implementations
// Inline endpoints removed during refactoring - December 2024
// ================================================

import { initAutoAttendanceScheduler } from './server/services/system/autoAttendanceService.js';

try {
    await initializeDatabase();
    
    // Initialize scheduled tasks (Cron Jobs)
    initAutoAttendanceScheduler();

    const server = app.listen(port, '0.0.0.0', () => {
        console.log(`🚀 ABSENTA Modern Server is running on http://0.0.0.0:${port}`);
        console.log(`🌐 Accessible from network: http://[YOUR_IP]:${port}`);
        console.log(`📱 Frontend should connect to this server`);
        console.log(`🔧 Database optimization: Connection pool active`);
    });

    // Graceful Shutdown
    const shutdown = async (signal) => {
        console.log(`\n🛑 ${signal} received. Closing resources...`);
        try {
            if (globalThis.dbOptimization) {
                await globalThis.dbOptimization.close();
                console.log('✅ Database connection pool closed.');
            }
            if (globalThis.systemMonitor) {
                // Save any pending metrics if needed
                console.log('✅ System monitor stopped.');
            }
            server.close(() => {
                console.log('✅ HTTP server closed.');
                process.exit(0);
            });
        } catch (err) {
            console.error('❌ Error during shutdown:', err);
            process.exit(1);
        }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

} catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
}
