import path from 'node:path';
import fs from 'node:fs/promises';
import { createLogger } from '../utils/logger.js';
import { splitSqlStatements } from '../utils/sqlParser.js';
import { sendDatabaseError, sendValidationError, sendPermissionError } from '../utils/errorHandler.js';
import db from '../config/db.js';

const logger = createLogger('DatabaseFile');

// Safe directories
const DB_DIR = path.resolve(process.cwd(), 'database');
const SEEDER_DIR = path.resolve(process.cwd(), 'database/seeders');

const ALLOWED_DIRS = [DB_DIR, SEEDER_DIR];

/**
 * Validate and sanitize filename for security
 * @param {string} filename - Original filename from request
 * @returns {string|null} Safe filename or null if invalid
 */
const sanitizeFilename = (filename) => {
    const safeFilename = path.basename(filename);
    if (safeFilename !== filename) return null; // Path traversal detected
    if (!/^[a-zA-Z0-9._-]+$/.test(safeFilename)) return null; // Invalid chars
    return safeFilename;
};

/**
 * Resolve and validate target directory path
 * @param {string} pathType - Type of path (root/seeders)
 * @returns {string|null} Target directory or null if invalid
 */
const resolveTargetDir = (pathType) => {
    if (pathType === 'root') return DB_DIR;
    if (pathType === 'seeders') return SEEDER_DIR;
    return null;
};

/**
 * Check for blocked SQL patterns in content
 * @param {string} sqlContent - SQL content to check
 * @returns {string|null} Error message if blocked pattern found, null otherwise
 */
const checkBlockedSqlPatterns = (sqlContent) => {
    const BLOCKED_SQL_PATTERNS = [
        'drop database',
        'drop table',
        'truncate table',
        'truncate ',
    ];
    const lowerSql = sqlContent.toLowerCase();
    for (const pattern of BLOCKED_SQL_PATTERNS) {
        if (lowerSql.includes(pattern)) {
            return `Keamanan: ${pattern.trim().toUpperCase()} tidak diizinkan`;
        }
    }
    return null;
};

/**
 * List all SQL files in allowed directories
 */
export const listDatabaseFiles = async (req, res) => {
    try {
        const files = [];

        // 1. Scan DB_DIR (Root Dumps)
        try {
            const rootFiles = await fs.readdir(DB_DIR);
            for (const file of rootFiles) {
                if (file.endsWith('.sql')) {
                    const filePath = path.join(DB_DIR, file);
                    const stats = await fs.stat(filePath);
                    files.push({
                        name: file,
                        path: 'root',
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime,
                        type: 'dump' // Heuristic
                    });
                }
            }
        } catch (e) {
            logger.warn('Failed to read database dir', e.message);
        }

        // 2. Scan SEEDER_DIR (Seeders)
        try {
            const seedFiles = await fs.readdir(SEEDER_DIR);
            for (const file of seedFiles) {
                if (file.endsWith('.sql')) {
                    const filePath = path.join(SEEDER_DIR, file);
                    const stats = await fs.stat(filePath);
                    files.push({
                        name: file,
                        path: 'seeders',
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime,
                        type: 'seeder'
                    });
                }
            }
        } catch (e) {
            logger.warn('Failed to read seeders dir', e.message);
        }

        res.json({
            success: true,
            files: files.sort((a, b) => b.modified - a.modified) // Newest first
        });

    } catch (error) {
        logger.error('Error listing database files', error);
        return sendDatabaseError(res, error, 'Gagal memuat daftar file database');
    }
};

/**
 * Execute a specific SQL file
 */
export const executeDatabaseFile = async (req, res) => {
    const { filename, pathType } = req.body;

    if (!filename || !pathType) {
        return sendValidationError(res, 'Filename dan Path Type wajib diisi');
    }

    // Sanitize filename
    const safeFilename = sanitizeFilename(filename);
    if (!safeFilename) {
        return sendValidationError(res, 'Filename mengandung karakter ilegal');
    }

    // Resolve target directory
    const targetDir = resolveTargetDir(pathType);
    if (!targetDir) {
        return sendValidationError(res, 'Tipe path tidak valid');
    }

    const filePath = path.join(targetDir, safeFilename);

    // Security check: Ensure file is in target directory
    if (!filePath.startsWith(targetDir)) {
        return sendPermissionError(res, 'Akses ditolak: Path file tidak valid');
    }

    try {
        // Read file
        const sqlContent = await fs.readFile(filePath, 'utf8');
        const cleanSql = sqlContent.replace(/^\uFEFF/, ''); // Remove BOM
        
        if (!cleanSql.trim()) {
            return sendValidationError(res, 'File kosong');
        }

        // Check for blocked SQL patterns
        const blockedError = checkBlockedSqlPatterns(cleanSql);
        if (blockedError) {
            return sendPermissionError(res, blockedError);
        }

        // Execute
        const connection = await db.getConnection();
        let queryCount = 0;
        
        try {
             const commands = splitSqlStatements(cleanSql);
             if (commands.length === 0) {
                 return sendValidationError(res, 'Tidak ada perintah SQL yang dapat dieksekusi');
             }
             
             await connection.beginTransaction();
             for (const cmd of commands) {
                 if(cmd.trim()) {
                    await connection.query(cmd);
                    queryCount++;
                 }
             }
             await connection.commit();

        } catch (error_) {
            await connection.rollback();
            throw error_;
        } finally {
            connection.release();
        }

        logger.info(`Executed SQL file: ${filename} (${queryCount} queries)`);
        
        res.json({
            success: true,
            message: `Berhasil mengeksekusi ${filename}`,
            queries: queryCount
        });

    } catch (error) {
        logger.error('Error executing database file', error);
        return sendDatabaseError(res, error, 'Gagal mengeksekusi file database');
    }
};
