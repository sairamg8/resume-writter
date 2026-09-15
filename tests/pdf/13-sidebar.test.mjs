// The Sidebar template: links, fields, spacing, colours and styles of its two columns.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, renderDocx, read, allText, itemsWith, drawState, loadModule } from './harness.mjs';
import { hasPdftotext, splitWords } from './extractors.mjs';

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

  it('reference e-mail and phone are mailto: and tel: links, as in the main column and Word (R2-3)', async () => {
    const pages = await read(await render(sidebar([section('references', [
      { name: 'Jane Doe', email: 'jane@acme.com', phone: '+1 (555) 0101' },
    ])])));
    const urls = linksOf(pages);
    assert.ok(urls.includes('mailto:jane@acme.com') && urls.includes('tel:+15550101'), urls.join(', '));
    const t = itemsWith(pages, 'jane@acme.com')[0];
    const [x1, , x2] = pages[0].links.find((l) => l.url === 'mailto:jane@acme.com').rect;
    assert.ok(Math.abs(x1 - t.x) < 2 && Math.abs(x2 - (t.x + t.w)) < 2, 'only the address is clickable');
  });

  it('a URL that is not safe to link prints as text, not as a link — beside a safe one that is (R2-8)', async () => {
    const pages = await read(await render(sidebar([
      section('projects', [{ name: 'Proj', url: 'javascript:alert(1)' }, { name: 'Safe', url: 'github.com/me/safe' }]),
      section('certifications', [{ name: 'Cert', url: 'javascript:alert(2)' }]),
    ])));
    assert.deepEqual(linksOf(pages), ['https://github.com/me/safe'], 'the safe URL is the only link');
    const text = allText(pages);
    assert.ok(text.includes('javascript:alert(1)') && text.includes('javascript:alert(2)'), text);
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
    // Between Items (default 8 px = 6 pt) by Tight 4 : Normal 8 : Spacious 14; an Item gap wins.
    const between = 8 * 0.75;
    const compact = await skillGap({ spacing: 'compact' });
    const relaxed = await skillGap({ spacing: 'relaxed' });
    assert.ok(Math.abs(relaxed - compact - between * (14 - 4) / 8) < 0.2, `compact ${compact}, relaxed ${relaxed}`);
    const override = await skillGap({ spacing: 'compact', itemGap: 20 });
    assert.ok(Math.abs(override - compact - (20 * 0.75 - between * 4 / 8)) < 0.2, `an Item gap override wins: ${override}`);
  });

  it('Design → Between Items reaches the dark column: skills and interest chips move with it (R2-6)', async () => {
    const at = async (itemGap) => {
      const pages = await read(await render(sidebar([
        section('skills', [{ category: 'Alpha', skills: 'One' }, { category: 'Beta', skills: 'Two' }]),
        section('interests', [{ interests: 'Chess, Hiking' }]),
      ], { settings: itemGap === undefined ? {} : { itemGap } })));
      const [a, b] = ['ALPHA', 'BETA'].map((s) => itemsWith(pages, s)[0]);
      const [c, h] = ['Chess', 'Hiking'].map((s) => itemsWith(pages, s)[0]);
      return { rows: a.y - b.y, chips: h.x - (c.x + c.w) };
    };
    const base = await at(undefined);
    const wide = await at(40);
    assert.ok(Math.abs(wide.rows - base.rows - (40 - 8) * 0.75) < 0.2, `skills rows ${base.rows} → ${wide.rows}`);
    // The chips keep 2.5 pt at the default and grow in proportion: 2.5 × 30 / 6 pt at 40 px.
    const pad = base.chips - 2.5;
    assert.ok(Math.abs(wide.chips - pad - 2.5 * 5) < 0.2, `chip gap ${base.chips} → ${wide.chips}`);
    const spacious = await read(await render(sidebar([section('interests', [{ interests: 'Chess, Hiking' }], { spacing: 'relaxed' })])));
    const [c, h] = ['Chess', 'Hiking'].map((s) => itemsWith(spacious, s)[0]);
    assert.ok(Math.abs(h.x - (c.x + c.w) - pad - 2.5 * 1.75) < 0.2, 'the Spacious preset widens the chips\' gap');
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

  // The column's labels and headings keep their own size (8 and 8.5 pt) at any base size, so the
  // smallest and largest base size stand for all of them (R6-11: 9 sizes drew the same labels).
  it('pdf.js and every pdftotext mode read each label and heading as one word, at the smallest and largest base size', async (t) => {
    if (!hasPdftotext) t.diagnostic('pdftotext not installed: Poppler not checked');
    const found = [];
    for (const fontSizeBase of [8, 16]) {
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

describe('Sidebar skills', () => {
  const STYLES = ['inline', 'stacked', 'bullet', 'tags', 'bars'];

  for (const skillsStyle of STYLES) {
    it(`${skillsStyle}: a group's hidden Skills or hidden Category stays out of the PDF (FIDB-74)`, async () => {
      const text = allText(await read(await render(sidebar([section('skills', [
        { category: 'Core Tech', skills: 'React, Next.js', hiddenFields: ['skills'] },
        { category: 'Secret Group', skills: 'Golang, Rust', hiddenFields: ['category'] },
        { category: 'Hidden Group', skills: 'Kotlin', visible: false },
      ], { skillsStyle })]))));
      assert.ok(text.includes('CORE TECH'), `the shown category: ${text}`);
      assert.ok(!text.includes('React') && !text.includes('Next.js'), `hidden skills: ${text}`);
      assert.ok(!/CORE TECH\s*[:–]/.test(text), `no separator left dangling: ${text}`);
      assert.ok(text.includes('Golang') && text.includes('Rust'), `the shown skills: ${text}`);
      assert.ok(!/secret group/i.test(text), `a hidden category: ${text}`);
      assert.ok(!/kotlin|hidden group/i.test(text), `a hidden group: ${text}`);
    });
  }

  it('a list of skills (imported data) is hidden too, in the PDF and in Word (FIDB-74)', async () => {
    const groups = [{ category: 'Listed', skills: ['Haskell', 'Elm'], hiddenFields: ['skills'] }, { category: 'Shown', skills: ['Scala', 'OCaml'] }];
    for (const skillsStyle of STYLES) {
      const text = allText(await read(await render(sidebar([section('skills', groups, { skillsStyle })]))));
      assert.ok(!/Haskell|Elm/.test(text) && text.includes('Scala') && text.includes('OCaml'), `${skillsStyle}: ${text}`);
    }
    const { texts } = await renderDocx(sidebar([section('skills', groups)]));
    assert.ok(!texts.some((t) => /Haskell|Elm/.test(t)), texts.join(' | '));
    assert.ok(texts.some((t) => t.includes('Scala, OCaml')), texts.join(' | '));
  });

  const GROUPS = [{ category: 'Core Tech', skills: 'React, Go' }, { category: 'Cloud', skills: 'AWS, GCP' }];
  const skillsText = async (settings) => allText(await read(await render(sidebar([section('skills', GROUPS, settings)]))));

  it('Bullet prints one marked line per group, "CATEGORY: skills" (FIDB-75)', async () => {
    const text = await skillsText({ skillsStyle: 'bullet' });
    assert.match(text, /• CORE TECH: React, Go • CLOUD: AWS, GCP/);
    assert.ok(!(await skillsText({ skillsStyle: 'inline' })).includes('•'), 'Inline has no markers');
  });

  it('the Dash separator prints "CATEGORY – skills" in Inline and Bullet (FIDB-75)', async () => {
    assert.match(await skillsText({ skillsStyle: 'inline', separator: 'dash' }), /CORE TECH – React, Go CLOUD – AWS, GCP/);
    assert.match(await skillsText({ skillsStyle: 'bullet', separator: 'dash' }), /• CORE TECH – React, Go • CLOUD – AWS, GCP/);
    assert.match(await skillsText({ skillsStyle: 'inline', separator: 'colon' }), /CORE TECH: React, Go/);
  });

  it('a Bullet group that wraps keeps its lines clear of the marker', async () => {
    const long = { category: 'Tools', skills: 'Webpack, Vite, Rollup, esbuild, Babel, SWC, Turbopack, Parcel, Nx' };
    const pages = await read(await render(sidebar([section('skills', [long], { skillsStyle: 'bullet' })])));
    const marker = itemsWith(pages, '•')[0];
    const lines = [...new Set(['TOOLS', 'Webpack', 'Turbopack', 'Parcel', 'Nx'].map((w) => itemsWith(pages, w)[0]))];
    assert.ok(new Set(lines.map((t) => Math.round(t.y))).size > 1, 'the group wraps onto a second line');
    for (const t of lines) assert.ok(t.x > marker.x + marker.w, `"${t.str}" at x=${t.x.toFixed(1)}, marker ends at ${(marker.x + marker.w).toFixed(1)}`);
  });
});

describe('Sidebar education', () => {
  it('prints the description and legacy bullets, readable on the dark column', async () => {
    const edu = [{ institution: 'IIT Madras', degree: 'BTech', description: '<p>EduDescText <strong>coursework</strong></p><ul><li>EduListItem</li></ul>', bullets: ['EduLegacyBullet'] }];
    const bytes = await render(sidebar([section('education', edu)]));
    // Imported here, not at the top: a helper newer than the code under test must not stop the
    // whole file from loading (R2-8).
    const { contrast } = await import('../../src/templates/pdf/shared/pdfColors.js');
    const text = allText(await read(bytes));
    for (const s of ['EduDescText coursework', 'EduListItem', 'EduLegacyBullet']) assert.ok(text.includes(s), `${s} in: ${text}`);
    for (const s of ['EduDescText', 'EduListItem', 'EduLegacyBullet']) {
      const [hit] = await drawState(bytes, s);
      assert.ok(contrast(hit.fill, '#1e293b') >= 4.5, `${s}: ${hit.fill} on the sidebar fill`);
    }
  });

  it('prints the location, and "Show location" hides it', async () => {
    const edu = [{ institution: 'IIT Madras', degree: 'BTech', location: 'Chennai, India', startDate: '2015', endDate: '2019' }];
    const shown = allText(await read(await render(sidebar([section('education', edu)]))));
    assert.ok(shown.includes('Chennai, India') && shown.includes('IIT Madras'), shown);
    const hidden = allText(await read(await render(sidebar([section('education', edu, { showLocation: false })]))));
    assert.ok(!hidden.includes('Chennai') && hidden.includes('IIT Madras'), hidden);
  });
});

describe('Sidebar side-column headings', () => {
  it('follow Design → Title case: "As typed" prints them as typed; capitals stay the default (R6-4)', async () => {
    const sections = () => [
      section('skills', [{ category: 'Core', skills: 'React' }], {}, { title: 'Tech Skills' }),
      section('languages', [{ language: 'English' }], {}, { title: 'Spoken Languages' }),
    ];
    const personal = { email: 'me@example.com' };
    const typed = allText(await read(await render(sidebar(sections(), { settings: { sectionTitleCase: 'normal' }, personal }))));
    assert.ok(['Tech Skills', 'Spoken Languages', 'Contact'].every((h) => typed.includes(h)), typed);
    assert.ok(!/TECH SKILLS|SPOKEN LANGUAGES|CONTACT/.test(typed), typed);
    const upper = allText(await read(await render(sidebar(sections(), { personal }))));
    assert.ok(['TECH SKILLS', 'SPOKEN LANGUAGES', 'CONTACT'].every((h) => upper.includes(h)), upper);
  });

  // Both columns read Title case by one rule: capitals only for "ABC" ('upper', or none stored).
  // The side column capitalised anything but 'normal', so an imported 'title' or 'lower' printed
  // "Work History" in the main column beside "TECH SKILLS" and "CONTACT" (V2W2b-5).
  it('Title case means the same in both columns, whatever an imported file stores (V2W2b-5)', async () => {
    const sections = () => [
      experience([{ role: 'Engineer' }]),
      section('skills', [{ category: 'Core', skills: 'React' }], {}, { title: 'Tech Skills' }),
    ];
    const wrong = [];
    for (const [sectionTitleCase, capitals] of [['upper', true], ['', true], ['normal', false], ['title', false], ['lower', false]]) {
      const secs = sections();
      secs[0].title = 'Work History';
      const text = allText(await read(await render(sidebar(secs, { settings: { sectionTitleCase }, personal: { email: 'me@example.com' } }))));
      const want = capitals ? ['WORK HISTORY', 'TECH SKILLS', 'CONTACT'] : ['Work History', 'Tech Skills', 'Contact'];
      const missing = want.filter((h) => !text.includes(h));
      if (missing.length) wrong.push(`'${sectionTitleCase}': no ${missing.join(', ')}`);
    }
    assert.deepEqual(wrong, []);
  });

  // Guard for Typography's Sidebar note (V2W2b-3): Base and Section Title size the main column;
  // the side column's sections keep 8.5 pt headings and 9 pt text. If they ever follow, the note
  // in DesignPanelTypography.jsx has to go.
  it('keep their own 8.5 pt headings and 9 pt text at any Base and Section Title size (V2W2b-3)', async () => {
    const wrong = [];
    for (const [fontSizeBase, fontSizeSectionDelta] of [[11, 1], [16, 8], [8, -2]]) {
      const secs = [experience([{ role: 'Engineer' }]), section('languages', [{ language: 'English', proficiency: 'Native' }], {}, { title: 'Spoken' })];
      secs[0].title = 'Work History';
      const pages = await read(await render(sidebar(secs, { settings: { fontSizeBase, fontSizeSectionDelta } })));
      const h = (s) => Math.round(itemsWith(pages, s)[0].h * 10) / 10;
      const got = { main: h('WORK HISTORY'), side: h('SPOKEN'), text: h('English') };
      const want = { main: fontSizeBase + fontSizeSectionDelta, side: 8.5, text: 9 };
      if (JSON.stringify(got) !== JSON.stringify(want)) wrong.push(`${fontSizeBase}+${fontSizeSectionDelta}: ${JSON.stringify(got)}`);
    }
    assert.deepEqual(wrong, []);
  });
});
