import { lazy, Suspense, useMemo, useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// The Documents page's pieces that load apart from the start-up path: the letter picker (with the kit's
// Dialog), Career History, and a card's more menu (with the kit's Menu). Not lazyPage: its reload on a
// failed load would drop a draft, and a piece here is not a page — each has its own boundary and a
// fallback where it is used (Lazy).
export const loaders = {
  letter: () => import('@/components/NewLetterModal'),
  career: () => import('@/components/CareerHistoryPanel').then((m) => ({ default: m.CareerHistoryPanel })),
  menu: () => import('@/components/CardMenu').then((m) => ({ default: m.CardMenu })),
};
export const warmed = new Set();

// One lazy() per piece, made once: a new one at each mount suspends once more, so a remount (Back) lost
// the loaded piece from its first commit. Keyed by the loader, so a replaced loader gets its own.
const views = new Map();
const viewFor = (key) => {
  const load = loaders[key];
  if (views.get(key)?.load === load) return views.get(key).View;
  // A rejection stays in a lazy() for good: drop it, so the next ask (Try again, a remount) imports again.
  const View = lazy(() => load().catch((e) => { if (views.get(key)?.View === View) views.delete(key); throw e; }));
  views.set(key, { load, View });
  return View;
};

/** Fetches a piece ahead of its first use, once: in idle time, or when its button is hovered or focused. */
export const warm = (key) => { if (!warmed.has(key)) { warmed.add(key); loaders[key]().catch(() => {}); } };

/**
 * `load`'s piece, props passed on. While it arrives `pending` shows (nothing by default); a failed load
 * shows `fallback(retry, tries)` (tries: Try agains so far); retry imports it again.
 */
export function Lazy({ load, fallback, pending = null, ...props }) {
  const [tries, setTries] = useState(0);
  const View = useMemo(() => viewFor(load), [load, tries]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ErrorBoundary key={tries} fallback={fallback(() => setTries(tries + 1), tries)}>
      <Suspense fallback={pending}><View {...props} /></Suspense>
    </ErrorBoundary>
  );
}
