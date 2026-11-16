import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * The sign-in dialog. Rendered in a portal because both call sites sit inside
 * the landing nav pill, whose backdrop-filter would otherwise become the
 * containing block and clip a fixed overlay to the 56px pill.
 */
export default function AuthDialog({ label, onClose, children }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="auth-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="auth-modal" role="dialog" aria-modal="true" aria-label={label}>
        <button type="button" className="auth-modal__close" onClick={onClose} aria-label="Close">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" focusable="false">
            <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
