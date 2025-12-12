/**
 * Backup Controller
 * Handles all backup, restore, and archive operations
 * Migrated from server_modern.js - Batch 15
 */

import path from 'path';
import fs from 'fs/promises';
import AdmZip from 'adm-zip';
import { sendErrorResponse, sendDatabaseError, sendValidationError, sendNotFoundError, sendDuplicateError } from '../utils/errorHandler.js';

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
                await global.dbPool.pool.execute(command);
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

/**
 * Helper function to process ZIP backup
 */
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
                await global.dbPool.pool.execute(command);
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

/**
 * Helper function to get folder size
 */
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

// ================================================
// BACKUP CRUD ENDPOINTS
// ================================================

/**
 * Create semester backup
 * POST /api/admin/create-semester-backup
 */
const createSemesterBackup = async (req, res) => {
    try {
        console.log('📄 Creating semester backup...');

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

            // Update dates
            currentSettings.lastBackupDate = new Date().toISOString();
            currentSettings.nextBackupDate = calculateNextBackupDate(currentSettings.autoBackupSchedule);

            // Save settings
            await fs.writeFile(settingsPath, JSON.stringify(currentSettings, null, 2));
            console.log('✅ Backup settings updated successfully');

        } catch (settingsError) {
            console.error('⚠️ Failed to update backup settings:', settingsError);
        }

        res.json({
            success: true,
            message: `Semester backup created successfully for ${semester} ${year}`,
            data: backupResult,
            backupSystemStatus: global.backupSystem ? 'initialized' : 'not initialized'
        });
    } catch (error) {
        console.error('❌ Error creating semester backup:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message || 'Failed to create semester backup'
        });
    }
};

/**
 * Create date-based backup
 * POST /api/admin/create-date-backup
 */
