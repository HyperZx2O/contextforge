import { useState } from 'react';

// Deterministic illustrated avatar generated from a seed (usually the account
// email). DiceBear's hosted API is free and keyless; index.html allows the host
// in its img-src CSP. If the request fails, the component falls back to the
// account's initial so a header never shows a broken image.
const AVATAR_URL = (seed, size) =>
  `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}&size=${size * 2}`;

export default function Avatar({ seed, size = 32, className = '' }) {
  const [failed, setFailed] = useState(false);
  const safeSeed = (seed || 'contextforge').trim() || 'contextforge';
  const initial = safeSeed.charAt(0).toUpperCase();

  return (
    <span
      className={`avatar${className ? ` ${className}` : ''}`}
      style={{ '--avatar-size': `${size}px` }}
      aria-hidden="true"
    >
      {failed ? (
        <span className="avatar__fallback">{initial}</span>
      ) : (
        <img
          className="avatar__img"
          src={AVATAR_URL(safeSeed, size)}
          width={size}
          height={size}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
