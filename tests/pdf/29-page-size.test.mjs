// Page size (PAR-01): A4 or US Letter — one setting per résumé, `settings.pageSize`, that its
// cover letter shares. Letter prints a 612 × 792 pt page in every template and the letter, lays
// the content out to Letter's width, and sizes both Word files; a résumé with no page size — every
// résumé saved before the setting — or one this build does not know prints the A4 page it always
// printed.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, teardown, resume, section, experience, render, renderCover, renderDocx, read, readDocx, overlaps, allItems, bodyItems, loadModule, MM, TEMPLATES,
} from './harness.mjs';
import { drawing, painted, PNG_2X2 as PNG } from './extractors.mjs';

before(setup);
after(teardown);

const LETTER = [612, 792];
const A4 = [595.28, 841.89];
/** Each page's box, [width, height] in pt, to 0.01 pt. */
const boxes = (pages) => pages.map((p) => [p.W, p.H].map((n) => Math.round(n * 100) / 100));

const words = 'shipped scalable services improving latency reliability across teams while mentoring engineers and owning delivery end to end'.split(' ');
const sentence = (seed, len) => Array.from({ length: len }, (_, i) => words[(seed * 7 + i * 3) % words.length]).join(' ');
const CONTACTS = { email: 'me@example.com', phone: '+1 555 0100', location: 'Hyderabad', website: 'me.dev', linkedin: 'linkedin.com/in/me' };

/** A résumé of `k` experience entries (06-pagination's), a photo and every contact. */
function longResume(template, k, settings = {}) {
  const items = Array.from({ length: k }, (_, i) => ({
    description: `<p>${sentence(i, 14 + (i % 3) * 6)}.</p><ul>${Array.from({ length: 3 + (i % 3) }, (_, j) => `<li>${sentence(i + j, 10 + ((i + j) % 4) * 5)}</li>`).join('')}</ul>`,
  }));
  return resume({
    template,
    settings,
    personal: { ...CONTACTS, photo: PNG, summary: `<p>${sentence(3, 30)}.</p>` },
    sections: [
      experience(items),
      section('education', [{ institution: 'University', degree: 'B.Tech', fieldOfStudy: 'CS', location: 'Hyderabad', startDate: '2012', endDate: '2016', gpa: '8.5' }]),
      section('skills', [{ category: 'Languages', skills: 'JavaScript, TypeScript, Python, SQL' }, { category: 'Frameworks', skills: 'React, Node.js, Express, PostgreSQL' }]),
    ],
  });
}

/** A letter long enough for two pages. */
const LONG_BODY = `<p>${sentence(1, 420)}</p><p>${sentence(2, 380)}</p>`;

/**
 * Everything printed where it should not be: a run outside the margins (the page's width less the
 * left and right margins, its height less the top and bottom ones), two runs on top of each other,
 * a blank last page.
 */
function misplaced(pages, { marginH = 18, marginV = 14 } = {}) {
  const h = marginH * MM;
  const v = marginV * MM;
  const out = [];
  if (pages.length > 1 && bodyItems(pages[pages.length - 1], pages.length - 1).length === 0) out.push('blank trailing page');
  pages.forEach((p, i) => {
    const tag = `p${i + 1}/${pages.length}`;
    // The page's own text: the running header ("Name · Page 2", ATS-7) prints in the top margin on purpose.
    for (const t of bodyItems(p, i)) {
      if (t.x < h - 1 || t.x + t.w > p.W - h + 1) out.push(`${tag}: "${t.str.slice(0, 24)}" x ${t.x.toFixed(1)}–${(t.x + t.w).toFixed(1)}, margins at ${h.toFixed(1)} and ${(p.W - h).toFixed(1)}`);
      if (t.y < v - 3 || t.y + t.h * 0.8 > p.H - v + 3) out.push(`${tag}: "${t.str.slice(0, 24)}" at y ${t.y.toFixed(1)}, outside the top and bottom margins`);
    }
    for (const [a, b] of overlaps(p)) out.push(`${tag}: "${a.slice(0, 20)}" overprints "${b.slice(0, 20)}"`);
  });
  return out;
}

