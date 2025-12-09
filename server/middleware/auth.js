import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'absenta-super-secret-key-2025';

// Middleware to authenticate JWT token
export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1] || req.cookies.token;

    if (!token) {
        // console.log('❌ Access denied: No token provided');
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // console.log('❌ Token verification failed:', err.message);
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        // console.log(`✅ Token verified for user: ${user.username} (${user.role})`);
        req.user = user;
        next();
    });
}

// Role-based access control middleware
export function requireRole(roles) {
    return (req, res, next) => {
        // console.log('🔍 requireRole check:', { userRole: req.user?.role, requiredRoles: roles });
        if (!req.user || !req.user.role) {
            // console.log('❌ No user or role found in request');
            return res.status(403).json({ error: 'User not authenticated' });
        }
        if (!roles.includes(req.user.role)) {
            // console.log('❌ Insufficient permissions:', { userRole: req.user.role, requiredRoles: roles });
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        // console.log('✅ Role check passed');
        next();
    };
}
