import { vi } from 'vitest';

/**
 * Shared mock handlers for frontend component tests.
 * Provides reusable mocks for:
 * - useAuth hook and AuthContext
 * - apiCall utility
 * - fetch global
 *
 * Usage in tests:
 *   import { createMockAuthContext, createMockApiCall } from '@/test/mocks/handlers';
 *   vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => createMockAuthContext() }));
 */

// ============================================
// AUTH MOCKS
// ============================================

/**
 * Default mock user data for testing
 */
export const DEFAULT_MOCK_USER = {
  id: 'test-user-123',
  username: 'testuser',
  email: 'test@example.com',
  role: 'siswa',
  namaLengkap: 'Test User',
};

/**
 * Create a mock auth context value for useAuth hook
 * @param overrides - Partial overrides for default values
 */
export function createMockAuthContext(overrides?: {
  user?: typeof DEFAULT_MOCK_USER | null;
  isAuthenticated?: boolean;
  isLoading?: boolean;
  isAuthenticating?: boolean;
  error?: string | null;
  requireCaptcha?: boolean;
  remainingAttempts?: number | null;
  login?: ReturnType<typeof vi.fn>;
  logout?: ReturnType<typeof vi.fn>;
}) {
  return {
    user: DEFAULT_MOCK_USER,
    isAuthenticated: true,
    isLoading: false,
    isAuthenticating: false,
    error: null,
    requireCaptcha: false,
    remainingAttempts: null,
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Create a mock unauthenticated auth context (for testing login flows)
 */
export function createMockUnauthContext() {
  return createMockAuthContext({
    user: null,
    isAuthenticated: false,
  });
}

/**
 * Create a mock auth context with loading state
 */
export function createMockLoadingAuthContext() {
  return createMockAuthContext({
    isLoading: true,
  });
}

// ============================================
// API CALL MOCKS
// ============================================

/**
 * Create a mock apiCall function
 * @param responseOverride - Response to return from apiCall
 * @param shouldFail - If true, rejects with error
 */
export function createMockApiCall(
  responseOverride?: unknown,
  shouldFail = false
) {
  return vi.fn(async () => {
    if (shouldFail) {
      const error = new Error('Mock API error') as unknown as Record<string, unknown>;
      error.code = 5001;
      throw error;
    }
    return responseOverride || { success: true, data: {} };
  });
}

/**
 * Create mock fetch responses for different endpoints
 */
export function createMockFetch() {
  return vi.fn(async (url: string, options?: RequestInit) => {
    // Default successful response
    const responseData = {
      success: true,
      data: {},
      message: 'Mock response',
    };

    // Route-specific mocks
    if (url.includes('/api/admin/info')) {
      return new Response(
        JSON.stringify({
          ...responseData,
          data: { id: 'admin-1', role: 'admin' },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    if (url.includes('/api/guru/info')) {
      return new Response(
        JSON.stringify({
          ...responseData,
          data: { id: 'guru-1', role: 'guru' },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    if (url.includes('/api/siswa-perwakilan/info')) {
      return new Response(
        JSON.stringify({
          ...responseData,
          data: { id: 'siswa-1', role: 'siswa' },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    // Generic 401 for unauthenticated requests
    if (options?.headers && 'credentials' in options) {
      if (!options.credentials || options.credentials === 'omit') {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          {
            status: 401,
            headers: { 'content-type': 'application/json' },
          }
        );
      }
    }

    // Default success response
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}

// ============================================
// TOAST MOCKS
// ============================================

/**
 * Create mock toast functions
 */
export function createMockToast() {
  return {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  };
}

// ============================================
// UTILITY FUNCTION MOCKS
// ============================================

/**
 * Create mock localStorage (already handled by Vitest jsdom)
 * but useful for explicit mocking in some cases
 */
export function createMockLocalStorage() {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
}

/**
 * Mock getApiUrl - returns constructed API URL for tests
 */
export function createMockGetApiUrl() {
  return vi.fn((endpoint: string) => {
    const baseUrl = 'http://localhost:3001';
    return `${baseUrl}${endpoint}`;
  });
}

/**
 * Mock getCleanToken - returns a test JWT token
 */
export function createMockGetCleanToken() {
  return vi.fn(() => 'mock-jwt-token-test-1234567890');
}

/**
 * Create mock window.matchMedia for responsive design tests
 */
export function setupMatchMediaMock() {
  Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

/**
 * Setup all common mocks at once (called by setupTests.ts)
 */
export function setupCommonMocks() {
  // Mock window.matchMedia for responsive components
  setupMatchMediaMock();

  // Mock fetch globally
  globalThis.fetch = createMockFetch();

  // Mock IntersectionObserver
  globalThis.IntersectionObserver = class IntersectionObserver {
    disconnect() { return; }
    observe() { return; }
    takeRecords() {
      return [];
    }
    unobserve() { return; }
  } as unknown as typeof IntersectionObserver;
}
