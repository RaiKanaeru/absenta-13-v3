/**
 * Query Optimizer & Stored Procedures System
 * Handles query optimization, prepared statements, and performance monitoring
 */

import mysql from 'mysql2/promise';

class QueryOptimizer {
    constructor(pool) {
        this.pool = pool;
        this.preparedStatements = new Map();
        this.queryCache = new Map();
        this.queryStats = new Map();
        
        console.log('🔍 Query Optimizer initialized');
    }
    
    /**
     * Initialize query optimizer
     */
    async initialize() {
        try {
            // Skip stored procedures and prepared statements for MySQL2 compatibility
            console.log('✅ Query Optimizer initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Query Optimizer:', error);
            throw error;
        }
    }
    
    /**
     * Create stored procedures for common queries
     */
    async createStoredProcedures() {
        const procedures = [
            // Get student attendance for date range
            `CREATE PROCEDURE IF NOT EXISTS GetStudentAttendance(
                IN p_start_date DATE,
                IN p_end_date DATE,
                IN p_siswa_id INT
            )
            BEGIN
                SELECT 
                    a.id,
                    a.siswa_id,
                    a.jadwal_id,
                    a.tanggal,
                    a.waktu_absen,
                    a.status,
                    a.keterangan,
                    s.nama_siswa,
                    k.nama_kelas,
                    j.jam_mulai,
                    j.jam_selesai,
                    mp.nama_mapel
                FROM absensi_siswa a
                JOIN siswa s ON a.siswa_id = s.id
                JOIN jadwal j ON a.jadwal_id = j.id
                JOIN kelas k ON j.kelas_id = k.id
                JOIN mata_pelajaran mp ON j.mapel_id = mp.id
                WHERE a.tanggal BETWEEN p_start_date AND p_end_date
                AND (p_siswa_id IS NULL OR a.siswa_id = p_siswa_id)
                ORDER BY a.tanggal DESC, a.waktu_absen DESC;
            END`,
            
            // Get teacher attendance for date range
            `CREATE PROCEDURE IF NOT EXISTS GetTeacherAttendance(
                IN p_start_date DATE,
                IN p_end_date DATE,
                IN p_guru_id INT
            )
            BEGIN
                SELECT 
                    a.id,
                    a.guru_id,
                    a.jadwal_id,
                    a.tanggal,
                    a.waktu_absen,
                    a.status,
                    a.keterangan,
                    g.nama_guru,
                    k.nama_kelas,
                    j.jam_mulai,
                    j.jam_selesai,
                    mp.nama_mapel
                FROM absensi_guru a
                JOIN guru g ON a.guru_id = g.id
                JOIN jadwal j ON a.jadwal_id = j.id
                JOIN kelas k ON j.kelas_id = k.id
                JOIN mata_pelajaran mp ON j.mapel_id = mp.id
                WHERE a.tanggal BETWEEN p_start_date AND p_end_date
                AND (p_guru_id IS NULL OR a.guru_id = p_guru_id)
                ORDER BY a.tanggal DESC, a.waktu_absen DESC;
            END`,
            
            // Get attendance analytics
            `CREATE PROCEDURE IF NOT EXISTS GetAttendanceAnalytics(
                IN p_start_date DATE,
                IN p_end_date DATE,
                IN p_kelas_id INT
            )
            BEGIN
                SELECT 
                    DATE(a.tanggal) as tanggal,
                    COUNT(*) as total_absensi,
                    SUM(CASE WHEN a.status = 'hadir' THEN 1 ELSE 0 END) as hadir,
                    SUM(CASE WHEN a.status = 'izin' THEN 1 ELSE 0 END) as izin,
                    SUM(CASE WHEN a.status = 'sakit' THEN 1 ELSE 0 END) as sakit,
                    SUM(CASE WHEN a.status = 'alpa' THEN 1 ELSE 0 END) as alpa,
                    ROUND(
                        (SUM(CASE WHEN a.status = 'hadir' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
                    ) as persentase_hadir
                FROM absensi_siswa a
                JOIN jadwal j ON a.jadwal_id = j.id
                WHERE a.tanggal BETWEEN p_start_date AND p_end_date
                AND (p_kelas_id IS NULL OR j.kelas_id = p_kelas_id)
                GROUP BY DATE(a.tanggal)
                ORDER BY tanggal DESC;
            END`,
            
            // Get permission requests
            `CREATE PROCEDURE IF NOT EXISTS GetPermissionRequests(
                IN p_start_date DATE,
                IN p_end_date DATE,
                IN p_status VARCHAR(20)
            )
            BEGIN
                SELECT 
                    p.id,
                    p.siswa_id,
                    p.tanggal_pengajuan,
                    p.tanggal_izin,
                    p.keterangan_siswa,
                    p.keterangan_guru,
                    p.status,
                    p.tanggal_respon,
                    s.nama_siswa,
                    k.nama_kelas
                FROM pengajuan_banding_absen p
                JOIN siswa s ON p.siswa_id = s.id
                JOIN kelas k ON s.kelas_id = k.id
                WHERE p.tanggal_pengajuan BETWEEN p_start_date AND p_end_date
                AND (p_status IS NULL OR p.status = p_status)
                ORDER BY p.tanggal_pengajuan DESC;
            END`,
            
            // Get class schedule
            `CREATE PROCEDURE IF NOT EXISTS GetClassSchedule(
                IN p_kelas_id INT,
                IN p_hari VARCHAR(10)
            )
            BEGIN
                SELECT 
                    j.id,
                    j.kelas_id,
                    j.mapel_id,
                    j.hari,
                    j.jam_mulai,
                    j.jam_selesai,
                    k.nama_kelas,
                    mp.nama_mapel,
                    g.nama_guru
                FROM jadwal j
                JOIN kelas k ON j.kelas_id = k.id
                JOIN mata_pelajaran mp ON j.mapel_id = mp.id
                LEFT JOIN guru g ON j.guru_id = g.id
                WHERE j.kelas_id = p_kelas_id
                AND (p_hari IS NULL OR j.hari = p_hari)
                ORDER BY j.jam_mulai;
            END`
        ];
        
        for (const procedure of procedures) {
            try {
                await this.pool.execute(procedure);
            } catch (error) {
                console.error('Error creating stored procedure:', error);
                // Continue with other procedures
            }
        }
    }
    
