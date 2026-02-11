import { createLogger } from '../../utils/logger.js';
import db from '../../config/db.js';

const logger = createLogger('AdminAudit');

class AdminAuditService {
    constructor() {
        this.cache = globalThis.cacheSystem;
    }

    /**
     * Log admin activity
     * @param {Object} params
     * @param {number} params.adminId - ID of the admin user
     * @param {string} params.adminName - Name of the admin
     * @param {string} params.action - Action type (CREATE, UPDATE, DELETE, etc.)
     * @param {string} params.target - Target entity (Siswa, Guru, etc.)
     * @param {number} [params.targetId] - ID of the target entity
     * @param {Object} [params.details] - Additional details (JSON)
     * @param {string} [params.ip] - IP Address
     * @param {string} [params.userAgent] - User Agent
     */
    async log(params) {
        // Fire and forget - don't await this in the main request flow usually, 
        // but here we make it async so the caller can decide.
        try {
            const {
                adminId,
                adminName,
                action,
                target,
                targetId = null,
                details = {},
                ip = null,
                userAgent = null
            } = params;

            const query = `
                INSERT INTO admin_activity_logs 
                (admin_id, admin_name, action, target, target_id, details, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const detailsJson = JSON.stringify(details);

            // Use the centralized db module
            try {
                await db.execute(query, [
                    adminId,
                    adminName,
                    action,
                    target,
                    targetId,
                    detailsJson,
                    ip,
                    userAgent
                ]);
            } catch (dbError) {
                logger.warn('Database pool not available for audit logging', dbError.message);
            }

            // Smart Cache Invalidation
            if (['CREATE', 'UPDATE', 'DELETE'].includes(action.toUpperCase())) {
                this.invalidateRelatedCache(target);
            }

        } catch (error) {
            // Audit logging should not crash the app, but must be logged to file
            logger.error('Failed to save audit log', error, params);
        }
    }

    /**
     * Invalidate cache based on target entity
     */
    async invalidateRelatedCache(target) {
        if (!this.cache || !this.cache.isConnected) return;

        const entity = target.toLowerCase();
        
        try {
            // Map entity to cache keys
            switch (entity) {
                case 'siswa':
                case 'student':
                    await this.cache.deletePattern('students:*');
                    await this.cache.deletePattern('classes:*'); // Class counts might change
                    await this.cache.deletePattern('analytics:*'); // Total students count
                    logger.debug('Invalidated student caches');
                    break;
                
                case 'guru':
                case 'teacher':
                    await this.cache.deletePattern('teachers:*');
                    await this.cache.deletePattern('schedules:*');
                    await this.cache.deletePattern('analytics:*');
                    logger.debug('Invalidated teacher caches');
                    break;

                case 'kelas':
                case 'class':
                    await this.cache.deletePattern('classes:*');
                    await this.cache.deletePattern('students:*');
                    logger.debug('Invalidated class caches');
                    break;

                case 'jadwal':
                case 'schedule':
                    await this.cache.deletePattern('schedules:*');
                    await this.cache.deletePattern('attendance:*'); // Attendance might be invalid if schedule changes
                    logger.debug('Invalidated schedule caches');
                    break;
                
                case 'absensi':
                case 'attendance':
                    await this.cache.deletePattern('attendance:*');
                    await this.cache.deletePattern('analytics:*');
                    logger.debug('Invalidated attendance caches');
                    break;

                default:
                    // For unknown entities, maybe just clear analytics
                    await this.cache.deletePattern('analytics:*');
            }
        } catch (error) {
            logger.error('Failed to invalidate cache', error);
        }
    }
}

export default new AdminAuditService();
