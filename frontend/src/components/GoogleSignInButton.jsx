import { useEffect, useRef, useState } from 'react';
import useAuthStore from '../store/authStore.js';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

let gisPromise = null;

// Load Google Identity Services once, shared across both auth modals.
function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google);
      script.onerror = () => {
        gisPromise = null;
        reject(new Error('Could not load Google Sign-In'));
      };
      document.head.appendChild(script);
    });
  }
  return gisPromise;
}

/** True when a Google client ID is configured at build time. */
export const GOOGLE_SIGNIN_ENABLED = Boolean(CLIENT_ID);

/**
 * Google's official "Continue with Google" button. Renders nothing when
 * VITE_GOOGLE_CLIENT_ID is unset or the GIS script cannot load, and reports
 * that through onUnavailable so the caller can fall back to email/password.
 */
export default function GoogleSignInButton({ onSuccess, onError, onUnavailable }) {
  const containerRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);

  // Keep callbacks current without re-initializing the button.
  const handlers = useRef({ onSuccess, onError, onUnavailable });
  handlers.current = { onSuccess, onError, onUnavailable };

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let cancelled = false;

    loadGis()
      .then((google) => {
        if (cancelled || !containerRef.current) return;
        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          ux_mode: 'popup',
          callback: async ({ credential }) => {
            try {
              await loginWithGoogle(credential);
              handlers.current.onSuccess?.();
            } catch (err) {
              handlers.current.onError?.(err.message);
            }
          },
        });
        google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: 280,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        handlers.current.onUnavailable?.();
      });

    return () => {
      cancelled = true;
    };
  }, [loginWithGoogle]);

  if (!CLIENT_ID || failed) return null;

  return (
    <div className="google-signin">
      <div ref={containerRef} />
    </div>
  );
}
