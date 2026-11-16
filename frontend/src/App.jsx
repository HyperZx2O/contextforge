import './App.css';
import { useEffect, useRef } from 'react';

import GraphCanvas from './components/GraphCanvas.jsx';
import TimelineView from './components/TimelineView.jsx';
import EdgeInspector from './components/EdgeInspector.jsx';
import NodeDetailPanel from './components/NodeDetailPanel.jsx';
import FilterPanel from './components/FilterPanel.jsx';
import GapPanel from './components/GapPanel.jsx';
import QueryInterface from './components/QueryInterface.jsx';
import PipelineStatus from './components/PipelineStatus.jsx';
import NodeListView from './components/NodeListView.jsx';
import StatsPanel from './components/StatsPanel.jsx';
import SearchBar from './components/SearchBar.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import GlobalErrorToast from './components/GlobalErrorToast.jsx';
import SaveRunButton from './components/SaveRunButton.jsx';
import AccountMenu from './components/AccountMenu.jsx';
import { useGraph, loadDemoIntoStore } from './hooks/useGraph.js';
import useLiquidGlass from './hooks/useLiquidGlass.js';
import BrandMark from './components/BrandMark.jsx';
import useGraphStore from './store/graphStore.js';
import useAuthStore from './store/authStore.js';

// The workspace header carries the same liquid glass as the landing nav.
// Softer than the nav's settings: this one is wide and short rather than
// pill-shaped, and the graph canvas scrolls under it constantly, so the
// rim bulge reads best pulled well back from the landing's -96.
const HEADER_GLASS = {
  scale: -72,
  chroma: 4,
  blur: 2,
  saturate: 1.5,
  border: 0.03,
  mapBlur: 14,
};

export default function App({ route }) {
  const demoId = route?.demo;
  // A demo comes from the bundle, so the network fetch is skipped —
  // otherwise a dead backend races it and overwrites the graph with an
  // error banner.
  useGraph({ skip: Boolean(demoId) });

  const viewMode = useGraphStore((s) => s.viewMode);
  const nodes = useGraphStore((s) => s.nodes);
  const setViewMode = useGraphStore((s) => s.setViewMode);
  const selectedNode = useGraphStore((s) => s.selectedNode);

  const headerRef = useRef(null);
  useLiquidGlass(headerRef, HEADER_GLASS);

  // Restore a logged-in session from the refresh cookie after a page reload.
  useEffect(() => {
    useAuthStore.getState().initAuth();
  }, []);

  useEffect(() => {
    if (route?.nodeId) {
      useGraphStore.getState().selectNode(route.nodeId);
    } else if (route?.edgeId) {
      const edges = useGraphStore.getState().edges;
      const edge = edges.find(
        (e) => String(e.source?.id ?? e.source) === route.edgeId ||
               String(e.target?.id ?? e.target) === route.edgeId,
      );
      if (edge) useGraphStore.getState().selectEdge(edge);
    }
  }, [route?.nodeId, route?.edgeId]);

  // Load a demo from the bundle. No services required.
  useEffect(() => {
    if (demoId) loadDemoIntoStore(demoId);
  }, [demoId]);

  return (
    <div className="app-shell">
      <header className="app-header" ref={headerRef}>
        <a className="app-header__brand" href="/">
          <BrandMark className="app-header__mark" />
          ContextForge
        </a>
        <div className="view-toggle" role="radiogroup" aria-label="View mode">
          <button
            className={`view-toggle__btn ${viewMode === 'graph' ? 'view-toggle__btn--active' : ''}`}
            onClick={() => setViewMode('graph')}
            role="radio"
            aria-checked={viewMode === 'graph'}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="4.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.3"/>
              <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.3"/>
              <circle cx="10" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <line x1="6" y1="5.5" x2="8.5" y2="8.5" stroke="currentColor" strokeWidth="1.1"/>
              <line x1="6" y1="5" x2="8.7" y2="4.5" stroke="currentColor" strokeWidth="1.1"/>
            </svg>
            Graph
          </button>
          <button
            className={`view-toggle__btn ${viewMode === 'timeline' ? 'view-toggle__btn--active' : ''}`}
            onClick={() => setViewMode('timeline')}
            role="radio"
            aria-checked={viewMode === 'timeline'}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <line x1="2" y1="3" x2="12" y2="3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="3.5" cy="3" r="1.2" fill="currentColor"/>
              <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="7" cy="7" r="1.2" fill="currentColor"/>
              <line x1="2" y1="11" x2="12" y2="11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="10" cy="11" r="1.2" fill="currentColor"/>
            </svg>
            Timeline
          </button>
        </div>
        {nodes.length > 0 && <SaveRunButton query="" />}
        <AccountMenu />
      </header>
      <main className="app-layout">
        <section className="app-canvas">
          {viewMode === 'graph' ? <GraphCanvas /> : <TimelineView />}
          {viewMode === 'graph' && (selectedNode ? <NodeDetailPanel /> : <EdgeInspector />)}
        </section>
        <aside className="app-panels">
          <SearchBar />
          <p className="panel-hint">
            New here? Run the pipeline or load a demo to populate the graph.
          </p>
          <ErrorBoundary><PipelineStatus /></ErrorBoundary>
          <ErrorBoundary><FilterPanel /></ErrorBoundary>
          <ErrorBoundary><NodeListView /></ErrorBoundary>
          <ErrorBoundary><StatsPanel /></ErrorBoundary>
          <ErrorBoundary><GapPanel /></ErrorBoundary>
          <ErrorBoundary><QueryInterface /></ErrorBoundary>
        </aside>
      </main>
      <GlobalErrorToast />
    </div>
  );
}
