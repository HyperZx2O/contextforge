import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import useGraphStore from '../store/graphStore.js';
import GlobalErrorToast from '../components/GlobalErrorToast.jsx';

describe('GlobalErrorToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGraphStore.setState({ globalError: null });
  });

  it('renders nothing when there is no error', () => {
    render(<GlobalErrorToast />);
    expect(screen.queryByTestId('global-toast')).not.toBeInTheDocument();
  });

  it('shows the toast when globalError is set and auto-dismisses after 5s', async () => {
    render(<GlobalErrorToast />);
    act(() => {
      useGraphStore.getState().setGlobalError('network down');
    });

    expect(screen.getByTestId('global-toast')).toHaveTextContent('network down');

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByTestId('global-toast')).not.toBeInTheDocument();
    expect(useGraphStore.getState().globalError).toBeNull();
    vi.useRealTimers();
  });

  it('Dismiss button clears the error immediately', async () => {
    render(<GlobalErrorToast />);
    act(() => {
      useGraphStore.getState().setGlobalError('oops');
    });
    fireEvent.click(screen.getByTestId('global-toast-close'));
    expect(screen.queryByTestId('global-toast')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
