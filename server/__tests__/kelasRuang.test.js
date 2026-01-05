/**
 * Kelas & Ruang Controller Tests
 * 
 * Tests for class and room validation and business logic.
 * Run with: npm test
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';

// ============================================================
// MOCK: Kelas Validation Logic
// ============================================================

/**
 * Extract tingkat from class name (e.g., "X IPA 1" -> "X")
 */
function extractTingkat(namaKelas) {
    if (!namaKelas || typeof namaKelas !== 'string') {
        return null;
    }
    return namaKelas.split(' ')[0];
}

/**
 * Validate kode_ruang format (max 10 chars, uppercase)
 */
function validateKodeRuang(kodeRuang) {
    if (!kodeRuang || typeof kodeRuang !== 'string') {
        return { valid: false, error: 'Kode ruang wajib diisi' };
    }
    
    const kodeUpper = kodeRuang.toUpperCase().trim();
    if (kodeUpper.length > 10) {
        return { 
            valid: false, 
            error: 'Kode ruang maksimal 10 karakter',
            maxLength: 10,
            actualLength: kodeUpper.length
        };
    }
    
    return { valid: true, value: kodeUpper };
}

/**
 * Safe delete check - returns reasons why delete cannot proceed
 */
function canDeleteKelas(siswaCount, jadwalCount) {
    const reasons = [];
    
    if (siswaCount > 0) {
        reasons.push({
            reason: 'has_students',
            count: siswaCount,
            message: 'Kelas masih memiliki siswa'
        });
    }
    
    if (jadwalCount > 0) {
        reasons.push({
            reason: 'has_jadwal',
            count: jadwalCount,
            message: 'Kelas masih memiliki jadwal'
        });
    }
    
    return {
        canDelete: reasons.length === 0,
        reasons
    };
}

// ============================================================
// TESTS: Kelas
// ============================================================

describe('Kelas - Tingkat Extraction', () => {
    it('should extract X from "X IPA 1"', () => {
        assert.strictEqual(extractTingkat('X IPA 1'), 'X');
    });

    it('should extract XI from "XI RPL 2"', () => {
        assert.strictEqual(extractTingkat('XI RPL 2'), 'XI');
    });

    it('should extract XII from "XII TKJ 3"', () => {
        assert.strictEqual(extractTingkat('XII TKJ 3'), 'XII');
    });

    it('should return null for empty string', () => {
        assert.strictEqual(extractTingkat(''), null);
    });

    it('should return null for null input', () => {
        assert.strictEqual(extractTingkat(null), null);
    });
});

describe('Kelas - Safe Delete Check', () => {
    it('should allow delete when no dependencies', () => {
        const result = canDeleteKelas(0, 0);
        assert.strictEqual(result.canDelete, true);
        assert.strictEqual(result.reasons.length, 0);
    });

    it('should block delete when has students', () => {
        const result = canDeleteKelas(5, 0);
        assert.strictEqual(result.canDelete, false);
        assert.ok(result.reasons.some(r => r.reason === 'has_students'));
    });

    it('should block delete when has jadwal', () => {
        const result = canDeleteKelas(0, 3);
        assert.strictEqual(result.canDelete, false);
        assert.ok(result.reasons.some(r => r.reason === 'has_jadwal'));
    });

    it('should report both reasons when has both', () => {
        const result = canDeleteKelas(5, 3);
        assert.strictEqual(result.canDelete, false);
        assert.strictEqual(result.reasons.length, 2);
    });
});

// ============================================================
// TESTS: Ruang
// ============================================================

describe('Ruang - Kode Validation', () => {
    it('should validate and uppercase valid code', () => {
        const result = validateKodeRuang('lab-rpl');
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.value, 'LAB-RPL');
    });

    it('should reject empty code', () => {
        const result = validateKodeRuang('');
        assert.strictEqual(result.valid, false);
    });

    it('should reject code longer than 10 chars', () => {
        const result = validateKodeRuang('VERYLONGCODE');
        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.maxLength, 10);
    });

    it('should accept exactly 10 chars', () => {
        const result = validateKodeRuang('ABCDEFGHIJ');
        assert.strictEqual(result.valid, true);
    });
});

console.log('Run tests with: npm test');
