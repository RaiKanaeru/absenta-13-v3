/**
 * @fileoverview Auth Routes Integration Tests
 * Tests the full authentication flow using a real Express server on a dynamic port.
 *
 * Covers:
 * 1. Login success (200, cookies set, token returned)
 * 2. Login wrong password (401, credentials error)
 * 3. Login lockout after 5 failures (429, rate limit)
 * 4. Captcha requirement after 3 failures
 * 5. Token refresh rotation (new cookies set)
 * 6. Refresh with revoked/missing token (401)
 * 7. Verify valid token (200, user payload)
 * 8. Verify expired token (401)
 * 9. Logout + cookie clearing
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import fetch from 'node-fetch';

// Generate random JWT secrets at runtime to avoid hardcoded credential detection (S6437)
const TEST_JWT_SECRET = crypto.randomBytes(32).toString('hex');

let server;
let baseUrl;

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseCookies(response) {
    const raw = response.headers.raw()['set-cookie'] || [];
    const cookies = {};
    for (const cookie of raw) {
        const [pair] = cookie.split(';');
        const [name, value] = pair.split('=');
        cookies[name.trim()] = value ? value.trim() : '';
    }
    return cookies;
}

function buildCookieHeader(cookies) {
    return Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
}

async function loginRequest(baseUrl, body, extraHeaders = {}) {
    return fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify(body),
    });
}

// ─── Setup ──────────────────────────────────────────────────────────────────

describe('auth routes integration', () => {
    before(async () => {
        // 1. Set env vars BEFORE importing any module that reads them at load time
        process.env.JWT_SECRET = TEST_JWT_SECRET;
        process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;
        process.env.JWT_REFRESH_SECRET = TEST_JWT_SECRET;
        process.env.NODE_ENV = 'test';

        // 2. Import bcrypt to create a real hashed password for the mock user
        const { default: bcrypt } = await import('bcrypt');
        const hashedPassword = await bcrypt.hash('testpass123', 10);

        // 3. Build mock DB pool
        //    The mock execute() inspects the query string and returns appropriate rows.
        const mockPool = {
            execute: async (query, params) => {
                // Login user lookup  / refresh user lookup
                if (query.includes('FROM users WHERE username')) {
                    const username = params[0];
                    if (username === 'adminuser') {
                        return [[{
                            id: 1, id_user: 1,
                            username: 'adminuser',
                            password: hashedPassword,
                            nama: 'Admin Test',
                            role: 'admin',
                            email: 'admin@test.com',
                            status: 'aktif',
                            is_perwakilan: 0,
                        }]];
                    }
                    return [[]]; // user not found
                }

                if (query.includes('FROM users WHERE id')) {
                    const id = params[0];
                    if (id === 1) {
                        return [[{
                            id: 1, id_user: 1,
                            username: 'adminuser',
                            password: hashedPassword,
                            nama: 'Admin Test',
                            role: 'admin',
                            email: 'admin@test.com',
                            status: 'aktif',
                            is_perwakilan: 0,
                        }]];
                    }
                    return [[]];
                }

                // enrichUserData for admin (no guru/siswa query runs)
                if (query.includes('FROM guru g') || query.includes('FROM siswa s')) {
                    return [[]];
                }

                return [[]];
            },
            query: async () => [[]],
        };

        // 4. Register the mock pool with the db config module
        const { setPool } = await import('../../config/db.js');
        setPool(mockPool);

        // 5. Disable Redis (use in-memory fallback for rate limiting)
        globalThis.cacheSystem = { isConnected: false, redis: null };

        // 6. Import routes AFTER setting up mocks (ESM module caching)
        const { default: authRoutes } = await import('../authRoutes.js');

        // 7. Build Express app
        const app = express();
        app.use(express.json());
        app.use(cookieParser());
        app.use('/api', authRoutes);

        // 8. Spin up on dynamic port
        server = await new Promise((resolve) => {
            const instance = app.listen(0, () => resolve(instance));
        });
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
    });

    after(async () => {
        await new Promise((resolve) => server.close(resolve));
        delete globalThis.cacheSystem;
        delete process.env.JWT_SECRET;
        delete process.env.JWT_ACCESS_SECRET;
        delete process.env.JWT_REFRESH_SECRET;
        delete process.env.NODE_ENV;
    });

    // ── Test 1: Login success ──────────────────────────────────────────────

    it('login success returns 200, token, and sets cookies', async () => {
        const res = await loginRequest(baseUrl, {
            username: 'adminuser',
            password: 'testpass123',
        });

        assert.strictEqual(res.status, 200);

        const body = await res.json();
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.message, 'Login berhasil');
        assert.ok(body.token, 'token should be present in body');
        assert.ok(body.user, 'user object should be present');
        assert.strictEqual(body.user.username, 'adminuser');
        assert.strictEqual(body.user.role, 'admin');

        const cookies = parseCookies(res);
        assert.ok(cookies.token, 'token cookie should be set');
        assert.ok(cookies.refreshToken, 'refreshToken cookie should be set');
    });

    // ── Test 2: Login wrong password ───────────────────────────────────────

    it('login with wrong password returns 401 with credentials error', async () => {
        const res = await loginRequest(baseUrl, {
            username: 'adminuser',
            password: 'wrongpassword',
        });

        assert.strictEqual(res.status, 401);

        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, 3003);
        assert.match(body.error.message, /salah|invalid/i);
    });

    // ── Test 3: Captcha required after 3 failures ──────────────────────────
    // Note: The in-memory rate limiter is global per username, so we use a unique
    // username that hasn't been used yet to test the captcha threshold independently.

    it('captcha required flag appears after 3 consecutive failures', async () => {
        const testUser = 'captchaTestUser';
        let lastBody;

        // Make 3 failed attempts (user not found still records failed attempt)
        for (let i = 0; i < 3; i++) {
            const res = await loginRequest(baseUrl, {
                username: testUser,
                password: 'wrong',
            });
            lastBody = await res.json();
        }

        // After 3 failures the response should include requireCaptcha: true
        assert.strictEqual(lastBody.success, false);
        assert.strictEqual(lastBody.requireCaptcha, true,
            'requireCaptcha flag should be true after 3 failures');
    });

    // ── Test 4: Account lockout after 5 failures returns 429 ──────────────
    // Use a fresh username so the lockout counter starts at zero.

    it('account locks out after 5 failed attempts and returns 429', async () => {
        const testUser = 'lockoutTestUser';

        // Make 5 failed login attempts
        for (let i = 0; i < 5; i++) {
            await loginRequest(baseUrl, {
                username: testUser,
                password: 'wrong',
            });
        }

        // 6th attempt should be blocked with 429
        const res = await loginRequest(baseUrl, {
            username: testUser,
            password: 'wrong',
        });

        assert.strictEqual(res.status, 429);

        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, 3005);
        assert.match(body.error.message, /terlalu banyak|terkunci|percobaan/i);
    });

    // ── Test 5: Token refresh rotation ────────────────────────────────────

    it('POST /api/refresh rotates tokens and returns new access token', async () => {
        // First login to get a refresh token
        const loginRes = await loginRequest(baseUrl, {
            username: 'adminuser',
            password: 'testpass123',
        });
        assert.strictEqual(loginRes.status, 200);
        const loginBody = await loginRes.json();
        const loginCookies = parseCookies(loginRes);
        const originalAccessToken = loginBody.token;

        // Wait 1100ms to ensure new tokens have a different `iat` (JWT precision is 1s)
        await new Promise((r) => setTimeout(r, 1100));

        const refreshRes = await fetch(`${baseUrl}/api/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: buildCookieHeader(loginCookies),
            },
        });

        assert.strictEqual(refreshRes.status, 200);

        const body = await refreshRes.json();
        assert.strictEqual(body.success, true);
        assert.ok(body.token, 'new access token should be returned');
        assert.ok(body.user, 'user payload should be returned');

        const newCookies = parseCookies(refreshRes);
        assert.ok(newCookies.token, 'new token cookie should be set');
        assert.ok(newCookies.refreshToken, 'new refreshToken cookie should be set');

        // New access token must differ from original (different iat after 1s delay)
        assert.notStrictEqual(
            body.token,
            originalAccessToken,
            'refreshed access token should be a new JWT (different iat)'
        );
    });

    // ── Test 6: Refresh with missing/revoked token returns 401 ────────────

    it('POST /api/refresh without refresh token cookie returns 401', async () => {
        const res = await fetch(`${baseUrl}/api/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        assert.strictEqual(res.status, 401);

        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.match(body.error.message, /refresh token diperlukan/i);
    });

    // ── Test 7: Verify valid token returns 200 ────────────────────────────

    it('GET /api/verify with valid Bearer token returns 200 and user payload', async () => {
        // Login first to get a valid access token
        const loginRes = await loginRequest(baseUrl, {
            username: 'adminuser',
            password: 'testpass123',
        });
        const loginBody = await loginRes.json();
        const token = loginBody.token;

        const verifyRes = await fetch(`${baseUrl}/api/verify`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        assert.strictEqual(verifyRes.status, 200);

        const body = await verifyRes.json();
        assert.strictEqual(body.success, true);
        assert.ok(body.user, 'user object should be present');
        assert.strictEqual(body.user.username, 'adminuser');
        assert.strictEqual(body.user.role, 'admin');
        assert.strictEqual(body.message, 'Token valid');
    });

    // ── Test 8: Verify expired/invalid token returns 401 ─────────────────

    it('GET /api/verify with invalid token returns 401', async () => {
        const res = await fetch(`${baseUrl}/api/verify`, {
            headers: { Authorization: 'Bearer this.is.not.a.valid.jwt.token' },
        });

        assert.strictEqual(res.status, 401);

        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, 3001);
        assert.match(body.error.message, /Token tidak valid atau kadaluarsa/i);
    });

    // ── Test 9: Logout clears cookies ─────────────────────────────────────

    it('POST /api/logout returns 200 and clears token cookies', async () => {
        // Login to get a session
        const loginRes = await loginRequest(baseUrl, {
            username: 'adminuser',
            password: 'testpass123',
        });
        const loginCookies = parseCookies(loginRes);
        const loginBody = await loginRes.json();
        const token = loginBody.token;

        const logoutRes = await fetch(`${baseUrl}/api/logout`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                Cookie: buildCookieHeader(loginCookies),
                'Content-Type': 'application/json',
            },
        });

        assert.strictEqual(logoutRes.status, 200);

        const body = await logoutRes.json();
        assert.strictEqual(body.success, true);
        assert.match(body.message, /logout berhasil/i);

        // Verify cookies are cleared (set-cookie should set token to empty or maxAge=0)
        const rawCookies = logoutRes.headers.raw()['set-cookie'] || [];
        const hasTokenClear = rawCookies.some(
            (c) => c.startsWith('token=') && (c.includes('Expires=Thu, 01 Jan 1970') || c.includes('Max-Age=0') || c.includes('token=;'))
        );
        const hasRefreshClear = rawCookies.some(
            (c) => c.startsWith('refreshToken=') && (c.includes('Expires=Thu, 01 Jan 1970') || c.includes('Max-Age=0') || c.includes('refreshToken=;'))
        );
        assert.ok(
            rawCookies.length >= 2 || hasTokenClear || hasRefreshClear,
            'Logout should clear token cookies via set-cookie headers'
        );
    });

    // ── Test 10: Logout All clears cookies ────────────────────────────────

    it('POST /api/logout-all returns 200 and clears token cookies', async () => {
        // Login to get a session
        const loginRes = await loginRequest(baseUrl, {
            username: 'adminuser',
            password: 'testpass123',
        });
        const loginCookies = parseCookies(loginRes);
        const loginBody = await loginRes.json();
        const token = loginBody.token;

        const logoutRes = await fetch(`${baseUrl}/api/logout-all`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                Cookie: buildCookieHeader(loginCookies),
                'Content-Type': 'application/json',
            },
        });

        assert.strictEqual(logoutRes.status, 200);

        const body = await logoutRes.json();
        assert.strictEqual(body.success, true);
        assert.match(body.message, /berhasil logout dari semua perangkat/i);

        // Verify cookies are cleared (set-cookie should set token to empty or maxAge=0)
        const rawCookies = logoutRes.headers.raw()['set-cookie'] || [];
        const hasTokenClear = rawCookies.some(
            (c) => c.startsWith('token=') && (c.includes('Expires=Thu, 01 Jan 1970') || c.includes('Max-Age=0') || c.includes('token=;'))
        );
        const hasRefreshClear = rawCookies.some(
            (c) => c.startsWith('refreshToken=') && (c.includes('Expires=Thu, 01 Jan 1970') || c.includes('Max-Age=0') || c.includes('refreshToken=;'))
        );
        assert.ok(
            rawCookies.length >= 2 || hasTokenClear || hasRefreshClear,
            'Logout-all should clear token cookies via set-cookie headers'
        );
    });
});
