import { useEffect, useState } from 'react';
import useAuthStore from '../store/authStore.js';
import useGraphStore from '../store/graphStore.js';
import { usePipeline } from '../hooks/usePipeline.js';
import { createTemplate, listTemplates, deleteTemplate } from '../api/client.js';

// Save query presets (year range, topic, paper sources) and re-run them
// from the account page.
export default function TemplatePanel() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const jobStatus = useGraphStore((s) => s.jobStatus);
  const { runPipeline } = usePipeline();
  const [templates, setTemplates] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(true);

  const running = ['pending', 'ingesting', 'extracting', 'synthesizing', 'gap_finding'].includes(jobStatus);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listTemplates();
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!label.trim() || !query.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createTemplate({ query: query.trim(), label: label.trim() });
      setLabel('');
      setQuery('');
      await fetchTemplates();
    } catch (err) {
      setError(err?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async (t) => {
    await runPipeline(t.query);
  };

  const handleDelete = async (t) => {
    setError(null);
    try {
      await deleteTemplate(t.id);
      setTemplates((prev) => (prev || []).filter((x) => x.id !== t.id));
    } catch (err) {
      setError(err?.message || 'Failed to delete template');
    }
  };

  const handleListOpen = () => {
    if (templates === null && !loading) fetchTemplates();
  };

  // Load saved templates with the page, not on first toggle.
  useEffect(() => {
    if (isAuthenticated) fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <section className="account-panel templates" data-testid="template-panel">
        <div className="panel-head"><h2>Templates</h2></div>
        <p className="panel-hint">Log in to save and rerun query templates.</p>
      </section>
    );
  }

  return (
    <section className="account-panel templates" data-testid="template-panel">
      <div className="panel-head">
        <h2>Templates</h2>
        <button
          type="button"
          className="account-btn account-btn--sm"
          aria-expanded={open}
          onClick={() => { setOpen((o) => !o); handleListOpen(); }}
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open && (
        <>
          <div className="templates__save">
            <label className="account-field">
              <span className="account-field__label">Name</span>
              <input
                className="templates__input"
                aria-label="Template label"
                placeholder="e.g. Diffusion contradictions"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={200}
              />
            </label>
            <label className="account-field">
              <span className="account-field__label">Query</span>
              <textarea
                className="templates__query"
                aria-label="Template query"
                placeholder="contradicting papers on diffusion models"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="account-btn account-btn--accent"
              data-testid="template-save"
              onClick={handleSave}
              disabled={saving || !label.trim() || !query.trim() || running}
            >
              {saving ? 'Saving' : 'Save current query as template'}
            </button>
          </div>

          {error && <p className="account-panel__error" role="alert">{error}</p>}

          <div className="templates__list-head">
            <span className="templates__list-title">Saved templates</span>
            <button
              type="button"
              className="account-btn account-btn--sm"
              onClick={fetchTemplates}
              disabled={loading}
              aria-busy={loading}
            >
              Refresh
            </button>
          </div>

          {templates === null ? (
            <p className="panel-hint">Open the panel to load saved templates.</p>
          ) : templates.length === 0 ? (
            <p className="panel-hint" data-testid="templates-empty">No saved templates yet.</p>
          ) : (
            <ul className="account-list account-list--scroll">
              {templates.map((t) => (
                <li key={t.id} className="account-list__item" data-testid={`template-${t.id}`}>
                  <div className="account-list__main">
                    <strong className="account-list__title">{t.label}</strong>
                    <span className="account-list__note">{t.query}</span>
                    {(t.year_from || t.year_to) && (
                      <span className="account-list__meta">
                        {t.year_from ?? 'Any'} to {t.year_to ?? 'Any'}
                      </span>
                    )}
                  </div>
                  <div className="account-list__actions">
                    <button
                      type="button"
                      className="account-btn account-btn--sm"
                      onClick={() => handleRun(t)}
                      disabled={running}
                    >
                      Run
                    </button>
                    <button
                      type="button"
                      className="account-btn account-btn--sm account-btn--danger"
                      onClick={() => handleDelete(t)}
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