describe('US Letter: the page (PAR-01)', () => {
  for (const template of TEMPLATES) {
    it(`${template}: every page is 612 × 792 pt, and nothing prints outside its margins`, async () => {
      const r = longResume(template, 8, { pageSize: 'LETTER' });
      const pages = await read(await render(r));
      assert.ok(pages.length >= 2, `${pages.length} page(s): the test needs a second one`);
      assert.deepEqual(boxes(pages), pages.map(() => LETTER));
      // The résumé's own margins: 18 / 14 mm, Compact's 12 / 10 mm (T9).
      assert.deepEqual(misplaced(pages, { marginH: r.settings.marginH, marginV: r.settings.marginV }), []);
    });
  }

  it('the cover letter: every page is 612 × 792 pt under every template, nothing outside its margins', async () => {
    for (const template of TEMPLATES) {
      const r = longResume(template, 1, { pageSize: 'LETTER' });
      // Twice the body: Compact's 9 pt letter holds the once-long body on one page (T9).
      const pages = await read(await renderCover({ ...r, coverLetter: { ...r.coverLetter, body: LONG_BODY + LONG_BODY } }));
      assert.ok(pages.length >= 2, `${template}: ${pages.length} page(s), the test needs a second one`);
      assert.deepEqual(boxes(pages), pages.map(() => LETTER), template);
      assert.deepEqual(misplaced(pages, { marginH: r.settings.marginH, marginV: r.settings.marginV }), [], template);
    }
  });

  it('the preview\'s letter with its writing hint (an empty body) is Letter too', async () => {
    const pages = await read(await renderCover(resume({ settings: { pageSize: 'LETTER' } }), { preview: true }));
    assert.deepEqual(boxes(pages), [LETTER]);
  });
});

