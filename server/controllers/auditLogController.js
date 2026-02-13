import { sendSuccessResponse, sendErrorResponse } from '../utils/errorHandler.js';
import { createLogger } from '../utils/logger.js';
import db from '../config/db.js';

const logger = createLogger('AuditLog');

const CREATE_AUDIT_LOGS_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS admin_activity_logs (
        id INT NOT NULL AUTO_INCREMENT,
        admin_id INT NOT NULL,
        admin_name VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL COMMENT 'CREATE, UPDATE, DELETE, LOGIN, EXPORT',
        target VARCHAR(50) NOT NULL COMMENT 'Table or Entity name',
        target_id INT DEFAULT NULL COMMENT 'ID of the affected entity',
        details JSON DEFAULT NULL COMMENT 'Snapshot of changed data',
        ip_address VARCHAR(45) DEFAULT NULL,
        user_agent VARCHAR(255) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_admin_id (admin_id),
        INDEX idx_action (action),
        INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

let tableEnsured = false;
let tableEnsurePromise = null;

const parseAuditDetails = (details) => {
    if (typeof details !== 'string') {
        return details;
    }

    try {
        return JSON.parse(details);
    } catch {
        return details;
    }
};

const ensureAuditLogTable = async () => {
    if (tableEnsured) {
        return;
    }

    if (!tableEnsurePromise) {
        tableEnsurePromise = (async () => {
            try {
                await db.execute(CREATE_AUDIT_LOGS_TABLE_SQL);
                tableEnsured = true;
            } catch (error) {
                logger.dbError('ensureAuditLogTable', error);
            } finally {
                tableEnsurePromise = null;
            }
        })();
    }

    await tableEnsurePromise;
};

/**
 * Get Audit Logs with pagination and filtering
 * GET /api/admin/audit-logs
 */
export const getAuditLogs = async (req, res) => {
    try {
        await ensureAuditLogTable();

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
            details: parseAuditDetails(row.details)
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
        await ensureAuditLogTable();

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
