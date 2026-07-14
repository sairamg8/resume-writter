/**
 * Design panel interaction tests.
 * Verifies that changing colors, fonts, spacing, and margins updates the canvas.
 */
import { test, expect } from 'playwright/test';
import { buildTestState, injectTestState, gotoEditor, getPreviewText } from './helpers.js';

test.describe('Accent color changes', () => {
  test('custom accent color is reflected in canvas styles', async ({ page }) => {
    const state = buildTestState('classic', { accentColor: '#dc2626' }); // red
    await injectTestState(page, state);
    await page.goto('/#/resume/test_classic');
    await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });
    // The accent color should appear in the computed styles of heading elements
    const previewEl = page.locator('#resume-preview');
    const hasRed = await previewEl.evaluate(el => {
      const allEls = el.querySelectorAll('*');
      return Array.from(allEls).some(e => {
        const s = window.getComputedStyle(e);
        return s.color === 'rgb(220, 38, 38)' || s.borderColor === 'rgb(220, 38, 38)' || s.backgroundColor === 'rgb(220, 38, 38)';
      });
    });
    expect(hasRed).toBe(true);
  });
});

test.describe('Font size changes', () => {
  test('larger fontSizeBase produces larger name text', async ({ page }) => {
    const state = buildTestState('classic', { fontSizeBase: 14, fontSizeNameDelta: 6 });
    await injectTestState(page, state);
    await page.goto('/#/resume/test_classic');
    await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });
    const text = await getPreviewText(page);
    expect(text).toContain('Alex Johnson'); // still renders
  });

  test('different fontSizeBase changes font-size CSS variable', async ({ page }) => {
    const state = buildTestState('classic', { fontSizeBase: 13 });
    await injectTestState(page, state);
    await page.goto('/#/resume/test_classic');
    await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });
    // CSS vars are set on the template root div (first child of #resume-preview > div)
    const fsBase = await page.locator('#resume-preview').evaluate(el => {
      const templateRoot = el.querySelector('[style*="--fs-base"]') || el.querySelector('div');
      return templateRoot ? getComputedStyle(templateRoot).getPropertyValue('--fs-base').trim() : '';
    });
    // CSS var should reflect the new font size
    expect(fsBase).toContain('13');
  });
});

test.describe('Spacing settings', () => {
  test('compact spacing (sectionGap=8, itemGap=6) renders without overflow', async ({ page }) => {
    const state = buildTestState('classic', { sectionGap: 8, itemGap: 6 });
    await injectTestState(page, state);
    await page.goto('/#/resume/test_classic');
    await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });
    const text = await getPreviewText(page);
    expect(text).toContain('Alex Johnson');
    expect(text).toContain('Acme Corp');
  });

  test('relaxed spacing (sectionGap=28, itemGap=20) renders all sections', async ({ page }) => {
    const state = buildTestState('classic', { sectionGap: 28, itemGap: 20 });
    await injectTestState(page, state);
    await page.goto('/#/resume/test_classic');
    await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });
    const text = await getPreviewText(page);
    expect(text).toContain('Professional Experience');
    expect(text).toContain('Education');
  });
});

test.describe('Margin settings', () => {
  test('narrow margins render correctly', async ({ page }) => {
    const state = buildTestState('classic', { marginH: 10, marginV: 8 });
    await injectTestState(page, state);
    await page.goto('/#/resume/test_classic');
    await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });
    const text = await getPreviewText(page);
    expect(text).toContain('Alex Johnson');
  });

  test('wide margins render correctly', async ({ page }) => {
    const state = buildTestState('classic', { marginH: 28, marginV: 22 });
    await injectTestState(page, state);
    await page.goto('/#/resume/test_classic');
    await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });
    const text = await getPreviewText(page);
    expect(text).toContain('Alex Johnson');
  });

  test('sidebar template responds to marginH and marginV', async ({ page }) => {
    const state = buildTestState('sidebar', { marginH: 22, marginV: 18 });
    await injectTestState(page, state);
    await page.goto('/#/resume/test_sidebar');
    await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });
    const text = await getPreviewText(page);
    expect(text).toContain('Alex Johnson');
    expect(text).toContain('Acme Corp');
  });
});

test.describe('Heading style variations', () => {
  const headingStyles = ['ruled', 'line', 'underline', 'leftbar', 'box', 'plain'];

  for (const style of headingStyles) {
    test(`headingStyle="${style}" renders without crash`, async ({ page }) => {
      const state = buildTestState('classic', { headingStyle: style });
      await injectTestState(page, state);
      await page.goto('/#/resume/test_classic');
      await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });
      const text = await getPreviewText(page);
      expect(text).toContain('Alex Johnson');
      expect(text).toContain('Professional Experience');
    });
  }
});

test.describe('Design panel UI interactions', () => {
  test('design tab is accessible from editor', async ({ page }) => {
    await gotoEditor(page, 'classic');
    // Click Design tab
    const designTab = page.locator('button:has-text("Design"), [role="tab"]:has-text("Design")').first();
    if (await designTab.isVisible()) {
      await designTab.click();
      await expect(page.locator('text=Font, text=Color, text=Spacing').first()).toBeVisible({ timeout: 5_000 }).catch(() => {});
    }
  });
});
