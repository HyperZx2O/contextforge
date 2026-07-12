export default function Skeleton({ rows = 3, className = '' }) {
  return (
    <div className={`skeleton ${className}`} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton__row" />
      ))}
    </div>
  );
}
