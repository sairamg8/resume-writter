import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Whether the editor's Share dialog is open, as `[open, setOpen]`. It is open for one account and one
 * résumé: it closes when sharing becomes unavailable (signed out, a letter) and when the account or the
 * résumé changes, and does not come back with them. A plain flag stayed true while the dialog was
 * unmounted for the sign-out, so signing in again opened it unasked. `sharable` is whether the Share
 * button is offered at all.
 */
export function useShareDialog(account, resumeId, sharable) {
  const key = sharable ? `${account}/${resumeId}` : null;
  const [openFor, setOpenFor] = useState(null);
  const current = useRef(key);
  current.current = key;
  // Asked to open: for what is shown now. Closed: for none.
  const setOpen = useCallback((on) => setOpenFor(on ? current.current : null), []);
  // Another account or résumé, or none: what was open before is forgotten, so coming back finds it closed.
  useEffect(() => { setOpenFor(null); }, [key]);
  return [key !== null && openFor === key, setOpen];
}
