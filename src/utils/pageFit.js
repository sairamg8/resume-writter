// Design → Spacing's "1-Page Fit" (R2-149). It used to write one fixed set of numbers and never
// look at the result: a three-page résumé stayed two or three pages. Now the preset is the first
// step of a ladder, each step tighter than the one before, and the résumé is printed at each (the
// same react-pdf render the preview and Export PDF use) until one fits on one page. The first step
// that fits wins, so nothing is tighter than it needs to be; content is never touched. Past the last
// step the tightest is kept, and the panel says the content has to be shortened.
import { FONT_SIZE_BASE, TYPE_SIZE_PT, deltaInRange } from '../constants/designNumbers.js';

/** The preset as it always was: the first step, and all a résumé that fits at it gets. */
export const ONE_PAGE_FIT = { marginV: 10, marginH: 14, sectionGap: 10, itemGap: 5, lineHeightValue: 1.35 };

// Tighter spacing, one notch at a time: margins, the gaps between sections and entries, line height.
// All inside the Spacing controls' own ranges (MARGIN_MM, SECTION_GAP_PX, ITEM_GAP_PX, LINE_HEIGHT).
const SPACING_STEPS = [
  { marginV: 8, marginH: 12, sectionGap: 8, itemGap: 4, lineHeightValue: 1.3 },
  { marginV: 6, marginH: 10, sectionGap: 6, itemGap: 3, lineHeightValue: 1.25 },
  { marginV: 5, marginH: 8, sectionGap: 4, itemGap: 2, lineHeightValue: 1.2 },
];

/** The smallest base size the ladder shrinks the text to: smaller stops reading as a résumé. */
const MIN_FIT_BASE_PT = Math.max(FONT_SIZE_BASE.min, 9);
const DEFAULT_BASE_PT = 11; // what an unset fontSizeBase prints at (DesignPanelTypography)

/**
 * The steps 1-Page Fit tries for `settings`, loosest first: the preset, tighter spacing, then the
 * tightest spacing with the base font size a point smaller at a time down to MIN_FIT_BASE_PT (never
 * larger than the résumé's own). A smaller base keeps each stored size delta printing in its row's
 * range, as the Typography panel's Base control does.
 */
export function fitLadder(settings = {}) {
  const steps = [ONE_PAGE_FIT, ...SPACING_STEPS];
  const tightest = SPACING_STEPS.at(-1);
  const base = Number.isFinite(settings.fontSizeBase) ? settings.fontSizeBase : DEFAULT_BASE_PT;
  for (let size = Math.ceil(base) - 1; size >= MIN_FIT_BASE_PT; size -= 1) {
    const step = { ...tightest, fontSizeBase: size };
    for (const key of Object.keys(TYPE_SIZE_PT)) {
      if (typeof settings[key] !== 'number') continue;
      const kept = deltaInRange(key, settings[key], size);
      if (kept !== settings[key]) step[key] = kept;
    }
    steps.push(step);
  }
  return steps;
}

/** The number of pages in a PDF react-pdf wrote: its page objects, which it never compresses. */
export function countPdfPages(bytes) {
  const text = new TextDecoder('latin1').decode(bytes);
  return (text.match(/\/Type\s*\/Page(?![A-Za-z])/g) || []).length;
}

/** The résumé's page count as the preview and Export PDF print it — built as they are, in the PDF worker (pdfBuild.js). */
async function printedPages(resume) {
  const { buildResumePdf } = await import('./pdfBuild.js');
  const blob = await buildResumePdf(resume);
  return countPdfPages(new Uint8Array(await blob.arrayBuffer()));
}

/**
 * What of `resume` prints — its template, content and settings — as one string whose object keys are
 * sorted: the same for a copy of it (another tab's save, a sync) and different after any edit.
 */
export function printedKey(resume) {
  const sorted = (v) => (Array.isArray(v) ? v.map(sorted)
    : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
  const { template, sections, personal, settings } = resume || {};
  return JSON.stringify(sorted({ template, sections, personal, settings }));
}

/**
 * Find the loosest step of fitLadder that prints `resume` on one page. `countPages(resume)` is the
 * page counter (the app's own render by default). Resolves to `{ settings, pages, step }`: the
 * settings to write (a step's values), the page count at them, and the step's index — the last
 * step, with its page count still over one, when none fits. `stopped()` is asked before each step:
 * true (the panel closed, the résumé changed) resolves to null, with nothing more printed.
 */
export async function fitOnePage(resume, { countPages = printedPages, stopped = () => false } = {}) {
  const ladder = fitLadder(resume.settings || {});
  let pages = 0;
  for (let step = 0; step < ladder.length; step += 1) {
    if (stopped()) return null;
    pages = await countPages({ ...resume, settings: { ...resume.settings, ...ladder[step] } });
    if (pages <= 1) return { settings: ladder[step], pages, step };
  }
  return { settings: ladder.at(-1), pages, step: ladder.length - 1 };
}
