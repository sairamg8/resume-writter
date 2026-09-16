// Modern's accent banner prints the name, the job title, the contacts (values and icons) and the
// summary in Design → Header Text Color, white by default — and printed it there as it was, however
// little it read on the Accent Color: a dark Header Text Color on a dark accent, the default white
// on a light accent, a light Sidebar design's dark header text carried over to Modern, all printed
// invisible. The Sidebar's name on its background has taken a readable tint of it since R2-2; the
// banner now takes the same (ONB-1, src/templates/pdf/shared/templateSettings.js).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderCover, drawState, loadModule, readDocx } from './harness.mjs';
import { painted } from './extractors.mjs';

before(setup);
after(teardown);

const PERSONAL = { name: 'Pat Sample', title: 'Staff Engineer', email: 'pat@example.com', summary: '<p>SumPlain words</p>' };
/** The banner's runs, and the alpha each prints at: the title at 90 %, the summary at 85 % (R5-9, FIDB-11). */
const RUNS = [['Pat Sample', 1], ['Staff Engineer', 0.9], ['pat@example.com', 1], ['SumPlain', 0.85]];

/** Header text colours that do not read on the banner, each as [settings, what it is]. */
const UNREADABLE = [
  [{ accentColor: '#374151', headerTextColor: '#0f172a' }, 'a dark Header Text Color on a dark accent (1.73:1)'],
  [{ accentColor: '#fde047' }, 'the default white on a light accent (1.32:1)'],
  [{ accentColor: '#10b981', headerTextColor: '#ffffff' }, 'white on an emerald accent (2.54:1)'],
  [{ sidebarBg: '#f1f5f9', headerTextColor: '#1e293b' }, 'a light Sidebar design\'s dark header text on the new résumé\'s #374151 banner (1.45:1)'],
];

const colors = () => loadModule('/src/templates/pdf/shared/pdfColors.js');
const modern = (settings, personal = PERSONAL) => resume({ template: 'modern', personal, settings });
/** The fill of the first run that prints `text`. */
const fillOf = async (bytes, text) => (await drawState(bytes, text))[0]?.fill;
/** The colour of the Word run that prints `text` in `xml`, as "#rrggbb". */
const wordColour = (xml, text) => `#${(xml.split('</w:r>').find((run) => run.includes(`>${text}<`)) || '').match(/<w:color w:val="([0-9a-fA-F]{6})"/)?.[1]?.toLowerCase()}`;

