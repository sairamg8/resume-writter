import { test, expect } from '@playwright/test';
import { visitEditor, exportPdf, findRun } from './pw-helpers.js';

test.describe('Exported PDF — Header & Contact Customizations', () => {

  test('hiddenFields: hiding contact fields excludes them from exported PDF', async ({ page }) => {
    await visitEditor(page, 'classic');
    const full = await exportPdf(page);
    expect(full.text).toContain('alex@example.com');
    expect(full.text).toContain('+1 555 0100');

    // Hide phone and email via personal.hiddenFields
    await visitEditor(page, 'classic', {
      personal: {
        hiddenFields: ['phone', 'email'],
      },
    });

    const filtered = await exportPdf(page);
    expect(filtered.text).toContain('Alex Johnson');
    expect(filtered.text).toContain('alexjohnson.dev');
    // Hidden fields must NOT be in the PDF
    expect(filtered.text).not.toContain('alex@example.com');
    expect(filtered.text).not.toContain('+1 555 0100');
  });

  test('headerAlign: center alignment centers candidate name in exported PDF', async ({ page }) => {
    // Left align
    await visitEditor(page, 'classic', {
      settings: { headerAlign: 'left' },
    });
    const leftRes = await exportPdf(page);
    const leftNameRun = findRun(leftRes.runs, 'Alex Johnson');
    expect(leftNameRun).toBeDefined();

    // Center align
    await visitEditor(page, 'classic', {
      settings: { headerAlign: 'center' },
    });
    const centerRes = await exportPdf(page);
    const centerNameRun = findRun(centerRes.runs, 'Alex Johnson');
    expect(centerNameRun).toBeDefined();

    // Centered name run x coordinate is noticeably further right than left aligned
    expect(centerNameRun.x).toBeGreaterThan(leftNameRun.x + 50);
  });

  test('contactStyle: bar/bullet/icon contact styles export valid formatted runs', async ({ page }) => {
    await visitEditor(page, 'classic', {
      settings: {
        contactStyle: 'bar',
      },
    });

    const { runs, text } = await exportPdf(page);
    expect(runs.length).toBeGreaterThan(10);
    expect(text).toContain('alex@example.com');
    expect(text).toContain('alexjohnson.dev');
  });

});
