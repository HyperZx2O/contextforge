import './App.css';
import { useEffect } from 'react';

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
import GlobalErrorToast from './components/GlobalErrorToast.jsx';
import BrandMark from './components/BrandMark.jsx';
import { useGraph } from './hooks/useGraph.js';
import useGraphStore from './store/graphStore.js';

export default function App({ route }) {
  useGraph();

  const searchQuery = useGraphStore((s) => s.searchQuery);
  const setSearchQuery = useGraphStore((s) => s.setSearchQuery);
  const viewMode = useGraphStore((s) => s.viewMode);
  const setViewMode = useGraphStore((s) => s.setViewMode);
  const selectedNode = useGraphStore((s) => s.selectedNode);
  const selectedEdge = useGraphStore((s) => s.selectedEdge);

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

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="app-header__brand" href="/">
          <BrandMark className="app-header__mark" />
          ContextForge
        </a>
        <div className="view-toggle">
          <button
            className={`view-toggle__btn ${viewMode === 'graph' ? 'view-toggle__btn--active' : ''}`}
            onClick={() => setViewMode('graph')}
          >
            Graph
          </button>
          <button
            className={`view-toggle__btn ${viewMode === 'timeline' ? 'view-toggle__btn--active' : ''}`}
            onClick={() => setViewMode('timeline')}
          >
            Timeline
          </button>
        </div>
      </header>
      <main className="app-layout">
        <section className="app-canvas">
          {viewMode === 'graph' ? <GraphCanvas /> : <TimelineView />}
          {selectedNode ? <NodeDetailPanel /> : <EdgeInspector />}
        </section>
        <aside className="app-panels">
          <input
            className="search-bar"
            type="search"
            placeholder="Search papers, authors…"
            aria-label="Search papers and authors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <p className="panel-hint">
            New here? Run the pipeline or load a demo to populate the graph.
          </p>
          <PipelineStatus />
          <FilterPanel />
          <NodeListView />
          <StatsPanel />
          <GapPanel />
          <QueryInterface />
        </aside>
      </main>
      <GlobalErrorToast />
    </div>
  );
}