describe('US Letter: the layout takes Letter\'s width (PAR-01)', () => {
  for (const template of TEMPLATES) {
    it(`${template}: a date ends at Letter's right margin; the text starts where it did on A4`, async () => {
      // Timeline sets the date above the title, at the left: its field at the right margin is the
      // location, at the end of the sub line in Title Stacked.
      const timeline = template === 'timeline';
      const make = (settings) => resume({ template, settings, personal: { email: 'me@example.com' }, sections: [experience([{ description: '<p>Did things</p>' }], timeline ? { titleStyle: 'stacked' } : {})] });
      const [a4] = await read(await render(make({})));
      const [letter] = await read(await render(make({ pageSize: 'LETTER' })));
      const wider = LETTER[0] - A4[0];
      const date = (page) => page.items.find((t) => t.str.includes(timeline ? 'City' : '01/2020'));
      const margin = LETTER[0] - (make({}).settings.marginH ?? 18) * MM; // 18 mm, Compact's own 12 mm (T9)
      assert.ok(Math.abs(date(letter).x + date(letter).w - margin) < 0.5, `ends at ${date(letter).x + date(letter).w}, Letter's margin at ${margin}`);
      assert.ok(Math.abs(date(letter).x - date(a4).x - wider) < 0.5, 'the date moves right by the difference in width');
      // At the left margin; Sidebar's main column starts 38 % of the page in, so it moves by 38 % of it.
      const body = (page) => page.items.find((t) => t.str.includes('Did things'));
      const moved = template === 'sidebar' ? 0.38 * wider : 0;
      assert.ok(Math.abs(body(letter).x - body(a4).x - moved) < 0.01, `the description starts ${body(letter).x - body(a4).x} pt further right, expected ${moved}`);
    });
  }

  it('Sidebar\'s column and the letterheads\' bands fill Letter\'s page: its full height, its width', async () => {
    const fills = async (bytes, colour) => (await painted(bytes)).filter((p) => p.paint === 'fill' && p.colour === colour)
      .map((p) => [p.x0, p.y0, p.x1, p.y1].map((n) => Math.round(n * 100) / 100));
    const [W, H] = LETTER;
    const letter = { pageSize: 'LETTER' };
    // The Sidebar Background: 38 % of the page, top to bottom.
    assert.deepEqual(await fills(await render(resume({ template: 'sidebar', settings: letter, sections: [experience([{}])] })), '#1e293b'), [[0, 0, Math.round(0.38 * W * 100) / 100, H]]);
    // The Sidebar letter's band runs to the paper's top and side edges.
    const [band] = await fills(await renderCover(resume({ template: 'sidebar', settings: letter })), '#1e293b');
    assert.deepEqual([band[0], band[2], band[3]], [0, W, H], `the band ${band}`);
    // Modern's band sits between the margins.
    const [modern] = await fills(await renderCover(resume({ template: 'modern', settings: letter })), '#374151');
    assert.deepEqual([modern[0], modern[2]], [18 * MM, W - 18 * MM].map((n) => Math.round(n * 100) / 100), `the band ${modern}`);
  });

  // The letterhead puts the contacts beside the name only when the name's widest word and the
  // contacts' widest item fit the header's width side by side (VM3-0); that width was A4's on any
  // page. Letter's header is 16.7 pt wider: a name that just does not fit beside the contacts on
  // A4 does on Letter.
  it('the letterhead: a name too wide beside the contacts on A4 fits beside them on Letter', async () => {
    const NAME = 'Venkataramanasubramaniam Iyer';
    const beside = async (settings) => {
      const r = resume({ settings, personal: { name: NAME, title: 'Engineer', email: 'alexandra.johnson@example.com', phone: '+1 555 0100' }, coverLetter: { body: '<p>Hello</p>' } });
      const [page] = await read(await renderCover(r));
      const name = page.items.find((t) => t.str.includes('Venkataramanasubramaniam'));
      const email = page.items.find((t) => t.str.includes('alexandra.johnson@example.com'));
      return email.x > name.x + name.w;
    };
    /** The largest Full Name size, 12–40 pt, that still keeps the contacts beside the name. */
    const largest = async (pageSize) => {
      let best = 0;
      for (let size = 12; size <= 40; size += 1) {
        const settings = { fontSizeNameDelta: size - 11, ...(pageSize ? { pageSize } : {}) };
        if (await beside(settings)) best = size;
      }
      return best;
    };
    const a4 = await largest(null);
    const letter = await largest('LETTER');
    assert.ok(a4 >= 12, `A4 keeps a ${a4} pt name beside the contacts`);
    assert.ok(letter > a4, `Letter keeps a larger name beside the contacts: ${letter} pt, A4 ${a4} pt`);
  });
});

describe('A4 stays as it was (PAR-01)', () => {
  // A résumé with no page size is every résumé saved before the setting (and the Cypress fixtures);
  // 'a4', a size this build does not offer and a non-string are read as A4 too.
  const VARIANTS = [['no page size', undefined], ['"A4"', 'A4'], ['"a4"', 'a4'], ['"Legal"', 'Legal'], ['a number', 5], ['null', null]];
  const make = (template, pageSize) => {
    const r = resume({ template, personal: { ...CONTACTS, photo: PNG, summary: '<p>Summary</p>' }, sections: [experience([{ description: '<p>Did things</p>' }])] });
    if (pageSize === undefined) delete r.settings.pageSize;
    else r.settings.pageSize = pageSize;
    return r;
  };

  for (const template of TEMPLATES) {
    it(`${template}: the résumé and its letter print the A4 page, drawn the same whatever is stored`, async () => {
      const bare = make(template, undefined);
      const [page] = await read(await render(bare));
      assert.deepEqual(boxes([page]), [A4]);
      const [letterPage] = await read(await renderCover(bare));
      assert.deepEqual(boxes([letterPage]), [A4]);
      const expected = await drawing(await render(bare));
      const expectedLetter = await drawing(await renderCover(bare));
      for (const [label, pageSize] of VARIANTS.slice(1)) {
        assert.equal(await drawing(await render(make(template, pageSize))), expected, `${label}: the résumé`);
        assert.equal(await drawing(await renderCover(make(template, pageSize))), expectedLetter, `${label}: the letter`);
      }
    });
  }

  it('"letter" in any case is US Letter', async () => {
    for (const pageSize of ['letter', 'Letter']) {
      assert.deepEqual(boxes(await read(await render(make('classic', pageSize)))), [LETTER], pageSize);
    }
  });
});

