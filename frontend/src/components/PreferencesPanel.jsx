import { useState } from 'react';
import useAuthStore from '../store/authStore.js';
import useGraphStore from '../store/graphStore.js';
import { getPreferences, updatePreferences } from '../api/client.js';

// Persist and restore the workspace view state
// (graph vs timeline, active relationship filters) across devices.
export default function PreferencesPanel() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const viewMode = useGraphStore((s) => s.viewMode);
  const activeFilters = useGraphStore((s) => s.activeFilters);
  const setViewMode = useGraphStore((s) => s.setViewMode);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSave = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await updatePreferences({
        viewMode,
        activeFilters,
      });
      setSaved({ view_mode: res.view_mode, active_filters: res.active_filters || [] });
      setMessage('View saved.');
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage(err?.message || 'Could not save view.');
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await getPreferences();
      if (res.view_mode) setViewMode(res.view_mode);
      useGraphStore.setState({ activeFilters: res.active_filters || [] });
      setSaved({ view_mode: res.view_mode, active_filters: res.active_filters || [] });
      setMessage('Saved view applied.');
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage(err?.message || 'Could not load saved view.');
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <section className="account-panel preferences" data-testid="preferences-panel">
        <div className="panel-head"><h2>View</h2></div>
        <p className="panel-hint">Log in to save and restore your view.</p>
      </section>
    );
  }

  const hiddenCount = activeFilters.length;

  return (
    <section className="account-panel preferences" data-testid="preferences-panel">
      <div className="panel-head"><h2>View</h2></div>

      {message && <p className="preferences__message" role="status">{message}</p>}

      <dl className="preferences__state">
        <div className="preferences__cell">
          <dt>Layout</dt>
          <dd>{viewMode}</dd>
        </div>
        <div className="preferences__cell">
          <dt>Hidden filters</dt>
          <dd>{hiddenCount}</dd>
        </div>
      </dl>

      <div className="preferences__actions">
        <button
          type="button"
          className="account-btn account-btn--accent"
          data-testid="preferences-save"
          onClick={handleSave}
          disabled={busy}
        >
          Save current view
        </button>
        <button
          type="button"
          className="account-btn"
          data-testid="preferences-restore"
          onClick={handleRestore}
          disabled={busy}
        >
          Apply saved view
        </button>
      </div>

      {saved && (
        <p className="preferences__saved">
          Last saved {saved.view_mode} view with {saved.active_filters?.length ?? 0} hidden filters.
        </p>
      )}
    </section>
  );
}
