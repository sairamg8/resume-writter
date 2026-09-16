// Contact Layout "2 Grid": every value prints in a cell 46 % of the contacts' row wide, with an
// 18 pt column gap between the two columns. The cells were that width whatever a value needed, so
// a value wider than its cell printed over the next cell's (W2a-1): a 42-character e-mail in the
// Classic, Minimal or Executive header, and at 40 mm margins an ordinary 29-character one; on the
// cover letter every layout but Right of Name, whose column is sized to its widest value.
// A value too wide for its cell and the gap beside it now takes the whole row.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderCover, read, overlaps, MM } from './harness.mjs';
import { PNG_2X2 as PNG } from './extractors.mjs';

before(setup);
after(teardown);

const EMAIL29 = 'alexandra.johnson@example.com';
const EMAIL42 = 'alexandra.johnson-smith@examplecompany.com';
const CONTACTS = { email: EMAIL29, phone: '+1 555 0100', location: 'San Francisco, CA', website: 'alexjohnson.dev', linkedin: 'linkedin.com/in/alexj' };
/** The templates whose header prints the contacts (Modern's banner and the Sidebar column have their own). */
const GRID_TEMPLATES = ['classic', 'minimal', 'executive'];

const personalOf = (email, photo) => ({ ...CONTACTS, email, photo, name: 'Alexandra Johnson', title: 'Engineer' });
const valuesOf = (personal) => Object.keys(CONTACTS).map((k) => personal[k]);

/**
 * The contact runs among `items`: every run that is part of a contact value — a bullet is drawn
 * glued to its value, and pdf.js reads a value printed over the next as one run, which is what
 * `crowded` looks for. x and w stay the run's as printed, bullet included.
 */
const contactRuns = (items, values) => items
  .map((t) => ({ ...t, str: t.str.replace(/^•\s*/, '').trim() }))
  .filter((t) => t.str && values.some((v) => v.includes(t.str.replace(/-$/, '')) || t.str.includes(v)));

/**
 * Values printed over one another: two runs over each other, or — pdf.js reads a value drawn
 * over the next as a single run — a run holding several values in less than their own widths.
 * `widths` are those, read from the same résumé printed one value to a line (see valueWidths).
 */
const crowded = (runs, values, widths) => [
  ...overlaps({ items: runs }).map(([a, b]) => `${a} over ${b}`),
  ...runs
    .map((t) => [t, values.filter((v) => t.str.includes(v))])
    .filter(([t, held]) => held.length > 1 && t.w + 0.5 < held.reduce((sum, v) => sum + widths[v], 0))
    .map(([t, held]) => `${t.str} (${t.w.toFixed(1)} pt for ${held.reduce((sum, v) => sum + widths[v], 0).toFixed(1)} pt of values)`),
];

const widthCache = new Map();
/**
 * Each value's width as printed, pt (a bullet before it included): the same résumé with Contact
 * Layout "Single", which gives every value a line of its own, so pdf.js reads each as one run.
 */
function valueWidths({ template = 'classic', style = 'icon', email = EMAIL29 }) {
  const key = `${template} ${style} ${email}`;
  if (!widthCache.has(key)) {
    widthCache.set(key, (async () => {
      const personal = personalOf(email, '');
      const settings = { contactLayout: 'single', contactStyle: style };
      const [page] = await read(await render(resume({ template, settings, personal })));
      const values = valuesOf(personal);
      const runs = contactRuns(page.items, values);
      return Object.fromEntries(values.map((v) => [v, runs.find((t) => t.str.includes(v)).w]));
    })());
  }
  return widthCache.get(key);
}

const pastMargin = (runs, right) => runs
  .filter((t) => t.x + t.w > right + 0.5)
  .map((t) => `${t.str} (to x ${(t.x + t.w).toFixed(1)}, margin ${right.toFixed(1)})`);

/** Every value printed whole: missing ones, as read back (a wrapped value joins with a space). */
const missing = (page, values) => values.filter((v) => !page.text.replace(/\s+/g, ' ').includes(v));

/** A résumé header's contacts: the runs, the values, the right margin. */
async function header({ template = 'classic', style = 'icon', photo = PNG, marginH = 18, email = EMAIL29, headerAlign }) {
  const personal = personalOf(email, photo);
  const settings = { contactLayout: '2grid', contactStyle: style, marginH, ...(headerAlign ? { headerAlign } : {}) };
  const [page] = await read(await render(resume({ template, settings, personal })));
  const values = valuesOf(personal);
  const widths = await valueWidths({ template, style, email });
  return { page, values, widths, runs: contactRuns(page.items, values), right: page.W - marginH * MM };
}

