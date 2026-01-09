/**
 * DDoS Protection & Anti-Spam System
 * 
 * Features:
 * - Request fingerprinting
 * - Adaptive rate limiting
 * - Burst/spike detection
 * - IP reputation tracking
 * - Request pattern analysis
 * - Auto-blacklisting
 * - Challenge system triggers
 */

import crypto from 'node:crypto';
import { EventEmitter } from 'events';
import { createLogger } from './logger.js';

const logger = createLogger('DDoS');

// ================================================
// CONFIGURATION
// ================================================

const DEFAULT_CONFIG = {
    // Rate limiting - RELAXED settings
    windowMs: 60000,              // 1 minute window
    maxRequestsPerWindow: 500,    // Relaxed: 500 requests per window (was 100)
    maxRequestsPerSecond: 30,     // Relaxed: 30 per second (was 10)
    
    // DDoS detection - RELAXED
    spikeThreshold: 20,           // Relaxed: 20 rps to trigger spike (was 5)
    spikeWindowMs: 5000,          // 5 second window for spike detection
    suspiciousPatternThreshold: 5, // Relaxed: 5 patterns before action (was 3)
    
    // Blocking - LESS STRICT
    blockDurationMs: 120000,      // Reduced: 2 minutes block (was 5)
    permanentBlockThreshold: 10,  // Relaxed: 10 temp blocks before permanent (was 5)
    
    // Device identification
    useDeviceFingerprint: true,   // NEW: Use fingerprint+IP combo for identification
    fingerprintTTL: 3600000,      // 1 hour fingerprint TTL
    
    // Whitelist
    whitelistedIPs: ['127.0.0.1', '::1', 'localhost'],
    
    // Challenge - RELAXED
    challengeAfterSuspicious: 8   // Relaxed: trigger challenge after 8 suspicious (was 3)
};

// ================================================
// DDOS PROTECTION CLASS
// ================================================

