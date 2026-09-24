import { test, expect } from '@playwright/test';
import { visitEditor, exportPdf, findRun, openDesignPanel } from './pw-helpers.js';

/**
 * The tallest column of the preview's first page painted in the Timeline rail's colour, px: the accent
 * #2563eb at 35 % on white (timelineRail.js), rgb(179, 200, 248). The rail is a vertical line, so one
 * column holds many such pixels; a heading rule or a tag in a similar tint is horizontal and holds few.
 * The preview is the PDF drawn by pdf.js onto a canvas, so the rail shows there exactly when the PDF draws it.
 */
async function railPixels(page) {
  const canvas = page.locator('[data-preview-status="ready"] canvas').first();
  await expect(canvas).toBeVisible();
  return canvas.evaluate((c) => {
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    const columns = new Array(c.width).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - 179) <= 6 && Math.abs(data[i + 1] - 200) <= 6 && Math.abs(data[i + 2] - 248) <= 6) columns[(i / 4) % c.width] += 1;
    }
    return Math.max(...columns);
  });
}

/**
 * The share of the preview's first page painted in the Banner band's colour along its top edge: the
 * accent #2563eb, rgb(37, 99, 235), on the canvas's third pixel row. The band runs from the paper's
 * edges, so nearly the whole row is the accent; on a white-page template it is white.
 */
async function topRowAccent(page) {
  const canvas = page.locator('[data-preview-status="ready"] canvas').first();
  await expect(canvas).toBeVisible();
  return canvas.evaluate((c) => {
    const { data } = c.getContext('2d').getImageData(0, 2, c.width, 1);
    let hits = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - 37) <= 8 && Math.abs(data[i + 1] - 99) <= 8 && Math.abs(data[i + 2] - 235) <= 8) hits += 1;
    }
    return hits / c.width;
  });
}

/**
 * How many pixel rows of the preview's first page are mostly a blue-tinted line: Academic's hairlines under
 * its section titles — the accent #2563eb at 55 % on white, rgb(135, 169, 244) — drawn by pdf.js onto the
 * canvas. A row counts when 60 % of it is bluer than it is red by 40 or more (a hairline 1.3 px tall
 * covers at least half of one row: still that blue); Classic's grey #e5e7eb rules and white rows do not.
 */
async function hairlineRows(page) {
  const canvas = page.locator('[data-preview-status="ready"] canvas').first();
  await expect(canvas).toBeVisible();
  return canvas.evaluate((c) => {
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    let rows = 0;
    for (let y = 0; y < c.height; y += 1) {
      let blue = 0;
      for (let x = 0; x < c.width; x += 1) {
        const i = (y * c.width + x) * 4;
        if (data[i + 2] - data[i] >= 40 && data[i] < 235) blue += 1;
      }
      if (blue > c.width * 0.6) rows += 1;
    }
    return rows;
  });
}

/** The exported PDF's Experience entry: its date run ("01/2023 – ", the first) sits above its role (PDF y grows upward), both starting at one x. */
function expectDateAboveTitle(runs) {
  const date = findRun(runs, '01/2023');
  const role = findRun(runs, 'Senior Dev');
  expect(date).toBeDefined();
  expect(role).toBeDefined();
  expect(date.y).toBeGreaterThan(role.y + 5);
  expect(Math.abs(date.x - role.x)).toBeLessThan(0.5);
  expect(date.colorHex).toBe('#2563eb');
}

