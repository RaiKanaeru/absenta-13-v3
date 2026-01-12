    /**
 * BACKUP & ARCHIVE SYSTEM
 * Phase 2: Automated Backup, Excel Export, and Archive Management
 * Target: Handle 250K+ records, Semester backup, Archive management
 */

import dotenv from 'dotenv';
dotenv.config();

import mysql from 'mysql2/promise';
import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import cron from 'node-cron';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('Backup');

class BackupSystem {
    constructor() {
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

        this.pool = null;
        this.backupDir = process.env.BACKUP_DIR || './backups';
        this.archiveDir = process.env.ARCHIVE_DIR || './archives';
        this.reportsDir = process.env.REPORTS_DIR || './reports';
        
        // Backup configuration from environment
        this.backupConfig = {
            maxBackups: Number.parseInt(process.env.BACKUP_MAX_BACKUPS) || 10,
            maxArchiveAge: Number.parseInt(process.env.BACKUP_MAX_ARCHIVE_AGE) || 24,
            compressionEnabled: true,
            emailNotifications: false,
            autoBackupSchedule: process.env.BACKUP_SCHEDULE || '0 2 * * 0'
        };
    }

    /**
     * Format a value for SQL INSERT statement
     * @param {*} value - The value to format
     * @returns {string} SQL-safe formatted value
     */
    formatSqlValue(value) {
        if (value === null) return 'NULL';
        if (typeof value === 'string') return `'${value.replaceAll("'", "''")}'`;
        if (value instanceof Date) {
            if (Number.isNaN(value.getTime())) return 'NULL';
            return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
        }
        return value;
    }

    /**
     * Generate INSERT statements for a batch of data
     * @param {string} tableName - Table name
     * @param {Array} data - Array of row objects
     * @param {number} batchSize - Batch size for INSERT statements
     * @returns {string} SQL INSERT statements
     */
    generateInsertStatements(tableName, data, batchSize = 1000) {
        if (!data || data.length === 0) return '';
        
        const columns = Object.keys(data[0]);
        const columnList = columns.map(col => `\`${col}\``).join(', ');
        let sqlContent = `-- Data for table \`${tableName}\` (${data.length} records)\n`;
        
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            const values = batch.map(row => {
                const rowValues = columns.map(col => this.formatSqlValue(row[col]));
                return `(${rowValues.join(', ')})`;
            });
            
            sqlContent += `INSERT INTO \`${tableName}\` (${columnList}) VALUES\n`;
            sqlContent += values.join(',\n') + ';\n\n';
        }
        
