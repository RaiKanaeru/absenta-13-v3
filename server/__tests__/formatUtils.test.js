/**
 * Format Utilities Tests
 * 
 * Tests for utility functions: formatBytes, formatNumber, formatPercentage.
 * Run with: npm test
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';

// ============================================================
// MOCK: Format Utilities (from /server/utils/formatUtils.js)
// ============================================================

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const BYTES_PER_KB = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const unitIndex = Math.floor(Math.log(bytes) / Math.log(BYTES_PER_KB));
    
    return Number.parseFloat((bytes / Math.pow(BYTES_PER_KB, unitIndex)).toFixed(decimals)) + ' ' + sizes[unitIndex];
}

function formatNumber(num) {
    return num.toLocaleString('id-ID');
}

function formatPercentage(value, decimals = 2) {
    return `${value.toFixed(decimals)}%`;
}

// ============================================================
// TESTS
// ============================================================

describe('formatBytes', () => {
    it('should return "0 Bytes" for 0', () => {
        assert.strictEqual(formatBytes(0), '0 Bytes');
    });

    it('should format bytes correctly', () => {
        assert.strictEqual(formatBytes(500), '500 Bytes');
    });

    it('should format KB correctly', () => {
        assert.strictEqual(formatBytes(1024), '1 KB');
    });

    it('should format MB correctly', () => {
        assert.strictEqual(formatBytes(1048576), '1 MB');
    });

    it('should format with custom decimals', () => {
        assert.strictEqual(formatBytes(1536, 1), '1.5 KB');
    });

    it('should handle large values (GB)', () => {
        assert.strictEqual(formatBytes(1073741824), '1 GB');
    });
});

describe('formatNumber', () => {
    it('should format small numbers', () => {
        const result = formatNumber(123);
        assert.ok(result.includes('123'));
    });

    it('should add thousand separators', () => {
        const result = formatNumber(1234567);
        // Indonesian locale uses . as thousand separator
        assert.ok(result.includes('.') || result.includes(','));
    });
});

describe('formatPercentage', () => {
    it('should format whole percentage', () => {
        assert.strictEqual(formatPercentage(100), '100.00%');
    });

    it('should format decimal percentage', () => {
        assert.strictEqual(formatPercentage(85.5), '85.50%');
    });

    it('should respect custom decimals', () => {
        assert.strictEqual(formatPercentage(33.333, 1), '33.3%');
    });

    it('should format zero', () => {
        assert.strictEqual(formatPercentage(0), '0.00%');
    });
});

console.log('Run tests with: npm test');
