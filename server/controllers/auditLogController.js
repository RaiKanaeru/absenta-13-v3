import { sendSuccessResponse, sendErrorResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';
import db from '../config/db.js';

const logger = createLogger('AuditLog');

/**
 * Get Audit Logs with pagination and filtering
 * GET /api/admin/audit-logs
 */
export const getAuditLogs = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page, 10) || 1;
        const limit = Number.parseInt(req.query.limit, 10) || 20;
        const offset = (page - 1) * limit;
        
        const { search, action, target, startDate, endDate, adminId } = req.query;

        // Base query
        let query = `
            SELECT id, admin_name, action, target, details, ip_address, created_at 
            FROM admin_activity_logs 
            WHERE 1=1
        `;
        let countQuery = `SELECT COUNT(*) as total FROM admin_activity_logs WHERE 1=1`;
        
        const params = [];
        
        // Dynamic Filtering
        if (search) {
            const searchClause = ` AND (admin_name LIKE ? OR target LIKE ? OR details LIKE ?)`;
            query += searchClause;
            countQuery += searchClause;
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        if (action) {
            query += ` AND action = ?`;
            countQuery += ` AND action = ?`;
            params.push(action);
        }

        if (target) {
            query += ` AND target = ?`;
            countQuery += ` AND target = ?`;
            params.push(target);
        }

        if (adminId) {
            query += ` AND admin_id = ?`;
            countQuery += ` AND admin_id = ?`;
            params.push(adminId);
        }

        if (startDate) {
            query += ` AND created_at >= ?`;
            countQuery += ` AND created_at >= ?`;
            params.push(`${startDate} 00:00:00`);
        }

        if (endDate) {
            query += ` AND created_at <= ?`;
            countQuery += ` AND created_at <= ?`;
            params.push(`${endDate} 23:59:59`);
        }

        // Add sorting and pagination to main query
        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        
        // Execute count query first
        const [countResult] = await db.query(countQuery, params.slice(0, params.length)); // Use params without limit/offset
        const totalItems = countResult[0].total;
        
        // Execute main query
        const [rows] = await db.query(query, [...params, limit, offset]);

        // Parse JSON details if string
        const logs = rows.map(row => ({
            ...row,
            details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details
        }));

        return sendSuccessResponse(res, {
            logs,
            pagination: {
                page,
                limit,
                totalItems,
                totalPages: Math.ceil(totalItems / limit)
            }
        });

    } catch (error) {
        logger.dbError('getAuditLogs', error);
        return sendErrorResponse(res, error, 'Gagal memuat data log aktivitas');
    }
};

/**
 * Get Filter Options (Actions and Targets list)
 * GET /api/admin/audit-logs/filters
 */
export const getAuditLogFilters = async (req, res) => {
    try {
        const [actions] = await db.execute('SELECT action FROM admin_activity_logs GROUP BY action ORDER BY action');
        const [targets] = await db.execute('SELECT target FROM admin_activity_logs GROUP BY target ORDER BY target');

        return sendSuccessResponse(res, {
            actions: actions.map(a => a.action),
            targets: targets.map(t => t.target)
        });
    } catch (error) {
        logger.dbError('getAuditLogFilters', error);
        return sendErrorResponse(res, error, 'Gagal memuat opsi filter');
    }
};
