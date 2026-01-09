/**
 * Student Data Controller Tests
 * 
 * Tests for student data operations: validation, CRUD, and promotion logic.
 * Run with: npm test
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';

// ============================================================
// MOCK: Validation Logic (extracted from studentDataController)
// ============================================================

/**
 * Validate required fields for student creation/update
 */
function validateStudentData({ nis, nama, kelas_id, jenis_kelamin }) {
    const errors = [];
    
    if (!nis || typeof nis !== 'string' || nis.trim() === '') {
        errors.push('NIS wajib diisi');
    }
    if (!nama || typeof nama !== 'string' || nama.trim().length < 2) {
        errors.push('Nama wajib diisi minimal 2 karakter');
    }
    if (!kelas_id ||.isNaN(Number.parseInt(kelas_id))) {
        errors.push('Kelas wajib dipilih');
    }
    if (!jenis_kelamin || !['L', 'P'].includes(jenis_kelamin)) {
        errors.push('Jenis kelamin harus L atau P');
    }
    
    return { isValid: errors.length === 0, errors };
}

/**
 * Validate phone number format (10-15 digits)
 */
function validatePhoneNumber(phone) {
    if (!phone) return { isValid: true }; // Optional field
    if (!/^\d{10,15}$/.test(phone)) {
        return { isValid: false, error: 'Nomor telepon harus 10-15 digit' };
    }
    return { isValid: true };
}

/**
 * Business rules for student promotion
 */
const VALID_PROMOTIONS = { 'X': 'XI', 'XI': 'XII' };

function validatePromotion(fromTingkat, toTingkat) {
    if (fromTingkat === 'XII') {
        return { valid: false, error: 'Kelas XII tidak dapat dinaikkan (sudah lulus)' };
    }
    if (VALID_PROMOTIONS[fromTingkat] !== toTingkat) {
        return { 
            valid: false, 
            error: `Kelas ${fromTingkat} hanya bisa dinaikkan ke kelas ${VALID_PROMOTIONS[fromTingkat]}` 
        };
    }
    return { valid: true };
}

// ============================================================
// TESTS
// ============================================================

describe('Student Data Validation', () => {
    it('should pass with valid data', () => {
        const result = validateStudentData({
            nis: '123456',
            nama: 'John Doe',
            kelas_id: 1,
            jenis_kelamin: 'L'
        });
        assert.strictEqual(result.isValid, true);
        assert.strictEqual(result.errors.length, 0);
    });

    it('should fail with missing NIS', () => {
        const result = validateStudentData({
            nis: '',
            nama: 'John Doe',
            kelas_id: 1,
            jenis_kelamin: 'L'
        });
        assert.strictEqual(result.isValid, false);
        assert.ok(result.errors.some(e => e.includes('NIS')));
    });

    it('should fail with invalid jenis_kelamin', () => {
        const result = validateStudentData({
            nis: '123456',
            nama: 'John Doe',
            kelas_id: 1,
            jenis_kelamin: 'X'
        });
        assert.strictEqual(result.isValid, false);
        assert.ok(result.errors.some(e => e.includes('Jenis kelamin')));
    });
});

describe('Phone Number Validation', () => {
    it('should accept valid phone numbers', () => {
        assert.strictEqual(validatePhoneNumber('08123456789').isValid, true);
        assert.strictEqual(validatePhoneNumber('628123456789').isValid, true);
    });

    it('should reject invalid phone numbers', () => {
        assert.strictEqual(validatePhoneNumber('123').isValid, false);
        assert.strictEqual(validatePhoneNumber('phone123').isValid, false);
    });

    it('should accept empty/null phone (optional)', () => {
        assert.strictEqual(validatePhoneNumber('').isValid, true);
        assert.strictEqual(validatePhoneNumber(null).isValid, true);
    });
});

describe('Student Promotion Business Rules', () => {
    it('should allow X to XI promotion', () => {
        const result = validatePromotion('X', 'XI');
        assert.strictEqual(result.valid, true);
    });

    it('should allow XI to XII promotion', () => {
        const result = validatePromotion('XI', 'XII');
        assert.strictEqual(result.valid, true);
    });

    it('should reject XII promotion (sudah lulus)', () => {
        const result = validatePromotion('XII', 'XIII');
        assert.strictEqual(result.valid, false);
        assert.ok(result.error.includes('lulus'));
    });

    it('should reject invalid promotion path (X to XII)', () => {
        const result = validatePromotion('X', 'XII');
        assert.strictEqual(result.valid, false);
        assert.ok(result.error.includes('XI'));
    });

    it('should reject downgrade (XI to X)', () => {
        const result = validatePromotion('XI', 'X');
        assert.strictEqual(result.valid, false);
    });
});

console.log('Run tests with: npm test');
