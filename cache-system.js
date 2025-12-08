/**
 * CACHING SYSTEM
 * Phase 4: Redis Caching for Performance Optimization
 * Target: Cache hit ratio >80%, Reduce database load, Improve response time
 */

import dotenv from 'dotenv';
dotenv.config();

import Redis from 'ioredis';

class CacheSystem {
    constructor() {
        // Redis configuration from environment
        this.redisConfig = {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            db: parseInt(process.env.REDIS_DB) || 0,
            maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES) || 3,
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
            maxLoadingTimeout: 1000,
            lazyConnect: true
        };

        // Remove password if empty
        if (!this.redisConfig.password) {
            delete this.redisConfig.password;
        }

        this.redis = null;
        this.isConnected = false;
        this.cacheStats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };

        // Cache configuration
        this.cacheConfig = {
            // Dashboard analytics cache
            analytics: {
                ttl: 3600, // 1 hour
                prefix: 'analytics:'
            },
            // Schedule data cache
            schedules: {
                ttl: 7200, // 2 hours
                prefix: 'schedules:'
            },
            // Student list cache
            students: {
                ttl: 14400, // 4 hours
                prefix: 'students:'
            },
            // User session cache
            sessions: {
                ttl: 1800, // 30 minutes
                prefix: 'session:'
            },
            // Class data cache
            classes: {
                ttl: 14400, // 4 hours
                prefix: 'classes:'
            },
            // Teacher data cache
            teachers: {
                ttl: 14400, // 4 hours
                prefix: 'teachers:'
            },
            // Attendance data cache
            attendance: {
                ttl: 1800, // 30 minutes
                prefix: 'attendance:'
            }
        };
    }

    /**
     * Initialize cache system
     */
    async initialize() {
        console.log('🚀 Initializing Cache System...');
        
        try {
            // Initialize Redis connection
            await this.initializeRedis();
            
            console.log('✅ Cache System initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Cache system initialization failed:', error);
            // Don't throw error, continue without caching
            console.log('⚠️ Continuing without Redis caching...');
            return false;
        }
    }

    /**
     * Initialize Redis connection
     */
    async initializeRedis() {
        console.log('🔄 Connecting to Redis for caching...');
        
        try {
            this.redis = new Redis(this.redisConfig);
            
            // Test Redis connection
            await this.redis.ping();
            this.isConnected = true;
            console.log('✅ Redis connection established for caching');
            
            // Handle Redis connection events
            this.redis.on('error', (error) => {
                console.error('❌ Redis connection error:', error);
                this.isConnected = false;
            });
            
            this.redis.on('connect', () => {
                console.log('✅ Redis connected');
                this.isConnected = true;
            });
            
            this.redis.on('ready', () => {
                console.log('✅ Redis ready for caching');
                this.isConnected = true;
            });
            
            this.redis.on('close', () => {
                console.log('⚠️ Redis connection closed');
                this.isConnected = false;
            });
            
        } catch (error) {
            console.error('❌ Failed to connect to Redis:', error);
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * Get data from cache
     */
    async get(key, category = 'default') {
        if (!this.isConnected) {
            this.cacheStats.misses++;
            return null;
        }

        try {
            const cacheKey = this.buildCacheKey(key, category);
            const data = await this.redis.get(cacheKey);
            
            if (data) {
                this.cacheStats.hits++;
                console.log(`✅ Cache hit: ${cacheKey}`);
                return JSON.parse(data);
            } else {
                this.cacheStats.misses++;
                console.log(`❌ Cache miss: ${cacheKey}`);
                return null;
            }
            
        } catch (error) {
            console.error('❌ Cache get error:', error);
            this.cacheStats.misses++;
            return null;
        }
    }

    /**
     * Set data in cache
     */
    async set(key, data, category = 'default', customTtl = null) {
        if (!this.isConnected) {
            return false;
        }

        try {
            const cacheKey = this.buildCacheKey(key, category);
            const ttl = customTtl || this.getTtlForCategory(category);
            
            await this.redis.setex(cacheKey, ttl, JSON.stringify(data));
            this.cacheStats.sets++;
            
            console.log(`✅ Cache set: ${cacheKey} (TTL: ${ttl}s)`);
            return true;
            
        } catch (error) {
            console.error('❌ Cache set error:', error);
            return false;
        }
    }

    /**
     * Delete data from cache
     */
    async delete(key, category = 'default') {
        if (!this.isConnected) {
            return false;
        }

        try {
            const cacheKey = this.buildCacheKey(key, category);
            const result = await this.redis.del(cacheKey);
            this.cacheStats.deletes++;
            
            console.log(`✅ Cache delete: ${cacheKey}`);
            return result > 0;
            
        } catch (error) {
            console.error('❌ Cache delete error:', error);
            return false;
        }
    }

    /**
     * Delete multiple keys with pattern
     */
    async deletePattern(pattern, category = 'default') {
        if (!this.isConnected) {
            return false;
        }

        try {
            const cachePattern = this.buildCacheKey(pattern, category);
            const keys = await this.redis.keys(cachePattern);
            
            if (keys.length > 0) {
                await this.redis.del(...keys);
                this.cacheStats.deletes += keys.length;
                console.log(`✅ Cache delete pattern: ${cachePattern} (${keys.length} keys)`);
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Cache delete pattern error:', error);
            return false;
        }
    }

    /**
     * Check if key exists in cache
     */
    async exists(key, category = 'default') {
        if (!this.isConnected) {
            return false;
        }

        try {
            const cacheKey = this.buildCacheKey(key, category);
            const result = await this.redis.exists(cacheKey);
            return result === 1;
            
        } catch (error) {
            console.error('❌ Cache exists error:', error);
            return false;
        }
    }

    /**
     * Get or set data with fallback function
     */
    async getOrSet(key, fallbackFunction, category = 'default', customTtl = null) {
        // Try to get from cache first
        let data = await this.get(key, category);
        
        if (data !== null) {
            return data;
        }
        
        // If not in cache, execute fallback function
        try {
            data = await fallbackFunction();
            
            // Store in cache
            if (data !== null && data !== undefined) {
                await this.set(key, data, category, customTtl);
            }
            
            return data;
            
        } catch (error) {
            console.error('❌ Fallback function error:', error);
            throw error;
        }
    }

    /**
     * Cache analytics data
     */
    async cacheAnalytics(userId, userRole, analyticsData) {
        const key = `${userRole}:${userId}`;
        return await this.set(key, analyticsData, 'analytics');
    }

    /**
     * Get cached analytics data
     */
    async getCachedAnalytics(userId, userRole) {
        const key = `${userRole}:${userId}`;
        return await this.get(key, 'analytics');
    }

    /**
     * Cache schedule data
     */
    async cacheSchedules(guruId, scheduleData) {
        const key = `guru:${guruId}`;
        return await this.set(key, scheduleData, 'schedules');
    }

    /**
     * Get cached schedule data
     */
    async getCachedSchedules(guruId) {
        const key = `guru:${guruId}`;
        return await this.get(key, 'schedules');
    }

    /**
     * Cache student list by class
     */
    async cacheStudentsByClass(kelasId, studentsData) {
        const key = `kelas:${kelasId}`;
        return await this.set(key, studentsData, 'students');
    }

    /**
     * Get cached student list by class
     */
    async getCachedStudentsByClass(kelasId) {
        const key = `kelas:${kelasId}`;
        return await this.get(key, 'students');
    }

    /**
     * Cache user session
     */
    async cacheUserSession(sessionId, sessionData) {
        const key = sessionId;
        return await this.set(key, sessionData, 'sessions');
    }

    /**
     * Get cached user session
     */
    async getCachedUserSession(sessionId) {
        const key = sessionId;
        return await this.get(key, 'sessions');
    }

    /**
     * Delete user session
     */
    async deleteUserSession(sessionId) {
        const key = sessionId;
        return await this.delete(key, 'sessions');
    }

    /**
     * Cache class data
     */
    async cacheClasses(classesData) {
        const key = 'all';
        return await this.set(key, classesData, 'classes');
    }

    /**
     * Get cached class data
     */
    async getCachedClasses() {
        const key = 'all';
        return await this.get(key, 'classes');
    }

    /**
     * Cache teacher data
     */
    async cacheTeachers(teachersData) {
        const key = 'all';
        return await this.set(key, teachersData, 'teachers');
    }

    /**
     * Get cached teacher data
     */
    async getCachedTeachers() {
        const key = 'all';
        return await this.get(key, 'teachers');
    }

    /**
     * Cache attendance data
     */
    async cacheAttendance(date, kelasId, attendanceData) {
        const key = `${date}:${kelasId}`;
        return await this.set(key, attendanceData, 'attendance');
    }

    /**
     * Get cached attendance data
     */
    async getCachedAttendance(date, kelasId) {
        const key = `${date}:${kelasId}`;
        return await this.get(key, 'attendance');
    }

    /**
     * Invalidate attendance cache for a specific date/class
     */
    async invalidateAttendanceCache(date, kelasId) {
        const key = `${date}:${kelasId}`;
        return await this.delete(key, 'attendance');
    }

    /**
     * Invalidate all attendance cache
     */
    async invalidateAllAttendanceCache() {
        return await this.deletePattern('*', 'attendance');
    }

    /**
     * Warm up cache with frequently accessed data
     */
    async warmUpCache(databasePool) {
        console.log('🔥 Warming up cache...');
        
        try {
            // Cache classes
            const [classes] = await databasePool.execute('SELECT * FROM kelas WHERE status = "aktif"');
            await this.cacheClasses(classes);
            console.log(`✅ Cached ${classes.length} classes`);
            
            // Cache teachers
            const [teachers] = await databasePool.execute('SELECT * FROM guru WHERE status = "aktif"');
            await this.cacheTeachers(teachers);
            console.log(`✅ Cached ${teachers.length} teachers`);
            
            // Cache students by class
            const [classList] = await databasePool.execute('SELECT DISTINCT kelas_id FROM siswa WHERE status = "aktif"');
            
            for (const cls of classList) {
                const [students] = await databasePool.execute(
                    'SELECT * FROM siswa WHERE kelas_id = ? AND status = "aktif"',
                    [cls.kelas_id]
                );
                await this.cacheStudentsByClass(cls.kelas_id, students);
            }
            
            console.log(`✅ Cached students for ${classList.length} classes`);
            
            console.log('✅ Cache warm-up completed');
            
        } catch (error) {
            console.error('❌ Cache warm-up failed:', error);
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStatistics() {
        const total = this.cacheStats.hits + this.cacheStats.misses;
        const hitRatio = total > 0 ? (this.cacheStats.hits / total * 100).toFixed(2) : 0;
        
        return {
            ...this.cacheStats,
            hitRatio: `${hitRatio}%`,
            isConnected: this.isConnected,
            totalRequests: total
        };
    }

    /**
     * Reset cache statistics
     */
    resetCacheStatistics() {
        this.cacheStats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
        console.log('✅ Cache statistics reset');
    }

    /**
     * Get Redis info
     */
    async getRedisInfo() {
        if (!this.isConnected) {
            return null;
        }

        try {
            const info = await this.redis.info();
            return info;
        } catch (error) {
            console.error('❌ Failed to get Redis info:', error);
            return null;
        }
    }

    /**
     * Build cache key with prefix
     */
    buildCacheKey(key, category) {
        const config = this.cacheConfig[category] || this.cacheConfig.analytics;
        return `${config.prefix}${key}`;
    }

    /**
     * Get TTL for category
     */
    getTtlForCategory(category) {
        const config = this.cacheConfig[category] || this.cacheConfig.analytics;
        return config.ttl;
    }

    /**
     * Close Redis connection
     */
    async close() {
        if (this.redis) {
            await this.redis.quit();
            this.isConnected = false;
            console.log('✅ Cache system Redis connection closed');
        }
    }
}

// Export for use in other modules
export default CacheSystem;

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const cacheSystem = new CacheSystem();
    
    try {
        await cacheSystem.initialize();
        
        if (cacheSystem.isConnected) {
            // Test basic cache operations
            console.log('🧪 Testing cache operations...');
            
            // Test set and get
            await cacheSystem.set('test-key', { message: 'Hello Cache!' }, 'analytics');
            const data = await cacheSystem.get('test-key', 'analytics');
            console.log('📦 Cached data:', data);
            
            // Test cache statistics
            const stats = cacheSystem.getCacheStatistics();
            console.log('📊 Cache statistics:', stats);
            
            // Test cache with TTL
            await cacheSystem.set('ttl-test', { expires: 'soon' }, 'sessions', 10);
            console.log('⏰ Set data with 10s TTL');
            
            // Wait and check
            await new Promise(resolve => setTimeout(resolve, 2000));
            const ttlData = await cacheSystem.get('ttl-test', 'sessions');
            console.log('⏰ Data after 2s:', ttlData);
            
            await cacheSystem.close();
            console.log('🎉 Cache system test completed successfully!');
        } else {
            console.log('⚠️ Redis not available, cache system running in no-op mode');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('💥 Cache system test failed:', error);
        process.exit(1);
    }
}
