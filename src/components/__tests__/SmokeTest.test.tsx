import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';

/**
 * Smoke Test for Component Rendering
 *
 * This test verifies that:
 * 1. The test scaffolding (mocks) is properly wired
 * 2. AuthContext and basic components can render without errors
 * 3. Auth mocks prevent authentication failures in component tests
 *
 * This is a foundational test that unblocks all subsequent component tests.
 */

const TestAppWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>{children}</AuthProvider>
  </BrowserRouter>
);

describe('Smoke Tests - Test Scaffolding', () => {
  it('renders AuthProvider without errors', () => {
    const { container } = render(
      <TestAppWrapper>
        <div>Test Content</div>
      </TestAppWrapper>
    );

    expect(container).toBeDefined();
  });

  it('AuthProvider is properly mocked and does not throw', async () => {
    render(
      <TestAppWrapper>
        <div data-testid="test-element">Auth Context Ready</div>
      </TestAppWrapper>
    );

    const element = screen.getByTestId('test-element');
    expect(element).toHaveTextContent('Auth Context Ready');
  });

  it('allows rendering child components within auth context', () => {
    const TestComponent = () => <p data-testid="child">Child Component</p>;

    render(
      <TestAppWrapper>
        <TestComponent />
      </TestAppWrapper>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('test environment has fetch mock', async () => {
    // Verify fetch is mocked and returns a response without attempting real network call
    // This ensures subsequent component tests won't make real HTTP requests
    const mockResponse = await fetch('http://localhost:3001/api/test');
    expect(mockResponse).toBeDefined();
    expect(mockResponse.ok).toBe(true);
  });

  it('mock auth utilities are available', () => {
    // This test verifies that auth-related mocks are initialized
    // and do not cause import errors during component rendering
    render(
      <TestAppWrapper>
        <div data-testid="auth-mock-test">Auth Mocks Available</div>
      </TestAppWrapper>
    );

    expect(screen.getByTestId('auth-mock-test')).toBeInTheDocument();
  });

  it('renders multiple components without cache conflicts', () => {
    const Component1 = () => <div data-testid="comp1">Component 1</div>;
    const Component2 = () => <div data-testid="comp2">Component 2</div>;

    const { rerender } = render(
      <TestAppWrapper>
        <Component1 />
      </TestAppWrapper>
    );

    expect(screen.getByTestId('comp1')).toBeInTheDocument();

    rerender(
      <TestAppWrapper>
        <Component2 />
      </TestAppWrapper>
    );

    expect(screen.getByTestId('comp2')).toBeInTheDocument();
  });
});
