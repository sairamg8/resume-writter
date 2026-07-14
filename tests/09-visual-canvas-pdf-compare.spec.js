/**
 * Visual QA: live canvas preview vs exported react-pdf for every template.
 *
 * For each template:
 *  1. Open the live editor UI with test resume data
 *  2. Screenshot the first visible A4 canvas page + full #resume-preview
 *  3. Export PDF via the real Export dropdown
 *  4. Rasterize PDF page(s) with pdftoppm
 *  5. Compare metric colors/text from canvas getComputedStyle vs PDF text runs
 *  6. Write a side-by-side HTML report under qa-visual-compare/
 *
 * Run:
 *   npx playwright test tests/09-visual-canvas-pdf-compare.spec.js
 */
import { test, expect } from 'playwright/test';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { gotoEditor } from './helpers.js';
import { extractPdfTextRuns, findRun, cssColorToHex } from './pdf-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../qa-visual-compare');
const TEMPLATES = ['classic', 'modern', 'minimal', 'sidebar', 'executive'];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function exportPdfBuffer(page) {
  const downloadPromise = page.waitForEvent('download', { timeout: 45_000 });
  await page.locator('button:has-text("Export")').first().click();
  await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
  const download = await downloadPromise;
  const tmp = await download.path();
  return {
    buffer: fs.readFileSync(tmp),
    filename: download.suggestedFilename(),
  };
}

function rasterizePdf(pdfPath, outPrefix) {
  // -png, -r 144 (~2x for readability), page 1 only first, then all pages
  execFileSync('pdftoppm', ['-png', '-r', '144', pdfPath, outPrefix], { stdio: 'pipe' });
  const dir = path.dirname(outPrefix);
  const base = path.basename(outPrefix);
  return fs.readdirSync(dir)
    .filter((f) => f.startsWith(base) && f.endsWith('.png'))
    .sort()
    .map((f) => path.join(dir, f));
}

async function canvasMetrics(page) {
  const preview = page.locator('#resume-preview');
  const nameEl = preview.getByText('Alex Johnson', { exact: true }).first();
  const titleEl = preview.getByText('Full Stack Engineer', { exact: true }).first();
  const summaryEl = preview.locator('.rich-text-output').first();

  const nameColor = cssColorToHex(await nameEl.evaluate((el) => getComputedStyle(el).color));
  const titleColor = cssColorToHex(await titleEl.evaluate((el) => getComputedStyle(el).color));
  const nameFontSize = await nameEl.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const titleFontSize = await titleEl.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const bodyLineHeightRatio = await summaryEl.evaluate((el) => {
    const cs = getComputedStyle(el);
    return parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
  });
  const previewText = (await preview.innerText()).replace(/\s+/g, ' ').trim();

  return {
    nameColor,
    titleColor,
    nameFontSize,
    titleFontSize,
    bodyLineHeightRatio,
    previewTextSample: previewText.slice(0, 280),
  };
}

function pdfMetrics(buffer) {
  return extractPdfTextRuns(buffer).then((runs) => {
    const name = findRun(runs, 'Alex Johnson');
    const title = findRun(runs, 'Full Stack Engineer');
    const sample = runs.slice(0, 40).map((r) => r.text).join(' | ');
    return {
      runsCount: runs.length,
      nameFound: !!name,
      titleFound: !!title,
      nameColor: name?.colorHex ?? null,
      titleColor: title?.colorHex ?? null,
      nameFontSize: name?.fontSize ?? null,
      titleFontSize: title?.fontSize ?? null,
      textSample: sample.slice(0, 280),
    };
  });
}

