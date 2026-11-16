import { useState } from 'react';
import useAuthStore from '../store/authStore.js';
import { createBookmark } from '../api/client.js';

export default function BookmarkButton({ nodeId }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isAuthenticated) return null;

  const handleBookmark = async () => {
    setLoading(true);
    try {
      await createBookmark(nodeId);
      setBookmarked(true);
    } catch (err) {
      console.error('Bookmark failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className="timeline-expanded-card__btn"
      onClick={handleBookmark}
      disabled={loading || bookmarked}
      title="Bookmark this paper"
    >
      {bookmarked ? 'Bookmarked' : loading ? '...' : 'Bookmark'}
    </button>
  );
}
