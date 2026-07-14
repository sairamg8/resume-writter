/**
 * Design fidelity between the Canvas preview and the exported react-pdf PDF.
 *
 * When a user customizes global design settings (accent/name/job-title colors,
 * the Line Height slider, heading style), the live canvas preview and the
 * "Export PDF" (react-pdf) output must render the same colors and the same
 * line-height behavior. This suite injects distinctive design settings, reads
 * getComputedStyle() off the live canvas preview, then triggers a real PDF
 * export, parses the actual downloaded PDF bytes with pdfjs-dist, and compares
 * the two. This does NOT cover "Export PDF (Legacy)", which is a separate
 * export path.
 */
import { test, expect } from 'playwright/test';
import fs from 'fs';
import { gotoEditor, buildTestState, injectTestState } from './helpers.js';
import { extractPdfTextRuns, findRun, cssColorToHex, paragraphLineHeightRatio } from './pdf-utils.js';

const LONG_SUMMARY = '<p>An experienced full stack engineer with eight or more years building scalable web applications used by millions of people across many different industries and countries around the world every single day.</p>';

const DISTINCTIVE_DESIGN = {
  accentColor: '#7c3aed',
  nameColor: '#ff0055',
  jobTitleColor: '#00aa66',
  textColor: '#111111',
  lineHeightValue: 2.2,
  headingStyle: 'ruled',
  sectionTitleCase: 'upper',
};

/**
 * Navigate to the editor with a custom design AND a long (wrapping) summary.
 * Uses a unique resume id per call so repeated calls within one test (e.g. comparing
 * two lineHeightValue settings) always force a real navigation — HashRouter treats
 * page.goto() to the SAME hash URL as a no-op, which would silently keep rendering
 * the previous state instead of picking up the new localStorage injection.
 */
let uniqueIdCounter = 0;
async function gotoEditorWithLongSummary(page, template, settingsOverride) {
  const state = buildTestState(template, settingsOverride);
  state.resumes[0].id = `${state.resumes[0].id}_${++uniqueIdCounter}`;
  state.activeId = state.resumes[0].id;
  state.resumes[0].personal = { ...state.resumes[0].personal, summary: LONG_SUMMARY };
  await injectTestState(page, state);
  // HashRouter: navigating between two #/resume/xxx URLs is a hash-only change, which
  // Chromium/Playwright treat as NOT a real navigation — addInitScript (and thus the
  // localStorage write above) wouldn't re-run. Bounce through about:blank so the next
  // goto is always a genuine full page load.
  await page.goto('about:blank');
  await page.goto(`/#/resume/${state.resumes[0].id}`);
  await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });
  return state;
}

async function exportPdfBuffer(page) {
  const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
  await page.locator('button:has-text("Export")').first().click();
  await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  return fs.readFileSync(path);
}

async function computedColorHex(locator) {
  const css = await locator.evaluate(el => getComputedStyle(el).color);
  return cssColorToHex(css);
}

async function computedLineHeightRatio(locator) {
  return locator.evaluate(el => {
    const cs = getComputedStyle(el);
    return parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
  });
}

const templates = ['classic', 'modern', 'minimal', 'sidebar', 'executive'];

