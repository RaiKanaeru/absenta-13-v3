/**
 * CORS Error Handler & Diagnostics
 * =================================
 * Provides detailed error messages and diagnostics for CORS issues.
 * 
 * @module server/utils/corsErrorHandler
 */

import { formatWIBTime } from './timeUtils.js';
import { createLogger } from './logger.js';

const logger = createLogger('CORS');

/**
 * CORS Error Codes with detailed descriptions
 */
export const CORS_ERROR_CODES = {
    CORS_001: {
        code: 'CORS_001',
        title: 'Origin Not Whitelisted',
        description: 'Request origin is not in the allowed origins list',
        severity: 'ERROR',
        fix: 'Add the origin to ALLOWED_ORIGINS in .env file'
    },
    CORS_002: {
        code: 'CORS_002',
        title: 'Missing Origin Header',
        description: 'Request does not have Origin header (may be same-origin or non-browser)',
        severity: 'INFO',
        fix: 'This is normal for server-to-server requests'
    },
    CORS_003: {
        code: 'CORS_003',
        title: 'Preflight Failed',
        description: 'OPTIONS preflight request was rejected',
        severity: 'ERROR',
        fix: 'Check if origin is whitelisted and server is handling OPTIONS'
    },
    CORS_004: {
        code: 'CORS_004',
        title: 'Credentials Conflict',
        description: 'Cannot use credentials with wildcard (*) origin',
        severity: 'ERROR',
        fix: 'Use specific origin instead of wildcard when credentials are needed'
    },
    CORS_005: {
        code: 'CORS_005',
        title: 'Missing CORS Headers',
        description: 'Response does not contain required CORS headers',
        severity: 'ERROR',
        fix: 'Check middleware order - CORS middleware must run before route handlers'
    },
    CORS_006: {
        code: 'CORS_006',
        title: 'Duplicate CORS Headers',
        description: 'Multiple Access-Control-Allow-Origin headers detected',
        severity: 'WARNING',
        fix: 'Remove CORS headers from nginx if backend handles CORS'
    },
    CORS_007: {
        code: 'CORS_007',
        title: 'Method Not Allowed',
        description: 'HTTP method not in Access-Control-Allow-Methods',
        severity: 'ERROR',
        fix: 'Add the method to allowed methods list'
    },
    CORS_008: {
        code: 'CORS_008',
        title: 'Header Not Allowed',
        description: 'Request header not in Access-Control-Allow-Headers',
        severity: 'ERROR',
        fix: 'Add the header to allowed headers list'
    },
    CORS_009: {
        code: 'CORS_009',
        title: 'SSL/Protocol Mismatch',
        description: 'Origin protocol (http/https) does not match',
        severity: 'ERROR',
        fix: 'Ensure both frontend and API use same protocol (https in production)'
    },
    CORS_010: {
        code: 'CORS_010',
        title: 'Subdomain Mismatch',
        description: 'Subdomain variation not whitelisted',
        severity: 'ERROR',
        fix: 'Add all subdomain variations (www, api, etc.) to ALLOWED_ORIGINS'
    }
};

/**
 * Detailed CORS diagnostic result
 * @typedef {Object} CORSDiagnostic
 * @property {boolean} allowed - Whether the origin is allowed
 * @property {string} errorCode - CORS error code if any
 * @property {Object} details - Detailed diagnostic information
 * @property {string[]} suggestions - Fix suggestions
 */

/**
 * Analyze CORS request and provide detailed diagnostics
 * @param {Object} params - Diagnostic parameters
 * @param {string} params.origin - Request origin
 * @param {string[]} params.allowedOrigins - List of allowed origins
 * @param {string} params.method - HTTP method
 * @param {Object} params.headers - Request headers
 * @returns {CORSDiagnostic} Detailed diagnostic result
 */
export function diagnoseCORS({ origin, allowedOrigins, method, headers }) {
    const diagnostic = initializeDiagnostic({ origin, allowedOrigins, method, headers });

    // 1. Check for missing origin (server-to-server)
    if (!origin) {
        return markAsServerToServer(diagnostic);
    }

    const cleanOrigin = origin.replace(/\/$/, '');

    // 2. Check for direct matches (Exact, Clean, Wildcard)
    const matchResult = checkOriginMatch(origin, cleanOrigin, allowedOrigins);
    diagnostic.checks.push(...matchResult.checks);
    
    if (matchResult.isMatch) {
        return markAsAllowed(diagnostic);
    }

    // Origin not allowed - determine specific reason
    diagnostic.allowed = false;

    // 3. Check for protocol mismatch (HTTP vs HTTPS)
    const protocolCheck = checkProtocolMismatch(origin, allowedOrigins);
    if (protocolCheck) {
        return applyErrorToDiagnostic(diagnostic, protocolCheck);
    }

    // 4. Check for subdomain mismatch
    const subdomainCheck = checkSubdomainMismatch(origin, allowedOrigins);
    if (subdomainCheck) {
        return applyErrorToDiagnostic(diagnostic, subdomainCheck);
    }

    // 5. Default block (Not Whitelisted)
    return markAsBlocked(diagnostic, origin, allowedOrigins);
}

