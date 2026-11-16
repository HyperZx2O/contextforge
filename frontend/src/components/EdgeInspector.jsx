import { useState } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import useGraphStore from '../store/graphStore.js';
import useAuthStore from '../store/authStore.js';
import { EDGE_COLORS } from '../constants/colors.js';
import { titleOf } from '../utils/nodes.js';
import { copyBibtex } from '../utils/bibtex.js';
import { createBookmark, createAnnotation, logExport } from '../api/client.js';

// Shows evidence for the edge selected on the graph canvas.
export default function EdgeInspector() {
  const selectedEdge = useGraphStore((s) => s.selectedEdge);
  const nodes = useGraphStore((s) => s.nodes);
  const clearSelection = useGraphStore((s) => s.clearSelection);
  const [copiedId, setCopiedId] = useState(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [annotating, setAnnotating] = useState(false);
  const [annotationText, setAnnotationText] = useState('');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const handleBookmarkEdge = async () => {
    if (!selectedEdge) return;
    try {
      await createBookmark({
        node_id: srcId,
        edge_source: srcId,
        edge_target: tgtId,
        edge_type: selectedEdge.type,
      });
      setBookmarked(true);
    } catch (err) {
      console.error('Bookmark failed:', err);
    }
  };

  const handleAnnotateEdge = async () => {
    if (!annotationText.trim() || !selectedEdge) return;
    try {
      await createAnnotation({
        edge_source: srcId,
        edge_target: tgtId,
        edge_type: selectedEdge.type,
        text: annotationText.trim(),
      });
      setAnnotationText('');
      setAnnotating(false);
    } catch (err) {
      console.error('Annotation failed:', err);
    }
  };

  const handleExportBibtex = async (nodeId) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    await copyBibtex(node);
    logExport('bibtex', node?.properties?.title || nodeId).catch(() => {});
    setCopiedId(nodeId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const srcId = selectedEdge?.source?.id ?? selectedEdge?.source;
  const tgtId = selectedEdge?.target?.id ?? selectedEdge?.target;
  const sourceNode = nodes.find((n) => n.id === srcId);
  const targetNode = nodes.find((n) => n.id === tgtId);

  return (
    <div className="edge-inspector" data-testid="edge-inspector">
      <div className="edge-inspector__card">
        <h2>Edge Inspector</h2>
        {!selectedEdge ? (
          <p className="edge-empty">Select an edge to inspect its evidence.</p>
        ) : (
          <div className="edge-detail">
            <span
              className="edge-type-chip"
              data-testid="edge-type"
              style={{ background: EDGE_COLORS[selectedEdge.type] || '#888' }}
            >
              {selectedEdge.type}
            </span>

            <div className="edge-endpoints" data-testid="edge-endpoints">
              <span className="edge-source">
                {titleOf(nodes, srcId)}
                {sourceNode?.properties?.url && (
                  <a href={sourceNode.properties.url} target="_blank" rel="noopener noreferrer"
                     className="edge-endpoint-link" onClick={(e) => e.stopPropagation()}>
                    <ArrowUpRight size={12} aria-hidden="true" />
                  </a>
                )}
              </span>
              <span className="edge-arrow">
                <ArrowRight size={14} aria-hidden="true" />
              </span>
              <span className="edge-target">
                {titleOf(nodes, tgtId)}
                {targetNode?.properties?.url && (
                  <a href={targetNode.properties.url} target="_blank" rel="noopener noreferrer"
                     className="edge-endpoint-link" onClick={(e) => e.stopPropagation()}>
                    <ArrowUpRight size={12} aria-hidden="true" />
                  </a>
                )}
              </span>
            </div>

            {selectedEdge.properties?.evidence_quote && (
              <blockquote className="edge-evidence" data-testid="edge-evidence">
                {selectedEdge.properties.evidence_quote}
              </blockquote>
            )}

            {selectedEdge.properties?.confidence != null && (
              <span className="edge-confidence" data-testid="edge-confidence">
                {(selectedEdge.properties.confidence * 100).toFixed(0)}%
              </span>
            )}

            {selectedEdge.properties?.on_dimension && (
              <div className="edge-dimension" data-testid="edge-dimension">
                Dimension: {selectedEdge.properties.on_dimension}
              </div>
            )}

            <div className="edge-export-row">
              {sourceNode && (
                <button
                  className="export-btn"
                  onClick={() => handleExportBibtex(sourceNode.id)}
                >
                  {copiedId === sourceNode.id ? 'Copied!' : 'BibTeX (source)'}
                </button>
              )}
              {targetNode && (
                <button
                  className="export-btn"
                  onClick={() => handleExportBibtex(targetNode.id)}
                >
                  {copiedId === targetNode.id ? 'Copied!' : 'BibTeX (target)'}
                </button>
              )}
              {isAuthenticated && (
                <>
                  <button
                    className="export-btn"
                    onClick={handleBookmarkEdge}
                    disabled={bookmarked}
                  >
                    {bookmarked ? 'Bookmarked' : 'Bookmark'}
                  </button>
                  {annotating ? (
                    <div className="annotation-input">
                      <textarea
                        value={annotationText}
                        onChange={(e) => setAnnotationText(e.target.value)}
                        placeholder="Add a note..."
                        rows={2}
                      />
                      <button type="button" onClick={handleAnnotateEdge} disabled={!annotationText.trim()}>
                        Save
                      </button>
                      <button type="button" onClick={() => setAnnotating(false)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="export-btn" onClick={() => setAnnotating(true)}>
                      Annotate
                    </button>
                  )}
                </>
              )}
            </div>

            <button
              className="edge-close"
              data-testid="edge-inspector-close"
              onClick={clearSelection}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
