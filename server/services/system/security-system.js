/**
 * Security System
 * Phase 8: Security & Backup - Rate limiting, Input validation, Audit logging
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

class SecuritySystem extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            rateLimiting: {
                enabled: options.rateLimiting?.enabled !== false,
                windowMs: options.rateLimiting?.windowMs || 60000, // 1 minute
                maxRequests: options.rateLimiting?.maxRequests || 100,
                skipSuccessfulRequests: options.rateLimiting?.skipSuccessfulRequests || false,
                skipFailedRequests: options.rateLimiting?.skipFailedRequests || false
            },
            inputValidation: {
                enabled: options.inputValidation?.enabled !== false,
                maxLength: options.inputValidation?.maxLength || 1000,
                allowedChars: options.inputValidation?.allowedChars || /^[a-zA-Z0-9\s\-_@.!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~()]+$/,
                sqlInjectionPatterns: options.inputValidation?.sqlInjectionPatterns || [
                    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
                    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
                    /(\b(OR|AND)\s+['"]\s*=\s*['"])/i,
                    /(\b(OR|AND)\s+1\s*=\s*1)/i,
                    /(\b(OR|AND)\s+0\s*=\s*0)/i,
                    /(\b(OR|AND)\s+true)/i,
                    /(\b(OR|AND)\s+false)/i,
                    /(UNION\s+SELECT)/i,
                    /(DROP\s+TABLE)/i,
                    /(DELETE\s+FROM)/i,
                    /(INSERT\s+INTO)/i,
                    /(UPDATE\s+SET)/i,
                    /(CREATE\s+TABLE)/i,
                    /(ALTER\s+TABLE)/i,
                    /(EXEC\s*\()/i,
                    /(SCRIPT\s*>)/i,
                    /(<\s*SCRIPT)/i,
                    /(JAVASCRIPT\s*:)/i,
                    /(ON\s+LOAD\s*=)/i,
                    /(ON\s+ERROR\s*=)/i,
                    /(ON\s+FOCUS\s*=)/i,
                    /(ON\s+CLICK\s*=)/i
                ],
                xssPatterns: options.inputValidation?.xssPatterns || [
                    /<script[^>]*>.*?<\/script>/gi,
                    /<script[^>]*>/gi,
                    /javascript:/gi,
                    /on\w+\s*=/gi,
                    /<iframe[^>]*>.*?<\/iframe>/gi,
                    /<object[^>]*>.*?<\/object>/gi,
                    /<embed[^>]*>.*?<\/embed>/gi,
                    /<link[^>]*>.*?<\/link>/gi,
                    /<meta[^>]*>.*?<\/meta>/gi,
                    /<style[^>]*>.*?<\/style>/gi
                ]
            },
            auditLogging: {
                enabled: options.auditLogging?.enabled !== false,
                logFile: options.auditLogging?.logFile || 'logs/security-audit.log',
                logLevel: options.auditLogging?.logLevel || 'info',
                sensitiveFields: options.auditLogging?.sensitiveFields || ['password', 'token', 'secret', 'key'],
                maxLogSize: options.auditLogging?.maxLogSize || 10 * 1024 * 1024, // 10MB
                maxLogFiles: options.auditLogging?.maxLogFiles || 5
            },
            ...options
        };
        
        this.rateLimitStore = new Map();
        this.securityEvents = [];
        this.blockedIPs = new Set();
        this.suspiciousActivities = new Map();
        
        // Ensure log directory exists
        this.ensureLogDirectory();
        
        // Start cleanup tasks
        this.startCleanupTasks();
        
        console.log('🔒 Security System initialized');
    }
    
    /**
     * Ensure log directory exists
     */
    async ensureLogDirectory() {
        try {
            const logDir = path.dirname(this.options.auditLogging.logFile);
            await fs.mkdir(logDir, { recursive: true });
            console.log(`📁 Log directory ensured: ${logDir}`);
        } catch (error) {
            console.error('Failed to create log directory:', error);
            // Fallback: try to create logs directory in current working directory
            try {
                await fs.mkdir('logs', { recursive: true });
                this.options.auditLogging.logFile = 'logs/security-audit.log';
                console.log('📁 Fallback log directory created: logs/');
            } catch (fallbackError) {
                console.error('Failed to create fallback log directory:', fallbackError);
            }
        }
    }
    
    /**
     * Start cleanup tasks
     */
    startCleanupTasks() {
        // Clean rate limit store every minute
        setInterval(() => {
            this.cleanupRateLimitStore();
        }, 60000);
        
        // Clean suspicious activities every 5 minutes
        setInterval(() => {
            this.cleanupSuspiciousActivities();
        }, 300000);
        
        // Rotate log files every hour
        setInterval(() => {
            this.rotateLogFiles();
        }, 3600000);
    }
    
    /**
     * Rate limiting middleware
     */
    rateLimitMiddleware() {
        return (req, res, next) => {
            if (!this.options.rateLimiting.enabled) {
                return next();
            }
            
            const clientId = this.getClientId(req);
            
            // Skip rate limiting for localhost/development IPs
            if (this.isLocalhostOrDevelopment(clientId)) {
                return next();
            }
            
            const now = Date.now();
            const windowStart = now - this.options.rateLimiting.windowMs;
            
            // Get or create rate limit entry
            if (!this.rateLimitStore.has(clientId)) {
                this.rateLimitStore.set(clientId, {
                    requests: [],
                    blocked: false,
                    blockUntil: 0
                });
            }
            
            const rateLimitData = this.rateLimitStore.get(clientId);
            
            // Check if client is blocked
            if (rateLimitData.blocked && now < rateLimitData.blockUntil) {
                this.logSecurityEvent('rate_limit_blocked', {
                    clientId,
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    endpoint: req.path,
                    method: req.method
                });
                
                return res.status(429).json({
                    error: 'Too many requests',
                    retryAfter: Math.ceil((rateLimitData.blockUntil - now) / 1000)
                });
            }
            
            // Clean old requests
            rateLimitData.requests = rateLimitData.requests.filter(timestamp => timestamp > windowStart);
            
            // Check if limit exceeded
            if (rateLimitData.requests.length >= this.options.rateLimiting.maxRequests) {
                // Block client for 5 minutes
                rateLimitData.blocked = true;
                rateLimitData.blockUntil = now + 300000; // 5 minutes
                
                this.logSecurityEvent('rate_limit_exceeded', {
                    clientId,
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    endpoint: req.path,
                    method: req.method,
                    requestCount: rateLimitData.requests.length,
                    limit: this.options.rateLimiting.maxRequests
                });
                
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    retryAfter: 300
                });
            }
            
            // Add current request
            rateLimitData.requests.push(now);
            
            // Add rate limit headers
            res.set({
                'X-RateLimit-Limit': this.options.rateLimiting.maxRequests,
                'X-RateLimit-Remaining': Math.max(0, this.options.rateLimiting.maxRequests - rateLimitData.requests.length),
                'X-RateLimit-Reset': new Date(windowStart + this.options.rateLimiting.windowMs).toISOString()
            });
            
            next();
        };
    }
    
    /**
     * Input validation middleware
     */
    inputValidationMiddleware() {
        return (req, res, next) => {
            if (!this.options.inputValidation.enabled) {
                return next();
            }
            
            // Skip validation for login endpoint to avoid issues
            if (req.path === '/api/login' || req.path === '/api/verify') {
                return next();
            }
            
            try {
                // Validate request body
                if (req.body && typeof req.body === 'object') {
                    const validationResult = this.validateInput(req.body, 'body');
                    if (!validationResult.valid) {
                        this.logSecurityEvent('input_validation_failed', {
                            ip: req.ip,
                            userAgent: req.get('User-Agent'),
                            endpoint: req.path,
                            method: req.method,
                            violations: validationResult.violations
                        });
                        
                        return res.status(400).json({
                            error: 'Invalid input data',
                            violations: validationResult.violations
                        });
                    }
                }
                
                // Validate query parameters
                if (req.query && typeof req.query === 'object') {
                    const validationResult = this.validateInput(req.query, 'query');
                    if (!validationResult.valid) {
                        this.logSecurityEvent('input_validation_failed', {
                            ip: req.ip,
                            userAgent: req.get('User-Agent'),
                            endpoint: req.path,
                            method: req.method,
                            violations: validationResult.violations
                        });
                        
                        return res.status(400).json({
                            error: 'Invalid query parameters',
                            violations: validationResult.violations
                        });
                    }
                }
                
                // Validate URL parameters
                if (req.params && typeof req.params === 'object') {
                    const validationResult = this.validateInput(req.params, 'params');
                    if (!validationResult.valid) {
                        this.logSecurityEvent('input_validation_failed', {
                            ip: req.ip,
                            userAgent: req.get('User-Agent'),
                            endpoint: req.path,
                            method: req.method,
                            violations: validationResult.violations
                        });
                        
                        return res.status(400).json({
                            error: 'Invalid URL parameters',
                            violations: validationResult.violations
                        });
                    }
                }
                
                next();
            } catch (error) {
                this.logSecurityEvent('input_validation_error', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    endpoint: req.path,
                    method: req.method,
                    error: error.message
                });
                
                return res.status(500).json({
                    error: 'Input validation error'
                });
            }
        };
    }
    
    /**
     * Validate input data
     */
    validateInput(data, source) {
        const violations = [];
        
        const validateValue = (value, path = '') => {
            if (typeof value === 'string') {
                // Check length
                if (value.length > this.options.inputValidation.maxLength) {
                    violations.push({
                        path,
                        type: 'max_length_exceeded',
                        message: `Value exceeds maximum length of ${this.options.inputValidation.maxLength}`,
                        value: value.substring(0, 100) + '...'
                    });
                }
                
                // Check allowed characters (skip for empty strings)
                if (value.length > 0 && !this.options.inputValidation.allowedChars.test(value)) {
                    violations.push({
                        path,
                        type: 'invalid_characters',
                        message: 'Value contains invalid characters',
                        value: value.substring(0, 100) + '...'
                    });
                }
                
                // Check for SQL injection patterns
                for (const pattern of this.options.inputValidation.sqlInjectionPatterns) {
                    if (pattern.test(value)) {
                        violations.push({
                            path,
                            type: 'sql_injection_attempt',
                            message: 'Potential SQL injection attempt detected',
                            value: value.substring(0, 100) + '...'
                        });
                    }
                }
                
                // Check for XSS patterns
                for (const pattern of this.options.inputValidation.xssPatterns) {
                    if (pattern.test(value)) {
                        violations.push({
                            path,
                            type: 'xss_attempt',
                            message: 'Potential XSS attempt detected',
                            value: value.substring(0, 100) + '...'
                        });
                    }
                }
            } else if (typeof value === 'object' && value !== null) {
                // Recursively validate object properties
                for (const [key, val] of Object.entries(value)) {
                    validateValue(val, path ? `${path}.${key}` : key);
                }
            }
        };
        
        validateValue(data);
        
        return {
            valid: violations.length === 0,
            violations
        };
    }
    
    /**
     * Audit logging middleware
     */
    auditLoggingMiddleware() {
        return (req, res, next) => {
            if (!this.options.auditLogging.enabled) {
                return next();
            }
            
            const startTime = Date.now();
            const originalSend = res.send;
            
            // Override res.send to capture response
            res.send = function(data) {
                const endTime = Date.now();
                const responseTime = endTime - startTime;
                
                // Log the request
                this.logAuditEvent({
                    timestamp: new Date().toISOString(),
                    method: req.method,
                    url: req.url,
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    userId: req.user?.id || null,
                    statusCode: res.statusCode,
                    responseTime,
                    requestSize: JSON.stringify(req.body || {}).length,
                    responseSize: typeof data === 'string' ? data.length : JSON.stringify(data).length,
                    user: req.user ? this.sanitizeUserData(req.user) : null
                });
                
                // Call original send
                originalSend.call(res, data);
            }.bind(this);
            
            next();
        };
    }
    
    /**
     * Log audit event
     */
    async logAuditEvent(event) {
        try {
            // Ensure log directory exists before writing
            await this.ensureLogDirectory();
            
            const logEntry = JSON.stringify(event) + '\n';
            await fs.appendFile(this.options.auditLogging.logFile, logEntry);
        } catch (error) {
            console.error('Failed to write audit log:', error);
            // Try to create directory again if it failed
            try {
                await this.ensureLogDirectory();
                const logEntry = JSON.stringify(event) + '\n';
                await fs.appendFile(this.options.auditLogging.logFile, logEntry);
            } catch (retryError) {
                console.error('Failed to write audit log after retry:', retryError);
            }
        }
    }
    
    /**
     * Log security event
     */
    async logSecurityEvent(type, data) {
        const event = {
            type,
            timestamp: new Date().toISOString(),
            data: this.sanitizeData(data),
            severity: this.getEventSeverity(type)
        };
        
        this.securityEvents.push(event);
        
        // Log to file
        try {
            // Ensure log directory exists before writing
            await this.ensureLogDirectory();
            
            const logEntry = JSON.stringify(event) + '\n';
            await fs.appendFile(this.options.auditLogging.logFile, logEntry);
        } catch (error) {
            console.error('Failed to write security log:', error);
            // Try to create directory again if it failed
            try {
                await this.ensureLogDirectory();
                const logEntry = JSON.stringify(event) + '\n';
                await fs.appendFile(this.options.auditLogging.logFile, logEntry);
            } catch (retryError) {
                console.error('Failed to write security log after retry:', retryError);
            }
        }
        
        // Emit event
        this.emit('securityEvent', event);
        
        // Check for suspicious activity
        this.checkSuspiciousActivity(type, data);
    }
    
    /**
     * Log security event directly without triggering suspicious activity check
     * Used to prevent infinite loops when logging blocking events
     */
    async logSecurityEventDirect(type, data) {
        const event = {
            type,
            timestamp: new Date().toISOString(),
            data: this.sanitizeData(data),
            severity: this.getEventSeverity(type)
        };
        
        this.securityEvents.push(event);
        
        // Log to file
        try {
            // Ensure log directory exists before writing
            await this.ensureLogDirectory();
            
            const logEntry = JSON.stringify(event) + '\n';
            await fs.appendFile(this.options.auditLogging.logFile, logEntry);
        } catch (error) {
            console.error('Failed to write security log:', error);
            // Try to create directory again if it failed
            try {
                await this.ensureLogDirectory();
                const logEntry = JSON.stringify(event) + '\n';
                await fs.appendFile(this.options.auditLogging.logFile, logEntry);
            } catch (retryError) {
                console.error('Failed to write security log after retry:', retryError);
            }
        }
        
        // Emit event
        this.emit('securityEvent', event);
        
        // DO NOT check for suspicious activity to prevent infinite loop
    }
    
    /**
     * Get event severity
     */
    getEventSeverity(type) {
        const severityMap = {
            'rate_limit_exceeded': 'warning',
            'rate_limit_blocked': 'warning',
            'input_validation_failed': 'warning',
            'sql_injection_attempt': 'critical',
            'xss_attempt': 'critical',
            'suspicious_activity': 'critical',
            'ip_blocked': 'critical'
        };
        
        return severityMap[type] || 'info';
    }
    
    /**
     * Sanitize data for logging
     */
    sanitizeData(data) {
        const sanitized = { ...data };
        
        // Remove sensitive fields
        if (this.options.auditLogging.sensitiveFields && Array.isArray(this.options.auditLogging.sensitiveFields)) {
            for (const field of this.options.auditLogging.sensitiveFields) {
                if (sanitized[field]) {
                    sanitized[field] = '[REDACTED]';
                }
            }
        }
        
        return sanitized;
    }
    
    /**
     * Sanitize user data
     */
    sanitizeUserData(user) {
        const sanitized = { ...user };
        
        // Remove sensitive fields
        if (this.options.auditLogging.sensitiveFields && Array.isArray(this.options.auditLogging.sensitiveFields)) {
            for (const field of this.options.auditLogging.sensitiveFields) {
                if (sanitized[field]) {
                    sanitized[field] = '[REDACTED]';
                }
            }
        }
        
        return sanitized;
    }
    
    /**
     * Check for suspicious activity
     */
    checkSuspiciousActivity(type, data) {
        const clientId = data.clientId || data.ip;
        
        // Skip suspicious activity check for localhost/development IPs
        if (this.isLocalhostOrDevelopment(clientId)) {
            return;
        }
        
        if (!this.suspiciousActivities.has(clientId)) {
            this.suspiciousActivities.set(clientId, {
                events: [],
                score: 0,
                firstSeen: Date.now()
            });
        }
        
        const activity = this.suspiciousActivities.get(clientId);
        
        // Add event
        activity.events.push({
            type,
            timestamp: Date.now(),
            data
        });
        
        // Calculate suspicious score
        const scoreWeights = {
            'rate_limit_exceeded': 5,
            'input_validation_failed': 3,
            'sql_injection_attempt': 20,
            'xss_attempt': 15,
            'suspicious_activity': 10
        };
        
        activity.score += scoreWeights[type] || 1;
        
        // Check if score exceeds threshold
        if (activity.score >= 50) {
            this.handleSuspiciousActivity(clientId, activity);
        }
    }
    
    /**
     * Handle suspicious activity
     */
    handleSuspiciousActivity(clientId, activity) {
        // Check if already blocked to prevent infinite loop
        if (this.blockedIPs.has(clientId)) {
            return; // Already blocked, don't process again
        }
        
        // Block IP
        this.blockedIPs.add(clientId);
        
        // Log critical event WITHOUT triggering suspicious activity check
        this.logSecurityEventDirect('ip_blocked', {
            clientId,
            score: activity.score,
            events: activity.events.length,
            duration: Date.now() - activity.firstSeen
        });
        
        console.log(`🚨 IP ${clientId} blocked due to suspicious activity (score: ${activity.score})`);
    }
    
    /**
     * Get client ID from request
     */
    getClientId(req) {
        return req.ip || req.connection.remoteAddress || 'unknown';
    }
    
    /**
     * Check if IP is localhost or development IP
     */
    isLocalhostOrDevelopment(ip) {
        if (!ip || ip === 'unknown') return false;
        
        const localhostIPs = [
            '127.0.0.1',
            '::1',
            '::ffff:127.0.0.1',
            'localhost',
            '0.0.0.0'
        ];
        
        // Check exact matches for localhost only
        if (localhostIPs.includes(ip)) {
            return true;
        }
        
        // For development, we only skip localhost, not all local network IPs
        // This allows testing with local network IPs while protecting localhost
        return false;
    }
    
    /**
     * Clean up rate limit store
     */
    cleanupRateLimitStore() {
        const now = Date.now();
        const windowStart = now - this.options.rateLimiting.windowMs;
        
        for (const [clientId, data] of this.rateLimitStore) {
            // Clean old requests
            data.requests = data.requests.filter(timestamp => timestamp > windowStart);
            
            // Remove unblocked clients
            if (data.blocked && now >= data.blockUntil) {
                data.blocked = false;
                data.blockUntil = 0;
            }
            
            // Remove empty entries
            if (data.requests.length === 0 && !data.blocked) {
                this.rateLimitStore.delete(clientId);
            }
        }
    }
    
    /**
     * Clean up suspicious activities
     */
    cleanupSuspiciousActivities() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        for (const [clientId, activity] of this.suspiciousActivities) {
            if (now - activity.firstSeen > maxAge) {
                this.suspiciousActivities.delete(clientId);
            }
        }
    }
    
    /**
     * Clean up blocked IPs (auto-unblock after 1 hour)
     */
    cleanupBlockedIPs() {
        const now = Date.now();
        const blockDuration = 60 * 60 * 1000; // 1 hour
        
        // For now, we'll keep blocked IPs indefinitely for security
        // But we can add time-based unblocking here if needed
        // This is a placeholder for future enhancement
    }
    
    /**
     * Rotate log files
     */
    async rotateLogFiles() {
        try {
            const logFile = this.options.auditLogging.logFile;
            const stats = await fs.stat(logFile).catch(() => null);
            
            if (stats && stats.size > this.options.auditLogging.maxLogSize) {
                // Rotate log files
                for (let i = this.options.auditLogging.maxLogFiles - 1; i > 0; i--) {
                    const oldFile = `${logFile}.${i}`;
                    const newFile = `${logFile}.${i + 1}`;
                    
                    try {
                        await fs.rename(oldFile, newFile);
                    } catch (error) {
                        // File doesn't exist, continue
                    }
                }
                
                // Move current log to .1
                await fs.rename(logFile, `${logFile}.1`);
                
                console.log('📝 Log files rotated');
            }
        } catch (error) {
            console.error('Failed to rotate log files:', error);
        }
    }
    
    /**
     * Get security statistics
     */
    getSecurityStats() {
        return {
            rateLimitStore: {
                size: this.rateLimitStore.size,
                blockedClients: Array.from(this.rateLimitStore.values()).filter(data => data.blocked).length
            },
            blockedIPs: {
                count: this.blockedIPs.size,
                ips: Array.from(this.blockedIPs)
            },
            suspiciousActivities: {
                count: this.suspiciousActivities.size,
                activities: Array.from(this.suspiciousActivities.entries()).map(([clientId, activity]) => ({
                    clientId,
                    score: activity.score,
                    events: activity.events.length,
                    firstSeen: activity.firstSeen
                }))
            },
            securityEvents: {
                total: this.securityEvents.length,
                recent: this.securityEvents.slice(-10)
            }
        };
    }
    
    /**
     * Unblock IP
     */
    unblockIP(ip) {
        this.blockedIPs.delete(ip);
        this.rateLimitStore.delete(ip);
        this.suspiciousActivities.delete(ip);
        
        this.logSecurityEvent('ip_unblocked', { ip });
        console.log(`✅ IP ${ip} unblocked`);
    }
    
    /**
     * Check if IP is blocked
     */
    isIPBlocked(ip) {
        return this.blockedIPs.has(ip);
    }
    
    /**
     * Get blocked IPs list
     */
    getBlockedIPs() {
        return Array.from(this.blockedIPs);
    }
    
    /**
     * Start security system
     */
    start() {
        console.log('🔒 Security System started');
        
        // Unblock localhost IPs that might have been blocked during development
        const localhostIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'];
        localhostIPs.forEach(ip => {
            if (this.isIPBlocked(ip)) {
                this.unblockIP(ip);
                console.log(`🔓 Unblocked localhost IP: ${ip}`);
            }
        });
        
        // Security system is already initialized in constructor
        // This method is here for compatibility with server initialization
    }
    
    /**
     * Cleanup resources
     */
    cleanup() {
        this.rateLimitStore.clear();
        this.blockedIPs.clear();
        this.suspiciousActivities.clear();
        this.securityEvents = [];
        
        console.log('🧹 Security System cleaned up');
    }
}

export default SecuritySystem;
