// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

console.log('ABSENTA Modern Server Starting...');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`API Base URL: ${process.env.API_BASE_URL || 'http://localhost:3001'}`);

import express from 'express';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import DDoSProtection from './server/utils/ddos-protection.js';
import rateLimit from 'express-rate-limit';

// Refactored Imports
import { initializeDatabase } from './server/services/system/initializer.js';
import { setupRoutes } from './server/routes/appRoutes.js';

// Middleware & Utils Imports
import { requestIdMiddleware, notFoundHandler, globalErrorHandler } from './server/middleware/globalErrorMiddleware.js';
import { formatWIBTime, getWIBTimestamp } from './server/utils/timeUtils.js';
import { 
    diagnoseCORS, 
    formatCORSErrorLog, 
    createCORSErrorResponse,
    CORS_ERROR_CODES 
} from './server/utils/corsErrorHandler.js';
import { initAutoAttendanceScheduler } from './server/services/system/autoAttendanceService.js';
import { adminActivityLogger } from './server/middleware/adminActivityLogger.js';

// Configuration from environment variables
const port = Number.parseInt(process.env.PORT) || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret';
const saltRounds = Number.parseInt(process.env.SALT_ROUNDS) || 10;
const uploadDir = process.env.UPLOAD_DIR || 'public/uploads';

// Validate critical environment variables in production
if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-insecure-secret') {
        console.error('CRITICAL: JWT_SECRET must be set in production!');
        process.exit(1);
    }
    if (!process.env.DB_PASSWORD) {
        console.warn('WARNING: DB_PASSWORD is empty in production!');
    }
}

// Ensure upload directory exists
mkdir(`${uploadDir}/letterheads`, { recursive: true }).catch(console.error);

// Multer configuration for logo upload
const uploadLogo = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, `${uploadDir}/letterheads/`);
        },
        filename: (req, file, cb) => {
            const timestamp = getWIBTimestamp();
            const extension = path.extname(file.originalname);
            const logoType = req.body.logoType || 'logo';
            cb(null, `${logoType}_${timestamp}${extension}`);
        }
    }),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error('Format file tidak didukung. Gunakan JPG, PNG, atau GIF'));
    }
});

const app = express();
app.set('trust proxy', 2);
app.disable('x-powered-by'); // Security: Hide server info

// ================================================
// CORS CONFIGURATION
// ================================================

// Parse allowed origins from environment
// ALWAYS include production domains to prevent CORS issues
const productionOrigins = [
    'https://absenta13.my.id',
    'https://www.absenta13.my.id',
    'https://api.absenta13.my.id'
];

const rawAllowedOrigins = process.env.ALLOWED_ORIGINS
    ? [...new Set([...process.env.ALLOWED_ORIGINS.split(','), ...productionOrigins])]
    : [
        ...productionOrigins,
        // Development domains
        'http://localhost:8080',
        'http://localhost:8081',
        'http://localhost:5173',
        'http://localhost:3000',
        // Network access
        'http://192.168.1.100:8080',
        'http://192.168.1.100:5173'
    ];

const allowedOrigins = rawAllowedOrigins.map(o => o.trim().replace(/\/$/, '')); // Normalize: remove trailing slash

console.log('CORS Allowed Origins:', allowedOrigins);

// Middleware setup

// CRITICAL: Manual CORS headers FIRST - ensures CORS works even if error occurs later
// This catches preflight OPTIONS and sets headers before any other middleware
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const method = req.method;
    const requestId = req.requestId || `req_${Date.now()}`;
    
    // Run comprehensive CORS diagnostics
    const diagnostic = diagnoseCORS({
        origin,
        allowedOrigins,
        method,
        headers: req.headers
    });
    
    // Attach diagnostic to request for debugging
    req.corsDiagnostic = diagnostic;

    if (diagnostic.allowed) {
        // Set CORS headers for allowed origins
        if (origin && allowedOrigins.includes(origin)) {
            res.header('Access-Control-Allow-Origin', origin);
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Client-ID');
            res.header('Access-Control-Expose-Headers', 'Content-Disposition, X-Request-ID, X-CORS-Debug');
            res.header('Access-Control-Allow-Credentials', 'true');
            res.header('Access-Control-Max-Age', '86400'); // 24 hours preflight cache
            res.header('X-CORS-Status', 'allowed');
        } else if (!origin) {
             // Allow non-browser requests (curl, mobile apps)
             res.header('Access-Control-Allow-Origin', '*'); 
        }
        
        // Handle preflight OPTIONS request
        if (method === 'OPTIONS') {
            console.log(`[CORS:${requestId}] Preflight OK - Origin: ${origin}`);
            return res.status(204).end();
        }
        
        return next();
    }

    // CORS not allowed - log detailed error
    console.error(formatCORSErrorLog(diagnostic));
    
    // Set debug headers for troubleshooting
    res.header('X-CORS-Status', 'blocked');
    res.header('X-CORS-Error-Code', diagnostic.errorCode);
    res.header('X-CORS-Fix', diagnostic.errorInfo?.fix || 'Check ALLOWED_ORIGINS');
    res.header('Access-Control-Allow-Origin', 'null');
    
    // Handle preflight for blocked origins
    if (method === 'OPTIONS') {
        const errorResponse = createCORSErrorResponse(diagnostic);
        return res.status(403).json(errorResponse);
    }
    
    // For non-preflight requests, continue but browser will block due to missing headers
    next();
});

