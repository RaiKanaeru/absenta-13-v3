/**
 * Backup Controller
 * Menangani operasi backup, restore, dan arsip
 * Dimigrasi dari server_modern.js - Batch 15
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import AdmZip from 'adm-zip';
import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';
import { randomBytes } from 'node:crypto';

const logger = createLogger('Backup');

// Constants to avoid duplicate literals
const ERROR_INTERNAL = 'Internal server error';

// ================================================
// HELPER FUNCTIONS
// ================================================

/**
 * Calculate next backup date based on schedule
 */
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

/**
 * Helper function to process SQL backup
 */
async function restoreDatabaseFromSqlFile(filePath) {
    try {
        const sqlContent = await fs.readFile(filePath, 'utf8');

        // Validate SQL content
        if (!sqlContent.includes('CREATE TABLE') && !sqlContent.includes('INSERT INTO')) {
            throw new Error('File SQL tidak valid');
        }

        // Execute SQL commands in transaction for better performance
        const commands = sqlContent.split(';').filter(cmd => cmd.trim());
        const connection = await globalThis.dbPool.pool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            for (const command of commands) {
                if (command.trim()) {
                    await connection.execute(command);
                }
            }
            
            await connection.commit();
        } catch (txError) {
            await connection.rollback();
            throw txError;
        } finally {
            connection.release();
        }

        return {
            type: 'sql',
            message: 'Database berhasil dipulihkan dari file SQL',
            tablesRestored: sqlContent.match(/CREATE TABLE/g)?.length || 0,
            commandsExecuted: commands.length
        };
    } catch (error) {
        throw new Error(`Gagal memproses file SQL: ${error.message}`);
    }
}

/**
 * Helper function to process ZIP backup
 */
async function restoreDatabaseFromZipArchive(filePath) {
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

        // Execute SQL commands in transaction for better performance
        const commands = sqlContent.split(';').filter(cmd => cmd.trim());
        const connection = await globalThis.dbPool.pool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            for (const command of commands) {
                if (command.trim()) {
                    await connection.execute(command);
                }
            }
            
            await connection.commit();
        } catch (txError) {
            await connection.rollback();
            throw txError;
        } finally {
            connection.release();
        }

        return {
            type: 'zip',
            message: 'Database berhasil dipulihkan dari file ZIP',
            filesExtracted: zipEntries.length,
            commandsExecuted: commands.length
        };
    } catch (error) {
        throw new Error(`Gagal memproses file ZIP: ${error.message}`);
    }
}

/**
 * Helper function to get folder size
 */
