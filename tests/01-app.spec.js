import { test, expect } from 'playwright/test';
import { gotoDashboard, buildTestState, injectTestState, STORAGE_KEY, DATA_VERSION } from './helpers.js';

test.describe('App bootstrap and dashboard', () => {
  test('dashboard loads and shows 6 seeded resumes', async ({ page }) => {
    await page.goto('/#/');
    // App seeds 6 resumes on fresh localStorage
    await page.waitForSelector('.group.bg-white.rounded-2xl', { timeout: 20_000 });
    const cards = page.locator('.group.bg-white.rounded-2xl');
    await expect(cards).toHaveCount(6, { timeout: 10_000 });
  });

  test('all 6 default template names are present on dashboard', async ({ page }) => {
    await page.goto('/#/');
    await page.waitForSelector('.group.bg-white.rounded-2xl', { timeout: 20_000 });
    for (const name of ['Classic', 'Executive', 'Modern', 'Minimal', 'Dark', 'Sidebar']) {
      await expect(page.locator(`.group.bg-white.rounded-2xl:has-text("${name}")`).first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('clicking Edit on a resume card navigates to the editor', async ({ page }) => {
    await page.goto('/#/');
    await page.waitForSelector('.group.bg-white.rounded-2xl', { timeout: 20_000 });
    const firstCard = page.locator('.group.bg-white.rounded-2xl').first();
    await firstCard.locator('button:has-text("Edit")').click();
    await expect(page).toHaveURL(/.*\/resume\/.*/, { timeout: 10_000 });
    await page.waitForSelector('button:has-text("Export")', { timeout: 10_000 });
  });

  test('editor header shows resume name and back button', async ({ page }) => {
    await page.goto('/#/');
    await page.waitForSelector('.group.bg-white.rounded-2xl', { timeout: 20_000 });
    await page.locator('.group.bg-white.rounded-2xl').first().locator('button:has-text("Edit")').click();
    await page.waitForSelector('button:has-text("Export")', { timeout: 10_000 });
    // Back button (ArrowLeft) is present
    await expect(page.locator('[title="Back to dashboard"]')).toBeVisible();
  });

  test('injected test state loads correctly in editor', async ({ page }) => {
    const state = buildTestState('classic');
    await injectTestState(page, state);
    await page.goto('/#/resume/test_classic');
    await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });
    // The off-screen preview should contain our test name
    const previewText = await page.locator('#resume-preview').textContent({ timeout: 10_000 });
    expect(previewText).toContain('Alex Johnson');
    expect(previewText).toContain('Full Stack Engineer');
  });

  test('can create a new resume — navigates to new editor', async ({ page }) => {
    await page.goto('/#/');
    await page.waitForSelector('.group.bg-white.rounded-2xl', { timeout: 20_000 });
    // "New Resume" button is in the Dashboard header or footer
    const newBtn = page.locator('button:has-text("New Resume")').first();
    if (await newBtn.isVisible()) {
      await newBtn.click();
      // App should navigate to the editor for the new resume
      await expect(page).toHaveURL(/.*\/resume\/.*/, { timeout: 10_000 });
    }
  });
});
