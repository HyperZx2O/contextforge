import { useEffect, useState } from 'react';
import useAuthStore from '../store/authStore.js';
import { saveRun, getSavedRuns, deleteSavedRun } from '../api/client.js';
import useGraphStore from '../store/graphStore.js';

export default function SavedRuns() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const nodes = useGraphStore((s) => s.nodes);
  const selectedRun = useGraphStore((s) => s.selectedRun);
  const setSelectedRun = useGraphStore((s) => s.setSelectedRun);

  const fetchRuns = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSavedRuns();
      setRuns(data.runs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const label = prompt('Name this run:');
    if (!label) return;
    try {
      await saveRun(label);
      await fetchRuns();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this run?')) return;
    try {
      await deleteSavedRun(id);
      await fetchRuns();
    } catch (err) {
      setError(err.message);
    }
  };

  // Load the list as soon as the page is opened; this panel is the reason a
  // person came to the account page, so it should not wait for a click.
  useEffect(() => {
    if (isAuthenticated) fetchRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <section className="account-panel saved-runs">
        <div className="panel-head"><h2>Saved runs</h2></div>
        <p className="panel-hint">Log in to save and reopen runs.</p>
      </section>
    );
  }

  return (
    <section className="account-panel saved-runs">
      <div className="panel-head">
        <h2>Saved runs</h2>
        <div className="account-panel__actions">
          {nodes.length > 0 && (
            <button type="button" className="account-btn account-btn--accent" onClick={handleSave}>
              Save current
            </button>
          )}
          <button type="button" className="account-btn" onClick={fetchRuns} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {error && <p className="account-panel__error" role="alert">{error}</p>}
      {loading && runs.length === 0 && <p className="panel-hint">Loading saved runs.</p>}
      {!loading && runs.length === 0 && (
        <p className="panel-hint">No saved runs yet. Save one from the workspace header.</p>
      )}

      {runs.length > 0 && (
        <ul className="account-list account-list--scroll">
          {runs.map((r) => (
            <li key={r.id} className="account-list__item">
              <div className="account-list__main">
                <strong className="account-list__title">{r.label || r.query}</strong>
                <span className="account-list__stats">
                  <span><b>{r.node_count}</b> nodes</span>
                  <span><b>{r.edge_count}</b> edges</span>
                  <span><b>{r.gap_count}</b> gaps</span>
                </span>
                <span className="account-list__meta">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              <div className="account-list__actions">
                <button
                  type="button"
                  className="account-btn account-btn--sm"
                  onClick={() => setSelectedRun(r)}
                  disabled={selectedRun?.id === r.id}
                >
                  {selectedRun?.id === r.id ? 'Loaded' : 'Load'}
                </button>
                <button
                  type="button"
                  className="account-btn account-btn--sm account-btn--danger"
                  onClick={() => handleDelete(r.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
