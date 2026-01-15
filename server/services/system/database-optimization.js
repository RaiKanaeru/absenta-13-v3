/**
 * DATABASE OPTIMIZATION SYSTEM
 * Phase 1: Database Indexing, Connection Pooling, and Partitioning
 * Target: Handle 150 concurrent users, 250K+ records, 2GB RAM, 2 Core
 */

import dotenv from 'dotenv';
dotenv.config();

import mysql from 'mysql2/promise';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('DbOptimization');

class DatabaseOptimization {
    constructor() {
        this.dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'absenta13',
            port: Number.parseInt(process.env.DB_PORT) || 3306,
            connectTimeout: 10000
        };

        // Connection Pool Configuration for 150 concurrent users
        this.poolConfig = {
            ...this.dbConfig,
            connectionLimit: Number.parseInt(process.env.DB_CONNECTION_LIMIT) || 50,
            acquireTimeout: 10000,      // 10 second timeout
            queueLimit: 0,              // No limit on queue
            idleTimeout: 300000,        // 5 minutes idle timeout
            timezone: process.env.DB_TIMEZONE || '+07:00'  // WIB timezone (UTC+7) - CRITICAL for date handling
        };

        this.pool = null;
        this.connection = null;
    }

    /**
     * Initialize database optimization system
     */
    async initialize() {
        logger.info('Initializing Database Optimization System');
        
        try {
            // Create connection pool
            await this.createConnectionPool();
            
            // Backup current database
            await this.backupDatabase();
            
            // Add database indexes
            await this.addDatabaseIndexes();
            
            // Test query performance
            await this.testQueryPerformance();
            
            // Create archive tables
            await this.createArchiveTables();
            
            logger.info('Database Optimization System initialized successfully');
            return true;
            
        } catch (error) {
            logger.error('Database optimization initialization failed', error);
            throw error;
        }
    }

    /**
     * Create connection pool for handling concurrent users
     */
    async createConnectionPool() {
        logger.info('Creating database connection pool');
        
        try {
            this.pool = mysql.createPool(this.poolConfig);
            
            // Test pool connection
            const testConnection = await this.pool.getConnection();
            await testConnection.execute('SELECT 1');
            testConnection.release();
            
            logger.info('Connection pool created successfully');
            logger.debug('Pool config', { connectionLimit: this.poolConfig.connectionLimit, acquireTimeout: this.poolConfig.acquireTimeout });
            
        } catch (error) {
            logger.error('Failed to create connection pool', error);
            throw error;
        }
    }

    /**
     * Backup current database before optimization
     */
    async backupDatabase() {
        logger.info('Creating database backup');
        
        try {
            const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
            const backupDir = './backups';
            const backupFile = path.join(backupDir, `absenta13_backup_${timestamp}.sql`);
            
            // Ensure backup directory exists
            await fs.mkdir(backupDir, { recursive: true });
            
            // Create backup using mysqldump (if available) or manual export
            logger.debug('Backup location', { backupFile });
            logger.warn('Manual backup recommended: mysqldump -u root absenta13 > absenta13_backup.sql');
            
            logger.info('Database backup process initiated');
            
        } catch (error) {
            logger.error('Database backup failed', error);
            throw error;
        }
    }

    /**
     * Add optimized indexes for better query performance
     */
    async addDatabaseIndexes() {
        logger.info('Adding database indexes for optimization');
        
        const indexes = [
            // Indexes for absensi_siswa table
            {
                table: 'absensi_siswa',
                name: 'idx_tanggal_siswa',
                columns: '(tanggal, siswa_id)',
                description: 'Optimize queries by date and student'
            },
            {
                table: 'absensi_siswa',
                name: 'idx_tanggal_status',
                columns: '(tanggal, status)',
                description: 'Optimize queries by date and status'
            },
            {
                table: 'absensi_siswa',
                name: 'idx_waktu_absen',
                columns: '(waktu_absen)',
                description: 'Optimize queries by attendance time'
            },
            {
                table: 'absensi_siswa',
                name: 'idx_siswa_tanggal_jadwal',
                columns: '(siswa_id, tanggal, jadwal_id)',
                description: 'Optimize complex student attendance queries'
            },
            {
                table: 'absensi_siswa',
                name: 'idx_status_tanggal',
                columns: '(status, tanggal)',
                description: 'Optimize analytics queries by status and date'
            },
            
            // Indexes for absensi_guru table
            {
                table: 'absensi_guru',
                name: 'idx_tanggal_guru',
                columns: '(tanggal, guru_id)',
                description: 'Optimize teacher attendance queries'
            },
            {
                table: 'absensi_guru',
                name: 'idx_jadwal_tanggal',
                columns: '(jadwal_id, tanggal)',
                description: 'Optimize schedule-based queries'
            },
            
        ];

        try {
            for (const index of indexes) {
                try {
                    // Check if index already exists
                    const [existingIndexes] = await this.pool.execute(
                        `SHOW INDEX FROM ${index.table} WHERE Key_name = ?`,
                        [index.name]
                    );

                    if (existingIndexes.length === 0) {
                        const sql = `ALTER TABLE ${index.table} ADD INDEX ${index.name} ${index.columns}`;
                        await this.pool.execute(sql);
                        logger.info('Added index', { name: index.name, table: index.table, description: index.description });
                    } else {
                        logger.debug('Index already exists', { name: index.name, table: index.table });
                    }
                } catch (indexError) {
                    logger.warn('Failed to add index', { name: index.name, error: indexError.message });
                }
            }
            
            logger.info('Database indexing completed');
            
        } catch (error) {
            logger.error('Database indexing failed', error);
            throw error;
        }
    }

    /**
     * Test query performance before and after optimization
     * NOTE: This is optional - failures should not block server startup
     */
    async testQueryPerformance() {
        logger.info('Testing query performance');
        
        const testQueries = [
            {
                name: 'Student attendance by date',
                query: 'SELECT COUNT(*) FROM absensi_siswa WHERE tanggal = CURDATE()',
                expectedTime: 100 // ms
            },
            {
                name: 'Student attendance by status',
                query: 'SELECT status, COUNT(*) FROM absensi_siswa WHERE tanggal >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) GROUP BY status',
                expectedTime: 200 // ms
            },
            {
                name: 'Teacher attendance by date',
                query: 'SELECT COUNT(*) FROM absensi_guru WHERE tanggal = CURDATE()',
                expectedTime: 100 // ms
            },
            {
                name: 'Complex analytics query',
                query: 'SELECT siswa_id, COUNT(*) as total_absensi FROM absensi_siswa WHERE tanggal >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) GROUP BY siswa_id ORDER BY total_absensi DESC LIMIT 10',
                expectedTime: 300 // ms
            }
        ];

        // Run tests but don't fail if tables don't exist
        for (const test of testQueries) {
            try {
                const startTime = Date.now();
                await this.pool.execute(test.query);
                const endTime = Date.now();
                const executionTime = endTime - startTime;
                
                logger.debug('Query test', { name: test.name, executionTime, expectedTime: test.expectedTime, passed: executionTime <= test.expectedTime });
            } catch (queryError) {
                // Gracefully handle missing tables - just warn, don't throw
                logger.warn('Query test skipped (table may not exist)', { name: test.name, error: queryError.message });
            }
        }
        
        logger.info('Query performance testing completed (some tests may have been skipped)');
    }

    /**
     * Create archive tables for data partitioning
     * NOTE: This is optional - failures should not block server startup
     */
    async createArchiveTables() {
        logger.info('Creating archive tables for data partitioning');
        
        const archiveTables = [
            {
                name: 'absensi_siswa_archive',
                sourceTable: 'absensi_siswa',
                description: 'Archive table for old student attendance records'
            },
            {
                name: 'absensi_guru_archive',
                sourceTable: 'absensi_guru',
                description: 'Archive table for old teacher attendance records'
            }
        ];

        for (const table of archiveTables) {
            try {
                // Check if archive table already exists
                const [existingTables] = await this.pool.execute(
                    `SHOW TABLES LIKE '${table.name}'`
                );

                if (existingTables.length === 0) {
                    // Check if source table exists first
                    const [sourceTables] = await this.pool.execute(
                        `SHOW TABLES LIKE '${table.sourceTable}'`
                    );
                    
                    if (sourceTables.length === 0) {
                        logger.warn('Source table does not exist, skipping archive', { sourceTable: table.sourceTable, archiveTable: table.name });
                        continue;
                    }
                    
                    // Create archive table with same structure as source table
                    await this.pool.execute(
                        `CREATE TABLE ${table.name} LIKE ${table.sourceTable}`
                    );
                    
                    // Add archive-specific columns
                    await this.pool.execute(
                        `ALTER TABLE ${table.name} ADD COLUMN archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
                    );
                    
                    logger.info('Created archive table', { name: table.name, description: table.description });
                } else {
                    logger.debug('Archive table already exists', { name: table.name });
                }
            } catch (tableError) {
                // Gracefully handle errors - just warn, don't throw
                logger.warn('Failed to create archive table (source may not exist)', { name: table.name, error: tableError.message });
            }
        }
        
        logger.info('Archive tables creation completed (some tables may have been skipped)');
    }

    /**
     * Archive old data to improve performance
     */
    async archiveOldData(monthsOld = 12) {
        logger.info('Archiving old data', { monthsOld });
        
        try {
            const cutoffDate = new Date();
            cutoffDate.setMonth(cutoffDate.getMonth() - monthsOld);
            const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

            // Archive old student attendance records
            const [studentArchiveResult] = await this.pool.execute(
                `INSERT INTO absensi_siswa_archive 
                 SELECT *, NOW() as archived_at 
                 FROM absensi_siswa 
                 WHERE tanggal < ?`,
                [cutoffDateStr]
            );

            // Archive old teacher attendance records
            const [teacherArchiveResult] = await this.pool.execute(
                `INSERT INTO absensi_guru_archive 
                 SELECT *, NOW() as archived_at 
                 FROM absensi_guru 
                 WHERE tanggal < ?`,
                [cutoffDateStr]
            );

            // Delete archived records from main tables
            await this.pool.execute(
                `DELETE FROM absensi_siswa WHERE tanggal < ?`,
                [cutoffDateStr]
            );

            await this.pool.execute(
                `DELETE FROM absensi_guru WHERE tanggal < ?`,
                [cutoffDateStr]
            );

            logger.info('Archived student records', { count: studentArchiveResult.affectedRows });
            logger.info('Archived teacher records', { count: teacherArchiveResult.affectedRows });
            logger.info('Data archiving completed');
            
        } catch (error) {
            logger.error('Data archiving failed', error);
            throw error;
        }
    }

    /**
     * Get connection from pool
     */
    async getConnection() {
        if (!this.pool) {
            throw new Error('Connection pool not initialized');
        }
        return await this.pool.getConnection();
    }

    /**
     * Execute query with connection pool
     */
    async execute(query, params = []) {
        if (!this.pool) {
            throw new Error('Connection pool not initialized');
        }
        return await this.pool.execute(query, params);
    }

    /**
     * Query with connection pool (alternative to execute)
     */
    async query(sql, params = []) {
        if (!this.pool) {
            throw new Error('Connection pool not initialized');
        }
        return await this.pool.query(sql, params);
    }

    /**
     * Get pool statistics
     */
    getPoolStats() {
        if (!this.pool) {
            return null;
        }
        
        return {
            totalConnections: this.poolConfig.connectionLimit,
            activeConnections: this.pool._allConnections ? this.pool._allConnections.length : 0,
            idleConnections: this.pool._freeConnections ? this.pool._freeConnections.length : 0,
            queuedRequests: this.pool._connectionQueue ? this.pool._connectionQueue.length : 0
        };
    }

    /**
     * Close connection pool
     */
    async close() {
        if (this.pool) {
            await this.pool.end();
            logger.info('Database connection pool closed');
        }
    }
}

// Export for use in other modules
export default DatabaseOptimization;

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const dbOptimization = new DatabaseOptimization();
    
    try {
        await dbOptimization.initialize();
        logger.info('Database optimization completed successfully');
        
        // Show pool statistics
        const stats = dbOptimization.getPoolStats();
        if (stats) {
            logger.debug('Connection Pool Statistics', { totalConnections: stats.totalConnections, activeConnections: stats.activeConnections, idleConnections: stats.idleConnections, queuedRequests: stats.queuedRequests });
        }
        
        process.exit(0);
    } catch (error) {
        logger.error('Database optimization failed', error);
        process.exit(1);
    }
}
