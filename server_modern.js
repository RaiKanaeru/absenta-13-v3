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
import absensiRoutes from './server/routes/absensiRoutes.js';
import exportRoutes from './server/routes/exportRoutes.js';
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
app.get('/api/admin/report-letterhead', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.LAPORAN_GURU });
        res.json({
            success: true,
            data: letterhead
        });
    } catch (error) {
        console.error('❌ Error loading report letterhead:', error);
        res.status(500).json({
            error: 'Gagal memuat konfigurasi kop laporan',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Update report letterhead configuration
app.put('/api/admin/report-letterhead', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const letterhead = req.body;

        // Validate input
        const validation = validateLetterhead(letterhead);
        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Konfigurasi kop laporan tidak valid',
                details: validation.errors
            });
        }

        // Save configuration
        const success = await saveReportLetterhead(letterhead);
        if (!success) {
            return res.status(500).json({
                error: 'Gagal menyimpan konfigurasi kop laporan'
            });
        }

        res.json({
            success: true,
            message: 'Konfigurasi kop laporan berhasil disimpan',
            data: letterhead
        });
    } catch (error) {
        console.error('❌ Error updating report letterhead:', error);
        res.status(500).json({
            error: 'Gagal memperbarui konfigurasi kop laporan',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// ================================================
// NEW LETTERHEAD SERVICE ENDPOINTS
// ================================================

// Get letterhead configuration (with optional reportKey)
app.get('/api/admin/letterhead', authenticateToken, requireRole(['admin', 'guru', 'siswa']), async (req, res) => {
    try {
        const { reportKey } = req.query;
        const letterhead = await getLetterhead({ reportKey });

        res.json({
            success: true,
            data: letterhead
        });
    } catch (error) {
        console.error('❌ Error loading letterhead:', error);
        res.status(500).json({
            error: 'Gagal memuat konfigurasi KOP',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Get all letterhead configurations (admin only)
app.get('/api/admin/letterhead/all', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const letterheads = await getAllLetterheads();

        res.json({
            success: true,
            data: letterheads
        });
    } catch (error) {
        console.error('❌ Error loading all letterheads:', error);
        res.status(500).json({
            error: 'Gagal memuat daftar KOP',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Set global letterhead configuration
app.put('/api/admin/letterhead/global', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const letterhead = req.body;
        const success = await setLetterheadGlobal(letterhead);

        if (!success) {
            return res.status(500).json({
                error: 'Gagal menyimpan konfigurasi KOP global'
            });
        }

        res.json({
            success: true,
            message: 'Konfigurasi KOP global berhasil disimpan',
            data: letterhead
        });
    } catch (error) {
        console.error('❌ Error updating global letterhead:', error);
        res.status(500).json({
            error: 'Gagal memperbarui konfigurasi KOP global',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Set letterhead configuration for specific report
app.put('/api/admin/letterhead/report/:reportKey', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { reportKey } = req.params;
        const letterhead = req.body;

        if (!reportKey) {
            return res.status(400).json({
                error: 'Kode laporan wajib diisi'
            });
        }

        const success = await setLetterheadForReport(reportKey, letterhead);

        if (!success) {
            return res.status(500).json({
                error: 'Gagal menyimpan konfigurasi KOP untuk laporan'
            });
        }

        res.json({
            success: true,
            message: `Konfigurasi KOP untuk ${reportKey} berhasil disimpan`,
            data: letterhead
        });
    } catch (error) {
        console.error('❌ Error updating report letterhead:', error);
        res.status(500).json({
            error: 'Gagal memperbarui konfigurasi KOP laporan',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Upload logo for letterhead
app.post('/api/admin/letterhead/upload', authenticateToken, requireRole(['admin']), uploadLogo.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'File logo wajib diupload'
            });
        }

        // Return URL (file already saved by multer)
        const logoUrl = `/uploads/letterheads/${req.file.filename}`;

        console.log('✅ Logo uploaded successfully:', {
            filename: req.file.filename,
            url: logoUrl,
            size: req.file.size,
            mimetype: req.file.mimetype,
            logoType: req.body.logoType
        });

        res.json({
            success: true,
            message: 'Logo berhasil diupload',
            data: {
                url: logoUrl,
                filename: req.file.filename,
                size: req.file.size,
                mimetype: req.file.mimetype,
                logoType: req.body.logoType
            }
        });
    } catch (error) {
        console.error('❌ Error uploading logo:', error);
        res.status(500).json({
            error: 'Gagal mengupload logo',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Delete physical file endpoint
app.delete('/api/admin/letterhead/delete-file', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { fileUrl } = req.body;

        if (!fileUrl || !fileUrl.startsWith('/uploads/letterheads/')) {
            return res.status(400).json({
                error: 'URL file tidak valid'
            });
        }

        const filePath = path.join('public', fileUrl);

        try {
            await fs.unlink(filePath);
            console.log('✅ Physical file deleted:', filePath);
            res.json({
                success: true,
                message: 'File berhasil dihapus'
            });
        } catch (fileError) {
            console.warn('⚠️ Could not delete physical file:', fileError.message);
            res.status(404).json({
                error: 'File tidak ditemukan'
            });
        }
    } catch (error) {
        console.error('❌ Error deleting file:', error);
        res.status(500).json({
            error: 'Gagal menghapus file',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Helper functions for letterhead
async function getLetterheadGlobal() {
    try {
        return await getLetterhead({ reportKey: null });
    } catch (error) {
        console.error('❌ Error getting global letterhead:', error);
        return null;
    }
}

async function getLetterheadForReport(reportKey) {
    try {
        return await getLetterhead({ reportKey });
    } catch (error) {
        console.error('❌ Error getting report letterhead:', error);
        return null;
    }
}

// Delete logo for letterhead
app.delete('/api/admin/letterhead/logo/:logoType', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { logoType } = req.params;
        const { scope, reportKey } = req.query;

        if (!logoType || !['logo', 'logoLeft', 'logoRight'].includes(logoType)) {
            return res.status(400).json({
                error: 'Tipe logo tidak valid. Gunakan: logo, logoLeft, atau logoRight'
            });
        }

        // Get current letterhead config
        let currentConfig;
        if (scope === 'report' && reportKey) {
            currentConfig = await getLetterheadForReport(reportKey);
        } else {
            currentConfig = await getLetterheadGlobal();
        }

        if (!currentConfig) {
            return res.status(404).json({
                error: 'Konfigurasi letterhead tidak ditemukan'
            });
        }

        // Clear the specified logo and delete physical file
        const updateData = { ...currentConfig };
        let fileToDelete = null;

        if (logoType === 'logo') {
            fileToDelete = currentConfig.logo;
            updateData.logo = '';
        } else if (logoType === 'logoLeft') {
            fileToDelete = currentConfig.logoLeftUrl;
            updateData.logoLeftUrl = '';
        } else if (logoType === 'logoRight') {
            fileToDelete = currentConfig.logoRightUrl;
            updateData.logoRightUrl = '';
        }

        // Delete physical file if it exists
        if (fileToDelete && fileToDelete.startsWith('/uploads/letterheads/')) {
            try {
                const filePath = path.join('public', fileToDelete);
                await fs.unlink(filePath);
                console.log('✅ Physical file deleted:', filePath);
            } catch (fileError) {
                console.warn('⚠️ Could not delete physical file:', fileError.message);
                // Continue with database update even if file deletion fails
            }
        }

        // Save updated config
        let success;
        if (scope === 'report' && reportKey) {
            success = await setLetterheadForReport(reportKey, updateData);
        } else {
            success = await setLetterheadGlobal(updateData);
        }

        if (!success) {
            return res.status(500).json({
                error: 'Gagal menghapus logo'
            });
        }

        res.json({
            success: true,
            message: `Logo ${logoType} berhasil dihapus`,
            data: updateData
        });
    } catch (error) {
        console.error('❌ Error deleting logo:', error);
        res.status(500).json({
            error: 'Gagal menghapus logo',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Delete letterhead configuration
app.delete('/api/admin/letterhead/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const success = await deleteLetterhead(parseInt(id));

        if (!success) {
            return res.status(404).json({
                error: 'Konfigurasi KOP tidak ditemukan'
            });
        }

        res.json({
            success: true,
            message: 'Konfigurasi KOP berhasil dihapus'
        });
    } catch (error) {
        console.error('❌ Error deleting letterhead:', error);
        res.status(500).json({
            error: 'Gagal menghapus konfigurasi KOP',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Update profile for guru
app.put('/api/guru/update-profile', authenticateToken, requireRole(['guru']), async (req, res) => {
    try {
        const { nama, username, email, alamat, no_telepon, jenis_kelamin, mata_pelajaran, jabatan } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!nama || !username) {
            return res.status(400).json({ error: 'Nama dan username wajib diisi' });
        }

        // Check if username is already taken by another user in users table
        const [existingUser] = await global.dbPool.execute(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [username, userId]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'Username sudah digunakan oleh user lain' });
        }

        // Start transaction
        const connection = await global.dbPool.getConnection();
        await connection.beginTransaction();

        try {
            // Update profile in users table (username, email)
            await connection.execute(
                `UPDATE users SET 
                    nama = ?, 
                    username = ?, 
                    email = ?,
                    updated_at = ?
                WHERE id = ?`,
                [nama, username, email || null, getMySQLDateTimeWIB(), userId]
            );

            // Update additional profile data in guru table
            await connection.execute(
                `UPDATE guru SET 
                    nama = ?, 
                    alamat = ?, 
                    no_telp = ?,
                    jenis_kelamin = ?,
                    mata_pelajaran = ?,
                    updated_at = ?
                WHERE user_id = ?`,
                [nama, alamat || null, no_telepon || null, jenis_kelamin || null, mata_pelajaran || null, getMySQLDateTimeWIB(), userId]
            );

            await connection.commit();

            // Get updated user data
            const [updatedUser] = await global.dbPool.execute(
                `SELECT u.id, u.username, u.nama, u.email, u.role, g.alamat, g.no_telp as no_telepon, 
                        g.nip, g.jenis_kelamin, g.mata_pelajaran, u.created_at, u.updated_at 
                 FROM users u 
                 LEFT JOIN guru g ON u.id = g.user_id 
                 WHERE u.id = ?`,
                [userId]
            );

            res.json({
                success: true,
                message: 'Profil berhasil diperbarui',
                data: updatedUser[0]
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('❌ Error updating guru profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Change password for guru
app.put('/api/guru/change-password', authenticateToken, requireRole(['guru']), async (req, res) => {
    try {
        const { newPassword } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!newPassword) {
            return res.status(400).json({ error: 'Password baru wajib diisi' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password in users table
        await global.dbPool.execute(
            'UPDATE users SET password = ?, updated_at = ? WHERE id = ?',
            [hashedPassword, getMySQLDateTimeWIB(), userId]
        );

        res.json({
            success: true,
            message: 'Password berhasil diubah'
        });
    } catch (error) {
        console.error('❌ Error changing guru password:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update profile for siswa
app.put('/api/siswa/update-profile', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { nama, username, email, alamat, telepon_orangtua, nomor_telepon_siswa, jenis_kelamin } = req.body;
        const userId = req.user.id;

        console.log('📝 Updating siswa profile:', { nama, username, email, alamat, telepon_orangtua, nomor_telepon_siswa, jenis_kelamin });

        // Validate required fields
        if (!nama || !username) {
            return res.status(400).json({ error: 'Nama dan username wajib diisi' });
        }

        // Check if username is already taken by another user in users table
        const [existingUser] = await global.dbPool.execute(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [username, userId]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'Username sudah digunakan oleh user lain' });
        }

        // Check if nomor_telepon_siswa is already taken by another student (if provided)
        if (nomor_telepon_siswa && nomor_telepon_siswa.trim()) {
            const [existingPhone] = await global.dbPool.execute(
                'SELECT user_id FROM siswa WHERE nomor_telepon_siswa = ? AND user_id != ?',
                [nomor_telepon_siswa.trim(), userId]
            );

            if (existingPhone.length > 0) {
                return res.status(400).json({ error: 'Nomor telepon siswa sudah digunakan oleh siswa lain' });
            }
        }

        // Start transaction
        const connection = await global.dbPool.getConnection();
        await connection.beginTransaction();

        try {
            // Update profile in users table (username, email)
            await connection.execute(
                `UPDATE users SET 
                    nama = ?, 
                    username = ?, 
                    email = ?,
                    updated_at = ?
                WHERE id = ?`,
                [nama, username, email || null, getMySQLDateTimeWIB(), userId]
            );

            // Update additional profile data in siswa table
            await connection.execute(
                `UPDATE siswa SET 
                    nama = ?, 
                    alamat = ?, 
                    telepon_orangtua = ?,
                    nomor_telepon_siswa = ?,
                    jenis_kelamin = ?,
                    updated_at = ?
                WHERE user_id = ?`,
                [nama, alamat || null, telepon_orangtua || null, nomor_telepon_siswa || null, jenis_kelamin || null, getMySQLDateTimeWIB(), userId]
            );

            await connection.commit();

            // Get updated user data with kelas info
            const [updatedUser] = await global.dbPool.execute(
                `SELECT u.id, u.username, u.nama, u.email, u.role, s.alamat, s.telepon_orangtua, s.nomor_telepon_siswa,
                        s.nis, k.nama_kelas as kelas, s.jenis_kelamin, u.created_at, u.updated_at
                 FROM users u
                 LEFT JOIN siswa s ON u.id = s.user_id
                 LEFT JOIN kelas k ON s.kelas_id = k.id_kelas
                 WHERE u.id = ?`,
                [userId]
            );

            console.log('✅ Siswa profile updated successfully');

            res.json({
                success: true,
                message: 'Profil berhasil diperbarui',
                data: updatedUser[0]
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('❌ Error updating siswa profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Change password for siswa
app.put('/api/siswa/change-password', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { newPassword } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!newPassword) {
            return res.status(400).json({ error: 'Password baru wajib diisi' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password in users table
        await global.dbPool.execute(
            'UPDATE users SET password = ?, updated_at = ? WHERE id = ?',
            [hashedPassword, getMySQLDateTimeWIB(), userId]
        );

        res.json({
            success: true,
            message: 'Password berhasil diubah'
        });
    } catch (error) {
        console.error('❌ Error changing siswa password:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

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

// Get dashboard statistics
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const stats = {};

        if (req.user.role === 'admin') {
            // Admin statistics
            const [totalSiswa] = await global.dbPool.execute(
                'SELECT COUNT(*) as count FROM siswa WHERE status = "aktif"'
            );

            const [totalGuru] = await global.dbPool.execute(
                'SELECT COUNT(*) as count FROM guru WHERE status = "aktif"'
            );

            const [totalKelas] = await global.dbPool.execute(
                'SELECT COUNT(*) as count FROM kelas WHERE status = "aktif"'
            );

            const [totalMapel] = await global.dbPool.execute(
                'SELECT COUNT(*) as count FROM mapel WHERE status = "aktif"'
            );

            const todayWIB = getMySQLDateWIB();
            const [absensiHariIni] = await global.dbPool.execute(
                'SELECT COUNT(*) as count FROM absensi_guru WHERE tanggal = ?',
                [todayWIB]
            );

            const sevenDaysAgoWIB = formatWIBDate(new Date(getWIBTime().getTime() - 7 * 24 * 60 * 60 * 1000));
            const [persentaseKehadiran] = await global.dbPool.execute(
                `SELECT 
                    ROUND(
                        (SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
                    ) as persentase
                 FROM absensi_guru 
                 WHERE tanggal >= ?`,
                [sevenDaysAgoWIB]
            );

            stats.totalSiswa = totalSiswa[0].count;
            stats.totalGuru = totalGuru[0].count;
            stats.totalKelas = totalKelas[0].count;
            stats.totalMapel = totalMapel[0].count;
            stats.absensiHariIni = absensiHariIni[0].count;
            stats.persentaseKehadiran = persentaseKehadiran[0].persentase || 0;

        } else if (req.user.role === 'guru') {
            // Guru statistics
            const wibNow = getWIBTime();
            const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const currentDayWIB = dayNames[wibNow.getDay()];

            const [jadwalHariIni] = await global.dbPool.execute(
                `SELECT COUNT(*) as count 
                 FROM jadwal 
                 WHERE guru_id = ? AND hari = ? AND status = 'aktif'`,
                [req.user.guru_id, currentDayWIB]
            );

            const sevenDaysAgoWIB = formatWIBDate(new Date(wibNow.getTime() - 7 * 24 * 60 * 60 * 1000));
            const [absensiMingguIni] = await global.dbPool.execute(
                `SELECT COUNT(*) as count 
                 FROM absensi_guru 
                 WHERE guru_id = ? AND tanggal >= ?`,
                [req.user.guru_id, sevenDaysAgoWIB]
            );

            const thirtyDaysAgoWIB = formatWIBDate(new Date(wibNow.getTime() - 30 * 24 * 60 * 60 * 1000));
            const [persentaseKehadiran] = await global.dbPool.execute(
                `SELECT 
                    ROUND(
                        (SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
                    ) as persentase
                 FROM absensi_guru 
                 WHERE guru_id = ? AND tanggal >= ?`,
                [req.user.guru_id, thirtyDaysAgoWIB]
            );

            stats.jadwalHariIni = jadwalHariIni[0].count;
            stats.absensiMingguIni = absensiMingguIni[0].count;
            stats.persentaseKehadiran = persentaseKehadiran[0].persentase || 0;

        } else if (req.user.role === 'siswa') {
            // Siswa statistics
            const wibNow = getWIBTime();
            const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const currentDayWIB = dayNames[wibNow.getDay()];

            const [jadwalHariIni] = await global.dbPool.execute(
                `SELECT COUNT(*) as count 
                 FROM jadwal 
                 WHERE kelas_id = ? AND hari = ? AND status = 'aktif'`,
                [req.user.kelas_id, currentDayWIB]
            );

            const sevenDaysAgoWIB = formatWIBDate(new Date(wibNow.getTime() - 7 * 24 * 60 * 60 * 1000));
            const [absensiMingguIni] = await global.dbPool.execute(
                `SELECT COUNT(*) as count 
                 FROM absensi_guru 
                 WHERE kelas_id = ? AND tanggal >= ?`,
                [req.user.kelas_id, sevenDaysAgoWIB]
            );

            stats.jadwalHariIni = jadwalHariIni[0].count;
            stats.absensiMingguIni = absensiMingguIni[0].count;
        }

        console.log(`📊 Dashboard stats retrieved for ${req.user.role}: ${req.user.username}`);
        res.json({ success: true, data: stats });

    } catch (error) {
        console.error('❌ Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to retrieve dashboard statistics' });
    }
});

// Get dashboard chart data
app.get('/api/dashboard/chart', authenticateToken, async (req, res) => {
    try {
        const { period = '7days' } = req.query;
        let chartData = [];

        if (req.user.role === 'admin') {
            // Admin chart - Weekly attendance overview
            const sevenDaysAgoWIB = formatWIBDate(new Date(getWIBTime().getTime() - 7 * 24 * 60 * 60 * 1000));
            const [weeklyData] = await global.dbPool.execute(
                `SELECT 
                    DATE(tanggal) as tanggal,
                    SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
                    SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
                 FROM absensi_guru 
                 WHERE tanggal >= ?
                 GROUP BY DATE(tanggal)
                 ORDER BY tanggal`,
                [sevenDaysAgoWIB]
            );

            chartData = weeklyData.map(row => ({
                date: row.tanggal,
                hadir: row.hadir,
                tidakHadir: row.tidak_hadir,
                total: row.hadir + row.tidak_hadir
            }));

        } else if (req.user.role === 'guru') {
            // Guru chart - Personal attendance
            const sevenDaysAgoWIB = formatWIBDate(new Date(getWIBTime().getTime() - 7 * 24 * 60 * 60 * 1000));
            const [personalData] = await global.dbPool.execute(
                `SELECT 
                    DATE(tanggal) as tanggal,
                    SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
                    SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
                 FROM absensi_guru 
                 WHERE guru_id = ? AND tanggal >= ?
                 GROUP BY DATE(tanggal)
                 ORDER BY tanggal`,
                [req.user.guru_id, sevenDaysAgoWIB]
            );

            chartData = personalData.map(row => ({
                date: row.tanggal,
                hadir: row.hadir,
                tidakHadir: row.tidak_hadir
            }));
        }

        console.log(`📈 Chart data retrieved for ${req.user.role}: ${req.user.username}`);
        res.json({ success: true, data: chartData });

    } catch (error) {
        console.error('❌ Chart data error:', error);
        res.status(500).json({ error: 'Failed to retrieve chart data' });
    }
});

// ================================================
// CRUD ENDPOINTS - ADMIN ONLY
// ================================================

// SISWA CRUD
// SISWA CRUD (Modularized)
app.use('/api/admin/siswa', siswaRoutes);

// Guru Routes (Modularized)
app.use('/api/admin/guru', guruRoutes);

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

// ABSENSI CRUD (Modularized)
app.use('/api/attendance', absensiRoutes); // Attendance submit endpoints
app.use('/api', absensiRoutes); // Schedule and siswa endpoints (uses /schedule/:id/... and /siswa/...)

// EXPORT ROUTES (Modularized)
app.use('/api/export', exportRoutes); // All export endpoints

// ================================================
// TEMPLATE ENDPOINTS - Download Excel Templates
// ================================================

// Template endpoints untuk SISWA - DIHAPUS KARENA DUPLIKASI
// Endpoint yang benar ada di baris 2943 dengan format yang lebih sesuai

// Template endpoints untuk SISWA template-friendly - DIHAPUS KARENA DUPLIKASI
// Endpoint yang benar ada di baris 3041 dengan format yang lebih sesuai

// Template endpoints untuk AKUN SISWA (dengan username/password)
app.get('/api/admin/student-account/template-basic', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📊 Generating student account template-basic...');

        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Template Input - Sesuai dengan form CRUD Akun Siswa (DENGAN USERNAME/PASSWORD)
        const inputSheet = workbook.addWorksheet('Data Akun Siswa');
        inputSheet.columns = [
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Username *', key: 'username', width: 20 },
            { header: 'Password *', key: 'password', width: 20 },
            { header: 'NIS *', key: 'nis', width: 15 },
            { header: 'Kelas *', key: 'kelas', width: 20 },
            { header: 'Jabatan', key: 'jabatan', width: 20 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Telepon Orang Tua', key: 'telepon_orangtua', width: 20 },
            { header: 'Telepon Siswa', key: 'nomor_telepon_siswa', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        // Tambahkan contoh data sesuai form CRUD
        inputSheet.addRow({
            nama: 'Ahmad Rizki',
            username: 'ahmad.rizki',
            password: 'Siswa123!',
            nis: '25001',
            kelas: 'X IPA 1',
            jabatan: 'Ketua Kelas',
            jenis_kelamin: 'L',
            email: 'ahmad.rizki@sekolah.id',
            telepon_orangtua: '0811223344',
            nomor_telepon_siswa: '0812334455',
            alamat: 'Jl. Melati No. 1, Jakarta',
            status: 'aktif'
        });

        // Sheet 2: Referensi Kelas
        const kelasSheet = workbook.addWorksheet('Ref Kelas');
        kelasSheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Nama Kelas', key: 'nama', width: 30 },
            { header: 'Tingkat', key: 'tingkat', width: 15 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        try {
            console.log('📊 Fetching kelas data...');
            const [kelas] = await global.dbPool.execute('SELECT id_kelas, nama_kelas, tingkat, status FROM kelas WHERE status = "aktif" ORDER BY nama_kelas');
            console.log('📊 Kelas data fetched:', kelas.length, 'records');

            kelas.forEach(k => {
                kelasSheet.addRow({
                    id: k.id_kelas,
                    nama: k.nama_kelas,
                    tingkat: k.tingkat || '',
                    status: k.status
                });
            });
        } catch (dbError) {
            console.error('❌ Error fetching kelas data:', dbError);
            // Data fallback
            kelasSheet.addRow({ id: 1, nama: 'X IPA 1', tingkat: 'X', status: 'aktif' });
            kelasSheet.addRow({ id: 2, nama: 'X IPA 2', tingkat: 'X', status: 'aktif' });
            kelasSheet.addRow({ id: 3, nama: 'XI IPA 1', tingkat: 'XI', status: 'aktif' });
            kelasSheet.addRow({ id: 4, nama: 'XI IPA 2', tingkat: 'XI', status: 'aktif' });
            kelasSheet.addRow({ id: 5, nama: 'XII IPA 1', tingkat: 'XII', status: 'aktif' });
        }

        // Sheet 3: Panduan Pengisian
        const guideSheet = workbook.addWorksheet('Panduan');
        guideSheet.columns = [
            { header: 'Kolom', key: 'kolom', width: 20 },
            { header: 'Deskripsi', key: 'deskripsi', width: 50 },
            { header: 'Contoh', key: 'contoh', width: 30 },
            { header: 'Wajib', key: 'wajib', width: 10 }
        ];

        const panduan = [
            { kolom: 'nama', deskripsi: 'Nama lengkap siswa', contoh: 'Ahmad Rizki', wajib: 'Ya' },
            { kolom: 'username', deskripsi: 'Username untuk login (unik, tidak boleh sama)', contoh: 'ahmad.rizki', wajib: 'Ya' },
            { kolom: 'password', deskripsi: 'Password untuk login (minimal 6 karakter)', contoh: 'Siswa123!', wajib: 'Ya' },
            { kolom: 'nis', deskripsi: 'Nomor Induk Siswa (unik, tidak boleh sama)', contoh: '25001', wajib: 'Ya' },
            { kolom: 'kelas', deskripsi: 'Nama kelas siswa (lihat referensi)', contoh: 'X IPA 1', wajib: 'Ya' },
            { kolom: 'jabatan', deskripsi: 'Jabatan siswa di kelas', contoh: 'Ketua Kelas', wajib: 'Tidak' },
            { kolom: 'jenis_kelamin', deskripsi: 'Jenis kelamin (L/P)', contoh: 'L', wajib: 'Ya' },
            { kolom: 'email', deskripsi: 'Alamat email siswa', contoh: 'ahmad@sekolah.id', wajib: 'Tidak' },
            { kolom: 'telepon_orangtua', deskripsi: 'Nomor telepon orang tua', contoh: '0811223344', wajib: 'Tidak' },
            { kolom: 'nomor_telepon_siswa', deskripsi: 'Nomor telepon pribadi siswa', contoh: '0812334455', wajib: 'Tidak' },
            { kolom: 'alamat', deskripsi: 'Alamat lengkap siswa', contoh: 'Jl. Melati No. 1', wajib: 'Tidak' },
            { kolom: 'status', deskripsi: 'Status siswa (aktif/nonaktif)', contoh: 'aktif', wajib: 'Tidak' }
        ];

        panduan.forEach(p => guideSheet.addRow(p));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-akun-siswa-basic.xlsx');

        console.log('📊 Writing Excel file...');
        await workbook.xlsx.write(res);
        console.log('✅ Student account template-basic generated successfully');
        res.end();
    } catch (error) {
        console.error('Error generating basic template:', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
});

app.get('/api/admin/student-account/template-friendly', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📊 Generating student account template-friendly...');

        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Template Input - Format user-friendly (SESUAI FORM CRUD AKUN SISWA)
        const inputSheet = workbook.addWorksheet('Data Akun Siswa');
        inputSheet.columns = [
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Username *', key: 'username', width: 20 },
            { header: 'Password *', key: 'password', width: 20 },
            { header: 'NIS *', key: 'nis', width: 15 },
            { header: 'Kelas *', key: 'kelas', width: 20 },
            { header: 'Jabatan', key: 'jabatan', width: 20 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Telepon Orang Tua', key: 'telepon_orangtua', width: 20 },
            { header: 'Telepon Siswa', key: 'nomor_telepon_siswa', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        // Tambahkan contoh data sesuai form CRUD
        inputSheet.addRow({
            nama: 'Ahmad Rizki',
            username: 'ahmad.rizki',
            password: 'Siswa123!',
            nis: '25001',
            kelas: 'X IPA 1',
            jabatan: 'Ketua Kelas',
            jenis_kelamin: 'L',
            email: 'ahmad.rizki@sekolah.id',
            telepon_orangtua: '0811223344',
            nomor_telepon_siswa: '0812334455',
            alamat: 'Jl. Melati No. 1, Jakarta',
            status: 'aktif'
        });

        // Sheet 2: Referensi Kelas
        const kelasSheet = workbook.addWorksheet('Ref Kelas');
        kelasSheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Nama Kelas', key: 'nama', width: 30 },
            { header: 'Tingkat', key: 'tingkat', width: 15 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        try {
            console.log('📊 Fetching kelas data...');
            const [kelas] = await global.dbPool.execute('SELECT id_kelas, nama_kelas, tingkat, status FROM kelas WHERE status = "aktif" ORDER BY nama_kelas');
            console.log('📊 Kelas data fetched:', kelas.length, 'records');

            kelas.forEach(k => {
                kelasSheet.addRow({
                    id: k.id_kelas,
                    nama: k.nama_kelas,
                    tingkat: k.tingkat || '',
                    status: k.status
                });
            });
        } catch (dbError) {
            console.error('❌ Error fetching kelas data:', dbError);
            // Data fallback
            kelasSheet.addRow({ id: 1, nama: 'X IPA 1', tingkat: 'X', status: 'aktif' });
            kelasSheet.addRow({ id: 2, nama: 'X IPA 2', tingkat: 'X', status: 'aktif' });
            kelasSheet.addRow({ id: 3, nama: 'XI IPA 1', tingkat: 'XI', status: 'aktif' });
            kelasSheet.addRow({ id: 4, nama: 'XI IPA 2', tingkat: 'XI', status: 'aktif' });
            kelasSheet.addRow({ id: 5, nama: 'XII IPA 1', tingkat: 'XII', status: 'aktif' });
        }

        // Sheet 3: Panduan Pengisian
        const guideSheet = workbook.addWorksheet('Panduan');
        guideSheet.columns = [
            { header: 'Kolom', key: 'kolom', width: 20 },
            { header: 'Deskripsi', key: 'deskripsi', width: 50 },
            { header: 'Contoh', key: 'contoh', width: 30 },
            { header: 'Wajib', key: 'wajib', width: 10 }
        ];

        const panduan = [
            { kolom: 'nama', deskripsi: 'Nama lengkap siswa', contoh: 'Ahmad Rizki', wajib: 'Ya' },
            { kolom: 'username', deskripsi: 'Username untuk login (unik, tidak boleh sama)', contoh: 'ahmad.rizki', wajib: 'Ya' },
            { kolom: 'password', deskripsi: 'Password untuk login (minimal 6 karakter)', contoh: 'Siswa123!', wajib: 'Ya' },
            { kolom: 'nis', deskripsi: 'Nomor Induk Siswa (unik, tidak boleh sama)', contoh: '25001', wajib: 'Ya' },
            { kolom: 'kelas', deskripsi: 'Nama kelas siswa (lihat referensi)', contoh: 'X IPA 1', wajib: 'Ya' },
            { kolom: 'jabatan', deskripsi: 'Jabatan siswa di kelas', contoh: 'Ketua Kelas', wajib: 'Tidak' },
            { kolom: 'jenis_kelamin', deskripsi: 'Jenis kelamin (L/P)', contoh: 'L', wajib: 'Ya' },
            { kolom: 'email', deskripsi: 'Alamat email siswa', contoh: 'ahmad@sekolah.id', wajib: 'Tidak' },
            { kolom: 'telepon_orangtua', deskripsi: 'Nomor telepon orang tua', contoh: '0811223344', wajib: 'Tidak' },
            { kolom: 'nomor_telepon_siswa', deskripsi: 'Nomor telepon pribadi siswa', contoh: '0812334455', wajib: 'Tidak' },
            { kolom: 'alamat', deskripsi: 'Alamat lengkap siswa', contoh: 'Jl. Melati No. 1', wajib: 'Tidak' },
            { kolom: 'status', deskripsi: 'Status siswa (aktif/nonaktif)', contoh: 'aktif', wajib: 'Tidak' }
        ];

        panduan.forEach(p => guideSheet.addRow(p));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-akun-siswa-friendly.xlsx');

        console.log('📊 Writing Excel file...');
        await workbook.xlsx.write(res);
        console.log('✅ Student account template-friendly generated successfully');
        res.end();
    } catch (error) {
        console.error('Error generating friendly template:', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
});

// Template endpoints untuk AKUN GURU (dengan username/password)
app.get('/api/admin/teacher-account/template-basic', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📊 Generating teacher account template-basic...');

        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Template Input - Sesuai dengan form CRUD Akun Guru (DENGAN USERNAME/PASSWORD)
        const inputSheet = workbook.addWorksheet('Data Akun Guru');
        inputSheet.columns = [
            { header: 'NIP *', key: 'nip', width: 20 },
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Username *', key: 'username', width: 20 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Telepon', key: 'telepon', width: 15 },
            { header: 'Jenis Kelamin', key: 'jenis_kelamin', width: 15 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Mata Pelajaran', key: 'mata_pelajaran', width: 25 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Password *', key: 'password', width: 20 }
        ];

        // Tambahkan contoh data sesuai form CRUD
        inputSheet.addRow({
            nip: '198001012005011001',
            nama: 'Budi Santoso',
            username: 'budi.santoso',
            email: 'budi.santoso@sekolah.id',
            telepon: '081234567890',
            jenis_kelamin: 'L',
            alamat: 'Jl. Mawar No. 1, Jakarta',
            mata_pelajaran: 'Matematika',
            status: 'aktif',
            password: 'Guru123!'
        });

        // Sheet 2: Referensi Mata Pelajaran
        const mapelSheet = workbook.addWorksheet('Ref Mata Pelajaran');
        mapelSheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Nama Mata Pelajaran', key: 'nama', width: 30 },
            { header: 'Kode', key: 'kode', width: 15 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        try {
            console.log('📊 Fetching mapel data...');
            const [mapel] = await global.dbPool.execute('SELECT id_mapel, nama_mapel, kode_mapel, status FROM mapel WHERE status = "aktif" ORDER BY nama_mapel');
            console.log('📊 Mapel data fetched:', mapel.length, 'records');

            mapel.forEach(m => {
                mapelSheet.addRow({
                    id: m.id_mapel,
                    nama: m.nama_mapel,
                    kode: m.kode_mapel || '',
                    status: m.status
                });
            });
        } catch (dbError) {
            console.error('❌ Error fetching mapel data:', dbError);
            // Data fallback
            mapelSheet.addRow({ id: 1, nama: 'Matematika', kode: 'MAT', status: 'aktif' });
            mapelSheet.addRow({ id: 2, nama: 'Bahasa Indonesia', kode: 'BIN', status: 'aktif' });
            mapelSheet.addRow({ id: 3, nama: 'Bahasa Inggris', kode: 'BING', status: 'aktif' });
            mapelSheet.addRow({ id: 4, nama: 'Fisika', kode: 'FIS', status: 'aktif' });
            mapelSheet.addRow({ id: 5, nama: 'Kimia', kode: 'KIM', status: 'aktif' });
        }

        // Sheet 3: Panduan Pengisian
        const guideSheet = workbook.addWorksheet('Panduan');
        guideSheet.columns = [
            { header: 'Kolom', key: 'kolom', width: 20 },
            { header: 'Deskripsi', key: 'deskripsi', width: 50 },
            { header: 'Contoh', key: 'contoh', width: 30 },
            { header: 'Wajib', key: 'wajib', width: 10 }
        ];

        const panduan = [
            { kolom: 'nama', deskripsi: 'Nama lengkap guru', contoh: 'Budi Santoso', wajib: 'Ya' },
            { kolom: 'nip', deskripsi: 'Nomor Induk Pegawai (unik, tidak boleh sama)', contoh: '198001012005011001', wajib: 'Ya' },
            { kolom: 'username', deskripsi: 'Username untuk login (unik, tidak boleh sama)', contoh: 'budi.santoso', wajib: 'Ya' },
            { kolom: 'password', deskripsi: 'Password untuk login (minimal 6 karakter)', contoh: 'Guru123!', wajib: 'Ya' },
            { kolom: 'email', deskripsi: 'Alamat email guru', contoh: 'budi@sekolah.id', wajib: 'Tidak' },
            { kolom: 'telepon', deskripsi: 'Nomor telepon guru', contoh: '081234567890', wajib: 'Tidak' },
            { kolom: 'jenis_kelamin', deskripsi: 'Jenis kelamin (L/P)', contoh: 'L', wajib: 'Tidak' },
            { kolom: 'mata_pelajaran', deskripsi: 'Nama mata pelajaran yang diampu', contoh: 'Matematika', wajib: 'Tidak' },
            { kolom: 'alamat', deskripsi: 'Alamat lengkap guru', contoh: 'Jl. Mawar No. 1', wajib: 'Tidak' },
            { kolom: 'status', deskripsi: 'Status akun (aktif/nonaktif)', contoh: 'aktif', wajib: 'Tidak' }
        ];

        panduan.forEach(p => guideSheet.addRow(p));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-akun-guru-basic.xlsx');

        console.log('📊 Writing Excel file...');
        await workbook.xlsx.write(res);
        console.log('✅ Teacher account template-basic generated successfully');
        res.end();
    } catch (error) {
        console.error('Error generating basic template:', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
});

app.get('/api/admin/teacher-account/template-friendly', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📊 Generating teacher account template-friendly...');

        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Template Input - Format user-friendly (SESUAI FORM CRUD AKUN GURU)
        const inputSheet = workbook.addWorksheet('Data Akun Guru');
        inputSheet.columns = [
            { header: 'NIP *', key: 'nip', width: 20 },
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Username *', key: 'username', width: 20 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Telepon', key: 'telepon', width: 15 },
            { header: 'Jenis Kelamin', key: 'jenis_kelamin', width: 15 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Mata Pelajaran', key: 'mata_pelajaran', width: 25 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Password *', key: 'password', width: 20 }
        ];

        // Tambahkan contoh data sesuai form CRUD
        inputSheet.addRow({
            nip: '198001012005011001',
            nama: 'Budi Santoso',
            username: 'budi.santoso',
            email: 'budi.santoso@sekolah.id',
            telepon: '081234567890',
            jenis_kelamin: 'L',
            alamat: 'Jl. Mawar No. 1, Jakarta',
            mata_pelajaran: 'Matematika',
            status: 'aktif',
            password: 'Guru123!'
        });

        // Sheet 2: Referensi Mata Pelajaran
        const mapelSheet = workbook.addWorksheet('Ref Mata Pelajaran');
        mapelSheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Nama Mata Pelajaran', key: 'nama', width: 30 },
            { header: 'Kode', key: 'kode', width: 15 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        try {
            console.log('📊 Fetching mapel data...');
            const [mapel] = await global.dbPool.execute('SELECT id_mapel, nama_mapel, kode_mapel, status FROM mapel WHERE status = "aktif" ORDER BY nama_mapel');
            console.log('📊 Mapel data fetched:', mapel.length, 'records');

            mapel.forEach(m => {
                mapelSheet.addRow({
                    id: m.id_mapel,
                    nama: m.nama_mapel,
                    kode: m.kode_mapel || '',
                    status: m.status
                });
            });
        } catch (dbError) {
            console.error('❌ Error fetching mapel data:', dbError);
            // Data fallback
            mapelSheet.addRow({ id: 1, nama: 'Matematika', kode: 'MAT', status: 'aktif' });
            mapelSheet.addRow({ id: 2, nama: 'Bahasa Indonesia', kode: 'BIN', status: 'aktif' });
            mapelSheet.addRow({ id: 3, nama: 'Bahasa Inggris', kode: 'BING', status: 'aktif' });
            mapelSheet.addRow({ id: 4, nama: 'Fisika', kode: 'FIS', status: 'aktif' });
            mapelSheet.addRow({ id: 5, nama: 'Kimia', kode: 'KIM', status: 'aktif' });
        }

        // Sheet 3: Panduan Pengisian
        const guideSheet = workbook.addWorksheet('Panduan');
        guideSheet.columns = [
            { header: 'Kolom', key: 'kolom', width: 20 },
            { header: 'Deskripsi', key: 'deskripsi', width: 50 },
            { header: 'Contoh', key: 'contoh', width: 30 },
            { header: 'Wajib', key: 'wajib', width: 10 }
        ];

        const panduan = [
            { kolom: 'nama', deskripsi: 'Nama lengkap guru', contoh: 'Budi Santoso', wajib: 'Ya' },
            { kolom: 'nip', deskripsi: 'Nomor Induk Pegawai (unik, tidak boleh sama)', contoh: '198001012005011001', wajib: 'Ya' },
            { kolom: 'username', deskripsi: 'Username untuk login (unik, tidak boleh sama)', contoh: 'budi.santoso', wajib: 'Ya' },
            { kolom: 'password', deskripsi: 'Password untuk login (minimal 6 karakter)', contoh: 'Guru123!', wajib: 'Ya' },
            { kolom: 'email', deskripsi: 'Alamat email guru', contoh: 'budi@sekolah.id', wajib: 'Tidak' },
            { kolom: 'telepon', deskripsi: 'Nomor telepon guru', contoh: '081234567890', wajib: 'Tidak' },
            { kolom: 'jenis_kelamin', deskripsi: 'Jenis kelamin (L/P)', contoh: 'L', wajib: 'Tidak' },
            { kolom: 'mata_pelajaran', deskripsi: 'Nama mata pelajaran yang diampu', contoh: 'Matematika', wajib: 'Tidak' },
            { kolom: 'alamat', deskripsi: 'Alamat lengkap guru', contoh: 'Jl. Mawar No. 1', wajib: 'Tidak' }
        ];

        panduan.forEach(p => guideSheet.addRow(p));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-akun-guru-friendly.xlsx');

        console.log('📊 Writing Excel file...');
        await workbook.xlsx.write(res);
        console.log('✅ Teacher account template-friendly generated successfully');
        res.end();
    } catch (error) {
        console.error('Error generating friendly template:', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
});

// Template endpoints untuk DATA SISWA (bukan akun siswa)
app.get('/api/admin/siswa/template-basic', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📊 Generating data siswa template-basic...');

        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Template Input - Sesuai dengan form CRUD Data Siswa (TANPA USERNAME/PASSWORD)
        const inputSheet = workbook.addWorksheet('Data Siswa');
        inputSheet.columns = [
            { header: 'NIS *', key: 'nis', width: 15 },
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Kelas *', key: 'kelas', width: 20 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Telepon Orang Tua', key: 'telepon_orangtua', width: 20 },
            { header: 'Nomor Telepon Siswa', key: 'nomor_telepon_siswa', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        // Tambahkan contoh data sesuai form CRUD
        inputSheet.addRow({
            nis: '25001',
            nama: 'Ahmad Rizki',
            kelas: 'X IPA 1',
            jenis_kelamin: 'L',
            telepon_orangtua: '0811223344',
            nomor_telepon_siswa: '0812334455',
            alamat: 'Jl. Melati No. 1, Jakarta',
            status: 'aktif'
        });

        // Sheet 2: Referensi Kelas
        const kelasSheet = workbook.addWorksheet('Ref Kelas');
        kelasSheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Nama Kelas', key: 'nama', width: 30 },
            { header: 'Tingkat', key: 'tingkat', width: 15 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        try {
            console.log('📊 Fetching kelas data...');
            const [kelas] = await global.dbPool.execute('SELECT id_kelas, nama_kelas, tingkat, status FROM kelas WHERE status = "aktif" ORDER BY nama_kelas');
            console.log('📊 Kelas data fetched:', kelas.length, 'records');

            kelas.forEach(k => {
                kelasSheet.addRow({
                    id: k.id_kelas,
                    nama: k.nama_kelas,
                    tingkat: k.tingkat || '',
                    status: k.status
                });
            });
        } catch (dbError) {
            console.error('❌ Error fetching kelas data:', dbError);
            // Data fallback
            kelasSheet.addRow({ id: 1, nama: 'X IPA 1', tingkat: 'X', status: 'aktif' });
            kelasSheet.addRow({ id: 2, nama: 'X IPA 2', tingkat: 'X', status: 'aktif' });
            kelasSheet.addRow({ id: 3, nama: 'XI IPA 1', tingkat: 'XI', status: 'aktif' });
            kelasSheet.addRow({ id: 4, nama: 'XI IPA 2', tingkat: 'XI', status: 'aktif' });
            kelasSheet.addRow({ id: 5, nama: 'XII IPA 1', tingkat: 'XII', status: 'aktif' });
        }

        // Sheet 3: Panduan Pengisian
        const guideSheet = workbook.addWorksheet('Panduan');
        guideSheet.columns = [
            { header: 'Kolom', key: 'kolom', width: 20 },
            { header: 'Deskripsi', key: 'deskripsi', width: 50 },
            { header: 'Contoh', key: 'contoh', width: 30 },
            { header: 'Wajib', key: 'wajib', width: 10 }
        ];

        const panduan = [
            { kolom: 'nis', deskripsi: 'Nomor Induk Siswa (unik, tidak boleh sama)', contoh: '25001', wajib: 'Ya' },
            { kolom: 'nama', deskripsi: 'Nama lengkap siswa', contoh: 'Ahmad Rizki', wajib: 'Ya' },
            { kolom: 'kelas', deskripsi: 'Nama kelas siswa (lihat referensi)', contoh: 'X IPA 1', wajib: 'Ya' },
            { kolom: 'jenis_kelamin', deskripsi: 'Jenis kelamin (L/P)', contoh: 'L', wajib: 'Ya' },
            { kolom: 'telepon_orangtua', deskripsi: 'Nomor telepon orang tua', contoh: '0811223344', wajib: 'Tidak' },
            { kolom: 'nomor_telepon_siswa', deskripsi: 'Nomor telepon pribadi siswa', contoh: '0812334455', wajib: 'Tidak' },
            { kolom: 'alamat', deskripsi: 'Alamat lengkap siswa', contoh: 'Jl. Melati No. 1', wajib: 'Tidak' },
            { kolom: 'status', deskripsi: 'Status siswa (aktif/nonaktif)', contoh: 'aktif', wajib: 'Tidak' }
        ];

        panduan.forEach(p => guideSheet.addRow(p));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-data-siswa-basic.xlsx');

        console.log('📊 Writing Excel file...');
        await workbook.xlsx.write(res);
        console.log('✅ Data siswa template-basic generated successfully');
        res.end();
    } catch (error) {
        console.error('Error generating basic template:', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
});

app.get('/api/admin/siswa/template-friendly', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📊 Generating data siswa template-friendly...');

        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Template Input - Format user-friendly (SESUAI FORM CRUD DATA SISWA)
        const inputSheet = workbook.addWorksheet('Data Siswa');
        inputSheet.columns = [
            { header: 'NIS *', key: 'nis', width: 15 },
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Kelas *', key: 'kelas', width: 20 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Telepon Orang Tua', key: 'telepon_orangtua', width: 20 },
            { header: 'Nomor Telepon Siswa', key: 'nomor_telepon_siswa', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        // Tambahkan contoh data sesuai form CRUD
        inputSheet.addRow({
            nis: '25001',
            nama: 'Ahmad Rizki',
            kelas: 'X IPA 1',
            jenis_kelamin: 'L',
            telepon_orangtua: '0811223344',
            nomor_telepon_siswa: '0812334455',
            alamat: 'Jl. Melati No. 1, Jakarta',
            status: 'aktif'
        });

        // Sheet 2: Referensi Kelas
        const kelasSheet = workbook.addWorksheet('Ref Kelas');
        kelasSheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Nama Kelas', key: 'nama', width: 30 },
            { header: 'Tingkat', key: 'tingkat', width: 15 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        try {
            console.log('📊 Fetching kelas data...');
            const [kelas] = await global.dbPool.execute('SELECT id_kelas, nama_kelas, tingkat, status FROM kelas WHERE status = "aktif" ORDER BY nama_kelas');
            console.log('📊 Kelas data fetched:', kelas.length, 'records');

            kelas.forEach(k => {
                kelasSheet.addRow({
                    id: k.id_kelas,
                    nama: k.nama_kelas,
                    tingkat: k.tingkat || '',
                    status: k.status
                });
            });
        } catch (dbError) {
            console.error('❌ Error fetching kelas data:', dbError);
            // Data fallback
            kelasSheet.addRow({ id: 1, nama: 'X IPA 1', tingkat: 'X', status: 'aktif' });
            kelasSheet.addRow({ id: 2, nama: 'X IPA 2', tingkat: 'X', status: 'aktif' });
            kelasSheet.addRow({ id: 3, nama: 'XI IPA 1', tingkat: 'XI', status: 'aktif' });
            kelasSheet.addRow({ id: 4, nama: 'XI IPA 2', tingkat: 'XI', status: 'aktif' });
            kelasSheet.addRow({ id: 5, nama: 'XII IPA 1', tingkat: 'XII', status: 'aktif' });
        }

        // Sheet 3: Panduan Pengisian
        const guideSheet = workbook.addWorksheet('Panduan');
        guideSheet.columns = [
            { header: 'Kolom', key: 'kolom', width: 20 },
            { header: 'Deskripsi', key: 'deskripsi', width: 50 },
            { header: 'Contoh', key: 'contoh', width: 30 },
            { header: 'Wajib', key: 'wajib', width: 10 }
        ];

        const panduan = [
            { kolom: 'nis', deskripsi: 'Nomor Induk Siswa (unik, tidak boleh sama)', contoh: '25001', wajib: 'Ya' },
            { kolom: 'nama', deskripsi: 'Nama lengkap siswa', contoh: 'Ahmad Rizki', wajib: 'Ya' },
            { kolom: 'kelas', deskripsi: 'Nama kelas siswa (lihat referensi)', contoh: 'X IPA 1', wajib: 'Ya' },
            { kolom: 'jenis_kelamin', deskripsi: 'Jenis kelamin (L/P)', contoh: 'L', wajib: 'Ya' },
            { kolom: 'telepon_orangtua', deskripsi: 'Nomor telepon orang tua', contoh: '0811223344', wajib: 'Tidak' },
            { kolom: 'nomor_telepon_siswa', deskripsi: 'Nomor telepon pribadi siswa', contoh: '0812334455', wajib: 'Tidak' },
            { kolom: 'alamat', deskripsi: 'Alamat lengkap siswa', contoh: 'Jl. Melati No. 1', wajib: 'Tidak' },
            { kolom: 'status', deskripsi: 'Status siswa (aktif/nonaktif)', contoh: 'aktif', wajib: 'Tidak' }
        ];

        panduan.forEach(p => guideSheet.addRow(p));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-data-siswa-friendly.xlsx');

        console.log('📊 Writing Excel file...');
        await workbook.xlsx.write(res);
        console.log('✅ Data siswa template-friendly generated successfully');
        res.end();
    } catch (error) {
        console.error('Error generating friendly template:', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
});

// Template endpoints untuk DATA GURU (bukan akun guru)
app.get('/api/admin/guru/template-basic', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📊 Generating data guru template-basic...');

        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Template Input - Sesuai dengan form CRUD Data Guru (TANPA USERNAME/PASSWORD)
        const inputSheet = workbook.addWorksheet('Data Guru');
        inputSheet.columns = [
            { header: 'NIP *', key: 'nip', width: 20 },
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Mata Pelajaran', key: 'mata_pelajaran', width: 25 },
            { header: 'Telepon', key: 'telepon', width: 15 },
            { header: 'Jenis Kelamin', key: 'jenis_kelamin', width: 15 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        // Tambahkan contoh data
        inputSheet.addRow({
            nip: '198001012005011001',
            nama: 'Budi Santoso',
            email: 'budi.santoso@sekolah.id',
            mata_pelajaran: 'Matematika',
            telepon: '081234567890',
            jenis_kelamin: 'L',
            alamat: 'Jl. Mawar No. 1, Jakarta',
            status: 'aktif'
        });

        // Sheet 2: Referensi Mata Pelajaran
        const mapelSheet = workbook.addWorksheet('Ref Mata Pelajaran');
        mapelSheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Nama Mata Pelajaran', key: 'nama', width: 30 },
            { header: 'Kode', key: 'kode', width: 15 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        try {
            console.log('📊 Fetching mapel data...');
            const [mapel] = await global.dbPool.execute('SELECT id_mapel, nama_mapel, kode_mapel, status FROM mapel WHERE status = "aktif" ORDER BY nama_mapel');
            console.log('📊 Mapel data fetched:', mapel.length, 'records');

            mapel.forEach(m => {
                mapelSheet.addRow({
                    id: m.id_mapel,
                    nama: m.nama_mapel,
                    kode: m.kode_mapel || '',
                    status: m.status
                });
            });
        } catch (dbError) {
            console.error('❌ Error fetching mapel data:', dbError);
            // Data fallback
            mapelSheet.addRow({ id: 1, nama: 'Matematika', kode: 'MAT', status: 'aktif' });
            mapelSheet.addRow({ id: 2, nama: 'Bahasa Indonesia', kode: 'BIN', status: 'aktif' });
            mapelSheet.addRow({ id: 3, nama: 'Bahasa Inggris', kode: 'BING', status: 'aktif' });
            mapelSheet.addRow({ id: 4, nama: 'Fisika', kode: 'FIS', status: 'aktif' });
            mapelSheet.addRow({ id: 5, nama: 'Kimia', kode: 'KIM', status: 'aktif' });
        }

        // Sheet 3: Panduan Pengisian
        const guideSheet = workbook.addWorksheet('Panduan');
        guideSheet.columns = [
            { header: 'Kolom', key: 'kolom', width: 20 },
            { header: 'Deskripsi', key: 'deskripsi', width: 50 },
            { header: 'Contoh', key: 'contoh', width: 30 },
            { header: 'Wajib', key: 'wajib', width: 10 }
        ];

        const panduan = [
            { kolom: 'nip', deskripsi: 'Nomor Induk Pegawai (unik, tidak boleh sama)', contoh: '198001012005011001', wajib: 'Ya' },
            { kolom: 'nama', deskripsi: 'Nama lengkap guru', contoh: 'Budi Santoso', wajib: 'Ya' },
            { kolom: 'email', deskripsi: 'Alamat email guru', contoh: 'budi@sekolah.id', wajib: 'Tidak' },
            { kolom: 'mata_pelajaran', deskripsi: 'Nama mata pelajaran yang diampu', contoh: 'Matematika', wajib: 'Tidak' },
            { kolom: 'telepon', deskripsi: 'Nomor telepon guru', contoh: '081234567890', wajib: 'Tidak' },
            { kolom: 'jenis_kelamin', deskripsi: 'Jenis kelamin (L/P)', contoh: 'L', wajib: 'Ya' },
            { kolom: 'alamat', deskripsi: 'Alamat lengkap guru', contoh: 'Jl. Mawar No. 1', wajib: 'Tidak' },
            { kolom: 'status', deskripsi: 'Status guru (aktif/nonaktif/pensiun)', contoh: 'aktif', wajib: 'Tidak' }
        ];

        panduan.forEach(p => guideSheet.addRow(p));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-guru-basic.xlsx');

        console.log('📊 Writing Excel file...');
        await workbook.xlsx.write(res);
        console.log('✅ Guru template-basic generated successfully');
        res.end();
    } catch (error) {
        console.error('Error generating basic template:', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
});

app.get('/api/admin/guru/template-friendly', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📊 Generating data guru template-friendly...');

        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Template Input - Format user-friendly (SESUAI FORM CRUD DATA GURU)
        const inputSheet = workbook.addWorksheet('Data Guru');
        inputSheet.columns = [
            { header: 'NIP *', key: 'nip', width: 20 },
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Mata Pelajaran', key: 'mata_pelajaran', width: 25 },
            { header: 'Telepon', key: 'telepon', width: 15 },
            { header: 'Jenis Kelamin', key: 'jenis_kelamin', width: 15 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        // Tambahkan contoh data
        inputSheet.addRow({
            nip: '198001012005011001',
            nama: 'Budi Santoso',
            email: 'budi.santoso@sekolah.id',
            mata_pelajaran: 'Matematika',
            telepon: '081234567890',
            jenis_kelamin: 'L',
            alamat: 'Jl. Mawar No. 1, Jakarta',
            status: 'aktif'
        });

        // Sheet 2: Referensi Mata Pelajaran
        const mapelSheet = workbook.addWorksheet('Referensi Mata Pelajaran');
        mapelSheet.columns = [
            { header: 'Nama Mata Pelajaran', key: 'nama', width: 30 },
            { header: 'Kode', key: 'kode', width: 15 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        try {
            console.log('📊 Fetching mapel data...');
            const [mapel] = await global.dbPool.execute('SELECT nama_mapel, kode_mapel, status FROM mapel WHERE status = "aktif" ORDER BY nama_mapel');
            console.log('📊 Mapel data fetched:', mapel.length, 'records');

            mapel.forEach(m => {
                mapelSheet.addRow({
                    nama: m.nama_mapel,
                    kode: m.kode_mapel || '',
                    status: m.status
                });
            });
        } catch (dbError) {
            console.error('❌ Error fetching mapel data:', dbError);
            // Data fallback
            mapelSheet.addRow({ nama: 'Matematika', kode: 'MAT', status: 'aktif' });
            mapelSheet.addRow({ nama: 'Bahasa Indonesia', kode: 'BIN', status: 'aktif' });
            mapelSheet.addRow({ nama: 'Bahasa Inggris', kode: 'BING', status: 'aktif' });
            mapelSheet.addRow({ nama: 'Fisika', kode: 'FIS', status: 'aktif' });
            mapelSheet.addRow({ nama: 'Kimia', kode: 'KIM', status: 'aktif' });
        }

        // Sheet 3: Panduan Pengisian
        const guideSheet = workbook.addWorksheet('Panduan Pengisian');
        guideSheet.columns = [
            { header: 'Kolom', key: 'kolom', width: 20 },
            { header: 'Deskripsi', key: 'deskripsi', width: 50 },
            { header: 'Contoh', key: 'contoh', width: 30 },
            { header: 'Wajib', key: 'wajib', width: 10 }
        ];

        const panduan = [
            { kolom: 'NIP', deskripsi: 'Nomor Induk Pegawai (unik, tidak boleh sama)', contoh: '198001012005011001', wajib: 'Ya' },
            { kolom: 'Nama Lengkap', deskripsi: 'Nama lengkap guru', contoh: 'Budi Santoso', wajib: 'Ya' },
            { kolom: 'Email', deskripsi: 'Alamat email guru', contoh: 'budi@sekolah.id', wajib: 'Tidak' },
            { kolom: 'Mata Pelajaran', deskripsi: 'Nama mata pelajaran yang diampu', contoh: 'Matematika', wajib: 'Tidak' },
            { kolom: 'Telepon', deskripsi: 'Nomor telepon guru', contoh: '081234567890', wajib: 'Tidak' },
            { kolom: 'Jenis Kelamin', deskripsi: 'Jenis kelamin (L/P)', contoh: 'L', wajib: 'Ya' },
            { kolom: 'Alamat', deskripsi: 'Alamat lengkap guru', contoh: 'Jl. Mawar No. 1', wajib: 'Tidak' },
            { kolom: 'Status', deskripsi: 'Status guru (aktif/nonaktif/pensiun)', contoh: 'aktif', wajib: 'Tidak' }
        ];

        panduan.forEach(p => guideSheet.addRow(p));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-guru-friendly.xlsx');

        console.log('📊 Writing Excel file...');
        await workbook.xlsx.write(res);
        console.log('✅ Guru template-friendly generated successfully');
        res.end();
    } catch (error) {
        console.error('Error generating friendly template:', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
});

// Template endpoints untuk MAPEL
app.get('/api/admin/mapel/template-basic', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        // ExcelJS sudah diimport di bagian atas file
        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Template Input
        const inputSheet = workbook.addWorksheet('Data Mapel');
        inputSheet.columns = [
            { header: 'kode_mapel', key: 'kode_mapel', width: 15 },
            { header: 'nama_mapel', key: 'nama_mapel', width: 25 },
            { header: 'deskripsi', key: 'deskripsi', width: 30 }
        ];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-mapel-basic.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating basic template:', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
});

app.get('/api/admin/mapel/template-friendly', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        // ExcelJS sudah diimport di bagian atas file
        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Template Input
        const inputSheet = workbook.addWorksheet('Data Mapel');
        inputSheet.columns = [
            { header: 'Kode Mapel', key: 'kode_mapel', width: 15 },
            { header: 'Nama Mapel', key: 'nama_mapel', width: 25 },
            { header: 'Deskripsi', key: 'deskripsi', width: 30 }
        ];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-mapel-friendly.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating friendly template:', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
});

// Template endpoints untuk KELAS
app.get('/api/admin/kelas/template-basic', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        // ExcelJS sudah diimport di bagian atas file
        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Template Input
        const inputSheet = workbook.addWorksheet('Data Kelas');
        inputSheet.columns = [
            { header: 'nama_kelas', key: 'nama_kelas', width: 15 },
            { header: 'tingkat', key: 'tingkat', width: 10 }
        ];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-kelas-basic.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating basic template:', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
});

app.get('/api/admin/kelas/template-friendly', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        // ExcelJS sudah diimport di bagian atas file
        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Template Input
        const inputSheet = workbook.addWorksheet('Data Kelas');
        inputSheet.columns = [
            { header: 'Nama Kelas', key: 'nama_kelas', width: 15 },
            { header: 'Tingkat', key: 'tingkat', width: 10 }
        ];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-kelas-friendly.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating friendly template:', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
});

// Template endpoints untuk RUANG KELAS
app.get('/api/admin/ruang/template-basic', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        // ExcelJS sudah diimport di bagian atas file
        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Template Input
        const inputSheet = workbook.addWorksheet('Data Ruang');
        inputSheet.columns = [
            { header: 'kode_ruang', key: 'kode_ruang', width: 15 },
            { header: 'nama_ruang', key: 'nama_ruang', width: 25 },
            { header: 'lokasi', key: 'lokasi', width: 30 },
            { header: 'kapasitas', key: 'kapasitas', width: 10 }
        ];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-ruang-basic.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating basic template:', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
});

app.get('/api/admin/ruang/template-friendly', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        // ExcelJS sudah diimport di bagian atas file
        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Template Input
        const inputSheet = workbook.addWorksheet('Data Ruang');
        inputSheet.columns = [
            { header: 'Kode Ruang', key: 'kode_ruang', width: 15 },
            { header: 'Nama Ruang', key: 'nama_ruang', width: 25 },
            { header: 'Lokasi', key: 'lokasi', width: 30 },
            { header: 'Kapasitas', key: 'kapasitas', width: 10 }
        ];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-ruang-friendly.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating friendly template:', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
});

// ================================================
// JADWAL ENDPOINTS - Schedule Management
// ================================================

// Function to validate schedule conflicts
async function validateScheduleConflicts(guruIds, hari, jam_mulai, jam_selesai, excludeJadwalId = null) {
    try {
        // Check for each guru if they have conflicting schedules
        for (const guruId of guruIds) {
            const conflictQuery = `
                SELECT j.id_jadwal, j.hari, j.jam_mulai, j.jam_selesai, j.keterangan_khusus, 
                       COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel,
                       k.nama_kelas
                FROM jadwal j
                LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
                JOIN kelas k ON j.kelas_id = k.id_kelas
                WHERE j.guru_id = ? 
                AND j.hari = ? 
                AND j.status = 'aktif'
                AND (
                    (j.jam_mulai < ? AND j.jam_selesai > ?) OR
                    (j.jam_mulai < ? AND j.jam_selesai > ?) OR
                    (j.jam_mulai >= ? AND j.jam_selesai <= ?)
                )
                ${excludeJadwalId ? 'AND j.id_jadwal != ?' : ''}
            `;

            const params = excludeJadwalId
                ? [guruId, hari, jam_mulai, jam_selesai, jam_selesai, jam_mulai, jam_mulai, jam_selesai, excludeJadwalId]
                : [guruId, hari, jam_mulai, jam_selesai, jam_selesai, jam_mulai, jam_mulai, jam_selesai];

            const [conflicts] = await global.dbPool.execute(conflictQuery, params);

            if (conflicts.length > 0) {
                const conflict = conflicts[0];
                return {
                    hasConflict: true,
                    guruId: guruId,
                    conflict: {
                        jadwal_id: conflict.id_jadwal,
                        hari: conflict.hari,
                        jam_mulai: conflict.jam_mulai,
                        jam_selesai: conflict.jam_selesai,
                        mata_pelajaran: conflict.nama_mapel,
                        kelas: conflict.nama_kelas
                    }
                };
            }
        }

        return { hasConflict: false };
    } catch (error) {
        console.error('Error validating schedule conflicts:', error);
        throw error;
    }
}

// Get all schedules with join data
app.get('/api/admin/jadwal', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📅 Getting schedules for admin dashboard');

        const { query, params } = buildJadwalQuery('admin');
        const [rows] = await global.dbPool.execute(query, params);

        console.log(`✅ Schedules retrieved: ${rows.length} items`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting schedules:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add new schedule
app.post('/api/admin/jadwal', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const {
            kelas_id,
            mapel_id,
            guru_id, // Keep for backward compatibility
            guru_ids, // New array for multi-guru support
            ruang_id,
            hari,
            jam_ke,
            jam_mulai,
            jam_selesai,
            jenis_aktivitas = 'pelajaran',
            is_absenable = true,
            keterangan_khusus = null
        } = req.body;

        // Validasi format jam 24 jam
        const timeValidation = validateTimeLogic(jam_mulai, jam_selesai);
        if (!timeValidation.valid) {
            return res.status(400).json({ error: timeValidation.error });
        }

        // Support both single guru_id and array guru_ids for backward compatibility
        const finalGuruIds = guru_ids && guru_ids.length > 0 ? guru_ids : (guru_id ? [guru_id] : []);

        console.log('🔍 Debug Multi-Guru:', {
            finalGuruIds,
            guru_ids_from_request: req.body.guru_ids,
            guru_id_from_request: req.body.guru_id,
            request_body: req.body
        });

        // Validasi guru_ids sebelum insert (untuk aktivitas pelajaran)
        if (jenis_aktivitas === 'pelajaran' && finalGuruIds.length > 0) {
            // Filter invalid IDs (bukan number atau null/undefined)
            const validGuruIds = finalGuruIds.filter(id => id && !isNaN(id) && id > 0);

            if (validGuruIds.length === 0) {
                return res.status(400).json({
                    error: 'Tidak ada guru yang valid dipilih'
                });
            }

            if (validGuruIds.length !== finalGuruIds.length) {
                const invalidIds = finalGuruIds.filter(id => !validGuruIds.includes(id));
                console.log('⚠️ Invalid guru IDs filtered out:', invalidIds);
            }

            // Validasi apakah guru_ids benar-benar ada di database
            const placeholders = validGuruIds.map(() => '?').join(',');
            const [existingGurus] = await global.dbPool.execute(
                `SELECT id_guru, nama FROM guru WHERE id_guru IN (${placeholders})`,
                validGuruIds
            );

            if (existingGurus.length !== validGuruIds.length) {
                const existingIds = existingGurus.map(g => g.id_guru);
                const invalidIds = validGuruIds.filter(id => !existingIds.includes(id));
                console.log('❌ Guru tidak ditemukan:', invalidIds);
                return res.status(400).json({
                    error: `Guru dengan ID ${invalidIds.join(', ')} tidak ditemukan di database`
                });
            }

            console.log('✅ Validasi guru berhasil:', existingGurus.map(g => `${g.id_guru}:${g.nama}`));
        }

        console.log('➕ Adding schedule:', {
            kelas_id,
            mapel_id,
            guru_ids: finalGuruIds,
            ruang_id,
            hari,
            jam_ke,
            jam_mulai,
            jam_selesai,
            jenis_aktivitas,
            is_absenable
        });

        // Validation berbeda untuk aktivitas khusus
        if (jenis_aktivitas === 'pelajaran') {
            if (!kelas_id || !mapel_id || !hari || !jam_ke || !jam_mulai || !jam_selesai) {
                return res.status(400).json({ error: 'Semua field wajib diisi untuk jadwal pelajaran' });
            }
            if (finalGuruIds.length === 0) {
                return res.status(400).json({ error: 'Minimal satu guru harus dipilih untuk jadwal pelajaran' });
            }
        } else {
            if (!kelas_id || !hari || !jam_mulai || !jam_selesai) {
                return res.status(400).json({ error: 'Kelas, hari, dan waktu wajib diisi' });
            }
        }

        // Untuk aktivitas khusus, mapel_id dan guru_id bisa null
        const finalMapelId = jenis_aktivitas === 'pelajaran' ? mapel_id : null;

        // Pastikan finalGuruIds sudah ter-validasi untuk aktivitas pelajaran
        let primaryGuruId = null;
        if (jenis_aktivitas === 'pelajaran' && finalGuruIds.length > 0) {
            // Gunakan guru pertama yang valid sebagai primary guru
            const validGuruIds = finalGuruIds.filter(id => id && !isNaN(id) && id > 0);
            if (validGuruIds.length > 0) {
                primaryGuruId = validGuruIds[0];
            }
        }

        console.log('🎯 Primary Guru Logic:', {
            jenis_aktivitas,
            finalGuruIds,
            primaryGuruId,
            validGuruIds: finalGuruIds.filter(id => id && !isNaN(id) && id > 0)
        });

        // Check conflicts hanya untuk aktivitas yang membutuhkan ruang/guru
        if (jenis_aktivitas === 'pelajaran') {
            // Check class conflicts
            const [classConflicts] = await global.dbPool.execute(
                `SELECT id_jadwal, jam_mulai, jam_selesai FROM jadwal 
                 WHERE kelas_id = ? AND hari = ? AND status = 'aktif' AND jenis_aktivitas = 'pelajaran'`,
                [kelas_id, hari]
            );

            for (const conflict of classConflicts) {
                if (isTimeOverlap(jam_mulai, jam_selesai, conflict.jam_mulai, conflict.jam_selesai)) {
                    return res.status(400).json({
                        error: `Kelas sudah memiliki jadwal pelajaran pada ${hari} jam ${conflict.jam_mulai}-${conflict.jam_selesai}`
                    });
                }
            }

            // Validate teacher schedule conflicts
            if (finalGuruIds.length > 0) {
                const conflictValidation = await validateScheduleConflicts(finalGuruIds, hari, jam_mulai, jam_selesai);

                if (conflictValidation.hasConflict) {
                    const { guruId, conflict } = conflictValidation;
                    return res.status(400).json({
                        error: `Guru dengan ID ${guruId} sudah memiliki jadwal bentrok: ${conflict.mata_pelajaran} di ${conflict.kelas} pada ${conflict.hari} ${conflict.jam_mulai}-${conflict.jam_selesai}`
                    });
                }
            }

            // Check room conflicts
            if (ruang_id) {
                const [roomConflicts] = await global.dbPool.execute(
                    `SELECT id_jadwal, jam_mulai, jam_selesai FROM jadwal 
                     WHERE ruang_id = ? AND hari = ? AND status = 'aktif' AND jenis_aktivitas = 'pelajaran'`,
                    [ruang_id, hari]
                );

                for (const conflict of roomConflicts) {
                    if (isTimeOverlap(jam_mulai, jam_selesai, conflict.jam_mulai, conflict.jam_selesai)) {
                        return res.status(400).json({
                            error: `Ruang sudah digunakan pada ${hari} jam ${conflict.jam_mulai}-${conflict.jam_selesai}`
                        });
                    }
                }
            }
        }

        // Validasi final primaryGuruId sebelum insert
        if (jenis_aktivitas === 'pelajaran' && primaryGuruId) {
            const [guruCheck] = await global.dbPool.execute(
                'SELECT id_guru, nama FROM guru WHERE id_guru = ?',
                [primaryGuruId]
            );

            if (guruCheck.length === 0) {
                console.log('❌ Primary guru tidak ditemukan:', primaryGuruId);
                return res.status(400).json({
                    error: `Guru utama dengan ID ${primaryGuruId} tidak ditemukan di database`
                });
            }

            console.log('✅ Primary guru valid:', guruCheck[0]);
        }

        // Insert jadwal dengan guru utama
        const [result] = await global.dbPool.execute(
            `INSERT INTO jadwal (kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, status, jenis_aktivitas, is_absenable, keterangan_khusus, is_multi_guru)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?, ?, ?)`,
            [kelas_id, finalMapelId, primaryGuruId, ruang_id || null, hari, jam_ke, jam_mulai, jam_selesai, jenis_aktivitas, is_absenable ? 1 : 0, keterangan_khusus, finalGuruIds.length > 1 ? 1 : 0]
        );

        const jadwalId = result.insertId;

        // Insert semua guru ke jadwal_guru
        if (jenis_aktivitas === 'pelajaran' && finalGuruIds.length > 0) {
            const validGuruIds = finalGuruIds.filter(id => id && !isNaN(id) && id > 0);
            console.log('📝 Inserting jadwal_guru:', { jadwalId, validGuruIds });

            for (let i = 0; i < validGuruIds.length; i++) {
                try {
                    await global.dbPool.execute(
                        'INSERT INTO jadwal_guru (jadwal_id, guru_id, is_primary) VALUES (?, ?, ?)',
                        [jadwalId, validGuruIds[i], i === 0 ? 1 : 0]
                    );
                    console.log(`✅ Guru ${validGuruIds[i]} added to jadwal_guru (primary: ${i === 0})`);
                } catch (error) {
                    console.error(`❌ Error inserting guru ${validGuruIds[i]} to jadwal_guru:`, error);
                    throw error;
                }
            }
        }

        console.log('✅ Schedule added successfully');
        res.json({
            message: 'Jadwal berhasil ditambahkan',
            id: jadwalId
        });
    } catch (error) {
        console.error('❌ Error adding schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update schedule
app.put('/api/admin/jadwal/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            kelas_id,
            mapel_id,
            guru_id,
            guru_ids, // Tambahkan support untuk multi-guru
            ruang_id,
            hari,
            jam_ke,
            jam_mulai,
            jam_selesai,
            jenis_aktivitas = 'pelajaran',
            is_absenable = true,
            keterangan_khusus = null
        } = req.body;

        // Validasi format jam 24 jam
        const timeValidation = validateTimeLogic(jam_mulai, jam_selesai);
        if (!timeValidation.valid) {
            return res.status(400).json({ error: timeValidation.error });
        }

        // Support both single guru_id and array guru_ids for backward compatibility
        const finalGuruIds = guru_ids && guru_ids.length > 0 ? guru_ids : (guru_id ? [guru_id] : []);
        const isMultiGuru = finalGuruIds.length > 1;

        console.log('✏️ Updating schedule:', {
            id,
            kelas_id,
            mapel_id,
            guru_id,
            guru_ids,
            finalGuruIds,
            isMultiGuru,
            ruang_id,
            hari,
            jam_ke,
            jam_mulai,
            jam_selesai,
            jenis_aktivitas,
            is_absenable
        });

        // Validation berbeda untuk aktivitas khusus
        if (jenis_aktivitas === 'pelajaran') {
            if (!kelas_id || !mapel_id || !hari || !jam_ke || !jam_mulai || !jam_selesai) {
                return res.status(400).json({ error: 'Semua field wajib diisi untuk jadwal pelajaran' });
            }
            if (finalGuruIds.length === 0) {
                return res.status(400).json({ error: 'Minimal satu guru harus dipilih untuk jadwal pelajaran' });
            }
        } else {
            if (!kelas_id || !hari || !jam_mulai || !jam_selesai) {
                return res.status(400).json({ error: 'Kelas, hari, dan waktu wajib diisi' });
            }
        }

        // Untuk aktivitas khusus, mapel_id dan guru_id bisa null
        const finalMapelId = jenis_aktivitas === 'pelajaran' ? mapel_id : null;
        const finalGuruId = jenis_aktivitas === 'pelajaran' ? (finalGuruIds.length > 0 ? finalGuruIds[0] : null) : null;

        // Check conflicts hanya untuk aktivitas yang membutuhkan ruang/guru
        if (jenis_aktivitas === 'pelajaran') {
            // Check class conflicts (excluding current schedule)
            const [classConflicts] = await global.dbPool.execute(
                `SELECT id_jadwal, jam_mulai, jam_selesai FROM jadwal 
                 WHERE kelas_id = ? AND hari = ? AND status = 'aktif' AND jenis_aktivitas = 'pelajaran' AND id_jadwal != ?`,
                [kelas_id, hari, id]
            );

            for (const conflict of classConflicts) {
                if (isTimeOverlap(jam_mulai, jam_selesai, conflict.jam_mulai, conflict.jam_selesai)) {
                    return res.status(400).json({
                        error: `Kelas sudah memiliki jadwal pelajaran pada ${hari} jam ${conflict.jam_mulai}-${conflict.jam_selesai}`
                    });
                }
            }

            // Validate teacher schedule conflicts (excluding current schedule)
            if (finalGuruIds.length > 0) {
                const conflictValidation = await validateScheduleConflicts(finalGuruIds, hari, jam_mulai, jam_selesai, id);

                if (conflictValidation.hasConflict) {
                    const { guruId, conflict } = conflictValidation;
                    return res.status(400).json({
                        error: `Guru dengan ID ${guruId} sudah memiliki jadwal bentrok: ${conflict.mata_pelajaran} di ${conflict.kelas} pada ${conflict.hari} ${conflict.jam_mulai}-${conflict.jam_selesai}`
                    });
                }
            }

            // Check room conflicts (if ruang_id provided)
            if (ruang_id) {
                const [roomConflicts] = await global.dbPool.execute(
                    `SELECT id_jadwal, jam_mulai, jam_selesai FROM jadwal 
                     WHERE ruang_id = ? AND hari = ? AND status = 'aktif' AND jenis_aktivitas = 'pelajaran' AND id_jadwal != ?`,
                    [ruang_id, hari, id]
                );

                for (const conflict of roomConflicts) {
                    if (isTimeOverlap(jam_mulai, jam_selesai, conflict.jam_mulai, conflict.jam_selesai)) {
                        return res.status(400).json({
                            error: `Ruang sudah digunakan pada ${hari} jam ${conflict.jam_mulai}-${conflict.jam_selesai}`
                        });
                    }
                }
            }
        }

        const [result] = await global.dbPool.execute(
            `UPDATE jadwal 
             SET kelas_id = ?, mapel_id = ?, guru_id = ?, ruang_id = ?, hari = ?, jam_ke = ?, jam_mulai = ?, jam_selesai = ?, jenis_aktivitas = ?, is_absenable = ?, keterangan_khusus = ?, is_multi_guru = ?
             WHERE id_jadwal = ?`,
            [kelas_id, finalMapelId, finalGuruId, ruang_id || null, hari, jam_ke, jam_mulai, jam_selesai, jenis_aktivitas, is_absenable ? 1 : 0, keterangan_khusus, isMultiGuru ? 1 : 0, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
        }

        // Update jadwal_guru table untuk multi-guru schedules
        if (jenis_aktivitas === 'pelajaran' && finalGuruIds.length > 0) {
            console.log('🔄 Updating jadwal_guru table for multi-guru schedule...');

            // Hapus relasi lama
            await global.dbPool.execute(
                'DELETE FROM jadwal_guru WHERE jadwal_id = ?',
                [id]
            );

            // Tambahkan relasi baru
            for (let i = 0; i < finalGuruIds.length; i++) {
                const guruId = finalGuruIds[i];
                const isPrimary = i === 0; // Guru pertama sebagai primary

                await global.dbPool.execute(
                    'INSERT INTO jadwal_guru (jadwal_id, guru_id, is_primary) VALUES (?, ?, ?)',
                    [id, guruId, isPrimary ? 1 : 0]
                );

                console.log(`✅ Added guru ${guruId} to schedule ${id} (primary: ${isPrimary})`);
            }
        }

        console.log('✅ Schedule updated successfully');
        res.json({ message: 'Jadwal berhasil diperbarui' });
    } catch (error) {
        console.error('❌ Error updating schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete schedule  
app.delete('/api/admin/jadwal/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🗑️ Deleting schedule:', { id });

        const [result] = await global.dbPool.execute(
            'DELETE FROM jadwal WHERE id_jadwal = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
        }

        console.log('✅ Schedule deleted successfully');
        res.json({ message: 'Jadwal berhasil dihapus' });
    } catch (error) {
        console.error('❌ Error deleting schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========================================
// MULTI-GURU JADWAL MANAGEMENT ENDPOINTS
// ========================================

// Get all teachers in a schedule
app.get('/api/admin/jadwal/:id/guru', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        console.log('👥 Getting teachers for schedule:', { id });

        const [rows] = await global.dbPool.execute(`
            SELECT jg.id, jg.guru_id, jg.is_primary, g.nama, g.nip, g.mata_pelajaran
            FROM jadwal_guru jg
            JOIN guru g ON jg.guru_id = g.id_guru
            WHERE jg.jadwal_id = ?
            ORDER BY jg.is_primary DESC, g.nama ASC
        `, [id]);

        console.log(`✅ Found ${rows.length} teachers for schedule ${id}`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting schedule teachers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add teacher to schedule
app.post('/api/admin/jadwal/:id/guru', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { guru_id } = req.body;
        const jadwal_id = req.params.id;

        console.log('➕ Adding teacher to schedule:', { jadwal_id, guru_id });

        // Check if guru already in jadwal
        const [exists] = await global.dbPool.execute(
            'SELECT id FROM jadwal_guru WHERE jadwal_id = ? AND guru_id = ?',
            [jadwal_id, guru_id]
        );

        if (exists.length > 0) {
            return res.status(400).json({ error: 'Guru sudah ditambahkan ke jadwal ini' });
        }

        // Insert guru
        await global.dbPool.execute(
            'INSERT INTO jadwal_guru (jadwal_id, guru_id, is_primary) VALUES (?, ?, 0)',
            [jadwal_id, guru_id]
        );

        // Update is_multi_guru flag
        const [guruCount] = await global.dbPool.execute(
            'SELECT COUNT(*) as count FROM jadwal_guru WHERE jadwal_id = ?',
            [jadwal_id]
        );

        if (guruCount[0].count > 1) {
            await global.dbPool.execute(
                'UPDATE jadwal SET is_multi_guru = 1 WHERE id_jadwal = ?',
                [jadwal_id]
            );
        }

        console.log('✅ Teacher added to schedule successfully');
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error adding teacher to schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove teacher from schedule
app.delete('/api/admin/jadwal/:id/guru/:guruId', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id: jadwal_id, guruId } = req.params;

        console.log('➖ Removing teacher from schedule:', { jadwal_id, guruId });

        // Check if primary guru
        const [guru] = await global.dbPool.execute(
            'SELECT is_primary FROM jadwal_guru WHERE jadwal_id = ? AND guru_id = ?',
            [jadwal_id, guruId]
        );

        if (guru.length > 0 && guru[0].is_primary === 1) {
            const [count] = await global.dbPool.execute(
                'SELECT COUNT(*) as count FROM jadwal_guru WHERE jadwal_id = ?',
                [jadwal_id]
            );

            if (count[0].count === 1) {
                return res.status(400).json({ error: 'Tidak bisa menghapus guru terakhir' });
            }
        }

        // Delete guru
        await global.dbPool.execute(
            'DELETE FROM jadwal_guru WHERE jadwal_id = ? AND guru_id = ?',
            [jadwal_id, guruId]
        );

        // Update is_multi_guru flag
        const [guruCount] = await global.dbPool.execute(
            'SELECT COUNT(*) as count FROM jadwal_guru WHERE jadwal_id = ?',
            [jadwal_id]
        );

        await global.dbPool.execute(
            'UPDATE jadwal SET is_multi_guru = ? WHERE id_jadwal = ?',
            [guruCount[0].count > 1 ? 1 : 0, jadwal_id]
        );

        console.log('✅ Teacher removed from schedule successfully');
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error removing teacher from schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get students for a specific schedule (class)
app.get('/api/schedule/:id/students', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`👥 Getting students for schedule ID: ${id}`);

        // First, get the schedule details to get the class ID and check if it's multi-guru
        const [scheduleData] = await global.dbPool.execute(
            'SELECT kelas_id, is_multi_guru FROM jadwal WHERE id_jadwal = ? AND status = "aktif"',
            [id]
        );

        if (scheduleData.length === 0) {
            return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
        }

        const kelasId = scheduleData[0].kelas_id;
        const isMultiGuru = scheduleData[0].is_multi_guru === 1;
        const currentDate = (() => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        })();

        // Get all students in the class with their existing attendance for today
        // Only include other_teachers_attendance for multi-guru schedules
        const [students] = await global.dbPool.execute(
            `SELECT 
                s.id_siswa as id,
                s.nis,
                s.nama,
                s.jenis_kelamin,
                s.jabatan,
                s.status,
                k.nama_kelas,
                COALESCE(a.status, 'Hadir') as attendance_status,
                a.keterangan as attendance_note,
                a.waktu_absen,
                a.guru_pengabsen_id,
                g.nama as guru_pengabsen_nama,
                ${isMultiGuru ? `GROUP_CONCAT(
                    CONCAT(
                        COALESCE(g2.nama, 'Unknown'), ':', 
                        COALESCE(a2.status, 'Belum'), ':', 
                        COALESCE(a2.keterangan, ''), ':', 
                        COALESCE(a2.waktu_absen, '')
                    ) 
                    ORDER BY a2.waktu_absen DESC 
                    SEPARATOR '||'
                ) as other_teachers_attendance` : `NULL as other_teachers_attendance`}
            FROM siswa s
            JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND a.jadwal_id = ? 
                AND a.tanggal = ?
                AND a.guru_pengabsen_id = ?
            LEFT JOIN guru g ON a.guru_pengabsen_id = g.id_guru
            ${isMultiGuru ? `LEFT JOIN absensi_siswa a2 ON s.id_siswa = a2.siswa_id 
                AND a2.jadwal_id = ? 
                AND a2.tanggal = ?
                AND (a2.guru_pengabsen_id != ? OR a2.guru_pengabsen_id IS NULL)
            LEFT JOIN guru g2 ON a2.guru_pengabsen_id = g2.id_guru` : ''}
            WHERE s.kelas_id = ? AND s.status = 'aktif'
            GROUP BY s.id_siswa, s.nis, s.nama, s.jenis_kelamin, s.jabatan, s.status, k.nama_kelas, a.status, a.keterangan, a.waktu_absen, a.guru_pengabsen_id, g.nama
            ORDER BY s.nama ASC`,
            isMultiGuru ? [id, currentDate, req.user.guru_id, id, currentDate, req.user.guru_id, kelasId] : [id, currentDate, req.user.guru_id, kelasId]
        );

        console.log(`✅ Found ${students.length} students for schedule ${id} (class ${kelasId}) with attendance data`);
        res.json(students);
    } catch (error) {
        console.error('❌ Error getting students for schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get students for a specific schedule by date (for editing past attendance)
app.get('/api/schedule/:id/students-by-date', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { tanggal } = req.query;
        console.log(`👥 Getting students for schedule ID: ${id} on date: ${tanggal}`);

        // Validate date range (max 30 days ago)
        const today = getWIBTime();
        const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
        const targetDate = tanggal ? new Date(tanggal) : today;

        if (targetDate > today) {
            return res.status(400).json({ error: 'Tidak dapat melihat absen untuk tanggal masa depan' });
        }

        if (targetDate < thirtyDaysAgo) {
            return res.status(400).json({ error: 'Tidak dapat melihat absen lebih dari 30 hari yang lalu' });
        }

        // First, get the schedule details to get the class ID
        const [scheduleData] = await global.dbPool.execute(
            'SELECT kelas_id FROM jadwal WHERE id_jadwal = ? AND status = "aktif"',
            [id]
        );

        if (scheduleData.length === 0) {
            return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
        }

        const kelasId = scheduleData[0].kelas_id;
        const targetDateStr = tanggal || formatWIBDate();

        // Get all students in the class with their existing attendance for the target date
        const [students] = await global.dbPool.execute(
            `SELECT 
                s.id_siswa as id,
                s.nis,
                s.nama,
                s.jenis_kelamin,
                s.jabatan,
                s.status,
                k.nama_kelas,
                COALESCE(a.status, 'Hadir') as attendance_status,
                a.keterangan as attendance_note,
                a.waktu_absen
            FROM siswa s
            JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND a.jadwal_id = ? 
                AND a.tanggal = ?
            WHERE s.kelas_id = ? AND s.status = 'aktif'
            ORDER BY s.nama ASC`,
            [id, targetDateStr, kelasId]
        );

        console.log(`✅ Found ${students.length} students for schedule ${id} (class ${kelasId}) on date ${targetDateStr}`);
        res.json(students);
    } catch (error) {
        console.error('❌ Error getting students by date for schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Submit attendance for a schedule
app.post('/api/attendance/submit', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        const { scheduleId, attendance, notes, guruId, tanggal_absen } = req.body;

        if (!scheduleId || !attendance || !guruId) {
            return res.status(400).json({ error: 'Data absensi tidak lengkap' });
        }

        console.log(`📝 Submitting attendance for schedule ${scheduleId} by teacher ${guruId}`);
        console.log(`📊 Attendance data:`, JSON.stringify(attendance, null, 2));
        console.log(`📝 Notes data:`, JSON.stringify(notes, null, 2));

        // Get the schedule details to verify it exists
        const [scheduleData] = await global.dbPool.execute(
            'SELECT kelas_id, mapel_id FROM jadwal WHERE id_jadwal = ? AND status = "aktif"',
            [scheduleId]
        );

        if (scheduleData.length === 0) {
            return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
        }

        const kelasId = scheduleData[0].kelas_id;
        const mapelId = scheduleData[0].mapel_id;

        // Use provided date or default to today (using WIB timezone)
        const targetDate = tanggal_absen || getMySQLDateWIB();

        // Validate date range (max 30 days ago) - using WIB timezone-aware functions
        const todayStr = getMySQLDateWIB();

        // Calculate days difference using WIB-aware function
        const daysDiff = getDaysDifferenceWIB(targetDate, todayStr);

        console.log('📅 Date validation (WIB):', {
            targetDate,
            todayStr,
            daysDifference: daysDiff,
            isFuture: daysDiff < 0,
            isTooOld: daysDiff > 30
        });

        // Check if date is in the future
        if (daysDiff < 0) {
            return res.status(400).json({ error: 'Tidak dapat mengubah absen untuk tanggal masa depan' });
        }

        // Check if date is more than 30 days ago
        if (daysDiff > 30) {
            return res.status(400).json({ error: 'Tidak dapat mengubah absen lebih dari 30 hari yang lalu' });
        }

        // Insert attendance records for each student
        const attendanceEntries = Object.entries(attendance);
        const currentTime = formatWIBTimeWithSeconds();

        for (const [studentId, attendanceData] of attendanceEntries) {
            // Handle both old format (string status) and new format (object with status, terlambat, ada_tugas)
            let status, terlambat = false, ada_tugas = false;

            if (typeof attendanceData === 'string') {
                status = attendanceData;
            } else if (typeof attendanceData === 'object' && attendanceData.status) {
                status = attendanceData.status;
                terlambat = attendanceData.terlambat || false;
                ada_tugas = attendanceData.ada_tugas || false;
            } else {
                console.log(`❌ Invalid attendance data format for student ${studentId}:`, attendanceData);
                return res.status(400).json({
                    error: `Format data absensi tidak valid untuk siswa ${studentId}`
                });
            }

            // Hapus keterangan jika status adalah Hadir
            const note = status === 'Hadir' ? '' : (notes[studentId] || '');

            // Validate status
            const validStatuses = ['Hadir', 'Izin', 'Sakit', 'Alpa', 'Dispen'];
            if (!validStatuses.includes(status)) {
                console.log(`❌ Invalid status "${status}" for student ${studentId}`);
                return res.status(400).json({
                    error: `Status tidak valid: ${status}. Status yang diperbolehkan: ${validStatuses.join(', ')}`
                });
            }

            // Map status berdasarkan opsi Terlambat dan Ada Tugas
            let finalStatus = status;
            let isLate = 0;
            let hasTask = 0;

            if (terlambat && status === 'Hadir') {
                isLate = 1;
                finalStatus = 'Hadir'; // Tetap Hadir tapi ditandai terlambat
            } else if (ada_tugas && (status === 'Alpa' || status === 'Sakit' || status === 'Izin')) {
                hasTask = 1;
                finalStatus = status; // Tetap status asli tapi ditandai ada tugas
            }

            console.log(`👤 Processing student ${studentId}: status="${finalStatus}", terlambat=${isLate}, ada_tugas=${hasTask}, note="${note}"`);

            // Check if attendance already exists for this student, jadwal, and guru on target date
            const [existingAttendance] = await global.dbPool.execute(
                'SELECT id, status as current_status, jadwal_id, guru_pengabsen_id FROM absensi_siswa WHERE siswa_id = ? AND jadwal_id = ? AND guru_pengabsen_id = ? AND tanggal = ?',
                [studentId, scheduleId, guruId, targetDate]
            );

            if (existingAttendance.length > 0) {
                const existingId = existingAttendance[0].id;
                const currentStatus = existingAttendance[0].current_status;
                console.log(`🔄 Updating existing attendance ID ${existingId} from "${currentStatus}" to "${finalStatus}" for guru ${guruId}`);

                // Update existing attendance for this specific guru
                const [updateResult] = await global.dbPool.execute(
                    'UPDATE absensi_siswa SET status = ?, keterangan = ?, waktu_absen = ?, guru_id = ?, guru_pengabsen_id = ?, terlambat = ?, ada_tugas = ? WHERE id = ?',
                    [finalStatus, note, `${targetDate} ${currentTime}`, guruId, guruId, isLate, hasTask, existingId]
                );

                console.log(`✅ Updated attendance for student ${studentId} by guru ${guruId}: ${updateResult.affectedRows} rows affected`);
            } else {
                console.log(`➕ Inserting new attendance for student ${studentId} by guru ${guruId}`);

                // Insert new attendance for this specific guru
                try {
                    const [insertResult] = await global.dbPool.execute(
                        'INSERT INTO absensi_siswa (siswa_id, jadwal_id, tanggal, status, keterangan, waktu_absen, guru_id, guru_pengabsen_id, terlambat, ada_tugas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [studentId, scheduleId, targetDate, finalStatus, note, `${targetDate} ${currentTime}`, guruId, guruId, isLate, hasTask]
                    );

                    console.log(`✅ Inserted new attendance for student ${studentId} by guru ${guruId}: ID ${insertResult.insertId}`);
                } catch (insertError) {
                    console.error(`❌ Error inserting attendance for student ${studentId}:`, insertError);
                    throw insertError;
                }
            }
        }

        // Check if this is a multi-guru schedule and auto-assign attendance to other teachers
        const [multiGuruCheck] = await global.dbPool.execute(
            'SELECT is_multi_guru FROM jadwal WHERE id_jadwal = ?',
            [scheduleId]
        );

        if (multiGuruCheck.length > 0 && multiGuruCheck[0].is_multi_guru === 1) {
            console.log(`🔄 This is a multi-guru schedule. Auto-assigning attendance to other teachers...`);

            // Get all teachers in this multi-guru schedule
            const [allTeachers] = await global.dbPool.execute(
                'SELECT guru_id FROM jadwal_guru WHERE jadwal_id = ? AND guru_id != ?',
                [scheduleId, guruId]
            );

            console.log(`👥 Found ${allTeachers.length} other teachers in this multi-guru schedule:`, allTeachers.map(t => t.guru_id));

            // Auto-assign attendance to all other teachers
            for (const teacher of allTeachers) {
                const otherGuruId = teacher.guru_id;
                console.log(`🔄 Auto-assigning attendance to teacher ${otherGuruId}...`);

                for (const [studentId, attendanceData] of attendanceEntries) {
                    // Handle both old format (string status) and new format (object with status, terlambat, ada_tugas)
                    let status, terlambat = false, ada_tugas = false;

                    if (typeof attendanceData === 'string') {
                        status = attendanceData;
                    } else if (typeof attendanceData === 'object' && attendanceData.status) {
                        status = attendanceData.status;
                        terlambat = attendanceData.terlambat || false;
                        ada_tugas = attendanceData.ada_tugas || false;
                    }

                    // Hapus keterangan jika status adalah Hadir
                    const note = status === 'Hadir' ? '' : (notes[studentId] || '');

                    // Map status berdasarkan opsi Terlambat dan Ada Tugas
                    let finalStatus = status;
                    let isLate = 0;
                    let hasTask = 0;

                    if (terlambat && status === 'Hadir') {
                        isLate = 1;
                        finalStatus = 'Hadir';
                    } else if (ada_tugas && (status === 'Alpa' || status === 'Sakit' || status === 'Izin')) {
                        hasTask = 1;
                        finalStatus = status;
                    }

                    // Check if attendance already exists for this student, jadwal, and other teacher
                    const [existingAttendance] = await global.dbPool.execute(
                        'SELECT id FROM absensi_siswa WHERE siswa_id = ? AND jadwal_id = ? AND guru_pengabsen_id = ? AND tanggal = ?',
                        [studentId, scheduleId, otherGuruId, targetDate]
                    );

                    if (existingAttendance.length > 0) {
                        // Update existing attendance for other teacher
                        await global.dbPool.execute(
                            'UPDATE absensi_siswa SET status = ?, keterangan = ?, waktu_absen = ?, guru_id = ?, guru_pengabsen_id = ?, terlambat = ?, ada_tugas = ? WHERE id = ?',
                            [finalStatus, note, `${targetDate} ${currentTime}`, otherGuruId, otherGuruId, isLate, hasTask, existingAttendance[0].id]
                        );
                        console.log(`✅ Updated auto-attendance for student ${studentId} by teacher ${otherGuruId}`);
                    } else {
                        // Insert new attendance for other teacher
                        await global.dbPool.execute(
                            'INSERT INTO absensi_siswa (siswa_id, jadwal_id, tanggal, status, keterangan, waktu_absen, guru_id, guru_pengabsen_id, terlambat, ada_tugas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                            [studentId, scheduleId, targetDate, finalStatus, note, `${targetDate} ${currentTime}`, otherGuruId, otherGuruId, isLate, hasTask]
                        );
                        console.log(`✅ Inserted auto-attendance for student ${studentId} by teacher ${otherGuruId}`);
                    }
                }
            }

            console.log(`✅ Auto-attendance completed for ${allTeachers.length} other teachers`);
        }

        console.log(`✅ Attendance submitted successfully for ${attendanceEntries.length} students`);
        res.json({
            message: 'Absensi berhasil disimpan',
            processed: attendanceEntries.length,
            date: targetDate,
            scheduleId: scheduleId,
            isMultiGuru: multiGuruCheck.length > 0 && multiGuruCheck[0].is_multi_guru === 1
        });
    } catch (error) {
        console.error('❌ Error submitting attendance:', error);
        res.status(500).json({
            error: 'Internal server error: ' + error.message,
            details: error.stack
        });
    }
});

// ================================================
// JADWAL TEMPLATE ENDPOINTS
// ================================================

// Download template basic untuk jadwal
app.get('/api/admin/jadwal/template-basic', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        // ExcelJS sudah diimport di bagian atas file
        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Template Input
        const inputSheet = workbook.addWorksheet('Data Jadwal');
        inputSheet.columns = [
            { header: 'kelas_id', key: 'kelas_id', width: 12 },
            { header: 'mapel_id', key: 'mapel_id', width: 12 },
            { header: 'guru_id', key: 'guru_id', width: 12 },
            { header: 'ruang_id', key: 'ruang_id', width: 12 },
            { header: 'hari', key: 'hari', width: 15 },
            { header: 'jam_ke', key: 'jam_ke', width: 10 },
            { header: 'jam_mulai', key: 'jam_mulai', width: 12 },
            { header: 'jam_selesai', key: 'jam_selesai', width: 12 },
            { header: 'jenis_aktivitas', key: 'jenis_aktivitas', width: 18 },
            { header: 'keterangan_khusus', key: 'keterangan_khusus', width: 25 }
        ];

        // Sheet 2: Referensi ID
        const refSheet = workbook.addWorksheet('Referensi ID');

        // Fetch data referensi
        const [kelas] = await global.dbPool.execute('SELECT id_kelas, nama_kelas FROM kelas WHERE status = "aktif"');
        const [mapel] = await global.dbPool.execute('SELECT id_mapel, nama_mapel FROM mapel WHERE status = "aktif"');
        const [guru] = await global.dbPool.execute('SELECT id_guru, nama, nip FROM guru WHERE status = "aktif"');
        const [ruang] = await global.dbPool.execute('SELECT id_ruang, kode_ruang, nama_ruang FROM ruang_kelas WHERE status = "aktif"');

        // Tambahkan data ke sheet referensi
        refSheet.addRow(['REFERENSI KELAS']);
        refSheet.addRow(['ID', 'Nama Kelas']);
        kelas.forEach(k => refSheet.addRow([k.id_kelas, k.nama_kelas]));

        refSheet.addRow([]);
        refSheet.addRow(['REFERENSI MATA PELAJARAN']);
        refSheet.addRow(['ID', 'Nama Mapel']);
        mapel.forEach(m => refSheet.addRow([m.id_mapel, m.nama_mapel]));

        refSheet.addRow([]);
        refSheet.addRow(['REFERENSI GURU']);
        refSheet.addRow(['ID', 'Nama', 'NIP']);
        guru.forEach(g => refSheet.addRow([g.id_guru, g.nama, g.nip]));

        refSheet.addRow([]);
        refSheet.addRow(['REFERENSI RUANG']);
        refSheet.addRow(['ID', 'Kode Ruang', 'Nama Ruang']);
        ruang.forEach(r => refSheet.addRow([r.id_ruang, r.kode_ruang, r.nama_ruang]));

        // Set headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-jadwal-basic.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating basic template:', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
});

// Download template user-friendly untuk jadwal
app.get('/api/admin/jadwal/template-friendly', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        // ExcelJS sudah diimport di bagian atas file
        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Template Input
        const inputSheet = workbook.addWorksheet('Data Jadwal');
        inputSheet.columns = [
            { header: 'Kelas', key: 'kelas', width: 15 },
            { header: 'Mata Pelajaran', key: 'mapel', width: 20 },
            { header: 'Guru', key: 'guru', width: 25 },
            { header: 'Guru Tambahan', key: 'guru_tambahan', width: 25 },
            { header: 'Kode Ruang', key: 'ruang', width: 15 },
            { header: 'Hari', key: 'hari', width: 15 },
            { header: 'Jam Ke', key: 'jam_ke', width: 10 },
            { header: 'Jam Mulai', key: 'jam_mulai', width: 12 },
            { header: 'Jam Selesai', key: 'jam_selesai', width: 12 },
            { header: 'Jenis Aktivitas', key: 'jenis_aktivitas', width: 18 },
            { header: 'Keterangan Khusus', key: 'keterangan_khusus', width: 25 }
        ];

        // Tambahkan contoh data untuk pelajaran
        inputSheet.addRow({
            kelas: 'X IPA 1',
            mapel: 'Matematika',
            guru: 'Budi Santoso',
            guru_tambahan: 'Siti Aminah, Ahmad Rizki',
            ruang: 'LAB-01',
            hari: 'Senin',
            jam_ke: 1,
            jam_mulai: '07:00:00',
            jam_selesai: '07:45:00',
            jenis_aktivitas: 'pelajaran',
            keterangan_khusus: 'Team Teaching'
        });

        // Tambahkan contoh data untuk upacara (field kosong untuk mapel dan guru)
        inputSheet.addRow({
            kelas: 'X IPA 1',
            mapel: '', // KOSONG untuk upacara
            guru: '', // KOSONG untuk upacara
            guru_tambahan: '', // KOSONG untuk upacara
            ruang: '',
            hari: 'Senin',
            jam_ke: 0,
            jam_mulai: '07:00:00',
            jam_selesai: '07:30:00',
            jenis_aktivitas: 'upacara',
            keterangan_khusus: 'Upacara Bendera' // WAJIB untuk upacara
        });

        // Tambahkan contoh data untuk istirahat
        inputSheet.addRow({
            kelas: 'X IPA 1',
            mapel: '', // KOSONG untuk istirahat
            guru: '', // KOSONG untuk istirahat
            guru_tambahan: '', // KOSONG untuk istirahat
            ruang: '',
            hari: 'Senin',
            jam_ke: 0,
            jam_mulai: '09:30:00',
            jam_selesai: '10:00:00',
            jenis_aktivitas: 'istirahat',
            keterangan_khusus: 'Istirahat Pagi' // WAJIB untuk istirahat
        });

        // Sheet 2-5: Referensi
        const [kelas] = await global.dbPool.execute('SELECT id_kelas, nama_kelas FROM kelas WHERE status = "aktif"');
        const kelasSheet = workbook.addWorksheet('Ref Kelas');
        kelasSheet.addRow(['ID', 'Nama Kelas']);
        kelas.forEach(k => kelasSheet.addRow([k.id_kelas, k.nama_kelas]));

        const [mapel] = await global.dbPool.execute('SELECT id_mapel, nama_mapel FROM mapel WHERE status = "aktif"');
        const mapelSheet = workbook.addWorksheet('Ref Mapel');
        mapelSheet.addRow(['ID', 'Nama Mapel']);
        mapel.forEach(m => mapelSheet.addRow([m.id_mapel, m.nama_mapel]));

        const [guru] = await global.dbPool.execute('SELECT id_guru, nama, nip FROM guru WHERE status = "aktif"');
        const guruSheet = workbook.addWorksheet('Ref Guru');
        guruSheet.addRow(['ID', 'Nama', 'NIP']);
        guru.forEach(g => guruSheet.addRow([g.id_guru, g.nama, g.nip]));

        const [ruang] = await global.dbPool.execute('SELECT id_ruang, kode_ruang, nama_ruang FROM ruang_kelas WHERE status = "aktif"');
        const ruangSheet = workbook.addWorksheet('Ref Ruang');
        ruangSheet.addRow(['ID', 'Kode Ruang', 'Nama Ruang']);
        ruang.forEach(r => ruangSheet.addRow([r.id_ruang, r.kode_ruang, r.nama_ruang]));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-jadwal-friendly.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating friendly template:', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
});

// ================================================
// RUANG KELAS ENDPOINTS - Room Management
// ================================================

// Get all rooms
app.get('/api/admin/ruang', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('🏢 Getting rooms for admin');

        const { search } = req.query;
        let query = `
            SELECT 
                id_ruang as id,
                kode_ruang,
                nama_ruang,
                lokasi,
                kapasitas,
                status,
                created_at
            FROM ruang_kelas
        `;

        const params = [];
        if (search) {
            query += ` WHERE kode_ruang LIKE ? OR nama_ruang LIKE ? OR lokasi LIKE ?`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        query += ` ORDER BY kode_ruang`;

        const [rows] = await global.dbPool.execute(query, params);
        console.log(`✅ Rooms retrieved: ${rows.length} items`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting rooms:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single room
app.get('/api/admin/ruang/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🏢 Getting room ${id}`);

        const [rows] = await global.dbPool.execute(
            'SELECT * FROM ruang_kelas WHERE id_ruang = ?',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Ruang tidak ditemukan' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('❌ Error getting room:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new room
app.post('/api/admin/ruang', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { kode_ruang, nama_ruang, lokasi, kapasitas, status } = req.body;
        console.log('➕ Creating room:', { kode_ruang, nama_ruang, lokasi, kapasitas, status });

        // Validation
        if (!kode_ruang) {
            return res.status(400).json({ error: 'Kode ruang wajib diisi' });
        }

        // Convert to uppercase and validate format
        const kodeUpper = kode_ruang.toUpperCase().trim();
        if (kodeUpper.length > 10) {
            return res.status(400).json({ error: 'Kode ruang maksimal 10 karakter' });
        }

        // Check for duplicate kode_ruang
        const [existing] = await global.dbPool.execute(
            'SELECT id_ruang FROM ruang_kelas WHERE kode_ruang = ?',
            [kodeUpper]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Kode ruang sudah digunakan' });
        }

        // Insert new room
        const [result] = await global.dbPool.execute(
            `INSERT INTO ruang_kelas (kode_ruang, nama_ruang, lokasi, kapasitas, status) 
             VALUES (?, ?, ?, ?, ?)`,
            [kodeUpper, nama_ruang || null, lokasi || null, kapasitas || null, status || 'aktif']
        );

        console.log(`✅ Room created with ID: ${result.insertId}`);
        res.status(201).json({
            success: true,
            message: 'Ruang berhasil ditambahkan',
            id: result.insertId
        });
    } catch (error) {
        console.error('❌ Error creating room:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update room
app.put('/api/admin/ruang/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { kode_ruang, nama_ruang, lokasi, kapasitas, status } = req.body;
        console.log('✏️ Updating room:', { id, kode_ruang, nama_ruang, lokasi, kapasitas, status });

        // Validation
        if (!kode_ruang) {
            return res.status(400).json({ error: 'Kode ruang wajib diisi' });
        }

        // Convert to uppercase and validate format
        const kodeUpper = kode_ruang.toUpperCase().trim();
        if (kodeUpper.length > 10) {
            return res.status(400).json({ error: 'Kode ruang maksimal 10 karakter' });
        }

        // Check for duplicate kode_ruang (excluding current room)
        const [existing] = await global.dbPool.execute(
            'SELECT id_ruang FROM ruang_kelas WHERE kode_ruang = ? AND id_ruang != ?',
            [kodeUpper, id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Kode ruang sudah digunakan' });
        }

        // Update room
        const [result] = await global.dbPool.execute(
            `UPDATE ruang_kelas 
             SET kode_ruang = ?, nama_ruang = ?, lokasi = ?, kapasitas = ?, status = ?
             WHERE id_ruang = ?`,
            [kodeUpper, nama_ruang || null, lokasi || null, kapasitas || null, status || 'aktif', id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ruang tidak ditemukan' });
        }

        console.log(`✅ Room updated: ${result.affectedRows} rows affected`);
        res.json({ success: true, message: 'Ruang berhasil diperbarui' });
    } catch (error) {
        console.error('❌ Error updating room:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete room
app.delete('/api/admin/ruang/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🗑️ Deleting room ${id}`);

        // Check if room is used in jadwal
        const [jadwalUsage] = await global.dbPool.execute(
            'SELECT COUNT(*) as count FROM jadwal WHERE ruang_id = ?',
            [id]
        );

        if (jadwalUsage[0].count > 0) {
            return res.status(400).json({
                error: 'Tidak dapat menghapus ruang yang sedang digunakan dalam jadwal'
            });
        }

        // Delete room
        const [result] = await global.dbPool.execute(
            'DELETE FROM ruang_kelas WHERE id_ruang = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ruang tidak ditemukan' });
        }

        console.log(`✅ Room deleted: ${result.affectedRows} rows affected`);
        res.json({ success: true, message: 'Ruang berhasil dihapus' });
    } catch (error) {
        console.error('❌ Error deleting room:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================================
// REPORTS ENDPOINTS - Teacher Attendance Reports
// ================================================

// Update permission request status
app.put('/api/admin/izin/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !['disetujui', 'ditolak'].includes(status)) {
            return res.status(400).json({ error: 'Status harus disetujui atau ditolak' });
        }

        console.log(`🔄 Updating permission request ${id} to ${status}...`);

        // Endpoint deprecated - pengajuan izin sudah dihapus
        return res.status(410).json({
            error: 'Endpoint deprecated',
            message: 'Pengajuan izin sudah dihapus dari sistem'
        });

        console.log(`✅ Permission request ${id} updated to ${status}`);
        res.json({ message: `Pengajuan berhasil ${status}` });
    } catch (error) {
        console.error('❌ Error updating permission request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get analytics data for dashboard
app.get('/api/admin/analytics', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📊 Getting analytics dashboard data...');

        // Get current WIB date components
        const todayWIB = getMySQLDateWIB();
        const wibNow = getWIBTime();
        const currentYear = wibNow.getFullYear();
        const currentMonth = wibNow.getMonth() + 1;

        // Get student attendance statistics
        const studentAttendanceQuery = `
            SELECT 
                'Hari Ini' as periode,
                COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as hadir,
                COUNT(CASE WHEN a.status != 'Hadir' OR a.status IS NULL THEN 1 END) as tidak_hadir
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id AND a.tanggal = ?
            UNION ALL
            SELECT 
                'Minggu Ini' as periode,
                COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as hadir,
                COUNT(CASE WHEN a.status != 'Hadir' OR a.status IS NULL THEN 1 END) as tidak_hadir
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND YEARWEEK(a.tanggal, 1) = YEARWEEK(?, 1)
            UNION ALL
            SELECT 
                'Bulan Ini' as periode,
                COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as hadir,
                COUNT(CASE WHEN a.status != 'Hadir' OR a.status IS NULL THEN 1 END) as tidak_hadir
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND YEAR(a.tanggal) = ? 
                AND MONTH(a.tanggal) = ?
        `;

        // Get teacher attendance statistics  
        const teacherAttendanceQuery = `
            SELECT 
                'Hari Ini' as periode,
                COUNT(CASE WHEN ag.status = 'Hadir' THEN 1 END) as hadir,
                COUNT(CASE WHEN ag.status != 'Hadir' OR ag.status IS NULL THEN 1 END) as tidak_hadir
            FROM guru g
            LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id AND ag.tanggal = ?
            UNION ALL
            SELECT 
                'Minggu Ini' as periode,
                COUNT(CASE WHEN ag.status = 'Hadir' THEN 1 END) as hadir,
                COUNT(CASE WHEN ag.status != 'Hadir' OR ag.status IS NULL THEN 1 END) as tidak_hadir
            FROM guru g
            LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id 
                AND YEARWEEK(ag.tanggal, 1) = YEARWEEK(?, 1)
            UNION ALL
            SELECT 
                'Bulan Ini' as periode,
                COUNT(CASE WHEN ag.status = 'Hadir' THEN 1 END) as hadir,
                COUNT(CASE WHEN ag.status != 'Hadir' OR ag.status IS NULL THEN 1 END) as tidak_hadir
            FROM guru g
            LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id 
                AND YEAR(ag.tanggal) = ? 
                AND MONTH(ag.tanggal) = ?
        `;

        // Get top absent students
        const topAbsentStudentsQuery = `
            SELECT 
                s.nama,
                k.nama_kelas,
                COUNT(CASE WHEN a.status IN ('Alpa', 'Izin', 'Sakit', 'Dispen') THEN 1 END) as total_alpa
            FROM siswa s
            JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id
            GROUP BY s.id_siswa, s.nama, k.nama_kelas
            HAVING total_alpa > 0
            ORDER BY total_alpa DESC
            LIMIT 5
        `;

        // Get top absent teachers
        const topAbsentTeachersQuery = `
            SELECT 
                g.nama,
                COUNT(CASE WHEN ag.status IN ('Tidak Hadir', 'Sakit', 'Izin', 'Dispen') THEN 1 END) as total_tidak_hadir
            FROM guru g
            LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id
            GROUP BY g.id_guru, g.nama
            HAVING total_tidak_hadir > 0
            ORDER BY total_tidak_hadir DESC
            LIMIT 5
        `;

        // Get recent notifications/banding absen requests
        const notificationsQuery = `
            SELECT 
                ba.id_banding as id,
                CONCAT('Banding absen dari ', s.nama, ' (', k.nama_kelas, ')') as message,
                ba.tanggal_pengajuan as timestamp,
                ba.status_banding as status,
                'attendance_appeal' as type
            FROM pengajuan_banding_absen ba
            JOIN siswa s ON ba.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE ba.status_banding = 'pending'
            ORDER BY ba.tanggal_pengajuan DESC
            LIMIT 10
        `;

        // Get total students count (lightweight query)
        const [totalStudentsResult] = await global.dbPool.execute('SELECT COUNT(*) as total FROM siswa WHERE status = "aktif"');
        const totalStudents = totalStudentsResult[0]?.total || 0;

        const [studentAttendance] = await global.dbPool.execute(studentAttendanceQuery, [todayWIB, todayWIB, currentYear, currentMonth]);
        const [teacherAttendance] = await global.dbPool.execute(teacherAttendanceQuery, [todayWIB, todayWIB, currentYear, currentMonth]);
        const [topAbsentStudents] = await global.dbPool.execute(topAbsentStudentsQuery);
        const [topAbsentTeachers] = await global.dbPool.execute(topAbsentTeachersQuery);
        const [notifications] = await global.dbPool.execute(notificationsQuery);

        const analyticsData = {
            studentAttendance: studentAttendance || [],
            teacherAttendance: teacherAttendance || [],
            topAbsentStudents: topAbsentStudents || [],
            topAbsentTeachers: topAbsentTeachers || [],
            notifications: notifications || [],
            totalStudents: totalStudents
        };

        console.log(`✅ Analytics data retrieved successfully`);
        res.json(analyticsData);
    } catch (error) {
        console.error('❌ Error getting analytics data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get live teacher attendance
app.get('/api/admin/live-teacher-attendance', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📊 Getting live teacher attendance...');

        const todayWIB = getMySQLDateWIB();
        const wibNow = getWIBTime();
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const currentDayWIB = dayNames[wibNow.getDay()];

        const query = `
            SELECT DISTINCT
                g.id_guru as id,
                g.nama,
                g.nip,
                GROUP_CONCAT(DISTINCT m.nama_mapel ORDER BY m.nama_mapel SEPARATOR ', ') as nama_mapel,
                GROUP_CONCAT(DISTINCT k.nama_kelas ORDER BY k.nama_kelas SEPARATOR ', ') as nama_kelas,
                MIN(j.jam_mulai) as jam_mulai,
                MAX(j.jam_selesai) as jam_selesai,
                COALESCE(ag.status, 'Belum Absen') as status,
                DATE_FORMAT(ag.waktu_catat, '%H:%i:%s') as waktu_absen,
                ag.keterangan,
                ag.waktu_catat as waktu_absen_full,
                CASE 
                    WHEN ag.waktu_catat IS NOT NULL THEN
                        CASE 
                            WHEN TIME(ag.waktu_catat) < '07:00:00' THEN 'Tepat Waktu'
                            WHEN TIME(ag.waktu_catat) BETWEEN '07:00:00' AND '07:15:00' THEN 'Terlambat Ringan'
                            WHEN TIME(ag.waktu_catat) BETWEEN '07:15:00' AND '08:00:00' THEN 'Terlambat'
                            ELSE 'Terlambat Berat'
                        END
                    ELSE '-'
                END as keterangan_waktu,
                CASE 
                    WHEN ag.waktu_catat IS NOT NULL THEN
                        CASE 
                            WHEN HOUR(ag.waktu_catat) < 12 THEN 'Pagi'
                            WHEN HOUR(ag.waktu_catat) < 15 THEN 'Siang'
                            ELSE 'Sore'
                        END
                    ELSE 'Belum Absen'
                END as periode_absen
            FROM jadwal j
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN absensi_guru ag ON j.id_jadwal = ag.jadwal_id 
                AND DATE(ag.tanggal) = ?
            WHERE j.hari = ?
            GROUP BY g.id_guru, g.nama, g.nip, ag.status, ag.waktu_catat, ag.keterangan
            ORDER BY 
                CASE WHEN ag.waktu_catat IS NOT NULL THEN 0 ELSE 1 END,
                ag.waktu_catat DESC,
                g.nama
        `;

        const [rows] = await global.dbPool.execute(query, [todayWIB, currentDayWIB]);
        console.log(`✅ Live teacher attendance retrieved: ${rows.length} records`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting live teacher attendance:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get live student attendance
app.get('/api/admin/live-student-attendance', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📊 Getting live student attendance...');

        // FIX: Get today's date in WIB timezone
        const todayWIB = getMySQLDateWIB();

        const query = `
            SELECT 
                s.id_siswa as id,
                s.nama,
                s.nis,
                k.nama_kelas,
                COALESCE(a.status, 'Belum Absen') as status,
                DATE_FORMAT(a.waktu_absen, '%H:%i:%s') as waktu_absen,
                a.keterangan,
                a.waktu_absen as waktu_absen_full,
                CASE 
                    WHEN a.waktu_absen IS NOT NULL THEN
                        CASE 
                            WHEN TIME(a.waktu_absen) < '07:00:00' THEN 'Tepat Waktu'
                            WHEN TIME(a.waktu_absen) BETWEEN '07:00:00' AND '07:15:00' THEN 'Terlambat Ringan'
                            WHEN TIME(a.waktu_absen) BETWEEN '07:15:00' AND '08:00:00' THEN 'Terlambat'
                            ELSE 'Terlambat Berat'
                        END
                    ELSE '-'
                END as keterangan_waktu,
                CASE 
                    WHEN a.waktu_absen IS NOT NULL THEN
                        CASE 
                            WHEN HOUR(a.waktu_absen) < 12 THEN 'Pagi'
                            WHEN HOUR(a.waktu_absen) < 15 THEN 'Siang'
                            ELSE 'Sore'
                        END
                    ELSE 'Belum Absen'
                END as periode_absen
            FROM siswa s
            JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND DATE(a.waktu_absen) = ?
            WHERE s.status = 'aktif'
            ORDER BY 
                CASE WHEN a.waktu_absen IS NOT NULL THEN 0 ELSE 1 END,
                a.waktu_absen DESC,
                k.nama_kelas,
                s.nama
        `;

        const [rows] = await global.dbPool.execute(query, [todayWIB]);
        console.log(`✅ Live student attendance retrieved: ${rows.length} records`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting live student attendance:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get teacher attendance report
app.get('/api/admin/teacher-attendance-report', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        console.log('📊 Getting teacher attendance report:', { startDate, endDate, kelas_id });

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }

        let query = `
            SELECT 
                DATE_FORMAT(ag.tanggal, '%Y-%m-%d') as tanggal,
                k.nama_kelas,
                COALESCE(g.nama, 'Sistem') as nama_guru,
                g.nip as nip_guru,
                m.nama_mapel,
                CASE 
                    WHEN ag.jam_ke IS NOT NULL THEN CONCAT('Jam ke-', ag.jam_ke)
                    ELSE CONCAT(j.jam_mulai, ' - ', j.jam_selesai)
                END as jam_hadir,
                j.jam_mulai,
                j.jam_selesai,
                COALESCE(ag.status, 'Tidak Ada Data') as status,
                COALESCE(ag.keterangan, '-') as keterangan,
                j.jam_ke
            FROM jadwal j
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN absensi_guru ag ON j.id_jadwal = ag.jadwal_id 
                AND ag.tanggal BETWEEN ? AND ?
            WHERE j.status = 'aktif'
        `;

        const params = [startDate, endDate];

        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }

        query += ' ORDER BY ag.tanggal DESC, k.nama_kelas, j.jam_ke';

        const [rows] = await global.dbPool.execute(query, params);
        console.log(`✅ Teacher attendance report retrieved: ${rows.length} records`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting teacher attendance report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download teacher attendance report as Excel
app.get('/api/admin/download-teacher-attendance', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        console.log('📊 Downloading teacher attendance report:', { startDate, endDate, kelas_id });

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }

        let query = `
            SELECT 
                COALESCE(DATE_FORMAT(ag.tanggal, '%d/%m/%Y'), DATE_FORMAT(DATE(NOW()), '%d/%m/%Y')) as tanggal,
                k.nama_kelas,
                COALESCE(g.nama, 'Sistem') as nama_guru,
                g.nip as nip_guru,
                m.nama_mapel,
                CASE 
                    WHEN ag.jam_ke IS NOT NULL THEN CONCAT('Jam ke-', ag.jam_ke)
                    ELSE CONCAT(j.jam_mulai, ' - ', j.jam_selesai)
                END as jam_hadir,
                j.jam_mulai,
                j.jam_selesai,
                CONCAT(j.jam_mulai, ' - ', j.jam_selesai) as jadwal,
                COALESCE(ag.status, 'Tidak Ada Data') as status,
                COALESCE(ag.keterangan, '-') as keterangan
            FROM jadwal j
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN absensi_guru ag ON j.id_jadwal = ag.jadwal_id 
                AND ag.tanggal BETWEEN ? AND ?
            WHERE j.status = 'aktif'
        `;

        const params = [startDate, endDate];

        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }

        query += ' ORDER BY ag.tanggal DESC, k.nama_kelas, j.jam_ke';

        const [rows] = await global.dbPool.execute(query, params);

        // Enhanced CSV format with UTF-8 BOM for Excel compatibility
        let csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += 'Tanggal,Kelas,Guru,NIP,Mata Pelajaran,Jam Hadir,Jam Mulai,Jam Selesai,Jadwal,Status,Keterangan\n';

        rows.forEach(row => {
            csvContent += `"${row.tanggal}","${row.nama_kelas}","${row.nama_guru}","${row.nip_guru || ''}","${row.nama_mapel}","${row.jam_hadir || ''}","${row.jam_mulai}","${row.jam_selesai}","${row.jadwal}","${row.status}","${row.keterangan || ''}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="laporan-kehadiran-guru-${startDate}-${endDate}.csv"`);
        res.send(csvContent);

        console.log(`✅ Teacher attendance report downloaded successfully: ${rows.length} records`);
    } catch (error) {
        console.error('❌ Error downloading teacher attendance report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get student attendance report
app.get('/api/admin/student-attendance-report', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        console.log('📊 Getting student attendance report:', { startDate, endDate, kelas_id });

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }

        let query = `
            SELECT 
                DATE_FORMAT(a.waktu_absen, '%Y-%m-%d') as tanggal,
                k.nama_kelas,
                s.nama as nama_siswa,
                s.nis as nis_siswa,
                'Absensi Harian' as nama_mapel,
                'Siswa Perwakilan' as nama_guru,
                DATE_FORMAT(a.waktu_absen, '%H:%i:%s') as waktu_absen,
                '07:00' as jam_mulai,
                '17:00' as jam_selesai,
                COALESCE(a.status, 'Tidak Hadir') as status,
                COALESCE(a.keterangan, '-') as keterangan,
                NULL as jam_ke
            FROM absensi_siswa a
            JOIN siswa s ON a.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE DATE(a.waktu_absen) BETWEEN ? AND ?
        `;

        const params = [startDate, endDate];

        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }

        query += ' ORDER BY a.waktu_absen DESC, k.nama_kelas, s.nama';

        const [rows] = await global.dbPool.execute(query, params);
        console.log(`✅ Student attendance report retrieved: ${rows.length} records`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting student attendance report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download student attendance report as CSV
app.get('/api/admin/download-student-attendance', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        console.log('📊 Downloading student attendance report:', { startDate, endDate, kelas_id });

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }

        let query = `
            SELECT 
                DATE_FORMAT(a.waktu_absen, '%d/%m/%Y') as tanggal,
                k.nama_kelas,
                s.nama as nama_siswa,
                s.nis as nis_siswa,
                'Absensi Harian' as nama_mapel,
                'Siswa Perwakilan' as nama_guru,
                DATE_FORMAT(a.waktu_absen, '%H:%i:%s') as waktu_absen,
                '07:00' as jam_mulai,
                '17:00' as jam_selesai,
                '07:00 - 17:00' as jadwal,
                COALESCE(a.status, 'Tidak Hadir') as status,
                COALESCE(a.keterangan, '-') as keterangan
            FROM absensi_siswa a
            JOIN siswa s ON a.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE DATE(a.waktu_absen) BETWEEN ? AND ?
        `;

        const params = [startDate, endDate];

        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }

        query += ' ORDER BY a.waktu_absen DESC, k.nama_kelas, s.nama';

        const [rows] = await global.dbPool.execute(query, params);

        // Enhanced CSV format with UTF-8 BOM for Excel compatibility
        let csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += 'Tanggal,Kelas,Nama Siswa,NIS,Mata Pelajaran,Guru,Waktu Absen,Jam Mulai,Jam Selesai,Jadwal,Status,Keterangan\n';

        rows.forEach(row => {
            csvContent += `"${row.tanggal}","${row.nama_kelas}","${row.nama_siswa}","${row.nis_siswa || ''}","${row.nama_mapel || ''}","${row.nama_guru || ''}","${row.waktu_absen || ''}","${row.jam_mulai || ''}","${row.jam_selesai || ''}","${row.jadwal || ''}","${row.status}","${row.keterangan || ''}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="laporan-kehadiran-siswa-${startDate}-${endDate}.csv"`);
        res.send(csvContent);

        console.log(`✅ Student attendance report downloaded successfully: ${rows.length} records`);
    } catch (error) {
        console.error('❌ Error downloading student attendance report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ===================== NEW: SUMMARY REPORTS (ADMIN) =====================
// Student attendance summary (H/I/S/A/D + percentage) grouped by student
app.get('/api/admin/student-attendance-summary', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }

        let query = `
            SELECT 
                s.id_siswa as siswa_id,
                s.nama,
                s.nis,
                k.nama_kelas,
                COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END), 0) AS H,
                COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
                COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
                COALESCE(SUM(CASE WHEN a.status = 'Alpa' THEN 1 ELSE 0 END), 0) AS A,
                COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS D,
                COALESCE(COUNT(a.id), 0) AS total,
                CASE 
                    WHEN COUNT(a.id) = 0 THEN 0
                    ELSE ROUND((SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id)), 2)
                END AS presentase
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id AND DATE(a.waktu_absen) BETWEEN ? AND ?
            JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE s.status = 'aktif'
        `;
        const params = [startDate, endDate];
        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }
        query += ' GROUP BY s.id_siswa, s.nama, s.nis, k.nama_kelas ORDER BY k.nama_kelas, s.nama';

        const [rows] = await global.dbPool.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting student attendance summary:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download student attendance summary as styled Excel
app.get('/api/admin/download-student-attendance-excel', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;

        // Validasi input
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }

        // Validasi format tanggal
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);

        if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
            return res.status(400).json({ error: 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD' });
        }

        // Validasi rentang tanggal
        if (startDateObj > endDateObj) {
            return res.status(400).json({ error: 'Tanggal mulai tidak boleh lebih besar dari tanggal selesai' });
        }

        // Validasi batas rentang (maksimal 1 tahun)
        const daysDiff = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24));
        if (daysDiff > 366) {
            return res.status(400).json({ error: 'Rentang tanggal tidak boleh lebih dari 366 hari' });
        }

        console.log(`📊 Generating student attendance excel for period: ${startDate} to ${endDate}, class: ${kelas_id || 'all'}`);

        let query = `
            SELECT 
                s.nama,
                s.nis,
                k.nama_kelas,
                COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END), 0) AS H,
                COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
                COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
                COALESCE(SUM(CASE WHEN a.status = 'Alpa' THEN 1 ELSE 0 END), 0) AS A,
                COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS D,
                COALESCE(COUNT(a.id), 0) AS total,
                CASE 
                    WHEN COUNT(a.id) = 0 THEN 0
                    ELSE ROUND((SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id)), 2)
                END AS presentase
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id AND DATE(a.waktu_absen) BETWEEN ? AND ?
            JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE s.status = 'aktif'
        `;

        const params = [startDate, endDate];
        if (kelas_id && kelas_id !== '' && kelas_id !== 'all') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }

        query += ' GROUP BY s.id_siswa, s.nama, s.nis, k.nama_kelas ORDER BY k.nama_kelas, s.nama';

        const [rows] = await global.dbPool.execute(query, params);

        console.log(`📊 Found ${rows.length} students for export`);

        // Build schema-aligned rows
        const exportRows = rows.map((r, idx) => ({
            no: idx + 1,
            nama: r.nama || '',
            nis: r.nis || '',
            kelas: r.nama_kelas || '',
            hadir: Number(r.H) || 0,
            izin: Number(r.I) || 0,
            sakit: Number(r.S) || 0,
            alpa: Number(r.A) || 0,
            dispen: Number(r.D) || 0,
            presentase: Number(r.presentase) / 100 || 0 // Convert to decimal for percentage format
        }));

        const { buildExcel } = await import('./backend/export/excelBuilder.js');
        const studentSchemaModule = await import('./backend/export/schemas/student-summary.js');
        const studentSchema = studentSchemaModule.default;

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.LAPORAN_SISWA });

        const reportPeriod = `${startDate} - ${endDate}`;
        const workbook = await buildExcel({
            title: studentSchema.title,
            subtitle: studentSchema.subtitle,
            reportPeriod,
            showLetterhead: letterhead.enabled,
            letterhead: letterhead,
            columns: studentSchema.columns,
            rows: exportRows
        });

        // Set headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=ringkasan-kehadiran-siswa-${startDate}-${endDate}.xlsx`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        await workbook.xlsx.write(res);
        res.end();

        console.log(`✅ Student attendance excel generated successfully for ${exportRows.length} students`);
    } catch (error) {
        console.error('❌ Error downloading student attendance summary excel:', error);
        console.error('Stack trace:', error.stack);

        if (!res.headersSent) {
            res.status(500).json({
                error: 'Gagal membuat file Excel',
                details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
});

// Teacher attendance summary grouped by teacher (H/I/S/A)
app.get('/api/admin/teacher-attendance-summary', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }
        let query = `
            SELECT 
                g.id_guru as guru_id,
                g.nama,
                g.nip,
                COALESCE(SUM(CASE WHEN ag.status = 'Hadir' THEN 1 ELSE 0 END), 0) AS H,
                COALESCE(SUM(CASE WHEN ag.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
                COALESCE(SUM(CASE WHEN ag.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
                COALESCE(SUM(CASE WHEN ag.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) AS A,
                COALESCE(COUNT(ag.id_absensi), 0) AS total,
                CASE 
                    WHEN COUNT(ag.id_absensi) = 0 THEN 0
                    ELSE ROUND((SUM(CASE WHEN ag.status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(ag.id_absensi)), 2)
                END AS presentase
            FROM guru g
            LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id AND ag.tanggal BETWEEN ? AND ?
            WHERE g.status = 'aktif'
        `;
        const params = [startDate, endDate];
        query += ' GROUP BY g.id_guru, g.nama, g.nip ORDER BY g.nama';
        const [rows] = await global.dbPool.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting teacher attendance summary:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Test endpoint without authentication for debugging
app.get('/api/test/download-teacher-attendance-excel', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Validasi input
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }

        // Validasi format tanggal
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);

        if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
            return res.status(400).json({ error: 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD' });
        }

        // Validasi rentang tanggal
        if (startDateObj > endDateObj) {
            return res.status(400).json({ error: 'Tanggal mulai tidak boleh lebih besar dari tanggal selesai' });
        }

        // Validasi batas rentang (maksimal 1 tahun)
        const daysDiff = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24));
        if (daysDiff > 366) {
            return res.status(400).json({ error: 'Rentang tanggal tidak boleh lebih dari 366 hari' });
        }

        console.log(`📊 Generating teacher attendance excel for period: ${startDate} to ${endDate}`);

        let query = `
            SELECT 
                g.nama,
                g.nip,
                COALESCE(SUM(CASE WHEN ag.status = 'Hadir' THEN 1 ELSE 0 END), 0) AS H,
                COALESCE(SUM(CASE WHEN ag.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
                COALESCE(SUM(CASE WHEN ag.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
                COALESCE(SUM(CASE WHEN ag.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) AS A,
                COALESCE(COUNT(ag.id_absensi), 0) AS total,
                CASE 
                    WHEN COUNT(ag.id_absensi) = 0 THEN 0
                    ELSE ROUND((SUM(CASE WHEN ag.status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(ag.id_absensi)), 2)
                END AS presentase
            FROM guru g
            LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id AND ag.tanggal BETWEEN ? AND ?
            WHERE g.status = 'aktif'
            GROUP BY g.id_guru, g.nama, g.nip 
            ORDER BY g.nama
        `;

        const params = [startDate, endDate];
        const [rows] = await global.dbPool.execute(query, params);

        console.log(`📊 Found ${rows.length} teachers for export`);

        // Schema-aligned mapping
        const exportRows = rows.map((r, idx) => ({
            no: idx + 1,
            nama: r.nama || '',
            nip: r.nip || '',
            hadir: Number(r.H) || 0,
            izin: Number(r.I) || 0,
            sakit: Number(r.S) || 0,
            alpa: Number(r.A) || 0,
            presentase: Number(r.presentase) / 100 || 0 // Convert to decimal for percentage format
        }));

        // Import modules using dynamic import for ES modules compatibility
        const { buildExcel } = await import('./backend/export/excelBuilder.js');
        const teacherSchemaModule = await import('./backend/export/schemas/teacher-summary.js');
        const teacherSchema = teacherSchemaModule.default;

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.LAPORAN_GURU });

        const reportPeriod = `${formatWIBDate(new Date(startDate))} - ${formatWIBDate(new Date(endDate))}`;
        const workbook = await buildExcel({
            title: teacherSchema.title,
            subtitle: teacherSchema.subtitle,
            reportPeriod,
            showLetterhead: letterhead.enabled,
            letterhead: letterhead,
            columns: teacherSchema.columns,
            rows: exportRows
        });

        // Set headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=ringkasan-kehadiran-guru-${startDate}-${endDate}.xlsx`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        await workbook.xlsx.write(res);
        res.end();

        console.log(`✅ Teacher attendance excel generated successfully for ${exportRows.length} teachers`);
    } catch (error) {
        console.error('❌ Error downloading teacher attendance summary excel:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

app.get('/api/admin/download-teacher-attendance-excel', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Validasi input
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }

        // Validasi format tanggal
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);

        if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
            return res.status(400).json({ error: 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD' });
        }

        // Validasi rentang tanggal
        if (startDateObj > endDateObj) {
            return res.status(400).json({ error: 'Tanggal mulai tidak boleh lebih besar dari tanggal selesai' });
        }

        // Validasi batas rentang (maksimal 1 tahun)
        const daysDiff = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24));
        if (daysDiff > 366) {
            return res.status(400).json({ error: 'Rentang tanggal tidak boleh lebih dari 366 hari' });
        }

        console.log(`📊 Generating teacher attendance excel for period: ${startDate} to ${endDate}`);

        let query = `
            SELECT 
                g.nama,
                g.nip,
                COALESCE(SUM(CASE WHEN ag.status = 'Hadir' THEN 1 ELSE 0 END), 0) AS H,
                COALESCE(SUM(CASE WHEN ag.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
                COALESCE(SUM(CASE WHEN ag.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
                COALESCE(SUM(CASE WHEN ag.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) AS A,
                COALESCE(COUNT(ag.id_absensi), 0) AS total,
                CASE 
                    WHEN COUNT(ag.id_absensi) = 0 THEN 0
                    ELSE ROUND((SUM(CASE WHEN ag.status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(ag.id_absensi)), 2)
                END AS presentase
            FROM guru g
            LEFT JOIN absensi_guru ag ON g.id_guru = ag.guru_id AND ag.tanggal BETWEEN ? AND ?
            WHERE g.status = 'aktif'
            GROUP BY g.id_guru, g.nama, g.nip 
            ORDER BY g.nama
        `;

        const params = [startDate, endDate];
        const [rows] = await global.dbPool.execute(query, params);

        console.log(`📊 Found ${rows.length} teachers for export`);

        // Schema-aligned mapping
        const exportRows = rows.map((r, idx) => ({
            no: idx + 1,
            nama: r.nama || '',
            nip: r.nip || '',
            hadir: Number(r.H) || 0,
            izin: Number(r.I) || 0,
            sakit: Number(r.S) || 0,
            alpa: Number(r.A) || 0,
            presentase: Number(r.presentase) / 100 || 0 // Convert to decimal for percentage format
        }));

        // Import modules using dynamic import for ES modules compatibility
        const { buildExcel } = await import('./backend/export/excelBuilder.js');
        const teacherSchemaModule = await import('./backend/export/schemas/teacher-summary.js');
        const teacherSchema = teacherSchemaModule.default;

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.LAPORAN_GURU });

        const reportPeriod = `${startDate} - ${endDate}`;
        const workbook = await buildExcel({
            title: teacherSchema.title,
            subtitle: teacherSchema.subtitle,
            reportPeriod,
            showLetterhead: letterhead.enabled,
            letterhead: letterhead,
            columns: teacherSchema.columns,
            rows: exportRows
        });

        // Set headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=ringkasan-kehadiran-guru-${startDate}-${endDate}.xlsx`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        await workbook.xlsx.write(res);
        res.end();

        console.log(`✅ Teacher attendance excel generated successfully for ${exportRows.length} teachers`);
    } catch (error) {
        console.error('❌ Error downloading teacher attendance summary excel:', error);
        console.error('Stack trace:', error.stack);

        if (!res.headersSent) {
            res.status(500).json({
                error: 'Gagal membuat file Excel',
                details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
});

// ===================== NEW: SUMMARY REPORTS (GURU) =====================
// Classes taught by the logged-in teacher
app.get('/api/guru/classes', authenticateToken, requireRole(['guru']), async (req, res) => {
    try {
        const guruId = req.user.guru_id;
        const [rows] = await global.dbPool.execute(
            `SELECT DISTINCT k.id_kelas as id, k.nama_kelas 
             FROM jadwal j JOIN kelas k ON j.kelas_id = k.id_kelas 
             WHERE j.guru_id = ? AND j.status = 'aktif' ORDER BY k.nama_kelas`,
            [guruId]
        );
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting teacher classes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/guru/attendance-summary', authenticateToken, requireRole(['guru']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        const guruId = req.user.guru_id;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }
        let query = `
            SELECT 
                s.id_siswa as siswa_id,
                s.nama,
                s.nis,
                k.nama_kelas,
                COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END), 0) AS H,
                COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
                COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
                COALESCE(SUM(CASE WHEN a.status = 'Alpa' THEN 1 ELSE 0 END), 0) AS A,
                COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS D,
                COALESCE(COUNT(a.id), 0) AS total,
                CASE 
                    WHEN COUNT(a.id) = 0 THEN 0
                    ELSE ROUND((SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id)), 2)
                END AS presentase
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id AND DATE(a.waktu_absen) BETWEEN ? AND ?
            JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN jadwal j ON a.jadwal_id = j.id_jadwal
            WHERE s.status = 'aktif' AND (j.guru_id = ? OR j.guru_id IS NULL)
        `;
        const params = [startDate, endDate, guruId];
        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }
        query += ' GROUP BY s.id_siswa, s.nama, s.nis, k.nama_kelas ORDER BY k.nama_kelas, s.nama';
        const [rows] = await global.dbPool.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting teacher attendance summary (guru):', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get jadwal pertemuan dinamis untuk guru berdasarkan kelas dan periode
app.get('/api/guru/jadwal-pertemuan', authenticateToken, requireRole(['guru']), async (req, res) => {
    try {
        const { kelas_id, startDate, endDate } = req.query;
        const guruId = req.user.guru_id;

        if (!kelas_id) {
            return res.status(400).json({ error: 'Kelas ID wajib diisi' });
        }

        // Validasi tanggal
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }

        // Validasi rentang maksimal 62 hari
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 62) {
            return res.status(400).json({ error: 'Rentang tanggal maksimal 62 hari' });
        }

        // Get jadwal pertemuan guru untuk kelas tersebut
        const [jadwalData] = await global.dbPool.execute(`
            SELECT 
                j.hari, 
                j.jam_ke, 
                j.jam_mulai, 
                j.jam_selesai,
                COALESCE(mp.nama_mapel, j.keterangan_khusus) as nama_mapel,
                mp.kode_mapel,
                k.nama_kelas,
                rk.kode_ruang,
                rk.nama_ruang
            FROM jadwal j
            LEFT JOIN mapel mp ON j.mapel_id = mp.id_mapel
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN ruang_kelas rk ON j.ruang_id = rk.id_ruang
            WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif'
            ORDER BY 
                CASE j.hari 
                    WHEN 'Senin' THEN 1
                    WHEN 'Selasa' THEN 2
                    WHEN 'Rabu' THEN 3
                    WHEN 'Kamis' THEN 4
                    WHEN 'Jumat' THEN 5
                    WHEN 'Sabtu' THEN 6
                    WHEN 'Minggu' THEN 7
                END, j.jam_ke
        `, [guruId, kelas_id]);

        // Generate actual dates based on hari within the date range
        const pertemuanDates = [];
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);

        for (let d = new Date(startDateObj); d <= endDateObj; d.setDate(d.getDate() + 1)) {
            const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()];
            const hasSchedule = jadwalData.some(j => j.hari === dayName);
            if (hasSchedule) {
                const daySchedules = jadwalData.filter(j => j.hari === dayName);
                pertemuanDates.push({
                    tanggal: d.toISOString().split('T')[0],
                    hari: dayName,
                    jadwal: daySchedules.map(schedule => ({
                        jam_ke: schedule.jam_ke,
                        jam_mulai: schedule.jam_mulai,
                        jam_selesai: schedule.jam_selesai,
                        nama_mapel: schedule.nama_mapel,
                        kode_mapel: schedule.kode_mapel,
                        ruang: schedule.kode_ruang ? `${schedule.kode_ruang} - ${schedule.nama_ruang}` : '-'
                    }))
                });
            }
        }

        res.json({
            success: true,
            data: {
                pertemuan_dates: pertemuanDates,
                total_pertemuan: pertemuanDates.length,
                periode: {
                    startDate,
                    endDate,
                    total_days: diffDays
                },
                jadwal_info: jadwalData.length > 0 ? {
                    nama_kelas: jadwalData[0].nama_kelas,
                    mata_pelajaran: jadwalData.map(j => j.nama_mapel).filter((v, i, a) => a.indexOf(v) === i)
                } : null
            }
        });

    } catch (error) {
        console.error('❌ Error getting jadwal pertemuan:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get laporan kehadiran siswa berdasarkan jadwal pertemuan guru
app.get('/api/guru/laporan-kehadiran-siswa', authenticateToken, requireRole(['guru']), async (req, res) => {
    try {
        const { kelas_id, startDate, endDate } = req.query;
        const guruId = req.user.guru_id;

        if (!kelas_id) {
            return res.status(400).json({ error: 'Kelas ID wajib diisi' });
        }

        // Validasi tanggal
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }

        // Validasi rentang maksimal 62 hari
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 62) {
            return res.status(400).json({ error: 'Rentang tanggal maksimal 62 hari' });
        }

        // Get info mata pelajaran dan guru yang sedang login - langsung dari tabel guru
        const [mapelInfo] = await global.dbPool.execute(`
            SELECT DISTINCT 
                g.mata_pelajaran as nama_mapel, 
                g.nama as nama_guru,
                g.nip
            FROM guru g
            WHERE g.id_guru = ? AND g.status = 'aktif'
            LIMIT 1
        `, [guruId]);

        // Get semua jadwal pertemuan guru untuk kelas tersebut dalam rentang tanggal
        // Generate actual dates based on hari (day of week) within the date range
        const [jadwalData] = await global.dbPool.execute(`
            SELECT j.hari, j.jam_ke, j.jam_mulai, j.jam_selesai
            FROM jadwal j
            WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif'
        `, [guruId, kelas_id]);

        // Generate actual dates based on hari within the date range
        const pertemuanDates = [];
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);

        for (let d = new Date(startDateObj); d <= endDateObj; d.setDate(d.getDate() + 1)) {
            const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()];
            const hasSchedule = jadwalData.some(j => j.hari === dayName);
            if (hasSchedule) {
                pertemuanDates.push(d.toISOString().split('T')[0]);
            }
        }

        // Get actual attendance dates from database to ensure we show all relevant dates
        const [actualAttendanceDates] = await global.dbPool.execute(`
            SELECT DISTINCT DATE(a.tanggal) as tanggal
            FROM absensi_siswa a
            WHERE a.jadwal_id IN (
                SELECT j.id_jadwal 
                FROM jadwal j 
                WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif'
            )
            AND DATE(a.tanggal) BETWEEN ? AND ?
            ORDER BY DATE(a.tanggal)
        `, [guruId, kelas_id, startDate, endDate]);

        // Combine scheduled dates with actual attendance dates
        const allDates = new Set();
        pertemuanDates.forEach(date => allDates.add(date));
        actualAttendanceDates.forEach(record => {
            if (record.tanggal) {
                allDates.add(record.tanggal.toISOString().split('T')[0]);
            }
        });

        // Convert back to array and sort
        const finalPertemuanDates = Array.from(allDates).sort();

        // Get data siswa dan kehadiran mereka dalam rentang tanggal
        // Hanya hitung kehadiran yang sesuai dengan jadwal guru tersebut
        const [siswaData] = await global.dbPool.execute(`
            SELECT 
                s.id_siswa,
                s.nama,
                s.nis,
                s.jenis_kelamin,
                COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END), 0) AS total_hadir,
                COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) AS total_izin,
                COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS total_sakit,
                COALESCE(SUM(CASE WHEN a.status = 'Alpa' OR a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) AS total_alpa,
                COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS total_dispen,
                ? AS total_pertemuan,
                CASE 
                    WHEN ? = 0 THEN '0%'
                    ELSE CONCAT(ROUND((SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / ?), 1), '%')
                END AS persentase_kehadiran
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND DATE(a.tanggal) BETWEEN ? AND ?
                AND a.jadwal_id IN (
                    SELECT j.id_jadwal 
                    FROM jadwal j 
                    WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif'
                )
            WHERE s.kelas_id = ? AND s.status = 'aktif'
            GROUP BY s.id_siswa, s.nama, s.nis, s.jenis_kelamin
            ORDER BY s.nama
        `, [finalPertemuanDates.length, finalPertemuanDates.length, finalPertemuanDates.length, startDate, endDate, guruId, kelas_id, kelas_id]);

        // Get detail kehadiran per tanggal untuk setiap siswa dalam rentang
        // Hanya ambil data kehadiran yang sesuai dengan jadwal guru tersebut
        const [detailKehadiran] = await global.dbPool.execute(`
            SELECT 
                s.id_siswa as siswa_id,
                DATE(a.tanggal) as tanggal,
                a.status as status
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND DATE(a.tanggal) BETWEEN ? AND ?
                AND a.jadwal_id IN (
                    SELECT j.id_jadwal 
                    FROM jadwal j 
                    WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif'
                )
            WHERE s.kelas_id = ? AND s.status = 'aktif'
        `, [startDate, endDate, guruId, kelas_id, kelas_id]);

        // Organize attendance data by student and date
        const attendanceByStudent = {};
        detailKehadiran.forEach(record => {
            if (!attendanceByStudent[record.siswa_id]) {
                attendanceByStudent[record.siswa_id] = {};
            }
            if (record.tanggal && record.status) {
                // Convert date to ISO string format for consistency
                const dateKey = record.tanggal.toISOString().split('T')[0];
                attendanceByStudent[record.siswa_id][dateKey] = record.status;
            }
        });

        // Combine data
        const reportData = siswaData.map(student => ({
            ...student,
            pertemuan_dates: finalPertemuanDates,
            attendance_by_date: attendanceByStudent[student.id_siswa] || {}
        }));

        res.json({
            data: reportData,
            mapel_info: mapelInfo[0] || null,
            pertemuan_dates: finalPertemuanDates,
            periode: {
                startDate,
                endDate,
                total_days: diffDays
            }
        });

    } catch (error) {
        console.error('❌ Error getting laporan kehadiran siswa:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download laporan kehadiran siswa Excel
app.get('/api/guru/download-laporan-kehadiran-siswa', authenticateToken, requireRole(['guru']), async (req, res) => {
    try {
        const { kelas_id, startDate, endDate } = req.query;
        const guruId = req.user.guru_id;

        if (!kelas_id) {
            return res.status(400).json({ error: 'Kelas ID wajib diisi' });
        }

        // Validasi tanggal
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }

        // Validasi rentang maksimal 62 hari
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 62) {
            return res.status(400).json({ error: 'Rentang tanggal maksimal 62 hari' });
        }

        // Get the same data as the API above with date filter - langsung dari tabel guru
        const [mapelInfo] = await global.dbPool.execute(`
            SELECT DISTINCT 
                g.mata_pelajaran as nama_mapel, 
                g.nama as nama_guru,
                g.nip
            FROM guru g
            WHERE g.id_guru = ? AND g.status = 'aktif'
            LIMIT 1
        `, [guruId]);

        // Generate actual dates based on hari within the date range (same logic as preview API)
        const [jadwalData2] = await global.dbPool.execute(`
            SELECT j.hari, j.jam_ke, j.jam_mulai, j.jam_selesai
            FROM jadwal j
            WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif'
        `, [guruId, kelas_id]);

        const pertemuanDates2 = [];
        const startDateObj2 = new Date(startDate);
        const endDateObj2 = new Date(endDate);

        for (let d = new Date(startDateObj2); d <= endDateObj2; d.setDate(d.getDate() + 1)) {
            const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()];
            const hasSchedule = jadwalData2.some(j => j.hari === dayName);
            if (hasSchedule) {
                pertemuanDates2.push(d.toISOString().split('T')[0]);
            }
        }

        // Get actual attendance dates from database to ensure we show all relevant dates
        const [actualAttendanceDates2] = await global.dbPool.execute(`
            SELECT DISTINCT DATE(a.tanggal) as tanggal
            FROM absensi_siswa a
            WHERE a.jadwal_id IN (
                SELECT j.id_jadwal 
                FROM jadwal j 
                WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif'
            )
            AND DATE(a.tanggal) BETWEEN ? AND ?
            ORDER BY DATE(a.tanggal)
        `, [guruId, kelas_id, startDate, endDate]);

        // Combine scheduled dates with actual attendance dates
        const allDates2 = new Set();
        pertemuanDates2.forEach(date => allDates2.add(date));
        actualAttendanceDates2.forEach(record => {
            if (record.tanggal) {
                allDates2.add(record.tanggal.toISOString().split('T')[0]);
            }
        });

        // Convert back to array and sort
        const finalPertemuanDates2 = Array.from(allDates2).sort();

        const [siswaData] = await global.dbPool.execute(`
            SELECT 
                s.id_siswa,
                s.nama,
                s.nis,
                s.jenis_kelamin,
                COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END), 0) AS total_hadir,
                COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) AS total_izin,
                COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS total_sakit,
                COALESCE(SUM(CASE WHEN a.status = 'Alpa' OR a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) AS total_alpa,
                COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS total_dispen,
                ? AS total_pertemuan,
                CASE 
                    WHEN ? = 0 THEN '0%'
                    ELSE CONCAT(ROUND((SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / ?), 1), '%')
                END AS persentase_kehadiran
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND DATE(a.tanggal) BETWEEN ? AND ?
                AND a.jadwal_id IN (
                    SELECT j.id_jadwal 
                    FROM jadwal j 
                    WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif'
                )
            WHERE s.kelas_id = ? AND s.status = 'aktif'
            GROUP BY s.id_siswa, s.nama, s.nis, s.jenis_kelamin
            ORDER BY s.nama
        `, [finalPertemuanDates2.length, finalPertemuanDates2.length, finalPertemuanDates2.length, startDate, endDate, guruId, kelas_id, kelas_id]);

        const [detailKehadiran] = await global.dbPool.execute(`
            SELECT 
                s.id_siswa as siswa_id,
                DATE(a.tanggal) as tanggal,
                a.status as status
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND DATE(a.tanggal) BETWEEN ? AND ?
                AND a.jadwal_id IN (
                    SELECT j.id_jadwal 
                    FROM jadwal j 
                    WHERE j.guru_id = ? AND j.kelas_id = ? AND j.status = 'aktif'
                )
            WHERE s.kelas_id = ? AND s.status = 'aktif'
        `, [startDate, endDate, guruId, kelas_id, kelas_id]);

        const attendanceByStudent = {};
        detailKehadiran.forEach(record => {
            if (!attendanceByStudent[record.siswa_id]) {
                attendanceByStudent[record.siswa_id] = {};
            }
            if (record.tanggal && record.status) {
                // Convert date to ISO string format for consistency
                const dateKey = record.tanggal.toISOString().split('T')[0];
                attendanceByStudent[record.siswa_id][dateKey] = record.status;
            }
        });

        // Import required modules for letterhead
        const { getLetterhead } = await import('./backend/utils/letterheadService.js');
        const { REPORT_KEYS } = await import('./backend/utils/letterheadService.js');

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.KEHADIRAN_SISWA });

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Laporan Kehadiran Siswa');

        let currentRow = 1;

        // Dynamic letterhead
        if (letterhead.enabled && letterhead.lines && letterhead.lines.length > 0) {
            const alignment = letterhead.alignment || 'center';

            // Add logo kiri dan kanan jika tersedia
            if (letterhead.logoLeftUrl || letterhead.logoRightUrl) {
                const logoRow = sheet.getRow(currentRow);

                // Logo kiri
                if (letterhead.logoLeftUrl) {
                    try {
                        // Convert base64 to buffer if needed
                        let logoBuffer;
                        if (letterhead.logoLeftUrl.startsWith('data:image/')) {
                            // Handle base64 data URL
                            const base64Data = letterhead.logoLeftUrl.split(',')[1];
                            logoBuffer = Buffer.from(base64Data, 'base64');
                        } else {
                            // Handle file path
                            const logoPath = path.join(process.cwd(), 'public', letterhead.logoLeftUrl);
                            if (fsSync.existsSync(logoPath)) {
                                logoBuffer = fsSync.readFileSync(logoPath);
                            }
                        }

                        if (logoBuffer) {
                            const logoId = workbook.addImage({
                                buffer: logoBuffer,
                                extension: 'png'
                            });
                            sheet.addImage(logoId, {
                                tl: { col: 0, row: currentRow - 1 },
                                br: { col: 2, row: currentRow + 2 }
                            });
                        }
                    } catch (error) {
                        console.warn('⚠️ Could not add left logo to Excel:', error.message);
                        // Fallback to text
                        logoRow.getCell(1).value = '[LOGO KIRI]';
                        logoRow.getCell(1).font = { italic: true, size: 10 };
                        logoRow.getCell(1).alignment = { horizontal: 'left' };
                    }
                }

                // Logo kanan
                if (letterhead.logoRightUrl) {
                    try {
                        // Convert base64 to buffer if needed
                        let logoBuffer;
                        if (letterhead.logoRightUrl.startsWith('data:image/')) {
                            // Handle base64 data URL
                            const base64Data = letterhead.logoRightUrl.split(',')[1];
                            logoBuffer = Buffer.from(base64Data, 'base64');
                        } else {
                            // Handle file path
                            const logoPath = path.join(process.cwd(), 'public', letterhead.logoRightUrl);
                            if (fsSync.existsSync(logoPath)) {
                                logoBuffer = fsSync.readFileSync(logoPath);
                            }
                        }

                        if (logoBuffer) {
                            const logoId = workbook.addImage({
                                buffer: logoBuffer,
                                extension: 'png'
                            });
                            const rightCol = Math.max(9, 3); // Adjust based on your table width
                            sheet.addImage(logoId, {
                                tl: { col: rightCol, row: currentRow - 1 },
                                br: { col: rightCol + 2, row: currentRow + 2 }
                            });
                        }
                    } catch (error) {
                        console.warn('⚠️ Could not add right logo to Excel:', error.message);
                        // Fallback to text
                        const rightCell = Math.max(11, 3);
                        logoRow.getCell(rightCell).value = '[LOGO KANAN]';
                        logoRow.getCell(rightCell).font = { italic: true, size: 10 };
                        logoRow.getCell(rightCell).alignment = { horizontal: 'right' };
                    }
                }

                currentRow += 4; // Space for logo
            }

            letterhead.lines.forEach((line, index) => {
                const lineRow = sheet.getRow(currentRow);
                // Handle both old format (string) and new format (object)
                const text = typeof line === 'string' ? line : line.text;
                const fontWeight = typeof line === 'object' ? line.fontWeight : (index === 0 ? 'bold' : 'normal');

                lineRow.getCell(1).value = text;

                if (fontWeight === 'bold') {
                    lineRow.getCell(1).font = { bold: true, size: 16 };
                } else {
                    lineRow.getCell(1).font = { size: 12 };
                }

                lineRow.getCell(1).alignment = { horizontal: alignment };
                sheet.mergeCells(currentRow, 1, currentRow, 11);
                currentRow++;
            });

            currentRow++; // Separator
        } else {
            // Fallback to hardcoded header
            sheet.mergeCells('A1:K1');
            sheet.getCell('A1').value = 'SMK NEGERI 13 BANDUNG';
            sheet.getCell('A1').font = { bold: true, size: 16 };
            sheet.getCell('A1').alignment = { horizontal: 'center' };

            sheet.mergeCells('A2:K2');
            sheet.getCell('A2').value = 'Jl. Soekarno Hatta No. 123, Bandung';
            sheet.getCell('A2').alignment = { horizontal: 'center' };

            sheet.mergeCells('A3:K3');
            sheet.getCell('A3').value = 'Telp: (022) 1234567 | Email: info@smkn13bandung.sch.id';
            sheet.getCell('A3').alignment = { horizontal: 'center' };
            currentRow = 5;
        }

        // Add report title
        sheet.mergeCells(`A${currentRow}:K${currentRow}`);
        sheet.getCell(`A${currentRow}`).value = 'LAPORAN KEHADIRAN SISWA';
        sheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
        sheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
        currentRow++;

        // Add subject and teacher info
        if (mapelInfo[0]) {
            sheet.mergeCells(`A${currentRow}:K${currentRow}`);
            sheet.getCell(`A${currentRow}`).value = `Mata Pelajaran: ${mapelInfo[0].nama_mapel}`;
            sheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
            currentRow++;

            sheet.mergeCells(`A${currentRow}:K${currentRow}`);
            sheet.getCell(`A${currentRow}`).value = `Guru: ${mapelInfo[0].nama_guru}`;
            sheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
            currentRow++;
        }

        // Create table headers
        const headerRow = currentRow;
        const headers = ['No', 'Nama', 'NIS', 'L/P'];

        // Add date columns
        finalPertemuanDates2.forEach(date => {
            headers.push(new Date(date).getDate().toString());
        });

        // Add summary columns
        headers.push('H', 'I', 'Z', 'D', '%');

        headers.forEach((header, index) => {
            const cell = sheet.getCell(headerRow, index + 1);
            cell.value = header;
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // Add student data
        siswaData.forEach((student, index) => {
            const row = headerRow + 1 + index;
            const rowData = [
                index + 1,
                student.nama,
                student.nis,
                student.jenis_kelamin
            ];

            // Add attendance for each date
            finalPertemuanDates2.forEach(date => {
                const attendance = attendanceByStudent[student.id_siswa]?.[date];
                const statusCode = attendance === 'Hadir' ? 'H' :
                    attendance === 'Izin' ? 'I' :
                        attendance === 'Sakit' ? 'S' :
                            attendance === 'Alpa' ? 'A' :
                                attendance === 'Dispen' ? 'D' : '-';
                rowData.push(statusCode);
            });

            // Add summary data
            rowData.push(
                student.total_hadir,
                student.total_izin,
                student.total_sakit,
                student.total_alpa,
                student.persentase_kehadiran
            );

            rowData.forEach((value, colIndex) => {
                const cell = sheet.getCell(row, colIndex + 1);
                cell.value = value;
                cell.alignment = { horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Set column widths
        sheet.getColumn(1).width = 5;  // No
        sheet.getColumn(2).width = 25; // Nama
        sheet.getColumn(3).width = 12; // NIS
        sheet.getColumn(4).width = 5;  // L/P

        // Set width for date columns
        finalPertemuanDates2.forEach((_, index) => {
            sheet.getColumn(5 + index).width = 5;
        });

        // Set width for summary columns
        const summaryStartCol = 5 + finalPertemuanDates2.length;
        for (let i = 0; i < 5; i++) {
            sheet.getColumn(summaryStartCol + i).width = 8;
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="laporan-kehadiran-siswa-${startDate}-${endDate}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('❌ Error downloading laporan kehadiran siswa excel:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/guru/download-attendance-excel', authenticateToken, requireRole(['guru']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        const guruId = req.user.guru_id;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
        }
        let query = `
            SELECT 
                s.nama,
                s.nis,
                k.nama_kelas,
                COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END), 0) AS H,
                COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) AS I,
                COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS S,
                COALESCE(SUM(CASE WHEN a.status = 'Alpa' THEN 1 ELSE 0 END), 0) AS A,
                COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) AS D,
                COALESCE(COUNT(a.id), 0) AS total,
                CASE 
                    WHEN COUNT(a.id) = 0 THEN 0
                    ELSE ROUND((SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id)), 2)
                END AS presentase
            FROM siswa s
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id AND DATE(a.waktu_absen) BETWEEN ? AND ?
            JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN jadwal j ON a.jadwal_id = j.id_jadwal
            WHERE s.status = 'aktif' AND (j.guru_id = ? OR j.guru_id IS NULL)
        `;
        const params = [startDate, endDate, guruId];
        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }
        query += ' GROUP BY s.id_siswa, s.nama, s.nis, k.nama_kelas ORDER BY k.nama_kelas, s.nama';
        const [rows] = await global.dbPool.execute(query, params);

        // Import modules using dynamic import for ES modules compatibility
        const { buildExcel } = await import('./backend/export/excelBuilder.js');
        const { getLetterhead } = await import('./backend/utils/letterheadService.js');
        const { REPORT_KEYS } = await import('./backend/utils/letterheadService.js');

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.KEHADIRAN_SISWA });

        // Prepare data for Excel
        const exportRows = rows.map((r, idx) => ({
            no: idx + 1,
            nama: r.nama,
            nis: r.nis || '',
            kelas: r.nama_kelas,
            H: r.H || 0,
            I: r.I || 0,
            S: r.S || 0,
            A: r.A || 0,
            D: r.D || 0,
            presentase: Number(r.presentase) / 100 || 0 // Convert to decimal for percentage format
        }));

        const columns = [
            { key: 'no', label: 'No', width: 5, align: 'center' },
            { key: 'nama', label: 'Nama', width: 28, align: 'left' },
            { key: 'nis', label: 'NIS', width: 14, align: 'center' },
            { key: 'kelas', label: 'Kelas', width: 14, align: 'center' },
            { key: 'H', label: 'H', width: 6, align: 'center' },
            { key: 'I', label: 'I', width: 6, align: 'center' },
            { key: 'S', label: 'S', width: 6, align: 'center' },
            { key: 'A', label: 'A', width: 6, align: 'center' },
            { key: 'D', label: 'D', width: 6, align: 'center' },
            { key: 'presentase', label: 'Presentase', width: 14, align: 'center', format: 'percentage' }
        ];

        const reportPeriod = `${formatWIBDate(new Date(startDate))} - ${formatWIBDate(new Date(endDate))}`;
        const workbook = await buildExcel({
            title: 'Laporan Kehadiran Siswa (Guru)',
            subtitle: 'Ringkasan Kehadiran Siswa per Kelas',
            reportPeriod,
            showLetterhead: letterhead.enabled,
            letterhead: letterhead,
            columns: columns,
            rows: exportRows
        });

        // Set headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=laporan-guru-ringkas-${startDate}-${endDate}.xlsx`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        await workbook.xlsx.write(res);
        res.end();

        console.log(`✅ Guru attendance excel generated successfully for ${exportRows.length} students`);
    } catch (error) {
        console.error('❌ Error downloading guru attendance excel:', error);
        console.error('Stack trace:', error.stack);

        if (!res.headersSent) {
            res.status(500).json({
                error: 'Gagal membuat file Excel',
                details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
});
// ================================================
// BANDING ABSEN ENDPOINTS  
// ================================================

// Get banding absen history report
app.get('/api/admin/banding-absen-report', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, status } = req.query;
        console.log('📊 Getting banding absen report:', { startDate, endDate, kelas_id, status });

        let query = `
            SELECT 
                pba.id_banding,
                DATE_FORMAT(pba.tanggal_pengajuan, '%Y-%m-%d') as tanggal_pengajuan,
                DATE_FORMAT(pba.tanggal_absen, '%Y-%m-%d') as tanggal_absen,
                s.nama as nama_pengaju,
                COALESCE(k.nama_kelas, '-') as nama_kelas,
                COALESCE(m.nama_mapel, 'Umum') as nama_mapel,
                COALESCE(g.nama, 'Belum Ditentukan') as nama_guru,
                COALESCE(j.jam_mulai, '00:00') as jam_mulai,
                COALESCE(j.jam_selesai, '00:00') as jam_selesai,
                pba.status_asli,
                pba.status_diajukan,
                pba.alasan_banding,
                pba.status_banding,
                COALESCE(pba.catatan_guru, '-') as catatan_guru,
                COALESCE(DATE_FORMAT(pba.tanggal_keputusan, '%Y-%m-%d %H:%i'), '-') as tanggal_keputusan,
                COALESCE(guru_proses.nama, 'Belum Diproses') as diproses_oleh,
                pba.jenis_banding
            FROM pengajuan_banding_absen pba
            JOIN siswa s ON pba.siswa_id = s.id_siswa
            LEFT JOIN kelas k ON s.kelas_id = k.id_kelas OR pba.kelas_id = k.id_kelas
            LEFT JOIN jadwal j ON pba.jadwal_id = j.id_jadwal
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru guru_proses ON pba.diproses_oleh = guru_proses.id_guru
            WHERE 1=1
        `;

        const params = [];

        if (startDate && endDate) {
            query += ' AND DATE(pba.tanggal_pengajuan) BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }

        if (status && status !== '') {
            query += ' AND pba.status_banding = ?';
            params.push(status);
        }

        query += ' ORDER BY pba.tanggal_pengajuan DESC';

        const [rows] = await global.dbPool.execute(query, params);
        console.log(`✅ Banding absen report retrieved: ${rows.length} records`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting banding absen report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download banding absen report as CSV
app.get('/api/admin/download-banding-absen', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, status } = req.query;
        console.log('📊 Downloading banding absen report:', { startDate, endDate, kelas_id, status });

        let query = `
            SELECT 
                DATE_FORMAT(pba.tanggal_pengajuan, '%d/%m/%Y') as tanggal_pengajuan,
                DATE_FORMAT(pba.tanggal_absen, '%d/%m/%Y') as tanggal_absen,
                s.nama as nama_pengaju,
                COALESCE(k.nama_kelas, '-') as nama_kelas,
                COALESCE(m.nama_mapel, 'Umum') as nama_mapel,
                COALESCE(g.nama, 'Belum Ditentukan') as nama_guru,
                COALESCE(CONCAT(j.jam_mulai, ' - ', j.jam_selesai), '-') as jadwal,
                pba.status_asli,
                pba.status_diajukan,
                pba.alasan_banding,
                pba.status_banding,
                COALESCE(pba.catatan_guru, '-') as catatan_guru,
                COALESCE(DATE_FORMAT(pba.tanggal_keputusan, '%d/%m/%Y %H:%i'), '-') as tanggal_keputusan,
                COALESCE(guru_proses.nama, 'Belum Diproses') as diproses_oleh,
                pba.jenis_banding
            FROM pengajuan_banding_absen pba
            JOIN siswa s ON pba.siswa_id = s.id_siswa
            LEFT JOIN kelas k ON s.kelas_id = k.id_kelas OR pba.kelas_id = k.id_kelas
            LEFT JOIN jadwal j ON pba.jadwal_id = j.id_jadwal
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru guru_proses ON pba.diproses_oleh = guru_proses.id_guru
            WHERE 1=1
        `;

        const params = [];

        if (startDate && endDate) {
            query += ' AND DATE(pba.tanggal_pengajuan) BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        if (kelas_id && kelas_id !== '') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }

        if (status && status !== '') {
            query += ' AND pba.status_banding = ?';
            params.push(status);
        }

        query += ' ORDER BY pba.tanggal_pengajuan DESC';

        const [rows] = await global.dbPool.execute(query, params);

        // Enhanced CSV format with UTF-8 BOM for Excel compatibility
        let csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += 'Tanggal Pengajuan,Tanggal Absen,Pengaju,Kelas,Mata Pelajaran,Guru,Jadwal,Status Asli,Status Diajukan,Alasan Banding,Status Banding,Catatan Guru,Tanggal Keputusan,Diproses Oleh,Jenis Banding\n';

        rows.forEach(row => {
            csvContent += `"${row.tanggal_pengajuan}","${row.tanggal_absen}","${row.nama_pengaju}","${row.nama_kelas}","${row.nama_mapel}","${row.nama_guru}","${row.jadwal}","${row.status_asli}","${row.status_diajukan}","${row.alasan_banding}","${row.status_banding}","${row.catatan_guru}","${row.tanggal_keputusan}","${row.diproses_oleh}","${row.jenis_banding}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="riwayat-banding-absen-${startDate || 'all'}-${endDate || 'all'}.csv"`);
        res.send(csvContent);

        console.log(`✅ Banding absen report downloaded successfully: ${rows.length} records`);
    } catch (error) {
        console.error('❌ Error downloading banding absen report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// ================================================
// COMPATIBILITY ENDPOINTS FOR SCHEDULE MANAGEMENT
// ================================================

// Get subjects (alias for /api/admin/mapel)
app.get('/api/admin/subjects', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📚 Getting subjects for schedule management');

        const query = `
            SELECT 
                id_mapel as id, 
                kode_mapel, 
                nama_mapel, 
                deskripsi,
                status
            FROM mapel 
            ORDER BY nama_mapel
        `;

        const [rows] = await global.dbPool.execute(query);
        console.log(`✅ Subjects retrieved: ${rows.length} items`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting subjects:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get classes (alias for /api/admin/kelas)
app.get('/api/admin/classes', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('🏫 Getting classes for schedule management');

        const query = `
            SELECT id_kelas as id, nama_kelas, tingkat, status
            FROM kelas 
            ORDER BY tingkat, nama_kelas
        `;

        const [rows] = await global.dbPool.execute(query);
        console.log(`✅ Classes retrieved: ${rows.length} items`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting classes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================================
// ABSENSI ENDPOINTS - Real Time Data
// ================================================

// Get today's schedule for guru or siswa
app.get('/api/jadwal/today', authenticateToken, async (req, res) => {
    try {
        const todayDayName = getDayNameWIB();
        let query = '';
        let params = [];

        if (req.user.role === 'guru') {
            query = `
                SELECT j.*, k.nama_kelas, COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel
                FROM jadwal j
                JOIN kelas k ON j.kelas_id = k.id_kelas
                LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
                WHERE j.hari = ? AND j.status = 'aktif'
                ORDER BY j.jam_ke
            `;
            params = [todayDayName];
        } else if (req.user.role === 'siswa') {
            query = `
                SELECT j.*, COALESCE(g.nama, 'Sistem') as nama_guru, COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel
                FROM jadwal j
                LEFT JOIN guru g ON j.guru_id = g.id_guru
                LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
                WHERE j.kelas_id = ? AND j.hari = ? AND j.status = 'aktif'
                ORDER BY j.jam_ke
            `;
            params = [req.user.kelas_id, todayDayName];
        }

        const [rows] = await global.dbPool.execute(query, params);

        console.log(`📅 Today's schedule retrieved for ${req.user.role}: ${req.user.username}`);
        res.json({ success: true, data: rows });

    } catch (error) {
        console.error('❌ Get today schedule error:', error);
        res.status(500).json({ error: 'Failed to retrieve today schedule' });
    }
});

// Record attendance (siswa marking guru attendance)
app.post('/api/absensi', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { jadwal_id, guru_id, status, keterangan, terlambat, ada_tugas } = req.body;

        // Check if attendance already recorded for today
        const todayWIB = getMySQLDateWIB();
        const [existing] = await global.dbPool.execute(
            `SELECT * FROM absensi_guru 
             WHERE jadwal_id = ? AND tanggal = ?`,
            [jadwal_id, todayWIB]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Absensi untuk jadwal ini sudah dicatat hari ini' });
        }

        // Get jadwal details
        const [jadwalData] = await global.dbPool.execute(
            'SELECT * FROM jadwal WHERE id_jadwal = ?',
            [jadwal_id]
        );

        if (jadwalData.length === 0) {
            return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
        }

        // Map status berdasarkan opsi Terlambat dan Ada Tugas
        let finalStatus = status;
        let isLate = 0;
        let hasTask = 0;

        if (terlambat && status === 'Hadir') {
            isLate = 1;
            finalStatus = 'Hadir'; // Tetap Hadir tapi ditandai terlambat
        } else if (ada_tugas && (status === 'Alpa' || status === 'Tidak Hadir')) {
            hasTask = 1;
            finalStatus = status; // Tetap Alpa/Tidak Hadir tapi ditandai ada tugas
        }

        // Record attendance (todayWIB already declared above)
        await global.dbPool.execute(
            `INSERT INTO absensi_guru (jadwal_id, guru_id, kelas_id, siswa_pencatat_id, tanggal, jam_ke, status, keterangan, terlambat, ada_tugas)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [jadwal_id, guru_id, req.user.kelas_id, req.user.siswa_id, todayWIB, jadwalData[0].jam_ke, finalStatus, keterangan, isLate, hasTask]
        );

        console.log(`✅ Attendance recorded by ${req.user.nama} for guru_id: ${guru_id}, status: ${finalStatus}, terlambat: ${isLate}, ada_tugas: ${hasTask}`);
        res.json({ success: true, message: 'Absensi berhasil dicatat' });

    } catch (error) {
        console.error('❌ Record attendance error:', error);
        res.status(500).json({ error: 'Failed to record attendance' });
    }
});

// Get attendance history
app.get('/api/absensi/history', authenticateToken, async (req, res) => {
    try {
        const { date_start, date_end, limit = 50 } = req.query;

        let query = `
            SELECT ag.*, j.jam_ke, j.jam_mulai, j.jam_selesai, j.hari,
                   COALESCE(g.nama, 'Sistem') as nama_guru, k.nama_kelas, COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel,
                   s.nama as nama_pencatat
            FROM absensi_guru ag
            JOIN jadwal j ON ag.jadwal_id = j.id_jadwal
            LEFT JOIN guru g ON ag.guru_id = g.id_guru
            JOIN kelas k ON ag.kelas_id = k.id_kelas
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            JOIN siswa s ON ag.siswa_pencatat_id = s.id_siswa
        `;

        let params = [];
        let whereConditions = [];

        // Filter by user role
        if (req.user.role === 'guru') {
            whereConditions.push('ag.guru_id = ?');
            params.push(req.user.guru_id);
        } else if (req.user.role === 'siswa') {
            whereConditions.push('ag.kelas_id = ?');
            params.push(req.user.kelas_id);
        }

        // Date filters
        if (date_start) {
            whereConditions.push('ag.tanggal >= ?');
            params.push(date_start);
        }
        if (date_end) {
            whereConditions.push('ag.tanggal <= ?');
            params.push(date_end);
        }

        // For siswa role, always limit to last 7 days maximum
        if (req.user.role === 'siswa') {
            // FIX: Use WIB timezone for date calculation
            const todayWIB = getMySQLDateWIB();
            const sevenDaysAgoWIB = new Date(new Date(todayWIB).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            whereConditions.push('ag.tanggal >= ?');
            params.push(sevenDaysAgoWIB);
        }

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        query += ' ORDER BY ag.tanggal DESC, j.jam_ke ASC LIMIT ?';
        params.push(parseInt(limit));

        const [rows] = await global.dbPool.execute(query, params);

        console.log(`📊 Attendance history retrieved for ${req.user.role}: ${req.user.username}`);
        res.json({ success: true, data: rows });

    } catch (error) {
        console.error('❌ Get attendance history error:', error);
        res.status(500).json({ error: 'Failed to retrieve attendance history' });
    }
});

// ================================================
// EXPORT EXCEL ENDPOINTS - MIGRATED TO exportRoutes.js + exportController.js
// ================================================
// NOTE: Export endpoints below have been migrated to modular structure:
// - /api/export/* routes are now in server/routes/exportRoutes.js
// - Handler logic is now in server/controllers/exportController.js
// ================================================

// ================================================
// GURU ENDPOINTS
// ================================================

// Get teacher schedule (uses modern schema: jadwal/mapel/kelas) & guru_id from token
app.get('/api/guru/jadwal', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    const guruId = req.user.guru_id; // correct mapping to guru.id_guru
    console.log(`📅 Getting schedule for authenticated guru_id: ${guruId} (user_id: ${req.user.id})`);

    if (!guruId) {
        return res.status(400).json({ error: 'guru_id tidak ditemukan pada token pengguna' });
    }

    try {
        const { query, params } = buildJadwalQuery('guru', guruId);
        const [jadwal] = await global.dbPool.execute(query, params);

        console.log(`✅ Found ${jadwal.length} schedule entries for guru_id: ${guruId}`);
        res.json({ success: true, data: jadwal });
    } catch (error) {
        console.error('❌ Error fetching teacher schedule:', error);
        res.status(500).json({ error: 'Gagal memuat jadwal guru.' });
    }
});

// Get teacher attendance history
app.get('/api/guru/history', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    const guruId = req.user.guru_id;
    console.log(`📊 Fetching teacher attendance history for guru_id: ${guruId} (user_id: ${req.user.id})`);

    if (!guruId) {
        return res.status(400).json({ error: 'guru_id tidak ditemukan pada token pengguna' });
    }

    try {
        const [history] = await global.dbPool.execute(`
            SELECT 
                ag.tanggal, 
                ag.status, 
                ag.keterangan, 
                k.nama_kelas, 
                COALESCE(mp.nama_mapel, j.keterangan_khusus) as nama_mapel
            FROM absensi_guru ag
            JOIN jadwal j ON ag.jadwal_id = j.id_jadwal
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN mapel mp ON j.mapel_id = mp.id_mapel
            WHERE j.guru_id = ?
            ORDER BY ag.tanggal DESC, j.jam_mulai ASC
            LIMIT 50
        `, [guruId]);

        console.log(`✅ Found ${history.length} attendance history records for guru_id ${guruId}`);
        res.json({ success: true, data: history });
    } catch (error) {
        console.error('❌ Error fetching teacher attendance history:', error);
        res.status(500).json({ error: 'Gagal memuat riwayat absensi.' });
    }
});

// Get student attendance history for teacher (FIXED ENDPOINT)
app.get('/api/guru/student-attendance-history', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        const guruId = req.user.guru_id;
        const { page = 1, limit = 5 } = req.query;
        console.log(`📊 Fetching student attendance history for guru_id: ${guruId} with pagination:`, { page, limit });

        if (!guruId) {
            return res.status(400).json({ error: 'guru_id tidak ditemukan pada token pengguna' });
        }

        // FIX: Calculate 30 days ago in WIB timezone
        const todayWIB = getMySQLDateWIB();
        const thirtyDaysAgoWIB = new Date(new Date(todayWIB).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Count total unique days
        const countQuery = `
            SELECT COUNT(DISTINCT DATE(absensi.waktu_absen)) as total_days
            FROM absensi_siswa absensi
            INNER JOIN jadwal ON absensi.jadwal_id = jadwal.id_jadwal
            WHERE jadwal.guru_id = ? 
                AND absensi.waktu_absen >= ?
        `;

        const [countResult] = await global.dbPool.execute(countQuery, [guruId, thirtyDaysAgoWIB]);
        const totalDays = countResult[0].total_days;
        const totalPages = Math.ceil(totalDays / parseInt(limit));

        // Calculate date range for current page
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Get unique dates for current page
        const datesQuery = `
            SELECT DISTINCT DATE(absensi.waktu_absen) as tanggal
            FROM absensi_siswa absensi
            INNER JOIN jadwal ON absensi.jadwal_id = jadwal.id_jadwal
            WHERE jadwal.guru_id = ? 
                AND absensi.waktu_absen >= ?
            ORDER BY tanggal DESC
            LIMIT ? OFFSET ?
        `;

        const [datesResult] = await global.dbPool.execute(datesQuery, [guruId, thirtyDaysAgoWIB, parseInt(limit), offset]);
        const dates = datesResult.map(row => row.tanggal);

        if (dates.length === 0) {
            return res.json({
                success: true,
                data: [],
                totalDays,
                totalPages,
                currentPage: parseInt(page)
            });
        }

        // Get attendance data for these specific dates
        const datePlaceholders = dates.map(() => '?').join(',');
        const query = `
            SELECT 
                DATE(absensi.waktu_absen) as tanggal,
                jadwal.jam_ke,
                jadwal.jam_mulai,
                jadwal.jam_selesai,
                mapel.nama_mapel,
                kelas.nama_kelas,
                siswa.nama as nama_siswa,
                siswa.nis,
                absensi.status as status_kehadiran,
                absensi.keterangan,
                absensi.waktu_absen,
                guru_absen.status as status_guru,
                guru_absen.keterangan as keterangan_guru,
                ruang.kode_ruang,
                ruang.nama_ruang,
                ruang.lokasi
            FROM absensi_siswa absensi
            INNER JOIN jadwal ON absensi.jadwal_id = jadwal.id_jadwal
            LEFT JOIN mapel ON jadwal.mapel_id = mapel.id_mapel
            INNER JOIN kelas ON jadwal.kelas_id = kelas.id_kelas
            INNER JOIN siswa siswa ON absensi.siswa_id = siswa.id_siswa
            LEFT JOIN ruang_kelas ruang ON jadwal.ruang_id = ruang.id_ruang
            LEFT JOIN absensi_guru guru_absen ON jadwal.id_jadwal = guru_absen.jadwal_id 
                AND DATE(guru_absen.tanggal) = DATE(absensi.waktu_absen)
            WHERE jadwal.guru_id = ? 
                AND DATE(absensi.waktu_absen) IN (${datePlaceholders})
            ORDER BY absensi.waktu_absen DESC, jadwal.jam_ke ASC
        `;

        const [history] = await global.dbPool.execute(query, [guruId, ...dates]);

        console.log(`✅ Found ${history.length} student attendance records for guru_id ${guruId} (${dates.length} days)`);

        // Debug: Log sample data
        if (history.length > 0) {
            console.log('📊 Sample history record:', history[0]);
        }

        res.json({
            success: true,
            data: history,
            totalDays,
            totalPages,
            currentPage: parseInt(page),
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalDays,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('❌ Error fetching student attendance history:', error);
        res.status(500).json({ error: 'Gagal memuat riwayat absensi siswa.' });
    }
});

// Test endpoint untuk debugging
app.get('/api/guru/test', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        console.log('🧪 Test endpoint called');
        res.json({ success: true, message: 'Test endpoint working', user: req.user });
    } catch (error) {
        console.error('❌ Test endpoint error:', error);
        res.status(500).json({ error: 'Test endpoint error' });
    }
});

// Simple student attendance history endpoint
app.get('/api/guru/student-attendance-simple', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        const guruId = req.user.guru_id;
        console.log(`📊 Simple endpoint called for guru_id: ${guruId}`);

        if (!guruId) {
            return res.status(400).json({ error: 'guru_id tidak ditemukan' });
        }

        // Simple query to test
        const [result] = await global.dbPool.execute(`
            SELECT COUNT(*) as total
            FROM jadwal j
            WHERE j.guru_id = ?
        `, [guruId]);

        console.log(`✅ Simple query result:`, result);
        res.json({ success: true, data: result, message: 'Simple endpoint working' });
    } catch (error) {
        console.error('❌ Simple endpoint error:', error);
        res.status(500).json({ error: 'Simple endpoint error' });
    }
});


// ================================================
// SISWA PERWAKILAN ENDPOINTS
// ================================================

// Get siswa perwakilan info
app.get('/api/siswa-perwakilan/info', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        console.log('📋 Getting siswa perwakilan info for user:', req.user.id);

        const [siswaData] = await global.dbPool.execute(
            `SELECT u.id, u.username, u.nama, u.email, u.role, s.id_siswa, s.nis, s.kelas_id, 
                    k.nama_kelas, s.alamat, s.telepon_orangtua, s.nomor_telepon_siswa, s.jenis_kelamin, s.jabatan, 
                    u.created_at, u.updated_at
             FROM users u
             LEFT JOIN siswa s ON u.id = s.user_id
             LEFT JOIN kelas k ON s.kelas_id = k.id_kelas
             WHERE u.id = ?`,
            [req.user.id]
        );

        if (siswaData.length === 0) {
            return res.status(404).json({ error: 'Data siswa perwakilan tidak ditemukan' });
        }

        const info = siswaData[0];
        console.log('✅ Siswa perwakilan info retrieved:', info);

        res.json({
            success: true,
            id: info.id,
            username: info.username,
            nama: info.nama,
            email: info.email,
            role: info.role,
            id_siswa: info.id_siswa,
            nis: info.nis,
            kelas_id: info.kelas_id,
            nama_kelas: info.nama_kelas,
            alamat: info.alamat,
            telepon_orangtua: info.telepon_orangtua,
            nomor_telepon_siswa: info.nomor_telepon_siswa,
            jenis_kelamin: info.jenis_kelamin,
            jabatan: info.jabatan,
            created_at: info.created_at,
            updated_at: info.updated_at
        });

    } catch (error) {
        console.error('❌ Error getting siswa perwakilan info:', error);
        res.status(500).json({ error: 'Gagal memuat informasi siswa perwakilan' });
    }
});

// Get guru info
app.get('/api/guru/info', authenticateToken, requireRole(['guru']), async (req, res) => {
    try {
        console.log('📋 Getting guru info for user:', req.user.id);

        const [guruData] = await global.dbPool.execute(
            `SELECT u.id, u.username, u.nama, u.email, u.role, g.id_guru, g.nip, g.mapel_id, 
                    m.nama_mapel, g.alamat, g.no_telp, g.jenis_kelamin, g.status, 
                    u.created_at, u.updated_at
             FROM users u
             LEFT JOIN guru g ON u.id = g.user_id
             LEFT JOIN mapel m ON g.mapel_id = m.id_mapel
             WHERE u.id = ?`,
            [req.user.id]
        );

        if (guruData.length === 0) {
            return res.status(404).json({ error: 'Data guru tidak ditemukan' });
        }

        const info = guruData[0];
        console.log('✅ Guru info retrieved:', info);

        res.json({
            success: true,
            id: info.id,
            username: info.username,
            nama: info.nama,
            email: info.email,
            role: info.role,
            guru_id: info.id_guru,
            nip: info.nip,
            mapel_id: info.mapel_id,
            mata_pelajaran: info.nama_mapel,
            alamat: info.alamat,
            no_telepon: info.no_telp,
            jenis_kelamin: info.jenis_kelamin,
            status: info.status,
            created_at: info.created_at,
            updated_at: info.updated_at
        });

    } catch (error) {
        console.error('❌ Error getting guru info:', error);
        res.status(500).json({ error: 'Gagal memuat informasi guru' });
    }
});

// Get admin info
app.get('/api/admin/info', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📋 Getting admin info for user:', req.user.id);

        const [adminData] = await global.dbPool.execute(
            `SELECT id, username, nama, email, role, created_at, updated_at
             FROM users
             WHERE id = ?`,
            [req.user.id]
        );

        if (adminData.length === 0) {
            return res.status(404).json({ error: 'Data admin tidak ditemukan' });
        }

        const info = adminData[0];
        console.log('✅ Admin info retrieved:', info);

        res.json({
            success: true,
            id: info.id,
            username: info.username,
            nama: info.nama,
            email: info.email,
            role: info.role,
            created_at: info.created_at,
            updated_at: info.updated_at
        });

    } catch (error) {
        console.error('❌ Error getting admin info:', error);
        res.status(500).json({
            error: 'Gagal memuat informasi admin',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Get jadwal hari ini untuk siswa
app.get('/api/siswa/:siswa_id/jadwal-hari-ini', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { siswa_id } = req.params;
        console.log('📅 Getting jadwal hari ini for siswa:', siswa_id);

        // FIX: Get current day in Indonesian using WIB timezone
        const wibTime = getWIBTime();
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const currentDay = dayNames[wibTime.getDay()];
        const todayWIB = getMySQLDateWIB();

        console.log('📅 Current day (WIB):', currentDay, 'Date:', todayWIB);

        // Get siswa's class
        const [siswaData] = await global.dbPool.execute(
            'SELECT kelas_id FROM siswa WHERE id_siswa = ?',
            [siswa_id]
        );

        if (siswaData.length === 0) {
            return res.status(404).json({ error: 'Siswa tidak ditemukan' });
        }

        const kelasId = siswaData[0].kelas_id;

        // Get today's schedule for the class with multi-guru support
        const [jadwalData] = await global.dbPool.execute(`
            SELECT 
                j.id_jadwal,
                j.guru_id,
                j.jam_ke,
                j.jam_mulai,
                j.jam_selesai,
                COALESCE(mp.nama_mapel, j.keterangan_khusus) as nama_mapel,
                COALESCE(mp.kode_mapel, '') as kode_mapel,
                COALESCE(g.nama, '') as nama_guru,
                COALESCE(g.nip, '') as nip,
                k.nama_kelas,
                COALESCE(ag.status, 'belum_diambil') as status_kehadiran,
                COALESCE(ag.keterangan, '') as keterangan,
                COALESCE(ag.waktu_catat, '') as waktu_catat,
                rk.kode_ruang,
                rk.nama_ruang,
                j.jenis_aktivitas,
                j.is_absenable,
                j.keterangan_khusus,
                j.is_multi_guru,
                GROUP_CONCAT(
                    CONCAT(
                        g2.id_guru, ':', 
                        COALESCE(g2.nama, ''), ':', 
                        COALESCE(g2.nip, ''), ':', 
                        COALESCE(ag2.status, 'belum_diambil'), ':', 
                        COALESCE(ag2.keterangan, ''), ':',
                        COALESCE(ag2.waktu_catat, ''), ':',
                        COALESCE(jg2.is_primary, 0)
                    ) 
                    ORDER BY jg2.is_primary DESC, g2.nama ASC 
                    SEPARATOR '||'
                ) as guru_list
            FROM jadwal j
            LEFT JOIN mapel mp ON j.mapel_id = mp.id_mapel
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN ruang_kelas rk ON j.ruang_id = rk.id_ruang
            LEFT JOIN absensi_guru ag ON j.id_jadwal = ag.jadwal_id 
                AND ag.tanggal = ?
                AND ag.guru_id = j.guru_id
            LEFT JOIN jadwal_guru jg2 ON j.id_jadwal = jg2.jadwal_id
            LEFT JOIN guru g2 ON jg2.guru_id = g2.id_guru
            LEFT JOIN absensi_guru ag2 ON j.id_jadwal = ag2.jadwal_id 
                AND ag2.tanggal = ?
                AND ag2.guru_id = g2.id_guru
            WHERE j.kelas_id = ? AND j.hari = ?
            GROUP BY j.id_jadwal, j.jam_ke, j.jam_mulai, j.jam_selesai, mp.nama_mapel, mp.kode_mapel, g.nama, g.nip, k.nama_kelas, ag.status, ag.keterangan, ag.waktu_catat, rk.kode_ruang, rk.nama_ruang, j.jenis_aktivitas, j.is_absenable, j.keterangan_khusus, j.is_multi_guru
            ORDER BY j.jam_ke
        `, [todayWIB, todayWIB, kelasId, currentDay]);

        console.log('✅ Jadwal retrieved:', jadwalData.length, 'items');

        res.json(jadwalData);

    } catch (error) {
        console.error('❌ Error getting jadwal hari ini:', error);
        res.status(500).json({ error: 'Gagal memuat jadwal hari ini' });
    }
});

// Get jadwal dengan rentang tanggal untuk siswa (7 hari terakhir)
app.get('/api/siswa/:siswa_id/jadwal-rentang', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { siswa_id } = req.params;
        const { tanggal } = req.query;
        console.log('📅 Getting jadwal rentang for siswa:', siswa_id, 'tanggal:', tanggal);

        // Get siswa's class
        const [siswaData] = await global.dbPool.execute(
            'SELECT kelas_id FROM siswa WHERE id_siswa = ?',
            [siswa_id]
        );

        if (siswaData.length === 0) {
            return res.status(404).json({ error: 'Siswa tidak ditemukan' });
        }

        const kelasId = siswaData[0].kelas_id;

        // Validate date range (max 7 days ago)
        const today = new Date();
        const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
        const targetDate = tanggal ? new Date(tanggal) : today;

        if (targetDate > today) {
            return res.status(400).json({ error: 'Tidak dapat melihat jadwal untuk tanggal masa depan' });
        }

        if (targetDate < sevenDaysAgo) {
            return res.status(400).json({ error: 'Tidak dapat melihat jadwal lebih dari 7 hari yang lalu' });
        }

        // Get day name for the target date
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const targetDay = dayNames[targetDate.getDay()];
        const targetDateStr = targetDate.toISOString().split('T')[0];

        console.log('📅 Target day:', targetDay, 'Target date:', targetDateStr);

        // Get schedule for the target date with multi-guru support
        const [jadwalData] = await global.dbPool.execute(`
            SELECT 
                j.id_jadwal,
                j.guru_id,
                j.jam_ke,
                j.jam_mulai,
                j.jam_selesai,
                COALESCE(mp.nama_mapel, j.keterangan_khusus) as nama_mapel,
                COALESCE(mp.kode_mapel, '') as kode_mapel,
                COALESCE(g.nama, '') as nama_guru,
                COALESCE(g.nip, '') as nip,
                k.nama_kelas,
                COALESCE(ag.status, 'belum_diambil') as status_kehadiran,
                COALESCE(ag.keterangan, '') as keterangan,
                COALESCE(ag.waktu_catat, '') as waktu_catat,
                rk.kode_ruang,
                rk.nama_ruang,
                j.jenis_aktivitas,
                j.is_absenable,
                j.keterangan_khusus,
                j.is_multi_guru,
                GROUP_CONCAT(
                    CONCAT(
                        g2.id_guru, ':', 
                        COALESCE(g2.nama, ''), ':', 
                        COALESCE(g2.nip, ''), ':', 
                        COALESCE(ag2.status, 'belum_diambil'), ':', 
                        COALESCE(ag2.keterangan, ''), ':',
                        COALESCE(ag2.waktu_catat, ''), ':',
                        COALESCE(jg2.is_primary, 0)
                    ) 
                    ORDER BY jg2.is_primary DESC, g2.nama ASC 
                    SEPARATOR '||'
                ) as guru_list,
                ? as tanggal_target
            FROM jadwal j
            LEFT JOIN mapel mp ON j.mapel_id = mp.id_mapel
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN ruang_kelas rk ON j.ruang_id = rk.id_ruang
            LEFT JOIN absensi_guru ag ON j.id_jadwal = ag.jadwal_id 
                AND ag.tanggal = ?
                AND ag.guru_id = j.guru_id
            LEFT JOIN jadwal_guru jg2 ON j.id_jadwal = jg2.jadwal_id
            LEFT JOIN guru g2 ON jg2.guru_id = g2.id_guru
            LEFT JOIN absensi_guru ag2 ON j.id_jadwal = ag2.jadwal_id 
                AND ag2.tanggal = ?
                AND ag2.guru_id = g2.id_guru
            WHERE j.kelas_id = ? AND j.hari = ?
            GROUP BY j.id_jadwal, j.jam_ke, j.jam_mulai, j.jam_selesai, mp.nama_mapel, mp.kode_mapel, g.nama, g.nip, k.nama_kelas, ag.status, ag.keterangan, ag.waktu_catat, rk.kode_ruang, rk.nama_ruang, j.jenis_aktivitas, j.is_absenable, j.keterangan_khusus, j.is_multi_guru
            ORDER BY j.jam_ke
        `, [targetDateStr, targetDateStr, targetDateStr, kelasId, targetDay]);

        console.log('✅ Jadwal rentang retrieved:', jadwalData.length, 'items for date:', targetDateStr);

        res.json({
            success: true,
            data: jadwalData,
            tanggal: targetDateStr,
            hari: targetDay
        });

    } catch (error) {
        console.error('❌ Error getting jadwal rentang:', error);
        res.status(500).json({ error: 'Gagal memuat jadwal rentang' });
    }
});

// Submit kehadiran guru (Updated to support editing up to 7 days)
app.post('/api/siswa/submit-kehadiran-guru', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { siswa_id, kehadiran_data, tanggal_absen } = req.body;
        console.log('📝 Submitting kehadiran guru for siswa:', siswa_id);
        console.log('📝 Kehadiran data:', kehadiran_data);
        console.log('📝 Tanggal absen:', tanggal_absen);
        console.log('📝 Request body:', req.body);

        // Validation
        if (!siswa_id) {
            return res.status(400).json({ error: 'siswa_id is required' });
        }

        if (!kehadiran_data || typeof kehadiran_data !== 'object') {
            return res.status(400).json({ error: 'kehadiran_data is required and must be an object' });
        }

        // Use provided date or default to today (using WIB timezone)
        const targetDate = tanggal_absen || getMySQLDateWIB();

        // Validate date range (max 7 days ago) - using WIB timezone-aware functions
        const todayStr = getMySQLDateWIB();

        // Calculate days difference using WIB-aware function
        const daysDiff = getDaysDifferenceWIB(targetDate, todayStr);

        console.log('📅 Student date validation (WIB):', {
            targetDate,
            todayStr,
            daysDifference: daysDiff,
            isFuture: daysDiff < 0,
            isTooOld: daysDiff > 7
        });

        // Check if date is in the future
        if (daysDiff < 0) {
            return res.status(400).json({ error: 'Tidak dapat mengubah absen untuk tanggal masa depan' });
        }

        // Check if date is more than 7 days ago
        if (daysDiff > 7) {
            return res.status(400).json({ error: 'Tidak dapat mengubah absen lebih dari 7 hari yang lalu' });
        }

        // Check database connection
        if (!global.dbPool) {
            return res.status(503).json({ error: 'Database connection not available' });
        }

        // Get connection from pool for transaction
        const connection = await global.dbPool.getConnection();

        try {
            // Begin transaction
            await connection.beginTransaction();

            // FIX: Use WIB timezone for currentTime instead of server timezone
            const currentTime = getMySQLDateTimeWIB().split(' ')[1]; // Get HH:mm:ss from WIB datetime

            // Insert/update attendance for each jadwal (support multi-guru)
            for (const [key, data] of Object.entries(kehadiran_data)) {
                const { status, keterangan, terlambat, ada_tugas, guru_id: specific_guru_id } = data;

                let jadwalId, guru_id;

                // Check if this is a multi-guru key (format: "jadwalId-guruId")
                if (key.includes('-')) {
                    [jadwalId, guru_id] = key.split('-');
                    guru_id = parseInt(guru_id);
                } else {
                    jadwalId = key;
                    // Use specific_guru_id if provided, otherwise get from database
                    if (specific_guru_id) {
                        guru_id = specific_guru_id;
                    } else {
                        // Get jadwal details to get guru_id, kelas_id, and jam_ke
                        // First try to get from jadwal table (for backward compatibility)
                        const [jadwalDetails] = await connection.execute(
                            'SELECT guru_id, kelas_id, jam_ke FROM jadwal WHERE id_jadwal = ?',
                            [jadwalId]
                        );

                        if (jadwalDetails.length === 0) {
                            throw new Error(`Jadwal dengan ID ${jadwalId} tidak ditemukan`);
                        }

                        guru_id = jadwalDetails[0].guru_id;

                        // If guru_id is NULL (multi-guru system), get the primary teacher from jadwal_guru
                        if (!guru_id) {
                            const [guruDetails] = await connection.execute(
                                'SELECT guru_id FROM jadwal_guru WHERE jadwal_id = ? AND is_primary = 1 LIMIT 1',
                                [jadwalId]
                            );

                            if (guruDetails.length > 0) {
                                guru_id = guruDetails[0].guru_id;
                            } else {
                                // If no primary teacher found, get any teacher from jadwal_guru
                                const [anyGuruDetails] = await connection.execute(
                                    'SELECT guru_id FROM jadwal_guru WHERE jadwal_id = ? LIMIT 1',
                                    [jadwalId]
                                );

                                if (anyGuruDetails.length > 0) {
                                    guru_id = anyGuruDetails[0].guru_id;
                                }
                            }
                        }
                    }
                }

                // Get jadwal details for kelas_id, jam_ke, and is_absenable
                const [jadwalDetails] = await connection.execute(
                    'SELECT kelas_id, jam_ke, is_absenable, jenis_aktivitas, is_multi_guru FROM jadwal WHERE id_jadwal = ?',
                    [jadwalId]
                );

                if (jadwalDetails.length === 0) {
                    throw new Error(`Jadwal dengan ID ${jadwalId} tidak ditemukan`);
                }

                const { kelas_id, jam_ke, is_absenable, jenis_aktivitas, is_multi_guru } = jadwalDetails[0];

                // Check if this schedule is absenable
                if (!is_absenable) {
                    console.log(`⚠️ Skipping non-absenable schedule ${jadwalId} (${jenis_aktivitas})`);
                    continue; // Skip this schedule
                }

                // Validate guru_id is not null
                if (!guru_id) {
                    throw new Error(`Guru ID tidak ditemukan untuk jadwal ${jadwalId}. Pastikan jadwal memiliki guru yang terkait.`);
                }

                // For multi-guru schedules, validate that all teachers are being attended
                if (is_multi_guru === 1) {
                    // Get all teachers in this schedule
                    const [allTeachers] = await connection.execute(
                        'SELECT guru_id FROM jadwal_guru WHERE jadwal_id = ?',
                        [jadwalId]
                    );

                    // Check if all teachers are included in kehadiran_data
                    const expectedKeys = allTeachers.map(teacher => `${jadwalId}-${teacher.guru_id}`);
                    const providedKeys = Object.keys(kehadiran_data);
                    const missingTeachers = expectedKeys.filter(key => !providedKeys.includes(key));

                    if (missingTeachers.length > 0) {
                        throw new Error(`Jadwal multi guru memerlukan absensi untuk semua guru. Guru yang belum diabsen: ${missingTeachers.join(', ')}`);
                    }
                }

                // Map status berdasarkan opsi Terlambat dan Ada Tugas
                let finalStatus = status;
                let isLate = 0;
                let hasTask = 0;

                if (terlambat && status === 'Hadir') {
                    isLate = 1;
                    finalStatus = 'Hadir'; // Tetap Hadir tapi ditandai terlambat
                } else if (ada_tugas && (status === 'Tidak Hadir' || status === 'Alpa')) {
                    hasTask = 1;
                    finalStatus = status; // Tetap status asli tapi ditandai ada tugas
                }

                // Check if attendance record already exists for the target date and specific guru
                const [existingRecord] = await connection.execute(
                    'SELECT id_absensi FROM absensi_guru WHERE jadwal_id = ? AND guru_id = ? AND tanggal = ?',
                    [jadwalId, guru_id, targetDate]
                );

                if (existingRecord.length > 0) {
                    // Update existing record
                    const waktuCatatWIB = getMySQLDateTimeWIB();
                    await connection.execute(`
                        UPDATE absensi_guru 
                        SET status = ?, keterangan = ?, siswa_pencatat_id = ?, waktu_catat = ?, 
                            terlambat = ?, ada_tugas = ?
                        WHERE jadwal_id = ? AND guru_id = ? AND tanggal = ?
                    `, [finalStatus, keterangan || null, siswa_id, waktuCatatWIB, isLate, hasTask, jadwalId, guru_id, targetDate]);

                    console.log(`✅ Updated attendance for jadwal ${jadwalId}, guru ${guru_id} on ${targetDate}, status: ${finalStatus}, terlambat: ${isLate}, ada_tugas: ${hasTask}`);
                } else {
                    // Insert new record
                    const waktuCatatWIB = getMySQLDateTimeWIB();
                    await connection.execute(`
                        INSERT INTO absensi_guru 
                        (jadwal_id, guru_id, kelas_id, siswa_pencatat_id, tanggal, jam_ke, status, keterangan, waktu_catat, terlambat, ada_tugas) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [jadwalId, guru_id, kelas_id, siswa_id, targetDate, jam_ke, finalStatus, keterangan || null, waktuCatatWIB, isLate, hasTask]);

                    console.log(`✅ Inserted new attendance for jadwal ${jadwalId}, guru ${guru_id} on ${targetDate}, status: ${finalStatus}, terlambat: ${isLate}, ada_tugas: ${hasTask}`);
                }
            }

            // Commit transaction
            await connection.commit();
        } finally {
            // Always release connection back to pool
            connection.release();
        }

        console.log('✅ Kehadiran guru submitted successfully');

        res.json({
            success: true,
            message: `Data kehadiran guru berhasil disimpan untuk tanggal ${targetDate}`
        });

    } catch (error) {
        console.error('❌ Error submitting kehadiran guru:', error);
        res.status(500).json({
            error: 'Gagal menyimpan data kehadiran guru',
            details: error.message
        });
    }
});

// Update status kehadiran guru (single update, real-time save)
app.post('/api/siswa/update-status-guru', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { jadwal_id, guru_id, status, keterangan, tanggal_absen, ada_tugas } = req.body;
        const siswa_id = req.user.siswa_id;

        // Validate input
        if (!jadwal_id || !guru_id || !status || !tanggal_absen) {
            return res.status(400).json({ error: 'Jadwal ID, guru ID, status, dan tanggal absen wajib diisi' });
        }

        // Validate status
        const validStatuses = ['Hadir', 'Tidak Hadir', 'Izin', 'Sakit'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Status tidak valid' });
        }

        // Ensure DB available
        if (!global.dbPool) {
            return res.status(503).json({ error: 'Database connection not available' });
        }

        // Get jadwal info
        const [jadwalRows] = await global.dbPool.execute(
            'SELECT kelas_id, jam_ke FROM jadwal WHERE id_jadwal = ? LIMIT 1',
            [jadwal_id]
        );

        if (jadwalRows.length === 0) {
            return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
        }

        const { kelas_id, jam_ke } = jadwalRows[0];

        // Upsert absensi_guru for the given date
        const [existing] = await global.dbPool.execute(
            'SELECT id_absensi FROM absensi_guru WHERE jadwal_id = ? AND guru_id = ? AND tanggal = ?',
            [jadwal_id, guru_id, tanggal_absen]
        );

        if (existing.length > 0) {
            const waktuCatatWIB = getMySQLDateTimeWIB();
            await global.dbPool.execute(
                `UPDATE absensi_guru 
                 SET status = ?, keterangan = ?, siswa_pencatat_id = ?, waktu_catat = ?, ada_tugas = ?
                 WHERE jadwal_id = ? AND guru_id = ? AND tanggal = ?`,
                [status, keterangan || null, siswa_id, waktuCatatWIB, ada_tugas ? 1 : 0, jadwal_id, guru_id, tanggal_absen]
            );
            console.log('✅ Updated absensi_guru:', { jadwal_id, guru_id, status, tanggal_absen, waktu: waktuCatatWIB });
        } else {
            const waktuCatatWIB = getMySQLDateTimeWIB();
            await global.dbPool.execute(
                `INSERT INTO absensi_guru (jadwal_id, guru_id, kelas_id, siswa_pencatat_id, tanggal, jam_ke, status, keterangan, waktu_catat, ada_tugas)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [jadwal_id, guru_id, kelas_id, siswa_id, tanggal_absen, jam_ke, status, keterangan || null, waktuCatatWIB, ada_tugas ? 1 : 0]
            );
            console.log('✅ Inserted new absensi_guru:', { jadwal_id, guru_id, status, tanggal_absen, jam_ke, waktu: waktuCatatWIB });
        }

        res.json({ success: true, message: 'Status kehadiran guru berhasil diperbarui' });
    } catch (error) {
        console.error('❌ Error updating guru status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get riwayat kehadiran kelas (for siswa perwakilan)
app.get('/api/siswa/:siswa_id/riwayat-kehadiran', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { siswa_id } = req.params;
        console.log('📊 Getting riwayat kehadiran kelas for siswa:', siswa_id);

        // Get siswa's class
        const [siswaData] = await global.dbPool.execute(
            'SELECT kelas_id, nama FROM siswa WHERE id_siswa = ?',
            [siswa_id]
        );

        if (siswaData.length === 0) {
            return res.status(404).json({ error: 'Siswa tidak ditemukan' });
        }

        const kelasId = siswaData[0].kelas_id;

        // Get total students in class
        const [totalSiswaResult] = await global.dbPool.execute(
            'SELECT COUNT(*) as total FROM siswa WHERE kelas_id = ?',
            [kelasId]
        );
        const totalSiswa = totalSiswaResult[0].total;

        // Get attendance history with aggregated data and multi-guru support
        const [riwayatData] = await global.dbPool.execute(`
            SELECT 
                ag.tanggal,
                j.id_jadwal,
                j.jam_ke,
                j.jam_mulai,
                j.jam_selesai,
                mp.nama_mapel,
                COALESCE(g.nama, 'Sistem') as nama_guru,
                ag.status as status_kehadiran,
                ag.keterangan,
                s.nama as nama_pencatat,
                rk.kode_ruang,
                rk.nama_ruang,
                j.is_multi_guru,
                -- Get multi-guru list with their attendance status
                (SELECT GROUP_CONCAT(
                    CONCAT(
                        g2.id_guru, ':', 
                        COALESCE(g2.nama, ''), ':', 
                        COALESCE(ag2.status, 'belum_diambil'), ':', 
                        COALESCE(ag2.keterangan, '')
                    ) 
                    ORDER BY jg2.is_primary DESC, g2.nama ASC 
                    SEPARATOR '||'
                ) FROM jadwal_guru jg2
                LEFT JOIN guru g2 ON jg2.guru_id = g2.id_guru
                LEFT JOIN absensi_guru ag2 ON j.id_jadwal = ag2.jadwal_id 
                    AND ag2.tanggal = ag.tanggal
                    AND ag2.guru_id = g2.id_guru
                WHERE jg2.jadwal_id = j.id_jadwal) as guru_list,
                -- Get attendance data for this schedule
                (SELECT GROUP_CONCAT(
                    CONCAT(s2.nama, ':', s2.nis, ':', COALESCE(LOWER(abs2.status), 'tidak_hadir'))
                    SEPARATOR '|'
                ) FROM siswa s2 
                LEFT JOIN absensi_siswa abs2 ON s2.id_siswa = abs2.siswa_id 
                    AND abs2.jadwal_id = j.id_jadwal 
                    AND DATE(abs2.waktu_absen) = ag.tanggal
                WHERE s2.kelas_id = ?) as siswa_data
            FROM absensi_guru ag
            JOIN jadwal j ON ag.jadwal_id = j.id_jadwal
            LEFT JOIN mapel mp ON j.mapel_id = mp.id_mapel
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN ruang_kelas rk ON j.ruang_id = rk.id_ruang
            LEFT JOIN siswa s ON ag.siswa_pencatat_id = s.id_siswa
            WHERE j.kelas_id = ? 
            ORDER BY ag.tanggal DESC, j.jam_ke ASC
        `, [kelasId, kelasId]);

        // Group by date and calculate statistics
        const groupedData = {};
        riwayatData.forEach(row => {
            const dateKey = row.tanggal;
            if (!groupedData[dateKey]) {
                groupedData[dateKey] = {
                    tanggal: dateKey,
                    jadwal: []
                };
            }

            // Parse student attendance data
            const siswaData = row.siswa_data ? row.siswa_data.split('|') : [];
            const siswaStats = {
                hadir: 0,
                izin: 0,
                sakit: 0,
                alpa: 0,
                tidak_hadir: 0,
                tidak_hadir_list: []
            };

            siswaData.forEach(data => {
                const [nama, nis, status] = data.split(':');
                const normalizedStatus = status ? status.toLowerCase() : 'tidak_hadir';

                if (normalizedStatus === 'hadir') {
                    siswaStats.hadir++;
                } else if (normalizedStatus === 'izin') {
                    siswaStats.izin++;
                    siswaStats.tidak_hadir_list.push({
                        nama_siswa: nama,
                        nis: nis || '',
                        status: 'izin'
                    });
                } else if (normalizedStatus === 'sakit') {
                    siswaStats.sakit++;
                    siswaStats.tidak_hadir_list.push({
                        nama_siswa: nama,
                        nis: nis || '',
                        status: 'sakit'
                    });
                } else if (normalizedStatus === 'alpa') {
                    siswaStats.alpa++;
                    siswaStats.tidak_hadir_list.push({
                        nama_siswa: nama,
                        nis: nis || '',
                        status: 'alpa'
                    });
                } else if (normalizedStatus === 'dispen') {
                    siswaStats.izin++; // Dispen dihitung sebagai izin
                    siswaStats.tidak_hadir_list.push({
                        nama_siswa: nama,
                        nis: nis || '',
                        status: 'dispen'
                    });
                } else if (normalizedStatus === 'tidak_hadir') {
                    // tidak_hadir (no attendance record) - ini berbeda dari alpa
                    siswaStats.tidak_hadir++;
                    siswaStats.tidak_hadir_list.push({
                        nama_siswa: nama,
                        nis: nis || '',
                        status: 'tidak_hadir'
                    });
                } else {
                    // Status tidak dikenali, log untuk debugging
                    console.log('⚠️ Unknown status in riwayat:', status, 'for student:', nama);
                    siswaStats.alpa++;
                    siswaStats.tidak_hadir_list.push({
                        nama_siswa: nama,
                        nis: nis || '',
                        status: status || 'unknown'
                    });
                }
            });

            groupedData[dateKey].jadwal.push({
                jadwal_id: row.id_jadwal,
                jam_ke: row.jam_ke,
                jam_mulai: row.jam_mulai,
                jam_selesai: row.jam_selesai,
                nama_mapel: row.nama_mapel,
                nama_guru: row.nama_guru,
                kode_ruang: row.kode_ruang,
                nama_ruang: row.nama_ruang,
                status_kehadiran: row.status_kehadiran,
                keterangan: row.keterangan,
                nama_pencatat: row.nama_pencatat,
                total_siswa: totalSiswa,
                total_hadir: siswaStats.hadir,
                total_izin: siswaStats.izin,
                total_sakit: siswaStats.sakit,
                total_alpa: siswaStats.alpa,
                total_tidak_hadir: siswaStats.tidak_hadir,
                siswa_tidak_hadir: siswaStats.tidak_hadir_list
            });
        });

        const result = Object.values(groupedData);
        console.log('✅ Riwayat kehadiran kelas retrieved:', result.length, 'days');

        // Debug: Log sample data structure
        if (result.length > 0 && result[0].jadwal.length > 0) {
            console.log('📊 Sample jadwal data:', result[0].jadwal[0]);
            if (result[0].jadwal[0].siswa_tidak_hadir && result[0].jadwal[0].siswa_tidak_hadir.length > 0) {
                console.log('👥 Sample siswa tidak hadir:', result[0].jadwal[0].siswa_tidak_hadir[0]);
            }
        }

        res.json(result);

    } catch (error) {
        console.error('❌ Error getting riwayat kehadiran:', error);
        res.status(500).json({ error: 'Gagal memuat riwayat kehadiran' });
    }
});

// ====================
// ADMIN DASHBOARD ENDPOINTS
// ====================

// Get teachers for admin dashboard
app.get('/api/admin/teachers', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📋 Getting teachers for admin dashboard');

        const query = `
            SELECT 
                g.id_guru as id,
                u.username, 
                g.nama, 
                g.nip,
                g.email,
                g.alamat,
                g.no_telp,
                g.jenis_kelamin,
                g.status,
                m.nama_mapel as mata_pelajaran
            FROM users u
            LEFT JOIN guru g ON u.username = g.username
            LEFT JOIN mapel m ON g.mapel_id = m.id_mapel
            WHERE u.role = 'guru'
            ORDER BY g.nama ASC
        `;

        const [results] = await global.dbPool.execute(query);
        console.log(`✅ Teachers retrieved: ${results.length} items`);
        res.json(results);
    } catch (error) {
        console.error('❌ Error getting teachers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add teacher account
app.post('/api/admin/teachers', authenticateToken, requireRole(['admin']), async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { nama, username, password } = req.body;
        console.log('➕ Adding teacher account:', { nama, username });

        if (!nama || !username || !password) {
            return res.status(400).json({ error: 'Nama, username, dan password wajib diisi' });
        }

        // Check if username already exists
        const [existingUsers] = await global.dbPool.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Username sudah digunakan' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Start transaction
        await connection.beginTransaction();

        try {
            // Insert user account
            const [userResult] = await global.dbPool.execute(
                'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                [username, hashedPassword, 'guru']
            );

            // Insert guru data with generated NIP
            const nip = `G${Date.now().toString().slice(-8)}`; // Generate simple NIP
            await global.dbPool.execute(
                'INSERT INTO guru (nip, nama, username, jenis_kelamin, status) VALUES (?, ?, ?, ?, ?)',
                [nip, nama, username, 'L', 'aktif']
            );

            await connection.commit();
            console.log('✅ Teacher account added successfully');
            res.json({ message: 'Akun guru berhasil ditambahkan' });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('❌ Error adding teacher:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
});

// Update teacher account
app.put('/api/admin/teachers/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { id } = req.params;
        const { nama, username, password } = req.body;
        console.log('📝 Updating teacher account:', { id, nama, username });

        if (!nama || !username) {
            return res.status(400).json({ error: 'Nama dan username wajib diisi' });
        }

        // Check if username already exists (excluding current user)
        const [existingUsers] = await global.dbPool.execute(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [username, id]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Username sudah digunakan' });
        }

        await connection.beginTransaction();

        try {
            // Get current username
            const [currentUser] = await global.dbPool.execute(
                'SELECT username FROM users WHERE id = ?',
                [id]
            );

            if (currentUser.length === 0) {
                return res.status(404).json({ error: 'User tidak ditemukan' });
            }

            const oldUsername = currentUser[0].username;

            // Update user account
            if (password) {
                const hashedPassword = await bcrypt.hash(password, saltRounds);
                await global.dbPool.execute(
                    'UPDATE users SET username = ?, password = ? WHERE id = ?',
                    [username, hashedPassword, id]
                );
            } else {
                await global.dbPool.execute(
                    'UPDATE users SET username = ? WHERE id = ?',
                    [username, id]
                );
            }

            // Update guru data
            await global.dbPool.execute(
                'UPDATE guru SET nama = ?, username = ? WHERE username = ?',
                [nama, username, oldUsername]
            );

            await connection.commit();
            console.log('✅ Teacher account updated successfully');
            res.json({ message: 'Akun guru berhasil diupdate' });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('❌ Error updating teacher:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
});

// Delete teacher account
app.delete('/api/admin/teachers/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { id } = req.params;
        console.log('🗑️ Deleting teacher account:', { id });

        await connection.beginTransaction();

        try {
            // Get username first
            const [userResult] = await global.dbPool.execute(
                'SELECT username FROM users WHERE id = ?',
                [id]
            );

            if (userResult.length === 0) {
                return res.status(404).json({ error: 'User tidak ditemukan' });
            }

            const username = userResult[0].username;

            // Delete from guru table first (foreign key constraint)
            await global.dbPool.execute(
                'DELETE FROM guru WHERE username = ?',
                [username]
            );

            // Delete from users table
            await global.dbPool.execute(
                'DELETE FROM users WHERE id = ?',
                [id]
            );

            await connection.commit();
            console.log('✅ Teacher account deleted successfully');
            res.json({ message: 'Akun guru berhasil dihapus' });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('❌ Error deleting teacher:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
});

// === TEACHER DATA ENDPOINTS ===

// Get teachers data for admin dashboard
app.get('/api/admin/teachers-data', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📋 Getting teachers data for admin dashboard');

        const query = `
            SELECT g.id, g.nip, g.nama, g.email, g.mata_pelajaran, 
                   g.alamat, g.no_telp as telepon, g.jenis_kelamin, 
                   COALESCE(g.status, 'aktif') as status
            FROM guru g
            ORDER BY g.nama ASC
        `;

        const [results] = await global.dbPool.execute(query);
        console.log(`✅ Teachers data retrieved: ${results.length} items`);
        res.json(results);
    } catch (error) {
        console.error('❌ Error getting teachers data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add teacher data
app.post('/api/admin/teachers-data', authenticateToken, requireRole(['admin']), async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { nip, nama, email, mata_pelajaran, alamat, telepon, jenis_kelamin, status } = req.body;
        console.log('➕ Adding teacher data:', { nip, nama, mata_pelajaran });

        if (!nip || !nama || !jenis_kelamin) {
            return res.status(400).json({ error: 'NIP, nama, dan jenis kelamin wajib diisi' });
        }

        // Check if NIP already exists
        const [existing] = await global.dbPool.execute(
            'SELECT id FROM guru WHERE nip = ?',
            [nip]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'NIP sudah terdaftar' });
        }

        // Start transaction
        await connection.beginTransaction();

        try {
            // Create a dummy user account for data-only records
            const dummyUsername = `guru_${nip}_${Date.now()}`;
            const dummyPassword = await bcrypt.hash('dummy123', saltRounds);

            const [userResult] = await global.dbPool.execute(
                'INSERT INTO users (username, password, role, nama, status) VALUES (?, ?, ?, ?, ?)',
                [dummyUsername, dummyPassword, 'guru', nama, 'aktif']
            );

            // Insert guru data with user_id
            const query = `
                INSERT INTO guru (id_guru, user_id, username, nip, nama, email, mata_pelajaran, alamat, no_telp, jenis_kelamin, status)
                VALUES ((SELECT COALESCE(MAX(id_guru), 0) + 1 FROM guru g2), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const [result] = await global.dbPool.execute(query, [
                userResult.insertId, dummyUsername, nip, nama, email || null, mata_pelajaran || null,
                alamat || null, telepon || null, jenis_kelamin, status || 'aktif'
            ]);

            await connection.commit();
            console.log('✅ Teacher data added successfully:', result.insertId);
            res.json({ message: 'Data guru berhasil ditambahkan', id: result.insertId });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('❌ Error adding teacher data:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'NIP sudah terdaftar' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    } finally {
        connection.release();
    }
});

// Update teacher data
app.put('/api/admin/teachers-data/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { id } = req.params;
        const { nip, nama, email, mata_pelajaran, alamat, telepon, jenis_kelamin, status } = req.body;
        console.log('📝 Updating teacher data:', { id, nip, nama });

        if (!nip || !nama || !jenis_kelamin) {
            return res.status(400).json({ error: 'NIP, nama, dan jenis kelamin wajib diisi' });
        }

        // Check if NIP already exists for other records
        const [existing] = await global.dbPool.execute(
            'SELECT id FROM guru WHERE nip = ? AND id != ?',
            [nip, id]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'NIP sudah digunakan oleh guru lain' });
        }

        await connection.beginTransaction();

        try {
            // Update user account name if it exists
            const [guruData] = await global.dbPool.execute(
                'SELECT user_id FROM guru WHERE id = ?',
                [id]
            );

            if (guruData.length > 0 && guruData[0].user_id) {
                await global.dbPool.execute(
                    'UPDATE users SET nama = ? WHERE id = ?',
                    [nama, guruData[0].user_id]
                );
            }

            // Update guru data
            const updateQuery = `
                UPDATE guru 
                SET nip = ?, nama = ?, email = ?, mata_pelajaran = ?, 
                    alamat = ?, no_telp = ?, jenis_kelamin = ?, status = ?
                WHERE id = ?
            `;

            const [result] = await global.dbPool.execute(updateQuery, [
                nip, nama, email || null, mata_pelajaran || null,
                alamat || null, telepon || null, jenis_kelamin, status || 'aktif', id
            ]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Data guru tidak ditemukan' });
            }

            await connection.commit();
            console.log('✅ Teacher data updated successfully');
            res.json({ message: 'Data guru berhasil diupdate' });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('❌ Error updating teacher data:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
});

// Delete teacher data
app.delete('/api/admin/teachers-data/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { id } = req.params;
        console.log('🗑️ Deleting teacher data:', { id });

        await connection.beginTransaction();

        try {
            // Get user_id first
            const [guruData] = await global.dbPool.execute(
                'SELECT user_id FROM guru WHERE id = ?',
                [id]
            );

            if (guruData.length === 0) {
                return res.status(404).json({ error: 'Data guru tidak ditemukan' });
            }

            // Delete guru data first (foreign key constraint)
            const [result] = await global.dbPool.execute(
                'DELETE FROM guru WHERE id = ?',
                [id]
            );

            // Delete user account if it exists
            if (guruData[0].user_id) {
                await global.dbPool.execute(
                    'DELETE FROM users WHERE id = ?',
                    [guruData[0].user_id]
                );
            }

            await connection.commit();
            console.log('✅ Teacher data deleted successfully');
            res.json({ message: 'Data guru berhasil dihapus' });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('❌ Error deleting teacher data:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
});

// Get students for admin dashboard
app.get('/api/admin/students', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📋 Getting students for admin dashboard');

        const query = `
            SELECT 
                u.id as user_id,
                u.username, 
                u.email,
                s.id,
                s.nis, 
                s.nama, 
                s.kelas_id, 
                k.nama_kelas,
                s.jenis_kelamin,
                s.jabatan,
                s.status,
                s.alamat,
                s.telepon_orangtua,
                s.nomor_telepon_siswa
            FROM users u
            JOIN siswa s ON u.id = s.user_id
            LEFT JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE u.role = 'siswa'
            ORDER BY s.nama ASC
        `;

        const [results] = await global.dbPool.execute(query);
        console.log(`✅ Students retrieved: ${results.length} items`);
        res.json(results);
    } catch (error) {
        console.error('❌ Error getting students:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add student account
app.post('/api/admin/students', authenticateToken, requireRole(['admin']), async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { nis, nama, username, password, email, kelas_id, jenis_kelamin, jabatan, telepon_orangtua, nomor_telepon_siswa, alamat, status } = req.body;
        console.log('➕ Adding student account:', { nis, nama, username });

        // Validasi input
        const validation = await validateSiswaPayload(req.body, { isUpdate: false });
        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Validasi gagal',
                details: validation.errors
            });
        }

        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Password wajib diisi minimal 6 karakter' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Start transaction
        await connection.beginTransaction();

        try {
            // Insert user account
            const [userResult] = await global.dbPool.execute(
                'INSERT INTO users (username, password, role, email, nama, status) VALUES (?, ?, ?, ?, ?, ?)',
                [username, hashedPassword, 'siswa', email || null, nama, 'aktif']
            );

            const userId = userResult.insertId;

            // Get next id_siswa
            const [maxIdResult] = await global.dbPool.execute(
                'SELECT COALESCE(MAX(id_siswa), 0) + 1 as next_id FROM siswa'
            );
            const nextIdSiswa = maxIdResult[0].next_id;

            // Insert siswa data
            await global.dbPool.execute(
                'INSERT INTO siswa (id, id_siswa, user_id, username, nis, nama, kelas_id, jenis_kelamin, jabatan, telepon_orangtua, nomor_telepon_siswa, alamat, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [nextIdSiswa, nextIdSiswa, userId, username, nis, nama, kelas_id, jenis_kelamin, jabatan || 'Siswa', telepon_orangtua || null, nomor_telepon_siswa || null, alamat || null, status || 'aktif']
            );

            await connection.commit();
            console.log('✅ Student account added successfully');
            res.json({
                message: 'Akun siswa berhasil ditambahkan',
                id: nextIdSiswa,
                userId: userId
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('❌ Error adding student:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'NIS atau username sudah terdaftar' });
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            res.status(400).json({ error: 'Kelas tidak ditemukan' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    } finally {
        connection.release();
    }
});

// Update student account
app.put('/api/admin/students/:nis', authenticateToken, requireRole(['admin']), async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { nis } = req.params;
        const { nama, username, password, email, kelas_id, jenis_kelamin, jabatan, telepon_orangtua, nomor_telepon_siswa, alamat, status } = req.body;
        console.log('📝 Updating student account:', { nis, nama, username });

        // Cari siswa berdasarkan NIS
        const [studentData] = await global.dbPool.execute(
            'SELECT s.id, s.user_id, u.username as current_username FROM siswa s JOIN users u ON s.user_id = u.id WHERE s.nis = ?',
            [nis]
        );

        if (studentData.length === 0) {
            return res.status(404).json({ error: 'Siswa dengan NIS tersebut tidak ditemukan' });
        }

        const { id: studentId, user_id, current_username } = studentData[0];

        // Validasi input
        const validation = await validateSiswaPayload(req.body, {
            isUpdate: true,
            excludeStudentId: studentId,
            excludeUserId: user_id
        });
        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Validasi gagal',
                details: validation.errors
            });
        }

        await connection.beginTransaction();

        try {
            // Update user account
            if (password && password.length >= 6) {
                const hashedPassword = await bcrypt.hash(password, saltRounds);
                await global.dbPool.execute(
                    'UPDATE users SET username = ?, password = ?, email = ?, nama = ? WHERE id = ?',
                    [username, hashedPassword, email || null, nama, user_id]
                );
            } else {
                await global.dbPool.execute(
                    'UPDATE users SET username = ?, email = ?, nama = ? WHERE id = ?',
                    [username, email || null, nama, user_id]
                );
            }

            // Update siswa data
            await global.dbPool.execute(
                'UPDATE siswa SET nama = ?, username = ?, nis = ?, kelas_id = ?, jenis_kelamin = ?, jabatan = ?, telepon_orangtua = ?, nomor_telepon_siswa = ?, alamat = ?, status = ? WHERE id = ?',
                [nama, username, nis, kelas_id, jenis_kelamin, jabatan || 'Siswa', telepon_orangtua || null, nomor_telepon_siswa || null, alamat || null, status || 'aktif', studentId]
            );

            await connection.commit();
            console.log('✅ Student account updated successfully');
            res.json({ message: 'Akun siswa berhasil diupdate' });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('❌ Error updating student:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'Username atau email sudah digunakan' });
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            res.status(400).json({ error: 'Kelas tidak ditemukan' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    } finally {
        connection.release();
    }
});

// Delete student account
app.delete('/api/admin/students/:nis', authenticateToken, requireRole(['admin']), async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { nis } = req.params;
        console.log('🗑️ Deleting student account:', { nis });

        await connection.beginTransaction();

        try {
            // Cari data siswa berdasarkan NIS
            const [studentData] = await global.dbPool.execute(
                'SELECT s.id, s.user_id, s.id_siswa FROM siswa s WHERE s.nis = ?',
                [nis]
            );

            if (studentData.length === 0) {
                return res.status(404).json({ error: 'Siswa dengan NIS tersebut tidak ditemukan' });
            }

            const { id: studentId, user_id, id_siswa } = studentData[0];

            // Hapus data absensi siswa terkait (opsional)
            await global.dbPool.execute(
                'DELETE FROM absensi_siswa WHERE siswa_id = ?',
                [id_siswa]
            );

            // Hapus dari siswa table
            await global.dbPool.execute(
                'DELETE FROM siswa WHERE id = ?',
                [studentId]
            );

            // Hapus dari users table
            await global.dbPool.execute(
                'DELETE FROM users WHERE id = ?',
                [user_id]
            );

            await connection.commit();
            console.log('✅ Student account deleted successfully');
            res.json({ message: 'Akun siswa berhasil dihapus' });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('❌ Error deleting student:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
});

// === STUDENT DATA ENDPOINTS ===

// Get students by class for presensi
app.get('/api/admin/students-by-class/:kelasId', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { kelasId } = req.params;
        console.log('📋 Getting students by class for presensi:', kelasId);

        const query = `
            SELECT s.id_siswa as id, s.nis, s.nama, s.jenis_kelamin, s.kelas_id
            FROM siswa s
            WHERE s.kelas_id = ? AND s.status = 'aktif'
            ORDER BY s.nama ASC
        `;

        const [rows] = await global.dbPool.execute(query, [kelasId]);

        console.log(`✅ Found ${rows.length} students for class ${kelasId}`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting students by class:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get presensi data for students
app.get('/api/admin/presensi-siswa', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { kelas_id, bulan, tahun } = req.query;
        console.log('📋 Getting presensi data:', { kelas_id, bulan, tahun });

        if (!kelas_id || !bulan || !tahun) {
            return res.status(400).json({ error: 'kelas_id, bulan, dan tahun harus diisi' });
        }

        const query = `
            SELECT 
                a.siswa_id,
                DATE(a.tanggal) as tanggal,
                a.status,
                a.keterangan
            FROM absensi_siswa a
            INNER JOIN siswa s ON a.siswa_id = s.id_siswa
            WHERE s.kelas_id = ? 
                AND MONTH(a.tanggal) = ? 
                AND YEAR(a.tanggal) = ?
            ORDER BY a.siswa_id, a.tanggal
        `;

        const [rows] = await global.dbPool.execute(query, [kelas_id, bulan, tahun]);

        console.log(`✅ Found ${rows.length} presensi records`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting presensi data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get rekap ketidakhadiran data
app.get('/api/admin/rekap-ketidakhadiran', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { kelas_id, tahun, bulan } = req.query;
        console.log('📋 Getting rekap ketidakhadiran data:', { kelas_id, tahun, bulan });

        if (!kelas_id || !tahun) {
            return res.status(400).json({ error: 'kelas_id dan tahun harus diisi' });
        }

        let query = `
            SELECT 
                a.siswa_id,
                MONTH(a.tanggal) as bulan,
                YEAR(a.tanggal) as tahun,
                COUNT(CASE WHEN a.status IN ('Sakit', 'Alpa', 'Izin') THEN 1 END) as total_ketidakhadiran,
                COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as total_kehadiran,
                COUNT(*) as total_hari_efektif,
                ROUND(
                    (COUNT(CASE WHEN a.status IN ('Sakit', 'Alpa', 'Izin') THEN 1 END) * 100.0 / COUNT(*)), 2
                ) as persentase_ketidakhadiran,
                ROUND(
                    (COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) * 100.0 / COUNT(*)), 2
                ) as persentase_kehadiran
            FROM absensi_siswa a
            INNER JOIN siswa s ON a.siswa_id = s.id_siswa
            WHERE s.kelas_id = ? 
                AND YEAR(a.tanggal) = ?
        `;

        const params = [kelas_id, tahun];

        if (bulan) {
            query += ` AND MONTH(a.tanggal) = ?`;
            params.push(bulan);
        }

        query += `
            GROUP BY a.siswa_id, MONTH(a.tanggal), YEAR(a.tanggal)
            ORDER BY a.siswa_id, MONTH(a.tanggal)
        `;

        const [rows] = await global.dbPool.execute(query, params);

        console.log(`✅ Found ${rows.length} rekap ketidakhadiran records`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting rekap ketidakhadiran data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get rekap ketidakhadiran guru
app.get('/api/admin/rekap-ketidakhadiran-guru', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { tahun, bulan, tanggal_awal, tanggal_akhir } = req.query;
        console.log('📋 Getting rekap ketidakhadiran guru data:', { tahun, bulan, tanggal_awal, tanggal_akhir });

        if (!tahun) {
            return res.status(400).json({ error: 'Tahun harus diisi' });
        }

        // Query untuk mendapatkan data guru dan presensi
        const query = `
            SELECT 
                g.id_guru as id,
                COALESCE(g.nama, 'Sistem') as nama_guru,
                g.nip,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 7 THEN 1 ELSE 0 END), 0) as jul,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 8 THEN 1 ELSE 0 END), 0) as agt,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 9 THEN 1 ELSE 0 END), 0) as sep,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 10 THEN 1 ELSE 0 END), 0) as okt,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 11 THEN 1 ELSE 0 END), 0) as nov,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 12 THEN 1 ELSE 0 END), 0) as des,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 1 THEN 1 ELSE 0 END), 0) as jan,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 2 THEN 1 ELSE 0 END), 0) as feb,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 3 THEN 1 ELSE 0 END), 0) as mar,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 4 THEN 1 ELSE 0 END), 0) as apr,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 5 THEN 1 ELSE 0 END), 0) as mei,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 6 THEN 1 ELSE 0 END), 0) as jun,
                COALESCE(SUM(CASE WHEN a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) as total_ketidakhadiran,
                COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END), 0) as total_kehadiran,
                COALESCE(COUNT(a.id_absensi), 0) as total_hari_efektif,
                CASE 
                    WHEN COUNT(a.id_absensi) = 0 THEN 0
                    ELSE ROUND((SUM(CASE WHEN a.status = 'Tidak Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id_absensi)), 2)
                END as persentase_ketidakhadiran,
                CASE 
                    WHEN COUNT(a.id_absensi) = 0 THEN 0
                    ELSE ROUND((SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id_absensi)), 2)
                END as persentase_kehadiran
            FROM guru g
            LEFT JOIN absensi_guru a ON g.id_guru = a.guru_id 
                AND YEAR(a.tanggal) = ?
            GROUP BY g.id_guru, g.nama, g.nip
            ORDER BY g.nama
        `;

        const [rows] = await global.dbPool.execute(query, [tahun]);

        // Data sudah memiliki persentase dari query, langsung return
        console.log(`✅ Found ${rows.length} rekap ketidakhadiran guru records`);
        res.json(rows);

    } catch (error) {
        console.error('❌ Error getting rekap ketidakhadiran guru data:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan saat mengambil data rekap ketidakhadiran guru'
        });
    }
});

// Get students data for admin dashboard
app.get('/api/admin/students-data', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📋 Getting students data for admin dashboard');

        const query = `
            SELECT 
                s.id_siswa as id_siswa,
                s.id,
                s.nis, 
                s.nama, 
                s.kelas_id, 
                k.nama_kelas,
                s.jenis_kelamin,
                s.alamat,
                s.telepon_orangtua,
                s.nomor_telepon_siswa,
                COALESCE(s.status, 'aktif') as status
            FROM siswa s
            LEFT JOIN kelas k ON s.kelas_id = k.id_kelas
            ORDER BY s.nama ASC
        `;

        const [results] = await global.dbPool.execute(query);
        console.log(`✅ Students data retrieved: ${results.length} items`);
        res.json(results);
    } catch (error) {
        console.error('❌ Error getting students data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get students data for admin dashboard (duplicate removed - using first implementation)

// Add student data
app.post('/api/admin/students-data', authenticateToken, requireRole(['admin']), async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { nis, nama, kelas_id, jenis_kelamin, alamat, telepon_orangtua, nomor_telepon_siswa, status } = req.body;
        console.log('➕ Adding student data:', { nis, nama, kelas_id });

        if (!nis || !nama || !kelas_id || !jenis_kelamin) {
            return res.status(400).json({ error: 'NIS, nama, kelas, dan jenis kelamin wajib diisi' });
        }

        // Start transaction
        await connection.beginTransaction();

        // Check if NIS already exists
        const [existing] = await connection.execute(
            'SELECT id FROM siswa WHERE nis = ?',
            [nis]
        );

        if (existing.length > 0) {
            await connection.rollback();
            return res.status(409).json({ error: 'NIS sudah terdaftar' });
        }

        // Generate username from NIS
        const username = `siswa_${nis}`;
        const email = `${nis}@student.absenta.com`;

        // First, insert into users table
        const createdAtWIB = getMySQLDateTimeWIB();
        const dummyPassword = await bcrypt.hash('Siswa123!', saltRounds);

        const userInsertQuery = `
            INSERT INTO users (username, password, email, role, nama, status, created_at)
            VALUES (?, ?, ?, 'siswa', ?, 'aktif', ?)
        `;

        const [userResult] = await connection.execute(userInsertQuery, [
            username, dummyPassword, email, nama, createdAtWIB // nama will be used for the nama field
        ]);

        const userId = userResult.insertId;
        console.log('✅ User created with ID:', userId);

        // Get next id_siswa
        const [maxIdResult] = await connection.execute(
            'SELECT COALESCE(MAX(id_siswa), 0) + 1 as next_id FROM siswa'
        );
        const nextIdSiswa = maxIdResult[0].next_id;

        // Then, insert into siswa table
        const studentInsertQuery = `
            INSERT INTO siswa (id, id_siswa, user_id, username, nis, nama, kelas_id, jenis_kelamin, alamat, telepon_orangtua, nomor_telepon_siswa, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [studentResult] = await connection.execute(studentInsertQuery, [
            nextIdSiswa, // id (primary key)
            nextIdSiswa, // id_siswa
            userId,      // user_id (foreign key)
            username,    // username
            nis,         // nis
            nama,        // nama
            kelas_id,    // kelas_id
            jenis_kelamin, // jenis_kelamin
            alamat || null, // alamat
            telepon_orangtua || null, // telepon_orangtua
            nomor_telepon_siswa || null, // nomor_telepon_siswa
            status || 'aktif', // status
            createdAtWIB // created_at
        ]);

        // Commit transaction
        await connection.commit();

        console.log('✅ Student data added successfully:', studentResult.insertId);
        res.json({
            message: 'Data siswa berhasil ditambahkan',
            id: studentResult.insertId,
            userId: userId,
            username: username
        });
    } catch (error) {
        // Rollback transaction on error
        await connection.rollback();
        console.error('❌ Error adding student data:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'NIS atau username sudah terdaftar' });
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            res.status(400).json({ error: 'Kelas tidak ditemukan' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    } finally {
        connection.release();
    }
});

// Update student data
app.put('/api/admin/students-data/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { id } = req.params;
        const { nis, nama, kelas_id, jenis_kelamin, alamat, telepon_orangtua, status, nomor_telepon_siswa } = req.body;
        console.log('📝 Updating student data:', { id, nis, nama });

        if (!nis || !nama || !kelas_id || !jenis_kelamin) {
            return res.status(400).json({ error: 'NIS, nama, kelas, dan jenis kelamin wajib diisi' });
        }

        // Validasi nomor telepon jika diisi
        if (nomor_telepon_siswa && !/^[0-9]{10,15}$/.test(nomor_telepon_siswa)) {
            return res.status(400).json({ error: 'Nomor telepon harus berupa angka 10-15 digit' });
        }

        // Cek unik nomor telepon jika diisi
        if (nomor_telepon_siswa) {
            const [existingPhone] = await connection.execute(
                'SELECT id FROM siswa WHERE nomor_telepon_siswa = ? AND id != ?',
                [nomor_telepon_siswa, id]
            );
            if (existingPhone.length > 0) {
                return res.status(400).json({ error: 'Nomor telepon siswa sudah digunakan' });
            }
        }

        // Start transaction
        await connection.beginTransaction();

        // Check if student exists
        const [studentExists] = await connection.execute(
            'SELECT user_id, username FROM siswa WHERE id = ?',
            [id]
        );

        if (studentExists.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Data siswa tidak ditemukan' });
        }

        // Check if NIS already exists for other records
        const [existing] = await connection.execute(
            'SELECT id FROM siswa WHERE nis = ? AND id != ?',
            [nis, id]
        );

        if (existing.length > 0) {
            await connection.rollback();
            return res.status(409).json({ error: 'NIS sudah digunakan oleh siswa lain' });
        }

        // Update siswa table
        // FIX: Use WIB timezone for updated_at
        const updatedAtWIB = getMySQLDateTimeWIB();
        const updateQuery = `
            UPDATE siswa 
            SET nis = ?, nama = ?, kelas_id = ?, jenis_kelamin = ?, 
                alamat = ?, telepon_orangtua = ?, nomor_telepon_siswa = ?, status = ?, updated_at = ?
            WHERE id = ?
        `;

        const [result] = await connection.execute(updateQuery, [
            nis, nama, kelas_id, jenis_kelamin,
            alamat || null, telepon_orangtua || null, nomor_telepon_siswa || null, status || 'aktif', updatedAtWIB, id
        ]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Data siswa tidak ditemukan' });
        }

        // Update users table with nama (since siswa is a view)
        await connection.execute(
            'UPDATE users SET nama = ?, updated_at = ? WHERE id = ?',
            [nama, updatedAtWIB, studentExists[0].user_id]
        );

        // Commit transaction
        await connection.commit();

        console.log('✅ Student data updated successfully');
        res.json({ message: 'Data siswa berhasil diupdate' });
    } catch (error) {
        // Rollback transaction on error
        await connection.rollback();
        console.error('❌ Error updating student data:', error);

        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            res.status(400).json({ error: 'Kelas tidak ditemukan' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    } finally {
        connection.release();
    }
});

// Delete student data
app.delete('/api/admin/students-data/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { id } = req.params;
        console.log('🗑️ Deleting student data:', { id });

        // Start transaction
        await connection.beginTransaction();

        // Get user_id before deleting
        const [studentData] = await connection.execute(
            'SELECT user_id FROM siswa WHERE id = ?',
            [id]
        );

        if (studentData.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Data siswa tidak ditemukan' });
        }

        const userId = studentData[0].user_id;

        // Delete from siswa first (due to foreign key constraint)
        const [studentResult] = await connection.execute(
            'DELETE FROM siswa WHERE id = ?',
            [id]
        );

        if (studentResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Data siswa tidak ditemukan' });
        }

        // Delete from users table (CASCADE should handle this, but let's be explicit)
        await connection.execute(
            'DELETE FROM users WHERE id = ?',
            [userId]
        );

        // Commit transaction
        await connection.commit();

        console.log('✅ Student data deleted successfully');
        res.json({ message: 'Data siswa berhasil dihapus' });
    } catch (error) {
        // Rollback transaction on error
        await connection.rollback();
        console.error('❌ Error deleting student data:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
});

// Student promotion (naik kelas) endpoint
app.post('/api/admin/student-promotion', authenticateToken, requireRole(['admin']), async (req, res) => {
    const connection = await global.dbPool.getConnection();

    try {
        const { fromClassId, toClassId, studentIds } = req.body;
        console.log('🎓 Student promotion request:', { fromClassId, toClassId, studentIds });

        // Validasi input yang lebih ketat
        if (!fromClassId || !toClassId || !studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({
                error: 'fromClassId, toClassId, dan studentIds wajib diisi',
                details: 'studentIds harus berupa array yang tidak kosong'
            });
        }

        // Validasi tipe data
        if (typeof fromClassId !== 'string' && typeof fromClassId !== 'number') {
            return res.status(400).json({ error: 'fromClassId harus berupa string atau number' });
        }
        if (typeof toClassId !== 'string' && typeof toClassId !== 'number') {
            return res.status(400).json({ error: 'toClassId harus berupa string atau number' });
        }
        if (!studentIds.every(id => typeof id === 'number' && Number.isInteger(id) && id > 0)) {
            return res.status(400).json({ error: 'Semua studentIds harus berupa integer positif' });
        }

        // Start transaction
        await connection.beginTransaction();

        // Verify classes exist and get detailed info
        const [fromClass] = await connection.execute(
            'SELECT id_kelas, nama_kelas, tingkat FROM kelas WHERE id_kelas = ? AND status = "aktif"',
            [fromClassId]
        );

        const [toClass] = await connection.execute(
            'SELECT id_kelas, nama_kelas, tingkat FROM kelas WHERE id_kelas = ? AND status = "aktif"',
            [toClassId]
        );

        if (fromClass.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Kelas asal tidak ditemukan atau tidak aktif' });
        }

        if (toClass.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Kelas tujuan tidak ditemukan atau tidak aktif' });
        }

        // Validasi aturan bisnis: kelas XII tidak bisa dinaikkan
        if (fromClass[0].tingkat === 'XII') {
            await connection.rollback();
            return res.status(400).json({
                error: 'Kelas XII tidak dapat dinaikkan',
                details: 'Siswa kelas XII sudah lulus dan tidak dapat dipromosikan'
            });
        }

        // Validasi tingkat promosi (X->XI, XI->XII)
        const validPromotions = {
            'X': 'XI',
            'XI': 'XII'
        };

        if (validPromotions[fromClass[0].tingkat] !== toClass[0].tingkat) {
            await connection.rollback();
            return res.status(400).json({
                error: 'Promosi tidak valid',
                details: `Kelas ${fromClass[0].tingkat} hanya bisa dinaikkan ke kelas ${validPromotions[fromClass[0].tingkat]}`
            });
        }

        // Verify students exist and belong to fromClass
        const placeholders = studentIds.map(() => '?').join(',');
        const [students] = await connection.execute(
            `SELECT id_siswa, nama, nis, kelas_id FROM siswa 
             WHERE id_siswa IN (${placeholders}) AND kelas_id = ? AND status = 'aktif'`,
            [...studentIds, fromClassId]
        );

        if (students.length !== studentIds.length) {
            await connection.rollback();
            return res.status(400).json({
                error: 'Beberapa siswa tidak ditemukan atau tidak berada di kelas asal',
                details: `Ditemukan ${students.length} siswa dari ${studentIds.length} yang diminta`
            });
        }

        // Update students' class dalam satu transaksi
        // FIX: Use WIB timezone for updated_at
        const updatedAtWIB = getMySQLDateTimeWIB();
        const updateQuery = `
            UPDATE siswa 
            SET kelas_id = ?, updated_at = ?
            WHERE id_siswa IN (${placeholders})
        `;

        const [updateResult] = await connection.execute(updateQuery, [toClassId, updatedAtWIB, ...studentIds]);

        // Verifikasi update berhasil
        if (updateResult.affectedRows !== studentIds.length) {
            await connection.rollback();
            return res.status(500).json({
                error: 'Gagal mengupdate semua siswa',
                details: `Hanya ${updateResult.affectedRows} dari ${studentIds.length} siswa yang berhasil diupdate`
            });
        }

        // Log the promotion for audit trail (dengan error handling yang aman)
        const promotedAtWIB = getMySQLDateTimeWIB();
        const logQuery = `
            INSERT INTO promotion_log (from_class_id, to_class_id, student_ids, promoted_at, admin_user_id)
            VALUES (?, ?, ?, ?, ?)
        `;

        try {
            await connection.execute(logQuery, [
                fromClassId,
                toClassId,
                JSON.stringify(studentIds),
                promotedAtWIB,
                req.user?.id || 1
            ]);
            console.log('✅ Promotion logged successfully');
        } catch (logError) {
            // Log table might not exist, continue without logging
            console.log('⚠️ Promotion log table not found, skipping audit log:', logError.message);
        }

        // Commit transaction
        await connection.commit();

        console.log(`✅ Successfully promoted ${students.length} students from ${fromClass[0].nama_kelas} to ${toClass[0].nama_kelas}`);
        res.json({
            success: true,
            message: `${students.length} siswa berhasil dinaikkan dari ${fromClass[0].nama_kelas} ke ${toClass[0].nama_kelas}`,
            promotedCount: students.length,
            fromClass: fromClass[0].nama_kelas,
            toClass: toClass[0].nama_kelas,
            studentIds: studentIds
        });

    } catch (error) {
        // Rollback transaction on error
        await connection.rollback();
        console.error('❌ Error promoting students:', error);

        // Error handling yang lebih spesifik
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'Konflik data: siswa mungkin sudah ada di kelas tujuan' });
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            res.status(400).json({ error: 'Referensi kelas tidak valid' });
        } else {
            res.status(500).json({
                error: 'Internal server error',
                details: process.env.NODE_ENV === 'development' ? error.message : 'Terjadi kesalahan pada server'
            });
        }
    } finally {
        connection.release();
    }
});

// Get live summary for admin dashboard
app.get('/api/admin/live-summary', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📊 Getting live summary for admin dashboard');

        // Get current day and time
        const now = getWIBTime();
        const currentTime = now.toLocaleTimeString('id-ID', { hour12: false }); // HH:mm:ss format
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const currentDay = days[now.getDay()];
        const todayWIB = getMySQLDateWIB();

        // Get ongoing classes (classes that are currently happening)
        const ongoingQuery = `
            SELECT 
                j.id_jadwal,
                j.jam_mulai, 
                j.jam_selesai,
                k.nama_kelas,
                m.nama_mapel,
                COALESCE(g.nama, 'Sistem') as nama_guru,
                COUNT(ag.id_absensi) as absensi_diambil
            FROM jadwal j
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel  
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN absensi_guru ag ON j.id_jadwal = ag.jadwal_id AND DATE(ag.tanggal) = ?
            WHERE j.hari = ? 
            AND TIME(?) BETWEEN j.jam_mulai AND j.jam_selesai
            GROUP BY j.id_jadwal, j.jam_mulai, j.jam_selesai, k.nama_kelas, m.nama_mapel, g.nama
            ORDER BY j.jam_mulai
        `;

        const [ongoingClasses] = await global.dbPool.execute(ongoingQuery, [todayWIB, currentDay, currentTime]);

        // Calculate overall attendance percentage for today
        const attendanceQuery = `
            SELECT 
                COUNT(DISTINCT j.id_jadwal) as total_jadwal_today,
                COUNT(DISTINCT ag.jadwal_id) as jadwal_with_attendance
            FROM jadwal j
            LEFT JOIN absensi_guru ag ON j.id_jadwal = ag.jadwal_id AND DATE(ag.tanggal) = ?  
            WHERE j.hari = ?
        `;

        const [attendanceResult] = await global.dbPool.execute(attendanceQuery, [todayWIB, currentDay]);
        const attendanceStats = attendanceResult[0];

        const attendancePercentage = attendanceStats.total_jadwal_today > 0
            ? Math.round((attendanceStats.jadwal_with_attendance / attendanceStats.total_jadwal_today) * 100)
            : 0;

        // Format ongoing classes data
        const formattedOngoingClasses = ongoingClasses.map(kelas => ({
            kelas: kelas.nama_kelas,
            guru: kelas.nama_guru,
            mapel: kelas.nama_mapel,
            jam: `${kelas.jam_mulai.substring(0, 5)} - ${kelas.jam_selesai.substring(0, 5)}`,
            nama_kelas: kelas.nama_kelas,
            nama_mapel: kelas.nama_mapel,
            nama_guru: kelas.nama_guru,
            jam_mulai: kelas.jam_mulai.substring(0, 5),
            jam_selesai: kelas.jam_selesai.substring(0, 5),
            absensi_diambil: kelas.absensi_diambil
        }));

        const liveData = {
            ongoing_classes: formattedOngoingClasses,
            overall_attendance_percentage: attendancePercentage.toString()
        };

        console.log(`✅ Live summary retrieved: ${formattedOngoingClasses.length} ongoing classes, ${attendancePercentage}% attendance`);
        res.json(liveData);
    } catch (error) {
        console.error('❌ Error getting live summary:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================================
// ENDPOINTS UNTUK BANDING ABSEN
// ================================================

// ================================================
// ENDPOINTS UNTUK BANDING ABSEN
// ================================================

// Get banding absen for student
app.get('/api/siswa/:siswaId/banding-absen', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { siswaId } = req.params;
        console.log('📋 Getting banding absen for siswa:', siswaId);

        const query = `
            SELECT 
                ba.id_banding,
                ba.siswa_id,
                ba.jadwal_id,
                ba.tanggal_absen,
                ba.status_asli,
                ba.status_diajukan,
                ba.alasan_banding,
                ba.status_banding,
                ba.catatan_guru,
                ba.tanggal_pengajuan,
                ba.tanggal_keputusan,
                ba.jenis_banding,
                COALESCE(j.jam_mulai, 'Umum') as jam_mulai,
                COALESCE(j.jam_selesai, 'Umum') as jam_selesai,
                COALESCE(m.nama_mapel, 'Banding Umum') as nama_mapel,
                COALESCE(g.nama, 'Menunggu Proses') as nama_guru,
                COALESCE(k.nama_kelas, '') as nama_kelas,
                s.nama AS nama_siswa
            FROM pengajuan_banding_absen ba
            LEFT JOIN jadwal j ON ba.jadwal_id = j.id_jadwal
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru g ON ba.diproses_oleh = g.id_guru
            LEFT JOIN siswa s ON ba.siswa_id = s.id_siswa
            LEFT JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE s.kelas_id = (SELECT kelas_id FROM siswa WHERE id_siswa = ?)
            ORDER BY ba.tanggal_pengajuan DESC
        `;

        const [rows] = await global.dbPool.execute(query, [siswaId]);

        console.log(`✅ Banding absen retrieved: ${rows.length} items`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting banding absen:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Submit banding absen (single student only)
app.post('/api/siswa/:siswaId/banding-absen', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { siswaId } = req.params;
        const { jadwal_id, tanggal_absen, status_asli, status_diajukan, alasan_banding } = req.body;
        console.log('📝 Submitting banding absen:', { siswaId, jadwal_id, tanggal_absen, status_asli, status_diajukan });

        // Validation
        if (!jadwal_id || !tanggal_absen || !status_asli || !status_diajukan || !alasan_banding) {
            return res.status(400).json({ error: 'Semua field wajib diisi' });
        }

        // Reject if array of students is provided (old kelas mode)
        if (req.body.siswa_banding || Array.isArray(req.body.siswa_banding)) {
            return res.status(400).json({
                error: 'Mode kelas tidak diperbolehkan',
                message: 'Gunakan endpoint per-siswa untuk banding absen individual'
            });
        }

        if (status_asli === status_diajukan) {
            return res.status(400).json({ error: 'Status asli dan status yang diajukan tidak boleh sama' });
        }

        // Validate status values
        const validStatuses = ['hadir', 'izin', 'sakit', 'alpa', 'dispen'];
        if (!validStatuses.includes(status_asli) || !validStatuses.includes(status_diajukan)) {
            return res.status(400).json({
                error: 'Status tidak valid',
                message: `Status harus salah satu dari: ${validStatuses.join(', ')}`
            });
        }

        // Check if banding already exists for this combination (any status, not just pending)
        const [existing] = await global.dbPool.execute(
            'SELECT id_banding, status_banding FROM pengajuan_banding_absen WHERE siswa_id = ? AND jadwal_id = ? AND tanggal_absen = ?',
            [siswaId, jadwal_id, tanggal_absen]
        );

        if (existing.length > 0) {
            const existingStatus = existing[0].status_banding;
            if (existingStatus === 'pending') {
                return res.status(400).json({ error: 'Banding untuk jadwal dan tanggal ini sudah pernah diajukan dan sedang diproses' });
            } else {
                return res.status(400).json({ error: `Banding untuk jadwal dan tanggal ini sudah pernah diajukan dan ${existingStatus}` });
            }
        }

        // Insert banding absen
        const [result] = await global.dbPool.execute(
            `INSERT INTO pengajuan_banding_absen 
            (siswa_id, jadwal_id, tanggal_absen, status_asli, status_diajukan, alasan_banding, jenis_banding)
             VALUES (?, ?, ?, ?, ?, ?, 'individual')`,
            [siswaId, jadwal_id, tanggal_absen, status_asli, status_diajukan, alasan_banding]
        );

        console.log('✅ Banding absen submitted successfully');
        res.json({
            message: 'Banding absen berhasil dikirim',
            id: result.insertId
        });
    } catch (error) {
        console.error('❌ Error submitting banding absen:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Submit banding absen kelas - DEPRECATED (410 Gone)
app.post('/api/siswa/:siswaId/banding-absen-kelas', authenticateToken, requireRole(['siswa']), async (req, res) => {
    console.log('⚠️ Deprecated endpoint accessed: /api/siswa/:siswaId/banding-absen-kelas');
    res.status(410).json({
        error: 'Endpoint deprecated',
        message: 'Mode pengajuan banding absen kelas telah dinonaktifkan. Gunakan endpoint per-siswa: POST /api/siswa/:siswaId/banding-absen',
        migration_guide: 'Setiap siswa harus mengajukan banding absen secara individual'
    });
});


// Get banding absen for teacher to process
app.get('/api/guru/:guruId/banding-absen', authenticateToken, requireRole(['guru']), async (req, res) => {
    try {
        const { guruId } = req.params;
        const { page = 1, limit = 5, filter_pending = 'false' } = req.query;
        console.log('📋 Getting banding absen for guru:', guruId, 'with pagination:', { page, limit, filter_pending });

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const isFilterPending = filter_pending === 'true';

        // Base query
        let baseQuery = `
            FROM pengajuan_banding_absen ba
            JOIN jadwal j ON ba.jadwal_id = j.id_jadwal
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            JOIN siswa s ON ba.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            WHERE j.guru_id = ?
        `;

        // Add filter for pending status if requested
        if (isFilterPending) {
            baseQuery += ` AND ba.status_banding = 'pending'`;
        }

        // Count total records
        const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
        const [countResult] = await global.dbPool.execute(countQuery, [guruId]);
        const totalRecords = countResult[0].total;

        // Count pending records (always count all pending, regardless of current filter)
        const pendingCountQuery = `SELECT COUNT(*) as total ${baseQuery} AND ba.status_banding = 'pending'`;
        const [pendingCountResult] = await global.dbPool.execute(pendingCountQuery, [guruId]);
        const totalPending = pendingCountResult[0].total;

        // Main query with pagination
        const mainQuery = `
            SELECT 
                ba.id_banding,
                ba.siswa_id,
                ba.jadwal_id,
                ba.tanggal_absen,
                ba.status_asli,
                ba.status_diajukan,
                ba.alasan_banding,
                ba.status_banding,
                ba.catatan_guru,
                ba.tanggal_pengajuan,
                ba.tanggal_keputusan,
                j.jam_mulai,
                j.jam_selesai,
                m.nama_mapel,
                s.nama as nama_siswa,
                s.nis,
                k.nama_kelas
            ${baseQuery}
            ORDER BY ba.tanggal_pengajuan DESC, ba.status_banding ASC
            LIMIT ? OFFSET ?
        `;

        const [rows] = await global.dbPool.execute(mainQuery, [guruId, parseInt(limit), offset]);

        const totalPages = Math.ceil(totalRecords / parseInt(limit));

        console.log(`✅ Banding absen for guru retrieved: ${rows.length} items (page ${page}/${totalPages})`);

        res.json({
            data: rows,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalRecords,
                totalPending,
                totalAll: totalRecords,
                limit: parseInt(limit)
            },
            totalPages,
            totalPending,
            totalAll: totalRecords
        });
    } catch (error) {
        console.error('❌ Error getting banding absen for guru:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get status kehadiran siswa untuk banding absen
app.get('/api/siswa/:siswaId/status-kehadiran', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { siswaId } = req.params;
        const { tanggal, jadwal_id } = req.query;

        console.log('📊 Getting status kehadiran siswa:', { siswaId, tanggal, jadwal_id });

        if (!tanggal || !jadwal_id) {
            return res.status(400).json({ error: 'Tanggal dan jadwal_id wajib diisi' });
        }

        // Query untuk mendapatkan status kehadiran siswa
        const [rows] = await global.dbPool.execute(`
            SELECT 
                a.status,
                a.keterangan,
                a.tanggal,
                COALESCE(m.nama_mapel, 'Umum') as nama_mapel,
                COALESCE(g.nama, 'Belum Ditentukan') as nama_guru
            FROM absensi_siswa a
            LEFT JOIN jadwal j ON a.jadwal_id = j.id_jadwal
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru g ON a.guru_pengabsen_id = g.id_guru
            WHERE a.siswa_id = ? 
            AND a.tanggal = ? 
            AND a.jadwal_id = ?
            ORDER BY a.tanggal DESC
            LIMIT 1
        `, [siswaId, tanggal, jadwal_id]);

        if (rows.length === 0) {
            return res.json({
                status: 'alpa',
                message: 'Tidak ada data kehadiran untuk siswa pada tanggal dan jadwal tersebut'
            });
        }

        const statusData = rows[0];
        console.log('✅ Status kehadiran siswa retrieved:', statusData);

        res.json({
            status: statusData.status || 'alpa',
            keterangan: statusData.keterangan || '',
            tanggal: statusData.tanggal,
            nama_mapel: statusData.nama_mapel,
            nama_guru: statusData.nama_guru
        });
    } catch (error) {
        console.error('❌ Error getting status kehadiran siswa:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get daftar siswa untuk banding absen
app.get('/api/siswa/:siswaId/daftar-siswa', authenticateToken, requireRole(['siswa']), async (req, res) => {
    try {
        const { siswaId } = req.params;

        console.log('📋 Getting daftar siswa untuk banding absen:', { siswaId });

        // Get siswa's class first
        const [siswaData] = await global.dbPool.execute(
            'SELECT kelas_id FROM siswa WHERE id_siswa = ? AND status = "aktif"',
            [siswaId]
        );

        if (siswaData.length === 0) {
            return res.status(404).json({ error: 'Siswa tidak ditemukan' });
        }

        const kelasId = siswaData[0].kelas_id;

        // Get all students in the same class
        const [rows] = await global.dbPool.execute(`
            SELECT 
                s.id_siswa,
                s.nama,
                s.nis,
                s.jenis_kelamin,
                k.nama_kelas,
                u.username,
                u.status as user_status
            FROM siswa s
            JOIN kelas k ON s.kelas_id = k.id_kelas
            JOIN users u ON s.user_id = u.id
            WHERE s.kelas_id = ? AND s.status = "aktif"
            ORDER BY s.nama ASC
        `, [kelasId]);

        console.log(`✅ Daftar siswa retrieved: ${rows.length} students from class ${kelasId}`);

        res.json(rows);

    } catch (error) {
        console.error('❌ Error getting daftar siswa:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Process banding absen by teacher
app.put('/api/banding-absen/:bandingId/respond', authenticateToken, requireRole(['guru']), async (req, res) => {
    try {
        const { bandingId } = req.params;
        const { status_banding, catatan_guru, diproses_oleh } = req.body;
        const guruId = diproses_oleh || req.user.guru_id || req.user.id;

        console.log('📝 Guru processing banding absen:', { bandingId, status_banding, guruId });

        // Validation
        if (!status_banding || !['disetujui', 'ditolak'].includes(status_banding)) {
            return res.status(400).json({ error: 'Status harus disetujui atau ditolak' });
        }

        // FIX: Use WIB timezone for tanggal_keputusan
        const tanggalKeputusanWIB = getMySQLDateTimeWIB();

        // Update banding absen
        const [result] = await global.dbPool.execute(
            `UPDATE pengajuan_banding_absen 
             SET status_banding = ?, catatan_guru = ?, tanggal_keputusan = ?, diproses_oleh = ?
             WHERE id_banding = ?`,
            [status_banding, catatan_guru || '', tanggalKeputusanWIB, guruId, bandingId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Banding absen tidak ditemukan' });
        }

        console.log('✅ Banding absen response submitted successfully');
        res.json({
            message: `Banding absen berhasil ${status_banding === 'disetujui' ? 'disetujui' : 'ditolak'}`,
            id: bandingId
        });
    } catch (error) {
        console.error('❌ Error responding to banding absen:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================================
// EXPORT SYSTEM INTEGRATION
// ================================================

// Import Absenta Export System
import AbsentaExportSystem from './src/utils/absentaExportSystem.js';

// Initialize export system (kept for legacy endpoints not yet migrated)
const exportSystem = new AbsentaExportSystem();

// NOTE: exportTeacherList and exportStudentSummary MIGRATED to exportController.js

// Export Ringkasan Kehadiran Guru (Format SMKN 13)
app.get('/api/export/teacher-summary', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        console.log('👨‍🏫 Exporting teacher summary...');

        const [teachers] = await global.dbPool.execute(`
            SELECT 
                g.nama,
                g.nip,
                COALESCE(SUM(CASE WHEN kg.status = 'hadir' THEN 1 ELSE 0 END), 0) as H,
                COALESCE(SUM(CASE WHEN kg.status = 'izin' THEN 1 ELSE 0 END), 0) as I,
                COALESCE(SUM(CASE WHEN kg.status = 'sakit' THEN 1 ELSE 0 END), 0) as S,
                COALESCE(SUM(CASE WHEN kg.status = 'alpa' THEN 1 ELSE 0 END), 0) as A,
                COALESCE(SUM(CASE WHEN kg.status = 'hadir' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(kg.id), 0), 0) as presentase
            FROM guru g
            LEFT JOIN kehadiran_guru kg ON g.id_guru = kg.guru_id 
                AND kg.tanggal BETWEEN ? AND ?
            WHERE g.status = 'aktif'
            GROUP BY g.id_guru, g.nama, g.nip
            ORDER BY g.nama
        `, [startDate, endDate]);

        // Import required modules
        const { buildExcel } = await import('./backend/export/excelBuilder.js');
        const { getLetterhead } = await import('./backend/utils/letterheadService.js');
        const { REPORT_KEYS } = await import('./backend/utils/letterheadService.js');
        const teacherSummarySchema = await import('./backend/export/schemas/teacher-summary.js');

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.LAPORAN_GURU });

        // Prepare data for Excel
        const reportData = teachers.map((row, index) => ({
            no: index + 1,
            nama: row.nama,
            nip: row.nip,
            hadir: row.H,
            izin: row.I,
            sakit: row.S,
            alpa: row.A,
            presentase: row.presentase / 100 // Convert to decimal for percentage format
        }));

        const reportPeriod = `${startDate} - ${endDate}`;

        // Generate Excel workbook
        const workbook = await buildExcel({
            title: teacherSummarySchema.default.title,
            subtitle: teacherSummarySchema.default.subtitle,
            reportPeriod: reportPeriod,
            letterhead: letterhead,
            columns: teacherSummarySchema.default.columns,
            rows: reportData
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Ringkasan_Kehadiran_Guru_${startDate}_${endDate}_${Date.now()}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();

        console.log(`✅ Teacher summary exported successfully: ${teachers.length} records`);
    } catch (error) {
        console.error('❌ Error exporting teacher summary:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export Banding Absen (Format SMKN 13)
app.get('/api/export/banding-absen', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, status } = req.query;
        console.log('📋 Exporting banding absen...');

        let query = `
            SELECT 
                pba.id_banding,
                DATE_FORMAT(pba.tanggal_pengajuan, '%Y-%m-%d') as tanggal_pengajuan,
                DATE_FORMAT(pba.tanggal_absen, '%Y-%m-%d') as tanggal_absen,
                s.nama as nama_pengaju,
                COALESCE(k.nama_kelas, '-') as nama_kelas,
                COALESCE(m.nama_mapel, 'Umum') as nama_mapel,
                COALESCE(g.nama, 'Belum Ditentukan') as nama_guru,
                COALESCE(j.jam_mulai, '00:00') as jam_mulai,
                COALESCE(j.jam_selesai, '00:00') as jam_selesai,
                COALESCE(CONCAT(j.jam_mulai, ' - ', j.jam_selesai), '-') as jadwal,
                pba.status_asli,
                pba.status_diajukan,
                pba.alasan_banding,
                pba.status_banding,
                COALESCE(pba.catatan_guru, '-') as catatan_guru,
                COALESCE(DATE_FORMAT(pba.tanggal_keputusan, '%Y-%m-%d %H:%i'), '-') as tanggal_keputusan,
                COALESCE(guru_proses.nama, 'Belum Diproses') as diproses_oleh,
                pba.jenis_banding
            FROM pengajuan_banding_absen pba
            JOIN siswa s ON pba.siswa_id = s.id_siswa
            LEFT JOIN kelas k ON s.kelas_id = k.id_kelas OR pba.kelas_id = k.id_kelas
            LEFT JOIN jadwal j ON pba.jadwal_id = j.id_jadwal
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru guru_proses ON pba.diproses_oleh = guru_proses.id_guru
            WHERE DATE(pba.tanggal_pengajuan) BETWEEN ? AND ?
        `;

        const params = [startDate, endDate];

        if (kelas_id && kelas_id !== 'all') {
            query += ' AND k.id_kelas = ?';
            params.push(kelas_id);
        }

        if (status && status !== 'all') {
            query += ' AND pba.status_banding = ?';
            params.push(status);
        }

        query += ' ORDER BY pba.tanggal_pengajuan DESC';

        const [bandingData] = await global.dbPool.execute(query, params);

        // Import required modules
        const { buildExcel } = await import('./backend/export/excelBuilder.js');
        const { getLetterhead } = await import('./backend/utils/letterheadService.js');
        const { REPORT_KEYS } = await import('./backend/utils/letterheadService.js');
        const bandingAbsenSchema = await import('./backend/export/schemas/banding-absen.js');

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.BANDING_ABSEN });

        // Prepare data for Excel
        const reportData = bandingData.map((row, index) => ({
            no: index + 1,
            tanggal_pengajuan: row.tanggal_pengajuan,
            tanggal_absen: row.tanggal_absen,
            pengaju: row.nama_pengaju,
            kelas: row.nama_kelas,
            mata_pelajaran: row.nama_mapel,
            guru: row.nama_guru,
            jadwal: row.jadwal,
            status_asli: row.status_asli,
            status_diajukan: row.status_diajukan,
            status_banding: row.status_banding,
            jenis_banding: row.jenis_banding,
            alasan_banding: row.alasan_banding,
            catatan_guru: row.catatan_guru,
            tanggal_keputusan: row.tanggal_keputusan,
            diproses_oleh: row.diproses_oleh
        }));

        const reportPeriod = `${formatWIBDate(new Date(startDate))} - ${formatWIBDate(new Date(endDate))}`;

        // Generate Excel workbook
        const workbook = await buildExcel({
            title: bandingAbsenSchema.default.title,
            subtitle: bandingAbsenSchema.default.subtitle,
            reportPeriod: reportPeriod,
            letterhead: letterhead,
            columns: bandingAbsenSchema.default.columns,
            rows: reportData
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Banding_Absen_${startDate}_${endDate}_${Date.now()}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();

        console.log(`✅ Banding absen exported successfully: ${bandingData.length} records`);
    } catch (error) {
        console.error('❌ Error exporting banding absen:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// Export rekap ketidakhadiran guru
app.get('/api/export/rekap-ketidakhadiran-guru', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { tahun } = req.query;
        console.log('📊 Exporting rekap ketidakhadiran guru:', { tahun });

        if (!tahun) {
            return res.status(400).json({ error: 'Tahun harus diisi' });
        }

        // Query untuk mendapatkan data guru dan presensi
        const query = `
            SELECT 
                g.id_guru as id,
                g.nama,
                g.nip,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 7 THEN 1 ELSE 0 END), 0) as jul,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 8 THEN 1 ELSE 0 END), 0) as agt,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 9 THEN 1 ELSE 0 END), 0) as sep,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 10 THEN 1 ELSE 0 END), 0) as okt,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 11 THEN 1 ELSE 0 END), 0) as nov,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 12 THEN 1 ELSE 0 END), 0) as des,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 1 THEN 1 ELSE 0 END), 0) as jan,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 2 THEN 1 ELSE 0 END), 0) as feb,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 3 THEN 1 ELSE 0 END), 0) as mar,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 4 THEN 1 ELSE 0 END), 0) as apr,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 5 THEN 1 ELSE 0 END), 0) as mei,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 6 THEN 1 ELSE 0 END), 0) as jun,
                COALESCE(SUM(CASE WHEN a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) as total_ketidakhadiran
            FROM guru g
            LEFT JOIN absensi_guru a ON g.id_guru = a.guru_id 
                AND YEAR(a.tanggal) = ? 
                AND a.status = 'Tidak Hadir'
            GROUP BY g.id_guru, g.nama, g.nip
            ORDER BY g.nama
        `;

        const [rows] = await global.dbPool.execute(query, [tahun]);

        // Hitung persentase untuk setiap guru
        const dataWithPercentage = rows.map(row => {
            const totalKetidakhadiran = row.total_ketidakhadiran;
            // Hari efektif per bulan (konsisten dengan UI)
            const hariEfektifPerBulan = {
                7: 14, 8: 21, 9: 22, 10: 23, 11: 20, 12: 17,
                1: 15, 2: 20, 3: 22, 4: 22, 5: 21, 6: 20
            };

            // Hitung total hari efektif berdasarkan data ketidakhadiran per bulan
            let totalHariEfektif = 0;
            const bulanData = [row.jul, row.agt, row.sep, row.okt, row.nov, row.des, row.jan, row.feb, row.mar, row.apr, row.mei, row.jun];
            const bulanKeys = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

            bulanKeys.forEach((bulan, index) => {
                if (bulanData[index] > 0) {
                    totalHariEfektif += hariEfektifPerBulan[bulan];
                }
            });

            // Jika tidak ada data ketidakhadiran, gunakan total hari efektif setahun
            if (totalHariEfektif === 0) {
                totalHariEfektif = Object.values(hariEfektifPerBulan).reduce((sum, hari) => sum + hari, 0);
            }
            const persentaseKetidakhadiran = totalHariEfektif > 0 ? (totalKetidakhadiran / totalHariEfektif) * 100 : 0;
            const persentaseKehadiran = 100 - persentaseKetidakhadiran;

            return {
                ...row,
                persentase_ketidakhadiran: parseFloat(persentaseKetidakhadiran.toFixed(2)),
                persentase_kehadiran: parseFloat(persentaseKehadiran.toFixed(2))
            };
        });

        // Import required modules
        const { buildExcel } = await import('./backend/export/excelBuilder.js');
        const { getLetterhead } = await import('./backend/utils/letterheadService.js');
        const { REPORT_KEYS } = await import('./backend/utils/letterheadService.js');
        const rekapGuruSchema = await import('./backend/export/schemas/rekap-ketidakhadiran-guru-bulanan.js');

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.REKAP_KETIDAKHADIRAN_GURU });

        // Prepare data for Excel
        const reportData = dataWithPercentage.map((row, index) => ({
            no: index + 1,
            nama: row.nama,
            nip: row.nip,
            jul: row.jul,
            agt: row.agt,
            sep: row.sep,
            okt: row.okt,
            nov: row.nov,
            des: row.des,
            jan: row.jan,
            feb: row.feb,
            mar: row.mar,
            apr: row.apr,
            mei: row.mei,
            jun: row.jun,
            total_ketidakhadiran: row.total_ketidakhadiran,
            persentase_ketidakhadiran: row.persentase_ketidakhadiran / 100, // Convert to decimal for percentage format
            persentase_kehadiran: row.persentase_kehadiran / 100 // Convert to decimal for percentage format
        }));

        const reportPeriod = `Tahun ${tahun}`;

        // Generate Excel workbook
        const workbook = await buildExcel({
            title: rekapGuruSchema.default.title,
            subtitle: rekapGuruSchema.default.subtitle,
            reportPeriod: reportPeriod,
            letterhead: letterhead,
            columns: rekapGuruSchema.default.columns,
            rows: reportData
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Rekap_Ketidakhadiran_Guru_${tahun}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();

        console.log(`✅ Rekap ketidakhadiran guru exported successfully: ${dataWithPercentage.length} records`);
    } catch (error) {
        console.error('❌ Error exporting rekap ketidakhadiran guru:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Get riwayat banding absen untuk laporan
app.get('/api/guru/banding-absen-history', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, status } = req.query;
        const guruId = req.user.guru_id;

        console.log('📊 Fetching banding absen history:', { startDate, endDate, kelas_id, status, guruId });

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan akhir harus diisi' });
        }

        let query = `
      SELECT 
        ba.id,
        ba.tanggal_pengajuan,
        ba.tanggal_absen,
        ba.status_absen,
        ba.alasan_banding,
        ba.status,
        ba.tanggal_disetujui,
        ba.catatan,
        s.nama as nama_siswa,
        s.nis,
        k.nama_kelas
      FROM pengajuan_banding_absen ba
      JOIN siswa s ON ba.siswa_id = s.id_siswa
      JOIN kelas k ON s.kelas_id = k.id_kelas
      WHERE ba.tanggal_pengajuan BETWEEN ? AND ?
        AND ba.guru_id = ?
    `;

        const params = [startDate, endDate, guruId];

        if (kelas_id && kelas_id !== 'all') {
            query += ` AND s.kelas_id = ?`;
            params.push(kelas_id);
        }

        if (status && status !== 'all') {
            query += ` AND ba.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY ba.tanggal_pengajuan DESC, s.nama`;

        const [rows] = await global.dbPool.execute(query, params);

        console.log(`✅ Banding absen history fetched: ${rows.length} records`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error fetching banding absen history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Export riwayat banding absen
app.get('/api/export/riwayat-banding-absen', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, status } = req.query;
        const guruId = req.user.guru_id;

        console.log('📊 Exporting riwayat banding absen:', { startDate, endDate, kelas_id, status, guruId });

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan akhir harus diisi' });
        }

        let query = `
      SELECT 
        ba.id,
        DATE_FORMAT(ba.tanggal_pengajuan, '%Y-%m-%d') as tanggal_pengajuan,
        DATE_FORMAT(ba.tanggal_absen, '%Y-%m-%d') as tanggal_absen,
        ba.status_absen,
        ba.alasan_banding,
        ba.status,
        DATE_FORMAT(ba.tanggal_disetujui, '%Y-%m-%d') as tanggal_disetujui,
        ba.catatan,
        s.nama as nama_siswa,
        s.nis,
        k.nama_kelas
      FROM pengajuan_banding_absen ba
      JOIN siswa s ON ba.siswa_id = s.id_siswa
      JOIN kelas k ON s.kelas_id = k.id_kelas
      WHERE ba.tanggal_pengajuan BETWEEN ? AND ?
        AND ba.guru_id = ?
    `;

        const params = [startDate, endDate, guruId];

        if (kelas_id && kelas_id !== 'all') {
            query += ` AND s.kelas_id = ?`;
            params.push(kelas_id);
        }

        if (status && status !== 'all') {
            query += ` AND ba.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY ba.tanggal_pengajuan DESC, s.nama`;

        const [rows] = await global.dbPool.execute(query, params);

        // Get class name for title
        let className = 'Semua Kelas';
        if (kelas_id && kelas_id !== 'all') {
            const [kelasRows] = await global.dbPool.execute(
                'SELECT nama_kelas FROM kelas WHERE id_kelas = ?',
                [kelas_id]
            );
            if (kelasRows.length > 0) {
                className = kelasRows[0].nama_kelas;
            }
        }

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.BANDING_ABSEN });

        // Create Excel file using ExcelJS directly
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('RIWAYAT BANDING ABSEN');

        let currentRow = 1;

        // Dynamic letterhead
        if (letterhead.enabled && letterhead.lines && letterhead.lines.length > 0) {
            const alignment = letterhead.alignment || 'center';

            // Add logo kiri dan kanan jika tersedia
            if (letterhead.logoLeftUrl || letterhead.logoRightUrl) {
                const logoRow = worksheet.getRow(currentRow);

                // Logo kiri
                if (letterhead.logoLeftUrl) {
                    try {
                        // Convert base64 to buffer if needed
                        let logoBuffer;
                        if (letterhead.logoLeftUrl.startsWith('data:image/')) {
                            // Handle base64 data URL
                            const base64Data = letterhead.logoLeftUrl.split(',')[1];
                            logoBuffer = Buffer.from(base64Data, 'base64');
                        } else {
                            // Handle file path
                            const logoPath = path.join(process.cwd(), 'public', letterhead.logoLeftUrl);
                            if (fsSync.existsSync(logoPath)) {
                                logoBuffer = fsSync.readFileSync(logoPath);
                            }
                        }

                        if (logoBuffer) {
                            const logoId = workbook.addImage({
                                buffer: logoBuffer,
                                extension: 'png'
                            });
                            worksheet.addImage(logoId, {
                                tl: { col: 0, row: currentRow - 1 },
                                br: { col: 2, row: currentRow + 2 }
                            });
                        }
                    } catch (error) {
                        console.warn('⚠️ Could not add left logo to Excel:', error.message);
                        // Fallback to text
                        logoRow.getCell(1).value = '[LOGO KIRI]';
                        logoRow.getCell(1).font = { italic: true, size: 10 };
                        logoRow.getCell(1).alignment = { horizontal: 'left' };
                    }
                }

                // Logo kanan
                if (letterhead.logoRightUrl) {
                    try {
                        // Convert base64 to buffer if needed
                        let logoBuffer;
                        if (letterhead.logoRightUrl.startsWith('data:image/')) {
                            // Handle base64 data URL
                            const base64Data = letterhead.logoRightUrl.split(',')[1];
                            logoBuffer = Buffer.from(base64Data, 'base64');
                        } else {
                            // Handle file path
                            const logoPath = path.join(process.cwd(), 'public', letterhead.logoRightUrl);
                            if (fsSync.existsSync(logoPath)) {
                                logoBuffer = fsSync.readFileSync(logoPath);
                            }
                        }

                        if (logoBuffer) {
                            const logoId = workbook.addImage({
                                buffer: logoBuffer,
                                extension: 'png'
                            });
                            const rightCol = Math.max(9, 3); // Adjust based on your table width
                            worksheet.addImage(logoId, {
                                tl: { col: rightCol, row: currentRow - 1 },
                                br: { col: rightCol + 2, row: currentRow + 2 }
                            });
                        }
                    } catch (error) {
                        console.warn('⚠️ Could not add right logo to Excel:', error.message);
                        // Fallback to text
                        const rightCell = Math.max(11, 3);
                        logoRow.getCell(rightCell).value = '[LOGO KANAN]';
                        logoRow.getCell(rightCell).font = { italic: true, size: 10 };
                        logoRow.getCell(rightCell).alignment = { horizontal: 'right' };
                    }
                }

                currentRow += 4; // Space for logo
            }

            letterhead.lines.forEach((line, index) => {
                const lineRow = worksheet.getRow(currentRow);
                // Handle both old format (string) and new format (object)
                const text = typeof line === 'string' ? line : line.text;
                const fontWeight = typeof line === 'object' ? line.fontWeight : (index === 0 ? 'bold' : 'normal');

                lineRow.getCell(1).value = text;

                if (fontWeight === 'bold') {
                    lineRow.getCell(1).font = { bold: true, size: 16 };
                } else {
                    lineRow.getCell(1).font = { size: 12 };
                }

                lineRow.getCell(1).alignment = { horizontal: alignment };
                worksheet.mergeCells(currentRow, 1, currentRow, 11);
                currentRow++;
            });

            currentRow++; // Separator
        } else {
            // Fallback to hardcoded header
            worksheet.getCell('A1').value = 'PEMERINTAH DAERAH PROVINSI JAWA BARAT';
            worksheet.getCell('A2').value = 'DINAS PENDIDIKAN';
            worksheet.getCell('A3').value = 'CABANG DINAS PENDIDIKAN WILAYAH VII';
            worksheet.getCell('A4').value = 'SEKOLAH MENENGAH KEJURUAN NEGERI 13';
            currentRow = 6;
        }

        // Report title and period
        worksheet.getCell(currentRow, 1).value = 'RIWAYAT PENGAJUAN BANDING ABSEN';
        worksheet.getCell(currentRow, 1).font = { bold: true, size: 14 };
        worksheet.getCell(currentRow, 1).alignment = { horizontal: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, 11);
        currentRow++;

        worksheet.getCell(currentRow, 1).value = `Periode: ${startDate} s/d ${endDate} - Kelas: ${className}`;
        worksheet.getCell(currentRow, 1).font = { size: 11 };
        worksheet.getCell(currentRow, 1).alignment = { horizontal: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, 11);
        currentRow++;

        currentRow++; // Separator

        // Headers
        const headers = ['NO', 'TANGGAL', 'NAMA SISWA', 'NIS', 'KELAS', 'TANGGAL ABSEN', 'STATUS ABSEN', 'ALASAN BANDING', 'STATUS', 'TANGGAL DISETUJUI', 'CATATAN'];
        headers.forEach((header, index) => {
            worksheet.getCell(currentRow, index + 1).value = header;
            worksheet.getCell(currentRow, index + 1).font = { bold: true };
        });
        currentRow++;

        // Data rows
        rows.forEach((item, index) => {
            const row = currentRow + index;
            worksheet.getCell(row, 1).value = index + 1;
            worksheet.getCell(row, 2).value = item.tanggal_pengajuan;
            worksheet.getCell(row, 3).value = item.nama_siswa;
            worksheet.getCell(row, 4).value = item.nis;
            worksheet.getCell(row, 5).value = item.nama_kelas;
            worksheet.getCell(row, 6).value = item.tanggal_absen;
            worksheet.getCell(row, 7).value = item.status_absen;
            worksheet.getCell(row, 8).value = item.alasan_banding;
            worksheet.getCell(row, 9).value = item.status === 'approved' ? 'Disetujui' :
                item.status === 'rejected' ? 'Ditolak' : 'Pending';
            worksheet.getCell(row, 10).value = item.tanggal_disetujui || '-';
            worksheet.getCell(row, 11).value = item.catatan || '-';
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="riwayat-banding-absen-${startDate}-${endDate}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();

        console.log(`✅ Riwayat banding absen exported successfully: ${rows.length} records`);
    } catch (error) {
        console.error('❌ Error exporting riwayat banding absen:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get presensi siswa SMK 13 untuk laporan
app.get('/api/guru/presensi-siswa-smkn13', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        const guruId = req.user.guru_id;

        console.log('📊 Fetching presensi siswa SMKN 13:', { startDate, endDate, kelas_id, guruId });

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan akhir harus diisi' });
        }

        let query = `
      SELECT 
        a.tanggal,
        j.hari,
        j.jam_mulai,
        j.jam_selesai,
        COALESCE(m.nama_mapel, j.keterangan_khusus) as mata_pelajaran,
        k.nama_kelas,
        COALESCE(g.nama, 'Sistem') as nama_guru,
        COUNT(DISTINCT s.id_siswa) as total_siswa,
        COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as hadir,
        COUNT(CASE WHEN a.status = 'Izin' THEN 1 END) as izin,
        COUNT(CASE WHEN a.status = 'Sakit' THEN 1 END) as sakit,
        COUNT(CASE WHEN a.status = 'Alpa' THEN 1 END) as alpa,
        COUNT(CASE WHEN a.status = 'Dispen' THEN 1 END) as dispen
      FROM absensi_siswa a
      JOIN jadwal j ON a.jadwal_id = j.id_jadwal
      JOIN kelas k ON j.kelas_id = k.id_kelas
      LEFT JOIN guru g ON j.guru_id = g.id_guru
      LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
      LEFT JOIN siswa s ON j.kelas_id = s.kelas_id AND s.status = 'aktif'
      WHERE a.tanggal BETWEEN ? AND ?
        AND j.guru_id = ?
    `;

        const params = [startDate, endDate, guruId];

        if (kelas_id && kelas_id !== 'all') {
            query += ` AND j.kelas_id = ?`;
            params.push(kelas_id);
        }

        query += `
      GROUP BY a.tanggal, j.hari, j.jam_mulai, j.jam_selesai, m.nama_mapel, k.nama_kelas, g.nama
      ORDER BY a.tanggal DESC, j.jam_mulai
    `;

        const [rows] = await global.dbPool.execute(query, params);

        console.log(`✅ Presensi siswa SMKN 13 fetched: ${rows.length} records`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error fetching presensi siswa SMKN 13:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export presensi siswa SMK 13
app.get('/api/export/presensi-siswa-smkn13', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        const guruId = req.user.guru_id;

        console.log('📊 Exporting presensi siswa SMKN 13:', { startDate, endDate, kelas_id, guruId });

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan akhir harus diisi' });
        }

        let query = `
      SELECT 
        DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal,
        j.hari,
        j.jam_mulai,
        j.jam_selesai,
        COALESCE(m.nama_mapel, j.keterangan_khusus) as mata_pelajaran,
        k.nama_kelas,
        COALESCE(g.nama, 'Sistem') as nama_guru,
        COUNT(DISTINCT s.id_siswa) as total_siswa,
        COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as hadir,
        COUNT(CASE WHEN a.status = 'Izin' THEN 1 END) as izin,
        COUNT(CASE WHEN a.status = 'Sakit' THEN 1 END) as sakit,
        COUNT(CASE WHEN a.status = 'Alpa' THEN 1 END) as alpa,
        COUNT(CASE WHEN a.status = 'Dispen' THEN 1 END) as dispen
      FROM absensi_siswa a
      JOIN jadwal j ON a.jadwal_id = j.id_jadwal
      JOIN kelas k ON j.kelas_id = k.id_kelas
      LEFT JOIN guru g ON j.guru_id = g.id_guru
      LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
      LEFT JOIN siswa s ON j.kelas_id = s.kelas_id AND s.status = 'aktif'
      WHERE a.tanggal BETWEEN ? AND ?
        AND j.guru_id = ?
    `;

        const params = [startDate, endDate, guruId];

        if (kelas_id && kelas_id !== 'all') {
            query += ` AND j.kelas_id = ?`;
            params.push(kelas_id);
        }

        query += `
      GROUP BY a.tanggal, j.hari, j.jam_mulai, j.jam_selesai, m.nama_mapel, k.nama_kelas, g.nama
      ORDER BY a.tanggal DESC, j.jam_mulai
    `;

        const [rows] = await global.dbPool.execute(query, params);

        // Get class name for title
        let className = 'Semua Kelas';
        if (kelas_id && kelas_id !== 'all') {
            const [kelasRows] = await global.dbPool.execute(
                'SELECT nama_kelas FROM kelas WHERE id_kelas = ?',
                [kelas_id]
            );
            if (kelasRows.length > 0) {
                className = kelasRows[0].nama_kelas;
            }
        }

        // Import required modules
        const { buildExcel } = await import('./backend/export/excelBuilder.js');
        const { getLetterhead } = await import('./backend/utils/letterheadService.js');
        const { REPORT_KEYS } = await import('./backend/utils/letterheadService.js');

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.PRESENSI_SISWA });

        // Prepare data for Excel
        const reportData = rows.map((item, index) => {
            const total = item.total_siswa || 0;
            const hadir = item.hadir || 0;
            const presentase = total > 0 ? ((hadir / total) * 100).toFixed(1) : '0.0';

            return {
                no: index + 1,
                tanggal: item.tanggal,
                hari: item.hari,
                jam: `${item.jam_mulai} - ${item.jam_selesai}`,
                mata_pelajaran: item.mata_pelajaran,
                kelas: item.nama_kelas,
                guru: item.nama_guru,
                total_siswa: total,
                hadir: hadir,
                izin: item.izin || 0,
                sakit: item.sakit || 0,
                alpa: item.alpa || 0,
                dispen: item.dispen || 0,
                persentase: `${presentase}%`
            };
        });

        // Define columns for the report
        const columns = [
            { key: 'no', label: 'NO', width: 5, align: 'center' },
            { key: 'tanggal', label: 'TANGGAL', width: 12, align: 'center' },
            { key: 'hari', label: 'HARI', width: 10, align: 'center' },
            { key: 'jam', label: 'JAM', width: 15, align: 'center' },
            { key: 'mata_pelajaran', label: 'MATA PELAJARAN', width: 20, align: 'left' },
            { key: 'kelas', label: 'KELAS', width: 12, align: 'center' },
            { key: 'guru', label: 'GURU', width: 20, align: 'left' },
            { key: 'total_siswa', label: 'TOTAL SISWA', width: 12, align: 'center' },
            { key: 'hadir', label: 'HADIR', width: 8, align: 'center' },
            { key: 'izin', label: 'IZIN', width: 8, align: 'center' },
            { key: 'sakit', label: 'SAKIT', width: 8, align: 'center' },
            { key: 'alpa', label: 'ALPA', width: 8, align: 'center' },
            { key: 'dispen', label: 'DISPEN', width: 8, align: 'center' },
            { key: 'persentase', label: 'PERSENTASE (%)', width: 12, align: 'center' }
        ];

        const reportPeriod = `Periode: ${startDate} s/d ${endDate} - Kelas: ${className}`;

        // Generate Excel workbook using buildExcel
        const workbook = await buildExcel({
            title: 'PRESENSI SISWA',
            subtitle: 'Laporan Presensi Siswa SMKN 13',
            reportPeriod: reportPeriod,
            showLetterhead: letterhead.enabled,
            letterhead: letterhead,
            columns: columns,
            rows: reportData
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="presensi-siswa-smkn13-${startDate}-${endDate}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();

        console.log(`✅ Presensi siswa SMKN 13 exported successfully: ${rows.length} records`);
    } catch (error) {
        console.error('❌ Error exporting presensi siswa SMKN 13:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get rekap ketidakhadiran untuk laporan
app.get('/api/guru/rekap-ketidakhadiran', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, reportType } = req.query;
        const guruId = req.user.guru_id;

        console.log('📊 Fetching rekap ketidakhadiran:', { startDate, endDate, kelas_id, reportType, guruId });

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan akhir harus diisi' });
        }

        let query;
        let params;

        if (reportType === 'bulanan') {
            // Laporan bulanan - grup berdasarkan bulan dan kelas
            query = `
        SELECT 
          DATE_FORMAT(a.tanggal, '%Y-%m') as periode,
          k.nama_kelas,
          COUNT(DISTINCT s.id_siswa) as total_siswa,
          COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as hadir,
          COUNT(CASE WHEN a.status = 'Izin' THEN 1 END) as izin,
          COUNT(CASE WHEN a.status = 'Sakit' THEN 1 END) as sakit,
          COUNT(CASE WHEN a.status = 'Alpa' THEN 1 END) as alpa,
          COUNT(CASE WHEN a.status = 'Dispen' THEN 1 END) as dispen
        FROM absensi_siswa a
        JOIN siswa s ON a.siswa_id = s.id_siswa
        JOIN kelas k ON s.kelas_id = k.id_kelas
        JOIN jadwal j ON a.jadwal_id = j.id_jadwal
        WHERE a.tanggal BETWEEN ? AND ?
          AND j.guru_id = ?
      `;

            params = [startDate, endDate, guruId];

            if (kelas_id && kelas_id !== 'all') {
                query += ` AND s.kelas_id = ?`;
                params.push(kelas_id);
            }

            query += `
        GROUP BY DATE_FORMAT(a.tanggal, '%Y-%m'), k.nama_kelas
        ORDER BY periode DESC, k.nama_kelas
      `;
        } else {
            // Laporan tahunan - grup berdasarkan tahun dan kelas
            query = `
        SELECT 
          YEAR(a.tanggal) as periode,
          k.nama_kelas,
          COUNT(DISTINCT s.id_siswa) as total_siswa,
          COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as hadir,
          COUNT(CASE WHEN a.status = 'Izin' THEN 1 END) as izin,
          COUNT(CASE WHEN a.status = 'Sakit' THEN 1 END) as sakit,
          COUNT(CASE WHEN a.status = 'Alpa' THEN 1 END) as alpa,
          COUNT(CASE WHEN a.status = 'Dispen' THEN 1 END) as dispen
        FROM absensi_siswa a
        JOIN siswa s ON a.siswa_id = s.id_siswa
        JOIN kelas k ON s.kelas_id = k.id_kelas
        JOIN jadwal j ON a.jadwal_id = j.id_jadwal
        WHERE a.tanggal BETWEEN ? AND ?
          AND j.guru_id = ?
      `;

            params = [startDate, endDate, guruId];

            if (kelas_id && kelas_id !== 'all') {
                query += ` AND s.kelas_id = ?`;
                params.push(kelas_id);
            }

            query += `
        GROUP BY YEAR(a.tanggal), k.nama_kelas
        ORDER BY periode DESC, k.nama_kelas
      `;
        }

        const [rows] = await global.dbPool.execute(query, params);

        console.log(`✅ Rekap ketidakhadiran fetched: ${rows.length} records`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error fetching rekap ketidakhadiran:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export rekap ketidakhadiran
app.get('/api/export/rekap-ketidakhadiran', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, reportType } = req.query;
        const guruId = req.user.guru_id;

        console.log('📊 Exporting rekap ketidakhadiran:', { startDate, endDate, kelas_id, reportType, guruId });

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan akhir harus diisi' });
        }

        let query;
        let params;

        if (reportType === 'bulanan') {
            // Laporan bulanan
            query = `
        SELECT 
          DATE_FORMAT(a.tanggal, '%Y-%m') as periode,
          k.nama_kelas,
          COUNT(DISTINCT s.id_siswa) as total_siswa,
          COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as hadir,
          COUNT(CASE WHEN a.status = 'Izin' THEN 1 END) as izin,
          COUNT(CASE WHEN a.status = 'Sakit' THEN 1 END) as sakit,
          COUNT(CASE WHEN a.status = 'Alpa' THEN 1 END) as alpa,
          COUNT(CASE WHEN a.status = 'Dispen' THEN 1 END) as dispen
        FROM absensi_siswa a
        JOIN siswa s ON a.siswa_id = s.id_siswa
        JOIN kelas k ON s.kelas_id = k.id_kelas
        JOIN jadwal j ON a.jadwal_id = j.id_jadwal
        WHERE a.tanggal BETWEEN ? AND ?
          AND j.guru_id = ?
      `;

            params = [startDate, endDate, guruId];

            if (kelas_id && kelas_id !== 'all') {
                query += ` AND s.kelas_id = ?`;
                params.push(kelas_id);
            }

            query += `
        GROUP BY DATE_FORMAT(a.tanggal, '%Y-%m'), k.nama_kelas
        ORDER BY periode DESC, k.nama_kelas
      `;
        } else {
            // Laporan tahunan
            query = `
        SELECT 
          YEAR(a.tanggal) as periode,
          k.nama_kelas,
          COUNT(DISTINCT s.id_siswa) as total_siswa,
          COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as hadir,
          COUNT(CASE WHEN a.status = 'Izin' THEN 1 END) as izin,
          COUNT(CASE WHEN a.status = 'Sakit' THEN 1 END) as sakit,
          COUNT(CASE WHEN a.status = 'Alpa' THEN 1 END) as alpa,
          COUNT(CASE WHEN a.status = 'Dispen' THEN 1 END) as dispen
        FROM absensi_siswa a
        JOIN siswa s ON a.siswa_id = s.id_siswa
        JOIN kelas k ON s.kelas_id = k.id_kelas
        JOIN jadwal j ON a.jadwal_id = j.id_jadwal
        WHERE a.tanggal BETWEEN ? AND ?
          AND j.guru_id = ?
      `;

            params = [startDate, endDate, guruId];

            if (kelas_id && kelas_id !== 'all') {
                query += ` AND s.kelas_id = ?`;
                params.push(kelas_id);
            }

            query += `
        GROUP BY YEAR(a.tanggal), k.nama_kelas
        ORDER BY periode DESC, k.nama_kelas
      `;
        }

        const [rows] = await global.dbPool.execute(query, params);

        // Get class name for title
        let className = 'Semua Kelas';
        if (kelas_id && kelas_id !== 'all') {
            const [kelasRows] = await global.dbPool.execute(
                'SELECT nama_kelas FROM kelas WHERE id_kelas = ?',
                [kelas_id]
            );
            if (kelasRows.length > 0) {
                className = kelasRows[0].nama_kelas;
            }
        }

        // Import required modules for letterhead
        const { getLetterhead } = await import('./backend/utils/letterheadService.js');
        const { REPORT_KEYS } = await import('./backend/utils/letterheadService.js');

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.REKAP_KETIDAKHADIRAN });

        // Create Excel file using ExcelJS directly
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('REKAP KETIDAKHADIRAN');

        let currentRow = 1;

        // Dynamic letterhead
        if (letterhead.enabled && letterhead.lines && letterhead.lines.length > 0) {
            const alignment = letterhead.alignment || 'center';

            // Add logo kiri dan kanan jika tersedia
            if (letterhead.logoLeftUrl || letterhead.logoRightUrl) {
                const logoRow = worksheet.getRow(currentRow);

                // Logo kiri
                if (letterhead.logoLeftUrl) {
                    try {
                        // Convert base64 to buffer if needed
                        let logoBuffer;
                        if (letterhead.logoLeftUrl.startsWith('data:image/')) {
                            // Handle base64 data URL
                            const base64Data = letterhead.logoLeftUrl.split(',')[1];
                            logoBuffer = Buffer.from(base64Data, 'base64');
                        } else {
                            // Handle file path
                            const logoPath = path.join(process.cwd(), 'public', letterhead.logoLeftUrl);
                            if (fsSync.existsSync(logoPath)) {
                                logoBuffer = fsSync.readFileSync(logoPath);
                            }
                        }

                        if (logoBuffer) {
                            const logoId = workbook.addImage({
                                buffer: logoBuffer,
                                extension: 'png'
                            });
                            worksheet.addImage(logoId, {
                                tl: { col: 0, row: currentRow - 1 },
                                br: { col: 2, row: currentRow + 2 }
                            });
                        }
                    } catch (error) {
                        console.warn('⚠️ Could not add left logo to Excel:', error.message);
                        // Fallback to text
                        logoRow.getCell(1).value = '[LOGO KIRI]';
                        logoRow.getCell(1).font = { italic: true, size: 10 };
                        logoRow.getCell(1).alignment = { horizontal: 'left' };
                    }
                }

                // Logo kanan
                if (letterhead.logoRightUrl) {
                    try {
                        // Convert base64 to buffer if needed
                        let logoBuffer;
                        if (letterhead.logoRightUrl.startsWith('data:image/')) {
                            // Handle base64 data URL
                            const base64Data = letterhead.logoRightUrl.split(',')[1];
                            logoBuffer = Buffer.from(base64Data, 'base64');
                        } else {
                            // Handle file path
                            const logoPath = path.join(process.cwd(), 'public', letterhead.logoRightUrl);
                            if (fsSync.existsSync(logoPath)) {
                                logoBuffer = fsSync.readFileSync(logoPath);
                            }
                        }

                        if (logoBuffer) {
                            const logoId = workbook.addImage({
                                buffer: logoBuffer,
                                extension: 'png'
                            });
                            const rightCol = Math.max(10, 3); // Adjust based on your table width
                            worksheet.addImage(logoId, {
                                tl: { col: rightCol, row: currentRow - 1 },
                                br: { col: rightCol + 2, row: currentRow + 2 }
                            });
                        }
                    } catch (error) {
                        console.warn('⚠️ Could not add right logo to Excel:', error.message);
                        // Fallback to text
                        const rightCell = Math.max(12, 3);
                        logoRow.getCell(rightCell).value = '[LOGO KANAN]';
                        logoRow.getCell(rightCell).font = { italic: true, size: 10 };
                        logoRow.getCell(rightCell).alignment = { horizontal: 'right' };
                    }
                }

                currentRow += 4; // Space for logo
            }

            letterhead.lines.forEach((line, index) => {
                const lineRow = worksheet.getRow(currentRow);
                // Handle both old format (string) and new format (object)
                const text = typeof line === 'string' ? line : line.text;
                const fontWeight = typeof line === 'object' ? line.fontWeight : (index === 0 ? 'bold' : 'normal');

                lineRow.getCell(1).value = text;

                if (fontWeight === 'bold') {
                    lineRow.getCell(1).font = { bold: true, size: 16 };
                } else {
                    lineRow.getCell(1).font = { size: 12 };
                }

                lineRow.getCell(1).alignment = { horizontal: alignment };
                worksheet.mergeCells(currentRow, 1, currentRow, 12);
                currentRow++;
            });

            currentRow++; // Separator
        } else {
            // Fallback to hardcoded header
            worksheet.getCell('A1').value = 'PEMERINTAH DAERAH PROVINSI JAWA BARAT';
            worksheet.getCell('A2').value = 'DINAS PENDIDIKAN';
            worksheet.getCell('A3').value = 'CABANG DINAS PENDIDIKAN WILAYAH VII';
            worksheet.getCell('A4').value = 'SEKOLAH MENENGAH KEJURUAN NEGERI 13';
            currentRow = 6;
        }

        // Report title
        worksheet.getCell(`A${currentRow}`).value = `REKAP KETIDAKHADIRAN ${reportType === 'bulanan' ? 'BULANAN' : 'TAHUNAN'}`;
        worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
        worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, 12);
        currentRow++;

        // Report period
        worksheet.getCell(`A${currentRow}`).value = `Periode: ${startDate} s/d ${endDate} - Kelas: ${className}`;
        worksheet.getCell(`A${currentRow}`).font = { size: 12 };
        worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, 12);
        currentRow++;

        // Separator
        currentRow++;

        // Headers
        const headers = ['NO', 'PERIODE', 'KELAS', 'TOTAL SISWA', 'HADIR', 'IZIN', 'SAKIT', 'ALPA', 'DISPEN', 'TOTAL ABSEN', 'PERSENTASE HADIR (%)', 'PERSENTASE ABSEN (%)'];
        headers.forEach((header, index) => {
            worksheet.getCell(currentRow, index + 1).value = header;
            worksheet.getCell(currentRow, index + 1).font = { bold: true };
        });
        currentRow++;

        // Data rows
        rows.forEach((item, index) => {
            const row = currentRow + index;
            const totalSiswa = item.total_siswa || 0;
            const hadir = item.hadir || 0;
            const totalAbsen = (item.izin || 0) + (item.sakit || 0) + (item.alpa || 0) + (item.dispen || 0);
            const presentaseHadir = totalSiswa > 0 ? ((hadir / totalSiswa) * 100).toFixed(1) : '0.0';
            const presentaseAbsen = totalSiswa > 0 ? ((totalAbsen / totalSiswa) * 100).toFixed(1) : '0.0';

            worksheet.getCell(row, 1).value = index + 1;
            worksheet.getCell(row, 2).value = item.periode;
            worksheet.getCell(row, 3).value = item.nama_kelas;
            worksheet.getCell(row, 4).value = totalSiswa;
            worksheet.getCell(row, 5).value = hadir;
            worksheet.getCell(row, 6).value = item.izin || 0;
            worksheet.getCell(row, 7).value = item.sakit || 0;
            worksheet.getCell(row, 8).value = item.alpa || 0;
            worksheet.getCell(row, 9).value = item.dispen || 0;
            worksheet.getCell(row, 10).value = totalAbsen;
            worksheet.getCell(row, 11).value = `${presentaseHadir}%`;
            worksheet.getCell(row, 12).value = `${presentaseAbsen}%`;
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="rekap-ketidakhadiran-${reportType}-${startDate}-${endDate}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();

        console.log(`✅ Rekap ketidakhadiran exported successfully: ${rows.length} records`);
    } catch (error) {
        console.error('❌ Error exporting rekap ketidakhadiran:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export ringkasan kehadiran siswa SMKN 13 (untuk guru)
app.get('/api/export/ringkasan-kehadiran-siswa-smkn13', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id } = req.query;
        const guruId = req.user.guru_id;

        console.log('📊 Exporting ringkasan kehadiran siswa SMKN 13:', { startDate, endDate, kelas_id, guruId });

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Tanggal mulai dan akhir harus diisi' });
        }

        // Query untuk mendapatkan data siswa dan presensi
        let query = `
            SELECT 
                s.id_siswa as id,
                s.nis,
                s.nama,
                k.nama_kelas,
                COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END), 0) as H,
                COALESCE(SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END), 0) as I,
                COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) as S,
                COALESCE(SUM(CASE WHEN a.status = 'Alpa' THEN 1 ELSE 0 END), 0) as A,
                COALESCE(SUM(CASE WHEN a.status = 'Dispen' THEN 1 ELSE 0 END), 0) as D,
                COUNT(a.id) as total_absen
            FROM siswa s
            LEFT JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN absensi_siswa a ON s.id_siswa = a.siswa_id 
                AND a.tanggal BETWEEN ? AND ?
                AND a.jadwal_id IN (
                    SELECT j.id_jadwal 
                    FROM jadwal j 
                    WHERE j.guru_id = ?
                )
            WHERE s.status = 'aktif'
        `;

        const params = [startDate, endDate, guruId];

        if (kelas_id && kelas_id !== 'all') {
            query += ` AND s.kelas_id = ?`;
            params.push(kelas_id);
        }

        query += `
            GROUP BY s.id_siswa, s.nis, s.nama, k.nama_kelas
            ORDER BY k.nama_kelas, s.nama
        `;

        const [rows] = await global.dbPool.execute(query, params);

        // Calculate percentage for each student
        const dataWithPercentage = rows.map(row => {
            const total = row.H + row.I + row.S + row.A + row.D;
            const presentase = total > 0 ? ((row.H / total) * 100).toFixed(2) : '0.00';
            return {
                ...row,
                presentase: parseFloat(presentase)
            };
        });

        // Get class name for title
        let className = 'Semua Kelas';
        if (kelas_id && kelas_id !== 'all') {
            const [kelasRows] = await global.dbPool.execute(
                'SELECT nama_kelas FROM kelas WHERE id_kelas = ?',
                [kelas_id]
            );
            if (kelasRows.length > 0) {
                className = kelasRows[0].nama_kelas;
            }
        }

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.REKAP_KETIDAKHADIRAN });

        // Create Excel file using ExcelJS directly (temporary solution)
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('RINGKASAN KEHADIRAN SISWA');

        let currentRow = 1;

        // Dynamic letterhead
        if (letterhead.enabled && letterhead.lines && letterhead.lines.length > 0) {
            const alignment = letterhead.alignment || 'center';

            letterhead.lines.forEach((line, index) => {
                const lineRow = worksheet.getRow(currentRow);
                // Handle both old format (string) and new format (object)
                const text = typeof line === 'string' ? line : line.text;
                const fontWeight = typeof line === 'object' ? line.fontWeight : (index === 0 ? 'bold' : 'normal');

                lineRow.getCell(1).value = text;

                if (fontWeight === 'bold') {
                    lineRow.getCell(1).font = { bold: true, size: 16 };
                } else {
                    lineRow.getCell(1).font = { size: 12 };
                }

                lineRow.getCell(1).alignment = { horizontal: alignment };
                worksheet.mergeCells(currentRow, 1, currentRow, 11);
                currentRow++;
            });

            currentRow++; // Separator
        } else {
            // Fallback to hardcoded header
            worksheet.getCell('A1').value = 'PEMERINTAH DAERAH PROVINSI JAWA BARAT';
            worksheet.getCell('A2').value = 'DINAS PENDIDIKAN';
            worksheet.getCell('A3').value = 'CABANG DINAS PENDIDIKAN WILAYAH VII';
            worksheet.getCell('A4').value = 'SEKOLAH MENENGAH KEJURUAN NEGERI 13';
            currentRow = 6;
        }

        // Report title and period
        worksheet.getCell(currentRow, 1).value = 'RINGKASAN KEHADIRAN SISWA';
        worksheet.getCell(currentRow, 1).font = { bold: true, size: 14 };
        worksheet.getCell(currentRow, 1).alignment = { horizontal: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, 11);
        currentRow++;

        worksheet.getCell(currentRow, 1).value = `Periode: ${startDate} s/d ${endDate} - Kelas: ${className}`;
        worksheet.getCell(currentRow, 1).font = { size: 11 };
        worksheet.getCell(currentRow, 1).alignment = { horizontal: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, 11);
        currentRow++;

        currentRow++; // Separator

        // Headers
        const headers = ['NO', 'NAMA SISWA', 'NIS', 'KELAS', 'HADIR', 'IZIN', 'SAKIT', 'ALPA', 'DISPEN', 'TOTAL', 'PERSENTASE (%)'];
        headers.forEach((header, index) => {
            worksheet.getCell(currentRow, index + 1).value = header;
            worksheet.getCell(currentRow, index + 1).font = { bold: true };
        });
        currentRow++;

        // Data rows
        dataWithPercentage.forEach((siswa, index) => {
            const row = currentRow + index;
            const total = siswa.H + siswa.I + siswa.S + siswa.A + siswa.D;
            worksheet.getCell(row, 1).value = index + 1;
            worksheet.getCell(row, 2).value = siswa.nama;
            worksheet.getCell(row, 3).value = siswa.nis;
            worksheet.getCell(row, 4).value = siswa.nama_kelas;
            worksheet.getCell(row, 5).value = siswa.H || 0;
            worksheet.getCell(row, 6).value = siswa.I || 0;
            worksheet.getCell(row, 7).value = siswa.S || 0;
            worksheet.getCell(row, 8).value = siswa.A || 0;
            worksheet.getCell(row, 9).value = siswa.D || 0;
            worksheet.getCell(row, 10).value = total;
            worksheet.getCell(row, 11).value = `${parseFloat(siswa.presentase || 0).toFixed(2)}%`;
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="ringkasan-kehadiran-siswa-smkn13-${startDate}-${endDate}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();

        console.log(`✅ Ringkasan kehadiran siswa SMKN 13 exported successfully: ${dataWithPercentage.length} records`);
    } catch (error) {
        console.error('❌ Error exporting ringkasan kehadiran siswa SMKN 13:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export rekap ketidakhadiran guru SMKN 13
app.get('/api/export/rekap-ketidakhadiran-guru-smkn13', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { tahun } = req.query;
        console.log('📊 Exporting rekap ketidakhadiran guru SMKN 13:', { tahun });

        if (!tahun) {
            return res.status(400).json({ error: 'Tahun harus diisi' });
        }

        // Query untuk mendapatkan data guru dan presensi
        const query = `
            SELECT 
                g.id_guru as id,
                g.nama,
                g.nip,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 7 THEN 1 ELSE 0 END), 0) as jul,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 8 THEN 1 ELSE 0 END), 0) as agt,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 9 THEN 1 ELSE 0 END), 0) as sep,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 10 THEN 1 ELSE 0 END), 0) as okt,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 11 THEN 1 ELSE 0 END), 0) as nov,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 12 THEN 1 ELSE 0 END), 0) as des,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 1 THEN 1 ELSE 0 END), 0) as jan,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 2 THEN 1 ELSE 0 END), 0) as feb,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 3 THEN 1 ELSE 0 END), 0) as mar,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 4 THEN 1 ELSE 0 END), 0) as apr,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 5 THEN 1 ELSE 0 END), 0) as mei,
                COALESCE(SUM(CASE WHEN MONTH(a.tanggal) = 6 THEN 1 ELSE 0 END), 0) as jun,
                COALESCE(SUM(CASE WHEN a.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) as total_ketidakhadiran
            FROM guru g
            LEFT JOIN absensi_guru a ON g.id_guru = a.guru_id 
                AND YEAR(a.tanggal) = ? 
                AND a.status = 'Tidak Hadir'
            GROUP BY g.id_guru, g.nama, g.nip
            ORDER BY g.nama
        `;

        const [rows] = await global.dbPool.execute(query, [tahun]);

        // Hitung persentase untuk setiap guru
        const dataWithPercentage = rows.map(row => {
            const totalKetidakhadiran = row.total_ketidakhadiran;
            // Hari efektif per bulan (konsisten dengan UI)
            const hariEfektifPerBulan = {
                7: 14, 8: 21, 9: 22, 10: 23, 11: 20, 12: 17,
                1: 15, 2: 20, 3: 22, 4: 22, 5: 21, 6: 20
            };

            // Hitung total hari efektif berdasarkan data ketidakhadiran per bulan
            let totalHariEfektif = 0;
            const bulanData = [row.jul, row.agt, row.sep, row.okt, row.nov, row.des, row.jan, row.feb, row.mar, row.apr, row.mei, row.jun];
            const bulanKeys = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

            bulanKeys.forEach((bulan, index) => {
                if (bulanData[index] > 0) {
                    totalHariEfektif += hariEfektifPerBulan[bulan];
                }
            });

            // Jika tidak ada data ketidakhadiran, gunakan total hari efektif setahun
            if (totalHariEfektif === 0) {
                totalHariEfektif = Object.values(hariEfektifPerBulan).reduce((sum, hari) => sum + hari, 0);
            }
            const persentaseKetidakhadiran = totalHariEfektif > 0 ? (totalKetidakhadiran / totalHariEfektif) * 100 : 0;
            const persentaseKehadiran = 100 - persentaseKetidakhadiran;

            return {
                ...row,
                persentase_ketidakhadiran: parseFloat(persentaseKetidakhadiran.toFixed(2)),
                persentase_kehadiran: parseFloat(persentaseKehadiran.toFixed(2))
            };
        });

        // Import required modules
        const { buildExcel } = await import('./backend/export/excelBuilder.js');
        const { getLetterhead } = await import('./backend/utils/letterheadService.js');
        const { REPORT_KEYS } = await import('./backend/utils/letterheadService.js');
        const rekapGuruSchema = await import('./backend/export/schemas/rekap-ketidakhadiran-guru-bulanan.js');

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.REKAP_KETIDAKHADIRAN_GURU });

        // Prepare data for Excel
        const reportData = dataWithPercentage.map((row, index) => ({
            no: index + 1,
            nama: row.nama,
            nip: row.nip,
            jul: row.jul,
            agt: row.agt,
            sep: row.sep,
            okt: row.okt,
            nov: row.nov,
            des: row.des,
            jan: row.jan,
            feb: row.feb,
            mar: row.mar,
            apr: row.apr,
            mei: row.mei,
            jun: row.jun,
            total_ketidakhadiran: row.total_ketidakhadiran,
            persentase_ketidakhadiran: row.persentase_ketidakhadiran / 100, // Convert to decimal for percentage format
            persentase_kehadiran: row.persentase_kehadiran / 100 // Convert to decimal for percentage format
        }));

        const reportPeriod = `Tahun ${tahun}`;

        // Generate Excel workbook
        const workbook = await buildExcel({
            title: rekapGuruSchema.default.title,
            subtitle: rekapGuruSchema.default.subtitle,
            reportPeriod: reportPeriod,
            letterhead: letterhead,
            columns: rekapGuruSchema.default.columns,
            rows: reportData
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="REKAP_KETIDAKHADIRAN_GURU_SMKN13_${tahun}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();

        console.log(`✅ Rekap ketidakhadiran guru SMKN 13 exported successfully: ${dataWithPercentage.length} records`);
    } catch (error) {
        console.error('❌ Error exporting rekap ketidakhadiran guru SMKN 13:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export rekap ketidakhadiran siswa
app.get('/api/export/rekap-ketidakhadiran-siswa', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { kelas_id, tahun, bulan, tanggal_awal, tanggal_akhir } = req.query;
        console.log('📊 Exporting rekap ketidakhadiran siswa:', { kelas_id, tahun, bulan, tanggal_awal, tanggal_akhir });

        // Get class name
        const [kelasRows] = await global.dbPool.execute(
            'SELECT nama_kelas FROM kelas WHERE id_kelas = ?',
            [kelas_id]
        );
        const kelasName = kelasRows.length > 0 ? kelasRows[0].nama_kelas : 'Unknown';

        // Get students data
        const [studentsRows] = await global.dbPool.execute(
            'SELECT s.id_siswa as id, s.nis, s.nama, s.jenis_kelamin, s.kelas_id FROM siswa s WHERE s.kelas_id = ? AND s.status = "aktif" ORDER BY s.nama ASC',
            [kelas_id]
        );

        if (studentsRows.length === 0) {
            // Import required modules for empty data
            const { buildExcel } = await import('./backend/export/excelBuilder.js');
            const { getLetterhead } = await import('./backend/utils/letterheadService.js');
            const { REPORT_KEYS } = await import('./backend/utils/letterheadService.js');
            const rekapSiswaSchema = await import('./backend/export/schemas/rekap-ketidakhadiran-siswa.js');

            // Load letterhead configuration
            const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.REKAP_KETIDAKHADIRAN });

            let reportPeriod;
            if (tanggal_awal && tanggal_akhir) {
                reportPeriod = `${tanggal_awal} - ${tanggal_akhir}`;
            } else if (bulan) {
                reportPeriod = `${bulan} ${tahun}`;
            } else {
                reportPeriod = `Tahun ${tahun}`;
            }

            // Generate empty Excel workbook
            const workbook = await buildExcel({
                title: rekapSiswaSchema.default.title,
                subtitle: rekapSiswaSchema.default.subtitle,
                reportPeriod: reportPeriod,
                letterhead: letterhead,
                columns: rekapSiswaSchema.default.columns,
                rows: []
            });

            let filename;
            if (tanggal_awal && tanggal_akhir) {
                filename = `Rekap_Ketidakhadiran_Siswa_${kelasName}_${tanggal_awal}_${tanggal_akhir}.xlsx`;
            } else if (bulan) {
                filename = `Rekap_Ketidakhadiran_Siswa_${kelasName}_${tahun}_${bulan}.xlsx`;
            } else {
                filename = `Rekap_Ketidakhadiran_Siswa_${kelasName}_${tahun}.xlsx`;
            }

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            await workbook.xlsx.write(res);
            res.end();

            console.log(`✅ Rekap ketidakhadiran siswa exported successfully: 0 records`);
            return;
        }

        // Get presensi data
        let presensiData = [];
        if (tanggal_awal && tanggal_akhir) {
            // Date range data
            const [presensiRows] = await global.dbPool.execute(`
                SELECT 
                    a.siswa_id,
                    MONTH(a.tanggal) as bulan,
                    YEAR(a.tanggal) as tahun,
                    COUNT(CASE WHEN a.status IN ('Sakit', 'Alpa', 'Izin') THEN 1 END) as total_ketidakhadiran,
                    COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as total_kehadiran,
                    COUNT(*) as total_hari_efektif,
                    ROUND((COUNT(CASE WHEN a.status IN ('Sakit', 'Alpa', 'Izin') THEN 1 END) / COUNT(*)) * 100, 2) as persentase_ketidakhadiran,
                    ROUND((COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) / COUNT(*)) * 100, 2) as persentase_kehadiran
                FROM absensi_siswa a
                INNER JOIN siswa s ON a.siswa_id = s.id_siswa
                WHERE s.kelas_id = ?
                    AND a.tanggal BETWEEN ? AND ?
                GROUP BY a.siswa_id, MONTH(a.tanggal), YEAR(a.tanggal)
                ORDER BY a.siswa_id, MONTH(a.tanggal)
            `, [kelas_id, tanggal_awal, tanggal_akhir]);
            presensiData = presensiRows;
        } else if (bulan) {
            // Monthly data
            const [presensiRows] = await global.dbPool.execute(`
                SELECT 
                    a.siswa_id,
                    MONTH(a.tanggal) as bulan,
                    YEAR(a.tanggal) as tahun,
                    COUNT(CASE WHEN a.status IN ('Sakit', 'Alpa', 'Izin') THEN 1 END) as total_ketidakhadiran,
                    COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as total_kehadiran,
                    COUNT(*) as total_hari_efektif,
                    ROUND((COUNT(CASE WHEN a.status IN ('Sakit', 'Alpa', 'Izin') THEN 1 END) / COUNT(*)) * 100, 2) as persentase_ketidakhadiran,
                    ROUND((COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) / COUNT(*)) * 100, 2) as persentase_kehadiran
                FROM absensi_siswa a
                INNER JOIN siswa s ON a.siswa_id = s.id_siswa
                WHERE s.kelas_id = ?
                    AND YEAR(a.tanggal) = ?
                    AND MONTH(a.tanggal) = ?
                GROUP BY a.siswa_id, MONTH(a.tanggal), YEAR(a.tanggal)
                ORDER BY a.siswa_id, MONTH(a.tanggal)
            `, [kelas_id, tahun, bulan]);
            presensiData = presensiRows;
        } else {
            // Yearly data
            const [presensiRows] = await global.dbPool.execute(`
                SELECT 
                    a.siswa_id,
                    MONTH(a.tanggal) as bulan,
                    YEAR(a.tanggal) as tahun,
                    COUNT(CASE WHEN a.status IN ('Sakit', 'Alpa', 'Izin') THEN 1 END) as total_ketidakhadiran,
                    COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) as total_kehadiran,
                    COUNT(*) as total_hari_efektif,
                    ROUND((COUNT(CASE WHEN a.status IN ('Sakit', 'Alpa', 'Izin') THEN 1 END) / COUNT(*)) * 100, 2) as persentase_ketidakhadiran,
                    ROUND((COUNT(CASE WHEN a.status = 'Hadir' THEN 1 END) / COUNT(*)) * 100, 2) as persentase_kehadiran
                FROM absensi_siswa a
                INNER JOIN siswa s ON a.siswa_id = s.id_siswa
                WHERE s.kelas_id = ?
                    AND YEAR(a.tanggal) = ?
                GROUP BY a.siswa_id, MONTH(a.tanggal), YEAR(a.tanggal)
                ORDER BY a.siswa_id, MONTH(a.tanggal)
            `, [kelas_id, tahun]);
            presensiData = presensiRows;
        }

        // Prepare data for export with monthly breakdown
        const exportData = studentsRows.map(student => {
            const studentPresensi = presensiData.filter(p => p.siswa_id === student.id);
            const totalKetidakhadiran = studentPresensi.reduce((sum, p) => sum + p.total_ketidakhadiran, 0);
            const totalKehadiran = studentPresensi.reduce((sum, p) => sum + p.total_kehadiran, 0);
            const totalHariEfektif = studentPresensi.reduce((sum, p) => sum + p.total_hari_efektif, 0);
            const persentaseKetidakhadiran = totalHariEfektif > 0 ? ((totalKetidakhadiran / totalHariEfektif) * 100).toFixed(2) : '0.00';

            // Create monthly data object
            const monthlyData = {
                jul: 0, agt: 0, sep: 0, okt: 0, nov: 0, des: 0,
                jan: 0, feb: 0, mar: 0, apr: 0, mei: 0, jun: 0
            };

            // Fill monthly data from presensi
            if (bulan) {
                // Mode bulanan - hanya isi bulan yang dipilih
                studentPresensi.forEach(p => {
                    const month = p.bulan;
                    switch (month) {
                        case 7: monthlyData.jul = p.total_ketidakhadiran; break;
                        case 8: monthlyData.agt = p.total_ketidakhadiran; break;
                        case 9: monthlyData.sep = p.total_ketidakhadiran; break;
                        case 10: monthlyData.okt = p.total_ketidakhadiran; break;
                        case 11: monthlyData.nov = p.total_ketidakhadiran; break;
                        case 12: monthlyData.des = p.total_ketidakhadiran; break;
                        case 1: monthlyData.jan = p.total_ketidakhadiran; break;
                        case 2: monthlyData.feb = p.total_ketidakhadiran; break;
                        case 3: monthlyData.mar = p.total_ketidakhadiran; break;
                        case 4: monthlyData.apr = p.total_ketidakhadiran; break;
                        case 5: monthlyData.mei = p.total_ketidakhadiran; break;
                        case 6: monthlyData.jun = p.total_ketidakhadiran; break;
                    }
                });
            } else {
                // Mode tahunan - isi semua bulan
                studentPresensi.forEach(p => {
                    const month = p.bulan;
                    switch (month) {
                        case 7: monthlyData.jul = p.total_ketidakhadiran; break;
                        case 8: monthlyData.agt = p.total_ketidakhadiran; break;
                        case 9: monthlyData.sep = p.total_ketidakhadiran; break;
                        case 10: monthlyData.okt = p.total_ketidakhadiran; break;
                        case 11: monthlyData.nov = p.total_ketidakhadiran; break;
                        case 12: monthlyData.des = p.total_ketidakhadiran; break;
                        case 1: monthlyData.jan = p.total_ketidakhadiran; break;
                        case 2: monthlyData.feb = p.total_ketidakhadiran; break;
                        case 3: monthlyData.mar = p.total_ketidakhadiran; break;
                        case 4: monthlyData.apr = p.total_ketidakhadiran; break;
                        case 5: monthlyData.mei = p.total_ketidakhadiran; break;
                        case 6: monthlyData.jun = p.total_ketidakhadiran; break;
                    }
                });
            }

            return {
                nis: student.nis,
                nama: student.nama,
                jenis_kelamin: student.jenis_kelamin,
                ...monthlyData,
                total_ketidakhadiran: totalKetidakhadiran,
                persentase_ketidakhadiran: parseFloat(persentaseKetidakhadiran) / 100
            };
        });

        // Import required modules
        const { buildExcel } = await import('./backend/export/excelBuilder.js');
        const { getLetterhead } = await import('./backend/utils/letterheadService.js');
        const { REPORT_KEYS } = await import('./backend/utils/letterheadService.js');
        const rekapSiswaSchema = await import('./backend/export/schemas/rekap-ketidakhadiran-siswa.js');

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.REKAP_KETIDAKHADIRAN });

        // Create dynamic schema based on mode
        let schema = rekapSiswaSchema.default;
        let reportData;

        if (tanggal_awal && tanggal_akhir) {
            // Mode berdasarkan tanggal - tampilkan kolom periode tanggal
            schema = {
                ...rekapSiswaSchema.default,
                columns: [
                    { key: 'no', label: 'No', width: 5, align: 'center' },
                    { key: 'nama', label: 'Nama Siswa', width: 25, align: 'left' },
                    { key: 'nis', label: 'NIS', width: 12, align: 'center' },
                    { key: 'jenis_kelamin', label: 'JK', width: 8, align: 'center' },
                    { key: 'periode_tanggal', label: 'Periode Tanggal', width: 12, align: 'center' },
                    { key: 'total_ketidakhadiran', label: 'Total', width: 10, align: 'center' },
                    { key: 'persentase_ketidakhadiran', label: 'Persentase', width: 12, align: 'center', format: 'percentage' }
                ]
            };

            // Prepare data for date range mode
            reportData = exportData.map((row, index) => ({
                no: index + 1,
                nama: row.nama,
                nis: row.nis,
                jenis_kelamin: row.jenis_kelamin,
                periode_tanggal: row.total_ketidakhadiran, // Total ketidakhadiran dalam periode
                total_ketidakhadiran: row.total_ketidakhadiran,
                persentase_ketidakhadiran: row.persentase_ketidakhadiran
            }));
        } else if (bulan) {
            // Mode bulanan - hanya tampilkan kolom bulan yang dipilih
            const months = [
                { key: 'jul', name: 'Juli', number: 7 },
                { key: 'agt', name: 'Agustus', number: 8 },
                { key: 'sep', name: 'September', number: 9 },
                { key: 'okt', name: 'Oktober', number: 10 },
                { key: 'nov', name: 'November', number: 11 },
                { key: 'des', name: 'Desember', number: 12 },
                { key: 'jan', name: 'Januari', number: 1 },
                { key: 'feb', name: 'Februari', number: 2 },
                { key: 'mar', name: 'Maret', number: 3 },
                { key: 'apr', name: 'April', number: 4 },
                { key: 'mei', name: 'Mei', number: 5 },
                { key: 'jun', name: 'Juni', number: 6 }
            ];

            const selectedMonth = months.find(m => m.number === parseInt(bulan));

            schema = {
                ...rekapSiswaSchema.default,
                columns: [
                    { key: 'no', label: 'No', width: 5, align: 'center' },
                    { key: 'nama', label: 'Nama Siswa', width: 25, align: 'left' },
                    { key: 'nis', label: 'NIS', width: 12, align: 'center' },
                    { key: 'jenis_kelamin', label: 'JK', width: 8, align: 'center' },
                    { key: selectedMonth.key, label: selectedMonth.name, width: 12, align: 'center' },
                    { key: 'total_ketidakhadiran', label: 'Total', width: 10, align: 'center' },
                    { key: 'persentase_ketidakhadiran', label: 'Persentase', width: 12, align: 'center', format: 'percentage' }
                ]
            };

            // Prepare data for monthly mode
            reportData = exportData.map((row, index) => ({
                no: index + 1,
                nama: row.nama,
                nis: row.nis,
                jenis_kelamin: row.jenis_kelamin,
                [selectedMonth.key]: row[selectedMonth.key],
                total_ketidakhadiran: row.total_ketidakhadiran,
                persentase_ketidakhadiran: row.persentase_ketidakhadiran
            }));
        } else {
            // Mode tahunan - tampilkan semua kolom bulan
            reportData = exportData.map((row, index) => ({
                no: index + 1,
                nama: row.nama,
                nis: row.nis,
                jenis_kelamin: row.jenis_kelamin,
                jul: row.jul,
                agt: row.agt,
                sep: row.sep,
                okt: row.okt,
                nov: row.nov,
                des: row.des,
                jan: row.jan,
                feb: row.feb,
                mar: row.mar,
                apr: row.apr,
                mei: row.mei,
                jun: row.jun,
                total_ketidakhadiran: row.total_ketidakhadiran,
                persentase_ketidakhadiran: row.persentase_ketidakhadiran
            }));
        }

        let reportPeriod;
        if (tanggal_awal && tanggal_akhir) {
            reportPeriod = `${tanggal_awal} - ${tanggal_akhir}`;
        } else if (bulan) {
            reportPeriod = `${bulan} ${tahun}`;
        } else {
            reportPeriod = `Tahun ${tahun}`;
        }

        // Generate Excel workbook
        const workbook = await buildExcel({
            title: schema.title,
            subtitle: schema.subtitle,
            reportPeriod: reportPeriod,
            letterhead: letterhead,
            columns: schema.columns,
            rows: reportData
        });

        let filename;
        if (tanggal_awal && tanggal_akhir) {
            filename = `Rekap_Ketidakhadiran_Siswa_${kelasName}_${tanggal_awal}_${tanggal_akhir}.xlsx`;
        } else if (bulan) {
            filename = `Rekap_Ketidakhadiran_Siswa_${kelasName}_${tahun}_${bulan}.xlsx`;
        } else {
            filename = `Rekap_Ketidakhadiran_Siswa_${kelasName}_${tahun}.xlsx`;
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        await workbook.xlsx.write(res);
        res.end();

        console.log(`✅ Rekap ketidakhadiran siswa exported successfully: ${exportData.length} records`);
    } catch (error) {
        console.error('❌ Error exporting rekap ketidakhadiran siswa:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export presensi siswa
app.get('/api/export/presensi-siswa', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { kelas_id, bulan, tahun } = req.query;
        console.log('📊 Exporting presensi siswa:', { kelas_id, bulan, tahun });

        // Get class name
        const [kelasRows] = await global.dbPool.execute(
            'SELECT nama_kelas FROM kelas WHERE id_kelas = ?',
            [kelas_id]
        );
        const kelasName = kelasRows.length > 0 ? kelasRows[0].nama_kelas : 'Unknown';

        // Get students data
        const [studentsRows] = await global.dbPool.execute(
            'SELECT s.id_siswa as id, s.nis, s.nama, s.jenis_kelamin, s.kelas_id FROM siswa s WHERE s.kelas_id = ? AND s.status = "aktif" ORDER BY s.nama ASC',
            [kelas_id]
        );

        // Get presensi data for the month
        const [presensiRows] = await global.dbPool.execute(`
            SELECT 
                a.siswa_id,
                DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal,
                a.status,
                a.keterangan
            FROM absensi_siswa a
            INNER JOIN siswa s ON a.siswa_id = s.id_siswa
            WHERE s.kelas_id = ?
                AND YEAR(a.tanggal) = ?
                AND MONTH(a.tanggal) = ?
            ORDER BY a.siswa_id, a.tanggal
        `, [kelas_id, tahun, bulan]);

        // Prepare data for export
        const exportData = studentsRows.map(student => {
            const studentPresensi = presensiRows.filter(p => p.siswa_id === student.id);

            // Create attendance record for each day of the month
            const daysInMonth = new Date(parseInt(tahun), parseInt(bulan), 0).getDate();
            const attendanceRecord = {};
            const keteranganList = [];

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${tahun}-${bulan.padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                const presensi = studentPresensi.find(p => p.tanggal === dateStr);
                attendanceRecord[`hari_${day}`] = presensi ? presensi.status : '';

                // Collect keterangan for KET column
                if (presensi && presensi.keterangan) {
                    keteranganList.push(`${day}: ${presensi.keterangan}`);
                }
            }

            return {
                nis: student.nis,
                nama: student.nama,
                jenis_kelamin: student.jenis_kelamin,
                keterangan: keteranganList.join('; '), // Combine all keterangan
                ...attendanceRecord
            };
        });

        // Import required modules
        const { buildExcel } = await import('./backend/export/excelBuilder.js');
        const { getLetterhead } = await import('./backend/utils/letterheadService.js');
        const { REPORT_KEYS } = await import('./backend/utils/letterheadService.js');
        const { generatePresensiColumns } = await import('./backend/export/schemas/presensi-siswa-detail.js');

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.PRESENSI_SISWA });

        // Generate dynamic columns for days of month
        const daysInMonth = new Date(parseInt(tahun), parseInt(bulan), 0).getDate();
        const columns = generatePresensiColumns(daysInMonth);

        // Prepare data for Excel
        const reportData = exportData.map((row, index) => ({
            no: index + 1,
            nama: row.nama,
            nis: row.nis,
            jenis_kelamin: row.jenis_kelamin,
            keterangan: row.keterangan || '', // Include keterangan
            ...row // Include all day columns
        }));

        const reportPeriod = `${bulan}/${tahun}`;

        // Generate Excel workbook
        const workbook = await buildExcel({
            title: 'Presensi Siswa',
            subtitle: 'Format Presensi Siswa SMKN 13',
            reportPeriod: reportPeriod,
            showLetterhead: letterhead.enabled,
            letterhead: letterhead,
            columns: columns,
            rows: reportData
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Presensi_Siswa_${kelasName}_${bulan}_${tahun}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();

        console.log(`✅ Presensi siswa exported successfully: ${exportData.length} records`);
    } catch (error) {
        console.error('❌ Error exporting presensi siswa:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================================
// EXCEL TEMPLATE & IMPORT ENDPOINTS (ADMIN)
// ================================================

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
        if (allowed.includes(file.mimetype)) return cb(null, true);
        cb(new Error('File harus .xlsx'));
    }
});

function sheetToJsonByHeader(worksheet) {
    const rows = [];
    const header = [];
    worksheet.getRow(1).eachCell((cell, col) => {
        header[col] = String((cell.value || '').toString().trim());
    });
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const obj = {};
        header.forEach((key, col) => {
            if (!key) return;
            const cell = row.getCell(col);
            obj[key] = cell && cell.value != null ? (typeof cell.value === 'object' && cell.value.text ? cell.value.text : cell.value) : '';
        });
        const allEmpty = Object.values(obj).every(v => v === '' || v == null);
        if (!allEmpty) rows.push(obj);
    });
    return rows;
}

// ========== MAPEL ==========
app.get('/api/admin/templates/mapel', authenticateToken, requireRole(['admin']), async (req, res) => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('mapel');
    ws.columns = [
        { header: 'kode_mapel', key: 'kode_mapel', width: 20 },
        { header: 'nama_mapel', key: 'nama_mapel', width: 30 },
        { header: 'deskripsi', key: 'deskripsi', width: 40 },
        { header: 'status', key: 'status', width: 15 },
    ];
    ws.addRow({ kode_mapel: 'BING-02', nama_mapel: 'Bahasa Inggris Wajib', deskripsi: 'Contoh deskripsi', status: 'aktif' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-mapel.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
});

app.post('/api/admin/import/mapel', authenticateToken, requireRole(['admin']), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const ws = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(ws);

        // Detect format (basic or friendly)
        const isBasicFormat = rows[0] && rows[0].hasOwnProperty('kode_mapel');

        const errors = [];
        const valid = [];
        const seenKode = new Set();

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const rowErrors = [];
            const rowNum = i + 2; // Excel row number

            try {
                // Validasi umum - perbaiki field mapping
                const kodeMapel = r.kode_mapel || r['Kode Mapel'] || r['kode_mapel'];
                const namaMapel = r.nama_mapel || r['Nama Mapel'] || r['nama_mapel'];
                const deskripsi = r.deskripsi || r.Deskripsi || r['deskripsi'];
                const status = r.status || r.Status || r['status'];

                if (!kodeMapel) rowErrors.push('kode_mapel wajib');
                if (!namaMapel) rowErrors.push('nama_mapel wajib');

                if (status && !['aktif', 'nonaktif'].includes(String(status))) {
                    rowErrors.push('status tidak valid');
                }

                if (kodeMapel) {
                    const k = String(kodeMapel).trim();
                    if (seenKode.has(k)) {
                        rowErrors.push('kode_mapel duplikat di file');
                    }
                    seenKode.add(k);
                }

                if (rowErrors.length) {
                    errors.push({ index: rowNum, errors: rowErrors });
                } else {
                    valid.push({
                        kode_mapel: String(kodeMapel).trim(),
                        nama_mapel: String(namaMapel).trim(),
                        deskripsi: deskripsi ? String(deskripsi).trim() : null,
                        status: status ? String(status).trim() : 'aktif'
                    });
                }
            } catch (error) {
                errors.push({ index: rowNum, errors: [error.message] });
            }
        }

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20), // Kirim preview data untuk 20 baris pertama
                message: 'Dry run completed. No data was imported.'
            });
        }
        if (valid.length === 0) return res.status(400).json({ error: 'Tidak ada baris valid untuk diimpor', errors });

        const conn = await global.dbPool.getConnection();
        try {
            await conn.beginTransaction();
            for (const v of valid) {
                await conn.execute(
                    `INSERT INTO mapel (kode_mapel, nama_mapel, deskripsi, status)
                     VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE nama_mapel = VALUES(nama_mapel), deskripsi = VALUES(deskripsi), status = VALUES(status)`,
                    [v.kode_mapel, v.nama_mapel, v.deskripsi, v.status]
                );
            }
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }

        res.json({ success: true, inserted_or_updated: valid.length, invalid: errors.length, errors });
    } catch (err) {
        console.error('❌ Import mapel error:', err);
        res.status(500).json({ error: 'Gagal impor mapel' });
    }
});

// ========== KELAS ==========
app.get('/api/admin/templates/kelas', authenticateToken, requireRole(['admin']), async (req, res) => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('kelas');
    ws.columns = [
        { header: 'nama_kelas', key: 'nama_kelas', width: 25 },
        { header: 'tingkat', key: 'tingkat', width: 10 },
        { header: 'status', key: 'status', width: 15 },
    ];
    ws.addRow({ nama_kelas: 'X IPA 3', tingkat: 'X', status: 'aktif' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-kelas.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
});

app.post('/api/admin/import/kelas', authenticateToken, requireRole(['admin']), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const ws = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(ws);

        // Detect format (basic or friendly)
        const isBasicFormat = rows[0] && rows[0].hasOwnProperty('nama_kelas');

        const errors = [];
        const valid = [];
        const seenNama = new Set();

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const rowErrors = [];
            const rowNum = i + 2; // Excel row number

            try {
                // Validasi umum - perbaiki field mapping
                const namaKelas = r.nama_kelas || r['Nama Kelas'] || r['nama_kelas'];
                const tingkat = r.tingkat || r.Tingkat || r['tingkat'];
                const status = r.status || r.Status || r['status'];

                if (!namaKelas) rowErrors.push('nama_kelas wajib');

                if (status && !['aktif', 'nonaktif'].includes(String(status))) {
                    rowErrors.push('status tidak valid');
                }

                if (namaKelas) {
                    const n = String(namaKelas).trim();
                    if (seenNama.has(n)) {
                        rowErrors.push('nama_kelas duplikat di file');
                    }
                    seenNama.add(n);
                }

                if (rowErrors.length) {
                    errors.push({ index: rowNum, errors: rowErrors });
                } else {
                    valid.push({
                        nama_kelas: String(namaKelas).trim(),
                        tingkat: tingkat ? String(tingkat).trim() : null,
                        status: status ? String(status).trim() : 'aktif'
                    });
                }
            } catch (error) {
                errors.push({ index: rowNum, errors: [error.message] });
            }
        }

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20), // Kirim preview data untuk 20 baris pertama
                message: 'Dry run completed. No data was imported.'
            });
        }
        if (valid.length === 0) return res.status(400).json({ error: 'Tidak ada baris valid untuk diimpor', errors });

        const conn = await global.dbPool.getConnection();
        try {
            await conn.beginTransaction();
            for (const v of valid) {
                await conn.execute(
                    `INSERT INTO kelas (nama_kelas, tingkat, status)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE tingkat = VALUES(tingkat), status = VALUES(status)`,
                    [v.nama_kelas, v.tingkat, v.status]
                );
            }
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }

        res.json({ success: true, inserted_or_updated: valid.length, invalid: errors.length, errors });
    } catch (err) {
        console.error('❌ Import kelas error:', err);
        res.status(500).json({ error: 'Gagal impor kelas' });
    }
});

// ========== RUANG KELAS ==========
app.get('/api/admin/templates/ruang', authenticateToken, requireRole(['admin']), async (req, res) => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('ruang');
    ws.columns = [
        { header: 'kode_ruang', key: 'kode_ruang', width: 15 },
        { header: 'nama_ruang', key: 'nama_ruang', width: 25 },
        { header: 'lokasi', key: 'lokasi', width: 30 },
        { header: 'kapasitas', key: 'kapasitas', width: 10 },
        { header: 'status', key: 'status', width: 15 },
    ];
    ws.addRow({ kode_ruang: 'R101', nama_ruang: 'Ruang 101', lokasi: 'Lantai 1', kapasitas: 30, status: 'aktif' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-ruang.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
});

app.post('/api/admin/import/ruang', authenticateToken, requireRole(['admin']), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const ws = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(ws);

        // Detect format (basic or friendly)
        const isBasicFormat = rows[0] && rows[0].hasOwnProperty('kode_ruang');

        const errors = [];
        const valid = [];
        const seenKode = new Set();

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const rowErrors = [];
            const rowNum = i + 2; // Excel row number

            try {
                // Validasi umum
                const kodeRuang = r.kode_ruang || r['Kode Ruang'];
                const namaRuang = r.nama_ruang || r['Nama Ruang'];
                const lokasi = r.lokasi || r.Lokasi;
                const kapasitas = r.kapasitas || r.Kapasitas;
                const status = r.status || r.Status;

                if (!kodeRuang) rowErrors.push('kode_ruang wajib');
                if (!namaRuang) rowErrors.push('nama_ruang wajib');

                if (status && !['aktif', 'nonaktif'].includes(String(status))) {
                    rowErrors.push('status tidak valid');
                }

                if (kapasitas && isNaN(Number(kapasitas))) {
                    rowErrors.push('kapasitas harus berupa angka');
                }

                if (kodeRuang) {
                    const k = String(kodeRuang).trim();
                    if (seenKode.has(k)) {
                        rowErrors.push('kode_ruang duplikat di file');
                    }
                    seenKode.add(k);
                }

                if (rowErrors.length) {
                    errors.push({ index: rowNum, errors: rowErrors });
                } else {
                    valid.push({
                        kode_ruang: String(kodeRuang).trim(),
                        nama_ruang: String(namaRuang).trim(),
                        lokasi: lokasi ? String(lokasi).trim() : null,
                        kapasitas: kapasitas ? Number(kapasitas) : null,
                        status: status ? String(status).trim() : 'aktif'
                    });
                }
            } catch (error) {
                errors.push({ index: rowNum, errors: [error.message] });
            }
        }

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20), // Kirim preview data untuk 20 baris pertama
                message: 'Dry run completed. No data was imported.'
            });
        }
        if (valid.length === 0) return res.status(400).json({ error: 'Tidak ada baris valid untuk diimpor', errors });

        const conn = await global.dbPool.getConnection();
        try {
            await conn.beginTransaction();
            for (const v of valid) {
                await conn.execute(
                    `INSERT INTO ruang_kelas (kode_ruang, nama_ruang, lokasi, kapasitas, status)
                     VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE nama_ruang = VALUES(nama_ruang), lokasi = VALUES(lokasi), kapasitas = VALUES(kapasitas), status = VALUES(status)`,
                    [v.kode_ruang, v.nama_ruang, v.lokasi, v.kapasitas, v.status]
                );
            }
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }

        res.json({ success: true, inserted_or_updated: valid.length, invalid: errors.length, errors });
    } catch (err) {
        console.error('❌ Import ruang error:', err);
        res.status(500).json({ error: 'Gagal impor ruang' });
    }
});

// ========== JADWAL ==========
app.get('/api/admin/templates/jadwal', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        // Redirect ke template friendly sebagai default
        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Template Input
        const inputSheet = workbook.addWorksheet('Data Jadwal');
        inputSheet.columns = [
            { header: 'Kelas', key: 'kelas', width: 15 },
            { header: 'Mata Pelajaran', key: 'mapel', width: 20 },
            { header: 'Guru', key: 'guru', width: 25 },
            { header: 'Guru Tambahan', key: 'guru_tambahan', width: 25 },
            { header: 'Kode Ruang', key: 'ruang', width: 15 },
            { header: 'Hari', key: 'hari', width: 15 },
            { header: 'Jam Ke', key: 'jam_ke', width: 10 },
            { header: 'Jam Mulai', key: 'jam_mulai', width: 12 },
            { header: 'Jam Selesai', key: 'jam_selesai', width: 12 },
            { header: 'Jenis Aktivitas', key: 'jenis_aktivitas', width: 18 },
            { header: 'Keterangan Khusus', key: 'keterangan_khusus', width: 25 }
        ];

        // Tambahkan contoh data untuk pelajaran
        inputSheet.addRow({
            kelas: 'X IPA 1',
            mapel: 'Matematika',
            guru: 'Budi Santoso',
            guru_tambahan: 'Siti Aminah, Ahmad Rizki',
            ruang: 'LAB-01',
            hari: 'Senin',
            jam_ke: 1,
            jam_mulai: '07:00:00',
            jam_selesai: '07:45:00',
            jenis_aktivitas: 'pelajaran',
            keterangan_khusus: 'Team Teaching'
        });

        // Tambahkan contoh data untuk upacara (field kosong untuk mapel dan guru)
        inputSheet.addRow({
            kelas: 'X IPA 1',
            mapel: '', // KOSONG untuk upacara
            guru: '', // KOSONG untuk upacara
            guru_tambahan: '', // KOSONG untuk upacara
            ruang: '',
            hari: 'Senin',
            jam_ke: 0,
            jam_mulai: '07:00:00',
            jam_selesai: '07:30:00',
            jenis_aktivitas: 'upacara',
            keterangan_khusus: 'Upacara Bendera' // WAJIB untuk upacara
        });

        // Sheet 2-5: Referensi
        const [kelas] = await global.dbPool.execute('SELECT id_kelas, nama_kelas FROM kelas WHERE status = "aktif"');
        const kelasSheet = workbook.addWorksheet('Ref Kelas');
        kelasSheet.addRow(['ID', 'Nama Kelas']);
        kelas.forEach(k => kelasSheet.addRow([k.id_kelas, k.nama_kelas]));

        const [mapel] = await global.dbPool.execute('SELECT id_mapel, nama_mapel FROM mapel WHERE status = "aktif"');
        const mapelSheet = workbook.addWorksheet('Ref Mapel');
        mapelSheet.addRow(['ID', 'Nama Mapel']);
        mapel.forEach(m => mapelSheet.addRow([m.id_mapel, m.nama_mapel]));

        const [guru] = await global.dbPool.execute('SELECT id_guru, nama, nip FROM guru WHERE status = "aktif"');
        const guruSheet = workbook.addWorksheet('Ref Guru');
        guruSheet.addRow(['ID', 'Nama', 'NIP']);
        guru.forEach(g => guruSheet.addRow([g.id_guru, g.nama, g.nip]));

        const [ruang] = await global.dbPool.execute('SELECT id_ruang, kode_ruang, nama_ruang FROM ruang_kelas WHERE status = "aktif"');
        const ruangSheet = workbook.addWorksheet('Ref Ruang');
        ruangSheet.addRow(['ID', 'Kode Ruang', 'Nama Ruang']);
        ruang.forEach(r => ruangSheet.addRow([r.id_ruang, r.kode_ruang, r.nama_ruang]));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template-jadwal.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating jadwal template:', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
});

app.post('/api/admin/import/jadwal', authenticateToken, requireRole(['admin']), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const ws = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(ws);

        // Detect format (basic or friendly)
        const isBasicFormat = rows[0] && rows[0].hasOwnProperty('kelas_id');

        const errors = [];
        const valid = [];
        const allowedDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const rowErrors = [];
            const rowNum = i + 2; // Excel row number

            try {
                let kelas_id, mapel_id, guru_id, ruang_id;
                let guru_ids_array = [];

                if (isBasicFormat) {
                    // Format biasa - langsung pakai ID
                    kelas_id = r.kelas_id;
                    mapel_id = r.mapel_id || null;
                    guru_id = r.guru_id || null;
                    ruang_id = r.ruang_id || null;

                    // Dukungan multi-guru via kolom guru_ids (comma-separated IDs)
                    if (r.guru_ids) {
                        const raw = String(r.guru_ids).split(',');
                        guru_ids_array = raw
                            .map(v => Number(String(v).trim()))
                            .filter(v => Number.isFinite(v));
                    }
                } else {
                    // Format friendly - mapping nama ke ID
                    kelas_id = await mapKelasByName(r.Kelas || r.kelas);
                    mapel_id = await mapMapelByName(r['Mata Pelajaran'] || r.mapel);
                    // Bisa multi nama guru dipisah koma dari kolom Guru
                    if (r.Guru || r.guru) {
                        const guruNames = String(r.Guru || r.guru)
                            .split(',')
                            .map(s => s.trim())
                            .filter(s => s.length > 0);
                        for (const name of guruNames) {
                            const gid = await mapGuruByName(name);
                            if (gid) guru_ids_array.push(Number(gid));
                        }
                    }

                    // Dukungan guru tambahan dari kolom "Guru Tambahan"
                    if (r['Guru Tambahan'] || r.guru_tambahan) {
                        const guruTambahanNames = String(r['Guru Tambahan'] || r.guru_tambahan)
                            .split(',')
                            .map(s => s.trim())
                            .filter(s => s.length > 0);
                        for (const name of guruTambahanNames) {
                            const gid = await mapGuruByName(name);
                            if (gid && !guru_ids_array.includes(Number(gid))) {
                                guru_ids_array.push(Number(gid));
                            }
                        }
                    }
                    // Jika tidak ada daftar, fallback single guru
                    if (guru_ids_array.length === 0) {
                        guru_id = await mapGuruByName(r.Guru || r.guru);
                    } else {
                        guru_id = guru_ids_array[0];
                    }
                    ruang_id = await mapRuangByKode(r['Kode Ruang'] || r.ruang);

                    // Validasi mapping
                    if (!kelas_id) {
                        rowErrors.push(`Kelas "${r.Kelas || r.kelas}" tidak ditemukan`);
                    }

                    const jenisAktivitas = r.jenis_aktivitas || r['Jenis Aktivitas'] || 'pelajaran';
                    if (jenisAktivitas === 'pelajaran') {
                        // Untuk pelajaran, mata pelajaran dan guru wajib
                        if (!mapel_id) {
                            rowErrors.push(`Mata pelajaran "${r['Mata Pelajaran'] || r.mapel}" tidak ditemukan`);
                        }
                        // Minimal 1 guru (dari guru_id atau guru_ids)
                        if (!guru_id && guru_ids_array.length === 0) {
                            rowErrors.push(`Guru "${r.Guru || r.guru || r.guru_ids}" tidak ditemukan`);
                        }
                    } else {
                        // Untuk non-pelajaran, mata pelajaran dan guru opsional
                        // Tidak ada validasi wajib untuk mapel_id dan guru_id
                        // Keterangan khusus wajib untuk non-pelajaran
                        const keteranganKhusus = r.keterangan_khusus || r['Keterangan Khusus'] || r['keterangan_khusus'];
                        if (!keteranganKhusus || keteranganKhusus.trim() === '') {
                            rowErrors.push(`Keterangan khusus wajib untuk jenis aktivitas "${jenisAktivitas}"`);
                        }
                    }
                }

                // Validasi umum - perbaiki field mapping
                if (!r.hari && !r.Hari && !r['hari']) rowErrors.push('hari wajib');
                if (!r.jam_ke && !r['Jam Ke'] && !r['jam_ke']) rowErrors.push('jam_ke wajib');
                if (!r.jam_mulai && !r['Jam Mulai'] && !r['jam_mulai']) rowErrors.push('jam_mulai wajib');
                if (!r.jam_selesai && !r['Jam Selesai'] && !r['jam_selesai']) rowErrors.push('jam_selesai wajib');

                const hari = r.hari || r.Hari || r['hari'];
                if (hari && !allowedDays.includes(String(hari))) {
                    rowErrors.push('hari tidak valid');
                }

                // Validasi format jam 24 jam
                const jamMulai = r.jam_mulai || r['Jam Mulai'] || r['jam_mulai'];
                const jamSelesai = r.jam_selesai || r['Jam Selesai'] || r['jam_selesai'];

                if (jamMulai && !validateTimeFormat(String(jamMulai))) {
                    rowErrors.push(`Format jam mulai "${jamMulai}" tidak valid. Gunakan format 24 jam (HH:MM)`);
                }

                if (jamSelesai && !validateTimeFormat(String(jamSelesai))) {
                    rowErrors.push(`Format jam selesai "${jamSelesai}" tidak valid. Gunakan format 24 jam (HH:MM)`);
                }

                // Validasi logika waktu
                if (jamMulai && jamSelesai && validateTimeFormat(String(jamMulai)) && validateTimeFormat(String(jamSelesai))) {
                    const timeValidation = validateTimeLogic(String(jamMulai), String(jamSelesai));
                    if (!timeValidation.valid) {
                        rowErrors.push(timeValidation.error);
                    }
                }

                if (rowErrors.length) {
                    errors.push({ index: rowNum, errors: rowErrors });
                } else {
                    const jenisAktivitas = r.jenis_aktivitas || r['Jenis Aktivitas'] || r['jenis_aktivitas'] || 'pelajaran';
                    const isAbsenable = jenisAktivitas === 'pelajaran' ? 1 : 0;
                    const keteranganKhusus = r.keterangan_khusus || r['Keterangan Khusus'] || r['keterangan_khusus'] || null;
                    // Normalisasi guru_ids untuk kedua format
                    if (guru_ids_array.length === 0 && r.guru_ids) {
                        const raw = String(r.guru_ids).split(',');
                        guru_ids_array = raw
                            .map(v => Number(String(v).trim()))
                            .filter(v => Number.isFinite(v));
                    }
                    // Hilangkan duplikasi & pastikan primary di index 0 jika ada
                    const uniqueGuruIds = Array.from(new Set(guru_ids_array));
                    const primaryGuru = (guru_id ? Number(guru_id) : (uniqueGuruIds[0] || null));

                    valid.push({
                        kelas_id: Number(kelas_id),
                        mapel_id: mapel_id ? Number(mapel_id) : null,
                        guru_id: primaryGuru ? Number(primaryGuru) : null,
                        ruang_id: ruang_id ? Number(ruang_id) : null,
                        hari: String(hari),
                        jam_ke: Number(r.jam_ke || r['Jam Ke'] || r['jam_ke']),
                        jam_mulai: String(r.jam_mulai || r['Jam Mulai'] || r['jam_mulai']),
                        jam_selesai: String(r.jam_selesai || r['Jam Selesai'] || r['jam_selesai']),
                        jenis_aktivitas: jenisAktivitas,
                        is_absenable: isAbsenable,
                        keterangan_khusus: keteranganKhusus,
                        status: 'aktif',
                        guru_ids: uniqueGuruIds
                    });
                }
            } catch (error) {
                errors.push({ index: rowNum, errors: [error.message] });
            }
        }

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20), // Kirim preview data untuk 20 baris pertama
                message: 'Dry run completed. No data was imported.'
            });
        }
        if (valid.length === 0) return res.status(400).json({ error: 'Tidak ada baris valid untuk diimpor', errors });

        const conn = await global.dbPool.getConnection();
        try {
            await conn.beginTransaction();
            for (const v of valid) {
                const [insertRes] = await conn.execute(
                    `INSERT INTO jadwal (kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, status, jenis_aktivitas, is_absenable, keterangan_khusus)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [v.kelas_id, v.mapel_id, v.guru_id, v.ruang_id, v.hari, v.jam_ke, v.jam_mulai, v.jam_selesai, v.status, v.jenis_aktivitas, v.is_absenable, v.keterangan_khusus]
                );
                const jadwalId = insertRes && insertRes.insertId ? insertRes.insertId : null;
                // Jika pelajaran dan ada guru_ids, isi tabel relasi jadwal_guru
                if (jadwalId && v.jenis_aktivitas === 'pelajaran' && Array.isArray(v.guru_ids) && v.guru_ids.length > 0) {
                    for (let idx = 0; idx < v.guru_ids.length; idx++) {
                        const gid = v.guru_ids[idx];
                        await conn.execute(
                            'INSERT INTO jadwal_guru (jadwal_id, guru_id, is_primary) VALUES (?, ?, ?)',
                            [jadwalId, gid, idx === 0 ? 1 : 0]
                        );
                    }
                    if (v.guru_ids.length > 1) {
                        await conn.execute('UPDATE jadwal SET is_multi_guru = 1 WHERE id_jadwal = ?', [jadwalId]);
                    }
                }
            }
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }

        res.json({ success: true, inserted: valid.length, invalid: errors.length, errors });
    } catch (err) {
        console.error('❌ Import jadwal error:', err);
        res.status(500).json({ error: 'Gagal impor jadwal' });
    }
});

// ========== GURU ==========
app.get('/api/admin/templates/guru', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📊 Generating guru template...');

        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Data Guru - SESUAI DENGAN FORM CRUD
        const guruSheet = workbook.addWorksheet('Data Guru');
        guruSheet.columns = [
            { header: 'NIP *', key: 'nip', width: 20 },
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Username *', key: 'username', width: 20 },
            { header: 'Password *', key: 'password', width: 20 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Mata Pelajaran', key: 'mata_pelajaran', width: 25 },
            { header: 'Telepon', key: 'telepon', width: 16 },
            { header: 'Jenis Kelamin', key: 'jenis_kelamin', width: 12 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 14 },
        ];

        // Header styling
        guruSheet.getRow(1).font = { bold: true };
        guruSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE6F3FF' }
        };

        // Contoh data
        guruSheet.addRow({
            nip: '198001012005011001',
            nama: 'Budi Santoso',
            username: 'budi.santoso',
            password: 'Guru123!',
            email: 'budi@sekolah.id',
            mata_pelajaran: 'Matematika',
            telepon: '081234567890',
            jenis_kelamin: 'L',
            alamat: 'Jl. Mawar No. 1',
            status: 'aktif'
        });

        // Sheet 2: Referensi Mata Pelajaran
        const mapelSheet = workbook.addWorksheet('Referensi Mata Pelajaran');
        mapelSheet.columns = [
            { header: 'ID Mapel', key: 'id_mapel', width: 10 },
            { header: 'Kode Mapel', key: 'kode_mapel', width: 15 },
            { header: 'Nama Mapel', key: 'nama_mapel', width: 30 },
            { header: 'Status', key: 'status', width: 10 }
        ];

        // Header styling untuk referensi
        mapelSheet.getRow(1).font = { bold: true };
        mapelSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF0F8FF' }
        };

        // Ambil data mata pelajaran dari database
        try {
            const [mapelData] = await global.dbPool.execute(
                'SELECT id_mapel, kode_mapel, nama_mapel, status FROM mapel WHERE status = "aktif" ORDER BY nama_mapel'
            );

            mapelData.forEach(mapel => {
                mapelSheet.addRow({
                    id_mapel: mapel.id_mapel,
                    kode_mapel: mapel.kode_mapel,
                    nama_mapel: mapel.nama_mapel,
                    status: mapel.status
                });
            });
        } catch (error) {
            console.error('Error fetching mapel data:', error);
            // Fallback data jika database error
            mapelSheet.addRow({
                id_mapel: 1,
                kode_mapel: 'MTK-01',
                nama_mapel: 'Matematika',
                status: 'aktif'
            });
        }

        // Sheet 3: Panduan Import
        const panduanSheet = workbook.addWorksheet('Panduan Import');
        panduanSheet.columns = [
            { header: 'Field', key: 'field', width: 20 },
            { header: 'Deskripsi', key: 'deskripsi', width: 50 },
            { header: 'Contoh', key: 'contoh', width: 30 }
        ];

        panduanSheet.getRow(1).font = { bold: true };
        panduanSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF0E6' }
        };

        const panduan = [
            { field: 'NIP *', deskripsi: 'Nomor Induk Pegawai (wajib, minimal 8 karakter)', contoh: '198001012005011001' },
            { field: 'Nama Lengkap *', deskripsi: 'Nama lengkap guru (wajib)', contoh: 'Budi Santoso' },
            { field: 'Username *', deskripsi: 'Username untuk login (wajib, 4-50 karakter)', contoh: 'budi.santoso' },
            { field: 'Password *', deskripsi: 'Password untuk login (wajib, minimal 6 karakter)', contoh: 'Guru123!' },
            { field: 'Email', deskripsi: 'Alamat email guru (opsional)', contoh: 'budi@sekolah.id' },
            { field: 'Mata Pelajaran', deskripsi: 'Nama mata pelajaran yang diajar (opsional)', contoh: 'Matematika' },
            { field: 'Telepon', deskripsi: 'Nomor telepon guru (opsional)', contoh: '081234567890' },
            { field: 'Jenis Kelamin', deskripsi: 'L untuk Laki-laki, P untuk Perempuan', contoh: 'L atau P' },
            { field: 'Alamat', deskripsi: 'Alamat lengkap guru (opsional)', contoh: 'Jl. Mawar No. 1' },
            { field: 'Status', deskripsi: 'Status guru: aktif, nonaktif, atau pensiun', contoh: 'aktif' }
        ];

        panduan.forEach(p => panduanSheet.addRow(p));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="template-import-guru.xlsx"');

        console.log('📊 Writing Excel file...');
        await workbook.xlsx.write(res);
        console.log('✅ Guru template generated successfully');
        res.end();
    } catch (error) {
        console.error('Error generating guru template:', error);
        res.status(500).json({ error: 'Gagal membuat template' });
    }
});

// ========== IMPORT AKUN SISWA ==========
app.post('/api/admin/import/student-account', authenticateToken, requireRole(['admin']), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

        console.log('📊 Processing student account import...');

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const ws = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(ws);

        console.log(`📊 Found ${rows.length} rows to process`);
        console.log('📊 First row data:', rows[0]);
        console.log('📊 Available fields:', Object.keys(rows[0] || {}));

        const errors = [];
        const valid = [];
        const genderEnum = ['L', 'P'];

        // Cek duplikasi username dan NIS di database sebelum validasi
        const existingUsernames = new Set();
        const existingNis = new Set();

        try {
            const [dbUsernames] = await global.dbPool.execute('SELECT username FROM users WHERE role = "siswa"');
            const [dbNis] = await global.dbPool.execute('SELECT nis FROM siswa');

            dbUsernames.forEach(row => existingUsernames.add(row.username));
            dbNis.forEach(row => existingNis.add(row.nis));
        } catch (dbError) {
            console.error('Error checking existing data:', dbError);
            return res.status(500).json({
                error: 'Gagal memeriksa data yang sudah ada',
                message: 'Terjadi kesalahan saat memeriksa database. Coba lagi nanti.'
            });
        }

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const rowErrors = [];
            const rowNum = i + 2; // Excel row number

            try {
                // Validasi field wajib sesuai form CRUD Akun Siswa (DENGAN USERNAME/PASSWORD)
                if (!r.nama && !r['Nama Lengkap *']) rowErrors.push('Nama lengkap wajib diisi');
                if (!r.username && !r['Username *']) rowErrors.push('Username wajib diisi');
                if (!r.password && !r['Password *']) rowErrors.push('Password wajib diisi');
                if (!r.nis && !r['NIS *']) rowErrors.push('NIS wajib diisi');
                if (!r.kelas && !r['Kelas *']) rowErrors.push('Kelas wajib diisi');

                // Validasi NIS
                const nis = r.nis || r['NIS *'];
                if (nis) {
                    const nisValue = String(nis).trim();
                    if (nisValue.length < 8) {
                        rowErrors.push('NIS minimal 8 karakter');
                    }
                    if (nisValue.length > 15) {
                        rowErrors.push('NIS maksimal 15 karakter');
                    }
                    if (!/^[0-9]+$/.test(nisValue)) {
                        rowErrors.push('NIS harus berupa angka');
                    }

                    // Cek duplikasi NIS dalam file
                    const duplicateNis = valid.find(v => v.nis === nisValue);
                    if (duplicateNis) {
                        rowErrors.push('NIS duplikat dalam file');
                    }

                    // Cek duplikasi NIS di database
                    if (existingNis.has(nisValue)) {
                        rowErrors.push('NIS sudah digunakan di database');
                    }
                }

                // Validasi Username
                const username = r.username || r['Username *'];
                if (username) {
                    const usernameValue = String(username).trim();
                    if (usernameValue.length < 4) {
                        rowErrors.push('Username minimal 4 karakter');
                    }
                    if (usernameValue.length > 50) {
                        rowErrors.push('Username maksimal 50 karakter');
                    }
                    if (!/^[a-z0-9._-]+$/.test(usernameValue)) {
                        rowErrors.push('Username harus 4-50 karakter, hanya huruf kecil, angka, titik, underscore, dan strip');
                    }

                    // Cek duplikasi username dalam file
                    const duplicateUsername = valid.find(v => v.username === usernameValue);
                    if (duplicateUsername) {
                        rowErrors.push('Username duplikat dalam file');
                    }

                    // Cek duplikasi username di database
                    if (existingUsernames.has(usernameValue)) {
                        rowErrors.push('Username sudah digunakan di database');
                    }
                }

                // Validasi Password
                const password = r.password || r['Password *'];
                if (password) {
                    const passwordValue = String(password).trim();
                    if (passwordValue.length < 6) {
                        rowErrors.push('Password minimal 6 karakter');
                    }
                }

                // Validasi email
                const email = r.email || r.Email;
                if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
                    rowErrors.push('Format email tidak valid');
                }

                // Validasi jenis kelamin
                const jenisKelamin = r.jenis_kelamin || r['Jenis Kelamin'];
                if (jenisKelamin && !genderEnum.includes(String(jenisKelamin).toUpperCase())) {
                    rowErrors.push('Jenis kelamin harus L atau P');
                }

                if (rowErrors.length) {
                    errors.push({ index: rowNum, errors: rowErrors });
                } else {
                    valid.push({
                        nama: String(r.nama || r['Nama Lengkap *']).trim(),
                        username: String(username).trim(),
                        password: String(password).trim(),
                        nis: String(nis).trim(),
                        kelas: String(r.kelas || r['Kelas *']).trim(),
                        jabatan: (r.jabatan || r.Jabatan) ? String(r.jabatan || r.Jabatan).trim() : null,
                        jenis_kelamin: jenisKelamin ? String(jenisKelamin).toUpperCase() : null,
                        email: email ? String(email).trim() : null
                    });
                }
            } catch (error) {
                errors.push({ index: rowNum, errors: [error.message] });
            }
        }

        console.log(`📊 Validation complete: ${valid.length} valid, ${errors.length} invalid`);

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20), // Kirim preview data untuk 20 baris pertama
                message: 'Dry run completed. No data was imported.'
            });
        }

        if (valid.length === 0) {
            return res.status(400).json({
                error: 'Tidak ada baris valid untuk diimpor',
                errors,
                message: 'Semua data memiliki error. Perbaiki error terlebih dahulu.'
            });
        }

        const conn = await global.dbPool.getConnection();
        try {
            await conn.beginTransaction();

            let successCount = 0;
            let duplicateCount = 0;

            for (const v of valid) {
                try {
                    // Cek apakah NIS sudah ada di database
                    const [existingSiswa] = await conn.execute(
                        'SELECT id, user_id FROM siswa WHERE nis = ?',
                        [v.nis]
                    );

                    // Cek apakah username sudah ada di database
                    const [existingUser] = await conn.execute(
                        'SELECT id FROM users WHERE username = ?',
                        [v.username]
                    );

                    if (existingUser.length > 0 && !existingSiswa.length) {
                        throw new Error(`Username '${v.username}' sudah digunakan oleh user lain`);
                    }

                    if (existingSiswa.length > 0) {
                        // Cari kelas_id berdasarkan nama kelas
                        const [kelasResult] = await conn.execute(
                            'SELECT id_kelas FROM kelas WHERE nama_kelas = ?',
                            [v.kelas]
                        );

                        if (kelasResult.length === 0) {
                            throw new Error(`Kelas '${v.kelas}' tidak ditemukan`);
                        }

                        const kelasId = kelasResult[0].id_kelas;

                        // Update data siswa yang sudah ada
                        await conn.execute(
                            `UPDATE siswa SET 
                             nama = ?, kelas_id = ?, jenis_kelamin = ?, email = ?, 
                             jabatan = ?, updated_at = CURRENT_TIMESTAMP
                             WHERE nis = ?`,
                            [v.nama, kelasId, v.jenis_kelamin, v.email, v.jabatan, v.nis]
                        );

                        // Update data user yang sudah ada
                        const hashedPassword = await bcrypt.hash(v.password, 10);
                        await conn.execute(
                            `UPDATE users SET 
                             username = ?, password = ?, nama = ?, email = ?, 
                             updated_at = CURRENT_TIMESTAMP
                             WHERE id = ?`,
                            [v.username, hashedPassword, v.nama, v.email, existingSiswa[0].user_id]
                        );

                        duplicateCount++;
                        console.log(`📝 Updated existing student account: ${v.nama} (${v.nis})`);
                    } else {
                        // Insert user baru terlebih dahulu
                        const hashedPassword = await bcrypt.hash(v.password, 10);
                        const [userResult] = await conn.execute(
                            `INSERT INTO users (username, password, role, nama, email, status, created_at, updated_at)
                             VALUES (?, ?, 'siswa', ?, ?, 'aktif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                            [v.username, hashedPassword, v.nama, v.email]
                        );

                        const userId = userResult.insertId;

                        // Cari kelas_id berdasarkan nama kelas
                        const [kelasResult] = await conn.execute(
                            'SELECT id_kelas FROM kelas WHERE nama_kelas = ?',
                            [v.kelas]
                        );

                        if (kelasResult.length === 0) {
                            throw new Error(`Kelas '${v.kelas}' tidak ditemukan`);
                        }

                        const kelasId = kelasResult[0].id_kelas;

                        // Insert siswa baru dengan user_id
                        await conn.execute(
                            `INSERT INTO siswa (nis, nama, kelas_id, jenis_kelamin, email, jabatan, user_id, status, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, 'aktif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                            [v.nis, v.nama, kelasId, v.jenis_kelamin, v.email, v.jabatan, userId]
                        );

                        successCount++;
                        console.log(`✅ Inserted new student account: ${v.nama} (${v.nis})`);
                    }
                } catch (insertError) {
                    console.error(`❌ Error processing student account ${v.nama}:`, insertError);
                    throw insertError;
                }
            }

            await conn.commit();

            console.log(`✅ Student account import completed: ${successCount} new, ${duplicateCount} updated`);

            res.json({
                success: true,
                processed: valid.length,
                new: successCount,
                updated: duplicateCount,
                invalid: errors.length,
                errors,
                message: `Import akun siswa berhasil! ${successCount} akun siswa baru ditambahkan, ${duplicateCount} akun siswa diupdate.`
            });
        } catch (e) {
            await conn.rollback();
            console.error('❌ Database transaction failed:', e);
            throw e;
        } finally {
            conn.release();
        }
    } catch (err) {
        console.error('❌ Import student account error:', err);

        // Tentukan pesan error yang sesuai
        let errorMessage = 'Terjadi kesalahan saat memproses file.';
        let userMessage = 'Periksa format file dan coba lagi.';

        if (err.message.includes('Username')) {
            errorMessage = 'Username sudah digunakan';
            userMessage = 'Gunakan username yang berbeda atau update data yang sudah ada.';
        } else if (err.message.includes('NIS')) {
            errorMessage = 'NIS sudah digunakan';
            userMessage = 'Gunakan NIS yang berbeda atau update data yang sudah ada.';
        } else if (err.message.includes('duplicate')) {
            errorMessage = 'Data duplikat ditemukan';
            userMessage = 'Periksa file untuk data yang duplikat dan hapus salah satunya.';
        } else if (err.message.includes('validation')) {
            errorMessage = 'Data tidak valid';
            userMessage = 'Periksa format data sesuai dengan template yang disediakan.';
        }

        res.status(500).json({
            error: errorMessage,
            details: err.message,
            message: userMessage
        });
    }
});

// ========== IMPORT AKUN GURU ==========
app.post('/api/admin/import/teacher-account', authenticateToken, requireRole(['admin']), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

        console.log('📊 Processing teacher account import...');

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const ws = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(ws);

        console.log(`📊 Found ${rows.length} rows to process`);
        console.log('📊 First row data:', rows[0]);
        console.log('📊 Available fields:', Object.keys(rows[0] || {}));

        const errors = [];
        const valid = [];
        const genderEnum = ['L', 'P'];

        // Cek duplikasi username dan NIP di database sebelum validasi
        const existingUsernames = new Set();
        const existingNips = new Set();

        try {
            const [dbUsernames] = await global.dbPool.execute('SELECT username FROM users WHERE role = "guru"');
            const [dbNips] = await global.dbPool.execute('SELECT nip FROM guru');

            dbUsernames.forEach(row => existingUsernames.add(row.username));
            dbNips.forEach(row => existingNips.add(row.nip));
        } catch (dbError) {
            console.error('Error checking existing data:', dbError);
            return res.status(500).json({
                error: 'Gagal memeriksa data yang sudah ada',
                message: 'Terjadi kesalahan saat memeriksa database. Coba lagi nanti.'
            });
        }

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const rowErrors = [];
            const rowNum = i + 2; // Excel row number

            try {
                // Validasi field wajib sesuai form CRUD Akun Guru (DENGAN USERNAME/PASSWORD)
                if (!r.nama && !r['Nama Lengkap *']) rowErrors.push('Nama lengkap wajib diisi');
                if (!r.nip && !r['NIP *']) rowErrors.push('NIP wajib diisi');
                if (!r.username && !r['Username *']) rowErrors.push('Username wajib diisi');
                if (!r.password && !r['Password *']) rowErrors.push('Password wajib diisi');

                // Validasi NIP
                const nip = r.nip || r['NIP *'];
                if (nip) {
                    const nipValue = String(nip).trim();
                    if (nipValue.length < 8) {
                        rowErrors.push('NIP minimal 8 karakter');
                    }
                    if (nipValue.length > 30) {
                        rowErrors.push('NIP maksimal 30 karakter');
                    }
                    if (!/^[0-9]+$/.test(nipValue)) {
                        rowErrors.push('NIP harus berupa angka');
                    }

                    // Cek duplikasi NIP dalam file
                    const duplicateNip = valid.find(v => v.nip === nipValue);
                    if (duplicateNip) {
                        rowErrors.push('NIP duplikat dalam file');
                    }

                    // Cek duplikasi NIP di database
                    if (existingNips.has(nipValue)) {
                        rowErrors.push('NIP sudah digunakan di database');
                    }
                }

                // Validasi Username
                const username = r.username || r['Username *'];
                if (username) {
                    const usernameValue = String(username).trim();
                    if (usernameValue.length < 4) {
                        rowErrors.push('Username minimal 4 karakter');
                    }
                    if (usernameValue.length > 50) {
                        rowErrors.push('Username maksimal 50 karakter');
                    }
                    if (!/^[a-z0-9._-]+$/.test(usernameValue)) {
                        rowErrors.push('Username harus 4-50 karakter, hanya huruf kecil, angka, titik, underscore, dan strip');
                    }

                    // Cek duplikasi username dalam file
                    const duplicateUsername = valid.find(v => v.username === usernameValue);
                    if (duplicateUsername) {
                        rowErrors.push('Username duplikat dalam file');
                    }

                    // Cek duplikasi username di database
                    if (existingUsernames.has(usernameValue)) {
                        rowErrors.push('Username sudah digunakan di database');
                    }
                }

                // Validasi Password
                const password = r.password || r['Password *'];
                if (password) {
                    const passwordValue = String(password).trim();
                    if (passwordValue.length < 6) {
                        rowErrors.push('Password minimal 6 karakter');
                    }
                }

                // Validasi email
                const email = r.email || r.Email;
                if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
                    rowErrors.push('Format email tidak valid');
                }

                // Validasi jenis kelamin
                const jenisKelamin = r.jenis_kelamin || r['Jenis Kelamin'];
                if (jenisKelamin && !genderEnum.includes(String(jenisKelamin).toUpperCase())) {
                    rowErrors.push('Jenis kelamin harus L atau P');
                }

                // Validasi no telepon
                const noTelp = r.no_telp || r['No. Telepon'];
                if (noTelp && String(noTelp).length < 10) {
                    rowErrors.push('Nomor telepon minimal 10 digit');
                }

                // Validasi status
                const status = r.status || r.Status;
                if (status && !['aktif', 'nonaktif'].includes(String(status).toLowerCase())) {
                    rowErrors.push('Status harus aktif atau nonaktif');
                }

                if (rowErrors.length) {
                    errors.push({ index: rowNum, errors: rowErrors });
                } else {
                    valid.push({
                        nama: String(r.nama || r['Nama Lengkap *']).trim(),
                        nip: String(nip).trim(),
                        username: String(username).trim(),
                        password: String(password).trim(),
                        email: email ? String(email).trim() : null,
                        no_telp: noTelp ? String(noTelp).trim() : null,
                        jenis_kelamin: jenisKelamin ? String(jenisKelamin).toUpperCase() : null,
                        mata_pelajaran: (r.mata_pelajaran || r['Mata Pelajaran']) ? String(r.mata_pelajaran || r['Mata Pelajaran']).trim() : null,
                        alamat: (r.alamat || r.Alamat) ? String(r.alamat || r.Alamat).trim() : null,
                        status: status ? String(status) : 'aktif'
                    });
                }
            } catch (error) {
                errors.push({ index: rowNum, errors: [error.message] });
            }
        }

        console.log(`📊 Validation complete: ${valid.length} valid, ${errors.length} invalid`);

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20), // Kirim preview data untuk 20 baris pertama
                message: 'Dry run completed. No data was imported.'
            });
        }

        if (valid.length === 0) {
            return res.status(400).json({
                error: 'Tidak ada baris valid untuk diimpor',
                errors,
                message: 'Semua data memiliki error. Perbaiki error terlebih dahulu.'
            });
        }

        const conn = await global.dbPool.getConnection();
        try {
            await conn.beginTransaction();

            let successCount = 0;
            let duplicateCount = 0;

            for (const v of valid) {
                try {
                    // Cek apakah NIP sudah ada di database
                    const [existingGuru] = await conn.execute(
                        'SELECT id, user_id FROM guru WHERE nip = ?',
                        [v.nip]
                    );

                    // Cek apakah username sudah ada di database
                    const [existingUser] = await conn.execute(
                        'SELECT id FROM users WHERE username = ?',
                        [v.username]
                    );

                    if (existingUser.length > 0 && !existingGuru.length) {
                        throw new Error(`Username '${v.username}' sudah digunakan oleh user lain`);
                    }

                    if (existingGuru.length > 0) {
                        // Update data guru yang sudah ada
                        await conn.execute(
                            `UPDATE guru SET 
                             nama = ?, email = ?, mata_pelajaran = ?, no_telp = ?, 
                             alamat = ?, jenis_kelamin = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                             WHERE nip = ?`,
                            [v.nama, v.email, v.mata_pelajaran, v.telepon, v.alamat, v.jenis_kelamin, v.status, v.nip]
                        );

                        // Update data user yang sudah ada
                        const hashedPassword = await bcrypt.hash(v.password, 10);
                        await conn.execute(
                            `UPDATE users SET 
                             username = ?, password = ?, nama = ?, email = ?, status = ?,
                             updated_at = CURRENT_TIMESTAMP
                             WHERE id = ?`,
                            [v.username, hashedPassword, v.nama, v.email, v.status, existingGuru[0].user_id]
                        );

                        duplicateCount++;
                        console.log(`📝 Updated existing teacher account: ${v.nama} (${v.nip})`);
                    } else {
                        // Insert user baru terlebih dahulu
                        const hashedPassword = await bcrypt.hash(v.password, 10);
                        const [userResult] = await conn.execute(
                            `INSERT INTO users (username, password, role, nama, email, status, created_at, updated_at)
                             VALUES (?, ?, 'guru', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                            [v.username, hashedPassword, v.nama, v.email, v.status]
                        );

                        const userId = userResult.insertId;

                        // Insert guru baru dengan user_id
                        await conn.execute(
                            `INSERT INTO guru (nip, nama, username, user_id, email, mata_pelajaran, no_telp, alamat, jenis_kelamin, status, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                            [v.nip, v.nama, v.username, userId, v.email, v.mata_pelajaran, v.telepon, v.alamat, v.jenis_kelamin, v.status]
                        );

                        successCount++;
                        console.log(`✅ Inserted new teacher account: ${v.nama} (${v.nip})`);
                    }
                } catch (insertError) {
                    console.error(`❌ Error processing teacher account ${v.nama}:`, insertError);
                    throw insertError;
                }
            }

            await conn.commit();

            console.log(`✅ Teacher account import completed: ${successCount} new, ${duplicateCount} updated`);

            res.json({
                success: true,
                processed: valid.length,
                new: successCount,
                updated: duplicateCount,
                invalid: errors.length,
                errors,
                message: `Import akun guru berhasil! ${successCount} akun guru baru ditambahkan, ${duplicateCount} akun guru diupdate.`
            });
        } catch (e) {
            await conn.rollback();
            console.error('❌ Database transaction failed:', e);
            throw e;
        } finally {
            conn.release();
        }
    } catch (err) {
        console.error('❌ Import teacher account error:', err);

        // Tentukan pesan error yang sesuai
        let errorMessage = 'Terjadi kesalahan saat memproses file.';
        let userMessage = 'Periksa format file dan coba lagi.';

        if (err.message.includes('Username')) {
            errorMessage = 'Username sudah digunakan';
            userMessage = 'Gunakan username yang berbeda atau update data yang sudah ada.';
        } else if (err.message.includes('NIP')) {
            errorMessage = 'NIP sudah digunakan';
            userMessage = 'Gunakan NIP yang berbeda atau update data yang sudah ada.';
        } else if (err.message.includes('duplicate')) {
            errorMessage = 'Data duplikat ditemukan';
            userMessage = 'Periksa file untuk data yang duplikat dan hapus salah satunya.';
        } else if (err.message.includes('validation')) {
            errorMessage = 'Data tidak valid';
            userMessage = 'Periksa format data sesuai dengan template yang disediakan.';
        }

        res.status(500).json({
            error: errorMessage,
            details: err.message,
            message: userMessage
        });
    }
});

// ========== IMPORT DATA SISWA ==========
app.post('/api/admin/import/siswa', authenticateToken, requireRole(['admin']), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

        console.log('📊 Processing data siswa import...');

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const ws = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(ws);

        console.log(`📊 Found ${rows.length} rows to process`);
        console.log('📊 First row data:', rows[0]);
        console.log('📊 Available fields:', Object.keys(rows[0] || {}));

        const errors = [];
        const valid = [];
        const genderEnum = ['L', 'P'];

        // Cek duplikasi NIS di database sebelum validasi
        const existingNis = new Set();

        try {
            const [dbNis] = await global.dbPool.execute('SELECT nis FROM siswa');
            dbNis.forEach(row => existingNis.add(row.nis));
        } catch (dbError) {
            console.error('Error checking existing data:', dbError);
            return res.status(500).json({
                error: 'Gagal memeriksa data yang sudah ada',
                message: 'Terjadi kesalahan saat memeriksa database. Coba lagi nanti.'
            });
        }

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const rowErrors = [];
            const rowNum = i + 2; // Excel row number

            try {
                // Validasi field wajib sesuai form CRUD Data Siswa (TANPA USERNAME/PASSWORD)
                if (!r.nis && !r['NIS *']) rowErrors.push('NIS wajib diisi');
                if (!r.nama && !r['Nama Lengkap *']) rowErrors.push('Nama lengkap wajib diisi');
                if (!r.kelas && !r['Kelas *']) rowErrors.push('Kelas wajib diisi');

                // Validasi NIS
                const nis = r.nis || r['NIS *'];
                if (nis) {
                    const nisValue = String(nis).trim();
                    if (nisValue.length < 8) {
                        rowErrors.push('NIS minimal 8 karakter');
                    }
                    if (nisValue.length > 15) {
                        rowErrors.push('NIS maksimal 15 karakter');
                    }
                    if (!/^[0-9]+$/.test(nisValue)) {
                        rowErrors.push('NIS harus berupa angka');
                    }

                    // Cek duplikasi NIS dalam file
                    const duplicateNis = valid.find(v => v.nis === nisValue);
                    if (duplicateNis) {
                        rowErrors.push('NIS duplikat dalam file');
                    }

                    // Cek duplikasi NIS di database
                    if (existingNis.has(nisValue)) {
                        rowErrors.push('NIS sudah digunakan di database');
                    }
                }

                // Validasi email
                const email = r.email || r.Email;
                if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
                    rowErrors.push('Format email tidak valid');
                }

                // Validasi jenis kelamin
                const jenisKelamin = r.jenis_kelamin || r['Jenis Kelamin'];
                if (jenisKelamin && !genderEnum.includes(String(jenisKelamin).toUpperCase())) {
                    rowErrors.push('Jenis kelamin harus L atau P');
                }

                if (rowErrors.length) {
                    errors.push({ index: rowNum, errors: rowErrors });
                } else {
                    valid.push({
                        nis: String(nis).trim(),
                        nama: String(r.nama || r['Nama Lengkap *']).trim(),
                        kelas: String(r.kelas || r['Kelas *']).trim(),
                        jenis_kelamin: jenisKelamin ? String(jenisKelamin).toUpperCase() : null,
                        telepon_orangtua: (r.telepon_orangtua || r['Telepon Orang Tua']) ? String(r.telepon_orangtua || r['Telepon Orang Tua']).trim() : null,
                        nomor_telepon_siswa: (r.nomor_telepon_siswa || r['Nomor Telepon Siswa']) ? String(r.nomor_telepon_siswa || r['Nomor Telepon Siswa']).trim() : null,
                        alamat: (r.alamat || r.Alamat) ? String(r.alamat || r.Alamat).trim() : null,
                        status: (r.status || r.Status) ? String(r.status || r.Status).trim() : 'aktif'
                    });
                }
            } catch (error) {
                errors.push({ index: rowNum, errors: [error.message] });
            }
        }

        console.log(`📊 Validation complete: ${valid.length} valid, ${errors.length} invalid`);

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20), // Kirim preview data untuk 20 baris pertama
                message: 'Dry run completed. No data was imported.'
            });
        }

        if (valid.length === 0) {
            return res.status(400).json({
                error: 'Tidak ada baris valid untuk diimpor',
                errors,
                message: 'Semua data memiliki error. Perbaiki error terlebih dahulu.'
            });
        }

        const conn = await global.dbPool.getConnection();
        try {
            await conn.beginTransaction();

            let successCount = 0;
            let duplicateCount = 0;

            for (const v of valid) {
                try {
                    // Cek apakah NIS sudah ada di database
                    const [existingSiswa] = await conn.execute(
                        'SELECT id FROM siswa WHERE nis = ?',
                        [v.nis]
                    );

                    if (existingSiswa.length > 0) {
                        // Cari kelas_id berdasarkan nama kelas
                        const [kelasResult] = await conn.execute(
                            'SELECT id_kelas FROM kelas WHERE nama_kelas = ?',
                            [v.kelas]
                        );

                        if (kelasResult.length === 0) {
                            throw new Error(`Kelas '${v.kelas}' tidak ditemukan`);
                        }

                        const kelasId = kelasResult[0].id_kelas;

                        // Update data siswa yang sudah ada
                        await conn.execute(
                            `UPDATE siswa SET 
                             nama = ?, kelas_id = ?, jenis_kelamin = ?, telepon_orangtua = ?, 
                             nomor_telepon_siswa = ?, alamat = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                             WHERE nis = ?`,
                            [v.nama, kelasId, v.jenis_kelamin, v.telepon_orangtua, v.nomor_telepon_siswa, v.alamat, v.status, v.nis]
                        );

                        duplicateCount++;
                        console.log(`📝 Updated existing student data: ${v.nama} (${v.nis})`);
                    } else {
                        // Cari kelas_id berdasarkan nama kelas
                        const [kelasResult] = await conn.execute(
                            'SELECT id_kelas FROM kelas WHERE nama_kelas = ?',
                            [v.kelas]
                        );

                        if (kelasResult.length === 0) {
                            throw new Error(`Kelas '${v.kelas}' tidak ditemukan`);
                        }

                        const kelasId = kelasResult[0].id_kelas;

                        // Insert data siswa baru (TANPA USERNAME/PASSWORD - hanya data profil)
                        await conn.execute(
                            `INSERT INTO siswa (nis, nama, kelas_id, jenis_kelamin, telepon_orangtua, nomor_telepon_siswa, alamat, status, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                            [v.nis, v.nama, kelasId, v.jenis_kelamin, v.telepon_orangtua, v.nomor_telepon_siswa, v.alamat, v.status]
                        );

                        successCount++;
                        console.log(`✅ Inserted new student data: ${v.nama} (${v.nis})`);
                    }
                } catch (insertError) {
                    console.error(`❌ Error processing student data ${v.nama}:`, insertError);
                    throw insertError;
                }
            }

            await conn.commit();

            console.log(`✅ Student data import completed: ${successCount} new, ${duplicateCount} updated`);

            res.json({
                success: true,
                processed: valid.length,
                new: successCount,
                updated: duplicateCount,
                invalid: errors.length,
                errors,
                message: `Import data siswa berhasil! ${successCount} data siswa baru ditambahkan, ${duplicateCount} data siswa diupdate.`
            });
        } catch (e) {
            await conn.rollback();
            console.error('❌ Database transaction failed:', e);
            throw e;
        } finally {
            conn.release();
        }
    } catch (err) {
        console.error('❌ Import student data error:', err);

        // Tentukan pesan error yang sesuai
        let errorMessage = 'Terjadi kesalahan saat memproses file.';
        let userMessage = 'Periksa format file dan coba lagi.';

        if (err.message.includes('NIS')) {
            errorMessage = 'NIS sudah digunakan';
            userMessage = 'Gunakan NIS yang berbeda atau update data yang sudah ada.';
        } else if (err.message.includes('duplicate')) {
            errorMessage = 'Data duplikat ditemukan';
            userMessage = 'Periksa file untuk data yang duplikat dan hapus salah satunya.';
        } else if (err.message.includes('validation')) {
            errorMessage = 'Data tidak valid';
            userMessage = 'Periksa format data sesuai dengan template yang disediakan.';
        }

        res.status(500).json({
            error: errorMessage,
            details: err.message,
            message: userMessage
        });
    }
});

// ========== IMPORT DATA GURU ==========
app.post('/api/admin/import/guru', authenticateToken, requireRole(['admin']), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

        console.log('📊 Processing data guru import...');

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const ws = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(ws);

        console.log(`📊 Found ${rows.length} rows to process`);
        console.log('📊 First row data:', rows[0]);
        console.log('📊 Available fields:', Object.keys(rows[0] || {}));

        const errors = [];
        const valid = [];
        const genderEnum = ['L', 'P'];
        const statusEnum = ['aktif', 'nonaktif', 'pensiun'];

        // Cek duplikasi NIP di database sebelum validasi
        const existingNips = new Set();

        try {
            const [dbNips] = await global.dbPool.execute('SELECT nip FROM guru');
            dbNips.forEach(row => existingNips.add(row.nip));
        } catch (dbError) {
            console.error('Error checking existing data:', dbError);
            return res.status(500).json({
                error: 'Gagal memeriksa data yang sudah ada',
                message: 'Terjadi kesalahan saat memeriksa database. Coba lagi nanti.'
            });
        }

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const rowErrors = [];
            const rowNum = i + 2; // Excel row number

            try {
                // Validasi field wajib sesuai form CRUD Data Guru (TANPA USERNAME/PASSWORD)
                if (!r.nip && !r['NIP *']) rowErrors.push('NIP wajib diisi');
                if (!r.nama && !r['Nama Lengkap *']) rowErrors.push('Nama lengkap wajib diisi');

                // Validasi NIP
                const nip = r.nip || r['NIP *'];
                if (nip) {
                    const nipValue = String(nip).trim();
                    if (nipValue.length < 8) {
                        rowErrors.push('NIP minimal 8 karakter');
                    }
                    if (nipValue.length > 30) {
                        rowErrors.push('NIP maksimal 30 karakter');
                    }
                    if (!/^[0-9]+$/.test(nipValue)) {
                        rowErrors.push('NIP harus berupa angka');
                    }

                    // Cek duplikasi NIP dalam file
                    const duplicateNip = valid.find(v => v.nip === nipValue);
                    if (duplicateNip) {
                        rowErrors.push('NIP duplikat dalam file');
                    }

                    // Cek duplikasi NIP di database
                    if (existingNips.has(nipValue)) {
                        rowErrors.push('NIP sudah digunakan di database');
                    }
                }

                // Validasi email - perbaiki field mapping
                const email = r.email || r.Email;
                if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
                    rowErrors.push('Format email tidak valid');
                }

                // Validasi jenis kelamin - perbaiki field mapping
                const jenisKelamin = r.jenis_kelamin || r['Jenis Kelamin'];
                if (jenisKelamin && !genderEnum.includes(String(jenisKelamin).toUpperCase())) {
                    rowErrors.push('Jenis kelamin harus L atau P');
                }

                // Validasi status - perbaiki field mapping
                const status = r.status || r.Status;
                if (status && !statusEnum.includes(String(status))) {
                    rowErrors.push('Status harus aktif, nonaktif, atau pensiun');
                }

                // Validasi telepon - perbaiki field mapping
                const telepon = r.telepon || r['Telepon'] || r['No Telepon'] || r['No. Telepon'];
                if (telepon && String(telepon).length < 10) {
                    rowErrors.push('Nomor telepon minimal 10 digit');
                }

                if (rowErrors.length) {
                    errors.push({ index: rowNum, errors: rowErrors });
                } else {
                    valid.push({
                        nip: String(nip).trim(),
                        nama: String(r.nama || r['Nama Lengkap *']).trim(),
                        email: email ? String(email).trim() : null,
                        mata_pelajaran: (r.mata_pelajaran || r['Mata Pelajaran']) ? String(r.mata_pelajaran || r['Mata Pelajaran']).trim() : null,
                        telepon: telepon ? String(telepon).trim() : null,
                        alamat: (r.alamat || r.Alamat) ? String(r.alamat || r.Alamat).trim() : null,
                        jenis_kelamin: jenisKelamin ? String(jenisKelamin).toUpperCase() : null,
                        status: status ? String(status) : 'aktif'
                    });
                }
            } catch (error) {
                errors.push({ index: rowNum, errors: [error.message] });
            }
        }

        console.log(`📊 Validation complete: ${valid.length} valid, ${errors.length} invalid`);

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20), // Kirim preview data untuk 20 baris pertama
                message: 'Dry run completed. No data was imported.'
            });
        }

        if (valid.length === 0) {
            return res.status(400).json({
                error: 'Tidak ada baris valid untuk diimpor',
                errors,
                message: 'Semua data memiliki error. Perbaiki error terlebih dahulu.'
            });
        }

        const conn = await global.dbPool.getConnection();
        try {
            await conn.beginTransaction();

            let successCount = 0;
            let duplicateCount = 0;

            for (const v of valid) {
                try {
                    // Cek apakah NIP sudah ada di database
                    const [existingGuru] = await conn.execute(
                        'SELECT id FROM guru WHERE nip = ?',
                        [v.nip]
                    );

                    if (existingGuru.length > 0) {
                        // Update data guru yang sudah ada
                        await conn.execute(
                            `UPDATE guru SET 
                             nama = ?, email = ?, mata_pelajaran = ?, no_telp = ?, 
                             alamat = ?, jenis_kelamin = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                             WHERE nip = ?`,
                            [v.nama, v.email, v.mata_pelajaran, v.telepon, v.alamat, v.jenis_kelamin, v.status, v.nip]
                        );

                        duplicateCount++;
                        console.log(`📝 Updated existing data guru: ${v.nama} (${v.nip})`);
                    } else {
                        // Insert data guru baru (TANPA USERNAME/PASSWORD - hanya data profil)
                        await conn.execute(
                            `INSERT INTO guru (nip, nama, email, mata_pelajaran, no_telp, alamat, jenis_kelamin, status, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                            [v.nip, v.nama, v.email, v.mata_pelajaran, v.telepon, v.alamat, v.jenis_kelamin, v.status]
                        );

                        successCount++;
                        console.log(`✅ Inserted new data guru: ${v.nama} (${v.nip})`);
                    }
                } catch (insertError) {
                    console.error(`❌ Error processing guru ${v.nama}:`, insertError);
                    throw insertError;
                }
            }

            await conn.commit();

            console.log(`✅ Guru import completed: ${successCount} new, ${duplicateCount} updated`);

            res.json({
                success: true,
                processed: valid.length,
                new: successCount,
                updated: duplicateCount,
                invalid: errors.length,
                errors,
                message: `Import data guru berhasil! ${successCount} data guru baru ditambahkan, ${duplicateCount} data guru diupdate.`
            });
        } catch (e) {
            await conn.rollback();
            console.error('❌ Database transaction failed:', e);
            throw e;
        } finally {
            conn.release();
        }
    } catch (err) {
        console.error('❌ Import guru error:', err);

        // Tentukan pesan error yang sesuai
        let errorMessage = 'Terjadi kesalahan saat memproses file.';
        let userMessage = 'Periksa format file dan coba lagi.';

        if (err.message.includes('NIP')) {
            errorMessage = 'NIP sudah digunakan';
            userMessage = 'Gunakan NIP yang berbeda atau update data yang sudah ada.';
        } else if (err.message.includes('duplicate')) {
            errorMessage = 'Data duplikat ditemukan';
            userMessage = 'Periksa file untuk data yang duplikat dan hapus salah satunya.';
        } else if (err.message.includes('validation')) {
            errorMessage = 'Data tidak valid';
            userMessage = 'Periksa format data sesuai dengan template yang disediakan.';
        }

        res.status(500).json({
            error: errorMessage,
            details: err.message,
            message: userMessage
        });
    }
});

// ========== SISWA ==========
// Template lama sudah diganti dengan template-basic dan template-friendly yang lebih lengkap

app.post('/api/admin/import/siswa', authenticateToken, requireRole(['admin']), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

        // Parse Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const ws = workbook.worksheets[0];
        const rows = sheetToJsonByHeader(ws);

        // Detect format (basic or friendly)
        const isBasicFormat = rows[0] && rows[0].hasOwnProperty('kelas_id');

        const errors = [];
        const valid = [];
        const genderEnum = ['L', 'P'];

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const rowErrors = [];
            const rowNum = i + 2; // Excel row number

            try {
                let kelas_id;

                if (isBasicFormat) {
                    // Format biasa - langsung pakai ID
                    kelas_id = r.kelas_id;
                } else {
                    // Format friendly - mapping nama ke ID
                    kelas_id = await mapKelasByName(r.Kelas || r.kelas);

                    // Validasi mapping
                    if (!kelas_id) {
                        rowErrors.push(`Kelas "${r.Kelas || r.kelas}" tidak ditemukan`);
                    }
                }

                // Validasi umum
                if (!r.nis && !r.NIS) rowErrors.push('nis wajib');
                if (!r.nama && !r.Nama) rowErrors.push('nama wajib');
                if (!kelas_id) rowErrors.push('kelas_id wajib');

                const jenisKelamin = r.jenis_kelamin || r['Jenis Kelamin'];
                if (jenisKelamin && !genderEnum.includes(String(jenisKelamin))) {
                    rowErrors.push('jenis_kelamin tidak valid');
                }

                const status = r.status || r.Status;
                if (status && !['aktif', 'nonaktif', 'lulus'].includes(String(status))) {
                    rowErrors.push('status tidak valid');
                }

                const username = r.username || r.Username;
                if (username && String(username).length < 4) {
                    rowErrors.push('username minimal 4 karakter');
                }

                const password = r.password || r.Password;
                if (password && String(password).length < 6) {
                    rowErrors.push('password minimal 6 karakter');
                }

                if (rowErrors.length) {
                    errors.push({ index: rowNum, errors: rowErrors });
                } else {
                    valid.push({
                        nis: String(r.nis || r.NIS).trim(),
                        nama: String(r.nama || r.Nama).trim(),
                        kelas_id: Number(kelas_id),
                        username: username ? String(username).trim() : null,
                        password: password ? String(password) : null,
                        jenis_kelamin: jenisKelamin ? String(jenisKelamin) : null,
                        email: (r.email || r.Email) ? String(r.email || r.Email).trim() : null,
                        alamat: (r.alamat || r.Alamat) ? String(r.alamat || r.Alamat).trim() : null,
                        telepon_orangtua: (r.telepon_orangtua || r['Telepon Orang Tua']) ? String(r.telepon_orangtua || r['Telepon Orang Tua']).trim() : null,
                        nomor_telepon_siswa: (r.nomor_telepon_siswa || r['Telepon Siswa']) ? String(r.nomor_telepon_siswa || r['Telepon Siswa']).trim() : null,
                        status: status ? String(status) : 'aktif'
                    });
                }
            } catch (error) {
                errors.push({ index: rowNum, errors: [error.message] });
            }
        }

        if (req.query.dryRun === 'true') {
            return res.json({
                total: rows.length,
                valid: valid.length,
                invalid: errors.length,
                errors,
                previewData: valid.slice(0, 20), // Kirim preview data untuk 20 baris pertama
                message: 'Dry run completed. No data was imported.'
            });
        }
        if (valid.length === 0) return res.status(400).json({ error: 'Tidak ada baris valid untuk diimpor', errors });

        const conn = await global.dbPool.getConnection();
        try {
            await conn.beginTransaction();
            for (const v of valid) {
                // Upsert user jika username+password diisi
                let userId = null;
                if (v.username && v.password) {
                    const hashedPassword = await bcrypt.hash(v.password, saltRounds);
                    const [userResult] = await conn.execute(
                        `INSERT INTO users (username, password, role, nama, email, status)
                         VALUES (?, ?, 'siswa', ?, ?, 'aktif')
                         ON DUPLICATE KEY UPDATE nama = VALUES(nama), email = VALUES(email), status = VALUES(status)`,
                        [v.username, hashedPassword, v.nama, v.email]
                    );
                    userId = userResult.insertId || null;
                    if (!userId) {
                        const [u] = await conn.execute('SELECT id FROM users WHERE username = ?', [v.username]);
                        if (u.length) userId = u[0].id;
                    }
                }

                // Upsert siswa by nis
                if (userId) {
                    await conn.execute(
                        `INSERT INTO siswa (id_siswa, user_id, username, nis, nama, kelas_id, jenis_kelamin, email, alamat, telepon_orangtua, nomor_telepon_siswa, status)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), username = VALUES(username), nama = VALUES(nama), kelas_id = VALUES(kelas_id), jenis_kelamin = VALUES(jenis_kelamin), email = VALUES(email), alamat = VALUES(alamat), telepon_orangtua = VALUES(telepon_orangtua), nomor_telepon_siswa = VALUES(nomor_telepon_siswa), status = VALUES(status)`,
                        [0, userId, v.username || `siswa_${v.nis}`, v.nis, v.nama, v.kelas_id, v.jenis_kelamin, v.email, v.alamat, v.telepon_orangtua, v.nomor_telepon_siswa, v.status]
                    );
                } else {
                    await conn.execute(
                        `INSERT INTO siswa (id_siswa, nis, nama, kelas_id, jenis_kelamin, email, alamat, telepon_orangtua, nomor_telepon_siswa, status)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE nama = VALUES(nama), kelas_id = VALUES(kelas_id), jenis_kelamin = VALUES(jenis_kelamin), email = VALUES(email), alamat = VALUES(alamat), telepon_orangtua = VALUES(telepon_orangtua), nomor_telepon_siswa = VALUES(nomor_telepon_siswa), status = VALUES(status)`,
                        [0, v.nis, v.nama, v.kelas_id, v.jenis_kelamin, v.email, v.alamat, v.telepon_orangtua, v.nomor_telepon_siswa, v.status]
                    );
                }
            }
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }

        res.json({ success: true, processed: valid.length, invalid: errors.length, errors });
    } catch (err) {
        console.error('❌ Import siswa error:', err);
        res.status(500).json({ error: 'Gagal impor siswa' });
    }
});
// ================================================
// SERVER INITIALIZATION
// ================================================

// Initialize database optimization and start server
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

// ================================================
// DISASTER RECOVERY SYSTEM API ENDPOINTS
// ================================================

// Get disaster recovery status
app.get('/api/admin/disaster-recovery-status', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const status = global.disasterRecoverySystem.getSystemHealth();

        res.json({
            success: true,
            data: status
        });

    } catch (error) {
        console.error('❌ Error getting disaster recovery status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Setup backup schedule
app.post('/api/admin/setup-backup-schedule', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const result = await global.disasterRecoverySystem.setupBackupSchedule();

        res.json({
            success: true,
            message: 'Backup schedule setup completed successfully',
            data: result
        });

    } catch (error) {
        console.error('❌ Error setting up backup schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify backup
app.post('/api/admin/verify-backup', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { backupPath, backupType } = req.body;

        const verificationResult = await global.disasterRecoverySystem.verifyBackupFile(backupPath, backupType);

        res.json({
            success: true,
            message: 'Backup verification completed',
            data: verificationResult
        });

    } catch (error) {
        console.error('❌ Error verifying backup:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Test backup restoration
app.post('/api/admin/test-backup-restoration', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { backupPath, testDatabase } = req.body;

        const startTime = Date.now();
        const restorationResult = await global.disasterRecoverySystem.testBackupRestoration(backupPath, testDatabase);
        const duration = Date.now() - startTime;

        res.json({
            success: true,
            message: 'Backup restoration test completed',
            data: {
                ...restorationResult,
                duration
            }
        });

    } catch (error) {
        console.error('❌ Error testing backup restoration:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get disaster recovery documentation
app.get('/api/admin/disaster-recovery-docs', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const documentation = await global.disasterRecoverySystem.getDocumentation();

        res.json({
            success: true,
            data: documentation
        });

    } catch (error) {
        console.error('❌ Error getting disaster recovery documentation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create disaster recovery backup
app.post('/api/admin/create-disaster-backup', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { type = 'full', description = 'Manual backup' } = req.body;

        const backupResult = await global.disasterRecoverySystem.createBackup(type, description);

        res.json({
            success: true,
            message: 'Disaster recovery backup created successfully',
            data: backupResult
        });

    } catch (error) {
        console.error('❌ Error creating disaster recovery backup:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get backup list
app.get('/api/admin/disaster-backup-list', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { limit = 50, type = null } = req.query;
        const backups = global.disasterRecoverySystem.getBackupList(parseInt(limit), type);

        res.json({
            success: true,
            data: backups
        });

    } catch (error) {
        console.error('❌ Error getting disaster backup list:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify backup
app.post('/api/admin/verify-backup/:backupId', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { backupId } = req.params;

        const verificationResult = await global.disasterRecoverySystem.verifyBackup(backupId);

        res.json({
            success: true,
            message: 'Backup verification completed',
            data: verificationResult
        });

    } catch (error) {
        console.error('❌ Error verifying backup:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Test recovery procedure
app.post('/api/admin/test-recovery/:procedureId', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { procedureId } = req.params;
        const { backupId } = req.body;

        const testResult = await global.disasterRecoverySystem.testRecoveryProcedure(procedureId, backupId);

        res.json({
            success: true,
            message: 'Recovery procedure test completed',
            data: testResult
        });

    } catch (error) {
        console.error('❌ Error testing recovery procedure:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get recovery procedures
app.get('/api/admin/recovery-procedures', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const procedures = global.disasterRecoverySystem.getRecoveryProcedures();

        res.json({
            success: true,
            data: procedures
        });

    } catch (error) {
        console.error('❌ Error getting recovery procedures:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================================
// SECURITY SYSTEM API ENDPOINTS
// ================================================

// Get security statistics
app.get('/api/admin/security-stats', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const stats = global.securitySystem.getSecurityStats();

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('❌ Error getting security stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get security events
app.get('/api/admin/security-events', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { limit = 100, type = null } = req.query;
        const events = global.securitySystem.getSecurityEvents(parseInt(limit), type);

        res.json({
            success: true,
            data: events
        });

    } catch (error) {
        console.error('❌ Error getting security events:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get blocked IPs
app.get('/api/admin/blocked-ips', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const blockedIPs = global.securitySystem.getBlockedIPs();

        res.json({
            success: true,
            data: blockedIPs
        });

    } catch (error) {
        console.error('❌ Error getting blocked IPs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Block IP
app.post('/api/admin/block-ip', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { ip, reason } = req.body;

        if (!ip) {
            return res.status(400).json({ error: 'IP address is required' });
        }

        global.securitySystem.blockIP(ip, reason || 'Manual block by admin');

        res.json({
            success: true,
            message: `IP ${ip} blocked successfully`
        });

    } catch (error) {
        console.error('❌ Error blocking IP:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Unblock IP
app.post('/api/admin/unblock-ip', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { ip } = req.body;

        if (!ip) {
            return res.status(400).json({ error: 'IP address is required' });
        }

        global.securitySystem.unblockIP(ip);

        res.json({
            success: true,
            message: `IP ${ip} unblocked successfully`
        });

    } catch (error) {
        console.error('❌ Error unblocking IP:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Clear security events
app.post('/api/admin/clear-security-events', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        global.securitySystem.clearSecurityEvents();

        res.json({
            success: true,
            message: 'Security events cleared successfully'
        });

    } catch (error) {
        console.error('❌ Error clearing security events:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================================
// MONITORING SYSTEM API ENDPOINTS
// ================================================

// Get system metrics
app.get('/api/admin/system-metrics', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const metrics = global.systemMonitor.getMetrics();

        res.json({
            success: true,
            data: metrics
        });

    } catch (error) {
        console.error('❌ Error getting system metrics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get system alerts
app.get('/api/admin/system-alerts', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const alerts = global.systemMonitor.getAlerts();

        res.json({
            success: true,
            data: alerts
        });

    } catch (error) {
        console.error('❌ Error getting system alerts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get performance history
app.get('/api/admin/performance-history', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { hours = 24 } = req.query;
        const history = global.systemMonitor.getPerformanceHistory(parseInt(hours));

        res.json({
            success: true,
            data: history
        });

    } catch (error) {
        console.error('❌ Error getting performance history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Clear alerts
app.post('/api/admin/clear-alerts', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        global.systemMonitor.clearAlerts();

        res.json({
            success: true,
            message: 'Alerts cleared successfully'
        });

    } catch (error) {
        console.error('❌ Error clearing alerts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================================
// LOAD BALANCER API ENDPOINTS
// ================================================

// Get load balancer statistics
app.get('/api/admin/load-balancer-stats', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const stats = global.loadBalancer.getStats();

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('❌ Error getting load balancer stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Populate sample queries for cache demonstration
app.post('/api/admin/populate-cache', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        if (global.loadBalancer) {
            await global.loadBalancer.populateSampleQueries();
            res.json({
                success: true,
                message: 'Sample queries populated successfully',
                timestamp: formatWIBTime()
            });
        } else {
            res.status(500).json({ error: 'Load balancer not available' });
        }
    } catch (error) {
        console.error('❌ Populate cache error:', error);
        res.status(500).json({ error: 'Failed to populate cache' });
    }
});

// Clear query cache
app.post('/api/admin/clear-cache', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        if (global.loadBalancer) {
            global.loadBalancer.clearQueryCache();
            res.json({
                success: true,
                message: 'Query cache cleared successfully',
                timestamp: formatWIBTime()
            });
        } else {
            res.status(500).json({ error: 'Load balancer not available' });
        }
    } catch (error) {
        console.error('❌ Clear cache error:', error);
        res.status(500).json({ error: 'Failed to clear cache' });
    }
});

// Get performance metrics
app.get('/api/admin/performance-metrics', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        if (global.performanceOptimizer) {
            const metrics = global.performanceOptimizer.getPerformanceMetrics();
            const slowQueries = global.performanceOptimizer.getSlowQueriesReport();

            res.json({
                success: true,
                data: {
                    metrics,
                    slowQueries,
                    timestamp: formatWIBTime()
                }
            });
        } else {
            res.status(500).json({ error: 'Performance optimizer not available' });
        }
    } catch (error) {
        console.error('❌ Performance metrics error:', error);
        res.status(500).json({ error: 'Failed to get performance metrics' });
    }
});

// Clear performance caches
app.post('/api/admin/clear-performance-cache', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        if (global.performanceOptimizer) {
            global.performanceOptimizer.clearCaches();
            res.json({
                success: true,
                message: 'Performance caches cleared successfully',
                timestamp: formatWIBTime()
            });
        } else {
            res.status(500).json({ error: 'Performance optimizer not available' });
        }
    } catch (error) {
        console.error('❌ Clear performance cache error:', error);
        res.status(500).json({ error: 'Failed to clear performance cache' });
    }
});

// Toggle load balancer on/off
app.post('/api/admin/toggle-load-balancer', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { enabled } = req.body;

        if (global.loadBalancer) {
            if (enabled) {
                await global.loadBalancer.enable();
                console.log('✅ Load balancer enabled');
            } else {
                await global.loadBalancer.disable();
                console.log('⏸️ Load balancer disabled');
            }
        }

        res.json({
            success: true,
            message: `Load balancer ${enabled ? 'enabled' : 'disabled'} successfully`,
            enabled: enabled
        });

    } catch (error) {
        console.error('❌ Error toggling load balancer:', error);
        res.status(500).json({ error: 'Failed to toggle load balancer' });
    }
});

// Test endpoint for debugging (no auth required)
app.get('/api/test/system-performance', async (req, res) => {
    try {
        console.log('🔍 Test endpoint called');
        console.log('🔍 Debug: global.loadBalancer exists:', !!global.loadBalancer);

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
            circuitBreaker: {
                isOpen: false,
                failureCount: 0,
                successCount: 0
            },
            queueSizes: {
                critical: 0,
                high: 0,
                normal: 0,
                low: 0
            },
            totalQueueSize: 0
        };

        // Get query optimizer stats from load balancer (integrated)
        const queryOptimizerStats = global.loadBalancer ? {
            queryStats: global.loadBalancer.getQueryStats(),
            cacheStats: global.loadBalancer.getCacheStats()
        } : {
            queryStats: {},
            cacheStats: { size: 0, entries: [] }
        };

        // Get comprehensive system metrics with device-specific detection
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        const uptime = process.uptime();

        // Get system information for device-specific monitoring
        const os = await import('os');
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const cpus = os.cpus();
        const platform = os.platform();
        const arch = os.arch();
        const hostname = os.hostname();
        const loadAvg = os.loadavg();

        // Calculate CPU usage percentage more accurately
        let cpuUsagePercent = 0;
        if (global.lastCpuUsage) {
            const userDiff = cpuUsage.user - global.lastCpuUsage.user;
            const systemDiff = cpuUsage.system - global.lastCpuUsage.system;
            const totalDiff = userDiff + systemDiff;

            // Calculate percentage based on time elapsed
            const timeElapsed = Date.now() - (global.lastCpuTime || Date.now());
            if (timeElapsed > 0) {
                cpuUsagePercent = Math.min(100, Math.max(0, (totalDiff / (timeElapsed * 1000)) * 100));
            }
        }
        global.lastCpuUsage = cpuUsage;
        global.lastCpuTime = Date.now();

        // Validate and sanitize memory usage data with device-specific information
        const systemMetrics = {
            uptime: typeof uptime === 'number' && !isNaN(uptime) ? uptime : 0,
            memory: {
                // Process memory (Node.js heap)
                used: typeof memoryUsage.heapUsed === 'number' && !isNaN(memoryUsage.heapUsed) ? memoryUsage.heapUsed : 0,
                total: typeof memoryUsage.heapTotal === 'number' && !isNaN(memoryUsage.heapTotal) ? memoryUsage.heapTotal : 1,
                external: typeof memoryUsage.external === 'number' && !isNaN(memoryUsage.external) ? memoryUsage.external : 0,
                arrayBuffers: typeof memoryUsage.arrayBuffers === 'number' && !isNaN(memoryUsage.arrayBuffers) ? memoryUsage.arrayBuffers : 0,
                // System memory (device total)
                systemTotal: totalMemory,
                systemUsed: usedMemory,
                systemFree: freeMemory,
                systemPercentage: totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0
            },
            cpu: {
                user: typeof cpuUsage.user === 'number' && !isNaN(cpuUsage.user) ? cpuUsage.user : 0,
                system: typeof cpuUsage.system === 'number' && !isNaN(cpuUsage.system) ? cpuUsage.system : 0,
                usage: cpuUsagePercent,
                cores: cpus.length,
                model: cpus && cpus[0] && cpus[0].model ? cpus[0].model : 'CPU Model Not Available',
                speed: cpus[0]?.speed || 0,
                loadAverage: loadAvg
            },
            device: {
                platform: platform || 'Unknown',
                architecture: arch || 'Unknown',
                hostname: hostname || 'Unknown',
                type: platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : platform === 'linux' ? 'Linux' : platform || 'Unknown',
                cores: cpus ? cpus.length : 0,
                totalMemory: totalMemory || 0,
                memoryFormatted: totalMemory ? formatBytes(totalMemory) : '0 Bytes'
            }
        };

        // Get Redis stats if available
        let redisStats = null;
        if (global.redis && global.redis.isOpen) {
            try {
                const info = await global.redis.info();
                redisStats = {
                    connected: true,
                    info: info
                };
            } catch (redisError) {
                redisStats = {
                    connected: false,
                    error: redisError.message
                };
            }
        } else {
            redisStats = {
                connected: false,
                error: 'Redis not available'
            };
        }

        const performanceData = {
            loadBalancer: loadBalancerStats,
            queryOptimizer: queryOptimizerStats,
            redis: redisStats,
            system: systemMetrics
        };

        res.json({
            success: true,
            data: performanceData
        });

    } catch (error) {
        console.error('❌ Error getting system performance data:', error);
        console.error('❌ Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get comprehensive system performance data
app.get('/api/admin/system-performance', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        // Get load balancer stats
        console.log('🔍 Debug: global.loadBalancer exists:', !!global.loadBalancer);
        const loadBalancerStats = global.loadBalancer ? global.loadBalancer.getStats() : {
            totalRequests: 0,
            activeRequests: 0,
            completedRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            circuitBreakerTrips: 0,
            burstDetections: 0,
            lastBurstTime: null,
            circuitBreaker: {
                isOpen: false,
                failureCount: 0,
                successCount: 0
            },
            queueSizes: {
                critical: 0,
                high: 0,
                normal: 0,
                low: 0
            },
            totalQueueSize: 0
        };

        // Get query optimizer stats from load balancer (integrated)
        const queryOptimizerStats = global.loadBalancer ? {
            queryStats: global.loadBalancer.getQueryStats(),
            cacheStats: global.loadBalancer.getCacheStats()
        } : {
            queryStats: {},
            cacheStats: { size: 0, entries: [] }
        };

        // Get comprehensive system metrics with device-specific detection
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        const uptime = process.uptime();

        // Get system information for device-specific monitoring
        const os = await import('os');
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const cpus = os.cpus();
        const platform = os.platform();
        const arch = os.arch();
        const hostname = os.hostname();
        const loadAvg = os.loadavg();

        // Calculate CPU usage percentage more accurately
        let cpuUsagePercent = 0;
        if (global.lastCpuUsage) {
            const userDiff = cpuUsage.user - global.lastCpuUsage.user;
            const systemDiff = cpuUsage.system - global.lastCpuUsage.system;
            const totalDiff = userDiff + systemDiff;

            // Calculate percentage based on time elapsed
            const timeElapsed = Date.now() - (global.lastCpuTime || Date.now());
            if (timeElapsed > 0) {
                cpuUsagePercent = Math.min(100, Math.max(0, (totalDiff / (timeElapsed * 1000)) * 100));
            }
        }
        global.lastCpuUsage = cpuUsage;
        global.lastCpuTime = Date.now();

        // Validate and sanitize memory usage data with device-specific information
        const systemMetrics = {
            uptime: typeof uptime === 'number' && !isNaN(uptime) ? uptime : 0,
            memory: {
                // Process memory (Node.js heap)
                used: typeof memoryUsage.heapUsed === 'number' && !isNaN(memoryUsage.heapUsed) ? memoryUsage.heapUsed : 0,
                total: typeof memoryUsage.heapTotal === 'number' && !isNaN(memoryUsage.heapTotal) ? memoryUsage.heapTotal : 1,
                external: typeof memoryUsage.external === 'number' && !isNaN(memoryUsage.external) ? memoryUsage.external : 0,
                arrayBuffers: typeof memoryUsage.arrayBuffers === 'number' && !isNaN(memoryUsage.arrayBuffers) ? memoryUsage.arrayBuffers : 0,
                // System memory (device total)
                systemTotal: totalMemory,
                systemUsed: usedMemory,
                systemFree: freeMemory,
                systemPercentage: totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0
            },
            cpu: {
                user: typeof cpuUsage.user === 'number' && !isNaN(cpuUsage.user) ? cpuUsage.user : 0,
                system: typeof cpuUsage.system === 'number' && !isNaN(cpuUsage.system) ? cpuUsage.system : 0,
                usage: cpuUsagePercent,
                cores: cpus.length,
                model: cpus && cpus[0] && cpus[0].model ? cpus[0].model : 'CPU Model Not Available',
                speed: cpus[0]?.speed || 0,
                loadAverage: loadAvg
            },
            device: {
                platform: platform || 'Unknown',
                architecture: arch || 'Unknown',
                hostname: hostname || 'Unknown',
                type: platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : platform === 'linux' ? 'Linux' : platform || 'Unknown',
                cores: cpus ? cpus.length : 0,
                totalMemory: totalMemory || 0,
                memoryFormatted: totalMemory ? formatBytes(totalMemory) : '0 Bytes'
            }
        };

        // Get Redis stats if available
        let redisStats = null;
        if (global.redis && global.redis.isOpen) {
            try {
                const info = await global.redis.info();
                redisStats = {
                    connected: true,
                    info: info
                };
            } catch (redisError) {
                redisStats = {
                    connected: false,
                    error: redisError.message
                };
            }
        } else {
            redisStats = {
                connected: false,
                error: 'Redis not available'
            };
        }

        const performanceData = {
            loadBalancer: loadBalancerStats,
            queryOptimizer: queryOptimizerStats,
            redis: redisStats,
            system: systemMetrics
        };

        res.json({
            success: true,
            data: performanceData
        });

    } catch (error) {
        console.error('❌ Error getting system performance data:', error);
        console.error('❌ Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Resolve alert endpoint
app.post('/api/admin/resolve-alert/:alertId', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { alertId } = req.params;
        const { resolution } = req.body;

        console.log(`🔧 Resolving alert ${alertId} with resolution: ${resolution}`);

        // Handle test alerts
        if (alertId.startsWith('test_') && global.testAlerts) {
            const alertIndex = global.testAlerts.findIndex(alert => alert.id === alertId);
            if (alertIndex !== -1) {
                global.testAlerts[alertIndex].resolved = true;
                global.testAlerts[alertIndex].resolvedAt = new Date().toISOString();
                global.testAlerts[alertIndex].resolution = resolution || 'manual';

                console.log(`✅ Test alert ${alertId} resolved successfully`);

                res.json({
                    success: true,
                    message: 'Test alert resolved successfully',
                    alert: global.testAlerts[alertIndex]
                });
                return;
            } else {
                return res.status(404).json({
                    success: false,
                    error: 'Test alert not found'
                });
            }
        }

        // For other alerts, just log (in production, update database)
        console.log(`✅ Alert ${alertId} resolved with resolution: ${resolution}`);

        res.json({
            success: true,
            message: 'Alert resolved successfully'
        });

    } catch (error) {
        console.error('❌ Error resolving alert:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Test alert endpoint
app.post('/api/admin/test-alert', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { type, severity } = req.body;

        console.log(`🔔 Creating test alert: ${type} - ${severity}`);

        // Validate input
        if (!type || !severity) {
            return res.status(400).json({
                success: false,
                error: 'Type and severity are required'
            });
        }

        // Create test alert data
        const testAlert = {
            id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: type,
            severity: severity,
            message: `Test ${type} alert with ${severity} severity`,
            data: {
                test: true,
                timestamp: formatWIBTime(),
                source: 'manual_test',
                details: {
                    type: type,
                    severity: severity,
                    created_by: req.user.username
                }
            },
            timestamp: new Date().toISOString(),
            resolved: false
        };

        // Store test alert in memory (in production, this would be stored in database)
        if (!global.testAlerts) {
            global.testAlerts = [];
        }

        global.testAlerts.push(testAlert);

        // Keep only last 50 test alerts
        if (global.testAlerts.length > 50) {
            global.testAlerts = global.testAlerts.slice(-50);
        }

        console.log(`✅ Test alert created successfully: ${testAlert.id}`);

        res.json({
            success: true,
            message: 'Test alert created successfully',
            alert: testAlert
        });

    } catch (error) {
        console.error('❌ Error creating test alert:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Test endpoint untuk monitoring dashboard (tanpa authentication)
app.get('/api/test/monitoring-dashboard', async (req, res) => {
    try {
        // Using imported os module for real system metrics

        // Get real system metrics
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryPercentage = (usedMemory / totalMemory) * 100;

        // Get CPU information
        const cpus = os.cpus();
        const loadAverage = os.loadavg();

        // Calculate CPU usage more accurately using process.cpuUsage()
        let cpuUsage = 0;
        const cpuUsageData = process.cpuUsage();

        if (global.lastCpuUsage) {
            const userDiff = cpuUsageData.user - global.lastCpuUsage.user;
            const systemDiff = cpuUsageData.system - global.lastCpuUsage.system;
            const totalDiff = userDiff + systemDiff;

            // Calculate percentage based on time elapsed
            const timeElapsed = Date.now() - (global.lastCpuTime || Date.now());
            if (timeElapsed > 0) {
                cpuUsage = Math.min(100, Math.max(0, (totalDiff / (timeElapsed * 1000)) * 100));
            }
        }

        // Store current CPU usage for next calculation
        global.lastCpuUsage = cpuUsageData;
        global.lastCpuTime = Date.now();

        // Fallback to load average if no previous data
        if (cpuUsage === 0 && loadAverage[0] > 0) {
            cpuUsage = Math.min(Math.max(loadAverage[0] * 100, 0), 100);
        }

        // Get disk usage (simplified - using process memory as fallback)
        const processMemory = process.memoryUsage();
        const uptime = process.uptime();

        // Validate and sanitize system memory usage data
        const validatedMemoryUsage = {
            used: typeof usedMemory === 'number' && !isNaN(usedMemory) ? usedMemory : 0,
            total: typeof totalMemory === 'number' && !isNaN(totalMemory) ? totalMemory : 1,
            percentage: typeof memoryPercentage === 'number' && !isNaN(memoryPercentage) ? memoryPercentage : 0,
            external: typeof processMemory.external === 'number' && !isNaN(processMemory.external) ? processMemory.external : 0,
            arrayBuffers: typeof processMemory.arrayBuffers === 'number' && !isNaN(processMemory.arrayBuffers) ? processMemory.arrayBuffers : 0
        };

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
            circuitBreaker: {
                isOpen: false,
                failureCount: 0,
                successCount: 0
            },
            queueSizes: {
                critical: 0,
                high: 0,
                normal: 0,
                low: 0
            },
            totalQueueSize: 0
        };

        // Get query optimizer stats from load balancer (integrated)
        const queryOptimizerStats = global.loadBalancer ? {
            queryStats: global.loadBalancer.getQueryStats(),
            cacheStats: global.loadBalancer.getCacheStats()
        } : {
            queryStats: {},
            cacheStats: { size: 0, entries: [] }
        };

        // Get Redis stats if available
        let redisStats = null;
        if (global.redis && global.redis.isOpen) {
            try {
                const info = await global.redis.info();
                redisStats = {
                    connected: true,
                    info: info
                };
            } catch (redisError) {
                redisStats = {
                    connected: false,
                    error: redisError.message
                };
            }
        } else {
            redisStats = {
                connected: false,
                error: 'Redis not available'
            };
        }

        // Calculate system health with validation using real system metrics
        const systemHealth = {
            status: validatedMemoryUsage.percentage > 90 ? 'critical' : validatedMemoryUsage.percentage > 75 ? 'warning' : 'healthy',
            issues: [],
            timestamp: new Date().toISOString()
        };

        if (validatedMemoryUsage.percentage > 90) {
            systemHealth.issues.push('High memory usage');
        }
        if (loadBalancerStats.circuitBreaker.isOpen) {
            systemHealth.issues.push('Circuit breaker is open');
        }
        if (loadBalancerStats.failedRequests > loadBalancerStats.completedRequests * 0.1) {
            systemHealth.issues.push('High error rate');
        }

        // Get alerts data (system alerts + test alerts)
        const alerts = [];

        // Add system health alerts
        if (systemHealth.issues.length > 0) {
            alerts.push({
                id: 'system-health-' + Date.now(),
                type: 'system_health',
                severity: systemHealth.status === 'critical' ? 'critical' : 'warning',
                message: `System health: ${systemHealth.status}`,
                data: { issues: systemHealth.issues },
                timestamp: formatWIBTime(),
                resolved: false
            });
        }

        // Add test alerts
        if (global.testAlerts && global.testAlerts.length > 0) {
            // Get recent test alerts (last 10)
            const recentTestAlerts = global.testAlerts
                .filter(alert => !alert.resolved)
                .slice(-10)
                .map(alert => ({
                    ...alert,
                    message: `[TEST] ${alert.message}`
                }));

            alerts.push(...recentTestAlerts);
        }

        const alertStats = {
            total: alerts.length,
            active: alerts.filter(a => !a.resolved).length,
            resolved: alerts.filter(a => a.resolved).length,
            last24h: alerts.length,
            bySeverity: {
                warning: alerts.filter(a => a.severity === 'warning').length,
                critical: alerts.filter(a => a.severity === 'critical').length,
                emergency: alerts.filter(a => a.severity === 'emergency').length
            },
            byType: {
                system_health: alerts.filter(a => a.type === 'system_health').length
            }
        };

        // Get database connection pool stats
        const dbPoolStats = global.dbPool ? global.dbPool.getPoolStats() : {
            totalConnections: 0,
            activeConnections: 0,
            idleConnections: 0,
            queuedRequests: 0
        };

        const monitoringData = {
            metrics: {
                system: {
                    memory: {
                        used: Math.max(validatedMemoryUsage.used || 0, 0),
                        total: Math.max(validatedMemoryUsage.total || 0, 0),
                        percentage: Math.min(Math.max(validatedMemoryUsage.percentage, 0), 100)
                    },
                    cpu: {
                        usage: Math.min(Math.max(cpuUsage, 0), 100), // CPU usage percentage
                        loadAverage: [loadAverage[0] || 0, loadAverage[1] || 0, loadAverage[2] || 0]
                    },
                    disk: {
                        used: global.systemMonitor ? (global.systemMonitor.getMetrics().system?.disk?.used || 0) : 0,
                        total: global.systemMonitor ? (global.systemMonitor.getMetrics().system?.disk?.total || 2000000000) : 2000000000,
                        percentage: global.systemMonitor ? (global.systemMonitor.getMetrics().system?.disk?.percentage || 0) : 0
                    },
                    uptime: Math.max(uptime || 0, 0)
                },
                application: {
                    requests: {
                        total: Math.max(loadBalancerStats.totalRequests || 0, 0),
                        active: Math.max(loadBalancerStats.activeRequests || 0, 0),
                        completed: Math.max(loadBalancerStats.completedRequests || 0, 0),
                        failed: Math.max(loadBalancerStats.failedRequests || 0, 0)
                    },
                    responseTime: {
                        average: Math.max(loadBalancerStats.averageResponseTime || 0, 0),
                        min: Math.max((loadBalancerStats.averageResponseTime || 0) * 0.5, 0),
                        max: Math.max((loadBalancerStats.averageResponseTime || 0) * 2, 0)
                    },
                    errors: {
                        count: Math.max(loadBalancerStats.failedRequests || 0, 0),
                        lastError: null
                    }
                },
                database: {
                    connections: {
                        active: dbPoolStats ? dbPoolStats.activeConnections : 0,
                        idle: dbPoolStats ? dbPoolStats.idleConnections : 0,
                        total: dbPoolStats ? dbPoolStats.totalConnections : 0
                    },
                    queries: {
                        total: Math.max(loadBalancerStats.totalRequests || 0, 0),
                        slow: queryOptimizerStats.queryStats && Object.keys(queryOptimizerStats.queryStats).length > 0 ? Object.values(queryOptimizerStats.queryStats).filter((stats) => stats.averageTime > 1000).length : 0,
                        failed: Math.max(loadBalancerStats.failedRequests || 0, 0)
                    },
                    responseTime: {
                        average: Math.max(loadBalancerStats.averageResponseTime || 0, 0),
                        min: queryOptimizerStats.queryStats && Object.keys(queryOptimizerStats.queryStats).length > 0 ? Math.min(...Object.values(queryOptimizerStats.queryStats).map((stats) => stats.minTime || 0)) : 0,
                        max: queryOptimizerStats.queryStats && Object.keys(queryOptimizerStats.queryStats).length > 0 ? Math.max(...Object.values(queryOptimizerStats.queryStats).map((stats) => stats.maxTime || 0)) : 0
                    }
                }
            },
            health: systemHealth,
            alerts: alerts,
            alertStats: alertStats,
            loadBalancer: loadBalancerStats,
            queryOptimizer: queryOptimizerStats,
            redis: redisStats,
            system: {
                uptime: Math.max(uptime || 0, 0),
                memory: {
                    used: Math.max(validatedMemoryUsage.used || 0, 0),
                    total: Math.max(validatedMemoryUsage.total || 0, 0),
                    external: Math.max(validatedMemoryUsage.external || 0, 0),
                    arrayBuffers: Math.max(validatedMemoryUsage.arrayBuffers || 0, 0)
                },
                cpu: {
                    user: Math.max(cpuUsage.user || 0, 0),
                    system: Math.max(cpuUsage.system || 0, 0)
                }
            }
        };

        res.json({
            success: true,
            data: monitoringData
        });

    } catch (error) {
        console.error('❌ Error getting monitoring dashboard data:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Get comprehensive monitoring dashboard data
app.get('/api/admin/monitoring-dashboard', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        // Using imported os module for real system metrics

        // Get real system metrics
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryPercentage = (usedMemory / totalMemory) * 100;

        // Get CPU information
        const cpus = os.cpus();
        const loadAverage = os.loadavg();

        // Calculate CPU usage more accurately using process.cpuUsage()
        let cpuUsage = 0;
        const cpuUsageData = process.cpuUsage();

        if (global.lastCpuUsage) {
            const userDiff = cpuUsageData.user - global.lastCpuUsage.user;
            const systemDiff = cpuUsageData.system - global.lastCpuUsage.system;
            const totalDiff = userDiff + systemDiff;

            // Calculate percentage based on time elapsed
            const timeElapsed = Date.now() - (global.lastCpuTime || Date.now());
            if (timeElapsed > 0) {
                cpuUsage = Math.min(100, Math.max(0, (totalDiff / (timeElapsed * 1000)) * 100));
            }
        }

        // Store current CPU usage for next calculation
        global.lastCpuUsage = cpuUsageData;
        global.lastCpuTime = Date.now();

        // Fallback to load average if no previous data
        if (cpuUsage === 0 && loadAverage[0] > 0) {
            cpuUsage = Math.min(Math.max(loadAverage[0] * 100, 0), 100);
        }

        // Get disk usage (simplified - using process memory as fallback)
        const processMemory = process.memoryUsage();
        const uptime = process.uptime();

        // Validate and sanitize system memory usage data
        const validatedMemoryUsage = {
            used: typeof usedMemory === 'number' && !isNaN(usedMemory) ? usedMemory : 0,
            total: typeof totalMemory === 'number' && !isNaN(totalMemory) ? totalMemory : 1,
            percentage: typeof memoryPercentage === 'number' && !isNaN(memoryPercentage) ? memoryPercentage : 0,
            external: typeof processMemory.external === 'number' && !isNaN(processMemory.external) ? processMemory.external : 0,
            arrayBuffers: typeof processMemory.arrayBuffers === 'number' && !isNaN(processMemory.arrayBuffers) ? processMemory.arrayBuffers : 0
        };

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
            circuitBreaker: {
                isOpen: false,
                failureCount: 0,
                successCount: 0
            },
            queueSizes: {
                critical: 0,
                high: 0,
                normal: 0,
                low: 0
            },
            totalQueueSize: 0
        };

        // Get query optimizer stats from load balancer (integrated)
        const queryOptimizerStats = global.loadBalancer ? {
            queryStats: global.loadBalancer.getQueryStats(),
            cacheStats: global.loadBalancer.getCacheStats()
        } : {
            queryStats: {},
            cacheStats: { size: 0, entries: [] }
        };

        // Get Redis stats if available
        let redisStats = null;
        if (global.redis && global.redis.isOpen) {
            try {
                const info = await global.redis.info();
                redisStats = {
                    connected: true,
                    info: info
                };
            } catch (redisError) {
                redisStats = {
                    connected: false,
                    error: redisError.message
                };
            }
        } else {
            redisStats = {
                connected: false,
                error: 'Redis not available'
            };
        }

        // Calculate system health with validation using real system metrics
        const systemHealth = {
            status: validatedMemoryUsage.percentage > 90 ? 'critical' : validatedMemoryUsage.percentage > 75 ? 'warning' : 'healthy',
            issues: [],
            timestamp: new Date().toISOString()
        };

        if (validatedMemoryUsage.percentage > 90) {
            systemHealth.issues.push('High memory usage');
        }
        if (loadBalancerStats.circuitBreaker.isOpen) {
            systemHealth.issues.push('Circuit breaker is open');
        }
        if (loadBalancerStats.failedRequests > loadBalancerStats.completedRequests * 0.1) {
            systemHealth.issues.push('High error rate');
        }

        // Get alerts data (system alerts + test alerts)
        const alerts = [];

        // Add system health alerts
        if (systemHealth.issues.length > 0) {
            alerts.push({
                id: 'system-health-' + Date.now(),
                type: 'system_health',
                severity: systemHealth.status === 'critical' ? 'critical' : 'warning',
                message: `System health: ${systemHealth.status}`,
                data: { issues: systemHealth.issues },
                timestamp: formatWIBTime(),
                resolved: false
            });
        }

        // Add test alerts
        if (global.testAlerts && global.testAlerts.length > 0) {
            // Get recent test alerts (last 10)
            const recentTestAlerts = global.testAlerts
                .filter(alert => !alert.resolved)
                .slice(-10)
                .map(alert => ({
                    ...alert,
                    message: `[TEST] ${alert.message}`
                }));

            alerts.push(...recentTestAlerts);
        }

        const alertStats = {
            total: alerts.length,
            active: alerts.filter(a => !a.resolved).length,
            resolved: alerts.filter(a => a.resolved).length,
            last24h: alerts.length,
            bySeverity: {
                warning: alerts.filter(a => a.severity === 'warning').length,
                critical: alerts.filter(a => a.severity === 'critical').length,
                emergency: alerts.filter(a => a.severity === 'emergency').length
            },
            byType: {
                system_health: alerts.filter(a => a.type === 'system_health').length
            }
        };

        // Get database connection pool stats
        const dbPoolStats = global.dbPool ? global.dbPool.getPoolStats() : {
            totalConnections: 0,
            activeConnections: 0,
            idleConnections: 0,
            queuedRequests: 0
        };

        const monitoringData = {
            metrics: {
                system: {
                    memory: {
                        used: Math.max(validatedMemoryUsage.used || 0, 0),
                        total: Math.max(validatedMemoryUsage.total || 0, 0),
                        percentage: Math.min(Math.max(validatedMemoryUsage.percentage, 0), 100)
                    },
                    cpu: {
                        usage: Math.min(Math.max(cpuUsage, 0), 100), // CPU usage percentage
                        loadAverage: [loadAverage[0] || 0, loadAverage[1] || 0, loadAverage[2] || 0]
                    },
                    disk: {
                        used: global.systemMonitor ? (global.systemMonitor.getMetrics().system?.disk?.used || 0) : 0,
                        total: global.systemMonitor ? (global.systemMonitor.getMetrics().system?.disk?.total || 2000000000) : 2000000000,
                        percentage: global.systemMonitor ? (global.systemMonitor.getMetrics().system?.disk?.percentage || 0) : 0
                    },
                    uptime: Math.max(uptime || 0, 0)
                },
                application: {
                    requests: {
                        total: Math.max(loadBalancerStats.totalRequests || 0, 0),
                        active: Math.max(loadBalancerStats.activeRequests || 0, 0),
                        completed: Math.max(loadBalancerStats.completedRequests || 0, 0),
                        failed: Math.max(loadBalancerStats.failedRequests || 0, 0)
                    },
                    responseTime: {
                        average: Math.max(loadBalancerStats.averageResponseTime || 0, 0),
                        min: Math.max((loadBalancerStats.averageResponseTime || 0) * 0.5, 0),
                        max: Math.max((loadBalancerStats.averageResponseTime || 0) * 2, 0)
                    },
                    errors: {
                        count: Math.max(loadBalancerStats.failedRequests || 0, 0),
                        lastError: null
                    }
                },
                database: {
                    connections: {
                        active: dbPoolStats ? dbPoolStats.activeConnections : 0,
                        idle: dbPoolStats ? dbPoolStats.idleConnections : 0,
                        total: dbPoolStats ? dbPoolStats.totalConnections : 0
                    },
                    queries: {
                        total: Math.max(loadBalancerStats.totalRequests || 0, 0),
                        slow: queryOptimizerStats.queryStats && Object.keys(queryOptimizerStats.queryStats).length > 0 ? Object.values(queryOptimizerStats.queryStats).filter((stats) => stats.averageTime > 1000).length : 0,
                        failed: Math.max(loadBalancerStats.failedRequests || 0, 0)
                    },
                    responseTime: {
                        average: Math.max(loadBalancerStats.averageResponseTime || 0, 0),
                        min: queryOptimizerStats.queryStats && Object.keys(queryOptimizerStats.queryStats).length > 0 ? Math.min(...Object.values(queryOptimizerStats.queryStats).map((stats) => stats.minTime || 0)) : 0,
                        max: queryOptimizerStats.queryStats && Object.keys(queryOptimizerStats.queryStats).length > 0 ? Math.max(...Object.values(queryOptimizerStats.queryStats).map((stats) => stats.maxTime || 0)) : 0
                    }
                }
            },
            health: systemHealth,
            alerts: alerts,
            alertStats: alertStats,
            loadBalancer: loadBalancerStats,
            queryOptimizer: queryOptimizerStats,
            redis: redisStats,
            system: {
                uptime: Math.max(uptime || 0, 0),
                memory: {
                    used: Math.max(validatedMemoryUsage.used || 0, 0),
                    total: Math.max(validatedMemoryUsage.total || 0, 0),
                    external: Math.max(validatedMemoryUsage.external || 0, 0),
                    arrayBuffers: Math.max(validatedMemoryUsage.arrayBuffers || 0, 0)
                },
                cpu: {
                    user: Math.max(cpuUsage.user || 0, 0),
                    system: Math.max(cpuUsage.system || 0, 0)
                }
            }
        };

        res.json({
            success: true,
            data: monitoringData
        });

    } catch (error) {
        console.error('❌ Error getting monitoring dashboard data:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Get circuit breaker status
app.get('/api/admin/circuit-breaker-status', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const status = global.loadBalancer.getCircuitBreakerStatus();

        res.json({
            success: true,
            data: status
        });

    } catch (error) {
        console.error('❌ Error getting circuit breaker status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reset circuit breaker
app.post('/api/admin/reset-circuit-breaker', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        global.loadBalancer.resetCircuitBreaker();

        res.json({
            success: true,
            message: 'Circuit breaker reset successfully'
        });

    } catch (error) {
        console.error('❌ Error resetting circuit breaker:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================================
// DOWNLOAD QUEUE API ENDPOINTS
// ================================================

// Request Excel download
app.post('/api/guru/request-excel-download', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        const { startDate, endDate, kelas_id, mapel_id } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        console.log(`🔄 Requesting Excel download for user ${userId} (${userRole})`);

        const jobData = {
            userId,
            userRole,
            startDate,
            endDate,
            kelas_id,
            mapel_id,
            timestamp: new Date().toISOString()
        };

        const job = await global.downloadQueue.addDownloadJob(jobData);

        res.json({
            success: true,
            message: 'Download request queued successfully',
            data: {
                jobId: job.id,
                status: 'queued',
                estimatedTime: '2-5 minutes'
            }
        });

    } catch (error) {
        console.error('❌ Error requesting Excel download:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get download status
app.get('/api/guru/download-status/:jobId', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        const { jobId } = req.params;
        const userId = req.user.id;

        const jobStatus = await global.downloadQueue.getJobStatus(jobId, userId);

        res.json({
            success: true,
            data: jobStatus
        });

    } catch (error) {
        console.error('❌ Error getting download status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download file
app.get('/api/downloads/:filename', authenticateToken, requireRole(['guru', 'admin']), async (req, res) => {
    try {
        const { filename } = req.params;
        const userId = req.user.id;

        const filePath = path.join(global.downloadQueue.downloadDir, filename);

        // Check if file exists and user has access
        try {
            await fs.access(filePath);
        } catch (error) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Verify user has access to this file
        const hasAccess = await global.downloadQueue.verifyFileAccess(filename, userId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.download(filePath, filename);

    } catch (error) {
        console.error('❌ Error downloading file:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get queue statistics
app.get('/api/admin/queue-stats', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const stats = await global.downloadQueue.getQueueStats();

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('❌ Error getting queue stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ================================================
// BACKUP SYSTEM API ENDPOINTS
// ================================================

// Helper function to calculate next backup date
function calculateNextBackupDate(schedule) {
    const now = new Date();

    switch (schedule) {
        case 'daily':
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(2, 0, 0, 0); // 2 AM
            return tomorrow.toISOString();

        case 'weekly':
            const nextWeek = new Date(now);
            const daysUntilSunday = (7 - now.getDay()) % 7;
            nextWeek.setDate(nextWeek.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
            nextWeek.setHours(2, 0, 0, 0); // 2 AM
            return nextWeek.toISOString();

        case 'monthly':
            const nextMonth = new Date(now);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            nextMonth.setDate(1);
            nextMonth.setHours(2, 0, 0, 0); // 2 AM
            return nextMonth.toISOString();

        default:
            return null; // Disabled
    }
}

// Create semester backup
app.post('/api/admin/create-semester-backup', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('🔄 Creating semester backup...');

        if (!global.backupSystem) {
            console.error('❌ Backup system not initialized');
            return res.status(503).json({
                error: 'Backup system not ready',
                message: 'Backup system is not initialized yet. Please try again in a few seconds.'
            });
        }

        const { semester, year } = req.body;

        // Validasi input
        if (!semester || !['Ganjil', 'Genap'].includes(semester)) {
            return res.status(400).json({
                error: 'Invalid input',
                message: 'Semester harus Ganjil atau Genap'
            });
        }

        if (!year || isNaN(year) || year < 2020 || year > 2030) {
            return res.status(400).json({
                error: 'Invalid input',
                message: 'Tahun harus antara 2020-2030'
            });
        }

        const backupResult = await global.backupSystem.createSemesterBackup(semester, year);

        // Update backup settings with last backup date
        try {
            const settingsPath = path.join(process.cwd(), 'backup-settings.json');
            let currentSettings = {};

            try {
                const settingsData = await fs.readFile(settingsPath, 'utf8');
                currentSettings = JSON.parse(settingsData);
            } catch (fileError) {
                // File doesn't exist, use default settings
                currentSettings = {
                    autoBackupSchedule: 'weekly',
                    maxBackups: 10,
                    archiveAge: 24,
                    compression: true,
                    emailNotifications: false
                };
            }

            // Update last backup date
            currentSettings.lastBackupDate = new Date().toISOString();

            // Calculate next backup date based on schedule
            const now = new Date();
            let nextBackupDate = null;

            switch (currentSettings.autoBackupSchedule) {
                case 'daily':
                    nextBackupDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                    break;
                case 'weekly':
                    nextBackupDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'monthly':
                    nextBackupDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
                    break;
                default:
                    nextBackupDate = null;
            }

            if (nextBackupDate) {
                currentSettings.nextBackupDate = nextBackupDate.toISOString();
            }

            // Save updated settings
            await fs.writeFile(settingsPath, JSON.stringify(currentSettings, null, 2));
            console.log('✅ Backup settings updated with new dates');

        } catch (settingsError) {
            console.error('⚠️ Failed to update backup settings:', settingsError);
            // Don't fail the backup if settings update fails
        }

        res.json({
            success: true,
            message: 'Semester backup created successfully',
            data: backupResult
        });

    } catch (error) {
        console.error('❌ Error creating semester backup:', error);
        console.error('❌ Error stack:', error.stack);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message || 'Failed to create backup',
            details: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
            backupSystemStatus: global.backupSystem ? 'initialized' : 'not initialized'
        });
    }
});

// Create date-based backup
app.post('/api/admin/create-date-backup', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('🔄 Creating date-based backup...');

        if (!global.backupSystem) {
            console.error('❌ Backup system not initialized');
            return res.status(503).json({
                error: 'Backup system not ready',
                message: 'Backup system is not initialized yet. Please try again in a few seconds.'
            });
        }

        const { startDate, endDate } = req.body;

        // Validasi input
        if (!startDate) {
            return res.status(400).json({
                error: 'Invalid input',
                message: 'Start date is required'
            });
        }

        // Jika endDate tidak ada, gunakan startDate sebagai endDate (backup satu hari)
        const actualEndDate = endDate || startDate;

        // Validasi format tanggal
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(actualEndDate);

        if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
            return res.status(400).json({
                error: 'Invalid date format',
                message: 'Please provide valid dates in YYYY-MM-DD format'
            });
        }

        if (startDateObj > endDateObj) {
            return res.status(400).json({
                error: 'Invalid date range',
                message: 'Start date cannot be after end date'
            });
        }

        // Cek apakah tanggal tidak di masa depan
        const today = new Date();
        today.setHours(23, 59, 59, 999); // Set ke akhir hari
        if (startDateObj > today) {
            return res.status(400).json({
                error: 'Invalid date',
                message: 'Cannot backup future dates'
            });
        }

        console.log(`📅 Creating backup for date range: ${startDate} to ${actualEndDate}`);

        // Buat backup berdasarkan tanggal
        const backupResult = await global.backupSystem.createDateBackup(startDate, actualEndDate);

        // Update backup settings dengan tanggal backup terakhir
        try {
            const settingsPath = path.join(process.cwd(), 'backup-settings.json');
            let settings = {};

            try {
                const settingsData = await fs.readFile(settingsPath, 'utf8');
                settings = JSON.parse(settingsData);
            } catch (fileError) {
                // File tidak ada, gunakan default settings
                settings = {
                    autoBackupSchedule: 'weekly',
                    maxBackups: 10,
                    archiveAge: 24,
                    compression: true,
                    emailNotifications: false
                };
            }

            // Update tanggal backup terakhir
            settings.lastBackupDate = new Date().toISOString();

            // Hitung tanggal backup berikutnya berdasarkan jadwal
            const nextBackupDate = calculateNextBackupDate(settings.autoBackupSchedule);
            settings.nextBackupDate = nextBackupDate;

            // Simpan settings
            await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
            console.log('✅ Backup settings updated successfully');

        } catch (settingsError) {
            console.error('⚠️ Failed to update backup settings:', settingsError);
            // Jangan gagal backup jika update settings gagal
        }

        res.json({
            success: true,
            message: `Date-based backup created successfully for ${startDate}${actualEndDate !== startDate ? ` to ${actualEndDate}` : ''}`,
            data: {
                ...backupResult,
                dateRange: {
                    startDate,
                    endDate: actualEndDate,
                    days: Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1
                }
            }
        });

    } catch (error) {
        console.error('❌ Error creating date-based backup:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message || 'Failed to create date-based backup'
        });
    }
});

// Get backup list
app.get('/api/admin/backup-list', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const backupList = await global.backupSystem.listBackups();

        res.json({
            success: true,
            backups: backupList,
            message: 'Backup list retrieved successfully'
        });

    } catch (error) {
        console.error('❌ Error getting backup list:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Gagal memuat daftar backup'
        });
    }
});

// Get backups (alias for backup-list to match frontend)
app.get('/api/admin/backups', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const backupList = await global.backupSystem.listBackups();

        res.json({
            success: true,
            backups: backupList,
            message: 'Backup list retrieved successfully'
        });

    } catch (error) {
        console.error('❌ Error getting backups:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Gagal memuat daftar backup'
        });
    }
});

// Delete backup
app.delete('/api/admin/delete-backup/:backupId', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { backupId } = req.params;

        if (!backupId) {
            return res.status(400).json({
                error: 'Invalid input',
                message: 'Backup ID is required'
            });
        }

        console.log(`🗑️ Attempting to delete backup: ${backupId}`);

        // Check if backup system is available
        if (!global.backupSystem) {
            console.error('❌ Backup system not initialized');
            return res.status(503).json({
                error: 'Backup system not ready',
                message: 'Backup system is not initialized yet. Please try again in a few seconds.'
            });
        }

        // Try to delete using backup system first
        try {
            const result = await global.backupSystem.deleteBackup(backupId);
            console.log(`✅ Backup deleted via backup system: ${backupId}`);

            res.json({
                success: true,
                message: 'Backup berhasil dihapus',
                data: result
            });
        } catch (backupSystemError) {
            console.log(`⚠️ Backup system delete failed, trying manual deletion: ${backupSystemError.message}`);

            // Fallback: Manual deletion
            const backupDir = path.join(process.cwd(), 'backups');

            // First, check if it's a folder-based backup
            const folderPath = path.join(backupDir, backupId);
            const folderStats = await fs.stat(folderPath).catch(() => null);

            if (folderStats && folderStats.isDirectory()) {
                console.log(`📁 Found backup folder for manual deletion: ${backupId}`);

                // Delete the entire folder and its contents
                await fs.rm(folderPath, { recursive: true, force: true });
                console.log(`✅ Manually deleted backup folder: ${backupId}`);

                res.json({
                    success: true,
                    message: 'Backup berhasil dihapus',
                    data: {
                        deletedFiles: [backupId],
                        method: 'manual_folder'
                    }
                });
                return;
            }

            // If not a folder, try different possible file formats
            const possibleFiles = [
                `${backupId}.zip`,
                `${backupId}`,
                `${backupId}.sql`,
                `${backupId}.tar.gz`
            ];

            let deleted = false;
            let deletedFiles = [];

            for (const filename of possibleFiles) {
                const filePath = path.join(backupDir, filename);
                try {
                    await fs.access(filePath);
                    await fs.unlink(filePath);
                    deleted = true;
                    deletedFiles.push(filename);
                    console.log(`✅ Manually deleted file: ${filename}`);
                } catch (fileError) {
                    // File doesn't exist or can't be deleted, continue
                    console.log(`⚠️ Could not delete ${filename}: ${fileError.message}`);
                }
            }

            if (deleted) {
                res.json({
                    success: true,
                    message: 'Backup berhasil dihapus',
                    data: {
                        deletedFiles: deletedFiles,
                        method: 'manual_file'
                    }
                });
            } else {
                throw new Error(`No backup files found for ID: ${backupId}`);
            }
        }

    } catch (error) {
        console.error('❌ Error deleting backup:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message || 'Gagal menghapus backup'
        });
    }
});

// Restore backup
app.post('/api/admin/restore-backup/:backupId', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { backupId } = req.params;

        if (!backupId) {
            return res.status(400).json({
                error: 'Invalid input',
                message: 'Backup ID is required'
            });
        }

        const result = await global.backupSystem.restoreFromBackup(backupId);

        res.json({
            success: true,
            message: 'Backup berhasil dipulihkan',
            data: result
        });

    } catch (error) {
        console.error('❌ Error restoring backup:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Gagal memulihkan backup'
        });
    }
});

// Upload and restore backup file
app.post('/api/admin/restore-backup', authenticateToken, requireRole(['admin']), upload.single('backupFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'File tidak ditemukan',
                message: 'File backup harus diupload'
            });
        }

        console.log('📥 Processing backup file upload:', {
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        });

        // Validate file type
        const fileExtension = path.extname(req.file.originalname).toLowerCase();

        if (!['.sql', '.zip'].includes(fileExtension)) {
            return res.status(400).json({
                error: 'Format file tidak didukung',
                message: 'File harus berformat .sql atau .zip'
            });
        }

        // Save uploaded file temporarily
        const tempDir = path.join(process.cwd(), 'temp');
        await fs.mkdir(tempDir, { recursive: true });

        const tempFilePath = path.join(tempDir, `backup_${Date.now()}_${req.file.originalname}`);
        await fs.writeFile(tempFilePath, req.file.buffer);

        // Process the backup file
        let result;
        if (fileExtension === '.sql') {
            // Process SQL file
            result = await processSQLBackup(tempFilePath);
        } else if (fileExtension === '.zip') {
            // Process ZIP file
            result = await processZIPBackup(tempFilePath);
        }

        // Clean up temporary file
        await fs.unlink(tempFilePath);

        res.json({
            success: true,
            message: 'Backup berhasil dipulihkan',
            data: result
        });

    } catch (error) {
        console.error('❌ Error restoring backup:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Gagal memulihkan backup'
        });
    }
});

// Helper function to process SQL backup
async function processSQLBackup(filePath) {
    try {
        const sqlContent = await fs.readFile(filePath, 'utf8');

        // Validate SQL content
        if (!sqlContent.includes('CREATE TABLE') && !sqlContent.includes('INSERT INTO')) {
            throw new Error('File SQL tidak valid');
        }

        // Execute SQL commands
        const commands = sqlContent.split(';').filter(cmd => cmd.trim());

        for (const command of commands) {
            if (command.trim()) {
                await db.execute(command);
            }
        }

        return {
            type: 'sql',
            message: 'Database berhasil dipulihkan dari file SQL',
            tablesRestored: sqlContent.match(/CREATE TABLE/g)?.length || 0
        };
    } catch (error) {
        throw new Error(`Gagal memproses file SQL: ${error.message}`);
    }
}

// Helper function to process ZIP backup
async function processZIPBackup(filePath) {
    try {
        const zip = new AdmZip(filePath);
        const zipEntries = zip.getEntries();

        let sqlFile = null;
        for (const entry of zipEntries) {
            if (entry.entryName.endsWith('.sql')) {
                sqlFile = entry;
                break;
            }
        }

        if (!sqlFile) {
            throw new Error('File ZIP tidak mengandung file SQL');
        }

        const sqlContent = zip.readAsText(sqlFile);

        // Execute SQL commands
        const commands = sqlContent.split(';').filter(cmd => cmd.trim());

        for (const command of commands) {
            if (command.trim()) {
                await db.execute(command);
            }
        }

        return {
            type: 'zip',
            message: 'Database berhasil dipulihkan dari file ZIP',
            filesExtracted: zipEntries.length
        };
    } catch (error) {
        throw new Error(`Gagal memproses file ZIP: ${error.message}`);
    }
}

// Get available backups
app.get('/api/admin/backups', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const backupDir = path.join(process.cwd(), 'backups');
        const backups = [];

        try {
            const backupFolders = await fs.readdir(backupDir);

            for (const folder of backupFolders) {
                const folderPath = path.join(backupDir, folder);
                const stats = await fs.stat(folderPath);

                if (stats.isDirectory()) {
                    const files = await fs.readdir(folderPath);
                    const sqlFiles = files.filter(file => file.endsWith('.sql'));
                    const zipFiles = files.filter(file => file.endsWith('.zip'));

                    if (sqlFiles.length > 0 || zipFiles.length > 0) {
                        backups.push({
                            id: folder,
                            name: folder,
                            type: 'scheduled',
                            date: stats.mtime,
                            files: {
                                sql: sqlFiles,
                                zip: zipFiles
                            },
                            size: await getFolderSize(folderPath)
                        });
                    }
                }
            }
        } catch (error) {
            console.log('No backup directory found or empty');
        }

        // Sort by date (newest first)
        backups.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({
            success: true,
            data: backups
        });

    } catch (error) {
        console.error('❌ Error getting backups:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Gagal mendapatkan daftar backup'
        });
    }
});

// Helper function to get folder size
async function getFolderSize(folderPath) {
    try {
        const files = await fs.readdir(folderPath);
        let totalSize = 0;

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const stats = await fs.stat(filePath);
            totalSize += stats.size;
        }

        return totalSize;
    } catch (error) {
        return 0;
    }
}

// Download backup file
app.get('/api/admin/download-backup/:backupId', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { backupId } = req.params;
        const backupDir = path.join(process.cwd(), 'backups');

        console.log(`📥 Downloading backup: ${backupId}`);
        console.log(`📁 Backup directory: ${backupDir}`);
        console.log(`📁 process.cwd(): ${process.cwd()}`);

        let filePath = null;
        let filename = null;

        // First, check if backupId is a directory (scheduled backups)
        const backupSubDir = path.join(backupDir, backupId);
        try {
            const stats = await fs.stat(backupSubDir);
            if (stats.isDirectory()) {
                console.log(`📁 Found backup directory: ${backupSubDir}`);

                // Look for files in the subdirectory
                const files = await fs.readdir(backupSubDir);
                console.log(`📋 Files in backup directory:`, files);

                // Look for compressed backup files first
                const compressedFiles = files.filter(file =>
                    file.endsWith('.zip') || file.endsWith('.tar.gz') || file.endsWith('.gz')
                );

                if (compressedFiles.length > 0) {
                    // Use the first compressed file found
                    const compressedFile = compressedFiles[0];
                    filePath = path.join(backupSubDir, compressedFile);
                    filename = compressedFile;
                    console.log(`✅ Found compressed backup: ${filename}`);
                } else {
                    // Look for SQL files
                    const sqlFiles = files.filter(file => file.endsWith('.sql'));
                    if (sqlFiles.length > 0) {
                        const sqlFile = sqlFiles[0];
                        filePath = path.join(backupSubDir, sqlFile);
                        filename = sqlFile;
                        console.log(`✅ Found SQL backup: ${filename}`);
                    } else {
                        // Look for any other files
                        const otherFiles = files.filter(file =>
                            !file.endsWith('.json') && !file.endsWith('.txt') && !file.endsWith('.log')
                        );
                        if (otherFiles.length > 0) {
                            const otherFile = otherFiles[0];
                            filePath = path.join(backupSubDir, otherFile);
                            filename = otherFile;
                            console.log(`✅ Found backup file: ${filename}`);
                        }
                    }
                }
            }
        } catch (error) {
            console.log(`❌ Backup directory not found: ${backupSubDir} - ${error.message}`);
        }

        // If not found in subdirectory, try direct files in backup directory
        if (!filePath) {
            console.log(`🔍 Checking direct files in backup directory...`);
            const possibleFiles = [
                `${backupId}.zip`,
                `${backupId}`,
                `${backupId}.sql`,
                `${backupId}.tar.gz`
            ];

            for (const possibleFile of possibleFiles) {
                const testPath = path.join(backupDir, possibleFile);
                console.log(`🔍 Checking file: ${testPath}`);
                try {
                    const stats = await fs.stat(testPath);
                    if (stats.isFile()) {
                        filePath = testPath;
                        filename = possibleFile;
                        console.log(`✅ Found backup file: ${filename} (${stats.size} bytes)`);
                        break;
                    } else {
                        console.log(`❌ Path exists but is not a file: ${possibleFile}`);
                    }
                } catch (error) {
                    console.log(`❌ File not found: ${possibleFile} - ${error.message}`);
                }
            }
        }

        if (!filePath) {
            console.error(`❌ No backup file found for ID: ${backupId}`);
            console.log(`📋 Available files in backup directory:`);
            try {
                const files = await fs.readdir(backupDir);
                for (const file of files) {
                    try {
                        const fullPath = path.join(backupDir, file);
                        const stats = await fs.stat(fullPath);
                        console.log(`   - ${file} (${stats.isDirectory() ? 'DIR' : 'FILE'}, ${stats.size} bytes)`);

                        // If it's a directory, list its contents
                        if (stats.isDirectory()) {
                            try {
                                const subFiles = await fs.readdir(fullPath);
                                subFiles.forEach(subFile => {
                                    console.log(`     └─ ${subFile}`);
                                });
                            } catch (err) {
                                console.log(`     └─ Error reading subdirectory: ${err.message}`);
                            }
                        }
                    } catch (err) {
                        console.log(`   - ${file} (ERROR: ${err.message})`);
                    }
                }
            } catch (error) {
                console.log(`   - Could not read backup directory: ${error.message}`);
            }
            return res.status(404).json({
                error: 'Backup file not found',
                message: `No backup file found for ID: ${backupId}`,
                backupDir: backupDir,
                searchedDirectories: [backupSubDir],
                searchedFiles: [`${backupId}.zip`, `${backupId}`, `${backupId}.sql`, `${backupId}.tar.gz`]
            });
        }

        // Set proper headers for file download
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        console.log(`📤 Sending file: ${filePath}`);
        res.download(filePath, filename, (err) => {
            if (err) {
                console.error('❌ Error during file download:', err);
                if (!res.headersSent) {
                    res.status(500).json({
                        error: 'Download failed',
                        message: err.message || 'Failed to download file'
                    });
                }
            } else {
                console.log(`✅ File download completed: ${filename}`);
            }
        });

    } catch (error) {
        console.error('❌ Error downloading backup:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message || 'Failed to download backup',
            stack: error.stack
        });
    }
});

// Create test old data for archive demonstration
app.post('/api/admin/create-test-archive-data', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('🧪 Creating test archive data...');

        if (!global.dbPool || !global.dbPool.pool) {
            console.error('❌ Database pool not initialized');
            return res.status(503).json({
                error: 'Database not ready',
                message: 'Database connection pool is not initialized yet. Please try again in a few seconds.'
            });
        }

        // Create test data that is 25 months old (older than default 24 months)
        const oldDate = new Date();
        oldDate.setMonth(oldDate.getMonth() - 25);
        const oldDateStr = oldDate.toISOString().split('T')[0];

        console.log(`📅 Creating test data with date: ${oldDateStr} (25 months old)`);

        // First, clean up any existing test data
        await global.dbPool.pool.execute(`
            DELETE FROM absensi_siswa 
            WHERE keterangan = 'Test data for archive'
        `);

        await global.dbPool.pool.execute(`
            DELETE FROM absensi_guru 
            WHERE keterangan = 'Test data for archive'
        `);

        // Also clean up from archive tables
        await global.dbPool.pool.execute(`
            DELETE FROM absensi_siswa_archive 
            WHERE keterangan = 'Test data for archive'
        `);

        await global.dbPool.pool.execute(`
            DELETE FROM absensi_guru_archive 
            WHERE keterangan = 'Test data for archive'
        `);

        // First get a valid jadwal_id and guru_id from the database
        const [jadwalRows] = await global.dbPool.pool.execute(`
            SELECT id_jadwal FROM jadwal LIMIT 1
        `);
        const [guruRows] = await global.dbPool.pool.execute(`
            SELECT id_guru FROM guru WHERE status = 'aktif' LIMIT 1
        `);
        
        const validJadwalId = jadwalRows.length > 0 ? jadwalRows[0].id_jadwal : null;
        const validGuruId = guruRows.length > 0 ? guruRows[0].id_guru : null;

        // Insert test student attendance records
        const [studentResult] = await global.dbPool.pool.execute(`
            INSERT INTO absensi_siswa (siswa_id, jadwal_id, tanggal, status, keterangan, guru_id)
            SELECT 
                s.id_siswa as siswa_id,
                ? as jadwal_id,
                ? as tanggal,
                'Hadir' as status,
                'Test data for archive' as keterangan,
                ? as guru_id
            FROM siswa s
            WHERE s.status = 'aktif'
            LIMIT 10
        `, [validJadwalId, oldDateStr, validGuruId]);

        // Insert test teacher attendance records (skip for now due to foreign key constraints)
        const teacherResult = { affectedRows: 0 };

        const result = {
            message: 'Test archive data created successfully',
            studentRecordsCreated: studentResult.affectedRows,
            teacherRecordsCreated: teacherResult.affectedRows,
            testDate: oldDateStr,
            monthsOld: 25,
            timestamp: new Date().toISOString()
        };

        console.log(`✅ Created ${studentResult.affectedRows} test student records`);
        console.log(`✅ Created ${teacherResult.affectedRows} test teacher records`);
        console.log(`📊 Test data summary:`);
        console.log(`   - Date: ${oldDateStr}`);
        console.log(`   - Age: 25 months (older than 24 month criteria)`);
        console.log(`   - Student records: ${studentResult.affectedRows}`);
        console.log(`   - Teacher records: ${teacherResult.affectedRows}`);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('❌ Error creating test archive data:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message || 'Failed to create test archive data'
        });
    }
});

// Archive old data
app.post('/api/admin/archive-old-data', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { monthsOld = 12 } = req.body;

        console.log(`🔄 Archiving data older than ${monthsOld} months...`);

        if (!global.backupSystem) {
            console.error('❌ Backup system not initialized');
            return res.status(503).json({
                error: 'Backup system not ready',
                message: 'Backup system is not initialized yet. Please try again in a few seconds.'
            });
        }

        if (!global.dbPool || !global.dbPool.pool) {
            console.error('❌ Database pool not initialized');
            return res.status(503).json({
                error: 'Database not ready',
                message: 'Database connection pool is not initialized yet. Please try again in a few seconds.'
            });
        }

        const archiveResult = await global.backupSystem.archiveOldData(monthsOld);

        res.json({
            success: true,
            message: `Data older than ${monthsOld} months archived successfully`,
            data: archiveResult
        });

    } catch (error) {
        console.error('❌ Error archiving old data:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message || 'Failed to archive old data'
        });
    }
});

// Check database status
app.get('/api/admin/database-status', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const status = {
            dbPool: !!global.dbPool,
            dbPoolType: typeof global.dbPool,
            dbPoolPool: !!global.dbPool?.pool,
            dbPoolPoolType: typeof global.dbPool?.pool,
            queryOptimizer: !!global.queryOptimizer,
            backupSystem: !!global.backupSystem,
            backupSystemType: typeof global.backupSystem,
            backupSystemConfig: global.backupSystem ? {
                backupDir: global.backupSystem.backupDir,
                archiveDir: global.backupSystem.archiveDir,
                pool: !!global.backupSystem.pool
            } : null,
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            status: status
        });

    } catch (error) {
        console.error('❌ Error getting database status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Check backup directory status
app.get('/api/admin/backup-directory-status', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const backupDir = path.join(process.cwd(), 'backups');

        // Check if backup directory exists
        let dirExists = false;
        let files = [];

        try {
            await fs.access(backupDir);
            dirExists = true;

            // List files in backup directory
            const dirFiles = await fs.readdir(backupDir);
            files = await Promise.all(
                dirFiles.map(async (file) => {
                    try {
                        const filePath = path.join(backupDir, file);
                        const stats = await fs.stat(filePath);
                        return {
                            name: file,
                            isDirectory: stats.isDirectory(),
                            size: stats.size,
                            modified: stats.mtime
                        };
                    } catch (error) {
                        return {
                            name: file,
                            error: error.message
                        };
                    }
                })
            );
        } catch (error) {
            console.log('Backup directory does not exist or is not accessible');
        }

        res.json({
            success: true,
            data: {
                backupDir: backupDir,
                exists: dirExists,
                files: files,
                totalFiles: files.length
            }
        });

    } catch (error) {
        console.error('❌ Error checking backup directory:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Gagal memeriksa direktori backup'
        });
    }
});

// Get archive statistics
app.get('/api/admin/archive-stats', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📊 Getting archive statistics...');

        // Debug: Check if dbPool exists
        console.log('🔍 Debug - global.dbPool:', !!global.dbPool);
        console.log('🔍 Debug - global.dbPool type:', typeof global.dbPool);
        console.log('🔍 Debug - global.dbPool.pool:', !!global.dbPool?.pool);
        console.log('🔍 Debug - global.dbPool.pool type:', typeof global.dbPool?.pool);

        if (!global.dbPool) {
            console.error('❌ Database pool not initialized - global.dbPool is undefined');
            return res.status(503).json({
                error: 'Database not ready',
                message: 'Database connection pool is not initialized yet. Please try again in a few seconds.'
            });
        }

        if (!global.dbPool.pool) {
            console.error('❌ Database pool not initialized - global.dbPool.pool is undefined');
            return res.status(503).json({
                error: 'Database not ready',
                message: 'Database connection pool is not initialized yet. Please try again in a few seconds.'
            });
        }

        // Get student archive count
        let studentArchiveCount = 0;
        try {
            const [studentArchive] = await global.dbPool.pool.execute(`
                SELECT COUNT(*) as count FROM absensi_siswa_archive
            `);
            studentArchiveCount = studentArchive[0]?.count || 0;
        } catch (error) {
            console.log('⚠️ Student archive table not found, using 0');
        }

        // Get teacher archive count
        let teacherArchiveCount = 0;
        try {
            const [teacherArchive] = await global.dbPool.pool.execute(`
                SELECT COUNT(*) as count FROM absensi_guru_archive
            `);
            teacherArchiveCount = teacherArchive[0]?.count || 0;
        } catch (error) {
            console.log('⚠️ Teacher archive table not found, using 0');
        }

        // Get total archive size (approximate)
        let totalSizeMB = 0;
        try {
            const [archiveSize] = await global.dbPool.pool.execute(`
                SELECT 
                    (SELECT COUNT(*) FROM absensi_siswa_archive) * 0.5 +
                    (SELECT COUNT(*) FROM absensi_guru_archive) * 0.3 as total_size
            `);
            totalSizeMB = archiveSize[0]?.total_size || 0;
        } catch (error) {
            console.log('⚠️ Could not calculate archive size, using 0');
            totalSizeMB = (studentArchiveCount * 0.5) + (teacherArchiveCount * 0.3);
        }

        // Get last archive date (try archived_at first, fallback to waktu_catat)
        let lastArchive;
        try {
            const [lastArchiveResult] = await global.dbPool.pool.execute(`
                SELECT MAX(archived_at) as last_archive FROM absensi_siswa_archive
            `);
            lastArchive = lastArchiveResult;
        } catch (error) {
            // Fallback if archived_at column doesn't exist
            const [lastArchiveResult] = await global.dbPool.pool.execute(`
                SELECT MAX(waktu_absen) as last_archive FROM absensi_siswa_archive
            `);
            lastArchive = lastArchiveResult;
        }

        const stats = {
            studentRecords: studentArchiveCount,
            teacherRecords: teacherArchiveCount,
            totalSize: Math.round(totalSizeMB),
            lastArchive: lastArchive?.[0]?.last_archive || null
        };

        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
        console.error('❌ Error getting archive stats:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Gagal memuat statistik arsip'
        });
    }
});

// Get backup settings
app.get('/api/admin/backup-settings', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('⚙️ Getting backup settings...');

        // Default settings
        const defaultSettings = {
            autoBackupSchedule: 'weekly',
            maxBackups: 10,
            archiveAge: 24,
            compression: true,
            emailNotifications: false
        };

        // Try to load from file if exists
        try {
            const settingsPath = path.join(process.cwd(), 'backup-settings.json');
            const settingsData = await fs.readFile(settingsPath, 'utf8');
            const savedSettings = JSON.parse(settingsData);

            // Merge with default settings and ensure all fields are present
            const mergedSettings = {
                ...defaultSettings,
                ...savedSettings,
                lastBackupDate: savedSettings.lastBackupDate || null,
                nextBackupDate: savedSettings.nextBackupDate || null
            };

            res.json({
                success: true,
                settings: mergedSettings
            });
        } catch (fileError) {
            // File doesn't exist, return default settings with null dates
            const defaultSettingsWithDates = {
                ...defaultSettings,
                lastBackupDate: null,
                nextBackupDate: null
            };

            res.json({
                success: true,
                settings: defaultSettingsWithDates
            });
        }

    } catch (error) {
        console.error('❌ Error getting backup settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Save backup settings
app.post('/api/admin/backup-settings', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const settings = req.body;
        console.log('💾 Saving backup settings:', settings);

        // Validate settings
        const validSettings = {
            autoBackupSchedule: settings.autoBackupSchedule || 'weekly',
            maxBackups: Math.max(1, Math.min(50, settings.maxBackups || 10)),
            archiveAge: Math.max(6, Math.min(60, settings.archiveAge || 24)),
            compression: Boolean(settings.compression),
            emailNotifications: Boolean(settings.emailNotifications),
            lastBackupDate: settings.lastBackupDate || null,
            nextBackupDate: settings.nextBackupDate || null
        };

        // Save to file
        const settingsPath = path.join(process.cwd(), 'backup-settings.json');
        await fs.writeFile(settingsPath, JSON.stringify(validSettings, null, 2));

        // Update backup system configuration
        if (global.backupSystem) {
            global.backupSystem.backupConfig = {
                ...global.backupSystem.backupConfig,
                maxBackups: validSettings.maxBackups,
                maxArchiveAge: validSettings.archiveAge,
                compressionEnabled: validSettings.compression
            };
        }

        res.json({
            success: true,
            message: 'Backup settings saved successfully',
            settings: validSettings
        });

    } catch (error) {
        console.error('❌ Error saving backup settings:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message || 'Failed to save backup settings'
        });
    }
});

// ================================================
// CUSTOM BACKUP SCHEDULE ENDPOINTS
// ================================================

// Custom backup scheduler
let customScheduleInterval = null;

function startCustomScheduleChecker() {
    // Check every minute for scheduled backups
    customScheduleInterval = setInterval(async () => {
        try {
            const schedulesPath = path.join(process.cwd(), 'custom-schedules.json');
            let schedules = [];

            try {
                const schedulesData = await fs.readFile(schedulesPath, 'utf8');
                schedules = JSON.parse(schedulesData);
            } catch (fileError) {
                // No schedules file, skip
                return;
            }

            const now = new Date();
            const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM format
            const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format

            for (const schedule of schedules) {
                if (!schedule.enabled) continue;

                // Check if it's time for this schedule
                if (schedule.date === currentDate && schedule.time === currentTime) {
                    console.log(`🕐 Running scheduled backup: ${schedule.name}`);

                    try {
                        // Create backup based on schedule
                        if (global.backupSystem) {
                            const backupResult = await global.backupSystem.createScheduledBackup(schedule);

                            // Update schedule with last run time
                            schedule.lastRun = new Date().toISOString();
                            await fs.writeFile(schedulesPath, JSON.stringify(schedules, null, 2));

                            console.log(`✅ Scheduled backup completed: ${schedule.name}`);
                        } else {
                            console.error('❌ Backup system not available for scheduled backup');
                        }
                    } catch (error) {
                        console.error(`❌ Error running scheduled backup ${schedule.name}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error in custom schedule checker:', error);
        }
    }, 60000); // Check every minute

    console.log('📅 Custom backup scheduler started');
}

function stopCustomScheduleChecker() {
    if (customScheduleInterval) {
        clearInterval(customScheduleInterval);
        customScheduleInterval = null;
        console.log('📅 Custom backup scheduler stopped');
    }
}

// Start scheduler when server starts
startCustomScheduleChecker();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    stopCustomScheduleChecker();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down server...');
    stopCustomScheduleChecker();
    process.exit(0);
});

// Get custom schedules
app.get('/api/admin/custom-schedules', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📅 Getting custom schedules...');

        const schedulesPath = path.join(process.cwd(), 'custom-schedules.json');
        let schedules = [];

        try {
            const schedulesData = await fs.readFile(schedulesPath, 'utf8');
            schedules = JSON.parse(schedulesData);
        } catch (fileError) {
            // File doesn't exist, return empty array
            schedules = [];
        }

        res.json({
            success: true,
            schedules: schedules
        });

    } catch (error) {
        console.error('❌ Error getting custom schedules:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create custom schedule
app.post('/api/admin/custom-schedules', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { name, date, time, enabled } = req.body;
        console.log('📅 Creating custom schedule:', { name, date, time, enabled });

        // Validate input
        if (!name || !date || !time) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Name, date, and time are required'
            });
        }

        // Validate date is not in the past
        const scheduleDate = new Date(`${date}T${time}`);
        const now = new Date();
        if (scheduleDate <= now) {
            return res.status(400).json({
                error: 'Invalid date',
                message: 'Schedule date must be in the future'
            });
        }

        const schedulesPath = path.join(process.cwd(), 'custom-schedules.json');
        let schedules = [];

        try {
            const schedulesData = await fs.readFile(schedulesPath, 'utf8');
            schedules = JSON.parse(schedulesData);
        } catch (fileError) {
            // File doesn't exist, start with empty array
            schedules = [];
        }

        // Create new schedule
        const newSchedule = {
            id: `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            date,
            time,
            enabled: enabled !== false,
            created: new Date().toISOString()
        };

        schedules.push(newSchedule);

        // Save to file
        await fs.writeFile(schedulesPath, JSON.stringify(schedules, null, 2));

        res.json({
            success: true,
            message: 'Custom schedule created successfully',
            schedule: newSchedule
        });

    } catch (error) {
        console.error('❌ Error creating custom schedule:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message || 'Failed to create custom schedule'
        });
    }
});

// Update custom schedule
app.put('/api/admin/custom-schedules/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;
        console.log('📅 Updating custom schedule:', { id, enabled });

        const schedulesPath = path.join(process.cwd(), 'custom-schedules.json');
        let schedules = [];

        try {
            const schedulesData = await fs.readFile(schedulesPath, 'utf8');
            schedules = JSON.parse(schedulesData);
        } catch (fileError) {
            return res.status(404).json({
                error: 'Schedules not found',
                message: 'No schedules file found'
            });
        }

        const scheduleIndex = schedules.findIndex(s => s.id === id);
        if (scheduleIndex === -1) {
            return res.status(404).json({
                error: 'Schedule not found',
                message: 'Schedule with the given ID not found'
            });
        }

        // Update schedule
        schedules[scheduleIndex].enabled = enabled !== false;

        // Save to file
        await fs.writeFile(schedulesPath, JSON.stringify(schedules, null, 2));

        res.json({
            success: true,
            message: 'Custom schedule updated successfully',
            schedule: schedules[scheduleIndex]
        });

    } catch (error) {
        console.error('❌ Error updating custom schedule:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message || 'Failed to update custom schedule'
        });
    }
});

// Delete custom schedule
app.delete('/api/admin/custom-schedules/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        console.log('📅 Deleting custom schedule:', { id });

        const schedulesPath = path.join(process.cwd(), 'custom-schedules.json');
        let schedules = [];

        try {
            const schedulesData = await fs.readFile(schedulesPath, 'utf8');
            schedules = JSON.parse(schedulesData);
        } catch (fileError) {
            return res.status(404).json({
                error: 'Schedules not found',
                message: 'No schedules file found'
            });
        }

        const scheduleIndex = schedules.findIndex(s => s.id === id);
        if (scheduleIndex === -1) {
            return res.status(404).json({
                error: 'Schedule not found',
                message: 'Schedule with the given ID not found'
            });
        }

        // Remove schedule
        const deletedSchedule = schedules.splice(scheduleIndex, 1)[0];

        // Save to file
        await fs.writeFile(schedulesPath, JSON.stringify(schedules, null, 2));

        res.json({
            success: true,
            message: 'Custom schedule deleted successfully',
            schedule: deletedSchedule
        });

    } catch (error) {
        console.error('❌ Error deleting custom schedule:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message || 'Failed to delete custom schedule'
        });
    }
});

// Run custom schedule manually
app.post('/api/admin/run-custom-schedule/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🚀 Running custom schedule manually:', { id });

        const schedulesPath = path.join(process.cwd(), 'custom-schedules.json');
        let schedules = [];

        try {
            const schedulesData = await fs.readFile(schedulesPath, 'utf8');
            schedules = JSON.parse(schedulesData);
        } catch (fileError) {
            return res.status(404).json({
                error: 'Schedules not found',
                message: 'No schedules file found'
            });
        }

        const schedule = schedules.find(s => s.id === id);
        if (!schedule) {
            return res.status(404).json({
                error: 'Schedule not found',
                message: 'Schedule with the given ID not found'
            });
        }

        // Run the scheduled backup
        if (global.backupSystem) {
            const backupResult = await global.backupSystem.createScheduledBackup(schedule);

            // Update schedule with last run time
            schedule.lastRun = new Date().toISOString();
            await fs.writeFile(schedulesPath, JSON.stringify(schedules, null, 2));

            res.json({
                success: true,
                message: 'Custom schedule executed successfully',
                backup: backupResult
            });
        } else {
            res.status(503).json({
                error: 'Backup system not available',
                message: 'Backup system is not initialized'
            });
        }

    } catch (error) {
        console.error('❌ Error running custom schedule:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message || 'Failed to run custom schedule'
        });
    }
});


// Export attendance data as CSV
app.get('/api/admin/export/attendance', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📊 Exporting attendance data...');

        const query = `
            SELECT 
                DATE_FORMAT(a.waktu_absen, '%d/%m/%Y') as tanggal,
                s.nama as nama_siswa,
                s.nis,
                k.nama_kelas,
                a.status,
                COALESCE(a.keterangan, '-') as keterangan,
                DATE_FORMAT(a.waktu_absen, '%H:%i:%s') as waktu_absen
            FROM absensi_siswa a
            JOIN siswa s ON a.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            ORDER BY a.tanggal DESC, k.nama_kelas, s.nama
        `;

        const [rows] = await global.dbPool.execute(query);

        let csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += 'Tanggal,Nama Siswa,NIS,Kelas,Status,Keterangan,Waktu Absen\n';

        rows.forEach(row => {
            csvContent += `"${row.tanggal}","${row.nama_siswa}","${row.nis}","${row.nama_kelas}","${row.status}","${row.keterangan}","${row.waktu_absen}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="data-kehadiran-siswa.csv"');
        res.send(csvContent);

        console.log(`✅ Attendance data exported successfully: ${rows.length} records`);
    } catch (error) {
        console.error('❌ Error exporting attendance data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export Jadwal Pelajaran - Matrix Format
app.get('/api/admin/export/jadwal-matrix', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📅 Exporting jadwal matrix format...');
        console.log('🔍 Query parameters:', req.query);

        const { kelas_id, hari } = req.query;

        // Import letterhead service
        const { getLetterhead } = await import('./backend/utils/letterheadService.js');
        const { REPORT_KEYS } = await import('./backend/utils/letterheadService.js');

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.JADWAL_PELAJARAN });

        let query = `
            SELECT 
                j.id_jadwal,
                j.hari,
                j.jam_ke,
                j.jam_mulai,
                j.jam_selesai,
                j.jenis_aktivitas,
                j.is_absenable,
                j.keterangan_khusus,
                k.nama_kelas,
                COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel,
                COALESCE(g.nama, 'Sistem') as nama_guru,
                COALESCE(g.nip, '-') as nip_guru,
                rk.kode_ruang,
                rk.nama_ruang,
                rk.lokasi,
                GROUP_CONCAT(CONCAT(g2.nama, ' (', g2.nip, ')') ORDER BY jg2.is_primary DESC SEPARATOR ', ') as guru_list
            FROM jadwal j
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN ruang_kelas rk ON j.ruang_id = rk.id_ruang
            LEFT JOIN jadwal_guru jg2 ON j.id_jadwal = jg2.jadwal_id
            LEFT JOIN guru g2 ON jg2.guru_id = g2.id_guru
            WHERE j.status = 'aktif'
        `;

        const params = [];

        if (kelas_id && kelas_id !== 'all') {
            query += ' AND j.kelas_id = ?';
            params.push(kelas_id);
        }

        if (hari && hari !== 'all') {
            query += ' AND j.hari = ?';
            params.push(hari);
        }

        query += `
            GROUP BY j.id_jadwal
            ORDER BY 
                FIELD(j.hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'),
                j.jam_ke, 
                k.nama_kelas
        `;

        const [schedules] = await global.dbPool.execute(query, params);

        console.log('📊 Query executed successfully');
        console.log('📊 Schedules found:', schedules.length);
        console.log('📊 Sample schedule:', schedules[0]);

        // Use already imported ExcelJS
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Jadwal Pelajaran Matrix');

        // Set up styles
        const headerStyle = {
            font: { bold: true, size: 12, color: { argb: 'FFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '366092' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };

        const cellStyle = {
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };

        let currentRow = 1;
        const daysOfWeek = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const totalCols = daysOfWeek.length + 1;

        // Add letterhead if enabled
        if (letterhead.enabled && letterhead.lines && letterhead.lines.length > 0) {
            const alignment = letterhead.alignment || 'center';

            // Add logo kiri dan kanan jika tersedia
            if (letterhead.logoLeftUrl || letterhead.logoRightUrl) {
                const logoRow = worksheet.getRow(currentRow);

                // Logo kiri
                if (letterhead.logoLeftUrl) {
                    try {
                        let logoBuffer;
                        if (letterhead.logoLeftUrl.startsWith('data:image/')) {
                            const base64Data = letterhead.logoLeftUrl.split(',')[1];
                            logoBuffer = Buffer.from(base64Data, 'base64');
                        } else {
                            const logoPath = path.join(process.cwd(), 'public', letterhead.logoLeftUrl);
                            if (fsSync.existsSync(logoPath)) {
                                logoBuffer = fsSync.readFileSync(logoPath);
                            }
                        }

                        if (logoBuffer) {
                            const logoId = workbook.addImage({
                                buffer: logoBuffer,
                                extension: 'png'
                            });
                            worksheet.addImage(logoId, {
                                tl: { col: 0, row: currentRow - 1 },
                                br: { col: 2, row: currentRow + 2 }
                            });
                        }
                    } catch (error) {
                        console.warn('⚠️ Logo kiri tidak dapat dimuat:', error.message);
                    }
                }

                // Logo kanan
                if (letterhead.logoRightUrl) {
                    try {
                        let logoBuffer;
                        if (letterhead.logoRightUrl.startsWith('data:image/')) {
                            const base64Data = letterhead.logoRightUrl.split(',')[1];
                            logoBuffer = Buffer.from(base64Data, 'base64');
                        } else {
                            const logoPath = path.join(process.cwd(), 'public', letterhead.logoRightUrl);
                            if (fsSync.existsSync(logoPath)) {
                                logoBuffer = fsSync.readFileSync(logoPath);
                            }
                        }

                        if (logoBuffer) {
                            const logoId = workbook.addImage({
                                buffer: logoBuffer,
                                extension: 'png'
                            });
                            worksheet.addImage(logoId, {
                                tl: { col: totalCols - 2, row: currentRow - 1 },
                                br: { col: totalCols, row: currentRow + 2 }
                            });
                        }
                    } catch (error) {
                        console.warn('⚠️ Logo kanan tidak dapat dimuat:', error.message);
                    }
                }

                logoRow.height = 60;
                currentRow += 3;
            }

            // Add letterhead lines
            letterhead.lines.forEach((line) => {
                const cell = worksheet.getCell(currentRow, 1);
                cell.value = line.text;
                cell.font = {
                    bold: line.fontWeight === 'bold',
                    size: line.fontWeight === 'bold' ? 14 : 12
                };
                cell.alignment = { horizontal: alignment };
                worksheet.mergeCells(currentRow, 1, currentRow, totalCols);
                currentRow++;
            });

            // Add separator line
            currentRow++;
        }

        // Header
        const titleCell = worksheet.getCell(currentRow, 1);
        titleCell.value = 'JADWAL PELAJARAN MATRIX';
        titleCell.font = { bold: true, size: 16 };
        titleCell.alignment = { horizontal: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, totalCols);
        currentRow++;

        const currentDate = formatWIBDate();
        const dateCell = worksheet.getCell(currentRow, 1);
        dateCell.value = `Tanggal Export: ${currentDate}`;
        dateCell.font = { size: 12 };
        dateCell.alignment = { horizontal: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, totalCols);
        currentRow++;

        // Create matrix format - Group by class and day
        const uniqueClasses = [...new Set(schedules.map(s => s.nama_kelas))].sort();

        // Add empty row
        currentRow++;

        // Create matrix headers
        const matrixHeaders = ['KELAS', ...daysOfWeek];
        matrixHeaders.forEach((header, index) => {
            const cell = worksheet.getCell(currentRow, index + 1);
            cell.value = header;
            Object.assign(cell, headerStyle);
        });

        // Create matrix data
        currentRow++;
        uniqueClasses.forEach(className => {
            const classRow = currentRow;
            worksheet.getCell(classRow, 1).value = className;
            Object.assign(worksheet.getCell(classRow, 1), cellStyle);

            daysOfWeek.forEach((day, dayIndex) => {
                const daySchedules = schedules.filter(s =>
                    s.nama_kelas === className && s.hari === day
                ).sort((a, b) => (a.jam_ke || 0) - (b.jam_ke || 0));

                if (daySchedules.length > 0) {
                    // Build cell content with clear structure
                    const contentParts = [];
                    daySchedules.forEach((schedule) => {
                        const entry = [];
                        
                        // 1. Guru (Paling Atas - Bold di Excel idealnya, text biasa dulu)
                        const teacherName = schedule.nama_guru || 'Sistem';
                        entry.push(teacherName);
                        
                        // 2. Mapel
                        entry.push(schedule.nama_mapel || '-');
                        
                        // 3. Ruang
                        entry.push(schedule.kode_ruang || 'TBD');
                        
                        // 4. Waktu
                        entry.push(`${schedule.jam_mulai} - ${schedule.jam_selesai}`);
                        
                        contentParts.push(entry.join('\n'));
                    });
                    
                    // Join multiple schedules with separator
                    const cellContent = contentParts.join('\n───\n');

                    const cell = worksheet.getCell(classRow, dayIndex + 2);
                    cell.value = cellContent;
                    cell.alignment = { 
                        horizontal: 'center', 
                        vertical: 'top', // Align top for better readability with multi-line
                        wrapText: true 
                    };
                    Object.assign(cell, cellStyle);
                } else {
                    const cell = worksheet.getCell(classRow, dayIndex + 2);
                    cell.value = '-';
                    Object.assign(cell, cellStyle);
                }
            });

            // Set row height based on content
            const maxSchedules = Math.max(...daysOfWeek.map(day => 
                schedules.filter(s => s.nama_kelas === className && s.hari === day).length
            ), 1);
            worksheet.getRow(classRow).height = Math.max(80, maxSchedules * 70);
            
            currentRow++;
        });

        // Set column widths - wider for better readability
        worksheet.getColumn(1).width = 12; // KELAS column
        for (let i = 2; i <= totalCols; i++) {
            worksheet.getColumn(i).width = 22; // Day columns
        }

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Jadwal_Pelajaran_Matrix_${currentDate.replace(/\//g, '-')}.xlsx"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        // Write workbook to response
        try {
            await workbook.xlsx.write(res);
            res.end();
            console.log(`✅ Jadwal matrix exported successfully: ${schedules.length} records`);
        } catch (writeError) {
            console.error('❌ Error writing Excel file:', writeError);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error generating Excel file' });
            }
        }
    } catch (error) {
        console.error('❌ Error exporting jadwal matrix:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Export Jadwal Pelajaran - Grid Format
app.get('/api/admin/export/jadwal-grid', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📅 Exporting jadwal grid format...');

        const { kelas_id, hari } = req.query;

        // Import letterhead service
        const { getLetterhead } = await import('./backend/utils/letterheadService.js');
        const { REPORT_KEYS } = await import('./backend/utils/letterheadService.js');

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.JADWAL_PELAJARAN });

        let query = `
            SELECT 
                j.id_jadwal,
                j.hari,
                j.jam_ke,
                j.jam_mulai,
                j.jam_selesai,
                j.jenis_aktivitas,
                j.is_absenable,
                j.keterangan_khusus,
                k.nama_kelas,
                COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel,
                COALESCE(g.nama, 'Sistem') as nama_guru,
                COALESCE(g.nip, '-') as nip_guru,
                rk.kode_ruang,
                rk.nama_ruang,
                rk.lokasi,
                GROUP_CONCAT(CONCAT(g2.nama, ' (', g2.nip, ')') ORDER BY jg2.is_primary DESC SEPARATOR ', ') as guru_list
            FROM jadwal j
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN ruang_kelas rk ON j.ruang_id = rk.id_ruang
            LEFT JOIN jadwal_guru jg2 ON j.id_jadwal = jg2.jadwal_id
            LEFT JOIN guru g2 ON jg2.guru_id = g2.id_guru
            WHERE j.status = 'aktif'
        `;

        const params = [];

        if (kelas_id && kelas_id !== 'all') {
            query += ' AND j.kelas_id = ?';
            params.push(kelas_id);
        }

        if (hari && hari !== 'all') {
            query += ' AND j.hari = ?';
            params.push(hari);
        }

        query += `
            GROUP BY j.id_jadwal
            ORDER BY 
                FIELD(j.hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'),
                j.jam_ke, 
                k.nama_kelas
        `;

        const [schedules] = await global.dbPool.execute(query, params);

        console.log('📊 Grid Query executed successfully');
        console.log('📊 Grid Schedules found:', schedules.length);
        console.log('📊 Grid Sample schedule:', schedules[0]);

        // Use already imported ExcelJS
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Jadwal Pelajaran Grid');

        // Set up styles
        const headerStyle = {
            font: { bold: true, size: 12, color: { argb: 'FFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '366092' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };

        const cellStyle = {
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };

        let currentRow = 1;
        const totalCols = 10; // Grid format has 10 columns

        // Add letterhead if enabled
        if (letterhead.enabled && letterhead.lines && letterhead.lines.length > 0) {
            const alignment = letterhead.alignment || 'center';

            // Add logo kiri dan kanan jika tersedia
            if (letterhead.logoLeftUrl || letterhead.logoRightUrl) {
                const logoRow = worksheet.getRow(currentRow);

                // Logo kiri
                if (letterhead.logoLeftUrl) {
                    try {
                        let logoBuffer;
                        if (letterhead.logoLeftUrl.startsWith('data:image/')) {
                            const base64Data = letterhead.logoLeftUrl.split(',')[1];
                            logoBuffer = Buffer.from(base64Data, 'base64');
                        } else {
                            const logoPath = path.join(process.cwd(), 'public', letterhead.logoLeftUrl);
                            if (fsSync.existsSync(logoPath)) {
                                logoBuffer = fsSync.readFileSync(logoPath);
                            }
                        }

                        if (logoBuffer) {
                            const logoId = workbook.addImage({
                                buffer: logoBuffer,
                                extension: 'png'
                            });
                            worksheet.addImage(logoId, {
                                tl: { col: 0, row: currentRow - 1 },
                                br: { col: 2, row: currentRow + 2 }
                            });
                        }
                    } catch (error) {
                        console.warn('⚠️ Logo kiri tidak dapat dimuat:', error.message);
                    }
                }

                // Logo kanan
                if (letterhead.logoRightUrl) {
                    try {
                        let logoBuffer;
                        if (letterhead.logoRightUrl.startsWith('data:image/')) {
                            const base64Data = letterhead.logoRightUrl.split(',')[1];
                            logoBuffer = Buffer.from(base64Data, 'base64');
                        } else {
                            const logoPath = path.join(process.cwd(), 'public', letterhead.logoRightUrl);
                            if (fsSync.existsSync(logoPath)) {
                                logoBuffer = fsSync.readFileSync(logoPath);
                            }
                        }

                        if (logoBuffer) {
                            const logoId = workbook.addImage({
                                buffer: logoBuffer,
                                extension: 'png'
                            });
                            worksheet.addImage(logoId, {
                                tl: { col: totalCols - 2, row: currentRow - 1 },
                                br: { col: totalCols, row: currentRow + 2 }
                            });
                        }
                    } catch (error) {
                        console.warn('⚠️ Logo kanan tidak dapat dimuat:', error.message);
                    }
                }

                logoRow.height = 60;
                currentRow += 3;
            }

            // Add letterhead lines
            letterhead.lines.forEach((line) => {
                const cell = worksheet.getCell(currentRow, 1);
                cell.value = line.text;
                cell.font = {
                    bold: line.fontWeight === 'bold',
                    size: line.fontWeight === 'bold' ? 14 : 12
                };
                cell.alignment = { horizontal: alignment };
                worksheet.mergeCells(currentRow, 1, currentRow, totalCols);
                currentRow++;
            });

            // Add separator line
            currentRow++;
        }

        // Header
        const titleCell = worksheet.getCell(currentRow, 1);
        titleCell.value = 'JADWAL PELAJARAN GRID';
        titleCell.font = { bold: true, size: 16 };
        titleCell.alignment = { horizontal: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, totalCols);
        currentRow++;

        const currentDate = formatWIBDate();
        const dateCell = worksheet.getCell(currentRow, 1);
        dateCell.value = `Tanggal Export: ${currentDate}`;
        dateCell.font = { size: 12 };
        dateCell.alignment = { horizontal: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, totalCols);
        currentRow++;

        // Add empty row
        currentRow++;

        // Table headers
        const headers = ['NO', 'HARI', 'JAM KE', 'JAM MULAI', 'JAM SELESAI', 'KELAS', 'MATA PELAJARAN', 'GURU', 'RUANG', 'KETERANGAN'];
        headers.forEach((header, index) => {
            const cell = worksheet.getCell(currentRow, index + 1);
            cell.value = header;
            Object.assign(cell, headerStyle);
        });

        // Data rows
        currentRow++;
        schedules.forEach((schedule, index) => {
            const row = currentRow + index;
            worksheet.getCell(row, 1).value = index + 1;
            worksheet.getCell(row, 2).value = schedule.hari;
            worksheet.getCell(row, 3).value = schedule.jam_ke || '-';
            worksheet.getCell(row, 4).value = schedule.jam_mulai;
            worksheet.getCell(row, 5).value = schedule.jam_selesai;
            worksheet.getCell(row, 6).value = schedule.nama_kelas;
            worksheet.getCell(row, 7).value = schedule.nama_mapel;
            // Handle multi-guru display for grid format
            if (schedule.guru_list && schedule.guru_list.includes(',')) {
                // Format: "Guru1 (NIP1), Guru2 (NIP2)"
                worksheet.getCell(row, 8).value = schedule.guru_list;
            } else {
                worksheet.getCell(row, 8).value = schedule.nama_guru;
            }
            worksheet.getCell(row, 9).value = schedule.kode_ruang ? `${schedule.kode_ruang} (${schedule.nama_ruang})` : '-';
            worksheet.getCell(row, 10).value = schedule.keterangan_khusus || '-';

            // Apply cell style to all cells in the row
            for (let col = 1; col <= 10; col++) {
                Object.assign(worksheet.getCell(row, col), cellStyle);
            }
        });

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            column.width = 15;
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Jadwal_Pelajaran_Grid_${currentDate.replace(/\//g, '-')}.xlsx"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        // Write workbook to response
        try {
            await workbook.xlsx.write(res);
            res.end();
            console.log(`✅ Jadwal grid exported successfully: ${schedules.length} records`);
        } catch (writeError) {
            console.error('❌ Error writing Excel file:', writeError);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error generating Excel file' });
            }
        }
    } catch (error) {
        console.error('❌ Error exporting jadwal grid:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Export Jadwal Pelajaran - Print Format
app.get('/api/admin/export/jadwal-print', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📅 Exporting jadwal print format...');

        const { kelas_id, hari } = req.query;

        // Import letterhead service
        const { getLetterhead } = await import('./backend/utils/letterheadService.js');
        const { REPORT_KEYS } = await import('./backend/utils/letterheadService.js');

        // Load letterhead configuration
        const letterhead = await getLetterhead({ reportKey: REPORT_KEYS.JADWAL_PELAJARAN });

        let query = `
            SELECT 
                j.id_jadwal,
                j.hari,
                j.jam_ke,
                j.jam_mulai,
                j.jam_selesai,
                j.jenis_aktivitas,
                j.is_absenable,
                j.keterangan_khusus,
                k.nama_kelas,
                COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel,
                COALESCE(g.nama, 'Sistem') as nama_guru,
                COALESCE(g.nip, '-') as nip_guru,
                rk.kode_ruang,
                rk.nama_ruang,
                rk.lokasi,
                GROUP_CONCAT(CONCAT(g2.nama, ' (', g2.nip, ')') ORDER BY jg2.is_primary DESC SEPARATOR ', ') as guru_list
            FROM jadwal j
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            LEFT JOIN guru g ON j.guru_id = g.id_guru
            LEFT JOIN ruang_kelas rk ON j.ruang_id = rk.id_ruang
            LEFT JOIN jadwal_guru jg2 ON j.id_jadwal = jg2.jadwal_id
            LEFT JOIN guru g2 ON jg2.guru_id = g2.id_guru
            WHERE j.status = 'aktif'
        `;

        const params = [];

        if (kelas_id && kelas_id !== 'all') {
            query += ' AND j.kelas_id = ?';
            params.push(kelas_id);
        }

        if (hari && hari !== 'all') {
            query += ' AND j.hari = ?';
            params.push(hari);
        }

        query += `
            GROUP BY j.id_jadwal
            ORDER BY 
                FIELD(j.hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'),
                j.jam_ke, 
                k.nama_kelas
        `;

        const [schedules] = await global.dbPool.execute(query, params);

        console.log('📊 Print Query executed successfully');
        console.log('📊 Print Schedules found:', schedules.length);

        // Generate HTML for print
        const currentDate = formatWIBDate();
        const daysOfWeek = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const uniqueClasses = [...new Set(schedules.map(s => s.nama_kelas))].sort();

        // Generate letterhead HTML
        let letterheadHTML = '';
        if (letterhead.enabled && letterhead.lines && letterhead.lines.length > 0) {
            const alignment = letterhead.alignment || 'center';

            // Logo container
            let logoHTML = '';
            if (letterhead.logoLeftUrl || letterhead.logoRightUrl) {
                logoHTML = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">';

                if (letterhead.logoLeftUrl) {
                    logoHTML += `<img src="${letterhead.logoLeftUrl}" style="height: 80px; object-fit: contain;" alt="Logo Kiri" />`;
                } else {
                    logoHTML += '<div></div>';
                }

                if (letterhead.logoRightUrl) {
                    logoHTML += `<img src="${letterhead.logoRightUrl}" style="height: 80px; object-fit: contain;" alt="Logo Kanan" />`;
                } else {
                    logoHTML += '<div></div>';
                }

                logoHTML += '</div>';
            }

            // Letterhead lines
            let linesHTML = letterhead.lines.map(line => {
                const fontWeight = line.fontWeight === 'bold' ? 'bold' : 'normal';
                const fontSize = line.fontWeight === 'bold' ? '16px' : '14px';
                return `<div style="font-weight: ${fontWeight}; font-size: ${fontSize}; text-align: ${alignment};">${line.text}</div>`;
            }).join('');

            letterheadHTML = `
                ${logoHTML}
                ${linesHTML}
                <hr style="margin: 20px 0; border-top: 2px solid #000;" />
            `;
        }

        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Jadwal Pelajaran - Print</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .letterhead { margin-bottom: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { margin: 0; font-size: 24px; }
                .header p { margin: 5px 0; color: #666; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #333; padding: 8px; text-align: center; }
                th { background-color: #f0f0f0; font-weight: bold; }
                .schedule-item { margin: 2px 0; padding: 4px; background-color: #f9f9f9; border-radius: 3px; }
                .schedule-time { font-size: 11px; color: #666; }
                .schedule-subject { font-weight: bold; font-size: 12px; }
                .schedule-teacher { font-size: 11px; color: #333; }
                .schedule-room { font-size: 10px; color: #666; }
                .multi-guru { color: #2d5a27; font-size: 10px; margin-top: 2px; }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="letterhead">
                ${letterheadHTML}
            </div>
            
            <div class="header">
                <h1>JADWAL PELAJARAN</h1>
                <p>Tanggal Export: ${currentDate}</p>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>KELAS</th>
                        ${daysOfWeek.map(day => `<th>${day}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        // Generate matrix data
        uniqueClasses.forEach(className => {
            html += `<tr><td><strong>${className}</strong></td>`;

            daysOfWeek.forEach(day => {
                const daySchedules = schedules.filter(s =>
                    s.nama_kelas === className && s.hari === day
                ).sort((a, b) => (a.jam_ke || 0) - (b.jam_ke || 0));

                html += '<td>';
                if (daySchedules.length > 0) {
                    daySchedules.forEach((schedule, idx) => {
                        html += `<div class="schedule-item">`;
                        html += `<div class="schedule-time">${schedule.jam_mulai}-${schedule.jam_selesai}</div>`;
                        html += `<div class="schedule-subject">${schedule.nama_mapel}</div>`;

                        // Handle multi-guru display
                        if (schedule.guru_list && schedule.guru_list.includes(',')) {
                            html += `<div class="schedule-teacher">Guru: ${schedule.guru_list}</div>`;
                        } else {
                            html += `<div class="schedule-teacher">${schedule.nama_guru}</div>`;
                        }

                        if (schedule.kode_ruang) {
                            html += `<div class="schedule-room">${schedule.kode_ruang}</div>`;
                        }
                        html += '</div>';
                    });
                } else {
                    html += '<div class="schedule-item">-</div>';
                }
                html += '</td>';
            });
            html += '</tr>';
        });

        html += `
                </tbody>
            </table>
            
            <script>
                window.onload = function() {
                    window.print();
                }
            </script>
        </body>
        </html>
        `;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `inline; filename="Jadwal_Pelajaran_Print_${currentDate.replace(/\//g, '-')}.html"`);
        res.send(html);

        console.log(`✅ Jadwal print exported successfully: ${schedules.length} records`);
    } catch (error) {
        console.error('❌ Error exporting jadwal print:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Database backup endpoint - REAL BACKUP
app.get('/api/admin/backup', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('💾 Creating database backup...');

        // Buat folder backups jika belum ada
        const backupDir = path.join(process.cwd(), 'backups');
        try {
            await fs.access(backupDir);
        } catch (error) {
            await fs.mkdir(backupDir, { recursive: true });
        }

        // Generate filename dengan timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup_absenta_${timestamp}.sql`;
        const filepath = path.join(backupDir, filename);

        // Function untuk backup manual
        async function createManualBackup() {
            try {
                // Header backup file
                let backupContent = `-- Backup Database Absenta\n`;
                backupContent += `-- Created: ${new Date().toISOString()}\n`;
                backupContent += `-- Database: absenta13\n\n`;

                // Export struktur dan data tabel utama
                const tables = [
                    'users', 'guru', 'siswa', 'kelas', 'mapel',
                    'jadwal', 'absensi_siswa', 'absensi_guru'
                ];

                for (const table of tables) {
                    try {
                        // Get table structure
                        const [structure] = await global.dbPool.execute(`SHOW CREATE TABLE ${table}`);
                        backupContent += `\n-- Structure for table ${table}\n`;
                        backupContent += `${structure[0]['Create Table']};\n\n`;

                        // Get table data
                        const [data] = await global.dbPool.execute(`SELECT * FROM ${table}`);
                        if (data.length > 0) {
                            backupContent += `-- Data for table ${table}\n`;
                            backupContent += `INSERT INTO ${table} VALUES\n`;

                            const values = data.map(row => {
                                const rowValues = Object.values(row).map(value => {
                                    if (value === null) return 'NULL';
                                    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
                                    return value;
                                });
                                return `(${rowValues.join(', ')})`;
                            });

                            backupContent += values.join(',\n') + ';\n\n';
                        }
                    } catch (tableError) {
                        console.log(`⚠️ Error backing up table ${table}:`, tableError.message);
                        backupContent += `-- Error backing up table ${table}\n\n`;
                    }
                }

                // Tulis file backup
                await fs.writeFile(filepath, backupContent, 'utf8');

                console.log('✅ Manual backup created successfully');

                // Get file size using fs.stat
                const stats = await fs.stat(filepath);

                return {
                    message: 'Backup database berhasil dibuat secara manual',
                    filename: filename,
                    filepath: filepath,
                    timestamp: formatWIBTime(),
                    method: 'manual',
                    size: stats.size
                };

            } catch (manualError) {
                console.error('❌ Manual backup failed:', manualError);
                throw new Error('Gagal membuat backup database');
            }
        }

        // Coba gunakan mysqldump jika tersedia
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            // Cek apakah mysqldump tersedia
            await execAsync('mysqldump --version');

            // Buat backup dengan mysqldump (tanpa password untuk testing)
            // Di production, gunakan environment variable atau config file untuk password
            const mysqldumpCmd = `mysqldump -h localhost -u root absenta13 > "${filepath}"`;
            await execAsync(mysqldumpCmd);

            console.log('✅ mysqldump backup created successfully');

            // Set headers untuk download file
            res.setHeader('Content-Type', 'application/sql');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            // Baca dan kirim file
            const fileContent = await fs.readFile(filepath, 'utf8');
            res.send(fileContent);

        } catch (mysqldumpError) {
            console.log('❌ mysqldump not available, using manual backup...');
            const result = await createManualBackup();

            // Set headers untuk download file
            res.setHeader('Content-Type', 'application/sql');
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);

            // Baca dan kirim file
            const fileContent = await fs.readFile(result.filepath, 'utf8');
            res.send(fileContent);
        }

    } catch (error) {
        console.error('❌ Error creating database backup:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// System logs endpoint
app.get('/api/admin/logs', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('📋 Retrieving system logs...');

        // For now, return sample log data
        // In production, you would implement actual log retrieval
        const logs = [
            {
                timestamp: formatWIBTime(),
                level: 'INFO',
                message: 'Sistem berjalan normal',
                user: 'admin'
            },
            {
                timestamp: new Date(Date.now() - 60000).toISOString(),
                level: 'INFO',
                message: 'Database backup otomatis berhasil',
                user: 'system'
            },
            {
                timestamp: new Date(Date.now() - 120000).toISOString(),
                level: 'WARNING',
                message: 'Tingkat kehadiran rendah hari ini',
                user: 'system'
            }
        ];

        res.json({ logs });

        console.log('✅ System logs retrieved successfully');
    } catch (error) {
        console.error('❌ Error retrieving system logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down server...');
    if (global.disasterRecoverySystem) {
        await global.disasterRecoverySystem.stop();
        console.log('✅ Disaster recovery system stopped');
    }
    if (global.securitySystem) {
        await global.securitySystem.cleanup();
        console.log('✅ Security system cleaned up');
    }
    if (global.systemMonitor) {
        global.systemMonitor.stop();
        console.log('✅ System monitor stopped');
    }
    if (global.loadBalancer) {
        // LoadBalancer doesn't have cleanup method, just stop it
        console.log('✅ Load balancer cleaned up');
    }
    if (global.cacheSystem) {
        // CacheSystem doesn't have cleanup method, just log
        console.log('✅ Cache system cleaned up');
    }
    if (global.downloadQueue) {
        // DownloadQueue doesn't have cleanup method, just log
        console.log('✅ Download queue system cleaned up');
    }
    if (global.backupSystem) {
        await global.backupSystem.close();
        console.log('✅ Backup system cleaned up');
    }
    if (global.queryOptimizer) {
        await global.queryOptimizer.cleanup();
        console.log('✅ Query optimizer cleaned up');
    }
    if (global.performanceOptimizer) {
        global.performanceOptimizer.stop();
        console.log('✅ Performance optimizer cleaned up');
    }
    if (global.dbPool) {
        await global.dbPool.close();
        console.log('✅ Database connection pool closed');
    }
    process.exit(0);
});

// Endpoint untuk menginisialisasi letterhead default
app.post('/api/admin/init-letterhead', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        console.log('🚀 Initializing default letterhead...');

        // Check if letterhead already exists
        const [existingRows] = await global.dbPool.execute(
            'SELECT id FROM kop_laporan WHERE cakupan = "global" AND kode_laporan IS NULL AND aktif = 1 LIMIT 1'
        );

        if (existingRows.length > 0) {
            console.log('✅ Letterhead sudah ada, tidak perlu inisialisasi');
            return res.json({
                success: true,
                message: 'Letterhead sudah ada di database'
            });
        }

        // Insert default letterhead matched with SMKN 13 Bandung
        const defaultLines = JSON.stringify([
            { text: "PEMERINTAH DAERAH PROVINSI JAWA BARAT", fontWeight: "bold" },
            { text: "DINAS PENDIDIKAN", fontWeight: "bold" },
            { text: "SEKOLAH MENENGAH KEJURUAN NEGERI 13 BANDUNG", fontWeight: "bold" },
            { text: "Jl. Soekarno Hatta No. 10, Kota Bandung 40235", fontWeight: "normal" },
            { text: "Telepon: (022) 5204095 | Email: smkn13bandung@sch.id", fontWeight: "normal" }
        ]);

        const query = `
      INSERT INTO kop_laporan (
        cakupan, kode_laporan, aktif, perataan, baris_teks, 
        logo_tengah_url, logo_kiri_url, logo_kanan_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

        const params = [
            'global',
            null,
            1,
            'tengah',
            defaultLines,
            null,
            '/logo-kiri.png',
            '/logo-kanan.png'
        ];

        await global.dbPool.execute(query, params);

        console.log('✅ Letterhead default berhasil diinisialisasi');
        res.json({
            success: true,
            message: 'Letterhead default berhasil diinisialisasi'
        });

    } catch (error) {
        console.error('❌ Error initializing letterhead:', error);
        res.status(500).json({
            success: false,
            message: 'Error menginisialisasi letterhead default',
            error: error.message
        });
    }
});

export default app;
