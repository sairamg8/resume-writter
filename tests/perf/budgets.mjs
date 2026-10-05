// The written performance budgets (R2-142, PERF-1; the plan is qa-visual-compare/wf3/perf_plan.md, "Budget").
// Every number the harness measures has a line here, and a measurement without one fails the run
// (budget-check.mjs, checkBudgets), so nothing is timed that nobody set a limit for.
//
// Two figures per timing. `max` is the CI ceiling the run is held to by default: a GitHub runner is a
// shared 2-vCPU machine, several times slower than the laptop the plan was measured on and noisy from
// one run to the next, so the ceilings sit far above the plan's figures — a gate that fails on noise is
// one people stop reading. It still catches a build that got several times slower, which is what a
// regression in the PDF path looks like. `target` is the plan's own figure for a quiet machine
// (i5-11300H, WOFF cache in: Node Classic 1p 43-71 ms, 3p 92-108, cover 23-36); `--strict` holds a run
// to those. Sizes and counts are deterministic, so their `max` is exact and has no target.
//
// Tighten a ceiling from the numbers a few dispatched runs print (docs/knowledge/08-testing.md); never
// loosen one to make a run pass — say why in the commit if the app really got that much heavier.

export const BUDGETS = [
  // N1: renderResumePdf / renderCoverLetterPdf through the app's own react-pdf code, median of warm builds.
  { id: 'render.classic1', group: 'render', label: 'PDF build: Classic, 1 page', unit: 'ms', max: 400, target: 100 },
  { id: 'render.classic3', group: 'render', label: 'PDF build: Classic, large résumé', unit: 'ms', max: 700, target: 150 },
  { id: 'render.cover', group: 'render', label: 'PDF build: cover letter', unit: 'ms', max: 200, target: 45 },

  // One keystroke in the Summary of the large résumé, as far as Node reaches: what PdfPreview does after
  // its debounce — build the PDF, open it in pdf.js, read every page's text, paint every page. The
  // debounce (350 ms) and the browser's own frame are not here; browser.keystrokeToPreview has them.
  { id: 'keystroke.pages', group: 'keystroke', label: 'Keystroke: pages of the large résumé', unit: 'count', min: 3 },
  { id: 'keystroke.build', group: 'keystroke', label: 'Keystroke: build the PDF', unit: 'ms', max: 700, target: 150 },
  { id: 'keystroke.open', group: 'keystroke', label: 'Keystroke: pdf.js opens it, reads the text', unit: 'ms', max: 400 },
  { id: 'keystroke.paint', group: 'keystroke', label: 'Keystroke: paint every page', unit: 'ms', max: 800 },
  { id: 'keystroke.total', group: 'keystroke', label: 'Keystroke: edit to painted pages', unit: 'ms', max: 1500 },

  // The start-up path of a production build: the entry and what it imports statically, plus what
  // index.html preloads. The 1.1 MB and 500 kB caps are the ones 71-startup-chunks holds; the PDF engine
  // and the Word writer are never on it.
  { id: 'startup.raw', group: 'startup', label: 'Start-up path: script', unit: 'kB', max: 1100 },
  { id: 'startup.gzip', group: 'startup', label: 'Start-up path: script, gzipped', unit: 'kB', max: 450 },
  { id: 'startup.largest', group: 'startup', label: 'Start-up path: largest chunk', unit: 'kB', max: 500 },
  { id: 'startup.lazy', group: 'startup', label: 'Start-up path: PDF or Word library modules', unit: 'count', max: 0 },

  // Gate A in a real browser (Chromium against the built ./dist), the large résumé at the editor's
  // default layout. B2: 20 characters into Summary at 150 ms a key, then the last key to the pages that
  // show it (plan: 600 ms on 3 pages; 759 before the WOFF cache). B5/Gate B: the longest task the main
  // thread runs while that happens (the PDF is built in a worker, so the plan expects at most 50 ms).
  { id: 'browser.firstPreview', group: 'browser', label: 'Browser: open the editor to the first pages', unit: 'ms', max: 20000 },
  { id: 'browser.keystrokeToPreview', group: 'browser', label: 'Browser: last key to the pages showing it', unit: 'ms', max: 3000, target: 600 },
  { id: 'browser.longTask', group: 'browser', label: 'Browser: longest main-thread task while typing', unit: 'ms', max: 600, target: 50 },
];
