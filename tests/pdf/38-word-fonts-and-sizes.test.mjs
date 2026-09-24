// Word export: Design font, font sizes, and entry date colours (AUD-22, Known A4).
// Word ignores the Design font and sizes: the name is always 20 pt (wordExportHeader.js:58),
// section titles 10 pt (wordExportUtils.js:71), the font Calibri; entry dates are always
// the accent colour (wordExportUtils.js:157) while the PDF prints them grey on Minimal,
// Executive and Sidebar.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, renderDocx } from './harness.mjs';

before(setup);
after(teardown);

const cv = (template = 'classic', settings = {}, items = [{ company: 'Acme Corp', role: 'Staff Engineer', startDate: '2020-01', endDate: '2022-01' }]) => resume({
  template,
  settings: { accentColor: '#e11d48', textColor: '#111111', ...settings },
  sections: [experience(items)],
  personal: { name: 'Jordan Rivera', title: 'Staff Engineer', email: 'jordan@example.com' },
});

describe('Word export: font family and base font size (AUD-22)', () => {
  it('Word styles.xml uses the chosen Design font (not hardcoded Calibri)', async () => {
    const interDoc = await renderDocx(cv('classic', { font: 'inter' }));
    assert.match(interDoc.stylesXml, /<w:rFonts[^>]*w:ascii="Inter"/);

    const georgiaDoc = await renderDocx(cv('classic', { font: 'georgia' }));
    assert.match(georgiaDoc.stylesXml, /<w:rFonts[^>]*w:ascii="Georgia"/);

    const customDoc = await renderDocx(cv('classic', { customFont: 'Custom Sans' }));
    assert.match(customDoc.stylesXml, /<w:rFonts[^>]*w:ascii="Custom Sans"/);

    const defaultDoc = await renderDocx(cv('classic', {}));
    assert.match(defaultDoc.stylesXml, /<w:rFonts[^>]*w:ascii="Noto Sans"/);
  });

  it('Word styles.xml uses the chosen fontSizeBase (half-points: 11 pt = 22, 12 pt = 24)', async () => {
    const doc11 = await renderDocx(cv('classic', { fontSizeBase: 11 }));
    assert.match(doc11.stylesXml, /<w:docDefaults>.*?<w:sz w:val="22"/s);

    const doc12 = await renderDocx(cv('classic', { fontSizeBase: 12 }));
    assert.match(doc12.stylesXml, /<w:docDefaults>.*?<w:sz w:val="24"/s);
  });
});

describe('Word export: name and section title font sizes (AUD-22)', () => {
  it('the name size in document.xml matches fontSizeBase + fontSizeNameDelta in half-points', async () => {
    // Default: 11 pt + 8 delta = 19 pt = 38 half-pt (was hardcoded 40 = 20 pt)
    const docDefault = await renderDocx(cv('classic', { fontSizeBase: 11, fontSizeNameDelta: 8 }));
    const defaultRun = docDefault.paragraphs.flatMap((p) => p.xml.split('</w:r>')).find((x) => x.includes('>Jordan Rivera<'));
    assert.equal(defaultRun?.match(/<w:sz w:val="(\d+)"/)?.[1], '38', 'default name size is 38 (19 pt)');

    // Custom: 12 pt + 10 delta = 22 pt = 44 half-pt
    const docCustom = await renderDocx(cv('classic', { fontSizeBase: 12, fontSizeNameDelta: 10 }));
    const customRun = docCustom.paragraphs.flatMap((p) => p.xml.split('</w:r>')).find((x) => x.includes('>Jordan Rivera<'));
    assert.equal(customRun?.match(/<w:sz w:val="(\d+)"/)?.[1], '44', 'custom name size is 44 (22 pt)');
  });

  it('section title size in document.xml matches fontSizeBase + fontSizeSectionDelta in half-points', async () => {
    // Default: 11 pt + 1 delta = 12 pt = 24 half-pt (was hardcoded 20 = 10 pt)
    const docDefault = await renderDocx(cv('classic', { fontSizeBase: 11, fontSizeSectionDelta: 1 }));
    const defaultHeadRun = docDefault.paragraphs.flatMap((p) => p.xml.split('</w:r>')).find((x) => /PROFESSIONAL|EXPERIENCE/.test(x));
    assert.equal(defaultHeadRun?.match(/<w:sz w:val="(\d+)"/)?.[1], '24', 'default section title size is 24 (12 pt)');

    // Custom: 12 pt + 2 delta = 14 pt = 28 half-pt
    const docCustom = await renderDocx(cv('classic', { fontSizeBase: 12, fontSizeSectionDelta: 2 }));
    const customHeadRun = docCustom.paragraphs.flatMap((p) => p.xml.split('</w:r>')).find((x) => /PROFESSIONAL|EXPERIENCE/.test(x));
    assert.equal(customHeadRun?.match(/<w:sz w:val="(\d+)"/)?.[1], '28', 'custom section title size is 28 (14 pt)');
  });
});

describe('Word export: entry date colours (AUD-22)', () => {
  async function dateColor(template, settings = {}) {
    const doc = await renderDocx(cv(template, settings));
    const dateRun = doc.paragraphs.flatMap((p) => p.xml.split('</w:r>')).find((x) => /<w:t[^>]*>[^<]*(?:2020|2022|Present)/.test(x));
    assert.ok(dateRun, `${template}: date run found in Word document`);
    return dateRun.match(/<w:color w:val="([0-9a-fA-F]{6})"/)?.[1]?.toLowerCase();
  }

  it('Classic and Modern print entry dates in accent colour', async () => {
    assert.equal(await dateColor('classic', { accentColor: '#e11d48' }), 'e11d48');
    assert.equal(await dateColor('modern', { accentColor: '#2563eb' }), '2563eb');
  });

  it('Minimal, Executive and Sidebar print entry dates in grey (not accent colour)', async () => {
    // Minimal & Executive: shadesOf(settings).sub -> 545454 at default textColor #111111
    assert.equal(await dateColor('minimal', { accentColor: '#e11d48', textColor: '#111111' }), '545454');
    assert.equal(await dateColor('executive', { accentColor: '#e11d48', textColor: '#111111' }), '545454');

    // Sidebar: shadesOf(settings).muted -> a0a0a0 at default textColor #111111
    assert.equal(await dateColor('sidebar', { accentColor: '#e11d48', textColor: '#111111' }), 'a0a0a0');
  });

  // Its PDF prints Classic's page with the Sidebar's entries: grey dates, as in two columns. This
  // pinned the accent Word printed, which R2-121 found the PDF never did (86-sidebar-single-entry-colours).
  it('Sidebar Single · ATS-safe mode prints entry dates in the grey its PDF prints them in (R2-121)', async () => {
    assert.equal(await dateColor('sidebar', { accentColor: '#e11d48', textColor: '#111111', sidebarSingleColumn: true }), 'a0a0a0');
  });
});
