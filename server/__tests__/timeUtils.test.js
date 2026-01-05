/**
 * Time Utilities Tests
 * 
 * Tests for WIB timezone functions in timeUtils.js
 * Run with: npm test
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';

// ============================================================
// MOCK: Time Utilities (from /server/utils/timeUtils.js)
// ============================================================

const HARI_INDONESIA = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const HARI_SEKOLAH = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function getHariFromDate(date = new Date()) {
    return HARI_INDONESIA[date.getDay()];
}

function formatWIBDate(date = null) {
    const targetDate = date || new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const parts = formatter.formatToParts(targetDate);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';

    return `${year}-${month}-${day}`;
}

function parseDateStringWIB(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
    }
    const dateTimeStr = `${dateStr}T00:00:00+07:00`;
    return new Date(dateTimeStr);
}

function getDaysDifferenceWIB(date1, date2) {
    const d1 = typeof date1 === 'string' ? parseDateStringWIB(date1) : date1;
    const d2 = typeof date2 === 'string' ? parseDateStringWIB(date2) : date2;
    const diffTime = d2.getTime() - d1.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function formatWIBTimeWithSeconds(date = null) {
    const targetDate = date || new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(targetDate);
    const hour = parts.find(p => p.type === 'hour')?.value || '00';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    const second = parts.find(p => p.type === 'second')?.value || '00';

    return `${hour}:${minute}:${second}`;
}

// ============================================================
// TESTS
// ============================================================

describe('HARI Constants', () => {
    it('should have 7 days in HARI_INDONESIA', () => {
        assert.strictEqual(HARI_INDONESIA.length, 7);
    });

    it('should start with Minggu (Sunday)', () => {
        assert.strictEqual(HARI_INDONESIA[0], 'Minggu');
    });

    it('should have 6 school days', () => {
        assert.strictEqual(HARI_SEKOLAH.length, 6);
    });

    it('should not include Minggu in school days', () => {
        assert.ok(!HARI_SEKOLAH.includes('Minggu'));
    });
});

describe('getHariFromDate', () => {
    it('should return correct day for known date', () => {
        // 2026-01-05 is a Monday (Senin)
        const monday = new Date(2026, 0, 5);
        assert.strictEqual(getHariFromDate(monday), 'Senin');
    });

    it('should return Minggu for Sunday', () => {
        const sunday = new Date(2026, 0, 4);
        assert.strictEqual(getHariFromDate(sunday), 'Minggu');
    });
});

describe('formatWIBDate', () => {
    it('should return YYYY-MM-DD format', () => {
        const result = formatWIBDate(new Date());
        assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
    });

    it('should format correctly for known date', () => {
        const testDate = new Date('2026-01-05T00:00:00+07:00');
        const result = formatWIBDate(testDate);
        assert.strictEqual(result, '2026-01-05');
    });
});

describe('parseDateStringWIB', () => {
    it('should parse valid date string', () => {
        const result = parseDateStringWIB('2026-01-05');
        assert.ok(result instanceof Date);
    });

    it('should throw for invalid format', () => {
        assert.throws(() => parseDateStringWIB('01-05-2026'), /Invalid date format/);
        assert.throws(() => parseDateStringWIB('2026/01/05'), /Invalid date format/);
        assert.throws(() => parseDateStringWIB('invalid'), /Invalid date format/);
    });
});

describe('getDaysDifferenceWIB', () => {
    it('should return 0 for same date', () => {
        const result = getDaysDifferenceWIB('2026-01-05', '2026-01-05');
        assert.strictEqual(result, 0);
    });

    it('should return positive for later date', () => {
        const result = getDaysDifferenceWIB('2026-01-05', '2026-01-10');
        assert.strictEqual(result, 5);
    });

    it('should return negative for earlier date', () => {
        const result = getDaysDifferenceWIB('2026-01-10', '2026-01-05');
        assert.strictEqual(result, -5);
    });
});

describe('formatWIBTimeWithSeconds', () => {
    it('should return HH:mm:ss format', () => {
        const result = formatWIBTimeWithSeconds(new Date());
        assert.match(result, /^\d{2}:\d{2}:\d{2}$/);
    });
});

console.log('Run tests with: npm test');