class DDoSProtection extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = { ...DEFAULT_CONFIG, ...options };
        
        // Request tracking
        this.requestCounts = new Map();      // IP -> { count, windowStart }
        this.burstCounts = new Map();        // IP -> { count, lastRequest }
        this.fingerprints = new Map();       // fingerprint -> { ip, count, lastSeen }
        
        // Reputation tracking
        this.ipReputation = new Map();       // IP -> { score, violations, lastViolation }
        this.blockedIPs = new Map();         // IP -> { blockedAt, duration, reason, permanent }
        this.temporaryBlockCount = new Map(); // IP -> count of temporary blocks
        
        // Pattern tracking
        this.requestPatterns = new Map();    // IP -> { paths: [], methods: [], times: [] }
        
        // Statistics
        this.stats = {
            totalRequests: 0,
            blockedRequests: 0,
            spikesDetected: 0,
            suspiciousPatterns: 0,
            challengesTriggered: 0,
            activeBlocks: 0
        };
        
        // Start cleanup interval
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
        
        // Silent initialization - no console output
        this.initialized = true;
    }
    
    // ================================================
    // MAIN MIDDLEWARE
    // ================================================
    
    middleware() {
        return (req, res, next) => {
            const clientIP = this.getClientIP(req);
            const fingerprint = this.generateFingerprint(req);
            
            // Use device fingerprint + IP combo for identification (not just router IP)
            const deviceId = this.config.useDeviceFingerprint 
                ? `${fingerprint}:${clientIP}` 
                : clientIP;
            
            this.stats.totalRequests++;
            
            // Check whitelist
            if (this.isWhitelisted(clientIP)) {
                return next();
            }
            
            // Check if blocked
            if (this.isBlocked(clientIP)) {
                this.stats.blockedRequests++;
                return res.status(429).json({
                    error: 'Too Many Requests',
                    message: 'Anda telah diblokir sementara karena aktivitas mencurigakan',
                    retryAfter: this.getBlockTimeRemaining(clientIP)
                });
            }
            
            // Check rate limit using deviceId (fingerprint + IP)
            const rateLimitResult = this.checkRateLimit(deviceId);
            if (!rateLimitResult.allowed) {
                this.handleViolation(deviceId, 'rate_limit_exceeded', {
                    count: rateLimitResult.count,
                    limit: this.config.maxRequestsPerWindow
                });
                
                return res.status(429).json({
                    error: 'Rate Limit Exceeded',
                    message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
                    retryAfter: Math.ceil((this.config.windowMs - rateLimitResult.elapsed) / 1000)
                });
            }
            
            // Check burst using deviceId
            const burstResult = this.checkBurst(deviceId);
            if (!burstResult.allowed) {
                this.handleViolation(deviceId, 'burst_detected', {
                    requestsPerSecond: burstResult.rps
                });
                
                return res.status(429).json({
                    error: 'Burst Detected',
                    message: 'Terlalu banyak permintaan dalam waktu singkat',
                    retryAfter: 3
                });
            }
            
            // Track fingerprint
            this.trackFingerprint(fingerprint, clientIP);
            
            // Analyze request pattern
            this.trackRequestPattern(clientIP, req);
            const patternAnalysis = this.analyzePattern(clientIP);
            
            if (patternAnalysis.suspicious) {
                this.handleViolation(clientIP, 'suspicious_pattern', {
                    pattern: patternAnalysis.pattern
                });
            }
            
            // Check if challenge needed
            const reputation = this.getReputation(clientIP);
            if (reputation.violations >= this.config.challengeAfterSuspicious) {
                // Add header to trigger client-side challenge
                res.setHeader('X-Challenge-Required', 'true');
                res.setHeader('X-Challenge-Type', 'proof-of-work');
                this.stats.challengesTriggered++;
            }
            
            // Add security headers
            res.setHeader('X-RateLimit-Limit', this.config.maxRequestsPerWindow);
            res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining);
            res.setHeader('X-RateLimit-Reset', rateLimitResult.resetTime);
            
            next();
        };
    }
    
    // ================================================
    // RATE LIMITING
    // ================================================
    
    checkRateLimit(ip) {
        const now = Date.now();
        let record = this.requestCounts.get(ip);
        
        if (!record || now - record.windowStart >= this.config.windowMs) {
            // New window
            record = { count: 1, windowStart: now };
            this.requestCounts.set(ip, record);
            
            return {
                allowed: true,
                count: 1,
                remaining: this.config.maxRequestsPerWindow - 1,
                elapsed: 0,
                resetTime: Math.ceil((now + this.config.windowMs) / 1000)
            };
        }
        
        record.count++;
        const elapsed = now - record.windowStart;
        const remaining = Math.max(0, this.config.maxRequestsPerWindow - record.count);
        
        return {
            allowed: record.count <= this.config.maxRequestsPerWindow,
            count: record.count,
            remaining,
            elapsed,
            resetTime: Math.ceil((record.windowStart + this.config.windowMs) / 1000)
        };
    }
    
    // ================================================
    // BURST DETECTION
    // ================================================
    
    checkBurst(ip) {
        const now = Date.now();
        let record = this.burstCounts.get(ip);
        
        if (!record) {
            record = { count: 1, windowStart: now, requests: [now] };
            this.burstCounts.set(ip, record);
            return { allowed: true, rps: 1 };
        }
        
        // Add current request timestamp
        record.requests.push(now);
        
        // Keep only requests within spike window
        record.requests = record.requests.filter(
            t => now - t < this.config.spikeWindowMs
        );
        
        // Calculate requests per second
        const windowSeconds = this.config.spikeWindowMs / 1000;
        const rps = record.requests.length / windowSeconds;
        
        // Check if spike detected
        if (rps >= this.config.spikeThreshold) {
            this.stats.spikesDetected++;
            this.emit('spikeDetected', { ip, rps });
        }
        
        return {
            allowed: rps < this.config.maxRequestsPerSecond,
            rps: Math.round(rps * 100) / 100
        };
    }
    
    // ================================================
    // FINGERPRINTING
    // ================================================
    
    generateFingerprint(req) {
        const components = [
            req.headers['user-agent'] || '',
            req.headers['accept-language'] || '',
            req.headers['accept-encoding'] || '',
            req.headers['accept'] || ''
        ];
        
        return crypto
            .createHash('sha256')
            .update(components.join('|'))
            .digest('hex')
            .substring(0, 16);
    }
    
    trackFingerprint(fingerprint, ip) {
        const now = Date.now();
        let record = this.fingerprints.get(fingerprint);
        
        if (!record) {
            record = { ips: new Set([ip]), count: 1, lastSeen: now };
        } else {
            record.ips.add(ip);
            record.count++;
            record.lastSeen = now;
        }
        
        this.fingerprints.set(fingerprint, record);
        
        // Check for fingerprint abuse (same fingerprint from many IPs)
        if (record.ips.size > 10) {
            this.emit('fingerprintAbuse', { fingerprint, ipCount: record.ips.size });
        }
    }
    
    // ================================================
    // PATTERN ANALYSIS
    // ================================================
    
    trackRequestPattern(ip, req) {
        let record = this.requestPatterns.get(ip);
        
        if (!record) {
            record = { paths: [], methods: [], times: [] };
        }
        
        const now = Date.now();
        
        // Keep last 100 requests
        if (record.paths.length >= 100) {
            record.paths.shift();
            record.methods.shift();
            record.times.shift();
        }
        
        record.paths.push(req.path);
        record.methods.push(req.method);
        record.times.push(now);
        
        this.requestPatterns.set(ip, record);
    }
    
    analyzePattern(ip) {
        const record = this.requestPatterns.get(ip);
        if (!record || record.paths.length < 10) {
            return { suspicious: false };
        }
        
        // Check for suspicious patterns
        const patterns = [];
        
        // 1. Same path repeated too many times
        const pathCounts = {};
        record.paths.forEach(p => {
            pathCounts[p] = (pathCounts[p] || 0) + 1;
        });
        
        const maxPathCount = Math.max(...Object.values(pathCounts));
        if (maxPathCount > record.paths.length * 0.8) {
            patterns.push('repetitive_path');
        }
        
        // 2. Sequential scanning (incrementing IDs)
        const numericPaths = record.paths.filter(p => /\/\d+$/.test(p));
        if (numericPaths.length > 20) {
            const numbers = numericPaths.map(p =>.parseInt(p.match(/\/(\d+)$/)[1]));
            let sequential = 0;
            for (let i = 1; i < numbers.length; i++) {
                if (numbers[i] === numbers[i-1] + 1) sequential++;
            }
            if (sequential > numbers.length * 0.5) {
                patterns.push('sequential_scanning');
            }
        }
        
        // 3. Too many different paths (fuzzing)
        const uniquePaths = new Set(record.paths).size;
        if (uniquePaths > record.paths.length * 0.9 && record.paths.length > 50) {
            patterns.push('path_fuzzing');
        }
        
        // 4. Only POST requests (potential spam)
        const postCount = record.methods.filter(m => m === 'POST').length;
        if (postCount > record.methods.length * 0.9 && record.methods.length > 20) {
            patterns.push('post_flooding');
        }
        
        if (patterns.length > 0) {
            this.stats.suspiciousPatterns++;
        }
        
        return {
            suspicious: patterns.length >= this.config.suspiciousPatternThreshold,
            pattern: patterns.join(', ')
        };
    }
    
    // ================================================
    // REPUTATION & BLOCKING
    // ================================================
    
    getReputation(ip) {
        return this.ipReputation.get(ip) || { score: 100, violations: 0, lastViolation: null };
    }
    
    handleViolation(ip, type, data) {
        let reputation = this.getReputation(ip);
        
        // Decrease reputation score
        const penalties = {
            'rate_limit_exceeded': 20,
            'burst_detected': 25,
            'suspicious_pattern': 30,
            'fingerprint_abuse': 40
        };
        
        reputation.score = Math.max(0, reputation.score - (penalties[type] || 10));
        reputation.violations++;
        reputation.lastViolation = Date.now();
        
        this.ipReputation.set(ip, reputation);
        
        // Log event
        this.emit('violation', { ip, type, data, reputation });
        
        // Check if should block
        if (reputation.score <= 0 || reputation.violations >= 5) {
            this.blockIP(ip, type);
        }
    }
    
    blockIP(ip, reason) {
        const tempBlockCount = (this.temporaryBlockCount.get(ip) || 0) + 1;
        this.temporaryBlockCount.set(ip, tempBlockCount);
        
        const permanent = tempBlockCount >= this.config.permanentBlockThreshold;
        const duration = permanent ? Infinity : this.config.blockDurationMs;
        
        this.blockedIPs.set(ip, {
            blockedAt: Date.now(),
            duration,
            reason,
            permanent
        });
        
        this.stats.activeBlocks++;
        
        this.emit('ipBlocked', { ip, reason, permanent, tempBlockCount });
        
        // Silent block - logged internally only
        if (process.env.DEBUG_DDOS === 'true') {
            logger.debug('IP blocked', { ip, type: permanent ? 'permanent' : 'temporary', reason });
        }
    }
    
    isBlocked(ip) {
        const record = this.blockedIPs.get(ip);
        if (!record) return false;
        
        if (record.permanent) return true;
        
        if (Date.now() - record.blockedAt >= record.duration) {
            this.blockedIPs.delete(ip);
            this.stats.activeBlocks--;
            return false;
        }
        
        return true;
    }
    
    getBlockTimeRemaining(ip) {
        const record = this.blockedIPs.get(ip);
        if (!record || record.permanent) return Infinity;
        
        const remaining = record.duration - (Date.now() - record.blockedAt);
        return Math.max(0, Math.ceil(remaining / 1000));
    }
    
    unblockIP(ip) {
        if (this.blockedIPs.has(ip)) {
            this.blockedIPs.delete(ip);
            this.temporaryBlockCount.delete(ip);
            this.ipReputation.delete(ip);
            this.stats.activeBlocks--;
            this.emit('ipUnblocked', { ip });
            return true;
        }
        return false;
    }
    
    // ================================================
    // HELPERS
    // ================================================
    
    getClientIP(req) {
        return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.headers['x-real-ip'] ||
               req.connection?.remoteAddress ||
               req.socket?.remoteAddress ||
               'unknown';
    }
    
    isWhitelisted(ip) {
        return this.config.whitelistedIPs.some(whitelisted => {
            if (whitelisted === ip) return true;
            if (ip.includes(whitelisted)) return true;
            return false;
        });
    }
    
    // ================================================
    // CLEANUP
    // ================================================
    
    cleanup() {
        const now = Date.now();
        
        // Clean old request counts
        for (const [ip, record] of this.requestCounts) {
            if (now - record.windowStart >= this.config.windowMs * 2) {
                this.requestCounts.delete(ip);
            }
        }
        
        // Clean old burst counts
        for (const [ip, record] of this.burstCounts) {
            if (record.requests.length === 0 || now - record.requests[record.requests.length - 1] > 60000) {
                this.burstCounts.delete(ip);
            }
        }
        
        // Clean old fingerprints
        for (const [fp, record] of this.fingerprints) {
            if (now - record.lastSeen > this.config.fingerprintTTL) {
                this.fingerprints.delete(fp);
            }
        }
        
        // Clean old patterns
        for (const [ip, record] of this.requestPatterns) {
            if (record.times.length > 0 && now - record.times[record.times.length - 1] > 300000) {
                this.requestPatterns.delete(ip);
            }
        }
        
        // Clean expired blocks
        for (const [ip, record] of this.blockedIPs) {
            if (!record.permanent && now - record.blockedAt >= record.duration) {
                this.blockedIPs.delete(ip);
                this.stats.activeBlocks--;
            }
        }
    }
    
    // ================================================
    // STATISTICS
    // ================================================
    
    getStats() {
        return {
            ...this.stats,
            trackedIPs: this.requestCounts.size,
            trackedFingerprints: this.fingerprints.size,
            blockedIPsList: Array.from(this.blockedIPs.entries()).map(([ip, data]) => ({
                ip,
                ...data,
                timeRemaining: data.permanent ? 'permanent' : this.getBlockTimeRemaining(ip)
            }))
        };
    }
    
    // ================================================
    // SHUTDOWN
    // ================================================
    
    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        // Silent stop
        this.initialized = false;
    }
}

// ================================================
// EXPORTS
// ================================================

export default DDoSProtection;
export { DDoSProtection, DEFAULT_CONFIG };