// ==========================================
// HELPER FUNCTIONS FOR DIAGNOSTICS
// ==========================================

function initializeDiagnostic({ origin, allowedOrigins, method, headers }) {
    return {
        allowed: false,
        errorCode: null,
        errorInfo: null,
        details: {
            timestamp: formatWIBTime(),
            origin: origin || 'NO_ORIGIN',
            cleanOrigin: origin ? origin.replace(/\/$/, '') : null,
            method: method,
            requestedHeaders: headers['access-control-request-headers'] || null,
            requestedMethod: headers['access-control-request-method'] || null,
            allowedOriginsCount: allowedOrigins.length,
            configuredOrigins: allowedOrigins
        },
        suggestions: [],
        checks: []
    };
}

function markAsServerToServer(diagnostic) {
    diagnostic.allowed = true;
    diagnostic.errorCode = 'CORS_002';
    diagnostic.errorInfo = CORS_ERROR_CODES.CORS_002;
    diagnostic.checks.push({
        check: 'Origin Header Present',
        passed: false,
        note: 'No Origin header - likely server-to-server request'
    });
    return diagnostic;
}

function checkOriginMatch(origin, cleanOrigin, allowedOrigins) {
    const exactMatch = allowedOrigins.includes(origin);
    const cleanMatch = allowedOrigins.includes(cleanOrigin);
    const wildcardMatch = allowedOrigins.includes('*');

    const checks = [
        {
            check: 'Exact Origin Match',
            passed: exactMatch,
            note: exactMatch ? `"${origin}" found in whitelist` : `"${origin}" NOT in whitelist`
        },
        {
            check: 'Clean Origin Match',
            passed: cleanMatch,
            note: cleanMatch ? `"${cleanOrigin}" found in whitelist` : `"${cleanOrigin}" NOT in whitelist`
        },
        {
            check: 'Wildcard Match',
            passed: wildcardMatch,
            note: wildcardMatch ? 'Wildcard (*) is enabled' : 'Wildcard (*) not enabled'
        }
    ];

    return { isMatch: exactMatch || cleanMatch || wildcardMatch, checks };
}

function markAsAllowed(diagnostic) {
    diagnostic.allowed = true;
    diagnostic.checks.push({
        check: 'CORS Allowed',
        passed: true,
        note: 'Origin is authorized'
    });
    return diagnostic;
}

function applyErrorToDiagnostic(diagnostic, errorData) {
    diagnostic.errorCode = errorData.errorCode;
    diagnostic.errorInfo = errorData.errorInfo;
    diagnostic.suggestions.push(...errorData.suggestions);
    diagnostic.checks.push(errorData.check);
    return diagnostic;
}

function checkProtocolMismatch(origin, allowedOrigins) {
    const originProtocol = origin.startsWith('https') ? 'https' : 'http';
    const oppositeProtocol = originProtocol === 'https' ? 'http' : 'https';
    const originWithOppositeProtocol = origin.replace(originProtocol, oppositeProtocol);
    
    if (allowedOrigins.includes(originWithOppositeProtocol)) {
        return {
            errorCode: 'CORS_009',
            errorInfo: CORS_ERROR_CODES.CORS_009,
            suggestions: [
                `Origin uses ${originProtocol} but whitelist has ${oppositeProtocol}`,
                `Change "${originWithOppositeProtocol}" to "${origin}" in ALLOWED_ORIGINS`,
                'Or add both http and https versions'
            ],
            check: {
                check: 'Protocol Match',
                passed: false,
                note: `Protocol mismatch: request=${originProtocol}, whitelist has ${oppositeProtocol}`
            }
        };
    }
    return null;
}