// Security Headers middleware (CSP, HSTS, COOP, COEP) for PageSpeed optimization
app.use((req, res, next) => {
    // HSTS - Force HTTPS
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    
    // Content Security Policy
    res.header('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://static.cloudflareinsights.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://api.absenta13.my.id https://www.google-analytics.com https://static.cloudflareinsights.com",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'"
    ].join('; '));
    
    // Cross-Origin-Opener-Policy
    res.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    
    // X-Content-Type-Options
    res.header('X-Content-Type-Options', 'nosniff');
    
    // X-Frame-Options
    res.header('X-Frame-Options', 'SAMEORIGIN');
    
    // X-XSS-Protection
    res.header('X-XSS-Protection', '1; mode=block');
    
    // Referrer-Policy
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions-Policy
    res.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(requestIdMiddleware);  // Add request ID tracking for debugging

// Real-time Request Monitoring Middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const success = res.statusCode < 400;
        if (globalThis.systemMonitor) {
            globalThis.systemMonitor.recordRequest(duration, success);
        }
    });
    next();
});

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 2000 : 5000,
    message: 'Terlalu banyak request, coba lagi nanti.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// DDoS Protection middleware - enhanced anti-spam/DDoS
let ddosProtection = null;
if (process.env.ENABLE_DDOS_PROTECTION !== 'false') {
    ddosProtection = new DDoSProtection({
        maxRequestsPerWindow: process.env.NODE_ENV === 'production' ? 2000 : 5000,
        maxRequestsPerSecond: process.env.NODE_ENV === 'production' ? 100 : 200,
        spikeThreshold: process.env.NODE_ENV === 'production' ? 50 : 100,
        blockDurationMs: 300000 // 5 minutes
    });
    app.use(ddosProtection.middleware());
}

// Serve static files from public directory
app.use('/uploads', express.static(`${uploadDir}`));

// ================================================
// SECURITY MIDDLEWARE
// ================================================

// Security middleware
app.use((req, res, next) => {
    if (globalThis.securitySystem) {
        // Use the rate limit middleware from SecuritySystem
        globalThis.securitySystem.rateLimitMiddleware()(req, res, (err) => {
            if (err) {
                return res.status(500).json({ error: 'Security middleware error' });
            }

            // Input validation (skip for letterhead endpoints due to large base64 data)
            if (req.body && typeof req.body === 'object' && !req.path.includes('/letterhead')) {
                const validationResult = globalThis.securitySystem.validateInput(req.body, 'body');
                if (validationResult.violations && validationResult.violations.length > 0) {
                    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
                    globalThis.securitySystem.logSecurityEvent('input_validation_failed', {
                        ip: clientIP,
                        path: req.path,
                        method: req.method,
                        violations: validationResult.violations,
                        timestamp: formatWIBTime()
                    });

                    return res.status(400).json({
                        error: 'Invalid input',
                        message: 'Input validation failed',
                        violations: validationResult.violations
                    });
                }
            }

            // Audit logging
            const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
            globalThis.securitySystem.logSecurityEvent('request', {
                ip: clientIP,
                path: req.path,
                method: req.method,
                userAgent: req.get('User-Agent'),
                timestamp: formatWIBTime()
            });

            next();
        });
    } else {
        next();
    }
});

