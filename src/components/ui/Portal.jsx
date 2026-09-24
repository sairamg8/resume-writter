import { createPortal } from 'react-dom';

/**
 * Renders `children` at the end of <body>, outside the page's scroll box and stacking contexts, so a
 * dialog, menu or toast is never clipped by an `overflow: hidden` ancestor. The wrapper marks the
 * layer: focus traps let focus into [data-ui-portal] layers (a menu opened from inside a dialog),
 * and [data-ui-motion] puts it under the kit's reduced-motion rule (src/index.css). Nothing on the
 * server, which has no document.
 */
export function Portal({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div data-ui-portal="" data-ui-motion="" className="contents">{children}</div>,
    document.body,
  );
}
