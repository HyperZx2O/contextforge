import { useRoute } from './landing/useRoute.js';
import LandingPage from './landing/LandingPage.jsx';
import App from './App.jsx';

// Top-level switch: "/" renders the marketing landing page; any other path
// (notably "/app") renders the existing ContextForge workspace.
export default function Root() {
  const route = useRoute();
  return (
    <div className="page-transition" key={route.page + (route.nodeId || '') + (route.edgeId || '')}>
      {route.page === 'landing' ? <LandingPage /> : <App route={route} />}
    </div>
  );
}
