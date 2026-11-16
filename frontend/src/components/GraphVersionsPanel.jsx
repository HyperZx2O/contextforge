import { useEffect, useState } from 'react';
import useGraphStore from '../store/graphStore.js';
import useAuthStore from '../store/authStore.js';
import { listVersions, createVersion, deleteVersion, getVersion } from '../api/client.js';

export default function GraphVersionsPanel() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const selectedRun = useGraphStore((s) => s.selectedRun);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [activeVersionId, setActiveVersionId] = useState(null);

  const fetchVersions = async () => {
    if (!selectedRun) return;
    setLoading(true);
    try {
      const data = await listVersions(selectedRun.id);
      setVersions(data.versions || []);
    } catch (err) {
      console.error('Failed to load versions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newVersionName.trim() || !selectedRun) return;
    setCreating(true);
    try {
      const filterSettings = useGraphStore.getState().activeFilters;
      const layoutState = {
        viewMode: useGraphStore.getState().viewMode,
        searchQuery: useGraphStore.getState().searchQuery,
      };
      await createVersion(selectedRun.id, newVersionName.trim(), filterSettings, layoutState);
      setNewVersionName('');
      await fetchVersions();
    } catch (err) {
      console.error('Failed to create version:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleLoad = async (version) => {
    try {
      const data = await getVersion(selectedRun.id, version.id);
      if (data.filter_settings) useGraphStore.getState().setActiveFilters(data.filter_settings);
      if (data.layout_state) {
        useGraphStore.getState().setViewMode(data.layout_state.viewMode || 'graph');
        useGraphStore.getState().setSearchQuery(data.layout_state.searchQuery || '');
      }
      setActiveVersionId(version.id);
    } catch (err) {
      console.error('Failed to load version:', err);
    }
  };

  const handleDelete = async (versionId) => {
    if (!confirm('Delete this version?')) return;
    try {
      await deleteVersion(selectedRun.id, versionId);
      await fetchVersions();
      if (activeVersionId === versionId) setActiveVersionId(null);
    } catch (err) {
      console.error('Failed to delete version:', err);
    }
  };

  // Versions belong to the selected run, so reload whenever that changes.
  useEffect(() => {
    if (isAuthenticated && selectedRun) fetchVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, selectedRun?.id]);

  if (!isAuthenticated) {
    return (
      <section className="account-panel graph-versions">
        <div className="panel-head"><h2>Graph versions</h2></div>
        <p className="panel-hint">Log in to keep versions of a saved run.</p>
      </section>
    );
  }

  return (
    <section className="account-panel graph-versions">
      <div className="panel-head">
        <h2>Graph versions</h2>
        {selectedRun && (
          <div className="graph-versions__create">
            <input
              type="text"
              aria-label="Version name"
              value={newVersionName}
              onChange={(e) => setNewVersionName(e.target.value)}
              placeholder="Version name"
              disabled={creating}
            />
            <button
              type="button"
              className="account-btn account-btn--accent account-btn--sm"
              onClick={handleCreate}
              disabled={creating || !newVersionName.trim()}
            >
              {creating ? 'Saving' : 'Save version'}
            </button>
          </div>
        )}
      </div>

      {!selectedRun ? (
        <p className="panel-hint">Save a run first. Then version its filters and layout here.</p>
      ) : (
        <>
          <p className="graph-versions__run">
            Versions of <strong>{selectedRun.label || selectedRun.query}</strong>
          </p>

          <div className="graph-versions__toolbar">
            <button
              type="button"
              className="account-btn account-btn--sm"
              onClick={fetchVersions}
              disabled={loading}
              aria-busy={loading}
            >
              Refresh
            </button>
          </div>

          {!loading && versions.length === 0 && (
            <p className="panel-hint">No versions yet. Save the current view to keep a snapshot.</p>
          )}

          {versions.length > 0 && (
            <ul className="account-list account-list--scroll">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className={`account-list__item${activeVersionId === v.id ? ' account-list__item--active' : ''}`}
                >
                  <div className="account-list__main">
                    <strong className="account-list__title">{v.version_name}</strong>
                    <span className="account-list__stats">
                      <span><b>{v.node_count}</b> nodes</span>
                      <span><b>{v.edge_count}</b> edges</span>
                      <span><b>{v.gap_count}</b> gaps</span>
                    </span>
                    <span className="account-list__meta">{new Date(v.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="account-list__actions">
                    <button
                      type="button"
                      className="account-btn account-btn--sm"
                      onClick={() => handleLoad(v)}
                      disabled={activeVersionId === v.id}
                    >
                      {activeVersionId === v.id ? 'Active' : 'Load'}
                    </button>
                    <button
                      type="button"
                      className="account-btn account-btn--sm account-btn--danger"
                      onClick={() => handleDelete(v.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
