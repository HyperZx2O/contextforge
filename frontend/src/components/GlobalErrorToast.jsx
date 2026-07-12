import { useEffect } from 'react';
import useGraphStore from '../store/graphStore.js';

// Fixed-position notification for network/API errors. Appears whenever
// `globalError` is set and auto-dismisses after 5 seconds. Errors raised in
// one component (e.g. the query box) do not crash the rest of the app.
export default function GlobalErrorToast() {
  const globalError = useGraphStore((s) => s.globalError);
  const clearGlobalError = useGraphStore((s) => s.clearGlobalError);

  useEffect(() => {
    if (!globalError) return;
    const timer = setTimeout(clearGlobalError, 5000);
    return () => clearTimeout(timer);
  }, [globalError, clearGlobalError]);

  if (!globalError) return null;

  return (
    <div className="global-toast" data-testid="global-toast" role="alert">
      <span>{globalError}</span>
      <button data-testid="global-toast-close" onClick={clearGlobalError}>
        Dismiss
      </button>
    </div>
  );
}
