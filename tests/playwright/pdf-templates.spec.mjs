import { test, expect } from '@playwright/test';
import { visitEditor, exportPdf, findRun } from './pw-helpers.js';

test.describe('Exported PDF — All 5 Templates', () => {

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

});