const createDateBackup = async (req, res) => {
    try {
        console.log('📄 Creating date-based backup...');

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
        today.setHours(23, 59, 59, 999);
        if (startDateObj > today) {
            return res.status(400).json({
                error: 'Invalid date',
                message: 'Cannot backup future dates'
            });
        }

        console.log(`📅 Creating backup for date range: ${startDate} to ${actualEndDate}`);

        const backupResult = await global.backupSystem.createDateBackup(startDate, actualEndDate);

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
            console.log('✅ Backup settings updated successfully');

        } catch (settingsError) {
            console.error('⚠️ Failed to update backup settings:', settingsError);
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
};

/**
 * Get backup list (via BackupSystem)
 * GET /api/admin/backup-list
 */
const getBackupList = async (req, res) => {
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
};

/**
 * Get backups (directory-based listing)
 * GET /api/admin/backups
 */
const getBackups = async (req, res) => {
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

        console.log(`🗑️ Attempting to delete backup: ${backupId}`);

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
};

/**
 * Download backup
 * GET /api/admin/download-backup/:backupId
 */
const downloadBackup = async (req, res) => {
    try {
        const { backupId } = req.params;
        const backupDir = path.join(process.cwd(), 'backups');

        console.log(`📥 Downloading backup: ${backupId}`);

        let filePath = null;
        let filename = null;

        // First, check if backupId is a directory
        const backupSubDir = path.join(backupDir, backupId);
        try {
            const stats = await fs.stat(backupSubDir);
            if (stats.isDirectory()) {
                console.log(`📁 Found backup directory: ${backupSubDir}`);

                const files = await fs.readdir(backupSubDir);

                // Look for compressed files first
                const compressedFiles = files.filter(file =>
                    file.endsWith('.zip') || file.endsWith('.tar.gz') || file.endsWith('.gz')
                );

                if (compressedFiles.length > 0) {
                    const compressedFile = compressedFiles[0];
                    filePath = path.join(backupSubDir, compressedFile);
                    filename = compressedFile;
                } else {
                    // Look for SQL files
                    const sqlFiles = files.filter(file => file.endsWith('.sql'));
                    if (sqlFiles.length > 0) {
                        const sqlFile = sqlFiles[0];
                        filePath = path.join(backupSubDir, sqlFile);
                        filename = sqlFile;
                    } else {
                        // Look for any other files
                        const otherFiles = files.filter(file =>
                            !file.endsWith('.json') && !file.endsWith('.txt') && !file.endsWith('.log')
                        );
                        if (otherFiles.length > 0) {
                            const otherFile = otherFiles[0];
                            filePath = path.join(backupSubDir, otherFile);
                            filename = otherFile;
                        }
                    }
                }
            }
        } catch (error) {
            console.log(`❌ Backup directory not found: ${backupSubDir}`);
        }

        // If not found in subdirectory, try direct files
        if (!filePath) {
            const possibleFiles = [
                `${backupId}.zip`,
                `${backupId}`,
                `${backupId}.sql`,
                `${backupId}.tar.gz`
            ];

            for (const possibleFile of possibleFiles) {
                const testPath = path.join(backupDir, possibleFile);
                try {
                    const stats = await fs.stat(testPath);
                    if (stats.isFile()) {
                        filePath = testPath;
                        filename = possibleFile;
                        break;
                    }
                } catch (error) {
                    // File not found, continue
                }
            }
        }

        if (!filePath) {
            console.error(`❌ No backup file found for ID: ${backupId}`);
            return res.status(404).json({
                error: 'Backup file not found',
                message: `No backup file found for ID: ${backupId}`
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
            result = await processSQLBackup(tempFilePath);
        } else if (fileExtension === '.zip') {
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
        console.log('🧪 Creating test archive data...');

        if (!global.dbPool || !global.dbPool.pool) {
            console.error('❌ Database pool not initialized');
            return res.status(503).json({
                error: 'Database not ready',
                message: 'Database connection pool is not initialized yet. Please try again in a few seconds.'
            });
        }

        // Create test data that is 25 months old
        const oldDate = new Date();
        oldDate.setMonth(oldDate.getMonth() - 25);
        const oldDateStr = oldDate.toISOString().split('T')[0];

        console.log(`📅 Creating test data with date: ${oldDateStr} (25 months old)`);

        // Clean up existing test data
        await global.dbPool.pool.execute(`DELETE FROM absensi_siswa WHERE keterangan = 'Test data for archive'`);
        await global.dbPool.pool.execute(`DELETE FROM absensi_guru WHERE keterangan = 'Test data for archive'`);
        await global.dbPool.pool.execute(`DELETE FROM absensi_siswa_archive WHERE keterangan = 'Test data for archive'`);
        await global.dbPool.pool.execute(`DELETE FROM absensi_guru_archive WHERE keterangan = 'Test data for archive'`);

        // Get valid jadwal_id and guru_id
        const [jadwalRows] = await global.dbPool.pool.execute(`SELECT id_jadwal FROM jadwal LIMIT 1`);
        const [guruRows] = await global.dbPool.pool.execute(`SELECT id_guru FROM guru WHERE status = 'aktif' LIMIT 1`);

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

        const result = {
            message: 'Test archive data created successfully',
            studentRecordsCreated: studentResult.affectedRows,
            teacherRecordsCreated: 0,
            testDate: oldDateStr,
            monthsOld: 25
        };

        console.log(`✅ Created ${studentResult.affectedRows} test student records`);

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
};

/**
 * Archive old data
 * POST /api/admin/archive-old-data
 */
const archiveOldData = async (req, res) => {
    try {
        const { monthsOld = 12 } = req.body;

        console.log(`📄 Archiving data older than ${monthsOld} months...`);

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
};

/**
 * Get archive statistics
 * GET /api/admin/archive-stats
 */
const getArchiveStats = async (req, res) => {
    try {
        console.log('📊 Getting archive statistics...');

        if (!global.dbPool || !global.dbPool.pool) {
            console.error('❌ Database pool not initialized');
            return res.status(503).json({
                error: 'Database not ready',
                message: 'Database connection pool is not initialized yet. Please try again in a few seconds.'
            });
        }

        // Get student archive count
        let studentArchiveCount = 0;
        try {
            const [studentArchive] = await global.dbPool.pool.execute(`SELECT COUNT(*) as count FROM absensi_siswa_archive`);
            studentArchiveCount = studentArchive[0]?.count || 0;
        } catch (error) {
            console.log('⚠️ Student archive table not found, using 0');
        }

        // Get teacher archive count
        let teacherArchiveCount = 0;
        try {
            const [teacherArchive] = await global.dbPool.pool.execute(`SELECT COUNT(*) as count FROM absensi_guru_archive`);
            teacherArchiveCount = teacherArchive[0]?.count || 0;
        } catch (error) {
            console.log('⚠️ Teacher archive table not found, using 0');
        }

        // Get total archive size (approximate)
        let totalSizeMB = (studentArchiveCount * 0.5) + (teacherArchiveCount * 0.3);

        // Get last archive date
        let lastArchive = null;
        try {
            const [lastArchiveResult] = await global.dbPool.pool.execute(`SELECT MAX(archived_at) as last_archive FROM absensi_siswa_archive`);
            lastArchive = lastArchiveResult[0]?.last_archive || null;
        } catch (error) {
            try {
                const [lastArchiveResult] = await global.dbPool.pool.execute(`SELECT MAX(waktu_absen) as last_archive FROM absensi_siswa_archive`);
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
        console.error('❌ Error getting archive stats:', error);
        res.status(500).json({
            error: 'Internal server error',
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
};

/**
 * Get backup settings
 * GET /api/admin/backup-settings
 */
const getBackupSettings = async (req, res) => {
    try {
        console.log('⚙️ Getting backup settings...');

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
        console.log('💾 Saving backup settings:', settings);

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
        console.log('📅 Getting custom schedules...');

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
        console.log('📅 Creating custom schedule:', { name, date, time, enabled });

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
            id: `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
        console.error('❌ Error creating custom schedule:', error);
        res.status(500).json({
            error: 'Internal server error',
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
        console.log('📅 Updating custom schedule:', { id, name, date, time, enabled });

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
        console.error('❌ Error updating custom schedule:', error);
        res.status(500).json({
            error: 'Internal server error',
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
        console.log('🗑️ Deleting custom schedule:', id);

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
        console.error('❌ Error deleting custom schedule:', error);
        res.status(500).json({
            error: 'Internal server error',
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
};

/**
 * Manual database backup
 * GET /api/admin/backup
 */
const createManualBackup = async (req, res) => {
    try {
        console.log('💾 Creating database backup...');

        const backupDir = path.join(process.cwd(), 'backups');
        try {
            await fs.access(backupDir);
        } catch (error) {
            await fs.mkdir(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
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
                        const [createResult] = await global.dbPool.pool.execute(`SHOW CREATE TABLE ${table}`);
                        if (createResult.length > 0) {
                            backupContent += `\n-- Table: ${table}\n`;
                            backupContent += `DROP TABLE IF EXISTS \`${table}\`;\n`;
                            backupContent += createResult[0]['Create Table'] + ';\n\n';
                        }

                        // Get table data
                        const [rows] = await global.dbPool.pool.execute(`SELECT * FROM ${table}`);
                        if (rows.length > 0) {
                            for (const row of rows) {
                                const columns = Object.keys(row).map(col => `\`${col}\``).join(', ');
                                const values = Object.values(row).map(val => {
                                    if (val === null) return 'NULL';
                                    if (typeof val === 'number') return val;
                                    return `'${String(val).replace(/'/g, "''")}'`;
                                }).join(', ');
                                backupContent += `INSERT INTO \`${table}\` (${columns}) VALUES (${values});\n`;
                            }
                            backupContent += '\n';
                        }
                    } catch (tableError) {
                        console.log(`⚠️ Could not backup table ${table}: ${tableError.message}`);
                    }
                }

                await fs.writeFile(filepath, backupContent);
                console.log(`✅ Manual backup created: ${filename}`);

                return { filename, filepath, size: backupContent.length };
            } catch (manualError) {
                console.error('❌ Manual backup failed:', manualError);
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

            console.log('✅ mysqldump backup created successfully');

            res.setHeader('Content-Type', 'application/sql');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            const fileContent = await fs.readFile(filepath, 'utf8');
            res.send(fileContent);

        } catch (mysqldumpError) {
            console.log('❌ mysqldump not available, using manual backup...');
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
        const status = global.disasterRecoverySystem.getSystemHealth();
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
        const result = await global.disasterRecoverySystem.setupBackupSchedule();
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
        const verificationResult = await global.disasterRecoverySystem.verifyBackupFile(backupPath, backupType);
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
        const restorationResult = await global.disasterRecoverySystem.testBackupRestoration(backupPath, testDatabase);
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
        const documentation = await global.disasterRecoverySystem.getDocumentation();
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
        const backupResult = await global.disasterRecoverySystem.createBackup(backupType);
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
        const backups = await global.disasterRecoverySystem.getBackupList();
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
        const verificationResult = await global.disasterRecoverySystem.verifyBackupById(backupId);
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
        const testResult = await global.disasterRecoverySystem.testProcedure(procedureId);
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
        const procedures = await global.disasterRecoverySystem.getProcedures();
        res.json({ success: true, data: procedures });
    } catch (error) {
        return sendDatabaseError(res, error);
    }
};

// ES Module exports
export {
    // Helper functions (exported for potential reuse)
    calculateNextBackupDate,
    processSQLBackup,
    processZIPBackup,
    getFolderSize,
    
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

