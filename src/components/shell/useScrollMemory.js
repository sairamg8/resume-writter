import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Kept for the tab's life, not the shell's: the shell unmounts on a page outside it (the résumés,
// the editor), and Back from there into the Job Tracker opened it at the top (R4-APP-07). Each is
// filed under its key and its path: HashRouter gives the key 'default' to the first entry and to
// every address typed into the bar, so a key alone could hand one page another's offset.
const offsets = new Map();
const entryOf = (key, pathname) => `${key} ${pathname}`;

/**
 * The scroll position of the workspace's <main> per page visit (J-40 / R2-073): a new page opens at
 * the top, Back and Forward return to where that visit was scrolled, and a change of the search
 * alone (a filter, ?view=, ?issue=) leaves the scroll alone.
 *
 * Each history entry (location.key) keeps the last offset the user scrolled it to — recorded from
 * the scroll events, so it is the offset before the next page's content could clamp it. Returns
 * the onScroll handler for <main>.
 */
export function useScrollMemory(mainRef) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const lastOffset = useRef(0);
  const shownKey = useRef(location.key);
  const shownPath = useRef(location.pathname);

  // Leaving an entry — to another page or to the same page with another search — files its offset.
  // (Not on mount: the entry is only arriving, and its filed offset is what Back restores.)
  useLayoutEffect(() => {
    if (shownKey.current === location.key && shownPath.current === location.pathname) return;
    offsets.set(entryOf(shownKey.current, shownPath.current), lastOffset.current);
    shownKey.current = location.key;
    shownPath.current = location.pathname;
  }, [location.key, location.pathname]);
  // Leaving the shell altogether files the last entry's offset too.
  useLayoutEffect(() => () => {
    offsets.set(entryOf(shownKey.current, shownPath.current), lastOffset.current);
  }, []);

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const saved = navigationType === 'POP' ? offsets.get(entryOf(location.key, location.pathname)) : undefined;
    const top = saved ?? 0;
    main.scrollTop = top;
    lastOffset.current = top;
    // Only a new path moves the scroll; the entry and the way we came are read with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (event) => {
    lastOffset.current = event.currentTarget.scrollTop;
  };
}
