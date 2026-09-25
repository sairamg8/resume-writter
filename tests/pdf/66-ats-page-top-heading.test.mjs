// A section heading that opens a page (TUI-6, filed as ATS-7). Headings keep with their first entry, so on
// some résumé lengths one moves to the top of page 2. pdf.js, Poppler's reading order and -layout read it as
// a line of its own; `pdftotext -raw` writes words in drawing order with a newline only BETWEEN two words, and
// after a page's last word it writes the form feed straight away, so the next page's first word joins the
// last line: "…checkout service.\fSKILLS". A parser that splits lines only on '\n' (ats-fields.mjs does, as
// do JS regexes with ^…$/m) then read the heading as body text.
//
// It is Poppler's, not react-pdf's: a two-page PDF written by hand (Helvetica, no react-pdf) and one made
// by `mutool create` read "Figma\fPROJECTS" under -raw too (diagnosis 2026-09-23). No invisible mark can
// take the join (react-pdf draws U+200B and U+FEFF as the space glyph, which Poppler drops, as it drops
// every whitespace and control character tried, and it exposes no marked content), and hidden text is what
// screeners flag as keyword stuffing. So every page after the first carries a visible running header,
// "Name · Page 2", drawn before anything else on the page (the owner's option A, 2026-09-25;
// 66-running-header pins it): the form feed joins it, and the heading keeps its own line under every reader.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, read, TEMPLATES } from './harness.mjs';
import { hasPdftotext, pdftotext } from './extractors.mjs';
import { truthFields, scoreFields, fieldProblems, pdfjsLineText } from './ats-fields.mjs';

before(setup);
after(teardown);

/**
 * Every single-column page: the four templates and the Sidebar's Single · ATS-safe mode. `from`: the bullet
 * count its sweep starts at — Compact's 9 pt page holds some 60 of them (T9), the others some 35.
 */
const CASES = [
  ...TEMPLATES.filter((t) => t !== 'sidebar').map((template) => ({ label: template, template, settings: {}, from: template === 'compact' ? 50 : 28 })),
  { label: 'sidebar single column', template: 'sidebar', settings: { sidebarSingleColumn: true } },
];

/** One job of `n` one-line bullets, then an inline Skills section. */
function build(c, n) {
  const bullets = Array.from({ length: n }, (_, i) => `<li>Shipped release ${i + 1} of the checkout service.</li>`).join('');
  return resume({
    template: c.template,
    settings: c.settings,
    personal: { name: 'Pat Lee', title: 'Engineer', email: 'pat@example.com', phone: '+1 555 0100' },
    sections: [
      experience([{ role: 'Staff Engineer', company: 'Northwind Traders', startDate: '03/2019', endDate: '', current: true, description: `<ul>${bullets}</ul>` }]),
      section('skills', [{ category: 'Languages', skills: 'TypeScript, SQL, Go' }]),
    ],
  });
}

/** The running header's runs on page 2 ("Pat Lee · Page 2", split or whole). */
const RUNNING = /^(Pat Lee)?\s*·?\s*(Page\s*)?2?$/;

/**
 * The first bullet count whose page 2 opens with the Skills heading (pdf.js's first item there after the
 * running header, which is the first thing drawn), with its PDF — or null. Two pages only: past that the
 * sweep has overshot.
 */
async function pageTopHeading(c) {
  const from = c.from ?? 28;
  for (let n = from; n <= from + 16; n += 1) {
    const r = build(c, n);
    const bytes = await render(r);
    const pages = await read(bytes);
    if (pages.length > 2) break;
    // The page's own first text: after the running header, which is drawn first on every page but the first.
    const first = pages[1]?.items.find((t) => !RUNNING.test(t.str.trim()))?.str.trim().toLowerCase();
    if (first === r.sections[1].title.toLowerCase()) return { r, bytes, pages, n };
  }
  return null;
}

// Each case is swept once and shared by the checks below (a sweep is ~5 renders).
const sweeps = new Map();
const sweep = (c) => {
  if (!sweeps.has(c.label)) sweeps.set(c.label, pageTopHeading(c));
  return sweeps.get(c.label);
};

/**
 * The section headings the chosen readers miss for one case, after asserting page 2 really opens with
 * the heading. Only headings are this row's: a page holding one long job also has that job's lone
 * right-hand date read after the page's left column in Poppler's reading order (it did before ATS-1's
 * header change too), which is another matter and is not asserted here.
 */
async function headingsLostAt(c, keep) {
  const hit = await sweep(c);
  assert.ok(hit, `${c.label}: no bullet count from ${c.from ?? 28} to ${(c.from ?? 28) + 16} put Skills first on page 2 — re-tune the sweep`);
  const readers = [['pdf.js', pdfjsLineText(hit.pages)], ...pdftotext(hit.bytes)].filter(([name]) => keep(name));
  const truth = truthFields(hit.r);
  return readers.flatMap(([name, text]) => fieldProblems(`${c.label} (${hit.n} bullets) ${name}`, scoreFields(truth, text)))
    .filter((p) => /section header/.test(p));
}

describe('a section heading that opens page 2 reads as a heading (ATS-7)', () => {
  for (const c of CASES) {
    it(`${c.label}: pdf.js, Poppler reading order and -layout`, async (t) => {
      if (!hasPdftotext) { t.skip('pdftotext not installed'); return; }
      assert.deepEqual(await headingsLostAt(c, (name) => !name.includes('-raw')), []);
    });
  }
});

describe('Poppler -raw: the running header takes the form feed (ATS-7)', () => {
  it('Poppler -raw reads a heading that opens page 2 as a heading', async (t) => {
    if (!hasPdftotext) { t.skip('pdftotext not installed'); return; }
    const found = [];
    for (const c of CASES) found.push(...await headingsLostAt(c, (name) => name.includes('-raw')));
    assert.deepEqual(found, []);
  });
});

describe('the field scorer catches a heading glued across a page break', () => {
  const R = {
    personal: { name: 'Pat Lee', title: 'Engineer', email: 'pat@example.com', phone: '+1 555 0100', hiddenFields: [] },
    sections: [
      { id: 'exp', type: 'experience', title: 'Experience', items: [{ role: 'Staff Engineer', company: 'Northwind Traders', startDate: '03/2021', endDate: '', current: true }] },
      { id: 'sk', type: 'skills', title: 'Skills', items: [{ category: 'Languages', skills: 'TypeScript, SQL' }] },
    ],
  };
  const clean = [
    'Pat Lee', 'Engineer', 'pat@example.com +1 555 0100', 'Experience',
    'Staff Engineer · Northwind Traders    Mar 2021 – Present', '• Built the checkout flow.',
    'Skills', 'Languages: TypeScript, SQL',
  ].join('\n');

  it('passes the heading on its own line', () => assert.deepEqual(fieldProblems('clean', scoreFields(truthFields(R), clean)), []));
  it('flags "…\\fSkills" (the -raw page join) as an undetected heading', () => {
    const glued = clean.replace('\nSkills\n', '\fSkills\n');
    assert.match(fieldProblems('x', scoreFields(truthFields(R), glued)).join(), /section header\(s\) undetected/);
  });
});
