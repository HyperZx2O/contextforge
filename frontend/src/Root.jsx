import { lazy, Suspense } from 'react';
import { useRoute } from './landing/useRoute.js';
import LandingPage from './landing/LandingPage.jsx';
import AccountPage from './AccountPage.jsx';

const App = lazy(() => import('./App.jsx'));

export default function Root() {
  const route = useRoute();
  if (route.page === 'landing') return <LandingPage />;
  if (route.page === 'account') return <AccountPage />;
  return (
    <Suspense fallback={<div className="graph-canvas"><div className="graph-empty">Loading.</div></div>}>
      <App route={route} />
    </Suspense>
  );
}