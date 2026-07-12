import useGraphStore from '../../store/graphStore.js';
import NodeListView from '../NodeListView.jsx';

export default {
  title: 'Components/NodeListView',
  component: NodeListView,
  tags: ['autodocs'],
};

const sampleNodes = [
  { id: '2401.12345', label: 'Graph Transformer Survey', type: 'paper', properties: { title: 'Graph Transformer Survey' } },
  { id: '2310.67890', label: 'Neo4j for Literature Maps', type: 'method', properties: { title: 'Neo4j for Literature Maps' } },
  { id: '2402.11111', label: 'Knowledge Graph Embeddings', type: 'paper', properties: { title: 'Knowledge Graph Embeddings' } },
  { id: '2311.22222', label: 'Citation Network Analysis', type: 'tool', properties: { title: 'Citation Network Analysis' } },
];

export const Default = {
  render: () => {
    useGraphStore.setState({ nodes: sampleNodes, selectedNode: null });
    return (
      <div style={{ width: 320, height: 480, border: '1px solid #2a2b33', borderRadius: 8, overflow: 'hidden' }}>
        <NodeListView />
      </div>
    );
  },
};

export const Empty = {
  render: () => {
    useGraphStore.setState({ nodes: [], selectedNode: null });
    return (
      <div style={{ width: 320, height: 480, border: '1px solid #2a2b33', borderRadius: 8, overflow: 'hidden' }}>
        <NodeListView />
      </div>
    );
  },
};