    /**
     * Prepare common statements
     */
    async prepareCommonStatements() {
        const statements = [
            {
                name: 'insert_student_attendance',
                sql: `INSERT INTO absensi_siswa (siswa_id, jadwal_id, tanggal, waktu_absen, status, keterangan) 
                      VALUES (?, ?, ?, ?, ?, ?)`
            },
            {
                name: 'insert_teacher_attendance',
                sql: `INSERT INTO absensi_guru (guru_id, jadwal_id, tanggal, waktu_absen, status, keterangan) 
                      VALUES (?, ?, ?, ?, ?, ?)`
            },
            {
                name: 'update_permission_request',
                sql: `UPDATE pengajuan_banding_absen 
                      SET status = ?, keterangan_guru = ?, tanggal_respon = ? 
                      WHERE id = ?`
            },
            {
                name: 'get_student_by_id',
                sql: `SELECT s.*, k.nama_kelas 
                      FROM siswa s 
                      JOIN kelas k ON s.kelas_id = k.id 
                      WHERE s.id = ?`
            },
            {
                name: 'get_teacher_by_id',
                sql: `SELECT * FROM guru WHERE id = ?`
            },
            {
                name: 'get_schedule_by_class_date',
                sql: `SELECT j.*, k.nama_kelas, mp.nama_mapel, g.nama_guru
                      FROM jadwal j
                      JOIN kelas k ON j.kelas_id = k.id
                      JOIN mata_pelajaran mp ON j.mapel_id = mp.id
                      LEFT JOIN guru g ON j.guru_id = g.id
                      WHERE j.kelas_id = ? AND j.hari = ?`
            }
        ];
        
        for (const stmt of statements) {
            try {
                const prepared = await this.pool.prepare(stmt.sql);
                this.preparedStatements.set(stmt.name, prepared);
            } catch (error) {
                console.error(`Error preparing statement ${stmt.name}:`, error);
            }
        }
    }
    