// ================================================
// HEALTH & DEBUG ENDPOINTS
// ================================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/api/debug/cors', (req, res) => {
    const origin = req.headers.origin;
    
    // Run full diagnostic
    const diagnostic = diagnoseCORS({
        origin,
        allowedOrigins,
        method: req.method,
        headers: req.headers
    });
    
    // Build comprehensive response
    res.json({
        status: diagnostic.allowed ? 'ok' : 'blocked',
        summary: {
            origin: origin || 'NO_ORIGIN_HEADER',
            allowed: diagnostic.allowed,
            errorCode: diagnostic.errorCode || null,
            errorTitle: diagnostic.errorInfo?.title || null,
            fix: diagnostic.errorInfo?.fix || null
        },
        diagnostic: {
            checks: diagnostic.checks,
            suggestions: diagnostic.suggestions
        },
        configuration: {
            allowedOrigins: allowedOrigins,
            totalOrigins: allowedOrigins.length,
            environment: process.env.NODE_ENV || 'development',
            envFile: process.env.ALLOWED_ORIGINS ? '.env (custom)' : 'defaults'
        },
        headers: {
            request: {
                origin: req.headers.origin || null,
                host: req.headers.host,
                referer: req.headers.referer || null,
                userAgent: req.headers['user-agent']
            },
            response: {
                'Access-Control-Allow-Origin': res.get('Access-Control-Allow-Origin') || 'not set',
                'Access-Control-Allow-Credentials': res.get('Access-Control-Allow-Credentials') || 'not set',
                'Access-Control-Allow-Methods': res.get('Access-Control-Allow-Methods') || 'not set',
                'Access-Control-Allow-Headers': res.get('Access-Control-Allow-Headers') || 'not set',
                'X-CORS-Status': res.get('X-CORS-Status') || 'not set'
            }
        },
        errorCodes: CORS_ERROR_CODES,
        documentation: {
            troubleshooting: '/docs/CORS-TROUBLESHOOTING.md',
            testScript: 'bash scripts/test-cors.sh production'
        },
        timestamp: formatWIBTime(),
        requestId: req.requestId || null
    });
});

// Test specific origin
app.get('/api/debug/cors/test', (req, res) => {
    const testOrigin = req.query.origin;
    
    if (!testOrigin) {
        return res.status(400).json({
            error: 'Missing origin parameter',
            usage: '/api/debug/cors/test?origin=https://example.com',
            example: '/api/debug/cors/test?origin=https://absenta13.my.id'
        });
    }
    
    const diagnostic = diagnoseCORS({
        origin: testOrigin,
        allowedOrigins,
        method: 'GET',
        headers: { origin: testOrigin }
    });
    
    res.json({
        testOrigin: testOrigin,
        result: diagnostic.allowed ? 'ALLOWED' : 'BLOCKED',
        errorCode: diagnostic.errorCode,
        errorInfo: diagnostic.errorInfo,
        checks: diagnostic.checks,
        suggestions: diagnostic.suggestions,
        fix: diagnostic.errorInfo?.fix || null
    });
});

app.options('/api/debug/cors', (req, res) => {
    // Preflight akan ditangani oleh middleware di atas
    res.status(204).end();
});

// ================================================
// ADMIN AUDIT TRAIL MIDDLEWARE
// ================================================
app.use(adminActivityLogger);

// ================================================
// SETUP ROUTES (MODULARIZED)
// ================================================

setupRoutes(app);

// ================================================
// GLOBAL ERROR HANDLERS (MUST BE AFTER ALL ROUTES)
// ================================================
app.use(notFoundHandler);  // Handle 404 - API routes not found
app.use(globalErrorHandler);  // Handle all unhandled errors

// ================================================
// SERVER STARTUP
// ================================================

try {
    await initializeDatabase(ddosProtection);
    // Initialize scheduled tasks (Cron Jobs)
    initAutoAttendanceScheduler();

    const server = app.listen(port, '0.0.0.0', () => {
        console.log(`[START] ABSENTA Modern Server is running on http://0.0.0.0:${port}`);
        console.log(`[NETWORK] Accessible from network: http://[YOUR_IP]:${port}`);
        console.log(`[INFO] Frontend should connect to this server`);
        console.log(`[DB] Database optimization: Connection pool active`);
    });

    // Graceful Shutdown
    const shutdown = async (signal) => {
        console.log(`\n${signal} received. Closing resources...`);
        try {
            if (globalThis.dbOptimization) {
                await globalThis.dbOptimization.close();
                console.log('Database connection pool closed.');
            }
            if (globalThis.systemMonitor) {
                // Save any pending metrics if needed
                console.log('System monitor stopped.');
            }
            server.close(() => {
                console.log('HTTP server closed.');
                process.exit(0);
            });
        } catch (err) {
            console.error('Error during shutdown:', err);
            process.exit(1);
        }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Global Error Handlers for Uncaught Exceptions/Rejections
    process.on('unhandledRejection', (err) => {
        console.error('[FATAL] UNHANDLED REJECTION! Shutting down...');
        console.error(err.name, err.message);
        console.error(err.stack);
        shutdown('UNHANDLED_REJECTION');
    });

    process.on('uncaughtException', (err) => {
        console.error('[FATAL] UNCAUGHT EXCEPTION! Shutting down...');
        console.error(err.name, err.message);
        console.error(err.stack);
        shutdown('UNCAUGHT_EXCEPTION');
    });

} catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
}
