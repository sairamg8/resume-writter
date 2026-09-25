import { test, expect } from '@playwright/test';
import { visitEditor, exportPdf, findRun, openDesignPanel } from './pw-helpers.js';
import { ALL_SECTION_TYPES } from '../helpers.js';
import { railPixels, topRowAccent, hairlines, shortRules } from './preview-pixels.js';

/** The fixture's sections with two skill groups, so a grid has two cells to set side by side; `grid`: as picking Compact leaves them. */
const withTwoSkillGroups = (grid) => ALL_SECTION_TYPES.map((s) => (s.type !== 'skills' ? s : {
  ...s,
  settings: grid ? { spacing: 'normal', skillsStyle: 'inline', separator: 'colon' } : s.settings,
  items: [{ id: 'sk1', category: 'Frontend', skills: 'React, TypeScript, CSS' }, { id: 'sk2', category: 'Backend', skills: 'Node.js, PostgreSQL' }],
}));

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
    await page.getByTestId('template-timeline').click();
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
    // Each template card by its test id: `:has-text` matches case-insensitively, and Modern's card, listed
    // before Banner's, reads "Name and contacts in an accent banner" (R2-139); design cards name templates too.
    await page.getByTestId('template-banner').click();
    await expect.poll(() => topRowAccent(page), { timeout: 20_000 }).toBeGreaterThan(0.95);

    const { runs } = await exportPdf(page);
    expect(findRun(runs, 'Alex Johnson').colorHex).toBe('#ffffff');
    expect(findRun(runs, 'PROFESSIONAL').colorHex).toBe('#ffffff');
  });

  test('Academic template: the preview draws a hairline under each section title; the export centres the name, dates in the Text grey', async ({ page }) => {
    await visitEditor(page, 'academic');
    // Page 1 holds the first several section titles, each over its hairline.
    expect(await hairlines(page)).toBeGreaterThan(2);

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
    expect(await hairlines(page)).toBeLessThan(2); // at most Classic's header rule

    await openDesignPanel(page);
    await page.getByTestId('template-academic').click();
    await expect.poll(() => hairlines(page), { timeout: 20_000 }).toBeGreaterThan(2);
    await expect(page.locator('text=Academic brings its own type and spacing')).toBeVisible();

    const { runs } = await exportPdf(page);
    expect(findRun(runs, 'Alex Johnson').x).toBeGreaterThan(150);
  });

  test('Compact template: the preview draws a short rule after each title; the export sets the title beside the name, 9 pt text, skills two to a row', async ({ page }) => {
    await visitEditor(page, 'compact', { sections: withTwoSkillGroups(true) });
    // Page 1 holds several section titles, each followed by its short rule.
    expect(await shortRules(page)).toBeGreaterThan(2);

    const { runs, text } = await exportPdf(page);
    expect(text).toContain('Alex Johnson');
    expect(text).toContain('Acme Corp');
    const [name, title] = [findRun(runs, 'Alex Johnson'), findRun(runs, 'Full Stack Engineer')];
    expect(Math.abs(name.y - title.y)).toBeLessThan(2);
    expect(title.x).toBeGreaterThan(name.x);
    expect(findRun(runs, 'Built amazing products').fontSize).toBeCloseTo(9, 1);
    expect(Math.abs(findRun(runs, 'Frontend').y - findRun(runs, 'Backend').y)).toBeLessThan(1);
    // Section titles in the accent; an entry's dates in the Text colour's grey (#111111 at 72 %).
    expect(findRun(runs, 'PROFESSIONAL').colorHex).toBe('#2563eb');
    expect(findRun(runs, '01/2023').colorHex).toBe('#545454');
  });

  test('Compact is offered in the Design panel; picking it redraws the preview with its short rules and lays the skills out two to a row', async ({ page }) => {
    await visitEditor(page, 'classic', { sections: withTwoSkillGroups(false) });
    expect(await shortRules(page)).toBeLessThan(2);

    await openDesignPanel(page);
    await page.getByTestId('template-compact').click();
    await expect.poll(() => shortRules(page), { timeout: 20_000 }).toBeGreaterThan(2);
    await expect(page.locator('text=Compact brings its own type and spacing')).toBeVisible();

    const { runs } = await exportPdf(page);
    expect(Math.abs(findRun(runs, 'Frontend').y - findRun(runs, 'Backend').y)).toBeLessThan(1);
  });

});
