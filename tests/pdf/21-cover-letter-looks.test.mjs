// The cover letter's letterhead takes the résumé template's look (FIDB-51): Modern's accent
// band, the Sidebar panel's colour to the paper's edges, Minimal's hairline, Executive's double
// rule, Classic's accent rule as every letter printed it — with the résumé's name and title
// colours and its header alignment. Before, every template printed Classic's letterhead.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, renderCover, read, allItems, drawState, loadModule, MM, TEMPLATES } from './harness.mjs';
import { painted, PNG_2X2 as PNG } from './extractors.mjs';

before(setup);
after(teardown);

const ACCENT = '#e11d48';
const CONTACTS = { email: 'pat@example.com', phone: '+1 555 0100', location: 'Berlin, Germany' };

/** A letter on `template` with a full letterhead and business block; the options merge in. */
const letter = (template, { settings, personal, coverLetter } = {}) => resume({
  template,
  settings: { accentColor: ACCENT, ...settings },
  personal: { name: 'Pat Sample', title: 'Staff Engineer', ...CONTACTS, hiddenFields: [], ...personal },
  coverLetter: { body: '<p>Dear Sarah,</p>', date: '2026-01-15', recipientName: 'Sarah Smith', company: 'Globex Corp', subject: 'Re: the role', ...coverLetter },
});

/** Filled rectangles in `colour` bigger than an icon: a band. */
const bands = (paths, colour) => paths.filter((p) => p.paint === 'fill' && p.colour === colour && p.x1 - p.x0 > 100);
/** Horizontal strokes in `colour` across the text column: rules. */
const rules = (paths, colour) => paths.filter((p) => p.paint === 'stroke' && p.colour === colour && p.x1 - p.x0 > 400 && p.y1 - p.y0 < 1);
const near = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;

/** The letterhead's text items (the first "Pat Sample" and "Staff Engineer", and the contacts). */
function letterheadItems(pages) {
  const items = allItems(pages);
  const first = (s) => items.find((t) => t.str.includes(s));
  return ['Pat Sample', 'Staff Engineer', ...Object.values(CONTACTS)].map((s) => first(s.replace(/ /g, ' ')) || first(s));
}

/** Every item lies inside `b` (a baseline and 3/4 of the line box above it). */
function assertInside(items, b, at) {
  for (const t of items) {
    assert.ok(t.x >= b.x0 - 0.5 && t.x + t.w <= b.x1 + 0.5 && t.y >= b.y0 && t.y + t.h * 0.75 <= b.y1, `${at}: "${t.str}" (x ${t.x.toFixed(1)}–${(t.x + t.w).toFixed(1)}, y ${t.y.toFixed(1)}) inside the band x ${b.x0.toFixed(1)}–${b.x1.toFixed(1)}, y ${b.y0.toFixed(1)}–${b.y1.toFixed(1)}`);
  }
}

