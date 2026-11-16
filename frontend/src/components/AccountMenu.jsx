import { useState } from 'react';
import { navigate } from '../landing/useRoute.js';
import useAuthStore from '../store/authStore.js';
import Avatar from './Avatar.jsx';
import Login from './Login.jsx';
import Register from './Register.jsx';
import { GOOGLE_SIGNIN_ENABLED } from './GoogleSignInButton.jsx';

export default function AccountMenu() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  if (isAuthenticated) {
    const seed = user?.email || user?.display_name || 'user';
    return (
      <div className="account-menu account-menu--authed">
        <button
          type="button"
          className="account-menu__avatar-btn"
          onClick={() => navigate('/account')}
          aria-label="Open account page"
        >
          <Avatar seed={seed} size={32} />
        </button>
        <button type="button" onClick={logout}>Log out</button>
      </div>
    );
  }

  return (
    <div className="account-menu">
      {GOOGLE_SIGNIN_ENABLED ? (
        <button type="button" onClick={() => setShowLogin(true)}>Log in</button>
      ) : (
        <>
          <button type="button" onClick={() => setShowLogin(true)}>Log in</button>
          <button type="button" onClick={() => setShowRegister(true)}>Register</button>
        </>
      )}
      {showLogin && <Login onClose={() => setShowLogin(false)} onSwitch={() => { setShowLogin(false); setShowRegister(true); }} />}
      {showRegister && <Register onClose={() => setShowRegister(false)} onSwitch={() => { setShowRegister(false); setShowLogin(true); }} />}
    </div>
  );
}
