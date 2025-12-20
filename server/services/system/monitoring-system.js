/**
 * Monitoring & Alerting System
 * Phase 6: Real-time monitoring, Alert system, Performance tracking
 */

import dotenv from 'dotenv';
dotenv.config();

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('Monitor');

class SystemMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        const logDir = process.env.LOG_DIR || 'logs';
        
        this.options = {
            monitoringInterval: parseInt(process.env.MONITORING_INTERVAL) || options.monitoringInterval || 5000,
            alertThresholds: {
                memory: options.alertThresholds?.memory || 1.5 * 1024 * 1024 * 1024, // 1.5GB
                cpu: options.alertThresholds?.cpu || 80, // 80%
                disk: options.alertThresholds?.disk || 35 * 1024 * 1024 * 1024, // 35GB
                responseTime: options.alertThresholds?.responseTime || 5000, // 5 seconds
                dbConnections: options.alertThresholds?.dbConnections || 15 // 15 connections
            },
            alertCooldown: options.alertCooldown || 60000, // 1 minute
            logFile: path.join(logDir, 'monitoring.log'),
            ...options
        };
        
        this.metrics = {
            system: {
                memory: { used: 0, total: 0, percentage: 0 },
                cpu: { usage: 0, loadAverage: [0, 0, 0] },
                disk: { used: 0, total: 0, percentage: 0 },
                uptime: 0
            },
            application: {
                requests: { total: 0, active: 0, completed: 0, failed: 0 },
                responseTime: { average: 0, min: Infinity, max: 0 },
                errors: { count: 0, lastError: null }
            },
            database: {
                connections: { active: 0, idle: 0, total: 0 },
                queries: { total: 0, slow: 0, failed: 0 },
                responseTime: { average: 0, min: Infinity, max: 0 }
            }
        };
        
        this.alerts = new Map();
        this.isMonitoring = false;
        this.monitoringTimer = null;
        this.startTime = Date.now();
        
        // Ensure log directory exists
        this.ensureLogDirectory();
        
        logger.info('System Monitor initialized');
    }
    
    /**
     * Ensure log directory exists
     */
    async ensureLogDirectory() {
        try {
            const logDir = path.dirname(this.options.logFile);
            await fs.mkdir(logDir, { recursive: true });
        } catch (error) {
            logger.error('Failed to create log directory', error);
        }
    }
    
    /**
     * Start monitoring
     */
    start() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        this.monitoringTimer = setInterval(() => {
            this.collectMetrics();
        }, this.options.monitoringInterval);
        
        logger.info('System monitoring started');
        this.emit('monitoringStarted');
    }
    
    /**
     * Stop monitoring
     */
    stop() {
        if (!this.isMonitoring) return;
        
        this.isMonitoring = false;
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }
        
        logger.info('System monitoring stopped');
        this.emit('monitoringStopped');
    }
    
    /**
     * Collect system metrics
     */
    async collectMetrics() {
        try {
            // System metrics
            await this.collectSystemMetrics();
            
            // Application metrics
            this.collectApplicationMetrics();
            
            // Database metrics (if pool is available)
            if (this.dbPool) {
                await this.collectDatabaseMetrics();
            }
            
            // Check for alerts
            this.checkAlerts();
            
            // Emit metrics update
            this.emit('metricsUpdated', this.metrics);
            
        } catch (error) {
            logger.error('Error collecting metrics', error);
            this.recordError('metrics_collection', error);
        }
    }
    
    /**
     * Collect system metrics
     */
    async collectSystemMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        const loadAvg = os.loadavg();
        
        // Memory metrics
        this.metrics.system.memory.used = memUsage.heapUsed;
        this.metrics.system.memory.total = memUsage.heapTotal;
        this.metrics.system.memory.percentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        
        // CPU metrics
        this.metrics.system.cpu.usage = this.calculateCpuUsage(cpuUsage);
        this.metrics.system.cpu.loadAverage = loadAvg;
        
        // Disk metrics
        await this.collectDiskMetrics();
        
        // Uptime
        this.metrics.system.uptime = Date.now() - this.startTime;
    }
    
    /**
     * Calculate CPU usage percentage
     */
    calculateCpuUsage(cpuUsage) {
        if (!this.lastCpuUsage) {
            this.lastCpuUsage = cpuUsage;
            return 0;
        }
        
        const userDiff = cpuUsage.user - this.lastCpuUsage.user;
        const systemDiff = cpuUsage.system - this.lastCpuUsage.system;
        const totalDiff = userDiff + systemDiff;
        
        this.lastCpuUsage = cpuUsage;
        
        // Convert to percentage (microseconds to percentage)
        return Math.min(100, (totalDiff / 1000000) * 100);
    }
    
    /**
     * Collect disk metrics
     */
    async collectDiskMetrics() {
        try {
            const stats = await fs.stat('.');
            // This is a simplified disk usage calculation
            // In production, you might want to use a library like 'diskusage'
            this.metrics.system.disk.used = 0; // Placeholder
            this.metrics.system.disk.total = 40 * 1024 * 1024 * 1024; // 40GB as per requirements
            this.metrics.system.disk.percentage = 0; // Placeholder
        } catch (error) {
            logger.error('Error collecting disk metrics', error);
        }
    }
    
    /**
     * Collect application metrics
     */
    collectApplicationMetrics() {
        // This would be populated by the application
        // For now, we'll use placeholder values
        if (!this.metrics.application.requests.total) {
            this.metrics.application.requests.total = 0;
        }
    }
    
    /**
     * Collect database metrics
     */
    async collectDatabaseMetrics() {
        try {
            if (this.dbPool && typeof this.dbPool.pool === 'object') {
                const pool = this.dbPool.pool;
                
                this.metrics.database.connections.active = pool._allConnections?.length || 0;
                this.metrics.database.connections.idle = pool._freeConnections?.length || 0;
                this.metrics.database.connections.total = this.metrics.database.connections.active + this.metrics.database.connections.idle;
            }
        } catch (error) {
            logger.error('Error collecting database metrics', error);
        }
    }
    
    /**
     * Set database pool for monitoring
     */
    setDatabasePool(pool) {
        this.dbPool = pool;
    }
    
    /**
     * Record request metrics
     */
    recordRequest(responseTime, success = true) {
        const metrics = this.metrics.application;
        
        metrics.requests.total++;
        if (success) {
            metrics.requests.completed++;
        } else {
            metrics.requests.failed++;
        }
        
        // Update response time metrics
        metrics.responseTime.average = 
            (metrics.responseTime.average * (metrics.requests.completed - 1) + responseTime) / 
            metrics.requests.completed;
        
        metrics.responseTime.min = Math.min(metrics.responseTime.min, responseTime);
        metrics.responseTime.max = Math.max(metrics.responseTime.max, responseTime);
    }
    
    /**
     * Record database query metrics
     */
    recordQuery(responseTime, success = true) {
        const metrics = this.metrics.database;
        
        metrics.queries.total++;
        if (!success) {
            metrics.queries.failed++;
        }
        
        if (responseTime > 1000) { // Slow query threshold
            metrics.queries.slow++;
        }
        
        // Update response time metrics
        metrics.responseTime.average = 
            (metrics.responseTime.average * (metrics.queries.total - 1) + responseTime) / 
            metrics.queries.total;
        
        metrics.responseTime.min = Math.min(metrics.responseTime.min, responseTime);
        metrics.responseTime.max = Math.max(metrics.responseTime.max, responseTime);
    }
    
    /**
     * Record error
     */
    recordError(type, error) {
        this.metrics.application.errors.count++;
        this.metrics.application.errors.lastError = {
            type,
            message: error.message,
            timestamp: new Date().toISOString(),
            stack: error.stack
        };
        
        this.emit('errorRecorded', { type, error });
    }
    
    /**
     * Check for alerts
     */
    checkAlerts() {
        const thresholds = this.options.alertThresholds;
        
        // Memory alert
        if (this.metrics.system.memory.used > thresholds.memory) {
            this.triggerAlert('memory', {
                current: this.metrics.system.memory.used,
                threshold: thresholds.memory,
                percentage: this.metrics.system.memory.percentage
            });
        }
        
        // CPU alert
        if (this.metrics.system.cpu.usage > thresholds.cpu) {
            this.triggerAlert('cpu', {
                current: this.metrics.system.cpu.usage,
                threshold: thresholds.cpu
            });
        }
        
        // Disk alert
        if (this.metrics.system.disk.used > thresholds.disk) {
            this.triggerAlert('disk', {
                current: this.metrics.system.disk.used,
                threshold: thresholds.disk,
                percentage: this.metrics.system.disk.percentage
            });
        }
        
        // Response time alert
        if (this.metrics.application.responseTime.average > thresholds.responseTime) {
            this.triggerAlert('responseTime', {
                current: this.metrics.application.responseTime.average,
                threshold: thresholds.responseTime
            });
        }
        
        // Database connections alert
        if (this.metrics.database.connections.active > thresholds.dbConnections) {
            this.triggerAlert('dbConnections', {
                current: this.metrics.database.connections.active,
                threshold: thresholds.dbConnections
            });
        }
    }
    
    /**
     * Trigger alert
     */
    triggerAlert(type, data) {
        const alertKey = `${type}_${Math.floor(Date.now() / this.options.alertCooldown)}`;
        
        if (this.alerts.has(alertKey)) {
            return; // Alert already triggered in this cooldown period
        }
        
        const alert = {
            type,
            severity: this.getAlertSeverity(type),
            message: this.getAlertMessage(type, data),
            data,
            timestamp: new Date().toISOString(),
            id: alertKey
        };
        
        this.alerts.set(alertKey, alert);
        
        // Log alert
        this.logAlert(alert);
        
        // Emit alert event
        this.emit('alert', alert);
        
        logger.warn('ALERT', { severity: alert.severity.toUpperCase(), message: alert.message });
    }
    
    /**
     * Get alert severity
     */
    getAlertSeverity(type) {
        const severityMap = {
            memory: 'critical',
            cpu: 'warning',
            disk: 'critical',
            responseTime: 'warning',
            dbConnections: 'warning'
        };
        
        return severityMap[type] || 'info';
    }
    
    /**
     * Get alert message
     */
    getAlertMessage(type, data) {
        const messages = {
            memory: `High memory usage: ${this.formatBytes(data.current)} (${data.percentage.toFixed(1)}%)`,
            cpu: `High CPU usage: ${data.current.toFixed(1)}%`,
            disk: `High disk usage: ${this.formatBytes(data.current)} (${data.percentage.toFixed(1)}%)`,
            responseTime: `Slow response time: ${data.current.toFixed(2)}ms`,
            dbConnections: `High database connections: ${data.current}/${data.threshold}`
        };
        
        return messages[type] || `Alert: ${type}`;
    }
    
    /**
     * Log alert to file
     */
    async logAlert(alert) {
        try {
            const logEntry = `${alert.timestamp} [${alert.severity.toUpperCase()}] ${alert.type}: ${alert.message}\n`;
            await fs.appendFile(this.options.logFile, logEntry);
        } catch (error) {
            logger.error('Failed to log alert', error);
        }
    }
    
    /**
     * Get current metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            timestamp: new Date().toISOString(),
            uptime: Date.now() - this.startTime
        };
    }
    
    /**
     * Get alerts
     */
    getAlerts() {
        return Array.from(this.alerts.values()).sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
    }
    
    /**
     * Clear old alerts
     */
    clearOldAlerts() {
        const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
        
        for (const [key, alert] of this.alerts) {
            if (new Date(alert.timestamp).getTime() < cutoff) {
                this.alerts.delete(key);
            }
        }
    }
    
    /**
     * Format bytes
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const BYTES_PER_KB = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const unitIndex = Math.floor(Math.log(bytes) / Math.log(BYTES_PER_KB));
        return parseFloat((bytes / Math.pow(BYTES_PER_KB, unitIndex)).toFixed(2)) + ' ' + sizes[unitIndex];
    }
    
    /**
     * Get system health status
     */
    getHealthStatus() {
        const metrics = this.metrics;
        const thresholds = this.options.alertThresholds;
        
        let status = 'healthy';
        const issues = [];
        
        if (metrics.system.memory.used > thresholds.memory) {
            status = 'critical';
            issues.push('High memory usage');
        }
        
        if (metrics.system.cpu.usage > thresholds.cpu) {
            status = status === 'healthy' ? 'warning' : status;
            issues.push('High CPU usage');
        }
        
        if (metrics.system.disk.used > thresholds.disk) {
            status = 'critical';
            issues.push('High disk usage');
        }
        
        if (metrics.application.responseTime.average > thresholds.responseTime) {
            status = status === 'healthy' ? 'warning' : status;
            issues.push('Slow response time');
        }
        
        if (metrics.database.connections.active > thresholds.dbConnections) {
            status = status === 'healthy' ? 'warning' : status;
            issues.push('High database connections');
        }
        
        return {
            status,
            issues,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Cleanup resources
     */
    cleanup() {
        this.stop();
        this.clearOldAlerts();
        logger.info('System Monitor cleaned up');
    }
}

export default SystemMonitor;
