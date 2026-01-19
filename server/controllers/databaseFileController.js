import path from 'node:path';
import fs from 'node:fs/promises';
import { createLogger } from '../utils/logger.js';
import { splitSqlStatements } from '../utils/sqlParser.js';
import { sendDatabaseError, sendValidationError, sendPermissionError, sendSuccessResponse } from '../utils/errorHandler.js';

const logger = createLogger('DatabaseFile');

// Safe directories
const DB_DIR = path.resolve(process.cwd(), 'database');
const SEEDER_DIR = path.resolve(process.cwd(), 'database/seeders');

const ALLOWED_DIRS = [DB_DIR, SEEDER_DIR];

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

    let targetDir;
    if (pathType === 'root') targetDir = DB_DIR;
    else if (pathType === 'seeders') targetDir = SEEDER_DIR;
    else return sendValidationError(res, 'Tipe path tidak valid');

    const filePath = path.join(targetDir, filename);

    // Security check: Ensure file is actually in the directory (prevent ../)
    if (!filePath.startsWith(targetDir)) {
        return sendPermissionError(res, 'Akses ditolak: Path file tidak valid');
    }

    try {
        // Read file
        const sqlContent = await fs.readFile(filePath, 'utf8');
        
        // Remove BOM if present
        const cleanSql = sqlContent.replace(/^\uFEFF/, '');
        
        if (!cleanSql.trim()) {
            return sendValidationError(res, 'File kosong');
        }

        // Simple check for safety
        if (cleanSql.toLowerCase().includes('drop database')) {
             return sendPermissionError(res, 'Keamanan: DROP DATABASE tidak diizinkan');
        }

        // Execute
        const connection = await globalThis.dbPool.getConnection();
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
        return sendDatabaseError(res, error, `Gagal mengeksekusi: ${error.message}`);
    }
};
