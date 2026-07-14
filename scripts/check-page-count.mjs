/**
 * Quick canvas vs PDF page-count check for the seeded Classic resume.
 * Usage: node scripts/check-page-count.mjs
 * Assumes dev server at http://localhost:5173
 */
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.BASE_URL || 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(30_000);

  await page.goto(`${BASE}/#/`);
  await page.waitForSelector('.group.bg-white.rounded-2xl');
  const card = page.locator('.group.bg-white.rounded-2xl:has-text("Classic")').first();
  await card.locator('button:has-text("Edit")').click();
  await page.waitForSelector('button:has-text("Export")');
  await page.waitForTimeout(1500);
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });

  const labels = await page.locator('span').evaluateAll((els) =>
    els.map((e) => e.textContent || '').filter((t) => /Page \d+ of \d+/.test(t))
  );
  let canvasPages = await page.locator('div.bg-white.shadow-2xl').count();
  if (labels[0]) {
    const m = labels[0].match(/of\s+(\d+)/);
    if (m) canvasPages = parseInt(m[1], 10);
  }

  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
  await page.locator('button:has-text("Export")').first().click();
  await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
  const download = await downloadPromise;
  const buf = fs.readFileSync(await download.path());
  fs.writeFileSync('/tmp/page-count-check.pdf', buf);

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
  const pdfPages = doc.numPages;

  console.log(JSON.stringify({ canvasPages, pdfPages, match: canvasPages === pdfPages }, null, 2));
  await browser.close();
  process.exit(canvasPages === pdfPages ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
