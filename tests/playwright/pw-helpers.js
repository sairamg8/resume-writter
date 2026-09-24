import fs from 'node:fs';
import { buildTestState, STORAGE_KEY } from '../helpers.js';
import { extractPdfTextRuns, findRun, findRuns } from '../pdf-utils.js';

/**
 * Seeds resume state and visits editor in Playwright.
 */
export async function visitEditor(page, template = 'classic', opts = {}) {
  const { settings = {}, sections = null, tab = null, personal = null, coverLetter = null } = opts;
  const state = buildTestState(template, settings, sections);
  if (personal) state.resumes[0].personal = { ...state.resumes[0].personal, ...personal };
  if (coverLetter) state.resumes[0].coverLetter = { ...state.resumes[0].coverLetter, ...coverLetter };
  const q = tab ? `?tab=${tab}` : '';

  await page.goto('about:blank');
  await page.addInitScript((args) => {
    localStorage.clear();
    localStorage.setItem(args.key, JSON.stringify(args.state));
  }, { key: STORAGE_KEY, state });

  await page.goto(`/#/resume/${state.activeId}${q}`);
  await page.waitForSelector('button:has-text("Export")', { timeout: 20_000 });
  await page.waitForSelector('[data-preview-status="ready"]', { timeout: 30_000 });
  return state;
}

/** The Cover Letter tab's PDF item: there the Export menu says it exports the letter (R2-131). */
export const LETTER_PDF = 'Export Cover Letter PDF';

/**
 * Clicks Export -> `label` (the résumé tab's "Export PDF", or LETTER_PDF on the Cover Letter tab) in
 * the real browser, waits for the downloaded PDF file, reads its buffer, and extracts all rendered
 * text runs and properties.
 */
export async function exportPdf(page, label = 'Export PDF') {
  await page.waitForSelector('[data-preview-status="ready"]', { timeout: 30_000 });

  const exportBtn = page.locator('button:has-text("Export")').first();
  await exportBtn.click();

  const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
  const exportPdfBtn = page.getByRole('button', { name: label, exact: true });
  await exportPdfBtn.click();

  const download = await downloadPromise;
  const path = await download.path();
  const buffer = fs.readFileSync(path);
  const runs = await extractPdfTextRuns(buffer);
  const text = runs.map(r => r.str).join(' ');

  return { runs, buffer, text, path };
}

/**
 * Opens Design & Customize panel in the editor.
 */
export async function openDesignPanel(page) {
  const designBtn = page.locator('button[title="Design & Customize"]');
  await designBtn.click();
  await page.waitForSelector('text=Template', { timeout: 10_000 });
}

export { findRun, findRuns };
