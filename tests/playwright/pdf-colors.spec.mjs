import { test, expect } from '@playwright/test';
import { visitEditor, exportPdf, findRun } from './pw-helpers.js';

test.describe('Exported PDF — Color Customizations', () => {

  test('Custom name and job title colors apply directly to PDF text runs', async ({ page }) => {
    await visitEditor(page, 'classic', {
      settings: {
        nameColor: '#7c3aed',
        jobTitleColor: '#059669',
      },
    });

    const { runs } = await exportPdf(page);
    const nameRun = findRun(runs, 'Alex Johnson');
    expect(nameRun).toBeDefined();
    expect(nameRun.colorHex).toBe('#7c3aed');

    const titleRun = findRun(runs, 'Full Stack Engineer');
    expect(titleRun).toBeDefined();
    expect(titleRun.colorHex).toBe('#059669');
  });

  test('Custom text color applies to body content runs in exported PDF', async ({ page }) => {
    await visitEditor(page, 'classic', {
      settings: {
        textColor: '#1e293b',
      },
    });

    const { runs } = await exportPdf(page);
    const descRun = findRun(runs, 'Built amazing products');
    expect(descRun).toBeDefined();
    expect(descRun.colorHex).toBe('#3e4857');
  });

  test('Custom accent color applies to section headings in Executive/Modern', async ({ page }) => {
    await visitEditor(page, 'executive', {
      settings: {
        accentColor: '#0d9488',
        headingStyle: 'box',
      },
    });

    const { runs } = await exportPdf(page);
    const expHeading = findRun(runs, 'Experience');
    expect(expHeading).toBeDefined();
    // In box heading style with accent, heading text uses the accent color
    expect(expHeading.colorHex).toBe('#0d9488');
  });

});
