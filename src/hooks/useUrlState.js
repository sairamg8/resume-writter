import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// One piece of page state kept in the address — the job tracker's ?view=, the board's ?issue= —
// so Back, refresh and a shared link all show the same page. (The tracker's search box is not
// here: the router commits a navigation in a transition, and a text box whose value follows one
// drops keystrokes; it, the status filter and the list sort are in useSessionState.) Writes REPLACE the
// history entry (typing a search must not leave one entry per letter), keep every other param
// and the router state, and never scroll the page (WorkspaceLayout resets scroll only when the
// path changes).

/** `search` ('?a=1&b=2') with `name` set to `value`, or removed for null / undefined / ''. */
export function withSearchParam(search, name, value) {
  const params = new URLSearchParams(search);
  if (value === null || value === undefined || value === '') params.delete(name);
  else params.set(name, String(value));
  const text = params.toString();
  return text ? `?${text}` : '';
}

/**
 * Several setters called in one event (clear the search and the status filter together) each
 * start from the address as the page last rendered it, and the second would undo the first. The
 * last address written from a history entry (its `key`) is kept here, and the next write from that
 * same entry builds on it; once the router has moved on, the key differs and it is ignored.
 */
let pending = null;

/**
 * `const [value, setValue] = useUrlState(name, fallback, { parse, serialize, push })`
 *
 * - `value`: the param `name` read through `parse` (default: the string itself); `fallback` when
 *   the param is absent (or `parse` returns undefined).
 * - `setValue(next)` (or `setValue(prev => next)`): writes `serialize(next)` (default String);
 *   writing `fallback`, null or '' removes the param, so a default view keeps a clean address.
 * - `push: true` pushes a history entry instead of replacing — for state Back should undo, like
 *   opening an issue (?issue=KEY-12), so Back closes it.
 *
 * Arrays: pass `parse: (s) => s.split(',')` and `serialize: (a) => a.join(',')` (?status=a,b).
 */
export function useUrlState(name, fallback = null, { parse, serialize, push = false } = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  // The router has rendered another entry: what was pending is written (or left behind by Back).
  if (pending && pending.key !== location.key) pending = null;
  const raw = new URLSearchParams(location.search).get(name);
  const parsed = raw === null ? undefined : parse ? parse(raw) : raw;
  const value = parsed === undefined ? fallback : parsed;

  const setValue = useCallback((next) => {
    const base = pending && pending.key === location.key ? pending.to : location.search;
    const currentRaw = new URLSearchParams(base).get(name);
    const currentParsed = currentRaw === null ? undefined : parse ? parse(currentRaw) : currentRaw;
    const current = currentParsed === undefined ? fallback : currentParsed;
    const resolved = typeof next === 'function' ? next(current) : next;
    const same = resolved === fallback
      || (Array.isArray(resolved) && Array.isArray(fallback) && resolved.length === fallback.length && resolved.every((v, i) => v === fallback[i]));
    const text = same || resolved === null || resolved === undefined ? '' : serialize ? serialize(resolved) : String(resolved);
    const search = withSearchParam(base, name, text);
    if (search === base) return;
    pending = { key: location.key, to: search };
    navigate({ pathname: location.pathname, search, hash: location.hash }, { replace: !push, state: location.state });
  }, [location, navigate, name, fallback, parse, serialize, push]);

  return [value, setValue];
}
