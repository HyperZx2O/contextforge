import { useState } from 'react';
import useAuthStore from '../store/authStore.js';
import { saveRun } from '../api/client.js';

export default function SaveRunButton({ query }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  if (!isAuthenticated) return null;

  const handleSave = async () => {
    const label = query || prompt('Name this run:') || 'Untitled run';
    setSaving(true);
    setError(null);
    try {
      await saveRun(label);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="save-run">
      <button
        type="button"
        className="btn btn--secondary"
        data-testid="save-run"
        onClick={handleSave}
        disabled={saving || saved}
      >
        {saved ? 'Saved' : saving ? 'Saving...' : 'Save run'}
      </button>
      {error && <span className="save-run__error">{error}</span>}
    </div>
  );
}
