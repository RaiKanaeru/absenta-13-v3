/**
 * Backup Controller
 * Menangani operasi backup, restore, dan arsip
 * Dimigrasi dari server_modern.js - Batch 15
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import AdmZip from 'adm-zip';
import { sendDatabaseError, sendErrorResponse, sendValidationError, sendNotFoundError, sendServiceUnavailableError, sendSuccessResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';
import { randomBytes } from 'node:crypto';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { splitSqlStatements } from '../utils/sqlParser.js';
import db from '../config/db.js';

const execAsync = promisify(exec);

const logger = createLogger('Backup');

// Constants
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
const TEMP_DIR = path.join(process.cwd(), 'temp');

// Ensure directories exist
try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    await fs.mkdir(TEMP_DIR, { recursive: true });
} catch (err) {
    logger.error('Failed to create backup/temp directories', err);
}

// ================================================
// HELPER FUNCTIONS
// ================================================

/**
 * Calculate next backup date based on schedule
 */
function calculateNextBackupDate(schedule) {
    const now = new Date();

    switch (schedule) {
        case 'daily': {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(2, 0, 0, 0); // 2 AM
            return tomorrow.toISOString();
        }

        case 'weekly': {
            const nextWeek = new Date(now);
            const daysUntilSunday = (7 - now.getDay()) % 7;
            nextWeek.setDate(nextWeek.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
            nextWeek.setHours(2, 0, 0, 0); // 2 AM
            return nextWeek.toISOString();
        }

        case 'monthly': {
            const nextMonth = new Date(now);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            nextMonth.setDate(1);
            nextMonth.setHours(2, 0, 0, 0); // 2 AM
            return nextMonth.toISOString();
        }

        default:
            return null; // Disabled
    }
}

/**
 * Validate backup ID to prevent path traversal
 */
function validateBackupId(backupId) {
    if (!backupId || typeof backupId !== 'string') return false;
    // Allow only alphanumeric, dashes, underscores, and dots
    if (!/^[a-zA-Z0-9.\-_]+$/.test(backupId)) return false;
    // Prevent directory traversal
    if (backupId.includes('..') || backupId.includes('/') || backupId.includes('\\')) return false;
    return true;
}

/**
 * Parse backup filename to extract name, date, and type
 * Pattern: semester_backup_YYYY-MM-DDTHH-MM-SS-mmmZ.sql or .zip
 */
function parseBackupFilename(filename) {
    // Default values
    const result = {
        name: filename,
        date: null,
        type: 'manual'
    };
    
    // Try parsing semester_backup pattern
    // e.g., semester_backup_2026-01-17T19-00-00-031Z.sql
    const semesterMatch = filename.match(/semester_backup_(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
    if (semesterMatch) {
        const [, year, month, day, hour, minute, second] = semesterMatch;
        const dateStr = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
        result.date = new Date(dateStr).toISOString();
        result.name = `Backup ${day}/${month}/${year} ${hour}:${minute}`;
        result.type = 'scheduled';
        return result;
    }
    
    // Try parsing backup_ pattern 
    // e.g., backup_2026-01-17.sql
    const backupMatch = filename.match(/backup[_-](\d{4})-(\d{2})-(\d{2})/);
    if (backupMatch) {
        const [, year, month, day] = backupMatch;
        result.date = `${year}-${month}-${day}T00:00:00Z`;
        result.name = `Backup ${day}/${month}/${year}`;
        result.type = 'manual';
        return result;
    }
    
    // Try extracting any date pattern from filename
    const anyDateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (anyDateMatch) {
        const [, year, month, day] = anyDateMatch;
        result.date = `${year}-${month}-${day}T00:00:00Z`;
        result.name = `Backup ${day}/${month}/${year}`;
        return result;
    }
    
    // No date pattern found - use file's last modified if we have stat
    return result;
}


/**
 * Perform SQL transaction execution
 * @param {string[]} commands - Array of SQL commands to execute
 * @param {Object} options - Execution options
 * @param {boolean} options.continueOnError - Continue execution on recoverable errors
 */
const executeSqlCommands = async (commands, options = {}) => {
    const { continueOnError = true } = options;
    
    if (!db) {
        throw new Error('Database connection pool is not initialized');
    }
    
    const connection = await db.getConnection();
    const results = {
        total: commands.length,
        executed: 0,
        skipped: 0,
        errors: []
    };
    
    try {
        await connection.beginTransaction();
        
        for (const command of commands) {
            if (!command.trim()) continue;
            
            try {
                await connection.execute(command);
                results.executed++;
            } catch (cmdError) {
                // Check if it's a recoverable error
                const isRecoverable = isRecoverableSqlError(cmdError);
                
                if (isRecoverable && continueOnError) {
                    results.skipped++;
                    results.errors.push({
                        command: command.substring(0, 100) + '...',
                        error: cmdError.message,
                        skipped: true
                    });
                    logger.warn('SQL command skipped (recoverable)', { 
                        error: cmdError.message,
                        command: command.substring(0, 50)
                    });
                } else {
                    // Non-recoverable error, throw to rollback
                    throw cmdError;
                }
            }
        }
        
        await connection.commit();
        return results;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Check if SQL error is recoverable (can continue execution)
 */
function isRecoverableSqlError(error) {
    const recoverablePatterns = [
        /already exists/i,           // Table/index already exists
        /duplicate entry/i,          // Duplicate key
        /doesn't exist/i,            // Table doesn't exist for DROP
        /can't drop.*doesn't exist/i // DROP IF EXISTS equivalent
    ];
    
    return recoverablePatterns.some(pattern => pattern.test(error.message));
}

/**
 * Helper to read custom schedules
 */
async function readCustomSchedules() {
    try {
        const schedulesPath = path.join(process.cwd(), 'custom-schedules.json');
        const schedulesData = await fs.readFile(schedulesPath, 'utf8');
        return JSON.parse(schedulesData);
    } catch (error) {
        logger.debug('No custom schedules found, using defaults', { error: error.message });
        return [];
    }
}

/**
 * Helper to write custom schedules
 */
async function writeCustomSchedules(schedules) {
    const schedulesPath = path.join(process.cwd(), 'custom-schedules.json');
    await fs.writeFile(schedulesPath, JSON.stringify(schedules, null, 2));
}

/**
 * Helper function to process SQL backup
 */
/**
 * Helper function to process SQL backup
 */
async function restoreDatabaseFromSqlFile(filePath) {
    try {
        const sqlContent = await fs.readFile(filePath, 'utf8');
        const normalizedSql = sqlContent.replace(/^\uFEFF/, '').toLowerCase();

        // Validate SQL content
        if (!normalizedSql.includes('create table') && !normalizedSql.includes('insert into')) {
            throw new Error('File SQL tidak valid');
        }

        const commands = splitSqlStatements(sqlContent);
        const results = await executeSqlCommands(commands);

        return {
            type: 'sql',
            message: 'Database berhasil dipulihkan dari file SQL',
            tablesRestored: normalizedSql.match(/create\s+table/g)?.length || 0,
            commandsExecuted: results.executed,
            commandsSkipped: results.skipped,
            errors: results.errors
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

        const sqlContent = zip.readFile(sqlFile).toString('utf8');
        const normalizedSql = sqlContent.replace(/^\uFEFF/, '').toLowerCase();

        if (!normalizedSql.includes('create table') && !normalizedSql.includes('insert into')) {
            throw new Error('File SQL tidak valid');
        }

        const commands = splitSqlStatements(sqlContent);
        const results = await executeSqlCommands(commands);

        return {
            type: 'zip',
            message: 'Database berhasil dipulihkan dari file ZIP',
            filesExtracted: zipEntries.length,
            commandsExecuted: results.executed,
            commandsSkipped: results.skipped,
            errors: results.errors
        };
    } catch (error) {
        throw new Error(`Gagal memproses file ZIP: ${error.message}`);
    }
}

/**
 * Helper function to get folder size
 */
// Helper function to get folder size
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
        logger.debug('Failed to calculate directory size', { path: folderPath, error: error.message });
        return 0;
    }
}

/**
 * Helper to update backup settings with latest backup date
 */
async function updateBackupSettings() {
    try {
        const settingsPath = path.join(process.cwd(), 'backup-settings.json');
        let settings = {};

        try {
            const settingsData = await fs.readFile(settingsPath, 'utf8');
            settings = JSON.parse(settingsData);
        } catch (fileError) {
            logger.debug('Settings file not found or invalid, using defaults', { error: fileError.message });
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
}

/**
 * Helper to validate date range for backups
 */
function validateBackupDates(startDate, endDate) {
    if (!startDate) {
        const err = new Error('Start date is required');
        err.status = 400;
        err.error = 'Invalid input';
        throw err;
    }

    // Jika endDate tidak ada, gunakan startDate sebagai endDate (backup satu hari)
    const actualEndDate = endDate || startDate;

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(actualEndDate);

    if (Number.isNaN(startDateObj.getTime()) || Number.isNaN(endDateObj.getTime())) {
        const err = new Error('Please provide valid dates in YYYY-MM-DD format');
        err.status = 400;
        err.error = 'Invalid date format';
        throw err;
    }

    if (startDateObj > endDateObj) {
        const err = new Error('Start date cannot be after end date');
        err.status = 400;
        err.error = 'Invalid date range';
        throw err;
    }

    // Cek apakah tanggal tidak di masa depan
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (startDateObj > today) {
        const err = new Error('Cannot backup future dates');
        err.status = 400;
        err.error = 'Invalid date';
        throw err;
    }

    return { actualEndDate, startDateObj, endDateObj };
}


/**
 * Helper to perform manual database backup (SQL generation)
 */
async function performManualDatabaseBackup(filepath, filename) {
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
                const [createResult] = await db.execute(`SHOW CREATE TABLE ${table}`);
                if (createResult.length > 0) {
                    backupContent += `\n-- Table: ${table}\n`;
                    backupContent += `DROP TABLE IF EXISTS \`${table}\`;\n`;
                    backupContent += createResult[0]['Create Table'] + ';\n\n';
                }

                // Get table data
                const [rows] = await db.execute(`SELECT * FROM ${table}`);
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

/**
 * Helper to delete a single backup (system or manual)
 * Returns { success: boolean, reason?: string, id: string }
 */
async function deleteSingleBackup(backupId) {
    if (!validateBackupId(backupId)) {
        return { success: false, id: backupId, reason: 'Invalid ID format' };
    }

    try {
        // Try system delete first
        await globalThis.backupSystem.deleteBackup(backupId);
        return { success: true, id: backupId };
    } catch (err) {
        // Fallback to manual delete
        try {
            const { filePath } = await resolveBackupFilePath(BACKUP_DIR, backupId);
            
            if (!filePath) {
                 return { success: false, id: backupId, reason: 'File not found' };
            }

            const stat = await fs.stat(filePath);
            if (stat.isDirectory()) {
                await fs.rm(filePath, { recursive: true, force: true });
            } else {
                await fs.unlink(filePath);
            }
            
            return { success: true, id: backupId };
        } catch (manualErr) {
            return { success: false, id: backupId, reason: manualErr.message };
        }
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
            return sendServiceUnavailableError(res, 'Sistem backup belum siap. Silakan coba lagi beberapa saat.');
        }

        const { semester, year } = req.body;

        // Validasi input
        if (!semester || !['Ganjil', 'Genap'].includes(semester)) {
            return sendValidationError(res, 'Semester harus Ganjil atau Genap');
        }

        if (!year || Number.isNaN(Number(year)) || year < 2020 || year > 2030) {
            return sendValidationError(res, 'Tahun harus antara 2020-2030');
        }

        const backupResult = await globalThis.backupSystem.createSemesterBackup(semester, year);

        // Update backup settings with last backup date
        // Update backup settings with last backup date
        await updateBackupSettings();

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
            return sendServiceUnavailableError(res, 'Sistem backup belum siap. Silakan coba lagi beberapa saat.');
        }

        const { startDate, endDate } = req.body;

        // Validasi input
        let actualEndDate, startDateObj, endDateObj;
        try {
            const validation = validateBackupDates(startDate, endDate);
            actualEndDate = validation.actualEndDate;
            startDateObj = validation.startDateObj;
            endDateObj = validation.endDateObj;
        } catch (validationError) {
            logger.warn('Backup date validation failed', { error: validationError.message });
            return sendValidationError(res, validationError.message);
        }

        logger.info('Creating date backup', { startDate, endDate: actualEndDate });

        const backupResult = await globalThis.backupSystem.createDateBackup(startDate, actualEndDate);

        // Update backup settings
        await updateBackupSettings();

        const dateRangeStr = actualEndDate === startDate ? '' : ` to ${actualEndDate}`;
        
        res.json({
            success: true,
            message: `Date-based backup created successfully for ${startDate}${dateRangeStr}`,
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
        return sendDatabaseError(res, error, 'Gagal membuat backup berdasarkan tanggal');
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
        return sendDatabaseError(res, error, 'Gagal memuat daftar backup');
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
            
            // Ensure each backup has name and date parsed from filename if missing
            const enrichedBackups = backups.map(backup => {
                if (!backup.name || backup.name === 'Unknown Backup' || !backup.date) {
                    const parsed = parseBackupFilename(backup.id || backup.filename || '');
                    return {
                        ...backup,
                        name: backup.name && backup.name !== 'Unknown Backup' ? backup.name : parsed.name,
                        date: backup.date || parsed.date,
                        type: backup.type || parsed.type
                    };
                }
                return backup;
            });
            
            return res.status(200).json({
                ok: true,
                backups: enrichedBackups || []
            });
        }

        // Fallback or Error if system not initialized
        logger.warn('BackupSystem not initialized, trying fallback listing');
        const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
        
        try {
            await fs.access(backupDir);
            const files = await fs.readdir(backupDir);
            
            // Enhanced fallback list with proper parsing
            const backupsPromises = files.map(async (f) => {
                const filePath = path.join(backupDir, f);
                const parsed = parseBackupFilename(f);
                
                // Get actual file stats
                let size = 0;
                let modified = null;
                try {
                    const stats = await fs.stat(filePath);
                    size = stats.size;
                    modified = stats.mtime.toISOString();
                } catch {
                    // Ignore stat errors
                }
                
                return {
                    id: f,
                    filename: f,
                    name: parsed.name,
                    date: parsed.date || modified,
                    type: parsed.type,
                    size: size
                };
            });
            
            const backups = await Promise.all(backupsPromises);
            
            res.status(200).json({
                ok: true,
                backups
            });
        } catch (dirError) {
            // Gracefully handle directory read errors - return empty list
            logger.debug('Backup directory read failed:', dirError.message);
            res.status(200).json({ ok: true, backups: [] });
        }

    } catch (error) {
        logger.error('Error getting backups', error);
        return sendDatabaseError(res, error, 'Gagal mendapatkan daftar backup');
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
            return sendValidationError(res, 'Backup ID wajib diisi');
        }

        logger.info('Attempting to delete backup', { backupId });

        if (!globalThis.backupSystem) {
            logger.error('Backup system not initialized');
            return sendServiceUnavailableError(res, 'Sistem backup belum siap. Silakan coba lagi beberapa saat.');
        }

        if (!validateBackupId(backupId)) {
            return sendValidationError(res, 'Format Backup ID tidak valid');
        }

        // Try to delete using backup system first
        try {
            const result = await globalThis.backupSystem.deleteBackup(backupId);
            logger.info('Backup deleted via backup system', { backupId });
            return res.json({ success: true, message: 'Backup berhasil dihapus', data: result });
        } catch (backupSystemError) {
            logger.warn('Backup system delete failed, trying manual deletion', { error: backupSystemError.message });

             // Fallback: Manual deletion using safe path resolution
             const { filePath, filename } = await resolveBackupFilePath(BACKUP_DIR, backupId);

             if (!filePath) {
                 throw new Error(`No backup files found for ID: ${backupId}`);
             }

             const stat = await fs.stat(filePath);
             if (stat.isDirectory()) {
                 await fs.rm(filePath, { recursive: true, force: true });
             } else {
                 await fs.unlink(filePath);
             }

             res.json({
                 success: true,
                 message: 'Backup berhasil dihapus',
                 data: { deletedFiles: [filename], method: 'manual' }
             });
        }

    } catch (error) {
        logger.error('Error deleting backup', error);
        return sendDatabaseError(res, error, 'Gagal menghapus backup');
    }
};

/**
 * Delete multiple backups
 * DELETE /api/admin/backups/batch
 */
const deleteBackupBatch = async (req, res) => {
    try {
        const { backupIds } = req.body;

        if (!Array.isArray(backupIds) || backupIds.length === 0) {
            return sendValidationError(res, 'Array Backup IDs wajib diisi');
        }

        logger.info('Attempting to delete multiple backups', { count: backupIds.length });

        if (!globalThis.backupSystem) {
            logger.error('Backup system not initialized');
            return sendServiceUnavailableError(res, 'Sistem backup belum siap');
        }

        const results = {
            success: [],
            failed: []
        };

        const deletePromises = backupIds.map(deleteSingleBackup);
        const deleteResults = await Promise.all(deletePromises);

        for (const result of deleteResults) {
            if (result.success) {
                results.success.push(result.id);
            } else {
                results.failed.push({ id: result.id, reason: result.reason });
            }
        }

        res.json({
            success: true,
            message: `Deleted ${results.success.length} backups, ${results.failed.length} failed`,
            data: results
        });

    } catch (error) {
        logger.error('Error deleting backup batch', error);
        return sendDatabaseError(res, error, 'Gagal menghapus backup batch');
    }
};


/**
 * Helper to resolve backup file path from ID
 * @param {string} backupDir
 * @param {string} backupId
 * @returns {Promise<{filePath: string|null, filename: string|null}>}
 */
const resolveBackupFilePath = async (backupDir, backupId) => {
    // Validate ID first
    if (!validateBackupId(backupId)) return { filePath: null, filename: null };

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
    } catch (dirError) {
        // Directory not found or inaccessible - expected, continue to file check
        logger.debug('Backup subdir check failed:', dirError.message);
    }

    // 2. Check direct files
    const candidates = [`${backupId}.zip`, backupId, `${backupId}.sql`, `${backupId}.tar.gz`];
    for (const c of candidates) {
        const p = path.join(backupDir, c);
        try {
            if ((await fs.stat(p)).isFile()) return { filePath: p, filename: c };
        } catch (statError) {
             logger.debug('File candidate check failed', { path: p, error: statError.message });
        }
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
            return sendValidationError(res, 'Backup ID mengandung karakter tidak valid');
        }

        logger.info('Downloading backup', { backupId: sanitizedBackupId });

        const { filePath, filename } = await resolveBackupFilePath(backupDir, sanitizedBackupId);

        if (!filePath) {
            logger.error('No backup file found', { backupId: sanitizedBackupId });
            return sendNotFoundError(res, `File backup tidak ditemukan: ${sanitizedBackupId}`);
        }

        // Set proper headers for file download
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        logger.debug('Sending file', { filePath });
        res.download(filePath, filename, (err) => {
            if (err) {
                logger.error('Error during file download', err);
                if (!res.headersSent) {
                    sendErrorResponse(res, err, err.message || 'Gagal mengunduh file');
                }
            } else {
                logger.info('File download completed', { filename });
            }
        });

    } catch (error) {
        logger.error('Error downloading backup', error);
        return sendDatabaseError(res, error, 'Gagal mengunduh backup');
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
            return sendValidationError(res, 'Backup ID wajib diisi');
        }

        if (!globalThis.backupSystem) {
             logger.error('Backup system not initialized');
             return sendServiceUnavailableError(res, 'Sistem backup belum siap. Silakan coba lagi beberapa saat.');
        }

        const result = await globalThis.backupSystem.restoreFromBackup(backupId);

        res.json({
            success: true,
            message: 'Backup berhasil dipulihkan',
            data: result
        });

    } catch (error) {
        logger.error('Error restoring backup', error);
        return sendDatabaseError(res, error, 'Gagal memulihkan backup');
    }
};


/**
 * Restore backup from uploaded file
 * POST /api/admin/restore-backup (with file upload)
 */
const restoreBackupFromFile = async (req, res) => {
    try {
        if (!req.file) {
            return sendValidationError(res, 'File backup harus diupload');
        }

        if (!db) {
            return sendServiceUnavailableError(res, 'Koneksi database belum siap');
        }

        logger.info('Processing backup file upload', {
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        });

        // Validate file type - sanitize extension to prevent path traversal (S2083)
        const rawExtension = path.extname(req.file.originalname).toLowerCase();
        const fileExtension = rawExtension.replaceAll(/[^a-z0-9.]/g, '');

        if (!['.sql', '.zip'].includes(fileExtension)) {
            return sendValidationError(res, 'File harus berformat .sql atau .zip');
        }

        // Save uploaded file temporarily - use safe filename to prevent path traversal (S2083)
        const safeFilename = `backup_${Date.now()}${fileExtension}`;
        const tempFilePath = path.join(TEMP_DIR, safeFilename);
        await fs.writeFile(tempFilePath, req.file.buffer);

        // Process the backup file
        let result;
        logger.info('Processing backup file', { fileExtension, tempFilePath }); // Debug checkpoint 1

        if (fileExtension === '.sql') {
            logger.info('Starting SQL restore...'); // Debug checkpoint 2
            result = await restoreDatabaseFromSqlFile(tempFilePath);
            logger.info('SQL restore finished'); // Debug checkpoint 3
        } else if (fileExtension === '.zip') {
            logger.info('Starting ZIP restore...'); 
            result = await restoreDatabaseFromZipArchive(tempFilePath);
        }

        // Clean up temporary file
        await fs.unlink(tempFilePath);
        logger.info('Temp file cleaned up'); // Debug checkpoint 4

        res.json({
            success: true,
            message: 'Backup berhasil dipulihkan',
            data: result
        });

    } catch (error) {
        logger.error('Error restoring backup', error);
        return sendDatabaseError(res, error, 'Gagal memulihkan backup');
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

        if (!db) {
            logger.error('Database pool not initialized');
            return sendServiceUnavailableError(res, 'Koneksi database belum siap. Silakan coba lagi beberapa saat.');
        }

        // Create test data that is 25 months old
        const oldDate = new Date();
        oldDate.setMonth(oldDate.getMonth() - 25);
        // Format date manually to avoid timezone issues
        const oldDateStr = `${oldDate.getFullYear()}-${String(oldDate.getMonth() + 1).padStart(2, '0')}-${String(oldDate.getDate()).padStart(2, '0')}`;


        logger.debug('Creating test data with date', { oldDateStr, monthsOld: 25 });

        // Clean up existing test data
        await db.execute(`DELETE FROM absensi_siswa WHERE keterangan = 'Test data for archive'`);
        await db.execute(`DELETE FROM absensi_guru WHERE keterangan = 'Test data for archive'`);
        await db.execute(`DELETE FROM absensi_siswa_archive WHERE keterangan = 'Test data for archive'`);
        await db.execute(`DELETE FROM absensi_guru_archive WHERE keterangan = 'Test data for archive'`);

        // Get valid jadwal_id and guru_id
        const [jadwalRows] = await db.execute(`SELECT id_jadwal FROM jadwal LIMIT 1`);
        const [guruRows] = await db.execute(`SELECT id_guru FROM guru WHERE status = 'aktif' LIMIT 1`);

        const validJadwalId = jadwalRows.length > 0 ? jadwalRows[0].id_jadwal : null;
        const validGuruId = guruRows.length > 0 ? guruRows[0].id_guru : null;

        // Insert test student attendance records
        const [studentResult] = await db.execute(`
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
        return sendDatabaseError(res, error, 'Gagal membuat data arsip test');
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
            return sendServiceUnavailableError(res, 'Sistem backup belum siap. Silakan coba lagi beberapa saat.');
        }

        if (!db) {
            logger.error('Database pool not initialized');
            return sendServiceUnavailableError(res, 'Koneksi database belum siap. Silakan coba lagi beberapa saat.');
        }

        const archiveResult = await globalThis.backupSystem.archiveOldData(monthsOld);

        res.json({
            success: true,
            message: `Data older than ${monthsOld} months archived successfully`,
            data: archiveResult
        });

    } catch (error) {
        logger.error('Error archiving old data', error);
        return sendDatabaseError(res, error, 'Gagal mengarsipkan data lama');
    }
};

/**
 * Get archive statistics
 * GET /api/admin/archive-stats
 */
const getArchiveStats = async (req, res) => {
    try {
        logger.info('Getting archive statistics');

        if (!db) {
            logger.error('Database pool not initialized');
            return sendServiceUnavailableError(res, 'Koneksi database belum siap. Silakan coba lagi beberapa saat.');
        }

        // Get student archive count
        let studentArchiveCount = 0;
        try {
            const [studentArchive] = await db.execute(`SELECT COUNT(*) as count FROM absensi_siswa_archive`);
            studentArchiveCount = studentArchive[0]?.count || 0;
        } catch (error) {
            logger.warn('Student archive table not found, using 0', { error: error.message });
        }

        // Get teacher archive count
        let teacherArchiveCount = 0;
        try {
            const [teacherArchive] = await db.execute(`SELECT COUNT(*) as count FROM absensi_guru_archive`);
            teacherArchiveCount = teacherArchive[0]?.count || 0;
        } catch (error) {
            logger.warn('Teacher archive table not found, using 0', { error: error.message });
        }

        // Get total archive size (approximate)
        let totalSizeMB = (studentArchiveCount * 0.5) + (teacherArchiveCount * 0.3);

        // Get last archive date
        let lastArchive = null;
        try {
            const [lastArchiveResult] = await db.execute(`SELECT MAX(archived_at) as last_archive FROM absensi_siswa_archive`);
            lastArchive = lastArchiveResult[0]?.last_archive || null;
        } catch (error) {
            logger.debug('Primary archive check failed, trying fallback', { error: error.message });
            try {
                const [lastArchiveResult] = await db.execute(`SELECT MAX(waktu_absen) as last_archive FROM absensi_siswa_archive`);
                lastArchive = lastArchiveResult[0]?.last_archive || null;
            } catch (err) {
                // Table doesn't exist, ignore
                logger.debug('Archive table check failed', { error: err.message });
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
        return sendDatabaseError(res, error, 'Gagal memuat statistik arsip');
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
            dbPool: !!db,
            dbPoolType: typeof db,
            dbPoolPool: !!db?.pool,
            dbPoolPoolType: typeof db?.pool,
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
            logger.debug('Backup directory does not exist or is not accessible', { error: error.message });
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
        return sendDatabaseError(res, error, 'Gagal memeriksa direktori backup');
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
            logger.debug('Failed to read backup settings file (using defaults)', { error: fileError.message });
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

            // Reschedule cron if the schedule expression changed
            if (validSettings.autoBackupSchedule && validSettings.autoBackupSchedule !== globalThis.backupSystem.backupConfig.autoBackupSchedule) {
                globalThis.backupSystem.rescheduleBackup(validSettings.autoBackupSchedule);
                logger.info('Backup schedule rescheduled', { schedule: validSettings.autoBackupSchedule });
            }
        }

        res.json({
            success: true,
            message: 'Backup settings saved successfully',
            settings: validSettings
        });

    } catch (error) {
        logger.error('Error saving backup settings', { error: error.message });
        return sendDatabaseError(res, error, 'Gagal menyimpan pengaturan backup');
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

        const schedules = await readCustomSchedules();

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
            return sendValidationError(res, 'Nama, tanggal, dan waktu wajib diisi');
        }

        // Validate date is not in the past
        const scheduleDate = new Date(`${date}T${time}`);
        const now = new Date();
        if (scheduleDate <= now) {
            return sendValidationError(res, 'Tanggal jadwal harus di masa depan');
        }

        const schedules = await readCustomSchedules();

        const newSchedule = {
            id: `schedule_${Date.now()}_${randomBytes(6).toString('hex')}`,
            name,
            date,
            time,
            enabled: enabled !== false,
            created: new Date().toISOString()
        };

        schedules.push(newSchedule);

        await writeCustomSchedules(schedules);

        res.json({
            success: true,
            message: 'Custom schedule created successfully',
            schedule: newSchedule
        });

    } catch (error) {
        logger.error('Error creating custom schedule', { error: error.message });
        return sendDatabaseError(res, error, 'Gagal membuat jadwal kustom');
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

        const schedules = await readCustomSchedules();

        const scheduleIndex = schedules.findIndex(s => s.id === id);
        if (scheduleIndex === -1) {
            return sendNotFoundError(res, 'Jadwal dengan ID tersebut tidak ditemukan');
        }

        // Update schedule
        schedules[scheduleIndex] = {
            ...schedules[scheduleIndex],
            name: name || schedules[scheduleIndex].name,
            date: date || schedules[scheduleIndex].date,
            time: time || schedules[scheduleIndex].time,
            enabled: enabled === undefined ? schedules[scheduleIndex].enabled : enabled,
            updated: new Date().toISOString()
        };

        await writeCustomSchedules(schedules);

        res.json({
            success: true,
            message: 'Custom schedule updated successfully',
            schedule: schedules[scheduleIndex]
        });

    } catch (error) {
        logger.error('Error updating custom schedule', { error: error.message });
        return sendDatabaseError(res, error, 'Gagal memperbarui jadwal kustom');
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

        const schedules = await readCustomSchedules();
        
        const initialLength = schedules.length;
        const filteredSchedules = schedules.filter(s => s.id !== id);

        if (filteredSchedules.length === initialLength) {
            return sendNotFoundError(res, 'Jadwal dengan ID tersebut tidak ditemukan');
        }

        await writeCustomSchedules(filteredSchedules);

        res.json({
            success: true,
            message: 'Custom schedule deleted successfully'
        });

    } catch (error) {
        logger.error('Error deleting custom schedule', { error: error.message });
        return sendDatabaseError(res, error, 'Gagal menghapus jadwal kustom');
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
            logger.warn('Schedules file not found', { error: fileError.message });
            return sendNotFoundError(res, 'File jadwal tidak ditemukan');
        }

        const schedule = schedules.find(s => s.id === id);
        if (!schedule) {
            return sendNotFoundError(res, 'Jadwal dengan ID tersebut tidak ditemukan');
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
            return sendServiceUnavailableError(res, 'Sistem backup belum siap');
        }

    } catch (error) {
        logger.error('Error running custom schedule', { error: error.message });
        return sendDatabaseError(res, error, 'Gagal menjalankan jadwal kustom');
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
            logger.debug('Backup directory does not exist, creating it', { error: error.message });
            // Directory doesn't exist, create it
            await fs.mkdir(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
        const filename = `backup_absenta_${timestamp}.sql`;
        const filepath = path.join(backupDir, filename);

        // Try mysqldump first, fallback to manual
        try {
            await execAsync('mysqldump --version');

            const mysqldumpCmd = `mysqldump -h localhost -u root absenta13 > "${filepath}"`;
            await execAsync(mysqldumpCmd);

            logger.info('mysqldump backup created successfully');

            res.setHeader('Content-Type', 'application/sql');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            const fileContent = await fs.readFile(filepath, 'utf8');
            res.send(fileContent);

        } catch (mysqldumpError) {
            logger.debug('mysqldump not available, using manual backup', { error: mysqldumpError.message });
            const result = await performManualDatabaseBackup(filepath, filename);

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
        if (!globalThis.disasterRecoverySystem) {
            return sendServiceUnavailableError(res, 'Sistem Disaster Recovery belum tersedia');
        }
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
        if (!globalThis.disasterRecoverySystem) {
            return sendServiceUnavailableError(res, 'Sistem Disaster Recovery belum tersedia');
        }
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
        if (!globalThis.disasterRecoverySystem) {
            return sendServiceUnavailableError(res, 'Sistem Disaster Recovery belum tersedia');
        }
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
        if (!globalThis.disasterRecoverySystem) {
            return sendServiceUnavailableError(res, 'Sistem Disaster Recovery belum tersedia');
        }
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
        if (!globalThis.disasterRecoverySystem) {
            return sendServiceUnavailableError(res, 'Sistem Disaster Recovery belum tersedia');
        }
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
        if (!globalThis.disasterRecoverySystem) {
            return sendServiceUnavailableError(res, 'Sistem Disaster Recovery belum tersedia');
        }
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
        if (!globalThis.disasterRecoverySystem) {
            return sendServiceUnavailableError(res, 'Sistem Disaster Recovery belum tersedia');
        }
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
        if (!globalThis.disasterRecoverySystem) {
            return sendServiceUnavailableError(res, 'Sistem Disaster Recovery belum tersedia');
        }
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
        if (!globalThis.disasterRecoverySystem) {
            return sendServiceUnavailableError(res, 'Sistem Disaster Recovery belum tersedia');
        }
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
        if (!globalThis.disasterRecoverySystem) {
            return sendServiceUnavailableError(res, 'Sistem Disaster Recovery belum tersedia');
        }
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
    deleteBackupBatch,
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

