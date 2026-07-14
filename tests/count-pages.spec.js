import { test, expect } from 'playwright/test';
import fs from 'fs';

const TEMPLATES = ['classic', 'modern', 'minimal', 'executive', 'sidebar'];

async function openTemplate(page, templateName) {
  await page.goto('/#/');
  await page.waitForSelector('.group.bg-white.rounded-2xl', { timeout: 20_000 });
  // Seeded dashboard names: Classic, Modern, Minimal, Executive, Sidebar (and Dark)
  const label = templateName.charAt(0).toUpperCase() + templateName.slice(1);
  const card = page.locator(`.group.bg-white.rounded-2xl:has-text("${label}")`).first();
  await card.locator('button:has-text("Edit")').click();
  await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });
  await page.waitForTimeout(1200);
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
  await page.waitForTimeout(400);
}

async function countCanvasPages(page) {
  const labels = await page.locator('span').evaluateAll((els) =>
    els.map((e) => e.textContent || '').filter((t) => /Page \d+ of \d+/.test(t))
  );
  if (labels.length) {
    const m = labels[0].match(/of\s+(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return page.locator('div.bg-white.shadow-2xl').count();
}

async function exportPdfPageCount(page) {
  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
  await page.locator('button:has-text("Export")').first().click();
  await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
  const download = await downloadPromise;
  const buf = fs.readFileSync(await download.path());
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
  return doc.numPages;
}

test.describe('Canvas vs PDF page count (seeded resumes)', () => {
  test.setTimeout(180_000);

  for (const template of TEMPLATES) {
    test(`${template}: PDF page count matches canvas`, async ({ page }) => {
      await openTemplate(page, template);
      const canvasPages = await countCanvasPages(page);
      const pdfPages = await exportPdfPageCount(page);
      console.log(`${template}: canvas=${canvasPages} pdf=${pdfPages}`);
      expect(pdfPages, `${template}: PDF should match canvas page count`).toBe(canvasPages);
    });
  }
});
