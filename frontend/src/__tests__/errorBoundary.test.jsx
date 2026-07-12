import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary.jsx';

// Component that throws on render.
function ThrowingChild() {
  throw new Error('Test crash');
}

// Good child that renders normally.
function GoodChild() {
  return <div data-testid="good-child">Hello</div>;
}

describe('ErrorBoundary', () => {
  // Suppress console.error for expected throws.
  vi.spyOn(console, 'error').mockImplementation(() => {});

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('good-child')).toHaveTextContent('Hello');
  });

  it('catches errors and renders fallback UI', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test crash')).toBeInTheDocument();
  });

  it('shows a reload button that triggers page reload', () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', { value: { reload: reloadSpy }, writable: true });

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByText('Reload'));
    expect(reloadSpy).toHaveBeenCalled();
  });
});
