import path from 'node:path';
import fs from 'node:fs/promises';
import { createLogger } from '../utils/logger.js';

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
        res.status(500).json({
            success: false,
            message: 'Gagal memuat daftar file database'
        });
    }
};

/**
 * Execute a specific SQL file
 */
export const executeDatabaseFile = async (req, res) => {
    const { filename, pathType } = req.body;

    if (!filename || !pathType) {
        return res.status(400).json({ success: false, message: 'Filename and Path Type required' });
    }

    let targetDir;
    if (pathType === 'root') targetDir = DB_DIR;
    else if (pathType === 'seeders') targetDir = SEEDER_DIR;
    else return res.status(400).json({ success: false, message: 'Invalid path type' });

    const filePath = path.join(targetDir, filename);

    // Security check: Ensure file is actually in the directory (prevent ../)
    if (!filePath.startsWith(targetDir)) {
        return res.status(403).json({ success: false, message: 'Access denied: Invalid file path' });
    }

    try {
        // Read file
        const sqlContent = await fs.readFile(filePath, 'utf8');
        
        // Remove BOM if present
        const cleanSql = sqlContent.replace(/^\uFEFF/, '');
        
        if (!cleanSql.trim()) {
            return res.status(400).json({ success: false, message: 'File is empty' });
        }

        // Simple check for safety
        if (cleanSql.toLowerCase().includes('drop database')) {
             return res.status(403).json({ success: false, message: 'Safety Block: DROP DATABASE is not allowed.' });
        }

        // Execute
        const connection = await globalThis.dbPool.getConnection();
        let queryCount = 0;
        
        try {
             // Split by semicolon, but handle simple cases only. 
             // Ideally we should use a proper parser or the mysql2 multipleStatements=true feature if enabled.
             // Assuming multipleStatements IS enabled for the pool (common for these apps), we can send it directly?
             // Actually, huge dumps often fail with single query call if too big. 
             // But for standard imports, client splitting is safer.
             
             // Strategy: Use the same logic as backupController's executeSqlCommands
             const commands = cleanSql.split(';').filter(cmd => cmd.trim());
             
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
        res.status(500).json({
            success: false,
            message: `Gagal mengeksekusi: ${error.message}`
        });
    }
};