/** A letterhead's contacts: the runs above the letter's body. */
async function letterhead({ style = 'icon', fieldsPosition = 'below-name', photo = PNG, marginH = 18, email = EMAIL29, headerAlign }) {
  const personal = personalOf(email, photo);
  const settings = { contactStyle: style, marginH, ...(headerAlign ? { headerAlign } : {}) };
  const coverLetter = { body: '<p>Hello</p>', fieldsPosition, headerStyle: style, headerLayout: '2grid' };
  const [page] = await read(await renderCover(resume({ settings, personal, coverLetter })));
  const body = page.items.find((t) => t.str === 'Hello');
  const values = valuesOf(personal);
  const widths = await valueWidths({ style, email });
  return { page, values, widths, runs: contactRuns(page.items.filter((t) => t.y > body.y + 5), values), right: page.W - marginH * MM };
}

describe('2 Grid: a value wider than its cell (W2a-1)', () => {
  it('no value prints over the next in the Classic header, in every style, margin and e-mail', async () => {
    for (const style of ['icon', 'bullet', 'bar']) {
      for (const photo of [PNG, '']) {
        for (const [marginH, email] of [[18, EMAIL42], [40, EMAIL29], [18, EMAIL29]]) {
          const at = `${style}, ${photo ? 'photo' : 'no photo'}, ${marginH} mm, ${email.length}-character e-mail`;
          const h = await header({ style, photo, marginH, email });
          assert.deepEqual(crowded(h.runs, h.values, h.widths), [], `${at}: a value over another`);
          assert.deepEqual(pastMargin(h.runs, h.right), [], `${at}: past the right margin`);
          assert.deepEqual(missing(h.page, h.values), [], `${at}: a value not printed whole`);
        }
      }
    }
  });

  it('nor in the Minimal and Executive headers, or a centred one', async () => {
    for (const template of GRID_TEMPLATES) {
      for (const headerAlign of ['left', 'center']) {
        const at = `${template}, ${headerAlign}`;
        const h = await header({ template, headerAlign, email: EMAIL42 });
        assert.deepEqual(crowded(h.runs, h.values, h.widths), [], `${at}: a value over another`);
        assert.deepEqual(pastMargin(h.runs, h.right), [], `${at}: past the right margin`);
        assert.deepEqual(missing(h.page, h.values), [], `${at}: a value not printed whole`);
      }
    }
  });

  it('nor on the cover letter, in every Fields Position', async () => {
    for (const fieldsPosition of ['below-name', 'below-all', 'right']) {
      for (const photo of [PNG, '']) {
        for (const [marginH, email] of [[18, EMAIL42], [40, EMAIL29]]) {
          const at = `${fieldsPosition}, ${photo ? 'photo' : 'no photo'}, ${marginH} mm, ${email.length}-character e-mail`;
          const h = await letterhead({ fieldsPosition, photo, marginH, email });
          assert.deepEqual(crowded(h.runs, h.values, h.widths), [], `${at}: a value over another`);
          assert.deepEqual(pastMargin(h.runs, h.right), [], `${at}: past the right margin`);
          assert.deepEqual(missing(h.page, h.values), [], `${at}: a value not printed whole`);
        }
      }
    }
  });

  it('nor under a centred letterhead', async () => {
    const h = await letterhead({ headerAlign: 'center', email: EMAIL42 });
    assert.deepEqual(crowded(h.runs, h.values, h.widths), []);
    assert.deepEqual(pastMargin(h.runs, h.right), []);
    assert.deepEqual(missing(h.page, h.values), []);
  });
});

describe('2 Grid: the grid itself is unchanged (guard)', () => {
  // A value a little wider than its cell spills into the 18 pt column gap, where nothing sits:
  // that is how a 29-character e-mail beside a photo has always printed, and it stays put — the
  // phone keeps its cell, on the same line, at the same x.
  it('a value that spills into the column gap keeps its neighbour beside it', async () => {
    const printed = async (email) => {
      // Bullet, so that each run starts where its cell does (an icon is drawn, not read back).
      const h = await header({ style: 'bullet', email });
      const [value, phone] = [email, CONTACTS.phone].map((v) => h.runs.find((t) => t.str.includes(v)));
      return { value, phone: { x: Number(phone.x.toFixed(2)), y: Number(phone.y.toFixed(2)) } };
    };
    const spills = await printed(EMAIL29);
    const short = await printed('me@ex.io');
    const ends = spills.value.x + spills.value.w;
    assert.ok(ends > spills.phone.x - 18, 'the 29-character e-mail spills past its cell');
    assert.ok(ends < spills.phone.x, 'and stops inside the column gap');
    assert.deepEqual(spills.phone, short.phone, 'the phone moved');
  });

  it('two values to a row, the second at 46 % of the row and an 18 pt gap on', async () => {
    const short = 'me@ex.io';
    const h = await header({ style: 'bar', email: short });
    const [email, phone] = [short, CONTACTS.phone].map((v) => h.runs.find((t) => t.str.includes(v)));
    const row = h.right - email.x;                        // the contacts' row: from the first cell to the margin
    assert.ok(Math.abs(phone.y - email.y) < 1, 'the phone shares the line with the e-mail');
    assert.ok(Math.abs(phone.x - (email.x + 0.46 * row + 18)) < 0.5, `the phone's cell at ${(phone.x - email.x).toFixed(1)} pt, not ${(0.46 * row + 18).toFixed(1)}`);
  });
});