describe('Modern: a Header Text Color that does not read on the accent banner (ONB-1)', () => {
  it('the résumé prints the name, title, contacts, their icons and the summary in one readable tint of it', async () => {
    const { contrast } = await colors();
    for (const [settings, label] of UNREADABLE) {
      const r = modern(settings);
      const accent = r.settings.accentColor;
      const picked = r.settings.headerTextColor || '#ffffff';
      assert.ok(contrast(picked, accent) < 3, `${label}: the case does not read as picked`);
      const bytes = await render(r);
      const ink = await fillOf(bytes, 'Pat Sample');
      assert.ok(ink !== picked && contrast(ink, accent) >= 4.5, `${label}: the name ${ink} on ${accent}, ${contrast(ink, accent).toFixed(2)}:1`);
      for (const [text, alpha] of RUNS) {
        const [hit] = await drawState(bytes, text);
        assert.deepEqual([hit.fill, Math.round(hit.alpha * 100)], [ink, alpha * 100], `${label}: "${text}" in the name's colour, at ${alpha * 100} %`);
      }
      // Icon-sized fills: not the page or the banner behind them.
      const icons = (await painted(bytes)).filter((p) => p.paint === 'fill' && p.x1 - p.x0 < 20).map((p) => p.colour);
      assert.ok(icons.length && icons.every((c) => c === ink), `${label}: the e-mail icon in ${ink} (${[...new Set(icons)]})`);
    }
  });

  it('its letter prints the same tint on its band, in the PDF and in the Word file', async () => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    const { contrast } = await colors();
    for (const [settings, label] of UNREADABLE) {
      const r = modern(settings);
      const ink = await fillOf(await render(r), 'Pat Sample');
      assert.ok(contrast(ink, r.settings.accentColor) >= 4.5, `${label}: ${ink} reads on the band`);
      const letter = await renderCover(r);
      for (const text of ['Pat Sample', 'Staff Engineer', 'pat@example.com']) {
        assert.equal(await fillOf(letter, text), ink, `${label}: the letter's "${text}"`);
      }
      const { paragraphs } = readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
      const head = paragraphs.slice(0, 3).map((p) => p.xml).join('');
      for (const text of ['Pat Sample', 'pat@example.com']) {
        assert.equal(wordColour(head, text), ink, `${label}: the Word letter's "${text}"`);
      }
    }
  });

  it('Name & Title Colors picked for another header give way to the readable tint: on a template switch and in older saved data', async () => {
    const { headerColorsOnSwitch } = await loadModule('/src/templates/pdf/shared/headerColors.js');
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const { contrast } = await colors();
    // The Sidebar's white name and title, onto Modern with a light accent: white on #fde047 (1.32:1).
    const white = { nameColor: '#ffffff', jobTitleColor: '#ffffff', accentColor: '#fde047' };
    const switched = headerColorsOnSwitch(white, 'sidebar', 'modern');
    assert.deepEqual([switched.nameColor, switched.jobTitleColor], ['', ''], 'the switch: Modern\'s own');
    // The same white name as a build before v11 saved it on Modern (NB-1's migration, below 2:1).
    const old = { ...modern({ nameColor: '#ffffff', jobTitleColor: '', accentColor: '#fde047' }), dataVersion: 10, updatedAt: 5 };
    const loaded = normalizeResume(old);
    assert.deepEqual([loaded.settings.nameColor, loaded.settings.headerTextColor], ['', '#ffffff'], 'saved data: Modern\'s own name; the Header Text Color kept');
    for (const r of [modern(switched), loaded]) {
      const bytes = await render(r);
      for (const text of ['Pat Sample', 'Staff Engineer']) {
        const fill = await fillOf(bytes, text);
        assert.ok(contrast(fill, '#fde047') >= 4.5, `"${text}" ${fill} on #fde047`);
      }
    }
  });

  it('old saved data prints readable and loads unchanged: the settings keep the colours the user picked', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const { contrast } = await colors();
    for (const [settings, label] of UNREADABLE) {
      // As 4bc56fe saved it: no data version.
      const old = { ...modern(settings), updatedAt: 5 };
      delete old.dataVersion;
      const r = normalizeResume(old);
      for (const key of ['accentColor', 'headerTextColor', 'sidebarBg']) assert.equal(r.settings[key], old.settings[key], `${label}: ${key} kept`);
      const bytes = await render(r);
      for (const [text] of RUNS) {
        const fill = await fillOf(bytes, text);
        assert.ok(contrast(fill, r.settings.accentColor) >= 4.5, `${label}: "${text}" ${fill}`);
      }
    }
  });
});

// Guards: a colour that reads on the banner prints as picked; the fix is the tests above.
describe('Modern: a Header Text Color that reads on the accent banner prints as picked (ONB-1 guards)', () => {
  it('the default white on the default and the preset accents, a dark colour on a light accent, a picked Name or Job title colour', async () => {
    const cases = [
      [{}, '#ffffff', '#ffffff'],
      // The Design panel's accent presets. Orange and Teal: white at 3.56:1 and 3.74:1, which reads
      // (3:1) — at any name size: the banner's text is one colour, and a 13 pt name does not turn it dark.
      ...['#2563eb', '#4f46e5', '#7c3aed', '#e11d48', '#ea580c', '#0d9488', '#475569', '#0f172a'].map((accentColor) => [{ accentColor }, '#ffffff', '#ffffff']),
      [{ accentColor: '#ea580c', fontSizeNameDelta: 2 }, '#ffffff', '#ffffff'],
      [{ accentColor: '#fde68a', headerTextColor: '#111111' }, '#111111', '#111111'],
      [{ accentColor: '#374151', headerTextColor: 'rgba(255,255,255,0.6)' }, '#ffffff', '#ffffff'],
      // Design → Name color and Job title color are the user's pick on this header: they win, as on the Sidebar.
      [{ accentColor: '#fde047', nameColor: '#ffffff', jobTitleColor: '#fef9c3' }, '#ffffff', '#fef9c3'],
    ];
    for (const [settings, name, title] of cases) {
      const bytes = await render(modern(settings));
      assert.equal(await fillOf(bytes, 'Pat Sample'), name, `${JSON.stringify(settings)}: the name`);
      assert.equal(await fillOf(bytes, 'Staff Engineer'), title, `${JSON.stringify(settings)}: the title`);
      if (!settings.nameColor) assert.equal(await fillOf(bytes, 'pat@example.com'), name, `${JSON.stringify(settings)}: the contacts`);
    }
  });
});
