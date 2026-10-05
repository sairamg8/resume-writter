// The column layout the two-column Sidebar template offers (Design → Template → Layout, R2-147-col),
// and the only values its PDF and Word export draw. Its own module with relative imports only, so the
// panel, the PDF, Word, normalizeResume and Node's test runner read one list — the way photoOptions.js
// is read for Photo (AUD-25).
//
// Three questions, three settings; the Sidebar is the one engine with a side column, and every other
// template prints one column and ignores them:
//   columns        `sidebarSingleColumn` (Single · ATS-safe: Classic's page, kept as it always was) or
//                  `layoutColumns`: 'two', the side column beside the main one, or 'mixed' — the header
//                  on a band, the main sections across the whole page, then the short sections
//                  (SIDEBAR_COLUMN_TYPES) in two columns under them. columnsOf() says which of
//                  'one' | 'two' | 'mixed' a résumé prints.
//   details        `layoutDetails`, in the two-column layout: where the name, photo and contacts sit —
//                  'left' (today's), 'right' (the column on the right) or 'top' (a band across the top,
//                  the column beneath it). Mixed has its band on top, so it takes none.
//   width          `layoutSideWidth`, % of the paper: the side column's, or the left column's of the
//                  short sections in Mixed. SIDE_WIDTH_PCT is the range the panel offers and the clamp.
// Unset — every résumé stored before — is 'two', 'left' and 38 %: the page as it always printed.
import { storedNumber } from './spacingNumbers.js';

/** One list per choice, in the order its buttons appear: `val` is what the résumé stores, `label` what the button reads. */
export const LAYOUT_OPTIONS = {
  layoutColumns: [{ val: 'two', label: 'Side column' }, { val: 'mixed', label: 'Mixed' }],
  layoutDetails: [{ val: 'left', label: 'Left' }, { val: 'right', label: 'Right' }, { val: 'top', label: 'Top' }],
};

/** What each choice prints when the résumé stores nothing for it — always one of its options. */
export const LAYOUT_DEFAULTS = { layoutColumns: 'two', layoutDetails: 'left' };

/**
 * The side column's width, % of the paper: the panel's range and step (one row, NumberRow), and the range
 * a stored value is clamped to. `default` is the 38 % the column always was (SIDE_COL, PdfPage.jsx).
 */
export const SIDE_WIDTH_PCT = { min: 24, max: 45, step: 1, default: 38 };

/** A stored choice as the panel would show it: `value` when the control offers it, else its default. */
export const layoutOption = (key, value) => (LAYOUT_OPTIONS[key].some((o) => o.val === value) ? value : LAYOUT_DEFAULTS[key]);

/**
 * A stored width as it prints and the panel shows it: a number (or text that is one) on the panel's step
 * inside SIDE_WIDTH_PCT, else the default — 30.4 is 30, 99 is 45, "abc" is 38.
 */
export function sideWidthOf(value) {
  const n = storedNumber(value);
  if (n === undefined) return SIDE_WIDTH_PCT.default;
  const { min, max, step } = SIDE_WIDTH_PCT;
  return Math.min(max, Math.max(min, min + Math.round((n - min) / step) * step));
}

/**
 * The columns a résumé's Sidebar prints: 'one' for Single · ATS-safe (`sidebarSingleColumn`, Classic's
 * page, which wins), else 'two' or 'mixed'. Meaningful on the Sidebar template only.
 */
export const columnsOf = (settings) => (settings?.sidebarSingleColumn ? 'one' : layoutOption('layoutColumns', settings?.layoutColumns));

/**
 * The layout the Sidebar template prints `settings` in: { columns: 'two' | 'mixed', details, widthPct } —
 * `details` is 'top' in Mixed, whose band is always on top — or null for Single · ATS-safe (one column, no
 * side column to place or size) and for every other template (`template` the résumé's, as templateId).
 */
export function sidebarLayout(template, settings) {
  if (template !== 'sidebar') return null;
  const columns = columnsOf(settings);
  if (columns === 'one') return null;
  return {
    columns,
    details: columns === 'mixed' ? 'top' : layoutOption('layoutDetails', settings?.layoutDetails),
    widthPct: sideWidthOf(settings?.layoutSideWidth),
  };
}

/**
 * `resume` with each layout choice stored as one the app offers and the width as a number in its range,
 * whatever its data version (an imported .json, a hand-edited store or a cloud copy can carry anything):
 * a value no build offered is dropped, so the default prints and the panel shows it, as for a résumé that
 * stores none; a width is clamped to SIDE_WIDTH_PCT, one that is no number dropped. Dropped, not stored as
 * undefined: Firestore refuses one. The same object when nothing changes; settings that are not an object
 * are left. normalizeResume runs it wherever résumés come in.
 */
export function withLayoutSettings(resume) {
  const settings = resume?.settings;
  if (!settings || typeof settings !== 'object') return resume;
  let next = null;
  for (const key of Object.keys(LAYOUT_OPTIONS)) {
    if (!(key in settings) || LAYOUT_OPTIONS[key].some((o) => o.val === settings[key])) continue;
    next ??= { ...settings };
    delete next[key];
  }
  if ('layoutSideWidth' in settings) {
    const n = storedNumber(settings.layoutSideWidth);
    const kept = n === undefined ? undefined : sideWidthOf(n);
    if (kept !== settings.layoutSideWidth) {
      next ??= { ...settings };
      if (kept === undefined) delete next.layoutSideWidth;
      else next.layoutSideWidth = kept;
    }
  }
  return next ? { ...resume, settings: next } : resume;
}
