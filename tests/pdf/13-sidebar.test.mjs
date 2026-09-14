// The Sidebar template: links, fields, spacing, colours and styles of its two columns.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allText, itemsWith, drawState, loadModule } from './harness.mjs';
import { hasPdftotext, splitWords } from './extractors.mjs';
import { contrast, readableOn } from '../../src/templates/pdf/shared/pdfColors.js';

before(setup);
after(teardown);

const sidebar = (sections, extra = {}) => resume({ template: 'sidebar', sections, ...extra });
const linksOf = (pages) => pages.flatMap((p) => p.links.map((l) => l.url));

describe('Sidebar entry links (FIDB-14)', () => {
  it('project and certificate URLs are links; the certificate prints its link label', async () => {
    const pages = await read(await render(sidebar([
      section('projects', [{ name: 'Proj', url: 'github.com/me/proj' }]),
      section('certifications', [{ name: 'AWS Dev', url: 'https://credential.example.com/abc', urlLabel: 'View Certificate' }]),
    ])));
    const urls = linksOf(pages);
    assert.ok(urls.includes('https://github.com/me/proj'), urls.join(', '));
    assert.ok(urls.includes('https://credential.example.com/abc'), urls.join(', '));
    const text = allText(pages);
    assert.ok(text.includes('github.com/me/proj') && text.includes('View Certificate'), text);
    // Only the words are clickable, not the rest of the line.
    for (const [needle, url] of [['View Certificate', 'https://credential.example.com/abc'], ['github.com/me/proj', 'https://github.com/me/proj']]) {
      const t = itemsWith(pages, needle)[0];
      const [x1, y1, x2, y2] = pages[0].links.find((l) => l.url === url).rect;
      assert.ok(Math.abs(x1 - t.x) < 2 && Math.abs(x2 - (t.x + t.w)) < 2 && y1 < t.y && y2 > t.y, `${needle}: link ${[x1, y1, x2, y2]} vs text x=${t.x} w=${t.w} y=${t.y}`);
    }
  });

  it('a URL that is not safe to link prints as text, not as a link', async () => {
    const pages = await read(await render(sidebar([
      section('projects', [{ name: 'Proj', url: 'javascript:alert(1)' }]),
      section('certifications', [{ name: 'Cert', url: 'javascript:alert(2)' }]),
    ])));
    assert.deepEqual(linksOf(pages), []);
    assert.ok(allText(pages).includes('javascript:alert(1)'), allText(pages));
  });
});

describe('Sidebar dark-column spacing (FIDB-38)', () => {
  /** Baseline-to-baseline distance between the first two skill groups of the dark column. */
  async function skillGap(settings) {
    const pages = await read(await render(sidebar([
      section('skills', [{ category: 'Alpha', skills: 'One' }, { category: 'Beta', skills: 'Two' }], settings),
    ])));
    const [a, b] = ['ALPHA', 'BETA'].map((s) => itemsWith(pages, s)[0]);
    return a.y - b.y;
  }

  it('the section\'s spacing preset sets the gap between items, as in the main column', async () => {
    // Same precedence as the main column (getEffectiveSpacing, FIDA-53): a preset scales Design →
    // Between Items (default 12 px = 9 pt) by Tight 4 : Normal 8 : Spacious 14; an Item gap wins.
    const between = 12 * 0.75;
    const compact = await skillGap({ spacing: 'compact' });
    const relaxed = await skillGap({ spacing: 'relaxed' });
    assert.ok(Math.abs(relaxed - compact - between * (14 - 4) / 8) < 0.2, `compact ${compact}, relaxed ${relaxed}`);
    const override = await skillGap({ spacing: 'compact', itemGap: 20 });
    assert.ok(Math.abs(override - compact - (20 * 0.75 - between * 4 / 8)) < 0.2, `an Item gap override wins: ${override}`);
  });
});

describe('Sidebar dark-column fields', () => {
  it('references print every field the editor offers (FIDB-40)', async () => {
    const pages = await read(await render(sidebar([section('references', [
      { name: 'Jane Doe', jobTitle: 'CTO', company: 'Acme Corp', relationship: 'Former Manager', email: 'jane@acme.com', phone: '+1 555 0101' },
      { name: 'Hidden Ref', company: 'Hidden Co', visible: false },
    ])])));
    const text = allText(pages);
    for (const s of ['Jane Doe', 'CTO', 'Acme Corp', 'Former Manager', 'jane@acme.com', '+1 555 0101']) assert.ok(text.includes(s), `${s} in: ${text}`);
    assert.ok(!text.includes('Hidden'), 'a hidden reference stays out');
  });

  it('certifications print the expiry date, credential ID and link label (FIDB-58)', async () => {
    const cert = { name: 'AWS Dev', issuer: 'Amazon', date: '03/2024', expiry: '03/2027', credentialId: 'ABC-12345', url: 'https://credential.example.com/abc', urlLabel: 'View Certificate' };
    const text = allText(await read(await render(sidebar([section('certifications', [cert, { name: 'No Issue Date', expiry: '05/2030' }])]))));
    for (const s of ['AWS Dev', 'Amazon', '03/2024 – 03/2027', 'ID: ABC-12345', 'View Certificate', '– 05/2030']) assert.ok(text.includes(s), `${s} in: ${text}`);
    const undated = allText(await read(await render(sidebar([section('certifications', [cert], { showDates: false })]))));
    assert.ok(!undated.includes('2024') && !undated.includes('2027'), `Show dates off: ${undated}`);
    assert.ok(undated.includes('ID: ABC-12345'), undated);
  });
});

