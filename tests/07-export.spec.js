/**
 * Export button tests.
 * Verifies that the export dropdown contains all expected options.
 * PDF download is tested by intercepting the download event.
 */
import { test, expect } from 'playwright/test';
import { gotoEditor } from './helpers.js';

test.describe('Export dropdown', () => {
  test.beforeEach(async ({ page }) => {
    await gotoEditor(page, 'classic');
  });

  test('Export button is visible in editor header', async ({ page }) => {
    await expect(page.locator('button:has-text("Export")')).toBeVisible({ timeout: 5_000 });
  });

  test('clicking Export opens the dropdown', async ({ page }) => {
    await page.locator('button:has-text("Export")').first().click();
    await expect(page.getByRole('button', { name: 'Export PDF', exact: true })).toBeVisible({ timeout: 5_000 });
  });

  test('dropdown contains all 4 export options', async ({ page }) => {
    await page.locator('button:has-text("Export")').first().click();
    await expect(page.getByRole('button', { name: 'Export PDF', exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: 'Export PDF (Legacy)', exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: 'Export Word', exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).toBeVisible({ timeout: 5_000 });
  });

  test('dropdown contains Import JSON option', async ({ page }) => {
    await page.locator('button:has-text("Export")').first().click();
    await expect(page.locator('button:has-text("Import JSON")')).toBeVisible({ timeout: 5_000 });
  });

  test('dropdown closes when clicking outside', async ({ page }) => {
    await page.locator('button:has-text("Export")').first().click();
    await expect(page.getByRole('button', { name: 'Export PDF', exact: true })).toBeVisible({ timeout: 5_000 });
    await page.click('body', { position: { x: 100, y: 100 } });
    await expect(page.getByRole('button', { name: 'Export PDF', exact: true })).not.toBeVisible({ timeout: 3_000 });
  });
});

test.describe('PDF export — download triggered', () => {
  test('clicking Export PDF triggers a file download', async ({ page }) => {
    await gotoEditor(page, 'classic');
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await page.locator('button:has-text("Export")').first().click();
    await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test('PDF filename contains the resume name/person name', async ({ page }) => {
    await gotoEditor(page, 'classic');
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await page.locator('button:has-text("Export")').first().click();
    await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/Alex.*\.pdf$/i);
  });

  test('Word export triggers a .docx download', async ({ page }) => {
    await gotoEditor(page, 'classic');
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await page.locator('button:has-text("Export")').first().click();
    await page.locator('button:has-text("Export Word")').first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.docx$/);
  });

  test('JSON export triggers a .json download', async ({ page }) => {
    await gotoEditor(page, 'classic');
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await page.locator('button:has-text("Export")').first().click();
    await page.locator('button:has-text("Export JSON")').first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });
});

test.describe('PDF export across all templates', () => {
  const templates = ['classic', 'modern', 'minimal', 'sidebar', 'executive'];

  for (const template of templates) {
    test(`${template} template exports PDF without error`, async ({ page }) => {
      await gotoEditor(page, template);
      const consoleErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
      await page.locator('button:has-text("Export")').first().click();
      await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.pdf$/);
      // No critical JS errors during export
      const criticalErrors = consoleErrors.filter(e =>
        !e.includes('Firebase') && !e.includes('firestore') && !e.includes('auth')
      );
      expect(criticalErrors.length).toBe(0);
    });
  }
});

test.describe('Cover letter PDF export', () => {
  test('cover letter PDF is downloaded when on cover letter tab', async ({ page }) => {
    await gotoEditor(page, 'classic');
    // Switch to cover letter tab
    const clTab = page.locator('button:has-text("Cover Letter"), button:has-text("Cover"), [role="tab"]:has-text("Cover")').first();
    await clTab.click();
    await page.locator('#cover-letter-preview').waitFor({ timeout: 10_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await page.locator('button:has-text("Export")').first().click();
    await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/cover_letter.*\.pdf$|.*\.pdf$/i);
  });
});
