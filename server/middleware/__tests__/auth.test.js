import assert from 'node:assert';
import crypto from 'node:crypto';
import { describe, it, before, after } from 'node:test';
import jwt from 'jsonwebtoken';

// Generate random secrets at runtime to avoid hardcoded credential detection (S6437)
const TEST_JWT_SECRET = crypto.randomBytes(32).toString('hex');
const TEST_INVALID_SECRET = crypto.randomBytes(32).toString('hex');

let authenticateToken;
let requireRole;

const createResponse = () => {
  const res = {};
  res.statusCode = null;
  res.body = null;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
};

const waitTick = () => new Promise((resolve) => setImmediate(resolve));

describe('auth middleware', () => {
  before(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    ({ authenticateToken, requireRole } = await import('../auth.js'));
  });

  after(() => {
    delete process.env.JWT_SECRET;
  });

  describe('authenticateToken', () => {
    it('attaches user and calls next when token is valid', async () => {
      const user = { username: 'tester', role: 'admin' };
      const token = jwt.sign(user, process.env.JWT_SECRET);

      const req = {
        headers: { authorization: `Bearer ${token}` },
        cookies: {},
        method: 'GET',
        originalUrl: '/api/test',
      };
      const res = createResponse();
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      authenticateToken(req, res, next);
      await waitTick();

      assert.strictEqual(req.user.username, user.username);
      assert.strictEqual(req.user.role, user.role);
      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.statusCode, null);
    });

    it('returns 401 when token verification fails', async () => {
      const token = jwt.sign({ role: 'admin' }, TEST_INVALID_SECRET);

      const req = {
        headers: { authorization: `Bearer ${token}` },
        cookies: {},
        method: 'GET',
        originalUrl: '/api/test',
      };
      const res = createResponse();
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      authenticateToken(req, res, next);
      await waitTick();

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 3001);
      assert.match(res.body.error.message, /Token tidak valid atau kadaluarsa/);
      assert.strictEqual(nextCalled, false);
    });

    it('returns 401 when token is missing', async () => {
      const req = {
        headers: {},
        cookies: {},
        method: 'GET',
        originalUrl: '/api/test',
      };
      const res = createResponse();
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      authenticateToken(req, res, next);
      await waitTick();

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 3001);
      assert.match(res.body.error.message, /Token akses diperlukan/);
      assert.strictEqual(nextCalled, false);
    });
  });

  describe('requireRole', () => {
    it('allows access when role is permitted', () => {
      const middleware = requireRole(['admin', 'manager']);
      const req = { user: { role: 'admin' } };
      const res = createResponse();
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      middleware(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(res.statusCode, null);
    });

    it('denies access when user role is missing', () => {
      const middleware = requireRole(['admin']);
      const req = { user: null };
      const res = createResponse();
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      middleware(req, res, next);

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 3001);
      assert.match(res.body.error.message, /Pengguna belum terautentikasi/);
      assert.strictEqual(nextCalled, false);
    });

    it('denies access when role is not permitted', () => {
      const middleware = requireRole(['admin']);
      const req = { user: { role: 'user' } };
      const res = createResponse();
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      middleware(req, res, next);

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 3002);
      assert.match(res.body.error.message, /Anda tidak memiliki izin/);
      assert.strictEqual(nextCalled, false);
    });
  });
});
