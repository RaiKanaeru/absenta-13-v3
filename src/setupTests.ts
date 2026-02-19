import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ============================================
// MOCK GLOBAL FETCH
// ============================================

globalThis.fetch = vi.fn(async (url: string, options?: RequestInit) => {
  // Default successful response for all endpoints
  return new Response(
    JSON.stringify({
      success: true,
      data: {},
      message: 'Mock response',
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }
  );
});

// ============================================
// MOCK AUTH CONTEXT MODULE
// ============================================

vi.mock('@/contexts/AuthContext', () => {
  return {
    AuthContext: {
      Provider: ({ children }: { children: React.ReactNode }) => children,
      Consumer: undefined,
    },
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    useAuth: () => ({
      user: {
        id: 'test-user-123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'siswa',
        namaLengkap: 'Test User',
      },
      isAuthenticated: true,
      isLoading: false,
      isAuthenticating: false,
      error: null,
      requireCaptcha: false,
      remainingAttempts: null,
      login: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
    }),
  };
});

// ============================================
// MOCK CONFIG/API
// ============================================

vi.mock('@/config/api', () => ({
  getApiUrl: vi.fn((endpoint: string) => {
    const baseUrl = process.env.VITE_API_BASE_URL || 'http://localhost:3001';
    return `${baseUrl}${endpoint}`;
  }),
}));

// ============================================
// MOCK AUTH UTILITIES
// ============================================

vi.mock('@/utils/authUtils', () => ({
  getCleanToken: vi.fn(() => 'mock-jwt-token-test'),
  setAuthToken: vi.fn(),
  clearAuthToken: vi.fn(),
}));

// ============================================
// MOCK TOAST HOOK
// ============================================

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      dismiss: vi.fn(),
    },
  }),
}));