test.describe('Visual canvas vs PDF compare', () => {
  test.setTimeout(180_000);

  test('all templates: screenshot canvas, export PDF, compare metrics', async ({ page }) => {
  ensureDir(OUT_DIR);
  // Clean previous run artifacts (keep directory)
  for (const f of fs.readdirSync(OUT_DIR)) {
    fs.rmSync(path.join(OUT_DIR, f), { recursive: true, force: true });
  }

  const results = [];

  for (const template of TEMPLATES) {
    const tDir = path.join(OUT_DIR, template);
    ensureDir(tDir);

    // Fresh navigation each template (HashRouter + stacked addInitScript quirks)
    await page.goto('about:blank');
    await gotoEditor(page, template);
    // Let fonts + pagination settle
    await page.waitForTimeout(800);
    await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });

    // 1) Full off-screen source canvas (#resume-preview)
    const source = page.locator('#resume-preview');
    await expect(source).toBeAttached();
    await source.screenshot({ path: path.join(tDir, 'canvas-full.png') });

    // 2) First visible A4 page in the live UI (paginated preview)
    const visiblePage = page.locator('div.bg-white.shadow-2xl').first();
    await expect(visiblePage).toBeVisible({ timeout: 10_000 });
    await visiblePage.scrollIntoViewIfNeeded();
    await visiblePage.screenshot({ path: path.join(tDir, 'canvas-page1.png') });

    // Optional: whole editor chrome for context
    await page.screenshot({
      path: path.join(tDir, 'editor-ui.png'),
      fullPage: false,
    });

    const canvas = await canvasMetrics(page);

    // 3) Export real PDF
    const { buffer, filename } = await exportPdfBuffer(page);
    const pdfPath = path.join(tDir, filename.endsWith('.pdf') ? filename : `${template}.pdf`);
    // Normalize name for stable report links
    const stablePdf = path.join(tDir, `${template}.pdf`);
    fs.writeFileSync(stablePdf, buffer);
    if (pdfPath !== stablePdf) fs.writeFileSync(pdfPath, buffer);

    // 4) Rasterize PDF pages
    const pdfPages = rasterizePdf(stablePdf, path.join(tDir, 'pdf-page'));
    // Rename first page for stable report path
    if (pdfPages[0]) {
      const page1 = path.join(tDir, 'pdf-page1.png');
      fs.copyFileSync(pdfPages[0], page1);
    }

    // 5) Metric compare
    const pdf = await pdfMetrics(buffer);
    const comparisons = {
      nameColorMatch: canvas.nameColor === pdf.nameColor,
      titleColorMatch: canvas.titleColor === pdf.titleColor,
      namePresentInPdf: pdf.nameFound,
      titlePresentInPdf: pdf.titleFound,
      // Font sizes: canvas is CSS px; PDF is points. On 96dpi screens 1pt ≈ 1.333px
      // so we only log both — exact equality is not expected.
      nameFontSizeCanvasPx: canvas.nameFontSize,
      nameFontSizePdfPt: pdf.nameFontSize,
      titleFontSizeCanvasPx: canvas.titleFontSize,
      titleFontSizePdfPt: pdf.titleFontSize,
    };

    results.push({
      template,
      canvas,
      pdf,
      comparisons,
      artifacts: {
        canvasFull: `${template}/canvas-full.png`,
        canvasPage1: `${template}/canvas-page1.png`,
        pdfPage1: `${template}/pdf-page1.png`,
        pdf: `${template}/${template}.pdf`,
        editorUi: `${template}/editor-ui.png`,
        pdfPageCount: pdfPages.length,
      },
    });

    // Soft assertions so we still produce the full report
    expect(pdf.nameFound, `${template}: PDF should contain name`).toBeTruthy();
    expect(pdf.titleFound, `${template}: PDF should contain title`).toBeTruthy();
    expect(comparisons.nameColorMatch, `${template}: name color canvas=${canvas.nameColor} pdf=${pdf.nameColor}`).toBe(true);
    expect(comparisons.titleColorMatch, `${template}: title color canvas=${canvas.titleColor} pdf=${pdf.titleColor}`).toBe(true);
  }

  // 6) HTML side-by-side report
  const reportPath = path.join(OUT_DIR, 'index.html');
  const rows = results.map((r) => {
    const ok = r.comparisons.nameColorMatch && r.comparisons.titleColorMatch
      && r.comparisons.namePresentInPdf && r.comparisons.titlePresentInPdf;
    const badge = ok
      ? '<span style="background:#16a34a;color:#fff;padding:2px 8px;border-radius:999px;font-size:12px">PASS</span>'
      : '<span style="background:#dc2626;color:#fff;padding:2px 8px;border-radius:999px;font-size:12px">CHECK</span>';
    return `
      <section style="margin:32px 0;padding:20px;border:1px solid #e5e7eb;border-radius:12px;background:#fff">
        <h2 style="margin:0 0 8px;display:flex;align-items:center;gap:12px;text-transform:capitalize">
          ${r.template} ${badge}
        </h2>
        <table style="font-size:13px;border-collapse:collapse;margin-bottom:16px">
          <tr><th align="left" style="padding:4px 12px 4px 0">Metric</th><th align="left">Canvas</th><th align="left">PDF</th><th align="left">Match</th></tr>
          <tr><td style="padding:4px 12px 4px 0">Name color</td><td><code>${r.canvas.nameColor}</code></td><td><code>${r.pdf.nameColor}</code></td><td>${r.comparisons.nameColorMatch ? '✓' : '✗'}</td></tr>
          <tr><td style="padding:4px 12px 4px 0">Title color</td><td><code>${r.canvas.titleColor}</code></td><td><code>${r.pdf.titleColor}</code></td><td>${r.comparisons.titleColorMatch ? '✓' : '✗'}</td></tr>
          <tr><td style="padding:4px 12px 4px 0">Name font size</td><td>${r.canvas.nameFontSize.toFixed(1)}px</td><td>${r.pdf.nameFontSize?.toFixed?.(1) ?? r.pdf.nameFontSize}pt</td><td>—</td></tr>
          <tr><td style="padding:4px 12px 4px 0">Title font size</td><td>${r.canvas.titleFontSize.toFixed(1)}px</td><td>${r.pdf.titleFontSize?.toFixed?.(1) ?? r.pdf.titleFontSize}pt</td><td>—</td></tr>
          <tr><td style="padding:4px 12px 4px 0">Body LH ratio</td><td>${r.canvas.bodyLineHeightRatio.toFixed(2)}</td><td>(see fidelity suite)</td><td>—</td></tr>
          <tr><td style="padding:4px 12px 4px 0">PDF pages</td><td colspan="3">${r.artifacts.pdfPageCount}</td></tr>
          <tr><td style="padding:4px 12px 4px 0">PDF file</td><td colspan="3"><a href="${r.artifacts.pdf}">${r.artifacts.pdf}</a></td></tr>
        </table>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start">
          <figure style="margin:0">
            <figcaption style="font-weight:600;margin-bottom:8px">Canvas (visible page 1)</figcaption>
            <img src="${r.artifacts.canvasPage1}" alt="canvas ${r.template}" style="width:100%;border:1px solid #d1d5db;border-radius:8px;background:#f3f4f6"/>
          </figure>
          <figure style="margin:0">
            <figcaption style="font-weight:600;margin-bottom:8px">Exported PDF (page 1 @ 144dpi)</figcaption>
            <img src="${r.artifacts.pdfPage1}" alt="pdf ${r.template}" style="width:100%;border:1px solid #d1d5db;border-radius:8px;background:#f3f4f6"/>
          </figure>
        </div>
        <details style="margin-top:12px">
          <summary>Full continuous canvas + editor chrome</summary>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">
            <img src="${r.artifacts.canvasFull}" style="width:100%;border:1px solid #ddd"/>
            <img src="${r.artifacts.editorUi}" style="width:100%;border:1px solid #ddd"/>
          </div>
        </details>
      </section>`;
  }).join('\n');

  const passed = results.filter((r) =>
    r.comparisons.nameColorMatch && r.comparisons.titleColorMatch
    && r.comparisons.namePresentInPdf && r.comparisons.titlePresentInPdf
  ).length;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Canvas vs PDF visual compare — CPWT-CV</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 24px; background: #f8fafc; color: #111827; }
    h1 { margin-bottom: 4px; }
    .meta { color: #6b7280; margin-bottom: 24px; }
    code { background: #f3f4f6; padding: 1px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Canvas UI vs Export PDF</h1>
  <p class="meta">Generated ${new Date().toISOString()} · ${passed}/${results.length} templates metric-pass · live Playwright + pdftoppm</p>
  ${rows}
  <script type="application/json" id="results">${JSON.stringify(results, null, 2)}</script>
</body>
</html>`;
  fs.writeFileSync(reportPath, html);
  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(results, null, 2));

  console.log(`\nVisual compare report: ${reportPath}`);
  console.log(`Metric pass: ${passed}/${results.length}`);
  });
});
