// Context-aware brand mark: a small knowledge-graph glyph. Neutral nodes use
// currentColor so the mark inherits the surrounding text color (light --ink on
// every dark surface); the hub node and its edge use the brand lavender via
// var(--primary). One accent only, per context/design.md. Decorative: the
// adjacent wordmark carries the accessible name.
export default function BrandMark({ className, size = 18 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* edges: one lavender (the accent), the rest inherit currentColor */}
      <line x1="12" y1="12" x2="5" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="12" x2="19" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="12" x2="7" y2="19" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" />
      {/* outer nodes (currentColor) */}
      <circle cx="5" cy="6" r="2.4" fill="currentColor" />
      <circle cx="19" cy="7" r="2.4" fill="currentColor" />
      {/* hub node (brand lavender) */}
      <circle cx="12" cy="12" r="3.1" fill="var(--primary)" />
      <circle cx="7" cy="19" r="2.4" fill="currentColor" />
    </svg>
  );
}
