import { useState } from 'react';
import ErrorBoundary from '../ErrorBoundary.jsx';

export default {
  title: 'Components/ErrorBoundary',
  component: ErrorBoundary,
  tags: ['autodocs'],
};

function ThrowingChild() {
  throw new Error('Something went wrong');
}

function SafeChild() {
  return <div style={{ color: '#e2e4ea', padding: 16 }}>Child rendered safely</div>;
}

function ToggleChild() {
  const [shouldThrow, setShouldThrow] = useState(false);
  return (
    <div>
      <button
        onClick={() => setShouldThrow(true)}
        style={{ marginBottom: 12, padding: '6px 12px', background: '#5e6ad2', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
      >
        Throw error
      </button>
      {shouldThrow ? <ThrowingChild /> : <SafeChild />}
    </div>
  );
}

export const NoError = {
  render: () => (
    <ErrorBoundary>
      <SafeChild />
    </ErrorBoundary>
  ),
};

export const WithError = {
  render: () => (
    <ErrorBoundary>
      <ThrowingChild />
    </ErrorBoundary>
  ),
};

export const Interactive = {
  render: () => (
    <ErrorBoundary>
      <ToggleChild />
    </ErrorBoundary>
  ),
};