test.describe('Canvas vs exported react-pdf — design fidelity', () => {
  for (const template of templates) {
    test(`${template}: title/subtitle/heading colors and body line-height match the exported PDF`, async ({ page }) => {
      await gotoEditorWithLongSummary(page, template, DISTINCTIVE_DESIGN);

      const preview = page.locator('#resume-preview');
      const nameEl = preview.getByText('Alex Johnson', { exact: true }).first();
      const titleEl = preview.getByText('Full Stack Engineer', { exact: true }).first();
      const summaryEl = preview.locator('.rich-text-output', { hasText: 'full stack engineer with eight' }).first();

      const canvasNameColor = await computedColorHex(nameEl);
      const canvasTitleColor = await computedColorHex(titleEl);
      const canvasBodyRatio = await computedLineHeightRatio(summaryEl);

      const buffer = await exportPdfBuffer(page);
      const runs = await extractPdfTextRuns(buffer);

      const pdfName = findRun(runs, 'Alex Johnson');
      const pdfTitle = findRun(runs, 'Full Stack Engineer');
      expect(pdfName, 'PDF should contain the name text').toBeTruthy();
      expect(pdfTitle, 'PDF should contain the job title text').toBeTruthy();

      expect(pdfName.colorHex, 'name color: canvas vs PDF').toBe(canvasNameColor);
      expect(pdfTitle.colorHex, 'job title color: canvas vs PDF').toBe(canvasTitleColor);
      expect(canvasNameColor).toBe(DISTINCTIVE_DESIGN.nameColor);
      expect(canvasTitleColor).toBe(DISTINCTIVE_DESIGN.jobTitleColor);

      // Body line-height: canvas ratio should reflect the configured slider value,
      // and the real exported PDF's wrapped paragraph should show the same ratio.
      expect(canvasBodyRatio, 'canvas body line-height should follow the Line Height slider')
        .toBeGreaterThan(DISTINCTIVE_DESIGN.lineHeightValue - 0.15);
      const pdfBodyRatio = paragraphLineHeightRatio(runs, 'experienced full stack');
      expect(pdfBodyRatio, 'PDF paragraph should wrap to multiple lines for a ratio to be measurable').toBeTruthy();
      expect(pdfBodyRatio, 'body line-height ratio: canvas vs PDF').toBeCloseTo(canvasBodyRatio, 0.5);
    });
  }

  test('classic: section heading color matches (ruled style forces neutral gray, not accent)', async ({ page }) => {
    await gotoEditorWithLongSummary(page, 'classic', DISTINCTIVE_DESIGN);
    const heading = page.locator('#resume-preview').getByText('Professional Experience', { exact: true }).first();
    const canvasHeadingColor = await computedColorHex(heading);

    const buffer = await exportPdfBuffer(page);
    const runs = await extractPdfTextRuns(buffer);
    const pdfHeading = findRun(runs, 'EXPERIENCE');
    expect(pdfHeading, 'PDF should contain the uppercased section heading').toBeTruthy();

    expect(pdfHeading.colorHex, 'section heading color: canvas vs PDF').toBe(canvasHeadingColor);
    // 'ruled' heading style forces neutral gray (#374151), not the accent color.
    expect(canvasHeadingColor).toBe('#374151');
  });

  test('sidebar: section heading color forks the same way in canvas and PDF for "ruled" style', async ({ page }) => {
    await gotoEditorWithLongSummary(page, 'sidebar', DISTINCTIVE_DESIGN);
    const heading = page.locator('#resume-preview').getByText('Professional Experience', { exact: true }).first();
    const canvasHeadingColor = await computedColorHex(heading);

    const buffer = await exportPdfBuffer(page);
    const runs = await extractPdfTextRuns(buffer);
    const pdfHeading = findRun(runs, 'EXPERIENCE');
    expect(pdfHeading, 'PDF should contain the uppercased section heading').toBeTruthy();

    expect(pdfHeading.colorHex, 'sidebar section heading color: canvas vs PDF').toBe(canvasHeadingColor);
    expect(canvasHeadingColor).toBe('#374151');
  });

  test('classic: section-heading spacing in the exported PDF actually responds to the Line Height slider', async ({ page }) => {
    // Regression test for a real bug: PdfSectionTitle used to hardcode lineHeight: 1.2,
    // so the exported PDF's section-heading spacing never changed no matter what the
    // user set the Line Height slider to. This asserts the gap now scales with it.
    // Uses "Acme Corp" (the item's primary title) as the marker below the heading —
    // that Text has no lineHeight style of its own, so any gap change is attributable
    // to the HEADING's line-height, not to some other line-height-aware element below it.
    async function headingToItemTitleGap(lineHeightValue) {
      await gotoEditorWithLongSummary(page, 'classic', { ...DISTINCTIVE_DESIGN, lineHeightValue });
      const buffer = await exportPdfBuffer(page);
      const runs = await extractPdfTextRuns(buffer);
      const heading = findRun(runs, 'EXPERIENCE');
      const itemTitle = findRun(runs, 'Acme Corp');
      expect(heading, 'heading text found in PDF').toBeTruthy();
      expect(itemTitle, 'item title text found in PDF').toBeTruthy();
      return heading.y - itemTitle.y; // PDF y grows upward, heading sits above the item title
    }

    const tightGap = await headingToItemTitleGap(1.0);
    const relaxedGap = await headingToItemTitleGap(3.0);
    expect(relaxedGap, 'heading spacing should grow when Line Height increases').toBeGreaterThan(tightGap + 2);
  });
});
