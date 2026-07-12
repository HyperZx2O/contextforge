import { useEffect, useState } from 'react';

// Parses the current pathname into a route object:
//   { page: 'landing' }
//   { page: 'app' }
//   { page: 'app', nodeId: '...' }
//   { page: 'app', edgeId: '...' }
function parsePath(pathname) {
  if (pathname === '/') return { page: 'landing' };
  const nodeMatch = pathname.match(/^\/app\/node\/(.+)$/);
  if (nodeMatch) return { page: 'app', nodeId: decodeURIComponent(nodeMatch[1]) };
  const edgeMatch = pathname.match(/^\/app\/edge\/(.+)$/);
  if (edgeMatch) return { page: 'app', edgeId: decodeURIComponent(edgeMatch[1]) };
  return { page: 'app' };
}

// Minimal pathname router (no external dependency). The landing page lives at
// "/"; the existing app workspace lives everywhere else ("/app", etc.).
// Supports deep linking: /app/node/:id, /app/edge/:id.
export function useRoute() {
  const [route, setRoute] = useState(() => parsePath(window.location.pathname));

  useEffect(() => {
    const onPop = () => setRoute(parsePath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return route;
}

// Programmatic navigation. Updates the URL and triggers a popstate event
// so useRoute subscribers re-render.
export function navigate(path) {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