async function calculateDirectorySizeBytes(folderPath) {
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

// ================================================
// BACKUP CRUD ENDPOINTS
// ================================================

/**
 * Create semester backup
 * POST /api/admin/create-semester-backup
 */
const createSemesterBackup = async (req, res) => {
    try {
        logger.info('Creating semester backup');

        if (!globalThis.backupSystem) {
            logger.error('Backup system not initialized');
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

        if (!year || Number.isNaN(Number(year)) || year < 2020 || year > 2030) {
            return res.status(400).json({
                error: 'Invalid input',
                message: 'Tahun harus antara 2020-2030'
            });
        }

        const backupResult = await globalThis.backupSystem.createSemesterBackup(semester, year);

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

            // Update dates
            currentSettings.lastBackupDate = new Date().toISOString();
            currentSettings.nextBackupDate = calculateNextBackupDate(currentSettings.autoBackupSchedule);

            // Save settings
            await fs.writeFile(settingsPath, JSON.stringify(currentSettings, null, 2));
            logger.info('Backup settings updated successfully');

        } catch (settingsError) {
            logger.warn('Failed to update backup settings', { error: settingsError.message });
        }

        res.json({
            success: true,
            message: `Semester backup created successfully for ${semester} ${year}`,
            data: backupResult,
            backupSystemStatus: globalThis.backupSystem ? 'initialized' : 'not initialized'
        });
    } catch (error) {
        logger.error('Error creating semester backup', error);
        return sendDatabaseError(res, error, error.message || 'Gagal backup');
    }
};

/**
 * Create date-based backup
 * POST /api/admin/create-date-backup
 */
const createDateBackup = async (req, res) => {
    try {
        logger.info('Creating date-based backup');

        if (!globalThis.backupSystem) {
            logger.error('Backup system not initialized');
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

        if (Number.isNaN(startDateObj.getTime()) || Number.isNaN(endDateObj.getTime())) {
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
        today.setHours(23, 59, 59, 999);
        if (startDateObj > today) {
            return res.status(400).json({
                error: 'Invalid date',
                message: 'Cannot backup future dates'
            });
        }

        logger.info('Creating date backup', { startDate, endDate: actualEndDate });

        const backupResult = await globalThis.backupSystem.createDateBackup(startDate, actualEndDate);

        // Update backup settings
        try {
            const settingsPath = path.join(process.cwd(), 'backup-settings.json');
            let settings = {};

            try {
                const settingsData = await fs.readFile(settingsPath, 'utf8');
                settings = JSON.parse(settingsData);
            } catch (fileError) {
                settings = {
                    autoBackupSchedule: 'weekly',
                    maxBackups: 10,
                    archiveAge: 24,
                    compression: true,
                    emailNotifications: false
                };
            }

            settings.lastBackupDate = new Date().toISOString();
            settings.nextBackupDate = calculateNextBackupDate(settings.autoBackupSchedule);

            await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
            logger.info('Backup settings updated successfully');

        } catch (settingsError) {
            logger.warn('Failed to update backup settings', { error: settingsError.message });
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
        logger.error('Error creating date-based backup', error);
        res.status(500).json({
            error: ERROR_INTERNAL,
            message: error.message || 'Failed to create date-based backup'
        });
    }
};

/**
 * Get backup list (via BackupSystem)
 * GET /api/admin/backup-list
 */
const getBackupList = async (req, res) => {
    try {
        const backupList = await globalThis.backupSystem.listBackups();

        res.json({
            success: true,
            backups: backupList,
            message: 'Backup list retrieved successfully'
        });

    } catch (error) {
        logger.error('Error getting backup list', error);
        res.status(500).json({
            error: ERROR_INTERNAL,
            message: 'Gagal memuat daftar backup'
        });
    }
};

/**
 * Get backups (directory-based listing)
 * GET /api/admin/backups
 */
const getBackups = async (req, res) => {
    try {
        logger.info('Fetching backups via BackupSystem');

        if (globalThis.backupSystem) {
            const backups = await globalThis.backupSystem.listBackups();
            logger.debug('BackupSystem returned backups', { count: backups.length });
            
            return res.status(200).json({
                ok: true,
                backups: backups || []
            });
        }

        // Fallback or Error if system not initialized
        logger.warn('BackupSystem not initialized, trying fallback listing');
        const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
        
        try {
            await fs.access(backupDir);
            const files = await fs.readdir(backupDir);
            // Basic fallback list
            const backups = files.map(f => ({
                id: f,
                filename: f,
                created: new Date(), // Approximate
                type: 'unknown',
                size: 0
            }));
            
            res.status(200).json({
                ok: true,
                backups
            });
        } catch (e) {
            res.status(200).json({ ok: true, backups: [] });
        }

    } catch (error) {
        logger.error('Error getting backups', error);
        res.status(500).json({
            ok: false,
            message: 'Gagal mendapatkan daftar backup',
            error: error.message
        });
    }
};

/**
 * Delete backup
 * DELETE /api/admin/delete-backup/:backupId
 */
const deleteBackup = async (req, res) => {
    try {
        const { backupId } = req.params;

        if (!backupId) {
            return res.status(400).json({
                error: 'Invalid input',
                message: 'Backup ID is required'
            });
        }

        logger.info('Attempting to delete backup', { backupId });

        if (!globalThis.backupSystem) {
            logger.error('Backup system not initialized');
            return res.status(503).json({
                error: 'Backup system not ready',
                message: 'Backup system is not initialized yet. Please try again in a few seconds.'
            });
        }

        // Try to delete using backup system first
        try {
            const result = await globalThis.backupSystem.deleteBackup(backupId);
            logger.info('Backup deleted via backup system', { backupId });

            res.json({
                success: true,
                message: 'Backup berhasil dihapus',
                data: result
            });
        } catch (backupSystemError) {
            logger.warn('Backup system delete failed, trying manual deletion', { error: backupSystemError.message });

            // Fallback: Manual deletion
            const backupDir = path.join(process.cwd(), 'backups');

            // First, check if it's a folder-based backup
            const folderPath = path.join(backupDir, backupId);
            const folderStats = await fs.stat(folderPath).catch(() => null);

            if (folderStats && folderStats.isDirectory()) {
                logger.debug('Found backup folder for manual deletion', { backupId });

                // Delete the entire folder and its contents
                await fs.rm(folderPath, { recursive: true, force: true });
                logger.info('Manually deleted backup folder', { backupId });

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
                    logger.debug('Manually deleted file', { filename });
                } catch (fileError) {
                    logger.warn('Could not delete file', { filename, error: fileError.message });
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
        logger.error('Error deleting backup', error);
        res.status(500).json({
            error: ERROR_INTERNAL,
            message: error.message || 'Gagal menghapus backup'
        });
    }
};

/**
 * Helper to resolve backup file path from ID
 * @param {string} backupDir
 * @param {string} backupId
 * @returns {Promise<{filePath: string|null, filename: string|null}>}
 */
const resolveBackupFilePath = async (backupDir, backupId) => {
    // 1. Check directory
    const backupSubDir = path.join(backupDir, backupId);
    try {
        const stats = await fs.stat(backupSubDir);
        if (stats.isDirectory()) {
            const files = await fs.readdir(backupSubDir);
            
            // Priority: compressed > sql > other
            const compressed = files.find(f => /\.(zip|tar\.gz|gz)$/i.test(f));
            if (compressed) return { filePath: path.join(backupSubDir, compressed), filename: compressed };
            
            const sql = files.find(f => /\.sql$/i.test(f));
            if (sql) return { filePath: path.join(backupSubDir, sql), filename: sql };
            
            const other = files.find(f => !/\.(json|txt|log)$/i.test(f));
            if (other) return { filePath: path.join(backupSubDir, other), filename: other };
        }
    } catch (e) {
        // Directory not found or inaccessible, continue to file check
    }

    // 2. Check direct files
    const candidates = [`${backupId}.zip`, backupId, `${backupId}.sql`, `${backupId}.tar.gz`];
    for (const c of candidates) {
        const p = path.join(backupDir, c);
        try {
            if ((await fs.stat(p)).isFile()) return { filePath: p, filename: c };
        } catch (e) { /* ignore */ }
    }
    
    return { filePath: null, filename: null };
};

/**
 * Download backup
 * GET /api/admin/download-backup/:backupId
 */
const downloadBackup = async (req, res) => {
    try {
        const { backupId } = req.params;
        const backupDir = path.join(process.cwd(), 'backups');

        // Sanitize backupId to prevent path traversal attacks
        const sanitizedBackupId = path.basename(backupId);
        if (sanitizedBackupId !== backupId || !backupId || backupId.includes('..')) {
            logger.warn('Invalid backup ID detected', { backupId });
            return res.status(400).json({
                error: 'Invalid backup ID',
                message: 'Backup ID contains invalid characters'
            });
        }

        logger.info('Downloading backup', { backupId: sanitizedBackupId });

        const { filePath, filename } = await resolveBackupFilePath(backupDir, sanitizedBackupId);

        if (!filePath) {
            logger.error('No backup file found', { backupId: sanitizedBackupId });
            return res.status(404).json({
                error: 'Backup file not found',
                message: `No backup file found for ID: ${sanitizedBackupId}`
            });
        }

        // Set proper headers for file download
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        logger.debug('Sending file', { filePath });
        res.download(filePath, filename, (err) => {
            if (err) {
                logger.error('Error during file download', err);
                if (!res.headersSent) {
                    res.status(500).json({
                        error: 'Download failed',
                        message: err.message || 'Failed to download file'
                    });
                }
            } else {
                logger.info('File download completed', { filename });
            }
        });

    } catch (error) {
        logger.error('Error downloading backup', error);
        res.status(500).json({
            error: ERROR_INTERNAL,
            message: error.message || 'Failed to download backup'
        });
    }
};

// ================================================
// RESTORE ENDPOINTS
// ================================================

/**
 * Restore backup by ID
 * POST /api/admin/restore-backup/:backupId
 */
const restoreBackupById = async (req, res) => {
    try {
        const { backupId } = req.params;

        if (!backupId) {
            return res.status(400).json({
                error: 'Invalid input',
                message: 'Backup ID is required'
            });
        }

        const result = await globalThis.backupSystem.restoreFromBackup(backupId);

        res.json({
            success: true,
            message: 'Backup berhasil dipulihkan',
            data: result
        });

    } catch (error) {
        logger.error('Error restoring backup', error);
        res.status(500).json({
            error: ERROR_INTERNAL,
            message: 'Gagal memulihkan backup'
        });
    }
};

/**
 * Restore backup from uploaded file
 * POST /api/admin/restore-backup (with file upload)
 */
const restoreBackupFromFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'File tidak ditemukan',
                message: 'File backup harus diupload'
            });
        }

        logger.info('Processing backup file upload', {
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
            result = await restoreDatabaseFromSqlFile(tempFilePath);
        } else if (fileExtension === '.zip') {
            result = await restoreDatabaseFromZipArchive(tempFilePath);
        }

        // Clean up temporary file
        await fs.unlink(tempFilePath);

        res.json({
            success: true,
            message: 'Backup berhasil dipulihkan',
            data: result
        });

    } catch (error) {
        logger.error('Error restoring backup', error);
        res.status(500).json({
            error: ERROR_INTERNAL,
            message: 'Gagal memulihkan backup'
        });
    }
};

// ================================================
// ARCHIVE ENDPOINTS
// ================================================

/**
 * Create test archive data
 * POST /api/admin/create-test-archive-data
 */
const createTestArchiveData = async (req, res) => {
    try {
        logger.info('Creating test archive data');

        if (!globalThis.dbPool || !globalThis.dbPool.pool) {
            logger.error('Database pool not initialized');
            return res.status(503).json({
                error: 'Database not ready',
                message: 'Database connection pool is not initialized yet. Please try again in a few seconds.'
            });
        }

        // Create test data that is 25 months old
        const oldDate = new Date();
        oldDate.setMonth(oldDate.getMonth() - 25);
        // Format date manually to avoid timezone issues
        const oldDateStr = `${oldDate.getFullYear()}-${String(oldDate.getMonth() + 1).padStart(2, '0')}-${String(oldDate.getDate()).padStart(2, '0')}`;


        logger.debug('Creating test data with date', { oldDateStr, monthsOld: 25 });

        // Clean up existing test data
        await globalThis.dbPool.pool.execute(`DELETE FROM absensi_siswa WHERE keterangan = 'Test data for archive'`);
        await globalThis.dbPool.pool.execute(`DELETE FROM absensi_guru WHERE keterangan = 'Test data for archive'`);
        await globalThis.dbPool.pool.execute(`DELETE FROM absensi_siswa_archive WHERE keterangan = 'Test data for archive'`);
        await globalThis.dbPool.pool.execute(`DELETE FROM absensi_guru_archive WHERE keterangan = 'Test data for archive'`);

        // Get valid jadwal_id and guru_id
        const [jadwalRows] = await globalThis.dbPool.pool.execute(`SELECT id_jadwal FROM jadwal LIMIT 1`);
        const [guruRows] = await globalThis.dbPool.pool.execute(`SELECT id_guru FROM guru WHERE status = 'aktif' LIMIT 1`);

        const validJadwalId = jadwalRows.length > 0 ? jadwalRows[0].id_jadwal : null;
        const validGuruId = guruRows.length > 0 ? guruRows[0].id_guru : null;

        // Insert test student attendance records
        const [studentResult] = await globalThis.dbPool.pool.execute(`
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

        const result = {
            message: 'Test archive data created successfully',
            studentRecordsCreated: studentResult.affectedRows,
            teacherRecordsCreated: 0,
            testDate: oldDateStr,
            monthsOld: 25
        };

        logger.info('Created test student records', { count: studentResult.affectedRows });

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        logger.error('Error creating test archive data', error);
        res.status(500).json({
            error: ERROR_INTERNAL,
            message: error.message || 'Failed to create test archive data'
        });
    }
};

/**
 * Archive old data
 * POST /api/admin/archive-old-data
 */
const archiveOldData = async (req, res) => {
    try {
        const { monthsOld = 12 } = req.body;

        logger.info('Archiving data older than months', { monthsOld });

        if (!globalThis.backupSystem) {
            logger.error('Backup system not initialized');
            return res.status(503).json({
                error: 'Backup system not ready',
                message: 'Backup system is not initialized yet. Please try again in a few seconds.'
            });
        }

        if (!globalThis.dbPool || !globalThis.dbPool.pool) {
            logger.error('Database pool not initialized');
            return res.status(503).json({
                error: 'Database not ready',
                message: 'Database connection pool is not initialized yet. Please try again in a few seconds.'
            });
        }

        const archiveResult = await globalThis.backupSystem.archiveOldData(monthsOld);

        res.json({
            success: true,
            message: `Data older than ${monthsOld} months archived successfully`,
            data: archiveResult
        });

    } catch (error) {
        logger.error('Error archiving old data', error);
        res.status(500).json({
            error: ERROR_INTERNAL,
            message: error.message || 'Failed to archive old data'
        });
    }
};

/**
 * Get archive statistics
 * GET /api/admin/archive-stats
 */
const getArchiveStats = async (req, res) => {
    try {
        logger.info('Getting archive statistics');

        if (!globalThis.dbPool || !globalThis.dbPool.pool) {
            logger.error('Database pool not initialized');
            return res.status(503).json({
                error: 'Database not ready',
                message: 'Database connection pool is not initialized yet. Please try again in a few seconds.'
            });
        }

        // Get student archive count
        let studentArchiveCount = 0;
        try {
            const [studentArchive] = await globalThis.dbPool.pool.execute(`SELECT COUNT(*) as count FROM absensi_siswa_archive`);
            studentArchiveCount = studentArchive[0]?.count || 0;
        } catch (error) {
            logger.warn('Student archive table not found, using 0');
        }

        // Get teacher archive count
        let teacherArchiveCount = 0;
        try {
            const [teacherArchive] = await globalThis.dbPool.pool.execute(`SELECT COUNT(*) as count FROM absensi_guru_archive`);
            teacherArchiveCount = teacherArchive[0]?.count || 0;
        } catch (error) {
            logger.warn('Teacher archive table not found, using 0');
        }

        // Get total archive size (approximate)
        let totalSizeMB = (studentArchiveCount * 0.5) + (teacherArchiveCount * 0.3);

        // Get last archive date
        let lastArchive = null;
        try {
            const [lastArchiveResult] = await globalThis.dbPool.pool.execute(`SELECT MAX(archived_at) as last_archive FROM absensi_siswa_archive`);
            lastArchive = lastArchiveResult[0]?.last_archive || null;
        } catch (error) {
            try {
                const [lastArchiveResult] = await globalThis.dbPool.pool.execute(`SELECT MAX(waktu_absen) as last_archive FROM absensi_siswa_archive`);
                lastArchive = lastArchiveResult[0]?.last_archive || null;
            } catch (err) {
                // Table doesn't exist
            }
        }

        const stats = {
            studentRecords: studentArchiveCount,
            teacherRecords: teacherArchiveCount,
            totalSize: Math.round(totalSizeMB),
            lastArchive: lastArchive
        };

        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
        logger.error('Error getting archive stats', error);
        res.status(500).json({
            error: ERROR_INTERNAL,
            message: 'Gagal memuat statistik arsip'
        });
    }
};

// ================================================
// STATUS & SETTINGS ENDPOINTS
// ================================================

/**
 * Get database status
 * GET /api/admin/database-status
 */
const getDatabaseStatus = async (req, res) => {
    try {
        const status = {
            dbPool: !!globalThis.dbPool,
            dbPoolType: typeof globalThis.dbPool,
            dbPoolPool: !!globalThis.dbPool?.pool,
            dbPoolPoolType: typeof globalThis.dbPool?.pool,
            queryOptimizer: !!globalThis.queryOptimizer,
            backupSystem: !!globalThis.backupSystem,
            backupSystemType: typeof globalThis.backupSystem,
            backupSystemConfig: globalThis.backupSystem ? {
                backupDir: globalThis.backupSystem.backupDir,
                archiveDir: globalThis.backupSystem.archiveDir,
                pool: !!globalThis.backupSystem.pool
            } : null,
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            status: status
        });

    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Get backup directory status
 * GET /api/admin/backup-directory-status
 */
const getBackupDirectoryStatus = async (req, res) => {
    try {
        const backupDir = path.join(process.cwd(), 'backups');

        let dirExists = false;
        let files = [];

        try {
            await fs.access(backupDir);
            dirExists = true;

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
            logger.debug('Backup directory does not exist or is not accessible');
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
        logger.error('Error checking backup directory', { error: error.message });
        res.status(500).json({
            error: ERROR_INTERNAL,
            message: 'Gagal memeriksa direktori backup'
        });
    }
};

/**
 * Get backup settings
 * GET /api/admin/backup-settings
 */
const getBackupSettings = async (req, res) => {
    try {
        logger.debug('Getting backup settings');

        const defaultSettings = {
            autoBackupSchedule: 'weekly',
            maxBackups: 10,
            archiveAge: 24,
            compression: true,
            emailNotifications: false
        };

        try {
            const settingsPath = path.join(process.cwd(), 'backup-settings.json');
            const settingsData = await fs.readFile(settingsPath, 'utf8');
            const savedSettings = JSON.parse(settingsData);

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
        return sendDatabaseError(res, error);
    }
};

/**
 * Save backup settings
 * POST /api/admin/backup-settings
 */
const saveBackupSettings = async (req, res) => {
    try {
        const settings = req.body;
        logger.info('Saving backup settings', { schedule: settings.autoBackupSchedule });

        const validSettings = {
            autoBackupSchedule: settings.autoBackupSchedule || 'weekly',
            maxBackups: Math.max(1, Math.min(50, settings.maxBackups || 10)),
            archiveAge: Math.max(6, Math.min(60, settings.archiveAge || 24)),
            compression: Boolean(settings.compression),
            emailNotifications: Boolean(settings.emailNotifications),
            lastBackupDate: settings.lastBackupDate || null,
            nextBackupDate: settings.nextBackupDate || null
        };

        const settingsPath = path.join(process.cwd(), 'backup-settings.json');
        await fs.writeFile(settingsPath, JSON.stringify(validSettings, null, 2));

        // Update backup system configuration
        if (globalThis.backupSystem) {
            globalThis.backupSystem.backupConfig = {
                ...globalThis.backupSystem.backupConfig,
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
        logger.error('Error saving backup settings', { error: error.message });
        res.status(500).json({
            error: ERROR_INTERNAL,
            message: error.message || 'Failed to save backup settings'
        });
    }
};

// ================================================
// CUSTOM SCHEDULE ENDPOINTS
// ================================================

/**
 * Get custom schedules
 * GET /api/admin/custom-schedules
 */
const getCustomSchedules = async (req, res) => {
    try {
        logger.debug('Getting custom schedules');

        const schedulesPath = path.join(process.cwd(), 'custom-schedules.json');
        let schedules = [];

        try {
            const schedulesData = await fs.readFile(schedulesPath, 'utf8');
            schedules = JSON.parse(schedulesData);
        } catch (fileError) {
            schedules = [];
        }

        res.json({
            success: true,
            schedules: schedules
        });

    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Create custom schedule
 * POST /api/admin/custom-schedules
 */
const createCustomSchedule = async (req, res) => {
    try {
        const { name, date, time, enabled } = req.body;
        logger.info('Creating custom schedule', { name, date, time });

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
            schedules = [];
        }

        const newSchedule = {
            id: `schedule_${Date.now()}_${randomBytes(6).toString('hex')}`,
            name,
            date,
            time,
            enabled: enabled !== false,
            created: new Date().toISOString()
        };

        schedules.push(newSchedule);

        await fs.writeFile(schedulesPath, JSON.stringify(schedules, null, 2));

        res.json({
            success: true,
            message: 'Custom schedule created successfully',
            schedule: newSchedule
        });

    } catch (error) {
        logger.error('Error creating custom schedule', { error: error.message });
        res.status(500).json({
            error: ERROR_INTERNAL,
            message: error.message || 'Failed to create custom schedule'
        });
    }
};

/**
 * Update custom schedule
 * PUT /api/admin/custom-schedules/:id
 */
const updateCustomSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, date, time, enabled } = req.body;
        logger.info('Updating custom schedule', { id, name });

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
        schedules[scheduleIndex] = {
            ...schedules[scheduleIndex],
            name: name || schedules[scheduleIndex].name,
            date: date || schedules[scheduleIndex].date,
            time: time || schedules[scheduleIndex].time,
            enabled: enabled !== undefined ? enabled : schedules[scheduleIndex].enabled,
            updated: new Date().toISOString()
        };

        await fs.writeFile(schedulesPath, JSON.stringify(schedules, null, 2));

        res.json({
            success: true,
            message: 'Custom schedule updated successfully',
            schedule: schedules[scheduleIndex]
        });

    } catch (error) {
        logger.error('Error updating custom schedule', { error: error.message });
        res.status(500).json({
            error: ERROR_INTERNAL,
            message: error.message || 'Failed to update custom schedule'
        });
    }
};

/**
 * Delete custom schedule
 * DELETE /api/admin/custom-schedules/:id
 */
const deleteCustomSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        logger.info('Deleting custom schedule', { id });

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
        schedules.splice(scheduleIndex, 1);

        await fs.writeFile(schedulesPath, JSON.stringify(schedules, null, 2));

        res.json({
            success: true,
            message: 'Custom schedule deleted successfully'
        });

    } catch (error) {
        logger.error('Error deleting custom schedule', { error: error.message });
        res.status(500).json({
            error: ERROR_INTERNAL,
            message: error.message || 'Failed to delete custom schedule'
        });
    }
};

/**
 * Run custom schedule manually
 * POST /api/admin/run-custom-schedule/:id
 */
const runCustomSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        logger.info('Running custom schedule manually', { id });

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
        if (globalThis.backupSystem) {
            const backupResult = await globalThis.backupSystem.createScheduledBackup(schedule);

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
        logger.error('Error running custom schedule', { error: error.message });
        res.status(500).json({
            error: ERROR_INTERNAL,
            message: error.message || 'Failed to run custom schedule'
        });
    }
};

/**
 * Manual database backup
 * GET /api/admin/backup
 */
const createManualBackup = async (req, res) => {
    try {
        logger.info('Creating database backup');

        const backupDir = path.join(process.cwd(), 'backups');
        try {
            await fs.access(backupDir);
        } catch (error) {
            await fs.mkdir(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
        const filename = `backup_absenta_${timestamp}.sql`;
        const filepath = path.join(backupDir, filename);

        // Function untuk backup manual
        async function createManualBackupFile() {
            try {
                let backupContent = `-- Backup Database Absenta\n`;
                backupContent += `-- Created: ${new Date().toISOString()}\n`;
                backupContent += `-- Database: absenta13\n\n`;

                const tables = [
                    'users', 'guru', 'siswa', 'kelas', 'mapel',
                    'jadwal', 'absensi_siswa', 'absensi_guru'
                ];

                for (const table of tables) {
                    try {
                        // Get table structure
                        const [createResult] = await globalThis.dbPool.pool.execute(`SHOW CREATE TABLE ${table}`);
                        if (createResult.length > 0) {
                            backupContent += `\n-- Table: ${table}\n`;
                            backupContent += `DROP TABLE IF EXISTS \`${table}\`;\n`;
                            backupContent += createResult[0]['Create Table'] + ';\n\n';
                        }

                        // Get table data
                        const [rows] = await globalThis.dbPool.pool.execute(`SELECT * FROM ${table}`);
                        if (rows.length > 0) {
                            for (const row of rows) {
                                const columns = Object.keys(row).map(col => `\`${col}\``).join(', ');
                                const values = Object.values(row).map(val => {
                                    if (val === null) return 'NULL';
                                    if (typeof val === 'number') return val;
                                    return `'${String(val).replaceAll("'", "''")}'`;
                                }).join(', ');
                                backupContent += `INSERT INTO \`${table}\` (${columns}) VALUES (${values});\n`;
                            }
                            backupContent += '\n';
                        }
                    } catch (tableError) {
                        logger.warn('Could not backup table', { table, error: tableError.message });
                    }
                }

                await fs.writeFile(filepath, backupContent);
                logger.info('Manual backup created', { filename });

                return { filename, filepath, size: backupContent.length };
            } catch (manualError) {
                logger.error('Manual backup failed', { error: manualError.message });
                throw new Error('Gagal membuat backup database');
            }
        }

        // Try mysqldump first, fallback to manual
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            await execAsync('mysqldump --version');

            const mysqldumpCmd = `mysqldump -h localhost -u root absenta13 > "${filepath}"`;
            await execAsync(mysqldumpCmd);

            logger.info('mysqldump backup created successfully');

            res.setHeader('Content-Type', 'application/sql');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            const fileContent = await fs.readFile(filepath, 'utf8');
            res.send(fileContent);

        } catch (mysqldumpError) {
            logger.debug('mysqldump not available, using manual backup');
            const result = await createManualBackupFile();

            res.setHeader('Content-Type', 'application/sql');
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);

            const fileContent = await fs.readFile(result.filepath, 'utf8');
            res.send(fileContent);
        }

    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// ================================================
