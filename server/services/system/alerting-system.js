/**
 * Alerting System
 * Phase 6: Email alerts, SMS alerts, Auto-recovery, Alert escalation
 */

import { EventEmitter } from 'events';
import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';

class AlertingSystem extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            email: {
                enabled: options.email?.enabled || false,
                host: options.email?.host || 'smtp.gmail.com',
                port: options.email?.port || 587,
                secure: options.email?.secure || false,
                auth: {
                    user: options.email?.auth?.user || '',
                    pass: options.email?.auth?.pass || ''
                },
                from: options.email?.from || 'noreply@absenta.com',
                to: options.email?.to || []
            },
            sms: {
                enabled: options.sms?.enabled || false,
                provider: options.sms?.provider || 'twilio',
                accountSid: options.sms?.accountSid || '',
                authToken: options.sms?.authToken || '',
                from: options.sms?.from || '',
                to: options.sms?.to || []
            },
            escalation: {
                enabled: options.escalation?.enabled || true,
                levels: options.escalation?.levels || [
                    { severity: 'warning', delay: 300000, channels: ['email'] }, // 5 minutes
                    { severity: 'critical', delay: 60000, channels: ['email', 'sms'] }, // 1 minute
                    { severity: 'emergency', delay: 0, channels: ['email', 'sms'] } // Immediate
                ]
            },
            autoRecovery: {
                enabled: options.autoRecovery?.enabled || true,
                actions: options.autoRecovery?.actions || {
                    memory: ['restart_workers', 'clear_cache'],
                    cpu: ['reduce_connections', 'enable_circuit_breaker'],
                    disk: ['cleanup_logs', 'archive_old_data'],
                    responseTime: ['enable_caching', 'reduce_timeout']
                }
            },
            logFile: options.logFile || 'logs/alerting.log',
            ...options
        };
        
        this.alertHistory = new Map();
        this.escalationTimers = new Map();
        this.emailTransporter = null;
        this.smsClient = null;
        
        // Initialize services
        this.initializeServices();
        
        // Ensure log directory exists
        this.ensureLogDirectory();
        
        console.log('🚨 Alerting System initialized');
    }
    
    /**
     * Initialize email and SMS services
     */
    async initializeServices() {
        // Initialize email transporter
        if (this.options.email.enabled) {
            try {
                this.emailTransporter = nodemailer.createTransporter({
                    host: this.options.email.host,
                    port: this.options.email.port,
                    secure: this.options.email.secure,
                    auth: this.options.email.auth
                });
                
                // Verify connection
                await this.emailTransporter.verify();
                console.log('✅ Email service initialized');
            } catch (error) {
                console.error('❌ Failed to initialize email service:', error);
                this.options.email.enabled = false;
            }
        }
        
        // Initialize SMS service
        if (this.options.sms.enabled) {
            try {
                // For Twilio (you would need to install twilio package)
                // const twilio = require('twilio');
                // this.smsClient = twilio(this.options.sms.accountSid, this.options.sms.authToken);
                console.log('📱 SMS service would be initialized here (requires twilio package)');
            } catch (error) {
                console.error('❌ Failed to initialize SMS service:', error);
                this.options.sms.enabled = false;
            }
        }
    }
    
    /**
     * Ensure log directory exists
     */
    async ensureLogDirectory() {
        try {
            const logDir = path.dirname(this.options.logFile);
            await fs.mkdir(logDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create log directory:', error);
        }
    }
    
    /**
     * Process alert
     */
    async processAlert(alert) {
        try {
            // Log alert
            await this.logAlert(alert);
            
            // Store in history
            this.alertHistory.set(alert.id, {
                ...alert,
                processed: true,
                processedAt: new Date().toISOString()
            });
            
            // Determine escalation level
            const escalationLevel = this.getEscalationLevel(alert.severity);
            
            if (escalationLevel) {
                // Schedule escalation
                this.scheduleEscalation(alert, escalationLevel);
                
                // Send immediate alerts for emergency
                if (alert.severity === 'emergency') {
                    await this.sendImmediateAlerts(alert, escalationLevel.channels);
                }
            }
            
            // Attempt auto-recovery
            if (this.options.autoRecovery.enabled) {
                await this.attemptAutoRecovery(alert);
            }
            
            // Emit alert processed event
            this.emit('alertProcessed', alert);
            
        } catch (error) {
            console.error('Error processing alert:', error);
            this.emit('alertProcessingError', { alert, error });
        }
    }
    
    /**
     * Get escalation level for severity
     */
    getEscalationLevel(severity) {
        return this.options.escalation.levels.find(level => level.severity === severity);
    }
    
    /**
     * Schedule escalation
     */
    scheduleEscalation(alert, escalationLevel) {
        if (escalationLevel.delay === 0) {
            return; // Immediate escalation already handled
        }
        
        const timerId = setTimeout(async () => {
            await this.sendEscalatedAlerts(alert, escalationLevel.channels);
            this.escalationTimers.delete(alert.id);
        }, escalationLevel.delay);
        
        this.escalationTimers.set(alert.id, timerId);
    }
    
    /**
     * Send immediate alerts
     */
    async sendImmediateAlerts(alert, channels) {
        for (const channel of channels) {
            try {
                switch (channel) {
                    case 'email':
                        await this.sendEmailAlert(alert);
                        break;
                    case 'sms':
                        await this.sendSMSAlert(alert);
                        break;
                }
            } catch (error) {
                console.error(`Failed to send ${channel} alert:`, error);
            }
        }
    }
    
    /**
     * Send escalated alerts
     */
    async sendEscalatedAlerts(alert, channels) {
        // Check if alert is still active
        const currentAlert = this.alertHistory.get(alert.id);
        if (!currentAlert || currentAlert.resolved) {
            return; // Alert already resolved
        }
        
        // Send escalated alerts
        for (const channel of channels) {
            try {
                switch (channel) {
                    case 'email':
                        await this.sendEmailAlert(alert, true);
                        break;
                    case 'sms':
                        await this.sendSMSAlert(alert, true);
                        break;
                }
            } catch (error) {
                console.error(`Failed to send escalated ${channel} alert:`, error);
            }
        }
    }
    
    /**
     * Send email alert
     */
    async sendEmailAlert(alert, escalated = false) {
        if (!this.options.email.enabled || !this.emailTransporter) {
            return;
        }
        
        const subject = `[${alert.severity.toUpperCase()}] ${escalated ? 'ESCALATED: ' : ''}${alert.type} Alert`;
        const html = this.generateEmailTemplate(alert, escalated);
        
        const mailOptions = {
            from: this.options.email.from,
            to: this.options.email.to.join(', '),
            subject,
            html
        };
        
        await this.emailTransporter.sendMail(mailOptions);
        console.log(`📧 Email alert sent: ${alert.type}`);
    }
    
    /**
     * Send SMS alert
     */
    async sendSMSAlert(alert, escalated = false) {
        if (!this.options.sms.enabled || !this.smsClient) {
            return;
        }
        
        const message = `[${alert.severity.toUpperCase()}] ${escalated ? 'ESCALATED: ' : ''}${alert.message}`;
        
        for (const to of this.options.sms.to) {
            try {
                // This would be the actual SMS sending code
                // await this.smsClient.messages.create({
                //     body: message,
                //     from: this.options.sms.from,
                //     to: to
                // });
                console.log(`📱 SMS alert would be sent to ${to}: ${message}`);
            } catch (error) {
                console.error(`Failed to send SMS to ${to}:`, error);
            }
        }
    }
    
    /**
     * Generate email template
     */
    generateEmailTemplate(alert, escalated = false) {
        const severityColor = {
            warning: '#f59e0b',
            critical: '#ef4444',
            emergency: '#dc2626'
        }[alert.severity] || '#6b7280';
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f9fafb; }
                    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    .header { background: ${severityColor}; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .alert-details { background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0; }
                    .footer { background: #f9fafb; padding: 15px; text-align: center; color: #6b7280; font-size: 12px; }
                    .escalated { background: #fef2f2; border: 1px solid #fecaca; padding: 10px; border-radius: 6px; margin: 10px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚨 System Alert</h1>
                        ${escalated ? '<div class="escalated"><strong>ESCALATED ALERT</strong></div>' : ''}
                    </div>
                    <div class="content">
                        <h2>Alert Details</h2>
                        <div class="alert-details">
                            <p><strong>Type:</strong> ${alert.type}</p>
                            <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
                            <p><strong>Message:</strong> ${alert.message}</p>
                            <p><strong>Timestamp:</strong> ${alert.timestamp}</p>
                        </div>
                        
                        <h3>System Data</h3>
                        <div class="alert-details">
                            <pre>${JSON.stringify(alert.data, null, 2)}</pre>
                        </div>
                        
                        <p>Please investigate this issue immediately.</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated alert from the Absenta Monitoring System.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }
    
    /**
     * Attempt auto-recovery
     */
    async attemptAutoRecovery(alert) {
        const recoveryActions = this.options.autoRecovery.actions[alert.type];
        
        if (!recoveryActions) {
            return;
        }
        
        console.log(`🔧 Attempting auto-recovery for ${alert.type}...`);
        
        for (const action of recoveryActions) {
            try {
                await this.executeRecoveryAction(action, alert);
                console.log(`✅ Recovery action executed: ${action}`);
            } catch (error) {
                console.error(`❌ Recovery action failed: ${action}`, error);
            }
        }
    }
    
    /**
     * Execute recovery action
     */
    async executeRecoveryAction(action, alert) {
        switch (action) {
            case 'restart_workers':
                // This would restart worker processes
                console.log('🔄 Restarting workers...');
                break;
                
            case 'clear_cache':
                // This would clear application cache
                console.log('🧹 Clearing cache...');
                break;
                
            case 'reduce_connections':
                // This would reduce database connections
                console.log('📉 Reducing database connections...');
                break;
                
            case 'enable_circuit_breaker':
                // This would enable circuit breaker
                console.log('🔴 Enabling circuit breaker...');
                break;
                
            case 'cleanup_logs':
                // This would cleanup old log files
                console.log('📝 Cleaning up logs...');
                break;
                
            case 'archive_old_data':
                // This would archive old data
                console.log('📦 Archiving old data...');
                break;
                
            case 'enable_caching':
                // This would enable caching
                console.log('💾 Enabling caching...');
                break;
                
            case 'reduce_timeout':
                // This would reduce request timeout
                console.log('⏱️ Reducing timeout...');
                break;
                
            default:
                console.log(`Unknown recovery action: ${action}`);
        }
        
        // Emit recovery action event
        this.emit('recoveryActionExecuted', { action, alert });
    }
    
    /**
     * Resolve alert
     */
    resolveAlert(alertId, resolution = 'manual') {
        const alert = this.alertHistory.get(alertId);
        if (!alert) {
            return false;
        }
        
        alert.resolved = true;
        alert.resolvedAt = new Date().toISOString();
        alert.resolution = resolution;
        
        // Cancel escalation timer
        const timer = this.escalationTimers.get(alertId);
        if (timer) {
            clearTimeout(timer);
            this.escalationTimers.delete(alertId);
        }
        
        console.log(`✅ Alert resolved: ${alertId}`);
        this.emit('alertResolved', alert);
        
        return true;
    }
    
    /**
     * Log alert
     */
    async logAlert(alert) {
        try {
            const logEntry = `${alert.timestamp} [${alert.severity.toUpperCase()}] ${alert.type}: ${alert.message}\n`;
            await fs.appendFile(this.options.logFile, logEntry);
        } catch (error) {
            console.error('Failed to log alert:', error);
        }
    }
    
    /**
     * Get alert history
     */
    getAlertHistory(limit = 100) {
        return Array.from(this.alertHistory.values())
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }
    
    /**
     * Get active alerts
     */
    getActiveAlerts() {
        return Array.from(this.alertHistory.values())
            .filter(alert => !alert.resolved)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
    
    /**
     * Get alert statistics
     */
    getAlertStatistics() {
        const alerts = Array.from(this.alertHistory.values());
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const stats = {
            total: alerts.length,
            active: alerts.filter(a => !a.resolved).length,
            resolved: alerts.filter(a => a.resolved).length,
            last24h: alerts.filter(a => new Date(a.timestamp) > last24h).length,
            bySeverity: {
                warning: alerts.filter(a => a.severity === 'warning').length,
                critical: alerts.filter(a => a.severity === 'critical').length,
                emergency: alerts.filter(a => a.severity === 'emergency').length
            },
            byType: {}
        };
        
        // Count by type
        alerts.forEach(alert => {
            stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
        });
        
        return stats;
    }
    
    /**
     * Cleanup old alerts
     */
    cleanupOldAlerts() {
        const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
        
        for (const [key, alert] of this.alertHistory) {
            if (new Date(alert.timestamp).getTime() < cutoff) {
                this.alertHistory.delete(key);
            }
        }
        
        console.log('🧹 Old alerts cleaned up');
    }
    
    /**
     * Cleanup resources
     */
    cleanup() {
        // Clear all escalation timers
        for (const timer of this.escalationTimers.values()) {
            clearTimeout(timer);
        }
        this.escalationTimers.clear();
        
        // Close email transporter
        if (this.emailTransporter) {
            this.emailTransporter.close();
        }
        
        this.cleanupOldAlerts();
        console.log('🧹 Alerting System cleaned up');
    }
}

export default AlertingSystem;
