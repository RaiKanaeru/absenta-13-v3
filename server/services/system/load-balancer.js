/**
 * Load Balancer & Traffic Management System
 * Handles request prioritization, circuit breaker, and traffic management
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

class LoadBalancer extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            maxConcurrentRequests: options.maxConcurrentRequests || 150,
            burstThreshold: options.burstThreshold || 50,
            circuitBreakerThreshold: options.circuitBreakerThreshold || 10,
            circuitBreakerTimeout: options.circuitBreakerTimeout || 30000,
            requestTimeout: options.requestTimeout || 10000,
            priorityQueues: {
                critical: [], // Priority 1: POST absensi
                high: [],     // Priority 2: GET absensi data
                normal: [],   // Priority 3: GET analytics/reports
                low: []       // Priority 4: Other requests
            },
            ...options
        };
        
        // Initialize query cache and optimizer integration
        this.queryCache = new Map();
        this.queryStats = new Map();
        this.queryOptimizer = options.queryOptimizer || null;
        
        this.stats = {
            totalRequests: 0,
            activeRequests: 0,
            completedRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            circuitBreakerTrips: 0,
            burstDetections: 0,
            lastBurstTime: null
        };
        
        this.circuitBreaker = {
            isOpen: false,
            failureCount: 0,
            lastFailureTime: null,
            successCount: 0
        };
        
        this.requestHistory = [];
        this.isProcessing = false;
        
        // Start processing queue
        this.startQueueProcessor();
        
        console.log('🔄 Load Balancer initialized');
    }
    
    /**
     * Add request to priority queue
     */
    addRequest(request, priority = 'normal') {
        const requestId = this.generateRequestId();
        const requestData = {
            id: requestId,
            request,
            priority,
            timestamp: Date.now(),
            startTime: performance.now()
        };
        
        // Add to appropriate priority queue
        this.options.priorityQueues[priority].push(requestData);
        
        this.stats.totalRequests++;
        this.stats.activeRequests++;
        
        // Check for burst mode
        this.checkBurstMode();
        
        // Emit request added event
        this.emit('requestAdded', requestData);
        
        return requestId;
    }
    
    /**
     * Check if system is in burst mode
     */
    checkBurstMode() {
        const now = Date.now();
        const recentRequests = this.requestHistory.filter(
            req => now - req.timestamp < 60000 // Last minute
        );
        
        if (recentRequests.length >= this.options.burstThreshold) {
            this.stats.burstDetections++;
            this.stats.lastBurstTime = now;
            this.emit('burstDetected', {
                requestCount: recentRequests.length,
                threshold: this.options.burstThreshold
            });
            
            console.log(`🚨 Burst mode detected: ${recentRequests.length} requests in last minute`);
        }
    }
    
    /**
     * Start processing the request queue
     */
    startQueueProcessor() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        this.processQueue();
    }
    
    /**
     * Process requests from priority queues
     */
    async processQueue() {
        while (this.isProcessing) {
            try {
                // Check circuit breaker
                if (this.circuitBreaker.isOpen) {
                    if (Date.now() - this.circuitBreaker.lastFailureTime > this.options.circuitBreakerTimeout) {
                        this.resetCircuitBreaker();
                    } else {
                        await this.sleep(1000);
                        continue;
                    }
                }
                
                // Check if we can process more requests
                if (this.stats.activeRequests >= this.options.maxConcurrentRequests) {
                    await this.sleep(100);
                    continue;
                }
                
                // Get next request from priority queues
                const request = this.getNextRequest();
                if (!request) {
                    await this.sleep(100);
                    continue;
                }
                
                // Process request
                await this.processRequest(request);
                
            } catch (error) {
                console.error('Error in queue processor:', error);
                await this.sleep(1000);
            }
        }
    }
    
    /**
     * Get next request from priority queues
     */
    getNextRequest() {
        // Check queues in priority order
        const priorities = ['critical', 'high', 'normal', 'low'];
        
        for (const priority of priorities) {
            const queue = this.options.priorityQueues[priority];
            if (queue.length > 0) {
                return queue.shift();
            }
        }
        
        return null;
    }
    
    /**
     * Process individual request
     */
    async processRequest(requestData) {
        const { id, request, priority, startTime } = requestData;
        
        try {
            console.log(`🔄 Processing request ${id} (priority: ${priority})`);
            
            // Set timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout')), this.options.requestTimeout);
            });
            
            // Process request
            const requestPromise = this.executeRequest(request);
            
            // Race between request and timeout
            const result = await Promise.race([requestPromise, timeoutPromise]);
            
            // Record success
            this.recordSuccess(requestData, result);
            
            // Emit success event
            this.emit('requestCompleted', { id, result, priority });
            
        } catch (error) {
            // Record failure
            this.recordFailure(requestData, error);
            
            // Emit failure event
            this.emit('requestFailed', { id, error, priority });
            
            console.error(`❌ Request ${id} failed:`, error.message);
        }
    }
    
    /**
     * Execute the actual request with query caching
     */
    async executeRequest(request) {
        const startTime = performance.now();
        
        try {
            // Check if this is a database query request
            if (request.type === 'database_query' && this.queryOptimizer) {
                return await this.executeCachedQuery(request);
            }
            
            // For other request types, simulate processing
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve({ success: true, data: 'Request processed' });
                }, Math.random() * 1000 + 100); // Random delay 100-1100ms
            });
            
        } catch (error) {
            console.error('Error executing request:', error);
            throw error;
        }
    }
    
    /**
     * Execute cached database query
     */
    async executeCachedQuery(request) {
        const { query, params = [], cacheKey = null, ttl = 300000 } = request;
        const startTime = performance.now();
        
        // Generate cache key if not provided
        const finalCacheKey = cacheKey || this.generateQueryCacheKey(query, params);
        
        // Check cache first
        const cached = this.queryCache.get(finalCacheKey);
        if (cached && Date.now() - cached.timestamp < ttl) {
            this.recordQueryStats(`cached_${finalCacheKey}`, performance.now() - startTime, true);
            return { success: true, data: cached.data, fromCache: true };
        }
        
        try {
            // Execute query through query optimizer if available
            let result;
            if (this.queryOptimizer) {
                result = await this.queryOptimizer.executeCachedQuery(query, params, finalCacheKey, ttl);
            } else {
                // Fallback to direct execution
                result = await this.executeDirectQuery(query, params);
            }
            
            // Cache the result
            this.queryCache.set(finalCacheKey, {
                data: result,
                timestamp: Date.now()
            });
            
            this.recordQueryStats(query, performance.now() - startTime, true);
            
            return { success: true, data: result, fromCache: false };
            
        } catch (error) {
            this.recordQueryStats(query, performance.now() - startTime, false);
            throw error;
        }
    }
    
    /**
     * Execute direct database query (fallback)
     */
    async executeDirectQuery(query, params) {
        // This would connect to database directly if query optimizer is not available
        // For now, return mock data with proper structure
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({ 
                    message: 'Query executed directly', 
                    query: query.substring(0, 50) + '...',
                    params,
                    timestamp: new Date().toISOString(),
                    executionTime: Math.random() * 100 + 50 // 50-150ms
                });
            }, Math.random() * 200 + 100); // 100-300ms delay
        });
    }
    
    /**
     * Generate cache key for query
     */
    generateQueryCacheKey(query, params) {
        return `query_${Buffer.from(query + JSON.stringify(params)).toString('base64')}`;
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
    }
    
    /**
     * Record successful request
     */
    recordSuccess(requestData, result) {
        const endTime = performance.now();
        const responseTime = endTime - requestData.startTime;
        
        this.stats.activeRequests--;
        this.stats.completedRequests++;
        
        // Update average response time
        this.stats.averageResponseTime = 
            (this.stats.averageResponseTime * (this.stats.completedRequests - 1) + responseTime) / 
            this.stats.completedRequests;
        
        // Add to request history
        this.requestHistory.push({
            id: requestData.id,
            timestamp: requestData.timestamp,
            responseTime,
            success: true
        });
        
        // Clean old history (keep last 1000 requests)
        if (this.requestHistory.length > 1000) {
            this.requestHistory = this.requestHistory.slice(-1000);
        }
        
        // Update circuit breaker
        this.circuitBreaker.successCount++;
        if (this.circuitBreaker.successCount >= 5) {
            this.resetCircuitBreaker();
        }
    }
    
    /**
     * Record failed request
     */
    recordFailure(requestData, error) {
        const endTime = performance.now();
        const responseTime = endTime - requestData.startTime;
        
        this.stats.activeRequests--;
        this.stats.failedRequests++;
        
        // Add to request history
        this.requestHistory.push({
            id: requestData.id,
            timestamp: requestData.timestamp,
            responseTime,
            success: false,
            error: error.message
        });
        
        // Update circuit breaker
        this.circuitBreaker.failureCount++;
        this.circuitBreaker.lastFailureTime = Date.now();
        
        if (this.circuitBreaker.failureCount >= this.options.circuitBreakerThreshold) {
            this.tripCircuitBreaker();
        }
    }
    
    /**
     * Trip circuit breaker
     */
    tripCircuitBreaker() {
        this.circuitBreaker.isOpen = true;
        this.stats.circuitBreakerTrips++;
        
        console.log('🔴 Circuit breaker tripped - stopping request processing');
        this.emit('circuitBreakerTripped', {
            failureCount: this.circuitBreaker.failureCount,
            threshold: this.options.circuitBreakerThreshold
        });
    }
    
    /**
     * Reset circuit breaker
     */
    resetCircuitBreaker() {
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failureCount = 0;
        this.circuitBreaker.successCount = 0;
        
        console.log('🟢 Circuit breaker reset - resuming request processing');
        this.emit('circuitBreakerReset');
    }
    
    /**
     * Get system statistics
     */
    getStats() {
        return {
            ...this.stats,
            circuitBreaker: {
                isOpen: this.circuitBreaker.isOpen,
                failureCount: this.circuitBreaker.failureCount,
                successCount: this.circuitBreaker.successCount
            },
            queueSizes: {
                critical: this.options.priorityQueues.critical.length,
                high: this.options.priorityQueues.high.length,
                normal: this.options.priorityQueues.normal.length,
                low: this.options.priorityQueues.low.length
            },
            totalQueueSize: Object.values(this.options.priorityQueues)
                .reduce((sum, queue) => sum + queue.length, 0),
            queryCache: {
                size: this.queryCache.size,
                entries: Array.from(this.queryCache.keys())
            },
            queryStats: this.getQueryStats()
        };
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
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.queryCache.size,
            entries: Array.from(this.queryCache.keys())
        };
    }
    
    /**
     * Clear query cache
     */
    clearQueryCache() {
        this.queryCache.clear();
        console.log('🧹 Load Balancer query cache cleared');
    }
    
    /**
     * Add sample queries to populate cache
     */
    async populateSampleQueries() {
        console.log('🔄 Populating sample queries for cache demonstration...');
        
        const sampleQueries = [
            {
                type: 'database_query',
                query: 'SELECT * FROM siswa WHERE status = ?',
                params: ['aktif'],
                priority: 'high'
            },
            {
                type: 'database_query',
                query: 'SELECT * FROM guru WHERE status = ?',
                params: ['aktif'],
                priority: 'high'
            },
            {
                type: 'database_query',
                query: 'SELECT * FROM kelas WHERE status = ?',
                params: ['aktif'],
                priority: 'normal'
            },
            {
                type: 'database_query',
                query: 'SELECT COUNT(*) as total FROM absensi_siswa WHERE tanggal = ?',
                params: [new Date().toISOString().split('T')[0]],
                priority: 'critical'
            }
        ];
        
        for (const query of sampleQueries) {
            try {
                await this.addRequest(query, query.priority);
                console.log(`✅ Added sample query: ${query.query.substring(0, 50)}...`);
            } catch (error) {
                console.error(`❌ Failed to add sample query:`, error);
            }
        }
        
        console.log('✅ Sample queries populated');
    }
    
    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Enable the load balancer
     */
    async enable() {
        this.isProcessing = true;
        this.enabled = true;
        console.log('✅ Load Balancer enabled');
        this.emit('enabled');
    }

    /**
     * Disable the load balancer
     */
    async disable() {
        this.isProcessing = false;
        this.enabled = false;
        console.log('⏸️ Load Balancer disabled');
        this.emit('disabled');
    }

    /**
     * Stop the load balancer
     */
    stop() {
        this.isProcessing = false;
        this.enabled = false;
        console.log('🛑 Load Balancer stopped');
    }
}

export default LoadBalancer;