describe('page breaks on US Letter, swept over résumé length (PAR-01)', () => {
  // 06-pagination's sweep on A4, on Letter's 50 pt shorter page: every entry prints, nothing
  // outside the margins, nothing overprinted, no blank last page.
  for (const template of TEMPLATES) {
    it(`${template}: 1–16 entries`, async () => {
      const found = [];
      for (const k of [1, 4, 7, 10, 13, 16]) {
        const r = longResume(template, k, { pageSize: 'LETTER' });
        const pages = await read(await render(r));
        if (boxes(pages).some(([w, h]) => w !== LETTER[0] || h !== LETTER[1])) found.push(`k=${k}: not a Letter page`);
        for (const p of misplaced(pages, { marginH: r.settings.marginH, marginV: r.settings.marginV })) found.push(`k=${k} ${p}`);
        const printed = allItems(pages).filter((t) => t.str.includes('Role ')).length;
        if (printed < k) found.push(`k=${k}: ${printed}/${k} entry headers printed`);
      }
      assert.deepEqual(found, []);
    });
  }
});

describe('Word: the résumé and the letter .docx (PAR-01)', () => {
  /** The .docx's page: its size and margins, as <w:sectPr> writes them. */
  const sectPr = (xml) => {
    const tags = xml.match(/<w:sectPr>.*?<\/w:sectPr>/g) || [];
    assert.equal(tags.length, 1, 'one section');
    const attr = (tag, name) => Number((tags[0].match(new RegExp(`<w:${tag} [^>]*w:${name}="(\\d+)"`)) || [])[1]);
    return {
      size: [attr('pgSz', 'w'), attr('pgSz', 'h')],
      portrait: /<w:pgSz [^>]*w:orient="portrait"/.test(tags[0]),
      margins: ['top', 'right', 'bottom', 'left'].map((side) => attr('pgMar', side)),
    };
  };
  const letterDocx = async (r) => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    return readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
  };
  // Design → Spacing's default margins, whatever the paper: 14 mm top and bottom, 18 mm left and
  // right (R2-062; tests/pdf/69-word-spacing sets other ones) — Compact's own 10 and 12 mm (T9).
  const MARGINS = [794, 1020, 794, 1020];
  const twips = (mm) => Math.round((mm * 1440) / 25.4);

  for (const [label, docx] of [['résumé', renderDocx], ['letter', letterDocx]]) {
    it(`the ${label}: a US Letter page, 12240 × 15840 twips, with the same default margins, under every template`, async () => {
      for (const template of TEMPLATES) {
        const r = resume({ template, settings: { pageSize: 'LETTER' }, sections: [experience([{}])] });
        const { marginV: v, marginH: h } = r.settings;
        const page = sectPr((await docx(r)).xml);
        assert.deepEqual(page, { size: [12240, 15840], portrait: true, margins: [twips(v), twips(h), twips(v), twips(h)] }, template);
        if (template !== 'compact') assert.deepEqual(page.margins, MARGINS, `${template}: the default margins`);
      }
    });

    it(`the ${label}: A4, 11906 × 16838 twips, for no page size (saved data), "A4" and an unknown size`, async () => {
      for (const pageSize of [undefined, 'A4', 'Legal']) {
        const r = resume({ settings: { pageSize }, sections: [experience([{}])] });
        if (pageSize === undefined) delete r.settings.pageSize;
        const page = sectPr((await docx(r)).xml);
        assert.deepEqual(page, { size: [11906, 16838], portrait: true, margins: MARGINS }, String(pageSize));
      }
    });
  }
});
