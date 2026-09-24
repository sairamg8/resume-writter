// Small glue the kit's components share: joining class names, and handing one element several
// refs and handlers — a Menu or Popover clones its trigger (often an IconButton, whose Tooltip clones
// the same button again), and each layer must add its own without dropping the caller's.

/** Class names joined with spaces; false, null, undefined and '' are left out. */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/** One ref callback that sets every ref given (callback refs and { current } objects alike). */
export function mergeRefs(...refs) {
  const live = refs.filter(Boolean);
  if (live.length <= 1) return live[0] ?? null;
  return (node) => {
    for (const ref of live) {
      if (typeof ref === 'function') ref(node);
      else ref.current = node;
    }
  };
}

/**
 * A handler that runs the caller's `theirs` first, then `ours` unless the caller called
 * event.preventDefault() — so a page can veto what the kit does (e.g. keep a menu open).
 */
export function composeHandlers(theirs, ours) {
  if (!theirs) return ours;
  if (!ours) return theirs;
  return (event, ...rest) => {
    theirs(event, ...rest);
    if (!event?.defaultPrevented) ours(event, ...rest);
  };
}

/** The elements Tab can reach inside `root`, in DOM order (visible, enabled, not tabindex -1). */
export function tabbables(root) {
  if (!root?.querySelectorAll) return [];
  const selector = 'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"], [contenteditable=""]';
  return Array.from(root.querySelectorAll(selector)).filter((el) => {
    if (el.disabled || el.getAttribute('tabindex') === '-1' || el.getAttribute('aria-hidden') === 'true') return false;
    if (el.tagName === 'INPUT' && el.type === 'hidden') return false;
    // offsetParent is null for display:none (and for position:fixed, which getClientRects still sees).
    return el.offsetParent !== null || el.getClientRects?.().length > 0;
  });
}

/**
 * Moves focus from `from` to the next (or, `backwards`, the previous) element Tab reaches in its
 * own layer — the page, or the dialog it sits in — skipping other portal layers. What Tab does
 * from a menu or popover: the panel lives at the end of <body>, so the browser's own next stop
 * would be past the whole page; the kit closes it and carries on from its trigger instead.
 * Stays on `from` when there is nothing further that way.
 */
export function focusNeighbour(from, backwards = false) {
  if (!from?.ownerDocument) return;
  const layer = from.closest?.('[data-ui-portal]');
  const root = layer ?? from.ownerDocument.body;
  const items = tabbables(root).filter((el) => layer || !el.closest?.('[data-ui-portal]'));
  const at = items.indexOf(from);
  const target = at < 0 ? null : items[at + (backwards ? -1 : 1)];
  target?.focus?.({ preventScroll: false });
}
