import './App.css';
import { useEffect } from 'react';

import GraphCanvas from './components/GraphCanvas.jsx';
import EdgeInspector from './components/EdgeInspector.jsx';
import FilterPanel from './components/FilterPanel.jsx';
import GapPanel from './components/GapPanel.jsx';
import QueryInterface from './components/QueryInterface.jsx';
import PipelineStatus from './components/PipelineStatus.jsx';
import NodeListView from './components/NodeListView.jsx';
import GlobalErrorToast from './components/GlobalErrorToast.jsx';
import BrandMark from './components/BrandMark.jsx';
import { useGraph } from './hooks/useGraph.js';
import useGraphStore from './store/graphStore.js';

export default function App({ route }) {
  useGraph();

  // Deep linking: select node/edge from URL params.
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
      </header>
      <main className="app-layout">
        <section className="app-canvas">
          <GraphCanvas />
          <EdgeInspector />
        </section>
        <aside className="app-panels">
          <p className="panel-hint">
            New here? Run the pipeline or load a demo to populate the graph.
          </p>
          <PipelineStatus />
          <FilterPanel />
          <NodeListView />
          <GapPanel />
          <QueryInterface />
        </aside>
      </main>
      <GlobalErrorToast />
    </div>
  );
}

