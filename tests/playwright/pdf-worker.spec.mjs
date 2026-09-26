// The PDF is built in a Web Worker (R2-142, PERF-6): opening the editor, painting the preview and
// Export PDF must leave the page's own thread without the PDF engine — react-pdf and the templates are
// loaded by the worker (src/utils/pdfWorker.js), never by the page, so the editor keeps answering
// while a PDF is laid out. The preview is still the download (parity-preview-download.spec.mjs).
import { test, expect } from '@playwright/test';
import { visitEditor, exportPdf } from './pw-helpers.js';

/** The scripts the page itself fetched (a worker's own fetches are not in the page's timeline). */
const pageScripts = (page) => page.evaluate(() => performance.getEntriesByType('resource')
  .map((e) => new URL(e.name).pathname.split('/').pop()).filter((n) => /\.m?js$/.test(n)));

test('the preview and Export PDF are built in the PDF worker, not on the page', async ({ page }) => {
  await visitEditor(page, 'modern');
  await page.waitForSelector('[data-preview-status="ready"] canvas', { timeout: 30_000 });
  const { text } = await exportPdf(page);
  expect(text.toLowerCase()).toContain('experience');
  const scripts = await pageScripts(page);
  expect(scripts.some((n) => n.startsWith('pdfWorker-')), `the PDF worker was started (${scripts.join(', ')})`).toBe(true);
  expect(scripts.filter((n) => /^(react-pdf|pdfExportReactPDF|ModernTemplatePDF)-/.test(n)), 'the page loaded no PDF engine').toEqual([]);
});