// DISASTER RECOVERY ENDPOINTS - Migrated from server_modern.js Batch 17D
// ================================================

/**
 * Get disaster recovery status
 * GET /api/admin/disaster-recovery-status
 */
const getDisasterRecoveryStatus = async (req, res) => {
    try {
        const status = globalThis.disasterRecoverySystem.getSystemHealth();
        res.json({ success: true, data: status });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Setup backup schedule
 * POST /api/admin/setup-backup-schedule
 */
const setupBackupSchedule = async (req, res) => {
    try {
        const result = await globalThis.disasterRecoverySystem.setupBackupSchedule();
        res.json({ success: true, message: 'Backup schedule setup completed successfully', data: result });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Verify backup
 * POST /api/admin/verify-backup
 */
const verifyBackup = async (req, res) => {
    try {
        const { backupPath, backupType } = req.body;
        const verificationResult = await globalThis.disasterRecoverySystem.verifyBackupFile(backupPath, backupType);
        res.json({ success: true, message: 'Backup verification completed', data: verificationResult });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Test backup restoration
 * POST /api/admin/test-backup-restoration
 */
const testBackupRestoration = async (req, res) => {
    try {
        const { backupPath, testDatabase } = req.body;
        const startTime = Date.now();
        const restorationResult = await globalThis.disasterRecoverySystem.testBackupRestoration(backupPath, testDatabase);
        const duration = Date.now() - startTime;
        res.json({ success: true, message: 'Backup restoration test completed', data: { ...restorationResult, duration } });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Get disaster recovery documentation
 * GET /api/admin/disaster-recovery-docs
 */
const getDisasterRecoveryDocs = async (req, res) => {
    try {
        const documentation = await globalThis.disasterRecoverySystem.getDocumentation();
        res.json({ success: true, data: documentation });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Create disaster recovery backup
 * POST /api/admin/create-disaster-backup
 */
const createDisasterBackup = async (req, res) => {
    try {
        const { backupType = 'full' } = req.body;
        const backupResult = await globalThis.disasterRecoverySystem.createBackup(backupType);
        res.json({ success: true, message: 'Disaster backup created successfully', data: backupResult });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Get disaster backup list
 * GET /api/admin/disaster-backup-list
 */
const getDisasterBackupList = async (req, res) => {
    try {
        const backups = await globalThis.disasterRecoverySystem.getBackupList();
        res.json({ success: true, data: backups });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Verify backup by ID
 * GET /api/admin/verify-backup/:backupId
 */
const verifyBackupById = async (req, res) => {
    try {
        const { backupId } = req.params;
        const verificationResult = await globalThis.disasterRecoverySystem.verifyBackupById(backupId);
        res.json({ success: true, data: verificationResult });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Test recovery procedure
 * POST /api/admin/test-recovery/:procedureId
 */
const testRecoveryProcedure = async (req, res) => {
    try {
        const { procedureId } = req.params;
        const testResult = await globalThis.disasterRecoverySystem.testProcedure(procedureId);
        res.json({ success: true, data: testResult });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

/**
 * Get recovery procedures
 * GET /api/admin/recovery-procedures
 */
const getRecoveryProcedures = async (req, res) => {
    try {
        const procedures = await globalThis.disasterRecoverySystem.getProcedures();
        res.json({ success: true, data: procedures });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// ES Module exports
export {
    // Helper functions (exported for potential reuse)
    calculateNextBackupDate,
    restoreDatabaseFromSqlFile,
    restoreDatabaseFromZipArchive,
    calculateDirectorySizeBytes,
    
    // Backup CRUD
    createSemesterBackup,
    createDateBackup,
    getBackupList,
    getBackups,
    deleteBackup,
    downloadBackup,
    
    // Restore
    restoreBackupById,
    restoreBackupFromFile,
    
    // Archive
    createTestArchiveData,
    archiveOldData,
    getArchiveStats,
    
    // Status & Settings
    getDatabaseStatus,
    getBackupDirectoryStatus,
    getBackupSettings,
    saveBackupSettings,
    
    // Custom Schedules
    getCustomSchedules,
    createCustomSchedule,
    updateCustomSchedule,
    deleteCustomSchedule,
    runCustomSchedule,
    
    // Manual backup
    createManualBackup,
    
    // Disaster Recovery
    getDisasterRecoveryStatus,
    setupBackupSchedule,
    verifyBackup,
    testBackupRestoration,
    getDisasterRecoveryDocs,
    createDisasterBackup,
    getDisasterBackupList,
    verifyBackupById,
    testRecoveryProcedure,
    getRecoveryProcedures
};

