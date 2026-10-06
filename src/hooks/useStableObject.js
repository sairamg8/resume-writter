import { useRef } from 'react';
import { useStableActions } from '@/hooks/useStableActions';

const NONE = {};

/**
 * `source` — what a hook returns, plain values and functions (the rename box, the Export menu, the
 * account) — as one object that keeps its identity from one render to the next while its plain values
 * are the same. Its functions are useStableActions': they keep theirs and call the latest, so they are
 * never the reason it changes. A memoised part of the editor given it is not rendered again at every
 * keystroke elsewhere (PERF-4), and when a value it shows does change, it is rendered once. For an
 * object whose functions stay functions: each key's kind is taken from the first render.
 */
export function useStableObject(source) {
  const stable = useStableActions(source ?? NONE);
  const kept = useRef(null);
  const next = { ...source, ...stable };
  const last = kept.current;
  const keys = Object.keys(next);
  if (!last || keys.length !== Object.keys(last).length || !keys.every((k) => Object.hasOwn(last, k) && Object.is(last[k], next[k]))) kept.current = next;
  return kept.current;
}
