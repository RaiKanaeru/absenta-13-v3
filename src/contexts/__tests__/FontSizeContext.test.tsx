import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FontSizeProvider, useFontSize } from '../FontSizeContext';

type StorageMap = Record<string, string>;

const createStorageMock = (initial: StorageMap = {}) => {
  let store: StorageMap = { ...initial };

  const storage = {
    getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    get length() {
      return Object.keys(store).length;
    },
  };

  return storage as unknown as Storage;
};

const TestComponent = () => {
  const { fontSize, setFontSize, increaseFontSize, decreaseFontSize, resetFontSize } =
    useFontSize();

  return (
    <div>
      <span data-testid="font-size">{fontSize}</span>
      <button onClick={() => setFontSize('lg')}>Set to lg</button>
      <button onClick={increaseFontSize}>Increase</button>
      <button onClick={decreaseFontSize}>Decrease</button>
      <button onClick={resetFontSize}>Reset</button>
    </div>
  );
};

describe('FontSizeContext', () => {
  let localStorageMock: Storage;
  let sessionStorageMock: Storage;

  beforeEach(() => {
    localStorageMock = createStorageMock();
    sessionStorageMock = createStorageMock();

    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });

    Object.defineProperty(globalThis, 'sessionStorage', {
      value: sessionStorageMock,
      configurable: true,
    });

    document.documentElement.className = 'theme-dark existing-class';
  });

  afterEach(() => {
    document.documentElement.className = '';
    vi.restoreAllMocks();
  });

  it('updates font-size classes without removing unrelated root classes', async () => {
    const user = userEvent.setup();

    render(
      <FontSizeProvider>
        <TestComponent />
      </FontSizeProvider>,
    );

    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    expect(document.documentElement.classList.contains('existing-class')).toBe(true);

    await user.click(screen.getByText('Set to lg'));

    expect(document.documentElement.classList.contains('font-size-lg')).toBe(true);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    expect(document.documentElement.classList.contains('existing-class')).toBe(true);

    await user.click(screen.getByText('Increase'));
    expect(document.documentElement.classList.contains('font-size-xl')).toBe(true);
    expect(
      Array.from(document.documentElement.classList).filter((className) =>
        className.startsWith('font-size-'),
      ).length,
    ).toBe(1);

    await user.click(screen.getByText('Decrease'));
    expect(document.documentElement.classList.contains('font-size-lg')).toBe(true);

    await user.click(screen.getByText('Reset'));
    expect(document.documentElement.classList.contains('font-size-base')).toBe(true);
    expect(
      Array.from(document.documentElement.classList).filter((className) =>
        className.startsWith('font-size-'),
      ).length,
    ).toBe(1);
  });

  it('persists font size changes to storage', async () => {
    const user = userEvent.setup();

    render(
      <FontSizeProvider>
        <TestComponent />
      </FontSizeProvider>,
    );

    await user.click(screen.getByText('Set to lg'));

    expect(localStorageMock.setItem).toHaveBeenCalledWith('fontSize', 'lg');
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith('fontSize', 'lg');
  });

  it('restores font size preference from storage on load', async () => {
    localStorageMock = createStorageMock({ fontSize: 'xl' });
    sessionStorageMock = createStorageMock({ fontSize: 'lg' });

    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });

    Object.defineProperty(globalThis, 'sessionStorage', {
      value: sessionStorageMock,
      configurable: true,
    });

    render(
      <FontSizeProvider>
        <TestComponent />
      </FontSizeProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('font-size')).toHaveTextContent('xl'));
    expect(document.documentElement.classList.contains('font-size-xl')).toBe(true);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    expect(document.documentElement.classList.contains('existing-class')).toBe(true);
  });

  it('falls back to session storage when local storage is empty', async () => {
    localStorageMock = createStorageMock();
    sessionStorageMock = createStorageMock({ fontSize: 'sm' });

    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });

    Object.defineProperty(globalThis, 'sessionStorage', {
      value: sessionStorageMock,
      configurable: true,
    });

    render(
      <FontSizeProvider>
        <TestComponent />
      </FontSizeProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('font-size')).toHaveTextContent('sm'));
    expect(document.documentElement.classList.contains('font-size-sm')).toBe(true);
  });
});
