import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    isPresent,
    isAbsent,
    getAbsenceCategory,
    normalizeStatus
} from '../attendanceConstants.js';

describe('attendanceConstants helpers', () => {
    describe('isPresent', () => {
        it('returns true for present statuses and short codes', () => {
            assert.equal(isPresent('Hadir'), true);
            assert.equal(isPresent('Dispen'), true);
            assert.equal(isPresent('H'), true);
            assert.equal(isPresent('D'), true);
            assert.equal(isPresent('T'), true);
        });

        it('trims whitespace before checking', () => {
            assert.equal(isPresent('  Hadir  '), true);
            assert.equal(isPresent('\nD'), true);
        });

        it('is case sensitive and rejects nullish/empty values', () => {
            assert.equal(isPresent('hadir'), false);
            assert.equal(isPresent(''), false);
            assert.equal(isPresent(null), false);
        });
    });

    describe('isAbsent', () => {
        it('returns true for full statuses and short codes', () => {
            assert.equal(isAbsent('Sakit'), true);
            assert.equal(isAbsent('Izin'), true);
            assert.equal(isAbsent('Alpa'), true);
            assert.equal(isAbsent('Alpha'), true);
            assert.equal(isAbsent('Tidak Hadir'), true);
            assert.equal(isAbsent('S'), true);
            assert.equal(isAbsent('I'), true);
            assert.equal(isAbsent('A'), true);
        });

        it('handles trimmed inputs', () => {
            assert.equal(isAbsent('  S  '), true);
            assert.equal(isAbsent('\tIzin'), true);
        });

        it('is case sensitive and guards against empty values', () => {
            assert.equal(isAbsent('sakit'), false);
            assert.equal(isAbsent(''), false);
            assert.equal(isAbsent(undefined), false);
        });
    });

    describe('getAbsenceCategory', () => {
        it('categorizes sickness, permission, and alpha variants', () => {
            assert.equal(getAbsenceCategory('Sakit'), 'S');
            assert.equal(getAbsenceCategory(' S '), 'S');
            assert.equal(getAbsenceCategory('Izin'), 'I');
            assert.equal(getAbsenceCategory('I'), 'I');
            assert.equal(getAbsenceCategory('Alpa'), 'A');
            assert.equal(getAbsenceCategory('Alpha'), 'A');
            assert.equal(getAbsenceCategory('A'), 'A');
            assert.equal(getAbsenceCategory('Tanpa Keterangan'), 'A');
        });

        it('returns null for unknown, empty, or mismatched case inputs', () => {
            assert.equal(getAbsenceCategory('hadir'), null);
            assert.equal(getAbsenceCategory(''), null);
            assert.equal(getAbsenceCategory(null), null);
        });
    });

    describe('normalizeStatus', () => {
        it('maps short codes to full status names case-insensitively', () => {
            assert.equal(normalizeStatus('H'), 'Hadir');
            assert.equal(normalizeStatus('h'), 'Hadir');
            assert.equal(normalizeStatus(' T '), 'Terlambat');
            assert.equal(normalizeStatus('\nS'), 'Sakit');
            assert.equal(normalizeStatus('i'), 'Izin');
            assert.equal(normalizeStatus('a'), 'Alpa');
            assert.equal(normalizeStatus('d'), 'Dispen');
        });

        it('returns trimmed original values when no mapping exists', () => {
            assert.equal(normalizeStatus(' Hadir '), 'Hadir');
            assert.equal(normalizeStatus('izin'), 'izin');
        });

        it('returns null for missing or empty values', () => {
            assert.equal(normalizeStatus(''), null);
            assert.equal(normalizeStatus(undefined), null);
        });
    });
});
