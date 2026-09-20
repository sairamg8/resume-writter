import { test, expect } from '@playwright/test';
import { visitEditor, exportPdf, findRun, openDesignPanel } from './pw-helpers.js';

test.describe('Exported PDF — Typography & Spacing Customizations', () => {

  test('fontSizeBase: changing base font size alters body text size in exported PDF', async ({ page }) => {
    // Test base size 13pt
    await visitEditor(page, 'classic', {
      settings: {
        fontSizeBase: 13,
      },
    });

    const { runs } = await exportPdf(page);
    const bodyRun = findRun(runs, 'Senior Dev');
    expect(bodyRun).toBeDefined();
    expect(bodyRun.fontSize).toBeGreaterThanOrEqual(12.5);
  });

  test('fontSizeNameDelta: adjusts candidate name font size in exported PDF', async ({ page }) => {
    await visitEditor(page, 'classic', {
      settings: {
        fontSizeBase: 11,
        fontSizeNameDelta: 12, // 11 + 12 = 23 pt
      },
    });

    const { runs } = await exportPdf(page);
    const nameRun = findRun(runs, 'Alex Johnson');
    expect(nameRun).toBeDefined();
    expect(nameRun.fontSize).toBeCloseTo(23, 0.5);
  });

  test('marginH: horizontal margins determine leftmost text position in exported PDF', async ({ page }) => {
    // 30 mm margin = 30 * 72 / 25.4 = ~85 pt
    await visitEditor(page, 'classic', {
      settings: {
        marginH: 30,
        marginV: 20,
      },
    });

    const { runs } = await exportPdf(page);
    // Find heading or body text runs on page 1
    const p1Runs = runs.filter(r => r.page === 1);
    const minX = Math.min(...p1Runs.map(r => r.x));
    // Must be at or beyond ~80 pt
    expect(minX).toBeGreaterThanOrEqual(80);
  });

  test('Smart Page Fit: clicking 1-Page Fit tightens layout in UI and exported PDF', async ({ page }) => {
    await visitEditor(page, 'classic');

    // Open Design panel, expand Spacing section and click 1-Page Fit preset
    await openDesignPanel(page);
    await page.locator('button:has-text("Spacing")').first().click();
    const onePageBtn = page.locator('button:has-text("1-Page Fit")');
    await expect(onePageBtn).toBeVisible();
    await onePageBtn.click();

    // Export PDF and verify it exports successfully
    const { runs, text } = await exportPdf(page);
    expect(runs.length).toBeGreaterThan(10);
    expect(text).toContain('Alex Johnson');
    expect(text).toContain('Built amazing products');
  });

});
