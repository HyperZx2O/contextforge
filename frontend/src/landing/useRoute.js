import { useEffect, useState } from 'react';

// Parses the current pathname + search into a route object:
//   { page: 'landing' }
//   { page: 'app' }
//   { page: 'app', nodeId: '...' }
//   { page: 'app', edgeId: '...' }
//   { page: 'app', demo: 'rag_2024' }
function parsePath(pathname, search) {
  if (pathname === '/') return { page: 'landing' };
  if (pathname === '/account') return { page: 'account' };
  const params = new URLSearchParams(search || '');
  const demo = params.get('demo');
  const nodeMatch = pathname.match(/^\/app\/node\/(.+)$/);
  if (nodeMatch) return { page: 'app', nodeId: decodeURIComponent(nodeMatch[1]) };
  const edgeMatch = pathname.match(/^\/app\/edge\/(.+)$/);
  if (edgeMatch) return { page: 'app', edgeId: decodeURIComponent(edgeMatch[1]) };
  const route = { page: 'app' };
  if (demo) route.demo = demo;
  return route;
}

// Minimal pathname router (no external dependency). The landing page lives at
// "/"; the existing app workspace lives everywhere else ("/app", etc.).
// Supports deep linking: /app/node/:id, /app/edge/:id.
export function useRoute() {
  const [route, setRoute] = useState(() => parsePath(window.location.pathname, window.location.search));

  useEffect(() => {
    const onPop = () => setRoute(parsePath(window.location.pathname, window.location.search));
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
