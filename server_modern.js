// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

console.log('🚀 ABSENTA Modern Server Starting...');
console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🌐 API Base URL: ${process.env.API_BASE_URL || 'http://localhost:3001'}`);

import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import ExcelJS from 'exceljs';
import multer from 'multer';
import fs, { mkdir } from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import DatabaseOptimization from './database-optimization.js';
import QueryOptimizer from './query-optimizer.js';
import BackupSystem from './backup-system.js';
import DownloadQueue from './queue-system.js';
import CacheSystem from './cache-system.js';
import LoadBalancer from './load-balancer.js';
import SystemMonitor from './monitoring-system.js';
import SecuritySystem from './security-system.js';
import DisasterRecoverySystem from './disaster-recovery-system.js';
import PerformanceOptimizer from './performance-optimizer.js';
import AdmZip from 'adm-zip';
import os from 'os';
import rateLimit from 'express-rate-limit';
import authRoutes from './server/routes/authRoutes.js';
import { authenticateToken, requireRole } from './server/middleware/auth.js';
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
import { 
    getWIBTime, formatWIBTime, formatWIBDate, formatWIBTimeWithSeconds, 
    getWIBTimestamp, getMySQLDateWIB, getMySQLDateTimeWIB, 
    parseDateStringWIB, getDaysDifferenceWIB, getDayNameWIB 
} from './server/utils/timeUtils.js';

// Configuration from environment variables
const port = parseInt(process.env.PORT) || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'absenta-super-secret-key-2025';
const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;
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
mkdir(`${uploadDir}/letterheads`, { recursive: true }).catch(console.error);

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

// Middleware setup
app.use(cors({
    credentials: true,
    origin: allowedOrigins
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    message: 'Terlalu banyak request, coba lagi nanti.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// Serve static files from public directory
app.use('/uploads', express.static(`${uploadDir}`));

// ================================================
// HELPER FUNCTIONS
// ================================================

// Fungsi untuk cek overlap rentang waktu
function isTimeOverlap(start1, end1, start2, end2) {
    return start1 < end2 && start2 < end1;
}

// Helper function untuk build query jadwal yang standar untuk semua role
function buildJadwalQuery(role = 'admin', guruId = null) {
    const baseQuery = `
        SELECT 
            j.id_jadwal as id,
            j.kelas_id,
            j.mapel_id, 
            j.guru_id,
            j.ruang_id,
            j.hari,
            j.jam_ke,
            j.jam_mulai,
            j.jam_selesai,
            j.status,
            j.jenis_aktivitas,
            j.is_absenable,
            j.keterangan_khusus,
            j.is_multi_guru,
            k.nama_kelas,
            COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel,
            COALESCE(g.nama, 'Sistem') as nama_guru,
            rk.kode_ruang,
            rk.nama_ruang,
            rk.lokasi,
            GROUP_CONCAT(CONCAT(jg2.guru_id, ':', g2.nama) ORDER BY jg2.is_primary DESC SEPARATOR '||') as guru_list
        FROM jadwal j
        JOIN kelas k ON j.kelas_id = k.id_kelas
        LEFT JOIN mapel m ON j.mapel_id = m.id_mapel  
        LEFT JOIN guru g ON j.guru_id = g.id_guru
        LEFT JOIN ruang_kelas rk ON j.ruang_id = rk.id_ruang
        LEFT JOIN jadwal_guru jg2 ON j.id_jadwal = jg2.jadwal_id
        LEFT JOIN guru g2 ON jg2.guru_id = g2.id_guru
        WHERE j.status = 'aktif'
    `;

    let whereClause = '';
    let params = [];

    if (role === 'guru' && guruId) {
        whereClause = ' AND (j.guru_id = ? OR jg2.guru_id = ?)';
        params = [guruId, guruId];
    }

    const orderBy = `
        GROUP BY j.id_jadwal
        ORDER BY 
            FIELD(j.hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'),
            j.jam_ke, 
            k.nama_kelas
    `;

    return {
        query: baseQuery + whereClause + orderBy,
        params
    };
}

// Fungsi validasi format jam 24 jam
function validateTimeFormat(timeString) {
    if (!timeString || typeof timeString !== 'string') {
        return false;
    }

    // Regex untuk format 24 jam: HH:MM (00:00 - 23:59)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeString.trim());
}

// Fungsi validasi logika waktu
function validateTimeLogic(startTime, endTime) {
    if (!validateTimeFormat(startTime) || !validateTimeFormat(endTime)) {
        return { valid: false, error: 'Format waktu tidak valid. Gunakan format 24 jam (HH:MM)' };
    }

    // Konversi ke menit untuk perbandingan
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    if (startMinutes >= endMinutes) {
        return { valid: false, error: 'Jam selesai harus setelah jam mulai' };
    }

    return { valid: true };
}

// Fungsi konversi waktu ke menit
function timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
}

// Format bytes to human readable format
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper functions for Excel import mapping
const mapKelasByName = async (namaKelas) => {
    if (!namaKelas || namaKelas === '-') return null;
    const [rows] = await global.dbPool.execute(
        'SELECT id_kelas FROM kelas WHERE nama_kelas = ? AND status = "aktif"',
        [namaKelas.trim()]
    );
    return rows[0]?.id_kelas || null;
};

const mapMapelByName = async (namaMapel) => {
    if (!namaMapel || namaMapel === '-') return null;
    const [rows] = await global.dbPool.execute(
        'SELECT id_mapel FROM mapel WHERE nama_mapel = ? AND status = "aktif"',
        [namaMapel.trim()]
    );
    return rows[0]?.id_mapel || null;
};

const mapGuruByName = async (namaGuru) => {
    if (!namaGuru || namaGuru === '-') return null;
    const [rows] = await global.dbPool.execute(
        'SELECT id_guru FROM guru WHERE nama = ? AND status = "aktif"',
        [namaGuru.trim()]
    );
    return rows[0]?.id_guru || null;
};

const mapRuangByKode = async (kodeRuang) => {
    if (!kodeRuang || kodeRuang === '-') return null;
    const [rows] = await global.dbPool.execute(
        'SELECT id_ruang FROM ruang_kelas WHERE kode_ruang = ? AND status = "aktif"',
        [kodeRuang.trim()]
    );
    return rows[0]?.id_ruang || null;
};





// ================================================
// DATABASE OPTIMIZATION SYSTEM - Connection Pool
// ================================================
const dbOptimization = new DatabaseOptimization();
let queryOptimizer = null;
let backupSystem = null;
let downloadQueue = null;
let cacheSystem = null;
let loadBalancer = null;
let systemMonitor = null;
let securitySystem = null;
let disasterRecoverySystem = null;
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

        // Initialize load balancer with query optimizer integration
        loadBalancer = new LoadBalancer({
            maxConcurrentRequests: 150,
            burstThreshold: 50,
            circuitBreakerThreshold: 10,
            circuitBreakerTimeout: 30000,
            requestTimeout: 10000,
            queryOptimizer: queryOptimizer
        });
        console.log('✅ Load balancer initialized successfully');

        // Populate sample queries to demonstrate cache functionality
        setTimeout(async () => {
            try {
                await loadBalancer.populateSampleQueries();
                console.log('✅ Sample queries populated in load balancer');
            } catch (error) {
                console.error('❌ Failed to populate sample queries:', error);
            }
        }, 5000); // Wait 5 seconds after initialization

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
                maxRequests: 100,
                skipSuccessfulRequests: false,
                skipFailedRequests: false
            },
            inputValidation: {
                enabled: true,
                maxLength: 10000000, // 10MB untuk mengakomodasi base64 data
                allowedChars: /^[a-zA-Z0-9\s\-_@.!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~+/=]+$/, // Menambahkan +/= untuk base64
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
        console.log('✅ Security system initialized');

        // Initialize disaster recovery system
        disasterRecoverySystem = new DisasterRecoverySystem({
            backup: {
                enabled: true,
                schedule: '0 2 * * *', // Daily at 2 AM
                retention: 30, // 30 days
                compression: true,
                encryption: true,
                encryptionKey: 'absenta-disaster-recovery-key-2025',
                backupDir: 'backups/disaster-recovery',
                maxBackupSize: 100 * 1024 * 1024, // 100MB
                parallelBackups: 3
            },
            verification: {
                enabled: true,
                checksum: true,
                integrity: true,
                testRestore: true,
                verificationSchedule: '0 3 * * 0' // Weekly on Sunday at 3 AM
            },
            recovery: {
                enabled: true,
                maxRecoveryTime: 3600000, // 1 hour
                rollbackEnabled: true,
                notificationEnabled: true,
                notificationChannels: ['email', 'sms']
            },
            monitoring: {
                enabled: true,
                healthCheckInterval: 300000, // 5 minutes
                alertThresholds: {
                    backupFailure: 1,
                    verificationFailure: 1,
                    recoveryTime: 1800000 // 30 minutes
                }
            }
        });
        await disasterRecoverySystem.start();
        console.log('✅ Disaster recovery system initialized and started');

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
        global.dbPool = dbOptimization;
        global.queryOptimizer = queryOptimizer;
        global.performanceOptimizer = performanceOptimizer;
        global.backupSystem = backupSystem;
        global.downloadQueue = downloadQueue;
        global.cacheSystem = cacheSystem;
        global.loadBalancer = loadBalancer;
        global.systemMonitor = systemMonitor;
        global.securitySystem = securitySystem;
        global.disasterRecoverySystem = disasterRecoverySystem;
        global.testAlerts = [];
        console.log('✅ Database connection pool, query optimizer, backup system, download queue, cache system, load balancer, system monitor, security system, and disaster recovery system ready');

    } catch (error) {
        console.error('❌ Failed to initialize database optimization:', error.message);
        console.log('🔄 Retrying initialization in 5 seconds...');
        setTimeout(initializeDatabase, 5000);
    }
}

// ================================================
// SECURITY MIDDLEWARE
// ================================================

// Security middleware
app.use((req, res, next) => {
    if (global.securitySystem) {
        // Use the rate limit middleware from SecuritySystem
        global.securitySystem.rateLimitMiddleware()(req, res, (err) => {
            if (err) {
                return res.status(500).json({ error: 'Security middleware error' });
            }

            // Input validation (skip for letterhead endpoints due to large base64 data)
            if (req.body && typeof req.body === 'object' && !req.path.includes('/letterhead')) {
                const validationResult = global.securitySystem.validateInput(req.body, 'body');
                if (validationResult.violations && validationResult.violations.length > 0) {
                    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
                    global.securitySystem.logSecurityEvent('input_validation_failed', {
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
            global.securitySystem.logSecurityEvent('request', {
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
// LOAD BALANCER MIDDLEWARE
// ================================================

// Load balancer middleware
app.use((req, res, next) => {
    if (global.loadBalancer) {
        // Determine request priority
        let priority = 'normal';

        if (req.method === 'POST' && (req.path.includes('/absensi') || req.path.includes('/login'))) {
            priority = 'critical';
        } else if (req.method === 'GET' && (req.path.includes('/absensi') || req.path.includes('/dashboard'))) {
            priority = 'high';
        } else if (req.path.includes('/analytics') || req.path.includes('/reports')) {
            priority = 'normal';
        } else {
            priority = 'low';
        }

        // Add request to load balancer
        const requestId = global.loadBalancer.addRequest({
            method: req.method,
            path: req.path,
            headers: req.headers,
            body: req.body
        }, priority);

        // Add request ID to response headers
        res.setHeader('X-Request-ID', requestId);

        // Add load balancer stats to response
        res.setHeader('X-Load-Balancer-Stats', JSON.stringify(global.loadBalancer.getStats()));
    }

    next();
});

// ================================================
// MIDDLEWARE - JWT Authentication & Authorization
// ================================================


// ================================================
// AUTHENTICATION ENDPOINTS
// ================================================

// Login endpoint - Real authentication with MySQL
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
// REPORT LETTERHEAD MANAGEMENT ENDPOINTS
// ================================================

// Import letterhead manager (legacy)
import { loadReportLetterhead, saveReportLetterhead, validateLetterhead } from './backend/utils/letterheadManager.js';

// Import new letterhead service
import {
    getLetterhead,
    setLetterheadGlobal,
    setLetterheadForReport,
    getAllLetterheads,
    deleteLetterhead,
    REPORT_KEYS
} from './backend/utils/letterheadService.js';

// Get report letterhead configuration
// ================================================
// NOTE: LETTERHEAD ROUTES MIGRATED TO letterheadController.js
// All 10 letterhead endpoints moved to modular structure
// ================================================

// Update profile for guru
// ================================================
// NOTE: PROFILE UPDATE ROUTES MIGRATED TO guruController.js and siswaController.js
// PUT /api/guru/update-profile, PUT /api/guru/change-password
// PUT /api/siswa/update-profile, PUT /api/siswa/change-password
// ================================================

// ================================================
// DASHBOARD ENDPOINTS - Real Data from MySQL
// ================================================

// Lightweight master data for filters
// app.get('/api/admin/classes', authenticateToken, requireRole(['admin']), async (req, res) => {
//     try {
//         const [rows] = await global.dbPool.execute(
//             'SELECT id_kelas AS id, nama_kelas FROM kelas WHERE status = "aktif" ORDER BY nama_kelas'
//         );
//         res.json(rows);
//     } catch (error) {
//         console.error('❌ Error fetching classes:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// }); // DUPLICATE ENDPOINT - COMMENTED OUT

// ================================================
// NOTE: DASHBOARD ROUTES MIGRATED TO dashboardController.js
// GET /api/dashboard/stats, GET /api/dashboard/chart
// ================================================

// ================================================
// CRUD ENDPOINTS - ADMIN ONLY
// ================================================

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

// RUANG CRUD (Modularized)
app.use('/api/admin/ruang', ruangRoutes);
app.use('/api', userInfoRoutes); // User self-service info endpoints
app.use('/api', bandingAbsenRoutes);
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
app.use('/api/admin', letterheadRoutes); // All letterhead endpoints
app.use('/api/dashboard', dashboardRoutes); // Dashboard stats and chart

// ================================================
// TEMPLATE ENDPOINTS - Download Excel Templates
// ================================================

// Template endpoints untuk SISWA - DIHAPUS KARENA DUPLIKASI
// Endpoint yang benar ada di baris 2943 dengan format yang lebih sesuai

// Template endpoints untuk SISWA template-friendly - DIHAPUS KARENA DUPLIKASI

// ================================================
// ALL API ENDPOINTS MODULARIZED
// See server/routes/ and server/controllers/ for implementations
// Inline endpoints removed during refactoring - December 2024
// ================================================

initializeDatabase().then(() => {
    app.listen(port, '0.0.0.0', () => {
        console.log(`🚀 ABSENTA Modern Server is running on http://0.0.0.0:${port}`);
        console.log(`🌐 Accessible from network: http://[YOUR_IP]:${port}`);
        console.log(`📱 Frontend should connect to this server`);
        console.log(`🔧 Database optimization: Connection pool active`);
    });
}).catch(error => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});
