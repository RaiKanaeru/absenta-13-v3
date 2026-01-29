import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const verifyMock = vi.fn();

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: verifyMock,
  },
}));

let authenticateToken;
let requireRole;

const createResponse = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

const createNext = () => vi.fn();

describe('auth middleware', () => {
  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret';
    verifyMock.mockReset();
    vi.resetModules();

    ({ authenticateToken, requireRole } = await import('../auth.js'));
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  describe('authenticateToken', () => {
    it('attaches user and calls next when token is valid', async () => {
      verifyMock.mockImplementation((token, secret, callback) => {
        callback(null, { username: 'tester', role: 'admin' });
      });

      const req = {
        headers: { authorization: 'Bearer valid.token' },
        cookies: {},
        method: 'GET',
        originalUrl: '/api/test',
      };
      const res = createResponse();
      const next = createNext();

      authenticateToken(req, res, next);

      expect(verifyMock).toHaveBeenCalledWith('valid.token', 'test-secret', expect.any(Function));
      expect(req.user).toEqual({ username: 'tester', role: 'admin' });
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns 403 when token verification fails', () => {
      verifyMock.mockImplementation((token, secret, callback) => {
        callback(new Error('invalid token'));
      });

      const req = {
        headers: { authorization: 'Bearer invalid.token' },
        cookies: {},
        method: 'GET',
        originalUrl: '/api/test',
      };
      const res = createResponse();
      const next = createNext();

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 3001,
          message: 'Token tidak valid atau kadaluarsa',
        })
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when token is missing', () => {
      const req = {
        headers: {},
        cookies: {},
        method: 'GET',
        originalUrl: '/api/test',
      };
      const res = createResponse();
      const next = createNext();

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 3001,
          message: 'Token akses diperlukan',
        })
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('allows access when role is permitted', () => {
      const middleware = requireRole(['admin', 'manager']);
      const req = { user: { role: 'admin' } };
      const res = createResponse();
      const next = createNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('denies access when user role is missing', () => {
      const middleware = requireRole(['admin']);
      const req = { user: null };
      const res = createResponse();
      const next = createNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 3001,
          message: 'Pengguna belum terautentikasi',
        })
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('denies access when role is not permitted', () => {
      const middleware = requireRole(['admin']);
      const req = { user: { role: 'user' } };
      const res = createResponse();
      const next = createNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 3002,
          message: 'Anda tidak memiliki izin untuk akses ini',
        })
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });
});
