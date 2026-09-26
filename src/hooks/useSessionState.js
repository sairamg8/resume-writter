import { useEffect, useState } from 'react';

// Page state kept for the browser tab's session (sessionStorage), not only for the page's life:
// the job tracker's search, status filter and list sort. Opening a job unmounts the tracker, so
// coming back reset all three while the view (?view=) came back with the address (J-30). They are
// not in the address too: the router navigates in a transition, and a text box whose value follows
// a transition drops keystrokes while the user types. Blocked or full storage keeps the state for
// this visit only, as before.

/** The value saved under `key`, or `fallback` when there is none, it is not JSON, or `valid` refuses it. */
function readSession(key, fallback, valid) {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    return valid(value) ? value : fallback;
  } catch {
    return fallback; // storage blocked, or a value this code did not write
  }
}

/**
 * `const [value, setValue] = useSessionState(key, fallback, valid)` — useState that starts from
 * what this tab last saved under `key` and saves every change. `valid(value)` guards what is read
 * back (a status that no longer exists, a sort by a column that is gone): refused, it is `fallback`.
 */
export function useSessionState(key, fallback, valid = () => true) {
  const [value, setValue] = useState(() => readSession(key, fallback, valid));
  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* blocked or full: this visit only */ }
  }, [key, value]);
  return [value, setValue];
}
