import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import fetch from 'node-fetch';
import { isFilenameOwnedByUser } from '../../utils/downloadAccess.js';

let server;
let baseUrl;
let tempDir;
let downloadRoutes;

const createToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET);

describe('download routes', () => {
    before(async () => {
        process.env.JWT_SECRET = 'test-secret';
        ({ default: downloadRoutes } = await import('../downloadRoutes.js'));

        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'absenta-downloads-'));
        globalThis.downloadQueue = {
            downloadDir: tempDir,
            verifyFileAccess: (filename, userId) => isFilenameOwnedByUser(filename, userId)
        };

        const app = express();
        app.use('/api/downloads', downloadRoutes);

        server = await new Promise((resolve) => {
            const instance = app.listen(0, () => resolve(instance));
        });

        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
    });

    after(async () => {
        await new Promise((resolve) => server.close(resolve));
        await fs.rm(tempDir, { recursive: true, force: true });
        delete globalThis.downloadQueue;
        delete process.env.JWT_SECRET;
    });

    it('allows owner to download file', async () => {
        const filename = 'report_u1_test.xlsx';
        const filePath = path.join(tempDir, filename);
        await fs.writeFile(filePath, 'test-data');

        const token = createToken({ id: 1, role: 'guru' });
        const response = await fetch(`${baseUrl}/api/downloads/${filename}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        assert.strictEqual(response.status, 200);
        assert.strictEqual(await response.text(), 'test-data');
    });

    it('denies access to other user file', async () => {
        const filename = 'report_u2_test.xlsx';
        await fs.writeFile(path.join(tempDir, filename), 'secret-data');

        const token = createToken({ id: 1, role: 'guru' });
        const response = await fetch(`${baseUrl}/api/downloads/${filename}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        assert.strictEqual(response.status, 403);
        const body = await response.json();
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, 3002);
        assert.match(body.error.message, /Akses ditolak/);
    });

    it('blocks path traversal patterns', async () => {
        const token = createToken({ id: 1, role: 'guru' });
        const traversalTargets = ['%2e%2e%2fsecret.xlsx', '..%5csecret.xlsx'];

        for (const target of traversalTargets) {
            const response = await fetch(`${baseUrl}/api/downloads/${target}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            assert.strictEqual(response.status, 400);
            const body = await response.json();
            assert.match(body.error.message, /Nama file tidak valid/);
        }
    });

    it('blocks non-xlsx extensions', async () => {
        const filename = 'report_u1_test.txt';
        await fs.writeFile(path.join(tempDir, filename), 'test-data');

        const token = createToken({ id: 1, role: 'guru' });
        const response = await fetch(`${baseUrl}/api/downloads/${filename}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        assert.strictEqual(response.status, 400);
        const body = await response.json();
        assert.match(body.error.message, /Nama file tidak valid/);
    });

    it('blocks symlink escape attempts', async (t) => {
        const token = createToken({ id: 1, role: 'guru' });
        const externalDir = await fs.mkdtemp(path.join(os.tmpdir(), 'absenta-outside-'));
        const externalFile = path.join(externalDir, 'outside.xlsx');
        const symlinkName = 'report_u1_symlink.xlsx';
        const symlinkPath = path.join(tempDir, symlinkName);

        await fs.writeFile(externalFile, 'outside-data');

        try {
            await fs.symlink(externalFile, symlinkPath);
        } catch (error) {
            if (error.code === 'EPERM' || error.code === 'EACCES') {
                t.skip('Symlink creation not permitted on this platform');
                await fs.rm(externalDir, { recursive: true, force: true });
                return;
            }
            throw error;
        }

        try {
            const response = await fetch(`${baseUrl}/api/downloads/${symlinkName}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            assert.strictEqual(response.status, 400);
            const body = await response.json();
            assert.match(body.error.message, /Nama file tidak valid/);
        } finally {
            await fs.rm(externalDir, { recursive: true, force: true });
        }
    });
});
