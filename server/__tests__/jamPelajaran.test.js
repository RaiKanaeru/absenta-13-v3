/**
 * Jam Pelajaran Validation Tests
 * 
 * Tests for lesson schedule validation logic.
 * Run with: npm test
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';

// ============================================================
// MOCK: Jam Pelajaran Validation Functions
// ============================================================

const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
const MIN_JAM_KE = 1;
const MAX_JAM_KE = 15;

/**
 * Validate time format (HH:MM or HH:MM:SS)
 */
function isValidTimeFormat(time) {
    if (!time || typeof time !== 'string') return false;
    return TIME_REGEX.test(time);
}

/**
 * Validate time logic (mulai < selesai)
 */
function isValidTimeRange(jamMulai, jamSelesai) {
    if (!jamMulai || !jamSelesai) return false;
    const start = jamMulai.replace(/:/g, '');
    const end = jamSelesai.replace(/:/g, '');
    return parseInt(start) < parseInt(end);
}

/**
 * Validate jam_ke range
 */
function isValidJamKe(jamKe) {
    if (jamKe === undefined || jamKe === null) return false;
    const num = parseInt(jamKe);
    return !isNaN(num) && num >= MIN_JAM_KE && num <= MAX_JAM_KE;
}

/**
 * Validate duplicate jam_ke in array
 */
function hasDuplicateJamKe(jamPelajaranArray) {
    const seen = new Set();
    for (const item of jamPelajaranArray) {
        if (seen.has(item.jam_ke)) return true;
        seen.add(item.jam_ke);
    }
    return false;
}

// ============================================================
// TESTS
// ============================================================

describe('Time Format Validation', () => {
    it('should accept HH:MM format', () => {
        assert.strictEqual(isValidTimeFormat('07:30'), true);
        assert.strictEqual(isValidTimeFormat('12:00'), true);
        assert.strictEqual(isValidTimeFormat('23:59'), true);
    });

    it('should accept H:MM format', () => {
        assert.strictEqual(isValidTimeFormat('7:30'), true);
        assert.strictEqual(isValidTimeFormat('9:00'), true);
    });

    it('should accept HH:MM:SS format', () => {
        assert.strictEqual(isValidTimeFormat('07:30:00'), true);
        assert.strictEqual(isValidTimeFormat('12:00:45'), true);
    });

    it('should reject invalid hours', () => {
        assert.strictEqual(isValidTimeFormat('25:00'), false);
        assert.strictEqual(isValidTimeFormat('24:00'), false);
    });

    it('should reject invalid minutes', () => {
        assert.strictEqual(isValidTimeFormat('12:60'), false);
        assert.strictEqual(isValidTimeFormat('12:99'), false);
    });

    it('should reject invalid format', () => {
        assert.strictEqual(isValidTimeFormat('1230'), false);
        assert.strictEqual(isValidTimeFormat('12-30'), false);
        assert.strictEqual(isValidTimeFormat(''), false);
        assert.strictEqual(isValidTimeFormat(null), false);
    });
});

describe('Time Range Validation', () => {
    it('should accept valid range (mulai < selesai)', () => {
        assert.strictEqual(isValidTimeRange('07:00', '07:45'), true);
        assert.strictEqual(isValidTimeRange('08:00', '12:00'), true);
    });

    it('should reject invalid range (mulai >= selesai)', () => {
        assert.strictEqual(isValidTimeRange('12:00', '12:00'), false);
        assert.strictEqual(isValidTimeRange('13:00', '12:00'), false);
    });

    it('should handle edge cases', () => {
        assert.strictEqual(isValidTimeRange('00:00', '23:59'), true);
        assert.strictEqual(isValidTimeRange('23:58', '23:59'), true);
    });

    it('should reject null/empty values', () => {
        assert.strictEqual(isValidTimeRange(null, '12:00'), false);
        assert.strictEqual(isValidTimeRange('07:00', null), false);
    });
});

describe('Jam Ke Range Validation', () => {
    it('should accept valid jam_ke (1-15)', () => {
        assert.strictEqual(isValidJamKe(1), true);
        assert.strictEqual(isValidJamKe(8), true);
        assert.strictEqual(isValidJamKe(15), true);
    });

    it('should reject jam_ke below minimum', () => {
        assert.strictEqual(isValidJamKe(0), false);
        assert.strictEqual(isValidJamKe(-1), false);
    });

    it('should reject jam_ke above maximum', () => {
        assert.strictEqual(isValidJamKe(16), false);
        assert.strictEqual(isValidJamKe(100), false);
    });

    it('should reject null/undefined', () => {
        assert.strictEqual(isValidJamKe(null), false);
        assert.strictEqual(isValidJamKe(undefined), false);
    });

    it('should accept string numbers', () => {
        assert.strictEqual(isValidJamKe('5'), true);
        assert.strictEqual(isValidJamKe('10'), true);
    });
});

describe('Duplicate Jam Ke Detection', () => {
    it('should detect no duplicates', () => {
        const items = [
            { jam_ke: 1 },
            { jam_ke: 2 },
            { jam_ke: 3 }
        ];
        assert.strictEqual(hasDuplicateJamKe(items), false);
    });

    it('should detect duplicates', () => {
        const items = [
            { jam_ke: 1 },
            { jam_ke: 2 },
            { jam_ke: 2 }
        ];
        assert.strictEqual(hasDuplicateJamKe(items), true);
    });

    it('should handle empty array', () => {
        assert.strictEqual(hasDuplicateJamKe([]), false);
    });
});

console.log('Run tests with: npm test');