test.describe('Exported PDF — every template', () => {

  test('Classic template: exports all sections, header, and entries into PDF', async ({ page }) => {
    await visitEditor(page, 'classic');

    const { runs, text } = await exportPdf(page);
    expect(runs.length).toBeGreaterThan(10);
    expect(text).toContain('Alex Johnson');
    expect(text).toContain('Full Stack Engineer');
    expect(text).toContain('Acme Corp');
    expect(text).toContain('Senior Dev');
    expect(text).toContain('MIT');
    expect(text).toContain('React, TypeScript, CSS');

    const nameRun = findRun(runs, 'Alex Johnson');
    expect(nameRun).toBeDefined();
    expect(nameRun.fontSize).toBeGreaterThan(16);
  });

  test('Modern template: exports banner layout with distinct header styling', async ({ page }) => {
    await visitEditor(page, 'modern');

    const { runs, text } = await exportPdf(page);
    expect(runs.length).toBeGreaterThan(10);
    expect(text).toContain('Alex Johnson');
    expect(text).toContain('Full Stack Engineer');
    expect(text).toContain('Acme Corp');

    // In modern template, name has headerTextColor (default white #ffffff)
    const nameRun = findRun(runs, 'Alex Johnson');
    expect(nameRun).toBeDefined();
    expect(nameRun.colorHex).toBe('#ffffff');
  });

  test('Minimal template: exports clean compact layout with accent elements', async ({ page }) => {
    await visitEditor(page, 'minimal');

    const { runs, text } = await exportPdf(page);
    expect(runs.length).toBeGreaterThan(10);
    expect(text).toContain('Alex Johnson');
    expect(text.toUpperCase()).toContain('PROFESSIONAL EXPERIENCE');
    expect(text).toContain('Built amazing products');
  });

  test('Executive template: exports centered executive layout and typography', async ({ page }) => {
    await visitEditor(page, 'executive');

    const { runs, text } = await exportPdf(page);
    expect(runs.length).toBeGreaterThan(10);
    expect(text).toContain('Alex Johnson');
    expect(text).toContain('Full Stack Engineer');
    expect(text).toContain('Education');
  });

  test('Sidebar template: exports two-column layout with sidebar contact labels', async ({ page }) => {
    await visitEditor(page, 'sidebar');

    const { runs, text } = await exportPdf(page);
    expect(runs.length).toBeGreaterThan(10);
    expect(text).toContain('Alex Johnson');

    // Sidebar template uniquely renders uppercase contact labels (CONTACT, EMAIL, PHONE, etc.)
    const upperText = text.toUpperCase();
    expect(upperText).toContain('CONTACT');
    expect(upperText).toContain('EMAIL');
  });

  test('Timeline template: the preview draws the rail, and the export sets each date above its title', async ({ page }) => {
    await visitEditor(page, 'timeline');
    expect(await railPixels(page)).toBeGreaterThan(120);

    const { runs, text } = await exportPdf(page);
    expect(text).toContain('Alex Johnson');
    expect(text).toContain('Acme Corp');
    expect(text).toContain('MIT');
    expect(text).toContain('My App');
    expect(text).toContain('Red Cross');
    expectDateAboveTitle(runs);
  });

  test('Timeline is offered in the Design panel; picking it redraws the preview and the export', async ({ page }) => {
    await visitEditor(page, 'classic');
    // Measured: Classic's tallest such column 12 px (a tag's edge), Timeline's rail 268 px.
    expect(await railPixels(page)).toBeLessThan(40);

    await openDesignPanel(page);
    await page.locator('button:has-text("Timeline")').first().click();
    await expect.poll(() => railPixels(page), { timeout: 20_000 }).toBeGreaterThan(120);

    const { runs } = await exportPdf(page);
    expectDateAboveTitle(runs);
  });

  test('Banner template: the preview paints the band edge to edge; the export reverses the header and the chips\' titles out of it', async ({ page }) => {
    await visitEditor(page, 'banner');
    expect(await topRowAccent(page)).toBeGreaterThan(0.95);

    const { runs, text } = await exportPdf(page);
    expect(text).toContain('Alex Johnson');
    expect(text).toContain('Acme Corp');
    expect(text).toContain('MIT');
    expect(findRun(runs, 'Alex Johnson').colorHex).toBe('#ffffff');
    expect(findRun(runs, 'alex@example.com').colorHex).toBe('#ffffff');
    // Boxed on Banner: a filled chip, the title reversed out of it; the entries on the white page.
    expect(findRun(runs, 'PROFESSIONAL').colorHex).toBe('#ffffff');
    expect(findRun(runs, 'Acme Corp').colorHex).not.toBe('#ffffff');
  });

  test('Banner is offered in the Design panel; picking it paints the band in the preview and the export', async ({ page }) => {
    await visitEditor(page, 'classic');
    expect(await topRowAccent(page)).toBeLessThan(0.05);

    await openDesignPanel(page);
    await page.locator('button:has-text("Banner")').first().click();
    await expect.poll(() => topRowAccent(page), { timeout: 20_000 }).toBeGreaterThan(0.95);

    const { runs } = await exportPdf(page);
    expect(findRun(runs, 'Alex Johnson').colorHex).toBe('#ffffff');
    expect(findRun(runs, 'PROFESSIONAL').colorHex).toBe('#ffffff');
  });

  test('Academic template: the preview draws a hairline under each section title; the export centres the name, dates in the Text grey', async ({ page }) => {
    await visitEditor(page, 'academic');
    expect(await hairlineRows(page)).toBeGreaterThan(2);

    const { runs, text } = await exportPdf(page);
    expect(text).toContain('Alex Johnson');
    expect(text).toContain('Acme Corp');
    expect(text).toContain('MIT');
    // Centred where Classic's name sits on the 18 mm margin (51 pt).
    expect(findRun(runs, 'Alex Johnson').x).toBeGreaterThan(150);
    // Section titles in the accent; an entry's dates in the Text colour's grey (#111111 at 72 %).
    expect(findRun(runs, 'PROFESSIONAL').colorHex).toBe('#2563eb');
    expect(findRun(runs, '01/2023').colorHex).toBe('#545454');
  });

  test('Academic is offered in the Design panel; picking it redraws the preview and the export', async ({ page }) => {
    await visitEditor(page, 'classic');
    expect(await hairlineRows(page)).toBe(0);

    await openDesignPanel(page);
    await page.locator('button:has-text("Academic")').first().click();
    await expect.poll(() => hairlineRows(page), { timeout: 20_000 }).toBeGreaterThan(2);
    await expect(page.locator('text=Academic brings its own type and spacing')).toBeVisible();

    const { runs } = await exportPdf(page);
    expect(findRun(runs, 'Alex Johnson').x).toBeGreaterThan(150);
  });

});