        return sqlContent;
    }

    /**
     * Process a single table export - shared logic for backup functions
     * @param {string} tableName - Table name to export
     * @param {string} query - Query to execute (may include WHERE clause)
     * @param {Array} queryParams - Query parameters
     * @returns {string} SQL content for this table
     */
    async processTableExport(tableName, query, queryParams = []) {
        let sqlContent = '';
        
        try {
            // Get table structure
            const [structure] = await this.pool.execute(`SHOW CREATE TABLE \`${tableName}\``);
            if (!structure || !structure[0]) {
                logger.warn('Could not get structure for table', { tableName });
                return `-- Could not get structure for table \`${tableName}\`\n\n`;
            }
            
            sqlContent += `\n-- Table structure for table \`${tableName}\`\n`;
            sqlContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
            sqlContent += `${structure[0]['Create Table']};\n\n`;
            
            // Get table data
            let data = [];
            try {
                const result = await this.pool.execute(query, queryParams);
                data = result[0] || [];
            } catch (queryError) {
                logger.warn('Could not query data for table', { tableName, error: queryError.message });
                return sqlContent + `-- Could not export data for table \`${tableName}\`: ${queryError.message}\n\n`;
            }
            
            if (data && data.length > 0) {
                sqlContent += this.generateInsertStatements(tableName, data);
            } else {
                sqlContent += `-- No data in table \`${tableName}\`\n\n`;
            }
            
            return sqlContent;
        } catch (tableError) {
            logger.error('Error exporting table', { tableName, error: tableError.message });
            return `-- Error exporting table \`${tableName}\`: ${tableError.message}\n\n`;
        }
    }

    /**
     * Initialize backup system
     * @param {Object} externalPool - Optional external database pool (recommended to use global pool)
     */
    async initialize(externalPool = null) {
        logger.info('Initializing Backup & Archive System');
        
        try {
            // Use external pool if provided, otherwise create own pool
            if (externalPool) {
                this.pool = externalPool;
                logger.debug('Using external database pool');
            } else {
                // Create own connection pool (fallback)
                this.pool = mysql.createPool(this.dbConfig);
                logger.debug('Created own database pool');
            }
            
            // Verify pool is working with a simple test query
            try {
                await this.pool.execute('SELECT 1 as test');
                logger.info('Database pool connection verified');
            } catch (poolError) {
                logger.error('Database pool connection failed', { error: poolError.message });
                throw poolError;
            }
            
            // Create directories
            await this.createDirectories();
            
            // Setup automated backup schedule
            await this.setupAutomatedBackup();
            
            logger.info('Backup & Archive System initialized successfully');
            return true;
            
        } catch (error) {
            logger.error('Backup system initialization failed', error);
            throw error;
        }
    }

    /**
     * Create necessary directories
     */
    async createDirectories() {
        const directories = [this.backupDir, this.archiveDir, this.reportsDir];
        
        for (const dir of directories) {
            try {
                await fs.mkdir(dir, { recursive: true });
                logger.debug('Created directory', { dir });
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    throw error;
                }
            }
        }
    }

    /**
     * Setup automated backup schedule
     */
    async setupAutomatedBackup() {
        logger.info('Setting up automated backup schedule');
        
        // Weekly full backup
        cron.schedule(this.backupConfig.autoBackupSchedule, async () => {
            logger.info('Starting automated weekly backup');
            try {
                await this.createSemesterBackup();
                logger.info('Automated backup completed');
            } catch (error) {
                logger.error('Automated backup failed', error);
            }
        });
        
        // Daily archive cleanup (at 3 AM)
        cron.schedule('0 3 * * *', async () => {
            logger.info('Starting daily archive cleanup');
            try {
                await this.cleanupOldBackups();
                logger.info('Archive cleanup completed');
            } catch (error) {
                logger.error('Archive cleanup failed', error);
            }
        });
        
        logger.info('Automated backup schedule configured');
    }

    /**
     * Create date-based backup
     */
    async createDateBackup(startDate, endDate) {
        logger.info('Creating date-based backup', { startDate, endDate });
        
        const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
        const backupId = `date_backup_${timestamp}`;
        
        try {
            const backupPath = path.join(this.backupDir, `${backupId}`);
            await fs.mkdir(backupPath, { recursive: true });
            
            // 1. Database backup (SQL dump) - hanya data dalam range tanggal
            logger.debug('Creating date-filtered database backup');
            await this.createDateFilteredDatabaseBackup(backupPath, backupId, startDate, endDate);
            
            // 2. Excel export untuk data dalam range tanggal
            logger.debug('Creating date-filtered Excel export');
            await this.createDateFilteredExcelExport(backupPath, backupId, startDate, endDate);
            
            // 3. Create backup manifest
            logger.debug('Creating backup manifest');
            await this.createDateBackupManifest(backupPath, backupId, startDate, endDate);
            
            // 4. Compress backup if enabled
            if (this.backupConfig.compressionEnabled) {
                logger.debug('Compressing backup');
                await this.compressBackup(backupPath, backupId);
            }
            
            logger.info('Date-based backup created', { backupId });
            return {
                backupId,
                path: backupPath,
                startDate,
                endDate,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            logger.error('Date-based backup creation failed', error);
            throw error;
        }
    }

    /**
     * Create scheduled backup based on custom schedule
     */
    async createScheduledBackup(schedule) {
        logger.info('Creating scheduled backup', { name: schedule.name });
        
        try {
            // Create backup with schedule name as identifier
            const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
            const backupId = `scheduled_${schedule.name.replaceAll(/[^a-zA-Z0-9]/g, '_')}_${timestamp}`;
            
            // Create backup directory
            const backupDir = path.join(this.backupDir, backupId);
            await fs.mkdir(backupDir, { recursive: true });
            
            // Create full database backup
            const dbBackupPath = path.join(backupDir, 'database_backup.sql');
            await this.createDatabaseBackup(dbBackupPath);
            
            // Create Excel reports
            const excelPath = path.join(backupDir, 'backup_report.xlsx');
            await this.createExcelReport(excelPath);
            
            // Create backup info file
            const backupInfo = {
                id: backupId,
                type: 'scheduled',
                name: schedule.name,
                created: new Date().toISOString(),
                scheduleId: schedule.id,
                files: {
                    database: 'database_backup.sql',
                    excel: 'backup_report.xlsx'
                }
            };
            
            const infoPath = path.join(backupDir, 'backup_info.json');
            await fs.writeFile(infoPath, JSON.stringify(backupInfo, null, 2));
            
            logger.info('Scheduled backup created', { backupId });
            return backupInfo;
            
        } catch (error) {
            logger.error('Error creating scheduled backup', error);
            throw error;
        }
    }

    /**
     * Create comprehensive semester backup
     */
    async createSemesterBackup(semester = null, year = null) {
        logger.info('Creating semester backup');
        
        const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
        const backupId = `semester_backup_${timestamp}`;
        
        try {
            // Determine semester and year
            if (!semester || !year) {
                const now = new Date();
                year = year || now.getFullYear();
                semester = semester || (now.getMonth() < 6 ? 'Ganjil' : 'Genap');
            }
            
            const backupPath = path.join(this.backupDir, `${backupId}`);
            await fs.mkdir(backupPath, { recursive: true });
            
            // 1. Database backup (SQL dump)
            logger.debug('Creating database backup');
            await this.createDatabaseBackup(backupPath, backupId);
            
            // 2. Excel export for all data
            logger.debug('Creating Excel export');
            await this.createExcelExport(backupPath, backupId, semester, year);
            
            // 3. Archive old data
            logger.debug('Archiving old data');
            await this.archiveOldDataForBackup(backupPath, backupId);
            
            // 4. Create backup manifest
            logger.debug('Creating backup manifest');
            await this.createBackupManifest(backupPath, backupId, semester, year);
            
            // 5. Compress backup if enabled
            if (this.backupConfig.compressionEnabled) {
                logger.debug('Compressing backup');
                await this.compressBackup(backupPath, backupId);
            }
            
            logger.info('Semester backup created', { backupId });
            return {
                backupId,
                path: backupPath,
                semester,
                year,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            logger.error('Semester backup creation failed', error);
            throw error;
        }
    }

    /**
     * Create date-filtered database backup
     */
    async createDateFilteredDatabaseBackup(backupPath, backupId, startDate, endDate) {
        try {
            const sqlFile = path.join(backupPath, `${backupId}.sql`);
            let sqlContent = '';
            
            // Get all tables
            const [tables] = await this.pool.execute(`
                SELECT table_name as tableName
                FROM information_schema.tables 
                WHERE table_schema = '${this.dbConfig.database}'
            `);
            
            sqlContent += `-- ABSENTA Date-Based Database Backup\n`;
            sqlContent += `-- Generated: ${new Date().toISOString()}\n`;
            sqlContent += `-- Database: ${this.dbConfig.database}\n`;
            sqlContent += `-- Date Range: ${startDate} to ${endDate}\n\n`;
            
            // Export each table using helper
            for (const table of tables) {
                const tableName = table.tableName;
                if (!tableName) {
                    logger.warn('Skipping table with undefined name', { table });
                    continue;
                }
                
                logger.debug('Exporting table', { tableName });
                
                // Build query with date filtering for attendance tables
                let query = `SELECT * FROM \`${tableName}\``;
                let queryParams = [];
                
                if (tableName === 'absensi_siswa' || tableName === 'absensi_guru') {
                    query += ` WHERE tanggal BETWEEN ? AND ?`;
                    queryParams = [startDate, endDate];
                }
                
                sqlContent += await this.processTableExport(tableName, query, queryParams);
            }
            
            // Write SQL file
            await fs.writeFile(sqlFile, sqlContent, 'utf8');
            logger.info('Date-filtered database backup created', { sqlFile });
            
        } catch (error) {
            logger.error('Date-filtered database backup creation failed', error);
            throw error;
        }
    }

    /**
     * Create database backup using Node.js (alternative to mysqldump)
     */
    async createDatabaseBackup(backupPath, backupId) {
        try {
            // Handle both cases: with backupId and without
            let sqlFile;
            if (backupId) {
                sqlFile = path.join(backupPath, `${backupId}.sql`);
            } else {
                // If backupId is not provided, use the backupPath as the file path directly
                sqlFile = backupPath;
            }
            let sqlContent = '';
            
            // Get all tables
            const [tables] = await this.pool.execute(`
                SELECT table_name as tableName
                FROM information_schema.tables 
                WHERE table_schema = '${this.dbConfig.database}'
            `);
            
            sqlContent += `-- ABSENTA Database Backup\n`;
            sqlContent += `-- Generated: ${new Date().toISOString()}\n`;
            sqlContent += `-- Database: ${this.dbConfig.database}\n\n`;
            
            // Export each table using helper
            for (const table of tables) {
                const tableName = table.tableName;
                if (!tableName) {
                    logger.warn('Skipping table with undefined name', { table });
                    continue;
                }
                
                logger.debug('Exporting table', { tableName });
                const query = `SELECT * FROM \`${tableName}\``;
                sqlContent += await this.processTableExport(tableName, query);
            }
            
            // Write SQL file
            await fs.writeFile(sqlFile, sqlContent, 'utf8');
            logger.info('Database backup created', { sqlFile });
            
        } catch (error) {
            logger.error('Database backup creation failed', error);
            throw error;
        }
    }

    /**
     * Create date-filtered Excel export
     */
    async createDateFilteredExcelExport(backupPath, backupId, startDate, endDate) {
        const workbook = new ExcelJS.Workbook();
        
        // Set workbook properties
        workbook.creator = 'ABSENTA Date-Based Backup System';
        workbook.lastModifiedBy = 'ABSENTA Admin';
        workbook.created = new Date();
        workbook.modified = new Date();
        
        try {
            // 1. Student Attendance Sheet (date-filtered)
            logger.debug('Exporting date-filtered student attendance');
            await this.exportDateFilteredStudentAttendance(workbook, startDate, endDate);
            
            // 2. Teacher Attendance Sheet (date-filtered)
            logger.debug('Exporting date-filtered teacher attendance');
            await this.exportDateFilteredTeacherAttendance(workbook, startDate, endDate);
            
            // 3. Permission Requests Sheet (date-filtered)
            logger.debug('Exporting date-filtered permission requests');
            await this.exportDateFilteredPermissionRequests(workbook, startDate, endDate);
            
            // 4. Date Range Analytics Summary
            logger.debug('Creating date range analytics summary');
            await this.createDateRangeAnalyticsSummary(workbook, startDate, endDate);
            
            // 5. System Configuration Sheet
            logger.debug('Exporting system configuration');
            await this.exportSystemConfiguration(workbook);
            
            // Save Excel file
            const excelFile = path.join(backupPath, `${backupId}_export.xlsx`);
            await workbook.xlsx.writeFile(excelFile);
            
            logger.info('Date-filtered Excel export created', { excelFile });
            
        } catch (error) {
            logger.error('Date-filtered Excel export failed', error);
            throw error;
        }
    }

    /**
     * Create comprehensive Excel export
     */
    async createExcelExport(backupPath, backupId, semester, year) {
        const workbook = new ExcelJS.Workbook();
        
        // Set workbook properties
        workbook.creator = 'ABSENTA Backup System';
        workbook.lastModifiedBy = 'ABSENTA Admin';
        workbook.created = new Date();
        workbook.modified = new Date();
        
        try {
            // 1. Student Attendance Sheet
            logger.debug('Exporting student attendance');
            await this.exportStudentAttendance(workbook, semester, year);
            
            // 2. Teacher Attendance Sheet
            logger.debug('Exporting teacher attendance');
            await this.exportTeacherAttendance(workbook, semester, year);
            
            // 3. Permission Requests Sheet
            logger.debug('Exporting permission requests');
            await this.exportPermissionRequests(workbook, semester, year);
            
            // 4. Analytics Summary Sheet
            logger.debug('Creating analytics summary');
            await this.createAnalyticsSummary(workbook, semester, year);
            
            // 5. System Configuration Sheet
            logger.debug('Exporting system configuration');
            await this.exportSystemConfiguration(workbook);
            
            // Save Excel file
            const excelFile = path.join(backupPath, `${backupId}_export.xlsx`);
            await workbook.xlsx.writeFile(excelFile);
            
            logger.info('Excel export created', { excelFile });
            
        } catch (error) {
            logger.error('Excel export failed', error);
            throw error;
        }
    }

    /**
     * Create simple Excel report for scheduled backup
     */
    async createExcelReport(excelPath) {
        const workbook = new ExcelJS.Workbook();
        
        // Set workbook properties
        workbook.creator = 'ABSENTA Scheduled Backup System';
        workbook.lastModifiedBy = 'ABSENTA Admin';
        workbook.created = new Date();
        workbook.modified = new Date();
        
        try {
            // 1. Student Attendance Summary
            logger.debug('Creating student attendance summary');
            await this.createStudentAttendanceSummary(workbook);
            
            // 2. Teacher Attendance Summary
            logger.debug('Creating teacher attendance summary');
            await this.createTeacherAttendanceSummary(workbook);
            
            // 3. System Info Sheet
            logger.debug('Creating system info sheet');
            await this.createSystemInfoSheet(workbook);
            
            // Save workbook
            await workbook.xlsx.writeFile(excelPath);
            logger.info('Excel report created', { excelPath });
            
        } catch (error) {
            logger.error('Excel report creation failed', error);
            throw error;
        }
    }

    /**
     * Create student attendance summary for scheduled backup
     */
    async createStudentAttendanceSummary(workbook) {
        const worksheet = workbook.addWorksheet('Student Attendance Summary');
        
        // Add headers
        worksheet.addRow(['Date', 'Total Students', 'Present', 'Absent', 'Permission', 'Percentage Present']);
        
        try {
            // Get recent attendance data (last 30 days)
            const [attendanceData] = await this.pool.execute(`
                SELECT 
                    DATE(tanggal) as date,
                    COUNT(*) as total_students,
                    SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as present,
                    SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as absent,
                    SUM(CASE WHEN status IN ('Izin', 'Sakit', 'Dispen') THEN 1 ELSE 0 END) as permission
                FROM absensi_siswa 
                WHERE tanggal >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                GROUP BY DATE(tanggal)
                ORDER BY date DESC
            `);
            
            for (const row of attendanceData) {
                const percentage = row.total_students > 0 ? 
                    ((row.present / row.total_students) * 100).toFixed(2) : '0.00';
                
                worksheet.addRow([
                    row.date,
                    row.total_students,
                    row.present,
                    row.absent,
                    row.permission,
                    `${percentage}%`
                ]);
            }
            
            // Auto-fit columns
            worksheet.columns.forEach(column => {
                column.width = 15;
            });
            
        } catch (error) {
            logger.error('Error creating student attendance summary', error);
            worksheet.addRow(['Error', 'Failed to load data', '', '', '', '']);
        }
    }

    /**
     * Create teacher attendance summary for scheduled backup
     */
    async createTeacherAttendanceSummary(workbook) {
        const worksheet = workbook.addWorksheet('Teacher Attendance Summary');
        
        // Add headers
        worksheet.addRow(['Date', 'Total Teachers', 'Present', 'Absent', 'Permission', 'Percentage Present']);
        
        try {
            // Get recent teacher attendance data (last 30 days)
            const [attendanceData] = await this.pool.execute(`
                SELECT 
                    DATE(tanggal) as date,
                    COUNT(*) as total_teachers,
                    SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as present,
                    SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as absent,
                    SUM(CASE WHEN status IN ('Izin', 'Sakit', 'Dispen') THEN 1 ELSE 0 END) as permission
                FROM absensi_guru 
                WHERE tanggal >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                GROUP BY DATE(tanggal)
                ORDER BY date DESC
            `);
            
            for (const row of attendanceData) {
                const percentage = row.total_teachers > 0 ? 
                    ((row.present / row.total_teachers) * 100).toFixed(2) : '0.00';
                
                worksheet.addRow([
                    row.date,
                    row.total_teachers,
                    row.present,
                    row.absent,
                    row.permission,
                    `${percentage}%`
                ]);
            }
            
            // Auto-fit columns
            worksheet.columns.forEach(column => {
                column.width = 15;
            });
            
        } catch (error) {
            logger.error('Error creating teacher attendance summary', error);
            worksheet.addRow(['Error', 'Failed to load data', '', '', '', '']);
        }
    }

    /**
     * Create system info sheet for scheduled backup
     */
    async createSystemInfoSheet(workbook) {
        const worksheet = workbook.addWorksheet('System Information');
        
        try {
            // Get system statistics
            const [studentCount] = await this.pool.execute('SELECT COUNT(*) as count FROM siswa');
            const [teacherCount] = await this.pool.execute('SELECT COUNT(*) as count FROM guru');
            const [classCount] = await this.pool.execute('SELECT COUNT(*) as count FROM kelas');
            
            worksheet.addRow(['System Information', '']);
            worksheet.addRow(['Backup Created', new Date().toISOString()]);
            worksheet.addRow(['Total Students', studentCount[0].count]);
            worksheet.addRow(['Total Teachers', teacherCount[0].count]);
            worksheet.addRow(['Total Classes', classCount[0].count]);
            worksheet.addRow(['Database', this.dbConfig.database]);
            worksheet.addRow(['Backup Type', 'Scheduled Backup']);
            
            // Auto-fit columns
            worksheet.columns.forEach(column => {
                column.width = 20;
            });
            
        } catch (error) {
            logger.error('Error creating system info sheet', error);
            worksheet.addRow(['Error', 'Failed to load system information']);
        }
    }

    /**
     * Export student attendance data
     */
    async exportStudentAttendance(workbook, semester, year) {
        const worksheet = workbook.addWorksheet('Student Attendance');
        
        // Get date range for semester
        const dateRange = this.getSemesterDateRange(semester, year);
        
        const query = `
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
            ORDER BY a.tanggal DESC, s.nama ASC
        `;
        
        // Use query() instead of execute() to avoid prepared statement issues
        const [rows] = await this.pool.query(query, [dateRange.start, dateRange.end]);
        
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
        
        // Add data (with null safety)
        const safeRows = rows || [];
        safeRows.forEach(row => {
            worksheet.addRow(row);
        });
        
        // Style headers
        this.styleWorksheet(worksheet, 'Student Attendance Data');
        
        logger.debug('Exported student attendance records', { count: safeRows.length });
    }

    /**
     * Export teacher attendance data
     */
    async exportTeacherAttendance(workbook, semester, year) {
        const worksheet = workbook.addWorksheet('Teacher Attendance');
        
        const dateRange = this.getSemesterDateRange(semester, year);
        
        const query = `
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
            ORDER BY a.tanggal DESC, a.jam_ke ASC
        `;
        
        // Use query() instead of execute() to avoid prepared statement issues
        const [rows] = await this.pool.query(query, [dateRange.start, dateRange.end]);
        
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
        
        // Add data (with null safety)
        const safeRows = rows || [];
        safeRows.forEach(row => {
            worksheet.addRow(row);
        });
        
        // Style headers
        this.styleWorksheet(worksheet, 'Teacher Attendance Data');
        
        logger.debug('Exported teacher attendance records', { count: safeRows.length });
    }

    /**
     * Export permission requests
     */
    async exportPermissionRequests(workbook, semester, year) {
        const worksheet = workbook.addWorksheet('Permission Requests');
        
        const dateRange = this.getSemesterDateRange(semester, year);
        
        const query = `
            SELECT 
                p.tanggal_pengajuan,
                s.nis,
                s.nama as nama_siswa,
                k.nama_kelas,
                p.tanggal_absen,
                p.status_asli,
                p.status_diajukan,
                p.alasan_banding as alasan,
                p.status_banding as status,
                p.catatan_guru as keterangan_guru,
                p.tanggal_keputusan as tanggal_respon,
                g.nama as nama_guru_approve
            FROM pengajuan_banding_absen p
            JOIN siswa s ON p.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN guru g ON p.diproses_oleh = g.id_guru
            WHERE p.tanggal_pengajuan BETWEEN ? AND ?
            ORDER BY p.tanggal_pengajuan DESC
        `;
        
        // Use query() instead of execute() to avoid prepared statement issues
        const [rows] = await this.pool.query(query, [dateRange.start, dateRange.end]);
        
        // Add headers
        worksheet.columns = [
            { header: 'Tanggal Pengajuan', key: 'tanggal_pengajuan', width: 15 },
            { header: 'NIS', key: 'nis', width: 15 },
            { header: 'Nama Siswa', key: 'nama_siswa', width: 25 },
            { header: 'Kelas', key: 'nama_kelas', width: 15 },
            { header: 'Tanggal Absen', key: 'tanggal_absen', width: 15 },
            { header: 'Status Asli', key: 'status_asli', width: 12 },
            { header: 'Status Diajukan', key: 'status_diajukan', width: 12 },
            { header: 'Alasan', key: 'alasan', width: 30 },
            { header: 'Status Banding', key: 'status', width: 12 },
            { header: 'Catatan Guru', key: 'keterangan_guru', width: 30 },
            { header: 'Tanggal Keputusan', key: 'tanggal_respon', width: 15 },
            { header: 'Diproses Oleh', key: 'nama_guru_approve', width: 20 }
        ];
        
        // Add data (with null safety)
        const safeRows = rows || [];
        safeRows.forEach(row => {
            worksheet.addRow(row);
        });
        
        // Style headers
        this.styleWorksheet(worksheet, 'Permission Requests Data');
        
        logger.debug('Exported permission request records', { count: safeRows.length });
    }

    /**
     * Export date-filtered student attendance data
     */
    async exportDateFilteredStudentAttendance(workbook, startDate, endDate) {
        const worksheet = workbook.addWorksheet('Student Attendance (Date Range)');
        
        const query = `
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
            ORDER BY a.tanggal DESC, s.nama ASC
        `;
        
        // Use query() instead of execute() to avoid prepared statement issues
        const [rows] = await this.pool.query(query, [startDate, endDate]);
        
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
        
        // Add data (with null safety)
        const safeRows = rows || [];
        safeRows.forEach(row => {
            worksheet.addRow(row);
        });
        
        // Style headers
        this.styleWorksheet(worksheet, `Student Attendance Data (${startDate} to ${endDate})`);
        
        logger.debug('Exported date-filtered student attendance records', { count: safeRows.length });
    }

    /**
     * Export date-filtered teacher attendance data
     */
    async exportDateFilteredTeacherAttendance(workbook, startDate, endDate) {
        const worksheet = workbook.addWorksheet('Teacher Attendance (Date Range)');
        
        const query = `
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
            ORDER BY a.tanggal DESC, a.jam_ke ASC
        `;
        
        // Use query() instead of execute() to avoid prepared statement issues
        const [rows] = await this.pool.query(query, [startDate, endDate]);
        
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
        
        // Add data (with null safety)
        const safeRows = rows || [];
        safeRows.forEach(row => {
            worksheet.addRow(row);
        });
        
        // Style headers
        this.styleWorksheet(worksheet, `Teacher Attendance Data (${startDate} to ${endDate})`);
        
        logger.debug('Exported date-filtered teacher attendance records', { count: safeRows.length });
    }

    /**
     * Export date-filtered permission requests
     */
    async exportDateFilteredPermissionRequests(workbook, startDate, endDate) {
        const worksheet = workbook.addWorksheet('Permission Requests (Date Range)');
        
        const query = `
            SELECT 
                p.tanggal_pengajuan,
                s.nis,
                s.nama as nama_siswa,
                k.nama_kelas,
                p.tanggal_absen,
                p.status_asli,
                p.status_diajukan,
                p.alasan_banding as alasan,
                p.status_banding as status,
                p.catatan_guru as keterangan_guru,
                p.tanggal_keputusan as tanggal_respon,
                g.nama as nama_guru_approve
            FROM pengajuan_banding_absen p
            JOIN siswa s ON p.siswa_id = s.id_siswa
            JOIN kelas k ON s.kelas_id = k.id_kelas
            LEFT JOIN guru g ON p.diproses_oleh = g.id_guru
            WHERE p.tanggal_pengajuan BETWEEN ? AND ?
            ORDER BY p.tanggal_pengajuan DESC
        `;
        
        // Use query() instead of execute() to avoid prepared statement issues
        const [rows] = await this.pool.query(query, [startDate, endDate]);
        
        // Add headers
        worksheet.columns = [
            { header: 'Tanggal Pengajuan', key: 'tanggal_pengajuan', width: 15 },
            { header: 'NIS', key: 'nis', width: 15 },
            { header: 'Nama Siswa', key: 'nama_siswa', width: 25 },
            { header: 'Kelas', key: 'nama_kelas', width: 15 },
            { header: 'Tanggal Absen', key: 'tanggal_absen', width: 15 },
            { header: 'Status Asli', key: 'status_asli', width: 12 },
            { header: 'Status Diajukan', key: 'status_diajukan', width: 12 },
            { header: 'Alasan', key: 'alasan', width: 30 },
            { header: 'Status Banding', key: 'status', width: 12 },
            { header: 'Catatan Guru', key: 'keterangan_guru', width: 30 },
            { header: 'Tanggal Keputusan', key: 'tanggal_respon', width: 15 },
            { header: 'Diproses Oleh', key: 'nama_guru_approve', width: 20 }
        ];
        
        // Add data (with null safety)
        const safeRows = rows || [];
        safeRows.forEach(row => {
            worksheet.addRow(row);
        });
        
        // Style headers
        this.styleWorksheet(worksheet, `Permission Requests Data (${startDate} to ${endDate})`);
        
        logger.debug('Exported date-filtered permission request records', { count: safeRows.length });
    }

    /**
     * Create date range analytics summary
     */
    async createDateRangeAnalyticsSummary(workbook, startDate, endDate) {
        const worksheet = workbook.addWorksheet('Date Range Analytics');
        
        // Get various analytics for the date range
        const [totalStudents] = await this.pool.execute('SELECT COUNT(*) as count FROM siswa WHERE status = "aktif"');
        const [totalTeachers] = await this.pool.execute('SELECT COUNT(*) as count FROM guru WHERE status = "aktif"');
        const [totalClasses] = await this.pool.execute('SELECT COUNT(*) as count FROM kelas WHERE status = "aktif"');
        
        const [attendanceStats] = await this.pool.execute(`
            SELECT 
                status,
                COUNT(*) as count
            FROM absensi_siswa 
            WHERE tanggal BETWEEN ? AND ?
            GROUP BY status
        `, [startDate, endDate]);
        
        const [teacherAttendanceStats] = await this.pool.execute(`
            SELECT 
                status,
                COUNT(*) as count
            FROM absensi_guru 
            WHERE tanggal BETWEEN ? AND ?
            GROUP BY status
        `, [startDate, endDate]);
        
        // Calculate date range info
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        const daysDiff = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;
        
        // Add summary data
        worksheet.addRow(['DATE RANGE BACKUP SUMMARY', '']);
        worksheet.addRow(['Start Date', startDate]);
        worksheet.addRow(['End Date', endDate]);
        worksheet.addRow(['Total Days', daysDiff]);
        worksheet.addRow(['Backup Date', new Date().toISOString()]);
        worksheet.addRow(['', '']);
        
        worksheet.addRow(['SYSTEM STATISTICS', '']);
        worksheet.addRow(['Total Active Students', totalStudents[0].count]);
        worksheet.addRow(['Total Active Teachers', totalTeachers[0].count]);
        worksheet.addRow(['Total Active Classes', totalClasses[0].count]);
        worksheet.addRow(['', '']);
        
        worksheet.addRow(['STUDENT ATTENDANCE STATISTICS (Date Range)', '']);
        attendanceStats.forEach(stat => {
            worksheet.addRow([stat.status, stat.count]);
        });
        worksheet.addRow(['', '']);
        
        worksheet.addRow(['TEACHER ATTENDANCE STATISTICS (Date Range)', '']);
        teacherAttendanceStats.forEach(stat => {
            worksheet.addRow([stat.status, stat.count]);
        });
        
        // Style the summary
        this.styleWorksheet(worksheet, `Date Range Analytics (${startDate} to ${endDate})`);
        
        logger.info('Date range analytics summary created');
    }

    /**
     * Create analytics summary
     */
    async createAnalyticsSummary(workbook, semester, year) {
        const worksheet = workbook.addWorksheet('Analytics Summary');
        
        const dateRange = this.getSemesterDateRange(semester, year);
        
        // Get various analytics
        const [totalStudents] = await this.pool.execute('SELECT COUNT(*) as count FROM siswa WHERE status = "aktif"');
        const [totalTeachers] = await this.pool.execute('SELECT COUNT(*) as count FROM guru WHERE status = "aktif"');
        const [totalClasses] = await this.pool.execute('SELECT COUNT(*) as count FROM kelas WHERE status = "aktif"');
        
        const [attendanceStats] = await this.pool.execute(`
            SELECT 
                status,
                COUNT(*) as count
            FROM absensi_siswa 
            WHERE tanggal BETWEEN ? AND ?
            GROUP BY status
        `, [dateRange.start, dateRange.end]);
        
        const [teacherAttendanceStats] = await this.pool.execute(`
            SELECT 
                status,
                COUNT(*) as count
            FROM absensi_guru 
            WHERE tanggal BETWEEN ? AND ?
            GROUP BY status
        `, [dateRange.start, dateRange.end]);
        
        // Add summary data
        worksheet.addRow(['SEMESTER BACKUP SUMMARY', '']);
        worksheet.addRow(['Semester', semester]);
        worksheet.addRow(['Year', year]);
        worksheet.addRow(['Date Range', `${dateRange.start} to ${dateRange.end}`]);
        worksheet.addRow(['Backup Date', new Date().toISOString()]);
        worksheet.addRow(['', '']);
        
        worksheet.addRow(['SYSTEM STATISTICS', '']);
        worksheet.addRow(['Total Active Students', totalStudents[0].count]);
        worksheet.addRow(['Total Active Teachers', totalTeachers[0].count]);
        worksheet.addRow(['Total Active Classes', totalClasses[0].count]);
        worksheet.addRow(['', '']);
        
        worksheet.addRow(['STUDENT ATTENDANCE STATISTICS', '']);
        attendanceStats.forEach(stat => {
            worksheet.addRow([stat.status, stat.count]);
        });
        worksheet.addRow(['', '']);
        
        worksheet.addRow(['TEACHER ATTENDANCE STATISTICS', '']);
        teacherAttendanceStats.forEach(stat => {
            worksheet.addRow([stat.status, stat.count]);
        });
        
        // Style the summary
        this.styleWorksheet(worksheet, 'Analytics Summary');
        
        logger.info('Analytics summary created');
    }

    /**
     * Export system configuration
     */
    async exportSystemConfiguration(workbook) {
        const worksheet = workbook.addWorksheet('System Configuration');
        
        // Get system tables (with null safety)
        const [users] = await this.pool.execute('SELECT username, role, status, created_at FROM users');
        const [classes] = await this.pool.execute('SELECT nama_kelas, status FROM kelas');
        const [subjects] = await this.pool.execute('SELECT nama_mapel, kode_mapel FROM mata_pelajaran');
        
        const safeUsers = users || [];
        const safeClasses = classes || [];
        const safeSubjects = subjects || [];
        
        // Add users
        worksheet.addRow(['SYSTEM USERS', '']);
        worksheet.addRow(['Username', 'Role', 'Status', 'Created At']);
        safeUsers.forEach(user => {
            worksheet.addRow([user.username, user.role, user.status, user.created_at]);
        });
        
        worksheet.addRow(['', '']);
        worksheet.addRow(['CLASSES', '']);
        worksheet.addRow(['Class Name', 'Status']);
        safeClasses.forEach(cls => {
            worksheet.addRow([cls.nama_kelas, cls.status]);
        });
        
        worksheet.addRow(['', '']);
        worksheet.addRow(['SUBJECTS', '']);
        worksheet.addRow(['Subject Name', 'Code']);
        safeSubjects.forEach(subject => {
            worksheet.addRow([subject.nama_mapel, subject.kode_mapel]);
        });
        
        // Style the configuration
        this.styleWorksheet(worksheet, 'System Configuration');
        
        logger.info('System configuration exported');
    }

    /**
     * Archive old data (for backup process)
     */
    async archiveOldDataForBackup(backupPath, backupId) {
        const archiveDate = new Date();
        archiveDate.setMonth(archiveDate.getMonth() - this.backupConfig.maxArchiveAge);
        const archiveDateStr = archiveDate.toISOString().split('T')[0];
        
        try {
            // Ensure archive tables exist before archiving
            logger.debug('Ensuring archive tables exist');
            await this.createArchiveTables();
            
            // Archive old student attendance
            const [studentArchiveResult] = await this.pool.execute(`
                INSERT IGNORE INTO absensi_siswa_archive 
                SELECT *, NOW() as archived_at 
                FROM absensi_siswa 
                WHERE tanggal < ?
            `, [archiveDateStr]);
            
            // Archive old teacher attendance
            const [teacherArchiveResult] = await this.pool.execute(`
                INSERT IGNORE INTO absensi_guru_archive 
                SELECT *, NOW() as archived_at 
                FROM absensi_guru 
                WHERE tanggal < ?
            `, [archiveDateStr]);
            
            // Create archive report
            const archiveReport = {
                backupId,
                archiveDate: archiveDateStr,
                studentRecordsArchived: studentArchiveResult?.affectedRows || 0,
                teacherRecordsArchived: teacherArchiveResult?.affectedRows || 0,
                timestamp: new Date().toISOString()
            };
            
            const reportFile = path.join(backupPath, `${backupId}_archive_report.json`);
            await fs.writeFile(reportFile, JSON.stringify(archiveReport, null, 2));
            
            logger.info('Archived student records', { count: archiveReport.studentRecordsArchived });
            logger.info('Archived teacher records', { count: archiveReport.teacherRecordsArchived });
            
        } catch (error) {
            logger.warn('Data archiving failed (non-critical, continuing backup)', { error: error.message });
            // Create empty archive report instead of crashing
            const archiveReport = {
                backupId,
                archiveDate: archiveDateStr,
                studentRecordsArchived: 0,
                teacherRecordsArchived: 0,
                error: error.message,
                timestamp: new Date().toISOString()
            };
            const reportFile = path.join(backupPath, `${backupId}_archive_report.json`);
            await fs.writeFile(reportFile, JSON.stringify(archiveReport, null, 2));
            // Don't throw - archiving failure should not block backup
        }
    }

    /**
     * Create archive tables if they don't exist
     */
    async createArchiveTables() {
        try {
            // Create student archive table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS absensi_siswa_archive (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    siswa_id INT,
                    jadwal_id INT,
                    tanggal DATE,
                    status ENUM('Hadir', 'Izin', 'Sakit', 'Alpa', 'Dispen') DEFAULT 'Alpa',
                    keterangan TEXT,
                    waktu_absen DATETIME,
                    guru_id INT,
                    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_siswa_id (siswa_id),
                    INDEX idx_jadwal_id (jadwal_id),
                    INDEX idx_tanggal (tanggal),
                    INDEX idx_archived_at (archived_at)
                )
            `);
            
            // Create teacher archive table
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS absensi_guru_archive (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    guru_id INT,
                    jadwal_id INT,
                    tanggal DATE,
                    status ENUM('Hadir', 'Izin', 'Sakit', 'Alpa', 'Dispen') DEFAULT 'Alpa',
                    keterangan TEXT,
                    waktu_absen DATETIME,
                    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_guru_id (guru_id),
                    INDEX idx_jadwal_id (jadwal_id),
                    INDEX idx_tanggal (tanggal),
                    INDEX idx_archived_at (archived_at)
                )
            `);
            
            logger.info('Archive tables created/verified');
        } catch (error) {
            logger.error('Error creating archive tables', error);
            throw error;
        }
    }

    /**
     * Archive old data (standalone method for API)
     */
    async archiveOldData(monthsOld = null) {
        const archiveAge = monthsOld || this.backupConfig.maxArchiveAge;
        const archiveDate = new Date();
        archiveDate.setMonth(archiveDate.getMonth() - archiveAge);
        const archiveDateStr = archiveDate.toISOString().split('T')[0];
        
        logger.info('Archiving old data', { archiveAge, archiveDateStr });
        
        try {
            // Create archive tables if they don't exist
            await this.createArchiveTables();
            
                // First, archive old records (ignore duplicates)
                const [studentArchiveResult] = await this.pool.execute(`
                    INSERT IGNORE INTO absensi_siswa_archive 
                    SELECT *, NOW() as archived_at 
                    FROM absensi_siswa 
                    WHERE tanggal < ?
                `, [archiveDateStr]);
            
            const [teacherArchiveResult] = await this.pool.execute(`
                INSERT IGNORE INTO absensi_guru_archive 
                SELECT *, NOW() as archived_at 
                FROM absensi_guru 
                WHERE tanggal < ?
            `, [archiveDateStr]);
            
            // Delete archived records from main tables
            const [studentDeleteResult] = await this.pool.execute(`
                DELETE FROM absensi_siswa 
                WHERE tanggal < ?
            `, [archiveDateStr]);
            
            const [teacherDeleteResult] = await this.pool.execute(`
                DELETE FROM absensi_guru 
                WHERE tanggal < ?
            `, [archiveDateStr]);
            
            const result = {
                archiveDate: archiveDateStr,
                monthsOld: archiveAge,
                studentRecordsArchived: studentArchiveResult.affectedRows,
                teacherRecordsArchived: teacherArchiveResult.affectedRows,
                studentRecordsDeleted: studentDeleteResult.affectedRows,
                teacherRecordsDeleted: teacherDeleteResult.affectedRows,
                timestamp: new Date().toISOString()
            };
            
            logger.info('Archived student records', { count: studentArchiveResult.affectedRows });
            logger.info('Archived teacher records', { count: teacherArchiveResult.affectedRows });
            logger.info('Deleted old student records', { count: studentDeleteResult.affectedRows });
            logger.info('Deleted old teacher records', { count: teacherDeleteResult.affectedRows });
            
            return result;
            
        } catch (error) {
            logger.error('Data archiving failed', error);
            throw error;
        }
    }

    /**
     * Create date-based backup manifest
     */
    async createDateBackupManifest(backupPath, backupId, startDate, endDate) {
        const manifest = {
            backupId,
            type: 'date-based',
            startDate,
            endDate,
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            system: 'ABSENTA',
            files: [
                `${backupId}.sql`,
                `${backupId}_export.xlsx`,
                `${backupId}_manifest.json`
            ],
            statistics: await this.getDateBackupStatistics(startDate, endDate),
            checksums: await this.calculateChecksums(backupPath, backupId)
        };
        
        const manifestFile = path.join(backupPath, `${backupId}_manifest.json`);
        await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2));
        
        logger.info('Date-based backup manifest created', { manifestFile });
    }

    /**
     * Get date-based backup statistics
     */
    async getDateBackupStatistics(startDate, endDate) {
        const [studentCount] = await this.pool.execute(`
            SELECT COUNT(*) as count FROM absensi_siswa 
            WHERE tanggal BETWEEN ? AND ?
        `, [startDate, endDate]);
        
        const [teacherCount] = await this.pool.execute(`
            SELECT COUNT(*) as count FROM absensi_guru 
            WHERE tanggal BETWEEN ? AND ?
        `, [startDate, endDate]);
        
        const [permissionCount] = await this.pool.execute(`
            SELECT COUNT(*) as count FROM pengajuan_banding_absen 
            WHERE tanggal_pengajuan BETWEEN ? AND ?
        `, [startDate, endDate]);
        
        const [userCount] = await this.pool.execute('SELECT COUNT(*) as count FROM users');
        const [classCount] = await this.pool.execute('SELECT COUNT(*) as count FROM kelas');
        
        return {
            dateRange: {
                startDate,
                endDate,
                days: Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1
            },
            studentAttendanceRecords: studentCount[0].count,
            teacherAttendanceRecords: teacherCount[0].count,
            permissionRequests: permissionCount[0].count,
            totalUsers: userCount[0].count,
            totalClasses: classCount[0].count,
            databaseSize: await this.getDatabaseSize()
        };
    }

    /**
     * Create backup manifest
     */
    async createBackupManifest(backupPath, backupId, semester, year) {
        const manifest = {
            backupId,
            semester,
            year,
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            system: 'ABSENTA',
            files: [
                `${backupId}.sql`,
                `${backupId}_export.xlsx`,
                `${backupId}_archive_report.json`,
                `${backupId}_manifest.json`
            ],
            statistics: await this.getBackupStatistics(),
            checksums: await this.calculateChecksums(backupPath, backupId)
        };
        
        const manifestFile = path.join(backupPath, `${backupId}_manifest.json`);
        await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2));
        
        logger.info('Backup manifest created', { manifestFile });
    }

    /**
     * Get backup statistics
     */
    async getBackupStatistics() {
        const [studentCount] = await this.pool.execute('SELECT COUNT(*) as count FROM absensi_siswa');
        const [teacherCount] = await this.pool.execute('SELECT COUNT(*) as count FROM absensi_guru');
        const [userCount] = await this.pool.execute('SELECT COUNT(*) as count FROM users');
        const [classCount] = await this.pool.execute('SELECT COUNT(*) as count FROM kelas');
        
        return {
            studentAttendanceRecords: studentCount[0].count,
            teacherAttendanceRecords: teacherCount[0].count,
            totalUsers: userCount[0].count,
            totalClasses: classCount[0].count,
            databaseSize: await this.getDatabaseSize()
        };
    }

    /**
     * Get database size
     */
    async getDatabaseSize() {
        const [result] = await this.pool.execute(`
            SELECT 
                ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
            FROM information_schema.tables 
            WHERE table_schema = 'absenta13'
        `);
        
        return result[0]['Size (MB)'] || 0;
    }

    /**
     * Calculate file checksums
     */
    async calculateChecksums(backupPath, backupId) {
        const crypto = await import('crypto');
        const checksums = {};
        
        const files = [
            `${backupId}.sql`,
            `${backupId}_export.xlsx`,
            `${backupId}_archive_report.json`
        ];
        
        for (const file of files) {
            try {
                const filePath = path.join(backupPath, file);
                const data = await fs.readFile(filePath);
                const hash = crypto.createHash('sha256').update(data).digest('hex');
                checksums[file] = hash;
            } catch (error) {
                logger.warn('Could not calculate checksum for file', { file, error: error.message });
            }
        }
        
        return checksums;
    }

    /**
     * Compress backup directory
     */
    async compressBackup(backupPath, backupId) {
        try {
            const { default: archiver } = await import('archiver');
            const output = createWriteStream(path.join(this.backupDir, `${backupId}.zip`));
            const archive = archiver('zip', { zlib: { level: 9 } });
            
            return new Promise((resolve, reject) => {
                output.on('close', () => {
                    logger.info('Backup compressed', { bytes: archive.pointer() });
                    resolve();
                });
                
                archive.on('error', (err) => {
                    reject(err);
                });
                
                archive.pipe(output);
                archive.directory(backupPath, false);
                archive.finalize();
            });
        } catch (error) {
            logger.warn('Compression failed, backup will remain uncompressed', { error: error.message });
            // Don't throw error, just continue without compression
        }
    }

    /**
     * Cleanup old backups
     */
    async cleanupOldBackups() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backupFiles = files.filter(file => file.startsWith('semester_backup_'));
            
            if (backupFiles.length > this.backupConfig.maxBackups) {
                // Sort by creation time and remove oldest
                const sortedFiles = await Promise.all(
                    backupFiles.map(async (file) => {
                        const filePath = path.join(this.backupDir, file);
                        const stats = await fs.stat(filePath);
                        return { file, mtime: stats.mtime };
                    })
                );
                
                sortedFiles.sort((a, b) => a.mtime - b.mtime);
                
                const filesToDelete = sortedFiles.slice(0, sortedFiles.length - this.backupConfig.maxBackups);
                
                for (const fileInfo of filesToDelete) {
                    const filePath = path.join(this.backupDir, fileInfo.file);
                    await fs.unlink(filePath);
                    logger.debug('Deleted old backup', { file: fileInfo.file });
                }
            }
            
        } catch (error) {
            logger.error('Backup cleanup failed', error);
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
     * Style worksheet
     */
    styleWorksheet(worksheet, title) {
        // Style headers
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        
        // Add title
        worksheet.insertRow(1, [title]);
        const titleRow = worksheet.getRow(1);
        titleRow.font = { bold: true, size: 14 };
        titleRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };
        
        // Auto-fit columns
        worksheet.columns.forEach(column => {
            if (column.width < 15) column.width = 15;
        });
    }

    /**
     * Calculate total size of files in a directory
     * @private
     */
    async calculateDirectorySize(dirPath) {
        try {
            const files = await fs.readdir(dirPath);
            let totalSize = 0;
            for (const file of files) {
                const fileStat = await fs.stat(path.join(dirPath, file));
                if (fileStat.isFile()) totalSize += fileStat.size;
            }
            return totalSize;
        } catch (e) {
            return 0; // Size calculation non-critical
        }
    }

    /**
     * Process a scheduled backup entry
     * @private
     */
    async processScheduledBackup(filePath, fileName, stats) {
        const infoPath = path.join(filePath, 'backup_info.json');
        let backupData;
        
        try {
            const infoData = await fs.readFile(infoPath, 'utf8');
            const backupInfo = JSON.parse(infoData);
            backupData = {
                id: backupInfo.id,
                filename: `${backupInfo.name} (${backupInfo.type})`,
                created: new Date(backupInfo.created),
                type: backupInfo.type,
                semester: backupInfo.semester,
                year: backupInfo.year
            };
        } catch (infoError) {
            backupData = {
                id: fileName,
                filename: fileName,
                created: stats.birthtime,
                type: 'scheduled'
            };
        }
        
        const size = await this.calculateDirectorySize(filePath);
        return {
            ...backupData,
            size,
            modified: stats.mtime,
            backupType: backupData.type
        };
    }

    /**
     * Process a semester or date backup entry
     * @private
     */
    async processSemesterOrDateBackup(filePath, fileName, stats) {
        const isZip = fileName.endsWith('.zip');
        const backupId = fileName.replace(/\.zip$/, '');
        const backupType = fileName.startsWith('semester_backup_') ? 'semester' : 'date';
        
        let size = stats.size;
        if (stats.isDirectory()) {
            size = await this.calculateDirectorySize(filePath);
        }
        
        return {
            id: backupId,
            filename: fileName,
            size,
            created: stats.birthtime,
            modified: stats.mtime,
            type: backupType,
            backupType
        };
    }

    /**
     * List available backups
     */
    async listBackups() {
        try {
            // Check if backup directory exists
            try {
                await fs.access(this.backupDir);
            } catch (error) {
                // Directory doesn't exist, create it
                await fs.mkdir(this.backupDir, { recursive: true });
                return []; // Return empty array if no backups exist yet
            }
            
            const files = await fs.readdir(this.backupDir);
            const backups = [];
            const seenIds = new Set();
            
            // Sort files to prefer .zip over directories if naming is same
            // actually, we just process and dedupe
            
            for (const file of files) {
                try {
                    const filePath = path.join(this.backupDir, file);
                    const stats = await fs.stat(filePath);
                    
                    let backupEntry = null;
                    let backupId = null;
                    
                    // Handle Scheduled Backups (Directories)
                    if (file.startsWith('scheduled_') && stats.isDirectory()) {
                        backupEntry = await this.processScheduledBackup(filePath, file, stats);
                        backupId = backupEntry.id;
                    }
                    // Handle Semester & Date Backups (Zip or Folder)
                    else if (file.startsWith('semester_backup_') || file.startsWith('date_backup_')) {
                        backupEntry = await this.processSemesterOrDateBackup(filePath, file, stats);
                        backupId = backupEntry.id;
                    }
                    
                    // Add to results if not duplicate
                    if (backupEntry && backupId && !seenIds.has(backupId)) {
                        backups.push(backupEntry);
                        seenIds.add(backupId);
                    }
                } catch (e) {
                    logger.warn('Error processing backup file', { file, error: e.message });
                }
            }
            
            return backups.sort((a, b) => b.created - a.created);
            
        } catch (error) {
            logger.error('Failed to list backups', error);
            return [];
        }
    }

    /**
     * Restore from backup
     */
    async restoreFromBackup(backupId) {
        logger.info('Restoring from backup', { backupId });
        
        try {
            // First try to find SQL file in uncompressed folder
            const folderPath = path.join(this.backupDir, backupId);
            const sqlFile = path.join(folderPath, `${backupId}.sql`);
            
            let sqlFilePath = null;
            
            // Check if uncompressed folder exists
            try {
                await fs.access(sqlFile);
                sqlFilePath = sqlFile;
                logger.debug('Found SQL file in uncompressed folder');
            } catch (error) {
                logger.debug('SQL file not found in uncompressed folder, trying zip file');
                
                // Try zip file
                const zipFile = path.join(this.backupDir, `${backupId}.zip`);
                try {
                    await fs.access(zipFile);
                    logger.debug('Found zip file, extracting');
                    
                    const extractPath = path.join(this.backupDir, `${backupId}_temp`);
                    const { default: extract } = await import('extract-zip');
                    await extract(zipFile, { dir: extractPath });
                    
                    const extractedSqlFile = path.join(extractPath, `${backupId}.sql`);
                    await fs.access(extractedSqlFile);
                    sqlFilePath = extractedSqlFile;
                    logger.debug('Successfully extracted SQL file from zip');
                    
                } catch (zipError) {
                    throw new Error(`Backup file not found: ${backupId}. Neither folder nor zip file exists.`);
                }
            }
            
            if (!sqlFilePath) {
                throw new Error('SQL file not found in backup');
            }
            
            // Restore database
            await this.restoreDatabase(sqlFilePath);
            
            // Clean up temp directory if it was created
            if (sqlFilePath.includes('_temp')) {
                const extractPath = path.dirname(sqlFilePath);
                await fs.rm(extractPath, { recursive: true, force: true });
                    logger.debug('Cleaned up temporary extraction directory');
            }
            
            logger.info('Successfully restored from backup', { backupId });
            return { success: true, message: 'Backup restored successfully' };
            
        } catch (error) {
            logger.error('Backup restoration failed', error);
            throw error;
        }
    }

    /**
     * Restore database from SQL file
     */
    async restoreDatabase(sqlFile) {
        try {
            logger.info('Restoring database from file', { sqlFile });
            
            // Read SQL file content
            const sqlContent = await fs.readFile(sqlFile, 'utf8');
            
            // Split SQL content into individual statements
            const statements = sqlContent
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
            
            logger.debug('Found SQL statements to execute', { count: statements.length });
            
            // Execute each statement
            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                if (statement.trim()) {
                    try {
                        await this.pool.execute(statement);
                        logger.debug('Executed statement', { index: i + 1, total: statements.length });
                    } catch (error) {
                        logger.warn('Failed to execute statement', { index: i + 1, error: error.message });
                        // Continue with other statements
                    }
                }
            }
            
            logger.info('Database restoration completed successfully');
            
        } catch (error) {
            logger.error('Database restoration failed', error);
            throw error;
        }
    }

    /**
     * Delete backup
     */
    async deleteBackup(backupId) {
        logger.info('Deleting backup', { backupId });
        
        try {
            // First, check if it's a folder-based backup
            const folderPath = path.join(this.backupDir, backupId);
            const folderStats = await fs.stat(folderPath).catch(() => null);
            
            if (folderStats && folderStats.isDirectory()) {
                logger.debug('Found backup folder', { backupId });
                
                // Delete the entire folder and its contents
                await fs.rm(folderPath, { recursive: true, force: true });
                logger.info('Successfully deleted backup folder', { backupId });
                
                return { 
                    success: true, 
                    message: 'Backup folder deleted successfully',
                    deletedFiles: [backupId],
                    method: 'folder'
                };
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
                const filePath = path.join(this.backupDir, filename);
                try {
                    await fs.access(filePath);
                    await fs.unlink(filePath);
                    deleted = true;
                    deletedFiles.push(filename);
                    logger.debug('Deleted backup file', { filename });
                } catch (fileError) {
                    // File doesn't exist, continue to next format
                    logger.warn('File not found', { filename });
                }
            }
            
            if (deleted) {
                logger.info('Successfully deleted backup', { backupId });
                return { 
                    success: true, 
                    message: 'Backup deleted successfully',
                    deletedFiles: deletedFiles,
                    method: 'file'
                };
            } else {
                throw new Error(`No backup files found for ID: ${backupId}`);
            }
            
        } catch (error) {
            logger.error('Backup deletion failed', error);
            throw error;
        }
    }

    /**
     * Close connection pool
     */
    async close() {
        if (this.pool) {
            await this.pool.end();
            logger.info('Backup system connection pool closed');
        }
    }
}

// Export for use in other modules
export default BackupSystem;

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const backupSystem = new BackupSystem();
    
    try {
        await backupSystem.initialize();
        
        // Create a test backup
        const result = await backupSystem.createSemesterBackup('Ganjil', 2025);
        logger.debug('Backup created successfully', result);
        
        // List backups
        const backups = await backupSystem.listBackups();
        logger.debug('Available backups', backups);
        
        await backupSystem.close();
        process.exit(0);
    } catch (error) {
        logger.error('Backup system failed', error);
        process.exit(1);
    }
}
