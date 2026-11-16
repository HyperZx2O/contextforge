import { useState } from 'react';
import useAuthStore from '../store/authStore.js';
import AuthDialog from './AuthDialog.jsx';
import GoogleSignInButton, { GOOGLE_SIGNIN_ENABLED } from './GoogleSignInButton.jsx';

export default function Login({ onClose, onSwitch }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  // Google is the primary option; email/password stays reachable behind a link,
  // and is shown outright when Google sign-in is unavailable.
  const [showEmailForm, setShowEmailForm] = useState(!GOOGLE_SIGNIN_ENABLED);
  const login = useAuthStore((s) => s.login);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthDialog label="Log in" onClose={onClose}>
      <h2>Log in</h2>
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
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <button type="submit" className="auth-btn auth-btn--primary" disabled={loading}>
              {loading ? 'Logging in...' : 'Log in'}
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
        No account? <button type="button" className="auth-link" onClick={onSwitch}>Register</button>
      </p>
    </AuthDialog>
  );
}
