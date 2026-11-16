import { useEffect, useState } from 'react';
import useAuthStore from '../store/authStore.js';
import useGraphStore from '../store/graphStore.js';
import {
  listBookmarks,
  deleteBookmark,
  listAnnotations,
  updateAnnotation,
  deleteAnnotation,
  listExports,
  getNodeDetail,
} from '../api/client.js';
import { titleOf } from '../utils/nodes.js';

const TABS = ['bookmarks', 'notes', 'exports'];

// Panel listing saved bookmarks, annotations and the export history.
export default function LibraryPanel() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const nodes = useGraphStore((s) => s.nodes);
  const selectNode = useGraphStore((s) => s.selectNode);
  const [tab, setTab] = useState('bookmarks');
  const [bookmarks, setBookmarks] = useState(null);
  const [annotations, setAnnotations] = useState(null);
  const [exportsList, setExportsList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState('');
  const [error, setError] = useState(null);
  const [titles, setTitles] = useState({});

  // The account page does not load the graph, so a marked node's title has to
  // be fetched by id. The store wins when the workspace already knows it.
  const nodeTitle = (id) => {
    if (!id) return '';
    const fromStore = titleOf(nodes, id);
    return fromStore === id ? titles[id] || id : fromStore;
  };

  const fetchTab = async (which) => {
    setLoading(true);
    setError(null);
    try {
      if (which === 'bookmarks') {
        const data = await listBookmarks();
        setBookmarks(data.bookmarks || []);
      } else if (which === 'notes') {
        const data = await listAnnotations();
        setAnnotations(data.annotations || []);
      } else {
        const data = await listExports();
        setExportsList(data.exports || []);
      }
    } catch (err) {
      setError(err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleTab = (which) => {
    setTab(which);
    if (which === 'bookmarks' && bookmarks === null) fetchTab('bookmarks');
    if (which === 'notes' && annotations === null) fetchTab('notes');
    if (which === 'exports' && exportsList === null) fetchTab('exports');
  };

  const handleDeleteBookmark = async (id) => {
    try {
      await deleteBookmark(id);
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      setError(err?.message || 'Failed to delete bookmark');
    }
  };

  const handleAnnotationSave = async (id) => {
    if (!editText.trim()) return;
    try {
      await updateAnnotation(id, editText.trim());
      setAnnotations((prev) => (prev || []).map((a) => (a.id === id ? { ...a, text: editText.trim() } : a)));
      setEditId(null);
    } catch (err) {
      setError(err?.message || 'Failed to update note');
    }
  };

  const handleDeleteAnnotation = async (id) => {
    try {
      await deleteAnnotation(id);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err?.message || 'Failed to delete note');
    }
  };

  // Bookmarks are the default tab, so load them with the page.
  useEffect(() => {
    if (isAuthenticated) fetchTab('bookmarks');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    const ids = new Set();
    (bookmarks || []).forEach((b) => b.node_id && ids.add(b.node_id));
    (annotations || []).forEach((a) => a.node_id && ids.add(a.node_id));
    const missing = [...ids].filter((id) => titleOf(nodes, id) === id && !titles[id]);
    if (missing.length === 0) return undefined;
    let cancelled = false;
    missing.forEach((id) => {
      getNodeDetail(id)
        .then((res) => {
          if (cancelled) return;
          const title = res?.node?.properties?.title;
          if (title) setTitles((prev) => ({ ...prev, [id]: title }));
        })
        .catch(() => {});
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookmarks, annotations, nodes, titles]);

  if (!isAuthenticated) {
    return (
      <section className="account-panel library" data-testid="library-panel">
        <div className="panel-head"><h2>Library</h2></div>
        <p className="panel-hint">Log in to see your bookmarks, notes and exports.</p>
      </section>
    );
  }

  return (
    <section className="account-panel library" data-testid="library-panel">
      <div className="panel-head"><h2>Library</h2></div>

      <div className="library__tabs" role="group" aria-label="Saved items">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            className={`library__tab${tab === t ? ' library__tab--active' : ''}`}
            onClick={() => handleTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {error && <div className="account-panel__error" role="alert">{error}</div>}

      {loading && <p className="panel-hint">Loading.</p>}

      {!loading && tab === 'bookmarks' && (
        bookmarks === null ? (
          <p className="panel-hint">Open to load bookmarks.</p>
        ) : bookmarks.length === 0 ? (
          <p className="panel-hint" data-testid="library-bookmarks-empty">No bookmarks yet.</p>
        ) : (
          <ul className="account-list account-list--scroll">
            {bookmarks.map((b) => (
              <li key={b.id} className="account-list__item" data-testid={`library-bookmark-${b.id}`}>
                <button
                  type="button"
                  className="account-list__main account-list__main--button"
                  onClick={() => b.node_id && selectNode(b.node_id)}
                >
                  <strong className="account-list__title">{nodeTitle(b.node_id) || 'Unknown paper'}</strong>
                  {b.note && <span className="account-list__note">{b.note}</span>}
                </button>
                <div className="account-list__actions">
                  <button
                    type="button"
                    className="account-btn account-btn--sm account-btn--danger"
                    onClick={() => handleDeleteBookmark(b.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {!loading && tab === 'notes' && (
        annotations === null ? (
          <p className="panel-hint">Open to load notes.</p>
        ) : annotations.length === 0 ? (
          <p className="panel-hint" data-testid="library-notes-empty">No notes yet.</p>
        ) : (
          <ul className="account-list account-list--scroll">
            {annotations.map((a) => (
              <li
                key={a.id}
                className={`account-list__item${editId === a.id ? ' account-list__item--editing' : ''}`}
                data-testid={`library-annotation-${a.id}`}
              >
                {editId === a.id ? (
                  <div className="library__edit">
                    <textarea
                      aria-label="Edit note"
                      value={editText}
                      rows={2}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                    <div className="library__edit-actions">
                      <button
                        type="button"
                        className="account-btn account-btn--sm account-btn--accent"
                        onClick={() => handleAnnotationSave(a.id)}
                        disabled={!editText.trim()}
                      >
                        Save
                      </button>
                      <button type="button" className="account-btn account-btn--sm" onClick={() => setEditId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="account-list__main account-list__main--button"
                      onClick={() => (a.node_id ? selectNode(a.node_id) : null)}
                    >
                      <span className="account-list__note">{a.text}</span>
                      <span className="account-list__meta">
                        {a.node_id
                          ? `Node: ${nodeTitle(a.node_id) || a.node_id}`
                          : a.edge_type
                            ? `Edge: ${a.edge_type}`
                            : 'General'}
                      </span>
                    </button>
                    <div className="account-list__actions">
                      <button
                        type="button"
                        className="account-btn account-btn--sm"
                        onClick={() => { setEditId(a.id); setEditText(a.text); }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="account-btn account-btn--sm account-btn--danger"
                        onClick={() => handleDeleteAnnotation(a.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )
      )}

      {!loading && tab === 'exports' && (
        exportsList === null ? (
          <p className="panel-hint">Open to load export history.</p>
        ) : exportsList.length === 0 ? (
          <p className="panel-hint" data-testid="library-exports-empty">No exports yet.</p>
        ) : (
          <ul className="account-list account-list--scroll">
            {exportsList.map((e) => (
              <li key={e.id} className="account-list__item" data-testid={`library-export-${e.id}`}>
                <div className="account-list__main">
                  <strong className="account-list__title">{e.kind}</strong>
                  {e.target && <span className="account-list__note">{e.target}</span>}
                  <span className="account-list__meta">{new Date(e.created_at).toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}
