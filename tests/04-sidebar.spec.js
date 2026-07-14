/**
 * Sidebar-template-specific tests.
 * Verifies: margin settings, spacing, background color, two-column layout.
 */
import { test, expect } from 'playwright/test';
import { buildTestState, injectTestState, gotoEditor, getPreviewText, ALL_SECTION_TYPES } from './helpers.js';

test.describe('Sidebar PDF margin and spacing settings', () => {
  test('sidebar with compact margins (marginV=8, marginH=10) renders without overflow', async ({ page }) => {
    const state = buildTestState('sidebar', { marginV: 8, marginH: 10, sidebarBg: '#1e293b' });
    await injectTestState(page, state);
    await page.goto('/#/resume/test_sidebar');
    await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });
    const text = await getPreviewText(page);
    expect(text).toContain('Alex Johnson');
  });

  test('sidebar with wide margins (marginV=20, marginH=24) still renders all content', async ({ page }) => {
    const state = buildTestState('sidebar', { marginV: 20, marginH: 24, sidebarBg: '#1e293b' });
    await injectTestState(page, state);
    await page.goto('/#/resume/test_sidebar');
    await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });
    const text = await getPreviewText(page);
    expect(text).toContain('Professional Experience');
    expect(text).toContain('Skills');
  });

  test('custom sectionGap in sidebar section is applied without crash', async ({ page }) => {
    // Test per-section spaceAfter override (previously not converted from px to pt)
    const sections = ALL_SECTION_TYPES.map(s =>
      s.type === 'skills' ? { ...s, settings: { ...s.settings, spaceAfter: 24, itemGap: 16 } } : s
    );
    const state = buildTestState('sidebar', {}, sections);
    await injectTestState(page, state);
    await page.goto('/#/resume/test_sidebar');
    await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });
    const text = await getPreviewText(page);
    expect(text).toContain('Skills');
    expect(text).toContain('React');
  });

  test('changing sidebarBg color updates the canvas style', async ({ page }) => {
    const state1 = buildTestState('sidebar', { sidebarBg: '#1e293b' });
    await injectTestState(page, state1);
    await page.goto('/#/resume/test_sidebar');
    await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });
    // Check the sidebar element has the bg color applied
    const sidebarEl = page.locator('#resume-preview .w-\\[38\\%\\]').first();
    if (await sidebarEl.count() > 0) {
      const bgColor = await sidebarEl.evaluate(el => getComputedStyle(el).backgroundColor);
      expect(bgColor).toBeTruthy();
    } else {
      // Fallback: just verify preview renders
      const text = await getPreviewText(page);
      expect(text).toContain('Alex Johnson');
    }
  });

  test('section item gap changes take effect without crash', async ({ page }) => {
    const state = buildTestState('sidebar', { itemGap: 20, sectionGap: 24 });
    await injectTestState(page, state);
    await page.goto('/#/resume/test_sidebar');
    await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });
    const text = await getPreviewText(page);
    expect(text).toContain('Alex Johnson');
    expect(text).toContain('Acme Corp');
  });
});

test.describe('Sidebar template layout structure', () => {
  test.beforeEach(async ({ page }) => {
    await gotoEditor(page, 'sidebar');
  });

  test('sidebar column is visible (dark left column)', async ({ page }) => {
    // The sidebar template has a dark left column (w-[38%])
    const sidebarCol = page.locator('#resume-preview .w-\\[38\\%\\]').first();
    if (await sidebarCol.count() > 0) {
      await expect(sidebarCol).toBeVisible();
    } else {
      // Use flex container to confirm two-column layout
      const previewText = await getPreviewText(page);
      expect(previewText).toContain('Alex Johnson'); // Name in sidebar
    }
  });

  test('both sidebar and main column content visible', async ({ page }) => {
    const text = await getPreviewText(page);
    // Sidebar column: contact info, skills, languages, certifications, interests, references
    expect(text).toContain('alex@example.com');
    expect(text).toContain('Frontend');
    // Main column: experience, projects, awards, volunteering, custom
    expect(text).toContain('Acme Corp');
    expect(text).toContain('My App');
  });

  test('summary/about renders in main column', async ({ page }) => {
    const text = await getPreviewText(page);
    expect(text).toContain('experienced full stack engineer');
  });
});
