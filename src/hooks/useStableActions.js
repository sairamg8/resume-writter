import { useLayoutEffect, useRef, useState } from 'react';

/**
 * The functions of `source` (the store's actions) as functions that keep their identity from one render
 * to the next and call the latest ones. The store makes new action functions at every render, so a
 * memoised part of the editor given them re-rendered at every keystroke (PERF-4). Made here, in the
 * editor's own code, not in the store: the store is on the start-up path and every byte of it counts.
 */
export function useStableActions(source) {
  const latest = useRef(source);
  useLayoutEffect(() => { latest.current = source; });
  const [stable] = useState(() => Object.fromEntries(
    Object.keys(source).filter(k => typeof source[k] === 'function').map(k => [k, (...args) => latest.current[k](...args)]),
  ));
  return stable;
}