    /**
     * Execute stored procedure
     */
    async executeProcedure(procedureName, params = []) {
        const startTime = performance.now();
        
        try {
            const [rows] = await this.pool.execute(`CALL ${procedureName}(${params.map(() => '?').join(', ')})`, params);
            const endTime = performance.now();
            
            this.recordQueryStats(procedureName, endTime - startTime, true);
            
            return rows[0]; // MySQL returns results in first array element
        } catch (error) {
            const endTime = performance.now();
            this.recordQueryStats(procedureName, endTime - startTime, false);
            throw error;
        }
    }
    
    /**
     * Execute prepared statement (using regular execute for MySQL2 compatibility)
     */
    async executePrepared(statementName, params = []) {
        const startTime = performance.now();
        
        try {
            // Use regular execute instead of prepared statements for MySQL2 compatibility
            const [rows] = await this.pool.execute(statementName, params);
            const endTime = performance.now();
            
            this.recordQueryStats(statementName, endTime - startTime, true);
            
            return rows;
        } catch (error) {
            const endTime = performance.now();
            this.recordQueryStats(statementName, endTime - startTime, false);
            throw error;
        }
    }
    
    /**
     * Execute query with caching
     */
    async executeCachedQuery(query, params = [], cacheKey = null, ttl = 300000) { // 5 minutes default
        const startTime = performance.now();
        
        // Generate cache key if not provided
        if (!cacheKey) {
            cacheKey = this.generateCacheKey(query, params);
        }
        
        // Check cache first
        const cached = this.queryCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < ttl) {
            this.recordQueryStats(`cached_${cacheKey}`, performance.now() - startTime, true);
            return cached.data;
        }
        
        try {
            const [rows] = await this.pool.execute(query, params);
            const endTime = performance.now();
            
            // Cache the result
            this.queryCache.set(cacheKey, {
                data: rows,
                timestamp: Date.now()
            });
            
            this.recordQueryStats(query, endTime - startTime, true);
            
            return rows;
        } catch (error) {
            const endTime = performance.now();
            this.recordQueryStats(query, endTime - startTime, false);
            throw error;
        }
    }
    
    /**
     * Set system monitor
     */
    setSystemMonitor(monitor) {
        this.systemMonitor = monitor;
    }

    /**
     * Record query statistics
     */
    recordQueryStats(queryName, executionTime, success) {
        if (!this.queryStats.has(queryName)) {
            this.queryStats.set(queryName, {
                count: 0,
                totalTime: 0,
                averageTime: 0,
                minTime: Infinity,
                maxTime: 0,
                successCount: 0,
                failureCount: 0
            });
        }
        
        const stats = this.queryStats.get(queryName);
        stats.count++;
        stats.totalTime += executionTime;
        stats.averageTime = stats.totalTime / stats.count;
        stats.minTime = Math.min(stats.minTime, executionTime);
        stats.maxTime = Math.max(stats.maxTime, executionTime);
        
        if (success) {
            stats.successCount++;
        } else {
            stats.failureCount++;
        }

        // Report to system monitor if available
        if (this.systemMonitor) {
            this.systemMonitor.recordQuery(executionTime, success);
        }
    }
    
    /**
     * Generate cache key
     */
    generateCacheKey(query, params) {
        return `query_${Buffer.from(query + JSON.stringify(params)).toString('base64')}`;
    }
    
    /**
     * Get query statistics
     */
    getQueryStats() {
        const stats = {};
        for (const [queryName, queryStats] of this.queryStats) {
            stats[queryName] = { ...queryStats };
        }
        return stats;
    }
    
    /**
     * Clear query cache
     */
    clearCache() {
        this.queryCache.clear();
        console.log('🧹 Query cache cleared');
    }
    
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.queryCache.size,
            entries: Array.from(this.queryCache.keys())
        };
    }
    
    /**
     * Analyze query performance
     */
    async analyzeQuery(query, params = []) {
        try {
            const explainQuery = `EXPLAIN ANALYZE ${query}`;
            const [rows] = await this.pool.execute(explainQuery, params);
            return rows;
        } catch (error) {
            console.error('Error analyzing query:', error);
            return null;
        }
    }
    
    /**
     * Cleanup resources
     */
    async cleanup() {
        // Clear caches and stats
        this.preparedStatements.clear();
        this.queryCache.clear();
        this.queryStats.clear();
        
        console.log('🧹 Query Optimizer cleaned up');
    }
}

export default QueryOptimizer;
