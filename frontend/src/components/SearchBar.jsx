import { X } from 'lucide-react';
import useGraphStore from '../store/graphStore.js';

export default function SearchBar() {
  const searchQuery = useGraphStore((s) => s.searchQuery);
  const setSearchQuery = useGraphStore((s) => s.setSearchQuery);
  const matchingNodeIds = useGraphStore((s) => s.matchingNodeIds);

  const count = matchingNodeIds.size;
  const hasQuery = searchQuery.length > 0;

  return (
    <div className="search-bar-wrap" data-testid="search-bar">
      <input
        className="search-bar__input"
        type="search"
        placeholder="Search papers, authors…"
        aria-label="Search papers and authors"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      {hasQuery && (
        <button
          className="search-bar__clear"
          type="button"
          aria-label="Clear search"
          onClick={() => setSearchQuery('')}
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
      {hasQuery && (
        <span className="search-bar__count" data-testid="search-count">
          {count} match{count !== 1 ? 'es' : ''}
        </span>
      )}
    </div>
  );
}
