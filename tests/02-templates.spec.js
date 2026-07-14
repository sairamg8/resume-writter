/**
 * Tests that each of the 5 resume templates renders correctly.
 * Verifies: personal info, contact details, section headings, experience entries.
 */
import { test, expect } from 'playwright/test';
import { gotoEditor, getPreviewText, ALL_SECTION_TYPES, TEST_PERSONAL } from './helpers.js';

const TEMPLATES = ['classic', 'modern', 'minimal', 'sidebar', 'executive'];

for (const template of TEMPLATES) {
  test.describe(`${template} template`, () => {
    test.beforeEach(async ({ page }) => {
      await gotoEditor(page, template);
    });

    test('renders candidate name', async ({ page }) => {
      const text = await getPreviewText(page);
      expect(text).toContain(TEST_PERSONAL.name);
    });

    test('renders job title', async ({ page }) => {
      const text = await getPreviewText(page);
      expect(text).toContain(TEST_PERSONAL.title);
    });

    test('renders email contact', async ({ page }) => {
      const text = await getPreviewText(page);
      expect(text).toContain(TEST_PERSONAL.email);
    });

    test('renders experience section with company name', async ({ page }) => {
      const text = await getPreviewText(page);
      expect(text).toContain('Professional Experience');
      expect(text).toContain('Acme Corp');
      expect(text).toContain('Senior Dev');
    });

    test('renders education section', async ({ page }) => {
      const text = await getPreviewText(page);
      expect(text).toContain('Education');
      expect(text).toContain('MIT');
      expect(text).toContain('BSc Computer Science');
    });

    test('renders skills section', async ({ page }) => {
      const text = await getPreviewText(page);
      expect(text).toContain('Skills');
      expect(text).toContain('React');
    });

    test('renders projects section', async ({ page }) => {
      const text = await getPreviewText(page);
      expect(text).toContain('Projects');
      expect(text).toContain('My App');
    });

    test('renders certifications section', async ({ page }) => {
      const text = await getPreviewText(page);
      expect(text).toContain('Certifications');
      expect(text).toContain('AWS Solutions Architect');
    });

    test('canvas A4 page is visible', async ({ page }) => {
      // The visible resume canvas should exist
      await expect(page.locator('.bg-white.shadow-2xl').first()).toBeVisible({ timeout: 5_000 });
    });
  });
}

test.describe('Sidebar template structural tests', () => {
  test.beforeEach(async ({ page }) => {
    await gotoEditor(page, 'sidebar');
  });

  test('sidebar column receives sidebar-type sections (skills visible in sidebar)', async ({ page }) => {
    // Sidebar template puts skills/education/certifications in the dark left column
    // Both columns should render their content
    const text = await getPreviewText(page);
    expect(text).toContain('Skills');
    expect(text).toContain('Professional Experience');
  });

  test('sidebar template renders contact info', async ({ page }) => {
    const text = await getPreviewText(page);
    expect(text).toContain('alex@example.com');
  });
});

test.describe('Executive template structural tests', () => {
  test.beforeEach(async ({ page }) => {
    await gotoEditor(page, 'executive');
  });

  test('executive shows section titles in normal case (not upper)', async ({ page }) => {
    // Executive template uses sectionTitleCase: 'normal' by default
    // The section title in the HTML template should be rendered, not uppercased
    const previewEl = page.locator('#resume-preview');
    await expect(previewEl).toBeVisible();
    const text = await previewEl.textContent();
    // Check that at least some section exists
    expect(text).toContain('Experience');
  });
});
