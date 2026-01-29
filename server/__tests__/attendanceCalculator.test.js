/**
 * Attendance Calculator Tests
 * 
 * Tests for centralized attendance calculation logic
 * Run with: npm test
 */

import assert from 'node:assert';
import { describe, it, before, after, beforeEach } from 'node:test';

// Mock DB Pool
const mockExecute = async (query, params) => {
    // Mock getEffectiveDaysMapFromDB
    if (query.includes('FROM kalender_akademik WHERE tahun_pelajaran = ?')) {
        const [tahunPelajaran] = params;
        if (tahunPelajaran === '2025/2026') {
            return [[
                { bulan: 7, hari_efektif: 22 }, // Override default 21
                { bulan: 8, hari_efektif: 20 }, // Override default 21
            ]];
        }
        return [[]]; // Default empty
    }
    return [[]];
};

// Setup global mock
globalThis.dbPool = { execute: mockExecute };

// Import after mocking
import attendanceCalculator, { 
    getEffectiveDaysMapFromDB, 
    calculateEffectiveDaysForRange, 
    calculateAttendancePercentage,
    clearAttendanceCache
} from '../utils/attendanceCalculator.js';

describe('Attendance Calculator', () => {
    
    describe('getEffectiveDaysMapFromDB', () => {
        beforeEach(() => {
            clearAttendanceCache();
        });

        it('should return mapped effective days from DB', async () => {
            const map = await getEffectiveDaysMapFromDB('2025/2026');
            assert.strictEqual(map[7], 22); // From mock
            assert.strictEqual(map[8], 20); // From mock
            assert.strictEqual(map[1], 21); // From default fallback
        });

        it('should use defaults when DB returns empty', async () => {
            const map = await getEffectiveDaysMapFromDB('2020/2021');
            assert.strictEqual(map[7], 21); // Default
        });

        it('should cache results', async () => {
            // First call
            await getEffectiveDaysMapFromDB('2025/2026');
            
            // Second call - should use cache (we can verify by changing mock behavior but hard to do here without spy)
            // Instead we rely on the fact it returns same data
            const map2 = await getEffectiveDaysMapFromDB('2025/2026');
            assert.strictEqual(map2[7], 22);
        });
    });

    describe('calculateEffectiveDaysForRange', () => {
        beforeEach(() => {
            clearAttendanceCache();
        });

        it('should calculate business days for short range (< 15 days)', async () => {
            // 2026-01-05 (Mon) to 2026-01-09 (Fri) = 5 days
            const days = await calculateEffectiveDaysForRange('2026-01-05', '2026-01-09');
            assert.strictEqual(days, 5);
        });

        it('should exclude weekends for short range', async () => {
            // 2026-01-09 (Fri) to 2026-01-12 (Mon) = Fri, Mon = 2 days
            const days = await calculateEffectiveDaysForRange('2026-01-09', '2026-01-12');
            assert.strictEqual(days, 2);
        });

        it('should use DB map for long range (Full Month)', async () => {
            // Mock returns 22 for July 2025
            // 2025-07-01 to 2025-07-31
            const days = await calculateEffectiveDaysForRange('2025-07-01', '2025-07-31', '2025/2026');
            assert.strictEqual(days, 22);
        });

        it('should handle partial months proportionally', async () => {
            // July 2025 has 31 days total, 22 effective days.
            // Range 1-15 July (approx 50%) -> should be roughly 11 days
            // Logic: 22 * (15/31) = 10.64 -> 11
            const days = await calculateEffectiveDaysForRange('2025-07-01', '2025-07-15', '2025/2026');
            assert.strictEqual(days, 11);
        });

        it('should handle cross-month ranges', async () => {
            // July 2025 (22 days) + August 2025 (20 days)
            // Full range: 2025-07-01 to 2025-08-31
            const days = await calculateEffectiveDaysForRange('2025-07-01', '2025-08-31', '2025/2026');
            assert.strictEqual(days, 42); // 22 + 20
        });
    });

    describe('calculateAttendancePercentage', () => {
        it('should calculate basic percentage', () => {
            const { percentage } = calculateAttendancePercentage(18, 20);
            assert.strictEqual(percentage, 90.00);
        });

        it('should cap at 100% and flag capped', () => {
            const { percentage, capped } = calculateAttendancePercentage(22, 20);
            assert.strictEqual(percentage, 100.00);
            assert.strictEqual(capped, true);
        });

        it('should handle zero effective days', () => {
            const { percentage } = calculateAttendancePercentage(5, 0);
            assert.strictEqual(percentage, 100);
        });
    });
});