function checkSubdomainMismatch(origin, allowedOrigins) {
    const originHost = origin.replace(/https?:\/\//, '').replace(/:\d+$/, '');
    const isSubdomainIssue = allowedOrigins.some(allowed => {
        const allowedHost = allowed.replace(/https?:\/\//, '').replace(/:\d+$/, '');
        return originHost.endsWith(allowedHost.replace('www.', '')) ||
               allowedHost.endsWith(originHost.replace('www.', ''));
    });

    if (isSubdomainIssue) {
        return {
            errorCode: 'CORS_010',
            errorInfo: CORS_ERROR_CODES.CORS_010,
            suggestions: [
                `Subdomain "${originHost}" not explicitly whitelisted`,
                `Add "${origin}" to ALLOWED_ORIGINS in .env`,
                'Consider adding all variations: domain.com, www.domain.com, api.domain.com'
            ],
            check: {
                check: 'Subdomain Check',
                passed: false,
                note: `Subdomain variation not whitelisted`
            }
        };
    }
    return null;
}

function markAsBlocked(diagnostic, origin, allowedOrigins) {
    diagnostic.errorCode = 'CORS_001';
    diagnostic.errorInfo = CORS_ERROR_CODES.CORS_001;
    diagnostic.suggestions.push(
        `Add "${origin}" to ALLOWED_ORIGINS in .env file`,
        'Format: ALLOWED_ORIGINS=https://domain1.com,https://domain2.com',
        'Restart server after changing .env: pm2 restart absenta'
    );

    const similarOrigins = findSimilarOrigins(origin, allowedOrigins);
    if (similarOrigins.length > 0) {
        diagnostic.suggestions.push(
            `Similar origins in whitelist: ${similarOrigins.join(', ')}`,
            'Check for typos in origin configuration'
        );
    }
    
    return diagnostic;
}

/**
 * Find origins that are similar to the requested origin (for typo detection)
 * @param {string} origin - Requested origin
 * @param {string[]} allowedOrigins - List of allowed origins
 * @returns {string[]} List of similar origins
 */
function findSimilarOrigins(origin, allowedOrigins) {
    const similar = [];
    const originLower = origin.toLowerCase();
    
    for (const allowed of allowedOrigins) {
        const allowedLower = allowed.toLowerCase();
        
        // Levenshtein-like similarity (simple version)
        const similarity = calculateSimilarity(originLower, allowedLower);
        if (similarity > 0.7 && similarity < 1) {
            similar.push(allowed);
        }
    }
    
    return similar;
}

/**
 * Calculate string similarity (0-1)
 */
function calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

/**
 * Format CORS error for logging
 * @param {CORSDiagnostic} diagnostic - Diagnostic result
 * @returns {string} Formatted log message
 */
function appendCORSHeader(lines) {
    lines.push(
        '╔══════════════════════════════════════════════════════════════╗',
        '║                    CORS ERROR DETECTED                       ║',
        '╠══════════════════════════════════════════════════════════════╣'
    );
}

function appendCORSErrorInfo(lines, diagnostic) {
    if (!diagnostic.errorInfo) {
        return;
    }

    lines.push(
        `║ Error Code: ${diagnostic.errorCode.padEnd(48)}║`,
        `║ Error: ${diagnostic.errorInfo.title.padEnd(53)}║`,
        `║ Severity: ${diagnostic.errorInfo.severity.padEnd(50)}║`
    );
}

function appendCORSRequestInfo(lines, diagnostic) {
    lines.push(
        '╠══════════════════════════════════════════════════════════════╣',
        `║ Origin: ${(diagnostic.details.origin || 'N/A').substring(0, 52).padEnd(52)}║`,
        `║ Method: ${(diagnostic.details.method || 'N/A').padEnd(52)}║`,
        `║ Time: ${(diagnostic.details.timestamp || 'N/A').padEnd(54)}║`
    );
}

function appendCORSChecks(lines, checks = []) {
    if (checks.length === 0) {
        return;
    }

    lines.push(
        '╠══════════════════════════════════════════════════════════════╣',
        '║ Checks Performed:                                            ║'
    );
    checks.forEach((check) => {
        const icon = check.passed ? '✓' : '✗';
        const line = `║   ${icon} ${check.check}: ${check.passed ? 'PASS' : 'FAIL'}`.padEnd(63) + '║';
        lines.push(line);
    });
}

function splitSuggestionChunks(suggestion) {
    return suggestion.match(/.{1,56}/g) || [suggestion];
}

function appendCORSSuggestions(lines, suggestions = []) {
    if (suggestions.length === 0) {
        return;
    }

    lines.push(
        '╠══════════════════════════════════════════════════════════════╣',
        '║ Suggested Fixes:                                             ║'
    );
    suggestions.forEach((suggestion) => {
        splitSuggestionChunks(suggestion).forEach((chunk) => {
            lines.push(`║   → ${chunk.padEnd(56)}║`);
        });
    });
}

function appendCORSWhitelistedOrigins(lines, configuredOrigins = []) {
    lines.push(
        '╠══════════════════════════════════════════════════════════════╣',
        '║ Whitelisted Origins:                                         ║'
    );

    configuredOrigins.slice(0, 5).forEach((origin) => {
        lines.push(`║   • ${origin.substring(0, 56).padEnd(56)}║`);
    });

    if (configuredOrigins.length > 5) {
        const hiddenCount = configuredOrigins.length - 5;
        lines.push(`║   ... and ${hiddenCount.toString()} more`.padEnd(63) + '║');
    }
}

export function formatCORSErrorLog(diagnostic) {
    const lines = [];

    appendCORSHeader(lines);
    appendCORSErrorInfo(lines, diagnostic);
    appendCORSRequestInfo(lines, diagnostic);
    appendCORSChecks(lines, diagnostic.checks || []);
    appendCORSSuggestions(lines, diagnostic.suggestions || []);
    appendCORSWhitelistedOrigins(lines, diagnostic.details?.configuredOrigins || []);

    lines.push('╚══════════════════════════════════════════════════════════════╝');
    return lines.join('\n');
}

/**
 * Create CORS error response with detailed information
 * @param {CORSDiagnostic} diagnostic - Diagnostic result
 * @returns {Object} Error response object
 */
export function createCORSErrorResponse(diagnostic) {
    return {
        success: false,
        error: {
            code: diagnostic.errorCode,
            title: diagnostic.errorInfo?.title || 'CORS Error',
            message: diagnostic.errorInfo?.description || 'Cross-Origin request blocked',
            severity: diagnostic.errorInfo?.severity || 'ERROR'
        },
        diagnostic: {
            origin: diagnostic.details.origin,
            allowed: diagnostic.allowed,
            checks: diagnostic.checks,
            suggestions: diagnostic.suggestions
        },
        fix: diagnostic.errorInfo?.fix || 'Check CORS configuration',
        documentation: '/docs/CORS-TROUBLESHOOTING.md',
        timestamp: diagnostic.details.timestamp
    };
}

/**
 * CORS Middleware Factory with enhanced error handling
 * @param {Object} options - Middleware options
 * @param {string[]} options.allowedOrigins - List of allowed origins
 * @param {boolean} options.verbose - Enable verbose logging
 * @returns {Function} Express middleware
 */
export function createCORSMiddleware({ allowedOrigins, verbose = false }) {
    return (req, res, next) => {
        const origin = req.headers.origin;
        const method = req.method;
        const requestId = req.requestId || 'NO_REQUEST_ID';

        // Run diagnostics
        const diagnostic = diagnoseCORS({
            origin,
            allowedOrigins,
            method,
            headers: req.headers
        });

        // Attach diagnostic to request for later use
        req.corsDiagnostic = diagnostic;

        if (diagnostic.allowed) {
            // Set CORS headers for allowed origins
            if (origin) {
                res.header('Access-Control-Allow-Origin', origin);
                res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
                res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
                res.header('Access-Control-Expose-Headers', 'Content-Disposition, X-Request-ID, X-CORS-Debug');
                res.header('Access-Control-Allow-Credentials', 'true');
                res.header('Access-Control-Max-Age', '86400');
                
                // Debug header
                res.header('X-CORS-Debug', 'allowed');
            }

            // Handle preflight
            if (method === 'OPTIONS') {
                if (verbose) {
                    logger.info(`[CORS:${requestId}] Preflight OK - Origin: ${origin}`);
                }
                return res.status(204).end();
            }

            return next();
        }

        // CORS not allowed
        if (verbose || process.env.NODE_ENV !== 'production') {
            logger.error(formatCORSErrorLog(diagnostic));
        } else {
            // Minimal logging in production
            logger.warn(`[CORS:${requestId}] BLOCKED - Code: ${diagnostic.errorCode}, Origin: ${origin}`);
        }

        // Set debug headers even for blocked requests (helps debugging)
        res.header('X-CORS-Debug', 'blocked');
        res.header('X-CORS-Error-Code', diagnostic.errorCode);
        res.header('Access-Control-Allow-Origin', 'null');

        // Handle preflight for blocked origins
        if (method === 'OPTIONS') {
            return res.status(403).json(createCORSErrorResponse(diagnostic));
        }

        // For non-preflight requests from blocked origins
        // Still allow the request but without CORS headers (browser will block response)
        return next();
    };
}

export default {
    CORS_ERROR_CODES,
    diagnoseCORS,
    formatCORSErrorLog,
    createCORSErrorResponse,
    createCORSMiddleware
};
