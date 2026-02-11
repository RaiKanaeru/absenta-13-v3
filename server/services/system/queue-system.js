/**
 * QUEUE SYSTEM FOR DOWNLOADS
 * Phase 3: Redis & Bull Queue for handling concurrent Excel downloads
 * Target: Handle 80 concurrent downloads, Priority system, Background processing
 */

import dotenv from 'dotenv';
dotenv.config();

import Queue from 'bull';
import Redis from 'ioredis';
import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { createLogger } from '../../utils/logger.js';
import { buildDownloadFilename, isFilenameOwnedByUser, isSafeFilename } from '../../utils/downloadAccess.js';

const logger = createLogger('Queue');

class DownloadQueue {
    constructor() {
        // Redis configuration from environment
        this.redisConfig = {
            host: process.env.REDIS_HOST || 'localhost',
            port: Number.parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: Number.parseInt(process.env.REDIS_MAX_RETRIES) || 3,
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
            maxLoadingTimeout: 1000
        };

        // Remove password if empty
        if (!this.redisConfig.password) {
            delete this.redisConfig.password;
        }

        // Database configuration from environment
        this.dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'absenta13',
            port: Number.parseInt(process.env.DB_PORT) || 3306,
            connectionLimit: 10,
            acquireTimeout: 10000,
            timezone: process.env.DB_TIMEZONE || '+07:00'
        };

