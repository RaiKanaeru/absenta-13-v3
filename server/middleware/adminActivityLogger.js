import AdminAuditService from '../services/system/admin-audit-service.js';

/**
 * Middleware to automatically log admin activities
 * Only logs successful state-changing requests (POST, PUT, PATCH, DELETE)
 */
export const adminActivityLogger = (req, res, next) => {
    // Only intercept state-changing methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return next();
    }

    // Only intercept admin routes
    if (!req.originalUrl.startsWith('/api/admin')) {
        return next();
    }

    // Capture original end function to intercept response body (optional/advanced)
    // For now, we'll just log based on request data upon 'finish'

    res.on('finish', () => {
        // Only log successful operations (2xx) or redirects (3xx)
        if (res.statusCode >= 400) {
            return; 
        }

        // Determine user (assuming auth middleware ran before this)
        const user = req.user;
        if (!user) return; // Should not happen in protected admin routes

        // Determine Action
        let action = 'UNKNOWN';
        switch (req.method) {
            case 'POST': action = 'CREATE'; break;
            case 'PUT': 
            case 'PATCH': action = 'UPDATE'; break;
            case 'DELETE': action = 'DELETE'; break;
        }

        // Determine Target from URL
        // Example: /api/admin/siswa/123 -> parts: ['', 'api', 'admin', 'siswa', '123']
        const parts = req.originalUrl.split('?')[0].split('/'); 
        let target = 'UNKNOWN';
        let targetId = null;

        if (parts.length >= 4) {
            target = parts[3].toUpperCase(); // SISWA, GURU, MAPEL
            
            // Try to find numeric ID in URL
            if (parts.length >= 5) {
                const possibleId = Number(parts[4]);
                if (!isNaN(possibleId)) {
                    targetId = possibleId;
                }
            }
        }

        // Handle specific endpoints that don't follow REST standard
        if (req.originalUrl.includes('/import')) {
            action = 'IMPORT';
            target = 'DATA_IMPORT';
        } else if (req.originalUrl.includes('/export')) {
            action = 'EXPORT'; // Usually GET, but sometimes POST for complex filters
        } else if (req.originalUrl.includes('/login')) {
            action = 'LOGIN';
        }

        // Construct details
        const details = {
            method: req.method,
            url: req.originalUrl,
            body_summary: summarizeBody(req.body)
        };

        // Fire logging service
        AdminAuditService.log({
            adminId: user.id || user.userId, // Adjust based on your JWT payload structure
            adminName: user.nama || user.username || 'Admin',
            action,
            target,
            targetId,
            details,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        });
    });

    next();
};

/**
 * Helper to summarize request body (remove sensitive data, truncate long fields)
 */
function summarizeBody(body) {
    if (!body) return null;
    
    const summary = { ...body };
    
    // Remove sensitive fields
    if (summary.password) summary.password = '[REDACTED]';
    if (summary.token) summary.token = '[REDACTED]';
    
    // Truncate long strings (like base64 images)
    for (const key in summary) {
        if (typeof summary[key] === 'string' && summary[key].length > 200) {
            summary[key] = summary[key].substring(0, 50) + '... [TRUNCATED]';
        }
    }
    
    return summary;
}