describe('the letterhead takes the résumé template\'s look (FIDB-51)', () => {
  // Guard: the Classic letterhead is the one every letter printed before (checked against
  // 0b83cb1 over 320 option combinations: the same page wherever the résumé header is left-aligned
  // and has no picked name or job title colour).
  it('Classic: a 2.5 pt accent rule under name, title and contacts; no band', async () => {
    const bytes = await renderCover(letter('classic'));
    const paths = await painted(bytes);
    const [rule, ...more] = rules(paths, ACCENT);
    assert.ok(rule && !more.length, 'one accent rule');
    assert.equal(rule.width, 2.5);
    assert.deepEqual(bands(paths, ACCENT), [], 'no band');
    const [name] = letterheadItems(await read(bytes));
    assert.ok(near(name.x, 18 * MM), `the name at the left margin (x ${name.x})`);
    assert.match(name.font, /Bold/);
    assert.equal((await drawState(bytes, 'Pat Sample'))[0].fill, '#111111', 'the name in the Text colour');
    assert.equal((await drawState(bytes, 'Staff Engineer'))[0].fill, ACCENT, 'the title in the accent');
  });

  it('Modern: the résumé banner — an accent band inside the margins, everything on it in the header text colour', async () => {
    for (const [headerTextColor, ink] of [[undefined, '#ffffff'], ['#fde68a', '#fde68a']]) {
      const bytes = await renderCover(letter('modern', { settings: { headerTextColor } }));
      const pages = await read(bytes);
      const paths = await painted(bytes);
      const [band, ...more] = bands(paths, ACCENT);
      assert.ok(band && !more.length, `${ink}: one accent band`);
      const { W, H } = pages[0];
      assert.ok(near(band.x0, 18 * MM) && near(band.x1, W - 18 * MM), `${ink}: the band spans the text column (x ${band.x0.toFixed(1)}–${band.x1.toFixed(1)})`);
      assert.ok(near(band.y1, H - 14 * MM), `${ink}: it starts at the top margin (y ${band.y1.toFixed(1)})`);
      assertInside(letterheadItems(pages), band, ink);
      for (const s of ['Pat Sample', 'pat@example.com']) assert.equal((await drawState(bytes, s))[0].fill, ink, `${ink}: ${s}`);
      const [title] = await drawState(bytes, 'Staff Engineer');
      assert.deepEqual([title.fill, Math.round(title.alpha * 100)], [ink, 90], `${ink}: the title at 90 %, as on the banner`);
      assert.ok(allItems(pages).find((t) => t.str === '15 January 2026').y < band.y0, 'the date prints under the band');
      assert.deepEqual(rules(paths, ACCENT), [], 'no rule');
    }
  });

  it('Sidebar: the panel\'s colour from the paper\'s edges behind the letterhead, in the column\'s colours', async () => {
    const { readableOn, sidebarShades } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    for (const sidebarBg of [undefined, '#14532d', '#f1f5f9']) {
      const bg = sidebarBg || '#1e293b';
      const bytes = await renderCover(letter('sidebar', { settings: { sidebarBg } }));
      const pages = await read(bytes);
      const [band, ...more] = bands(await painted(bytes), bg);
      assert.ok(band && !more.length, `${bg}: one band`);
      const { W, H } = pages[0];
      assert.deepEqual([band.x0, band.x1, band.y1].map((n) => Math.round(n)), [0, Math.round(W), Math.round(H)], `${bg}: to the left, right and top edges`);
      const items = letterheadItems(pages);
      assertInside(items, band, bg);
      assert.ok(near(items[0].x, 18 * MM), `${bg}: the name keeps the page margin`);
      assert.equal((await drawState(bytes, 'Pat Sample'))[0].fill, readableOn('#ffffff', bg), `${bg}: the name, as the column prints it`);
      assert.equal((await drawState(bytes, 'Staff Engineer'))[0].fill, readableOn(ACCENT, bg), `${bg}: the title`);
      assert.equal((await drawState(bytes, 'pat@example.com'))[0].fill, sidebarShades(bg).value, `${bg}: the contacts`);
    }
  });

  it('Minimal: its light name and a hairline in the pale accent, not Classic\'s rule', async () => {
    const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    const bytes = await renderCover(letter('minimal'));
    const paths = await painted(bytes);
    assert.deepEqual(rules(paths, ACCENT), [], 'no accent rule');
    const hair = rules(paths, solid(ACCENT, 0.4));
    assert.deepEqual(hair.map((r) => r.width), [0.75], 'one 0.75 pt pale rule');
    const [name] = letterheadItems(await read(bytes));
    assert.doesNotMatch(name.font, /Bold/, 'the name is not bold');
    assert.equal((await drawState(bytes, 'Staff Engineer'))[0].fill, '#555555', 'Minimal\'s grey title');
  });

  it('Executive: a double accent rule', async () => {
    const [top, bottom, ...more] = rules(await painted(await renderCover(letter('executive'))), ACCENT).sort((a, b) => b.y0 - a.y0);
    assert.ok(top && bottom && !more.length, 'two accent rules');
    assert.deepEqual([top.width, bottom.width], [0.75, 0.75]);
    const gap = top.y0 - bottom.y1;
    assert.ok(gap > 0.5 && gap < 3, `close together: ${gap.toFixed(2)} pt apart`);
  });

  it('Design → Name and Job title colours reach the letterhead in every look', async () => {
    for (const template of TEMPLATES) {
      const bytes = await renderCover(letter(template, { settings: { nameColor: '#7c3aed', jobTitleColor: '#0d9488' } }));
      assert.equal((await drawState(bytes, 'Pat Sample'))[0].fill, '#7c3aed', `${template}: name`);
      assert.equal((await drawState(bytes, 'Staff Engineer'))[0].fill, '#0d9488', `${template}: title`);
      // The signature is the letter's text, not its letterhead: in the Text colour, as before.
      assert.equal((await drawState(bytes, 'Pat Sample')).at(-1).fill, '#111111', `${template}: signature`);
    }
  });
});

describe('a centred résumé header centres the letterhead (FIDB-51)', () => {
  /** The centre of each contact line: its text and the icons drawn beside it. */
  const lineCentres = (items, paths) => {
    const lines = new Map();
    for (const t of items) lines.set(Math.round(t.y), [...(lines.get(Math.round(t.y)) || []), t]);
    return [...lines.values()].map((l) => {
      const { y, h } = l[0];
      const icons = paths.filter((p) => p.paint === 'fill' && p.x1 - p.x0 < 12 && p.y0 < y + h * 0.75 && p.y1 > y - h * 0.25);
      const x0 = Math.min(...l.map((t) => t.x), ...icons.map((p) => p.x0));
      const x1 = Math.max(...l.map((t) => t.x + t.w), ...icons.map((p) => p.x1));
      return (x0 + x1) / 2;
    });
  };

  for (const template of ['classic', 'minimal', 'executive']) {
    it(`${template}: photo above, name, title and each contact line on the page's centre line`, async () => {
      const bytes = await renderCover(letter(template, { settings: { headerAlign: 'center' }, personal: { photo: PNG } }));
      const pages = await read(bytes);
      const mid = pages[0].W / 2;
      const [name, title] = letterheadItems(pages);
      for (const t of [name, title]) assert.ok(near(t.x + t.w / 2, mid, 1), `"${t.str}" centred: ${(t.x + t.w / 2).toFixed(1)} vs ${mid.toFixed(1)}`);
      const top = pages[0].H - 14 * MM;
      const contacts = allItems(pages).filter((t) => t.y > top - 120 && t.y < title.y - 1);
      assert.ok(contacts.length, 'contacts under the title');
      const paths = await painted(bytes);
      for (const c of lineCentres(contacts, paths)) assert.ok(near(c, mid, 1), `a contact line centred at ${c.toFixed(1)}`);
      const [photo] = paths.filter((p) => p.paint === 'image');
      assert.ok(photo.y0 > name.y + name.h * 0.75 && near((photo.x0 + photo.x1) / 2, mid, 1), 'the photo sits above the name, centred');
    });
  }

  // Guard: the letterhead's centring follows letterheadCentered(), as the résumé's header does.
  it('Modern and Sidebar take no alignment: a centre left over from another template changes nothing', async () => {
    for (const template of ['modern', 'sidebar']) {
      const [name] = letterheadItems(await read(await renderCover(letter(template, { settings: { headerAlign: 'center' } }))));
      const [left] = letterheadItems(await read(await renderCover(letter(template))));
      assert.equal(name.x, left.x, template);
    }
  });
});
