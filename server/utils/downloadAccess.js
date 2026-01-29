/**
 * Download Access Utilities
 * Helpers for secure file naming and access checks
 */

const USER_ID_PATTERN = /_u(\d+)_/;

function sanitizeSegment(value) {
    return String(value)
        .trim()
        .replaceAll(/[^A-Za-z0-9._-]/g, '-')
        .replaceAll(/-+/g, '-')
        .replaceAll(/^[-_.]+|[-_.]+$/g, '');
}

export function buildDownloadFilename({ prefix, userId, parts = [], timestamp = null, extension = 'xlsx' }) {
    const normalizedUserId = Number.parseInt(userId, 10);
    if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) {
        throw new Error('Invalid userId for download filename');
    }

    const safePrefix = sanitizeSegment(prefix || 'download') || 'download';
    const safeParts = parts
        .filter(part => part !== undefined && part !== null && String(part).trim() !== '')
        .map(part => sanitizeSegment(part));

    const safeTimestamp = timestamp || new Date().toISOString().replaceAll(/[:.]/g, '-');
    const suffix = safeParts.length > 0 ? `_${safeParts.join('_')}` : '';

    return `${safePrefix}_u${normalizedUserId}${suffix}_${safeTimestamp}.${extension}`;
}

export function extractUserIdFromFilename(filename) {
    if (typeof filename !== 'string') return null;
    const match = filename.match(USER_ID_PATTERN);
    if (!match) return null;
    const userId = Number.parseInt(match[1], 10);
    return Number.isFinite(userId) ? userId : null;
}

export function isFilenameOwnedByUser(filename, userId) {
    const ownerId = extractUserIdFromFilename(filename);
    if (!ownerId) return false;
    return Number(ownerId) === Number(userId);
}

export function isSafeFilename(filename) {
    if (typeof filename !== 'string' || filename.trim() === '') return false;
    const lower = filename.toLowerCase();
    if (lower.includes('%2e') || lower.includes('%2f') || lower.includes('%5c')) return false;
    if (filename.includes('/') || filename.includes('\\')) return false;
    if (filename.includes('..')) return false;
    return true;
}

export default {
    buildDownloadFilename,
    extractUserIdFromFilename,
    isFilenameOwnedByUser,
    isSafeFilename
};