describe('Sidebar job title colour (FIDB-42)', () => {
  // WCAG 2 contrast, written out here rather than taken from the code under test.
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255]
      .map((v) => v / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  async function titleFill(settings) {
    const bytes = await render(sidebar([], { settings, personal: { title: 'Staff Engineer' } }));
    const [hit] = await drawState(bytes, 'Staff Engineer');
    return hit;
  }

  it('a dark accent never makes the title unreadable on the sidebar fill', async () => {
    const cases = [['#111111', '#1e293b'], ['#374151', '#1e293b'], ['#2563eb', '#1e293b'], ['#111111', '#14532d'], ['#7f1d1d', '#450a0a']];
    for (const [accentColor, sidebarBg] of cases) {
      const hit = await titleFill({ accentColor, sidebarBg });
      assert.equal(hit.alpha, 1);
      const r = ratio(hit.fill, sidebarBg);
      assert.ok(r >= 4.5, `accent ${accentColor} on ${sidebarBg}: title ${hit.fill}, contrast ${r.toFixed(2)}:1`);
    }
  });

  it('contrast() is the WCAG ratio; readableOn() lightens on dark, darkens on light, keeps what reads', () => {
    assert.equal(contrast('#000000', '#ffffff').toFixed(2), '21.00');
    assert.equal(contrast('#ffffff80', '#000000').toFixed(2), ratio('#808080', '#000000').toFixed(2));
    assert.equal(contrast('red', '#000000'), null);
    assert.equal(readableOn('#fbbf24', '#1e293b'), '#fbbf24');
    const light = readableOn('#111111', '#1e293b');
    assert.ok(lum(light) > lum('#111111') && ratio(light, '#1e293b') >= 4.5, light);
    const dark = readableOn('#fde68a', '#ffffff');
    assert.ok(lum(dark) < lum('#fde68a') && ratio(dark, '#ffffff') >= 4.5, dark);
    assert.equal(readableOn('red', '#1e293b'), 'red');
  });

  it('a readable accent is kept, and a job title colour the user picked always wins', async () => {
    assert.equal((await titleFill({ accentColor: '#fbbf24' })).fill, '#fbbf24');
    assert.equal((await titleFill({ accentColor: '#111111', jobTitleColor: '#bfdbfe' })).fill, '#bfdbfe');
    assert.equal((await titleFill({ accentColor: '#111111', jobTitleColor: '#222222' })).fill, '#222222');
  });
});

describe('Sidebar labels extract as whole words (FIDB-68)', () => {
  // A heading holds whatever the user types: a pangram puts every letter into the heading style.
  const PANGRAM = 'Jackdaws Love My Big Sphinx Of Quartz';
  const WORDS = [
    'CONTACT', 'EMAIL', 'PHONE', 'LOCATION', 'WEBSITE', 'LINKEDIN', 'GITHUB', // contact block
    'SKILLS', 'EDUCATION', 'LANGUAGES', 'CERTIFICATIONS', 'REFERENCES', ...PANGRAM.toUpperCase().split(' '), // headings
    'CORE TECHNOLOGY', 'WAVY AVATAR', // skill categories
  ];
  const labelled = (settings = {}) => sidebar([
    section('skills', [{ category: 'Core Technology', skills: 'React, Go' }, { category: 'Wavy Avatar', skills: 'Figma' }], { skillsStyle: 'tags' }),
    section('education', [{ institution: 'Uni', degree: 'BTech' }]),
    section('languages', [{ language: 'English', proficiency: 'Native' }]),
    section('certifications', [{ name: 'AWS' }]),
    section('interests', [{ interests: 'Chess' }], {}, { title: PANGRAM }),
    section('references', [{ name: 'Jane' }]),
  ], { settings, personal: { email: 'me@example.com', phone: '+1 555 0100', location: 'Hyderabad', website: 'example.com', linkedin: 'linkedin.com/in/me', github: 'github.com/me' } });

  it('pdf.js and every pdftotext mode read each label and heading as one word, at every base size', async (t) => {
    if (!hasPdftotext) t.diagnostic('pdftotext not installed: Poppler not checked');
    const found = [];
    for (let fontSizeBase = 8; fontSizeBase <= 16; fontSizeBase += 1) {
      for (const s of await splitWords(await render(labelled({ fontSizeBase })), WORDS)) found.push(`base ${fontSizeBase} pt, ${s}`);
    }
    assert.deepEqual(found, []);
  });

  it('every offered font family keeps them whole, at the smallest and largest base size (fonts from jsDelivr; skipped offline)', async (t) => {
    const online = await fetch('https://cdn.jsdelivr.net/npm/@fontsource/inter@5/metadata.json', { signal: AbortSignal.timeout(5000) }).then((r) => r.ok, () => false);
    if (!online) return t.skip('offline');
    if (!hasPdftotext) t.diagnostic('pdftotext not installed: Poppler not checked');
    const { FONT_MAP } = await loadModule('/src/templates/pdf/shared/pdfFontLoader.js');
    const found = [];
    for (const font of Object.keys(FONT_MAP)) {
      for (const fontSizeBase of [8, 16]) {
        for (const s of await splitWords(await render(labelled({ font, fontSizeBase })), WORDS)) found.push(`${font} ${fontSizeBase} pt, ${s}`);
      }
    }
    assert.deepEqual(found, []);
  });
});
