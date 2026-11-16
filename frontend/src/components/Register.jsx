import { useState } from 'react';
import useAuthStore from '../store/authStore.js';
import AuthDialog from './AuthDialog.jsx';
import GoogleSignInButton, { GOOGLE_SIGNIN_ENABLED } from './GoogleSignInButton.jsx';

export default function Register({ onClose, onSwitch }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  // Google is the primary option; the email/password form stays reachable
  // behind a link, and is shown outright when Google sign-in is unavailable.
  const [showEmailForm, setShowEmailForm] = useState(!GOOGLE_SIGNIN_ENABLED);
  const register = useAuthStore((s) => s.register);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email, password, displayName || undefined);
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthDialog label="Register" onClose={onClose}>
      <h2>Create account</h2>
      <GoogleSignInButton
        onSuccess={onClose}
        onError={setError}
        onUnavailable={() => setShowEmailForm(true)}
      />
      {error && <p className="auth-error" role="alert">{error}</p>}
      {showEmailForm ? (
        <>
          <p className="auth-divider">or</p>
          <form onSubmit={handleSubmit}>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Display name (optional)
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
            <label>
              Password (min 8 chars)
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </label>
            <button type="submit" className="auth-btn auth-btn--primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create account'}
            </button>
          </form>
        </>
      ) : (
        <p>
          <button type="button" className="auth-link" onClick={() => setShowEmailForm(true)}>
            Use email and password instead
          </button>
        </p>
      )}
      <p className="auth-switch">
        Already have an account? <button type="button" className="auth-link" onClick={onSwitch}>Log in</button>
      </p>
    </AuthDialog>
  );
}
