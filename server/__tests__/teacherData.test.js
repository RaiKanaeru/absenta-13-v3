/**
 * Teacher Data Controller Tests
 * 
 * Tests for teacher data operations: CRUD and validation.
 * Run with: npm test
 */

import assert from 'node:assert';
import { describe, it, beforeEach, mock } from 'node:test';
import * as teacherDataController from '../controllers/teacherDataController.js';

// Mock DB Pool
global.dbPool = {
    execute: mock.fn(),
    getConnection: mock.fn()
};

// Mock Response
const res = {
    status: mock.fn(() => res),
    json: mock.fn()
};

// Mock Request
const req = {
    body: {},
    params: {}
};

describe('Teacher Data Controller', () => {
    beforeEach(() => {
        // Reset mocks
        res.status.mock.restore();
        res.json.mock.restore();
        global.dbPool.execute.mock.restore();
        global.dbPool.getConnection.mock.restore();
        
        // Reset defaults
        res.status = mock.fn(() => res);
        res.json = mock.fn();
        req.body = {};
        req.params = {};
    });

    describe('getTeachersData', () => {
        it('should return teacher list', async () => {
            const mockTeachers = [{ id: 1, nama: 'Guru A' }, { id: 2, nama: 'Guru B' }];
            global.dbPool.execute.mock.mockImplementation(() => Promise.resolve([mockTeachers]));

            await teacherDataController.getTeachersData(req, res);

            assert.strictEqual(global.dbPool.execute.mock.callCount(), 1);
            assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], mockTeachers);
        });

        it('should handle database errors', async () => {
            global.dbPool.execute.mock.mockImplementation(() => Promise.reject(new Error('DB Error')));

            await teacherDataController.getTeachersData(req, res);

            assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
            assert.match(res.json.mock.calls[0].arguments[0].error.message, /Gagal mengambil data guru/);
        });
    });

    describe('addTeacherData', () => {
        it('should fail if missing required fields', async () => {
            req.body = { nama: 'Guru Baru' }; // Missing NIP, jenis_kelamin
            
            const release = mock.fn();
            global.dbPool.getConnection.mock.mockImplementation(() => Promise.resolve({ release }));
            
            await teacherDataController.addTeacherData(req, res);
            
            assert.strictEqual(res.status.mock.calls[0].arguments[0], 400);
            assert.match(res.json.mock.calls[0].arguments[0].error.message, /wajib diisi/);
            // release is called explicitly + in finally block
            assert.ok(release.mock.callCount() >= 1);
        });

        it('should fail if NIP exists', async () => {
            req.body = { nip: '123', nama: 'Guru', jenis_kelamin: 'L' };
            
            const release = mock.fn();
            const execute = mock.fn();
            
            // Mock connection & execute sequence
            global.dbPool.getConnection.mock.mockImplementation(() => Promise.resolve({ 
                release, 
                execute 
            }));

            // Mock NIP check returning result
            execute.mock.mockImplementation(async (query) => {
                if (query.includes('FROM guru WHERE nip')) return [[{ id: 1 }]];
                return [[]];
            });

            await teacherDataController.addTeacherData(req, res);

            assert.strictEqual(res.status.mock.calls[0].arguments[0], 409); // Duplicate
            assert.match(res.json.mock.calls[0].arguments[0].error.message, /NIP sudah terdaftar/);
        });

        it('should create teacher successfully', async () => {
            req.body = { nip: '123', nama: 'Guru Baru', jenis_kelamin: 'L' };
            
            const release = mock.fn();
            const beginTransaction = mock.fn();
            const commit = mock.fn();
            const execute = mock.fn();

            global.dbPool.getConnection.mock.mockImplementation(() => Promise.resolve({
                release, beginTransaction, commit, execute
            }));

            execute.mock.mockImplementation(async (query) => {
                if (query.includes('FROM guru WHERE nip')) return [[]]; // No duplicate
                if (query.includes('INSERT INTO users')) return [{ insertId: 100 }]; // User created
                if (query.includes('INSERT INTO guru')) return [{ insertId: 5 }]; // Guru created
                return [[]];
            });

            await teacherDataController.addTeacherData(req, res);

            assert.strictEqual(res.status.mock.calls[0].arguments[0], 201);
            assert.deepStrictEqual(res.json.mock.calls[0].arguments[0].data, { id: 5 });
            assert.strictEqual(commit.mock.callCount(), 1);
            assert.strictEqual(release.mock.callCount(), 1);
        });
    });

    describe('deleteTeacherData', () => {
        it('should delete existing teacher', async () => {
            req.params.id = 1;
            
            const release = mock.fn();
            const beginTransaction = mock.fn();
            const commit = mock.fn();
            const execute = mock.fn();

            global.dbPool.getConnection.mock.mockImplementation(() => Promise.resolve({
                release, beginTransaction, commit, execute
            }));

            execute.mock.mockImplementation(async (query) => {
                if (query.includes('SELECT user_id FROM guru')) return [[{ user_id: 100 }]];
                if (query.includes('DELETE FROM guru')) return [{ affectedRows: 1 }];
                if (query.includes('DELETE FROM users')) return [{ affectedRows: 1 }];
                return [[]];
            });

            await teacherDataController.deleteTeacherData(req, res);

            assert.strictEqual(res.status.mock.calls[0].arguments[0], 200);
            assert.strictEqual(commit.mock.callCount(), 1);
        });

        it('should return 404 if not found', async () => {
            req.params.id = 999;
            
            const release = mock.fn();
            const beginTransaction = mock.fn();
            const rollback = mock.fn();
            const execute = mock.fn(); // Define execute mock

            global.dbPool.getConnection.mock.mockImplementation(() => Promise.resolve({
                release, beginTransaction, rollback, execute
            }));

            // Mock not found
            execute.mock.mockImplementation(() => Promise.resolve([[]]));

            await teacherDataController.deleteTeacherData(req, res);

            assert.strictEqual(res.status.mock.calls[0].arguments[0], 404);
            assert.strictEqual(release.mock.callCount(), 1);
        });
    });
});
