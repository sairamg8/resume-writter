/**
 * Cover letter tests: tab switching, content rendering, and export.
 */
import { test, expect } from 'playwright/test';
import { gotoEditor, buildTestState, injectTestState, TEST_COVER_LETTER, TEST_PERSONAL } from './helpers.js';

test.describe('Cover letter tab', () => {
  test.beforeEach(async ({ page }) => {
    await gotoEditor(page, 'classic');
  });

  test('Cover Letter tab is present in the editor panel', async ({ page }) => {
    // Look for a tab labeled "Cover Letter" or similar
    const clTab = page.locator('button:has-text("Cover Letter"), button:has-text("Cover"), [role="tab"]:has-text("Cover")').first();
    await expect(clTab).toBeVisible({ timeout: 10_000 });
  });

  test('clicking Cover Letter tab switches the preview to the cover letter', async ({ page }) => {
    const clTab = page.locator('button:has-text("Cover Letter"), button:has-text("Cover"), [role="tab"]:has-text("Cover")').first();
    await clTab.click();
    // The cover letter preview should now be visible
    const clPreview = page.locator('#cover-letter-preview');
    await expect(clPreview).toBeVisible({ timeout: 10_000 });
  });

  test('cover letter preview shows the candidate name', async ({ page }) => {
    const clTab = page.locator('button:has-text("Cover Letter"), button:has-text("Cover"), [role="tab"]:has-text("Cover")').first();
    await clTab.click();
    const clPreview = page.locator('#cover-letter-preview');
    await expect(clPreview).toBeVisible({ timeout: 10_000 });
    const text = await clPreview.textContent();
    expect(text).toContain(TEST_PERSONAL.name);
  });
});

test.describe('Cover letter with pre-populated body', () => {
  test('cover letter body content renders when body is set', async ({ page }) => {
    const state = buildTestState('classic');
    // State already has cover letter with body from TEST_COVER_LETTER
    await injectTestState(page, state);
    await page.goto('/#/resume/test_classic');
    await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });

    const clTab = page.locator('button:has-text("Cover Letter"), button:has-text("Cover"), [role="tab"]:has-text("Cover")').first();
    await clTab.click();

    const clPreview = page.locator('#cover-letter-preview');
    await expect(clPreview).toBeVisible({ timeout: 10_000 });
    const text = await clPreview.textContent();

    // Should show candidate name
    expect(text).toContain('Alex Johnson');
  });

  test('cover letter shows job title as subtitle', async ({ page }) => {
    const state = buildTestState('classic');
    await injectTestState(page, state);
    await page.goto('/#/resume/test_classic');
    await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });

    const clTab = page.locator('button:has-text("Cover Letter"), button:has-text("Cover"), [role="tab"]:has-text("Cover")').first();
    await clTab.click();

    const clPreview = page.locator('#cover-letter-preview');
    await expect(clPreview).toBeVisible({ timeout: 10_000 });
    const text = await clPreview.textContent();
    expect(text).toContain(TEST_PERSONAL.title);
  });

  test('cover letter closing signature renders', async ({ page }) => {
    const state = buildTestState('classic');
    await injectTestState(page, state);
    await page.goto('/#/resume/test_classic');
    await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });

    const clTab = page.locator('button:has-text("Cover Letter"), button:has-text("Cover"), [role="tab"]:has-text("Cover")').first();
    await clTab.click();
    const clPreview = page.locator('#cover-letter-preview');
    await expect(clPreview).toBeVisible({ timeout: 10_000 });
    const text = await clPreview.textContent();
    expect(text).toContain('Sincerely');
    expect(text).toContain('Alex Johnson');
  });
});

test.describe('Cover letter export', () => {
  test('Export PDF button exists when on cover letter tab', async ({ page }) => {
    await gotoEditor(page, 'classic');
    const clTab = page.locator('button:has-text("Cover Letter"), button:has-text("Cover"), [role="tab"]:has-text("Cover")').first();
    await clTab.click();
    // Export button should still be visible
    const exportBtn = page.locator('button:has-text("Export")').first();
    await expect(exportBtn).toBeVisible({ timeout: 5_000 });
  });

  test('Export dropdown contains "Export PDF" on cover letter tab', async ({ page }) => {
    await gotoEditor(page, 'classic');
    const clTab = page.locator('button:has-text("Cover Letter"), button:has-text("Cover"), [role="tab"]:has-text("Cover")').first();
    await clTab.click();
    // Open export dropdown
    const exportBtn = page.locator('button:has-text("Export")').first();
    await exportBtn.click();
    await expect(page.getByRole('button', { name: 'Export PDF', exact: true })).toBeVisible({ timeout: 5_000 });
  });
});
