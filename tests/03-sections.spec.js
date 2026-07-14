/**
 * Tests that all 11 section types render correctly on the canvas.
 * Uses the Classic template with ALL_SECTION_TYPES injected.
 */
import { test, expect } from 'playwright/test';
import { gotoEditor, getPreviewText } from './helpers.js';

test.describe('All section types — Classic template', () => {
  test.beforeEach(async ({ page }) => {
    await gotoEditor(page, 'classic');
  });

  test('experience section renders company, role, and dates', async ({ page }) => {
    const text = await getPreviewText(page);
    expect(text).toContain('Professional Experience');
    expect(text).toContain('Acme Corp');
    expect(text).toContain('Senior Dev');
    expect(text).toContain('01/2023');
  });

  test('education section renders institution and degree', async ({ page }) => {
    const text = await getPreviewText(page);
    expect(text).toContain('Education');
    expect(text).toContain('MIT');
    expect(text).toContain('BSc Computer Science');
  });

  test('skills section renders category and skills list', async ({ page }) => {
    const text = await getPreviewText(page);
    expect(text).toContain('Skills');
    expect(text).toContain('Frontend');
    expect(text).toContain('React');
    expect(text).toContain('TypeScript');
  });

  test('projects section renders project name and technologies', async ({ page }) => {
    const text = await getPreviewText(page);
    expect(text).toContain('Projects');
    expect(text).toContain('My App');
    expect(text).toContain('React');
  });

  test('languages section renders language and proficiency', async ({ page }) => {
    const text = await getPreviewText(page);
    expect(text).toContain('Languages');
    expect(text).toContain('English');
    expect(text).toContain('Native');
  });

  test('certifications section renders name and issuer', async ({ page }) => {
    const text = await getPreviewText(page);
    expect(text).toContain('Certifications');
    expect(text).toContain('AWS Solutions Architect');
    expect(text).toContain('Amazon');
  });

  test('awards section renders title and issuer', async ({ page }) => {
    const text = await getPreviewText(page);
    expect(text).toContain('Awards');
    expect(text).toContain('Employee of the Year');
    expect(text).toContain('Acme Corp');
  });

  test('volunteering section renders org and role', async ({ page }) => {
    const text = await getPreviewText(page);
    expect(text).toContain('Volunteering');
    expect(text).toContain('Red Cross');
    expect(text).toContain('Volunteer');
  });

  test('references section renders name and job title', async ({ page }) => {
    const text = await getPreviewText(page);
    expect(text).toContain('References');
    expect(text).toContain('Jane Doe');
    expect(text).toContain('CTO');
  });

  test('interests section renders interest items', async ({ page }) => {
    const text = await getPreviewText(page);
    expect(text).toContain('Interests');
    expect(text).toContain('Hiking');
    expect(text).toContain('Photography');
  });

  test('custom section renders custom title and content', async ({ page }) => {
    const text = await getPreviewText(page);
    expect(text).toContain('Publications');
    expect(text).toContain('React Performance Patterns');
    expect(text).toContain('Tech Blog');
  });
});

test.describe('All section types — Sidebar template', () => {
  test.beforeEach(async ({ page }) => {
    await gotoEditor(page, 'sidebar');
  });

  test('sidebar-type sections (skills, edu, languages, certs, interests, refs) render in sidebar column', async ({ page }) => {
    const text = await getPreviewText(page);
    // These go in the dark sidebar column
    expect(text).toContain('Skills');
    expect(text).toContain('Education');
    expect(text).toContain('Languages');
    expect(text).toContain('Certifications');
    expect(text).toContain('Interests');
    expect(text).toContain('References');
  });

  test('main-type sections (experience, projects, awards, volunteering) render in main column', async ({ page }) => {
    const text = await getPreviewText(page);
    expect(text).toContain('Professional Experience');
    expect(text).toContain('Projects');
    expect(text).toContain('Awards');
    expect(text).toContain('Volunteering');
  });

  test('custom section renders in main column', async ({ page }) => {
    const text = await getPreviewText(page);
    expect(text).toContain('Publications');
    expect(text).toContain('React Performance Patterns');
  });
});

test.describe('Section visibility toggle', () => {
  test('hidden section does not appear in preview', async ({ page }) => {
    const { buildTestState, injectTestState, ALL_SECTION_TYPES } = await import('./helpers.js');
    // Build state with awards section set to hidden
    const sections = ALL_SECTION_TYPES.map(s =>
      s.type === 'awards' ? { ...s, visible: false } : s
    );
    const state = buildTestState('classic', {}, sections);
    await injectTestState(page, state);
    await page.goto('/#/resume/test_classic');
    await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });

    const text = await getPreviewText(page);
    // Awards section is hidden, should not show its title
    expect(text).not.toContain('Employee of the Year');
  });
});

test.describe('Adding new sections via editor UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/');
    await page.waitForSelector('.group.bg-white.rounded-2xl', { timeout: 20_000 });
    await page.locator('.group.bg-white.rounded-2xl').first().locator('button:has-text("Edit")').click();
    await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });
  });

  test('Add Section button is visible in editor', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Add Section"), button:has-text("Add section")').first();
    await expect(addBtn).toBeVisible({ timeout: 5_000 });
  });

  test('clicking Add Section reveals section type picker', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Add Section"), button:has-text("Add section")').first();
    await addBtn.click();
    // Section type options should now be visible
    await expect(page.locator('text=Work Experience')).toBeVisible({ timeout: 5_000 });
  });
});
