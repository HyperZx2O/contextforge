import { useState } from 'react';
import useAuthStore from '../store/authStore.js';
import { createAnnotation } from '../api/client.js';

export default function AnnotationButton({ nodeId }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [showInput, setShowInput] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!isAuthenticated) return null;

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await createAnnotation({ node_id: nodeId, text: text.trim() });
      setSaved(true);
      setText('');
      setTimeout(() => { setSaved(false); setShowInput(false); }, 1500);
    } catch (err) {
      console.error('Annotation failed:', err);
    } finally {
      setSaving(false);
    }
  };

  if (saved) return <span className="timeline-expanded-card__btn">Saved</span>;

  if (showInput) {
    return (
      <div className="annotation-input">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a note..."
          rows={2}
        />
        <button type="button" onClick={handleSave} disabled={saving || !text.trim()}>
          {saving ? 'Saving...' : 'Save note'}
        </button>
        <button type="button" onClick={() => setShowInput(false)}>Cancel</button>
      </div>
    );
  }

  return (
    <button
      className="timeline-expanded-card__btn"
      onClick={() => setShowInput(true)}
      title="Add a note to this paper"
    >
      Annotate
    </button>
  );
}
