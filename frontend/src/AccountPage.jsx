import { useEffect } from 'react';
import { navigate } from './landing/useRoute.js';
import useAuthStore from './store/authStore.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Avatar from './components/Avatar.jsx';
import BrandMark from './components/BrandMark.jsx';
import SavedRuns from './components/SavedRuns.jsx';
import GraphVersionsPanel from './components/GraphVersionsPanel.jsx';
import TemplatePanel from './components/TemplatePanel.jsx';
import PreferencesPanel from './components/PreferencesPanel.jsx';
import LibraryPanel from './components/LibraryPanel.jsx';
import AccountMenu from './components/AccountMenu.jsx';
import './styles/account.css';

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M10 3.5 5.5 8l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AccountHeader({ onBack, backLabel, onLogout }) {
  return (
    <header className="account-page__header">
      <div className="account-page__bar">
        <span className="account-page__brand">
          <BrandMark className="account-page__mark" size={18} />
          <span>ContextForge</span>
        </span>
        <span className="account-page__spacer" />
        <button type="button" className="account-page__back" onClick={onBack}>
          <BackIcon />
          {backLabel}
        </button>
        {onLogout && (
          <button type="button" className="account-page__logout" onClick={onLogout}>
            Log out
          </button>
        )}
      </div>
    </header>
  );
}

// Full-page account management surface. Reachable by clicking the avatar in
// either header. Holds the "my stuff" panels that used to crowd the /app
// sidebar, leaving the workspace focused on graph exploration.
export default function AccountPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const initialized = useAuthStore((s) => s.initialized);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const initAuth = useAuthStore((s) => s.initAuth);

  // A hard reload lands here directly, outside App.jsx, so the refresh cookie
  // has to be re-exchanged here or the page would always look signed out.
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  if (!initialized) {
    return (
      <div className="account-page">
        <AccountHeader onBack={() => navigate('/')} backLabel="Home" />
        <div className="account-page__status" role="status">
          Opening your account.
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="account-page">
        <AccountHeader onBack={() => navigate('/')} backLabel="Home" />
        <main className="account-page__body account-page__body--center">
          <section className="account-page__signin">
            <span className="account-page__signin-mark" aria-hidden="true">
              <BrandMark size={28} />
            </span>
            <h1>Sign in to open your account</h1>
            <p>Saved runs, templates, view settings and marked papers are tied to your account.</p>
            <AccountMenu />
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="account-page">
      <AccountHeader
        onBack={() => navigate('/app')}
        backLabel="Workspace"
        onLogout={logout}
      />

      <main className="account-page__body">
        <div className="account-page__masthead">
          <Avatar seed={user?.email} size={64} className="account-page__avatar" />
          <div className="account-page__intro">
            <h1>Account</h1>
            <p className="account-page__email">{user?.email}</p>
            <p className="account-page__lede">
              Everything ContextForge keeps for this sign-in: saved runs, reusable templates,
              view settings and the papers you marked.
            </p>
          </div>
        </div>

        <div className="account-page__grid">
          <div className="account-cell account-cell--7">
            <ErrorBoundary><SavedRuns /></ErrorBoundary>
          </div>
          <div className="account-cell account-cell--5">
            <ErrorBoundary><PreferencesPanel /></ErrorBoundary>
          </div>
          <div className="account-cell account-cell--7">
            <ErrorBoundary><TemplatePanel /></ErrorBoundary>
          </div>
          <div className="account-cell account-cell--5 account-stack">
            <ErrorBoundary><LibraryPanel /></ErrorBoundary>
            <ErrorBoundary><GraphVersionsPanel /></ErrorBoundary>
          </div>
        </div>
      </main>
    </div>
  );
}
