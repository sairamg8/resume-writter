import { useRef } from 'react';

/**
 * `list` itself while it holds the same values as the last one given: a list rebuilt at every render
 * (`items.map(i => i.id)`) keeps the identity of the first. dnd-kit's SortableContext wakes every
 * sortable under it when the list it is given is a new array, so a keystroke in one entry woke every
 * section and entry (PERF-4).
 */
export function useSameList(list) {
  const kept = useRef(list);
  const last = kept.current;
  if (last !== list && !(last.length === list.length && last.every((v, i) => v === list[i]))) kept.current = list;
  return kept.current;
}
