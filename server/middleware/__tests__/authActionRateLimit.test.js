import { before, after, describe, it } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import fetch from 'node-fetch';

import { createAuthActionLimiter, getAuthRateLimitConfig } from '../authActionRateLimit.js';

let server;
let baseUrl;

describe('authActionRateLimit', () => {
    before(async () => {
        const app = express();
        app.use(express.json());

        app.post(
            '/refresh-test',
            createAuthActionLimiter({
                windowMs: 60_000,
                max: 2,
                message: 'Terlalu banyak permintaan refresh token. Silakan coba lagi nanti.',
            }),
            (req, res) => res.json({ success: true })
        );

        app.post(
            '/logout-all-test',
            createAuthActionLimiter({
                windowMs: 60_000,
                max: 1, // Stricter limit for testing logout-all specifically
                message: 'Terlalu banyak permintaan logout dari semua perangkat. Silakan coba lagi nanti.',
            }),
            (req, res) => res.json({ success: true })
        );

        server = await new Promise((resolve) => {
            const instance = app.listen(0, () => resolve(instance));
        });

        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(async () => {
        await new Promise((resolve) => server.close(resolve));
    });

    it('returns 429 after refresh-style endpoint exceeds configured limit', async () => {
        const makeRequest = () => fetch(`${baseUrl}/refresh-test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Client-ID': 'test-client-refresh',
            },
        });

        const first = await makeRequest();
        const second = await makeRequest();
        const third = await makeRequest();

        assert.strictEqual(first.status, 200);
        assert.strictEqual(second.status, 200);
        assert.strictEqual(third.status, 429);

        const body = await third.json();
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, 3005);
        assert.match(body.error.message, /refresh token/i);
        assert.strictEqual(third.headers.get('retry-after'), '60');
    });

    it('uses X-Client-ID to isolate limits between clients', async () => {
        const makeRequest = (clientId) => fetch(`${baseUrl}/refresh-test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Client-ID': clientId,
            },
        });

        const response = await makeRequest('fresh-client-after-limit');
        assert.strictEqual(response.status, 200);
    });

    it('returns 429 after logout-all endpoint exceeds configured limit', async () => {
        const makeRequest = () => fetch(`${baseUrl}/logout-all-test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Client-ID': 'test-client-logout-all',
            },
        });

        const first = await makeRequest();
        const second = await makeRequest(); // Limit is 1, so this should fail

        assert.strictEqual(first.status, 200);
        assert.strictEqual(second.status, 429);

        const body = await second.json();
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, 3005);
        assert.match(body.error.message, /logout dari semua perangkat/i);
        assert.strictEqual(second.headers.get('retry-after'), '60');
    });

    it('reads auth action limiter env overrides safely', () => {
        const config = getAuthRateLimitConfig({
            NODE_ENV: 'production',
            AUTH_ACTION_RATE_LIMIT_WINDOW_MS: '90000',
            AUTH_REFRESH_RATE_LIMIT_MAX: '12',
            AUTH_LOGOUT_RATE_LIMIT_MAX: '24',
        });

        assert.deepStrictEqual(config, {
            windowMs: 90_000,
            refreshMax: 12,
            logoutMax: 24,
        });
    });
});
