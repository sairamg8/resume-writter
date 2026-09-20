import { test, expect } from '@playwright/test';
import { visitEditor, exportPdf } from './pw-helpers.js';
import { ALL_SECTION_TYPES } from '../helpers.js';

test.describe('Exported PDF — Headings & Section Customizations', () => {

  test('sectionTitleCase: title case vs upper case changes headings in exported PDF', async ({ page }) => {
    // upper case
    await visitEditor(page, 'classic', {
      settings: {
        sectionTitleCase: 'upper',
      },
    });
    const upperRes = await exportPdf(page);
    expect(upperRes.text).toContain('PROFESSIONAL EXPERIENCE');

    // normal case (prints as typed)
    await visitEditor(page, 'classic', {
      settings: {
        sectionTitleCase: 'normal',
      },
    });
    const titleRes = await exportPdf(page);
    expect(titleRes.text).toContain('Professional Experience');
  });

  test('showDates: disabling dates removes date strings from exported PDF', async ({ page }) => {
    // Disable dates across experience
    const customSections = ALL_SECTION_TYPES.map(s => {
      if (s.type === 'experience') {
        return {
          ...s,
          settings: { ...s.settings, showDates: false },
        };
      }
      return s;
    });

    await visitEditor(page, 'classic', {
      sections: customSections,
    });

    const { text } = await exportPdf(page);
    expect(text).toContain('Alex Johnson');
    expect(text).toContain('Acme Corp');
    // "Present" from experience "01/2023 – Present" is removed
    expect(text).not.toContain('Present');
  });

  test('showLocation: disabling location removes city from exported PDF', async ({ page }) => {
    const customSections = ALL_SECTION_TYPES.map(s => {
      if (s.type === 'experience') {
        return {
          ...s,
          settings: { ...s.settings, showLocation: false },
        };
      }
      return s;
    });

    await visitEditor(page, 'classic', {
      sections: customSections,
    });

    const { text } = await exportPdf(page);
    expect(text).toContain('Acme Corp');
    // New York was the experience location
    expect(text).not.toContain('New York');
  });

  test('section visibility: hidden section is completely excluded from exported PDF', async ({ page }) => {
    // Hide projects and awards
    const customSections = ALL_SECTION_TYPES.map(s => {
      if (s.type === 'projects' || s.type === 'awards') {
        return { ...s, visible: false };
      }
      return s;
    });

    await visitEditor(page, 'classic', {
      sections: customSections,
    });

    const { text } = await exportPdf(page);
    expect(text).toContain('Alex Johnson');
    expect(text).toContain('Acme Corp');
    // Projects and Awards should NOT appear
    expect(text).not.toContain('My App');
    expect(text).not.toContain('Employee of the Year');
  });

});