        this.redis = null;
        this.pool = null;
        this.queues = {};
        this.downloadDir = process.env.REPORTS_DIR || './downloads';
        this.maxConcurrentDownloads = 80;
        this.fileAccessMap = new Map();
        this.fileAccessTtlMs = 24 * 60 * 60 * 1000;
        this.maxExportSize = 50 * 1024 * 1024; // 50MB
        this.priorityLevels = {
            admin: 1,    // Highest priority
            guru: 2,     // Medium priority
            siswa: 3     // Lowest priority
        };
    }

    /**
     * Initialize queue system
     */
    async initialize() {
        logger.info('Initializing Download Queue System');
        
        try {
            // Initialize Redis connection
            await this.initializeRedis();
            
            // Initialize database connection pool
            await this.initializeDatabase();
            
            // Create download directory
            await this.createDownloadDirectory();
            
            // Initialize queues
            await this.initializeQueues();
            
            // Start queue processors
            await this.startQueueProcessors();
            
            // Start file cleanup scheduler
            await this.startFileCleanupScheduler();
            
            logger.info('Download Queue System initialized successfully');
            return true;
            
        } catch (error) {
            logger.error('Queue system initialization failed', error);
            throw error;
        }
    }

    /**
     * Initialize Redis connection
     */
    async initializeRedis() {
        logger.info('Connecting to Redis');
        
        try {
            this.redis = new Redis(this.redisConfig);
            
            // Test Redis connection
            await this.redis.ping();
            logger.info('Redis connection established');
            
            // Handle Redis connection events
            this.redis.on('error', (error) => {
                logger.error('Redis connection error', error);
            });
        } catch (error) {
            logger.error('Redis initialization failed', error);
            throw error;
        }
    }

    /**
     * Initialize database connection pool
     */
    async initializeDatabase() {
        logger.info('Initializing database connection pool');
        this.pool = mysql.createPool(this.dbConfig);
        // Test connection
        const connection = await this.pool.getConnection();
        connection.release();
        logger.info('Database connection established');
    }

    /**
     * Create download directory
     */
    async createDownloadDirectory() {
        try {
            await fs.access(this.downloadDir);
        } catch {
            logger.info('Creating download directory', { dir: this.downloadDir });
            await fs.mkdir(this.downloadDir, { recursive: true });
        }
    }

    /**
     * Initialize queues
     */
    async initializeQueues() {
        logger.info('Initializing Bull queues');
        
        const redisOpts = {
            redis: this.redisConfig
        };

        this.queues.excelDownload = new Queue('excel-download', redisOpts);
        this.queues.reportGeneration = new Queue('report-generation', redisOpts);
        
        logger.info('Queues initialized');
    }

    /**
     * Start queue processors
     */
    async startQueueProcessors() {
        logger.info('Starting queue processors');
        
        this.queues.excelDownload.process(this.maxConcurrentDownloads, async (job) => {
            const { type } = job.data;
            
            switch (type) {
                case 'student-attendance':
                    return this.processStudentAttendanceDownload(job);
                case 'teacher-attendance':
                    return this.processTeacherAttendanceDownload(job);
                case 'analytics-report':
                    return this.processAnalyticsReportDownload(job);
                default:
                    throw new Error(`Unknown job type: ${type}`);
            }
        });

        this.queues.reportGeneration.process(5, async (job) => {
             const { type } = job.data;
             if (type === 'semester-report') {
                 return this.processSemesterReportGeneration(job);
             }
        });
        
        // Report generation queue events
        this.queues.reportGeneration.on('completed', (job, result) => {
            logger.info('Report generation completed', { jobId: job.id, filename: result.filename });
        });

        this.queues.reportGeneration.on('failed', (job, err) => {
            logger.error('Report generation failed', { jobId: job.id, error: err.message });
        });
        
        logger.info('Queue processors started');
    }

    /**
     * Add Excel download job to queue
     */
    async addExcelDownloadJob(jobData) {
        const { type, userRole, userId } = jobData;
        
        // Determine priority based on user role
        const jobPriority = this.priorityLevels[userRole] || 3;
        const normalizedUserId = Number.parseInt(userId, 10);

        if (!type) {
            throw new Error('Download job type is required');
        }

        if (!Number.isFinite(normalizedUserId)) {
            throw new Error('Valid userId is required');
        }
        
        const jobOptions = {
            priority: jobPriority,
            delay: 0,
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000
            }
        };

        try {
            const job = await this.queues.excelDownload.add(type, {
                ...jobData,
                timestamp: new Date().toISOString(),
                userId: normalizedUserId,
                userRole
            }, jobOptions);

            logger.info('Added download job', { type, jobId: job.id, priority: jobPriority });
            
            return {
                jobId: job.id,
                status: 'queued',
                estimatedTime: this.estimateProcessingTime(jobPriority),
                queuePosition: await this.getQueuePosition(job.id)
            };

        } catch (error) {
            logger.error('Failed to add download job', error);
            throw error;
        }
    }

    /**
     * Register download file access ownership
     */
    registerDownloadFile(filename, userId) {
        const normalizedUserId = Number.parseInt(userId, 10);
        if (!filename || !Number.isFinite(normalizedUserId)) return;
        this.purgeExpiredFileAccess();
        this.fileAccessMap.set(filename, { userId: normalizedUserId, createdAt: Date.now() });
    }

    /**
     * Verify if user can access a download file
     */
    verifyFileAccess(filename, userId) {
        if (!isSafeFilename(filename)) return false;
        const normalizedUserId = Number.parseInt(userId, 10);
        if (!Number.isFinite(normalizedUserId)) return false;

        this.purgeExpiredFileAccess();

        if (this.fileAccessMap.has(filename)) {
            const entry = this.fileAccessMap.get(filename);
            const storedUserId = typeof entry === 'object' && entry !== null ? entry.userId : entry;
            return Number(storedUserId) === normalizedUserId;
        }

        return isFilenameOwnedByUser(filename, normalizedUserId);
    }

    /**
     * Purge expired file access entries to prevent unbounded growth
     */
    purgeExpiredFileAccess() {
        const now = Date.now();
        for (const [filename, entry] of this.fileAccessMap.entries()) {
            const createdAt = typeof entry === 'object' && entry !== null && entry.createdAt
                ? entry.createdAt
                : now;
            if (now - createdAt > this.fileAccessTtlMs) {
                this.fileAccessMap.delete(filename);
            }
        }
    }

    /**
     * Remove sensitive fields from job result
     */
    sanitizeJobResult(result) {
        if (!result || typeof result !== 'object') return result;
        const { filepath, ...safeResult } = result;
        return safeResult;
    }

    /**
     * Process student attendance download
     */
    async processStudentAttendanceDownload(job) {
        const { filters, userId } = job.data;
        const { tanggal_mulai, tanggal_selesai, kelas_id } = filters;
        
        logger.debug('Processing student attendance download', { jobId: job.id });
        
        try {
            // Update job progress
            await job.progress(10);
            
            // Build query
            let query = `
                SELECT 
                    a.tanggal,
                    s.nis,
                    s.nama as nama_siswa,
                    k.nama_kelas,
                    a.status,
                    a.keterangan,
                    a.waktu_absen,
                    g.nama as nama_guru,
                    mp.nama_mapel
                FROM absensi_siswa a
                JOIN siswa s ON a.siswa_id = s.id_siswa
                JOIN kelas k ON s.kelas_id = k.id_kelas
                LEFT JOIN guru g ON a.guru_id = g.id_guru
                LEFT JOIN jadwal j ON a.jadwal_id = j.id_jadwal
                LEFT JOIN mata_pelajaran mp ON j.mapel_id = mp.id
                WHERE a.tanggal BETWEEN ? AND ?
            `;
            
            const params = [tanggal_mulai, tanggal_selesai];
            
            if (kelas_id) {
                query += ' AND s.kelas_id = ?';
                params.push(kelas_id);
            }
            
            query += ' ORDER BY a.tanggal DESC, s.nama ASC';
            
            await job.progress(30);
            
            // Execute query
            const [rows] = await this.pool.execute(query, params);
            
            await job.progress(50);
            
            // Create Excel workbook
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Absensi Siswa');
            
            // Add headers
            worksheet.columns = [
                { header: 'Tanggal', key: 'tanggal', width: 12 },
                { header: 'NIS', key: 'nis', width: 15 },
                { header: 'Nama Siswa', key: 'nama_siswa', width: 25 },
                { header: 'Kelas', key: 'nama_kelas', width: 15 },
                { header: 'Status', key: 'status', width: 12 },
                { header: 'Keterangan', key: 'keterangan', width: 30 },
                { header: 'Waktu Absen', key: 'waktu_absen', width: 20 },
                { header: 'Guru', key: 'nama_guru', width: 20 },
                { header: 'Mata Pelajaran', key: 'nama_mapel', width: 20 }
            ];
            
            await job.progress(70);
            
            // Add data
            rows.forEach(row => {
                worksheet.addRow(row);
            });
            
            // Style headers
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
            
            await job.progress(90);
            
            // Generate filename
            const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
            const filename = buildDownloadFilename({
                prefix: 'absensi_siswa',
                userId,
                parts: [tanggal_mulai, tanggal_selesai],
                timestamp
            });
            const filepath = path.join(this.downloadDir, filename);
            
            // Save Excel file
            await workbook.xlsx.writeFile(filepath);
            this.registerDownloadFile(filename, userId);

            await this.enforceExportSizeLimit(filepath, filename);
            
            await job.progress(100);
            
            logger.info('Student attendance Excel created', { filename, recordCount: rows.length });
            
            return {
                filename,
                filepath,
                recordCount: rows.length,
                fileSize: (await fs.stat(filepath)).size,
                downloadUrl: `/api/downloads/${filename}`
            };

        } catch (error) {
            logger.error('Student attendance download failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Process teacher attendance download
     */
    async processTeacherAttendanceDownload(job) {
        const { filters, userId } = job.data;
        const { tanggal_mulai, tanggal_selesai, guru_id } = filters;
        
        logger.debug('Processing teacher attendance download', { jobId: job.id });
        
        try {
            await job.progress(10);
            
            // Build query
            let query = `
                SELECT 
                    a.tanggal,
                    a.jam_ke,
                    g.nama as nama_guru,
                    k.nama_kelas,
                    a.status,
                    a.keterangan,
                    a.waktu_catat,
                    mp.nama_mapel
                FROM absensi_guru a
                JOIN guru g ON a.guru_id = g.id_guru
                JOIN kelas k ON a.kelas_id = k.id_kelas
                LEFT JOIN jadwal j ON a.jadwal_id = j.id_jadwal
                LEFT JOIN mata_pelajaran mp ON j.mapel_id = mp.id
                WHERE a.tanggal BETWEEN ? AND ?
            `;
            
            const params = [tanggal_mulai, tanggal_selesai];
            
            if (guru_id) {
                query += ' AND a.guru_id = ?';
                params.push(guru_id);
            }
            
            query += ' ORDER BY a.tanggal DESC, a.jam_ke ASC';
            
            await job.progress(30);
            
            // Execute query
            const [rows] = await this.pool.execute(query, params);
            
            await job.progress(50);
            
            // Create Excel workbook
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Absensi Guru');
            
            // Add headers
            worksheet.columns = [
                { header: 'Tanggal', key: 'tanggal', width: 12 },
                { header: 'Jam Ke', key: 'jam_ke', width: 8 },
                { header: 'Nama Guru', key: 'nama_guru', width: 25 },
                { header: 'Kelas', key: 'nama_kelas', width: 15 },
                { header: 'Status', key: 'status', width: 12 },
                { header: 'Keterangan', key: 'keterangan', width: 30 },
                { header: 'Waktu Catat', key: 'waktu_catat', width: 20 },
                { header: 'Mata Pelajaran', key: 'nama_mapel', width: 20 }
            ];
            
            await job.progress(70);
            
            // Add data
            rows.forEach(row => {
                worksheet.addRow(row);
            });
            
            // Style headers
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
            
            await job.progress(90);
            
            // Generate filename
            const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
            const filename = buildDownloadFilename({
                prefix: 'absensi_guru',
                userId,
                parts: [tanggal_mulai, tanggal_selesai, guru_id || 'all'],
                timestamp
            });
            const filepath = path.join(this.downloadDir, filename);
            
            // Save Excel file
            await workbook.xlsx.writeFile(filepath);
            this.registerDownloadFile(filename, userId);

            await this.enforceExportSizeLimit(filepath, filename);
            
            await job.progress(100);
            
            logger.info('Teacher attendance Excel created', { filename, recordCount: rows.length });
            
            return {
                filename,
                filepath,
                recordCount: rows.length,
                fileSize: (await fs.stat(filepath)).size,
                downloadUrl: `/api/downloads/${filename}`
            };

        } catch (error) {
            logger.error('Teacher attendance download failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Process analytics report download
     */
    async processAnalyticsReportDownload(job) {
        const { filters, userId } = job.data;
        const { semester, year } = filters;
        
        logger.debug('Processing analytics report download', { jobId: job.id });
        
        try {
            await job.progress(10);
            
            // Get date range for semester
            const dateRange = this.getSemesterDateRange(semester, year);
            
            await job.progress(20);
            
            // Get analytics data
            const [studentStats] = await this.pool.execute(`
                SELECT 
                    status,
                    COUNT(*) as count
                FROM absensi_siswa 
                WHERE tanggal BETWEEN ? AND ?
                GROUP BY status
            `, [dateRange.start, dateRange.end]);
            
            const [teacherStats] = await this.pool.execute(`
                SELECT 
                    status,
                    COUNT(*) as count
                FROM absensi_guru 
                WHERE tanggal BETWEEN ? AND ?
                GROUP BY status
            `, [dateRange.start, dateRange.end]);
            
            await job.progress(50);
            
            // Create Excel workbook
            const workbook = new ExcelJS.Workbook();
            
            // Analytics Summary Sheet
            const summarySheet = workbook.addWorksheet('Analytics Summary');
            
            // Add summary data
            summarySheet.addRow(['ANALYTICS REPORT', '']);
            summarySheet.addRow(['Semester', semester]);
            summarySheet.addRow(['Year', year]);
            summarySheet.addRow(['Date Range', `${dateRange.start} to ${dateRange.end}`]);
            summarySheet.addRow(['Generated', new Date().toISOString()]);
            summarySheet.addRow(['', '']);
            
            summarySheet.addRow(['STUDENT ATTENDANCE STATISTICS', '']);
            summarySheet.addRow(['Status', 'Count']);
            studentStats.forEach(stat => {
                summarySheet.addRow([stat.status, stat.count]);
            });
            
            summarySheet.addRow(['', '']);
            summarySheet.addRow(['TEACHER ATTENDANCE STATISTICS', '']);
            summarySheet.addRow(['Status', 'Count']);
            teacherStats.forEach(stat => {
                summarySheet.addRow([stat.status, stat.count]);
            });
            
            await job.progress(80);
            
            // Generate filename
            const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
            const filename = buildDownloadFilename({
                prefix: 'analytics_report',
                userId,
                parts: [semester, year],
                timestamp
            });
            const filepath = path.join(this.downloadDir, filename);
            
            // Save Excel file
            await workbook.xlsx.writeFile(filepath);
            this.registerDownloadFile(filename, userId);

            await this.enforceExportSizeLimit(filepath, filename);
            
            await job.progress(100);
            
            logger.info('Analytics report Excel created', { filename });
            
            return {
                filename,
                filepath,
                recordCount: studentStats.length + teacherStats.length,
                fileSize: (await fs.stat(filepath)).size,
                downloadUrl: `/api/downloads/${filename}`
            };

        } catch (error) {
            logger.error('Analytics report download failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Process semester report generation
     */
    async processSemesterReportGeneration(job) {
        const { semester, year, userId } = job.data;
        
        logger.debug('Processing semester report generation', { jobId: job.id });
        
        try {
            await job.progress(10);
            
            // This would be a more complex report generation
            // For now, we'll create a simple summary
            
            await job.progress(50);
            
            // Generate comprehensive semester report
            const filename = buildDownloadFilename({
                prefix: 'semester_report',
                userId,
                parts: [semester, year],
                timestamp: String(Date.now())
            });
            const filepath = path.join(this.downloadDir, filename);
            
            // Create a simple report for now
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Semester Report');
            
            worksheet.addRow(['SEMESTER REPORT', '']);
            worksheet.addRow(['Semester', semester]);
            worksheet.addRow(['Year', year]);
            worksheet.addRow(['Generated', new Date().toISOString()]);
            
            await workbook.xlsx.writeFile(filepath);
            this.registerDownloadFile(filename, userId);
            
            await job.progress(100);
            
            logger.info('Semester report generated', { filename });
            
            return {
                filename,
                filepath,
                fileSize: (await fs.stat(filepath)).size,
                downloadUrl: `/api/downloads/${filename}`
            };

        } catch (error) {
            logger.error('Semester report generation failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Get job status
     */
    async getJobStatus(jobId, userId = null) {
        try {
            const job = await this.queues.excelDownload.getJob(jobId);
            
            if (!job) {
                return { status: 'not_found' };
            }

            if (userId && job?.data?.userId && Number(job.data.userId) !== Number(userId)) {
                return null;
            }
            
            const state = await job.getState();
            const progress = job.progress();
            
            return {
                jobId: job.id,
                status: state,
                progress: progress,
                data: job.data,
                result: this.sanitizeJobResult(job.returnvalue),
                error: job.failedReason,
                createdAt: new Date(job.timestamp),
                processedAt: job.processedOn ? new Date(job.processedOn) : null,
                finishedAt: job.finishedOn ? new Date(job.finishedOn) : null
            };

        } catch (error) {
            logger.error('Failed to get job status', error);
            throw error;
        }
    }

    /**
     * Get queue statistics
     */
    async getQueueStatistics() {
        try {
            const excelQueue = this.queues.excelDownload;
            const reportQueue = this.queues.reportGeneration;
            
            const [excelWaiting, excelActive, excelCompleted, excelFailed] = await Promise.all([
                excelQueue.getWaiting(),
                excelQueue.getActive(),
                excelQueue.getCompleted(),
                excelQueue.getFailed()
            ]);
            
            const [reportWaiting, reportActive, reportCompleted, reportFailed] = await Promise.all([
                reportQueue.getWaiting(),
                reportQueue.getActive(),
                reportQueue.getCompleted(),
                reportQueue.getFailed()
            ]);
            
            return {
                excelDownload: {
                    waiting: excelWaiting.length,
                    active: excelActive.length,
                    completed: excelCompleted.length,
                    failed: excelFailed.length,
                    total: excelWaiting.length + excelActive.length + excelCompleted.length + excelFailed.length
                },
                reportGeneration: {
                    waiting: reportWaiting.length,
                    active: reportActive.length,
                    completed: reportCompleted.length,
                    failed: reportFailed.length,
                    total: reportWaiting.length + reportActive.length + reportCompleted.length + reportFailed.length
                },
                maxConcurrentDownloads: this.maxConcurrentDownloads,
                redisConnected: this.redis.status === 'ready'
            };

        } catch (error) {
            logger.error('Failed to get queue statistics', error);
            throw error;
        }
    }

    /**
     * Estimate processing time based on priority
     */
    estimateProcessingTime(priority) {
        const baseTime = 30; // 30 seconds base time
        const priorityMultiplier = {
            1: 0.5,  // Admin - 15 seconds
            2: 1,  // Guru - 30 seconds
            3: 1.5   // Siswa - 45 seconds
        };
        
        return Math.round(baseTime * (priorityMultiplier[priority] || 1));
    }

    /**
     * Get queue position for a job
     */
    async getQueuePosition(jobId) {
        try {
            const waitingJobs = await this.queues.excelDownload.getWaiting();
            const position = waitingJobs.findIndex(job => job.id === jobId);
            return position >= 0 ? position + 1 : 0;
        } catch (error) {
            logger.debug('Failed to get queue position', { error: error.message });
            return 0;
        }
    }

    /**
     * Get semester date range
     */
    getSemesterDateRange(semester, year) {
        let startDate, endDate;
        
        if (semester === 'Ganjil') {
            startDate = `${year}-07-01`;
            endDate = `${year}-12-31`;
        } else {
            startDate = `${year}-01-01`;
            endDate = `${year}-06-30`;
        }
        
        return { start: startDate, end: endDate };
    }

    /**
     * Start file cleanup scheduler
     * Automatically delete old Excel files to prevent disk space leaks
     */
    async startFileCleanupScheduler() {
        logger.info('Starting file cleanup scheduler', { 
            directory: this.downloadDir,
            retentionHours: this.fileAccessTtlMs / (60 * 60 * 1000)
        });

        // Run cleanup immediately on startup
        await this.cleanupOldFiles();

        // Schedule cleanup every hour
        this.cleanupInterval = setInterval(async () => {
            try {
                await this.cleanupOldFiles();
            } catch (error) {
                logger.error('File cleanup failed', { error: error.message });
            }
        }, 60 * 60 * 1000); // Run every 1 hour

        logger.info('File cleanup scheduler started');
    }

    /**
     * Cleanup old download files
     * Removes .xlsx files older than fileAccessTtlMs (24 hours default)
     */
    async cleanupOldFiles() {
        try {
            const files = await fs.readdir(this.downloadDir);
            const now = Date.now();
            let cleanedCount = 0;
            let totalFreedBytes = 0;

            for (const file of files) {
                // Only process .xlsx files
                if (!file.endsWith('.xlsx')) continue;

                const filepath = path.join(this.downloadDir, file);
                
                try {
                    const stats = await fs.stat(filepath);
                    const fileAge = now - stats.mtimeMs;

                    // Delete if older than retention period
                    if (fileAge > this.fileAccessTtlMs) {
                        await fs.unlink(filepath);
                        this.fileAccessMap.delete(file);
                        cleanedCount++;
                        totalFreedBytes += stats.size;
                        
                        logger.debug('Cleaned up old file', { 
                            file, 
                            ageHours: (fileAge / (60 * 60 * 1000)).toFixed(2),
                            sizeKB: (stats.size / 1024).toFixed(2)
                        });
                    }
                } catch (error) {
                    // Skip files that can't be accessed (may already be deleted)
                    if (error.code !== 'ENOENT') {
                        logger.warn('Failed to cleanup file', { file, error: error.message });
                    }
                }
            }

            if (cleanedCount > 0) {
                logger.info('File cleanup completed', { 
                    filesRemoved: cleanedCount,
                    freedSpaceMB: (totalFreedBytes / (1024 * 1024)).toFixed(2)
                });
            } else {
                logger.debug('File cleanup completed - no old files found');
            }

            return { cleanedCount, totalFreedBytes };

        } catch (error) {
            logger.error('Error during file cleanup', { error: error.message });
            throw error;
        }
    }

    /**
     * Enforce export file size limit.
     * Deletes the file and revokes access if it exceeds maxExportSize.
     * @param {string} filepath - Absolute path to the export file
     * @param {string} filename - Basename used in fileAccessMap
     */
    async enforceExportSizeLimit(filepath, filename) {
        const stats = await fs.stat(filepath);
        if (stats.size > this.maxExportSize) {
            await fs.unlink(filepath);
            this.fileAccessMap.delete(filename);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
            const limitMB = (this.maxExportSize / (1024 * 1024)).toFixed(0);
            throw new Error(`Export file terlalu besar (${sizeMB}MB > ${limitMB}MB)`);
        }
    }

    /**
     * Close all connections
     */
    async close() {
        try {
            // Clear file cleanup scheduler
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
                this.cleanupInterval = null;
                logger.info('File cleanup scheduler stopped');
            }

            // Close queues gracefully (wait for active jobs)
            for (const queueName in this.queues) {
                try {
                    await this.queues[queueName].close();
                    logger.debug('Queue closed', { queueName });
                } catch (err) {
                    logger.warn('Error closing queue', { queueName, error: err.message });
                }
            }
            
            // Close Redis connection
            if (this.redis) {
                await this.redis.quit();
            }
            
            // Close database pool
            if (this.pool) {
                await this.pool.end();
            }

            // Clear file access map
            this.fileAccessMap.clear();
            
            logger.info('Queue system shut down gracefully');
            
        } catch (error) {
            logger.error('Error closing queue system', error);
        }
    }

    /**
     * Get download directory stats (file count, total size, oldest file age)
     * @returns {Promise<Object>} Directory statistics
     */
    async getDownloadDirStats() {
        try {
            const files = await fs.readdir(this.downloadDir);
            const xlsxFiles = files.filter(f => f.endsWith('.xlsx'));
            let totalSize = 0;
            let oldestAge = 0;
            const now = Date.now();

            for (const file of xlsxFiles) {
                try {
                    const stats = await fs.stat(path.join(this.downloadDir, file));
                    totalSize += stats.size;
                    const age = now - stats.mtimeMs;
                    if (age > oldestAge) oldestAge = age;
                } catch { /* skip inaccessible files */ }
            }

            return {
                fileCount: xlsxFiles.length,
                totalSizeMB: Number((totalSize / (1024 * 1024)).toFixed(2)),
                oldestFileHours: Number((oldestAge / (60 * 60 * 1000)).toFixed(2)),
                accessMapSize: this.fileAccessMap.size,
                retentionHours: this.fileAccessTtlMs / (60 * 60 * 1000),
                downloadDir: this.downloadDir
            };
        } catch (error) {
            logger.error('Failed to get download dir stats', { error: error.message });
            return { error: error.message };
        }
    }
}

// Export for use in other modules
export default DownloadQueue;

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const downloadQueue = new DownloadQueue();
    
    try {
        await downloadQueue.initialize();
        
        // Test adding a download job
        const jobResult = await downloadQueue.addExcelDownloadJob({
            type: 'student-attendance',
            userRole: 'admin',
            userId: 1,
            filters: {
                tanggal_mulai: '2025-01-01',
                tanggal_selesai: '2025-12-31'
            }
        });
        
        logger.debug('Test job added', jobResult);
        
        // Get queue statistics
        const stats = await downloadQueue.getQueueStatistics();
        logger.debug('Queue statistics', stats);
        
        // Wait a bit for processing
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Get job status
        const jobStatus = await downloadQueue.getJobStatus(jobResult.jobId);
        logger.debug('Job status', jobStatus);
        
        await downloadQueue.close();
        process.exit(0);
    } catch (error) {
        logger.error('Queue system test failed', error);
        process.exit(1);
    }
}
