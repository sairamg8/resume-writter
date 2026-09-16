// A name of one long word — a German or South-Indian surname — has nowhere to break: textkit
// breaks a line at a space, and inside a token only at the marks breakLongWords puts in one
// longer than 48 characters, so a 35-letter surname is one unbreakable piece. react-pdf then
// drew it out of its box: at Full Name 28 pt it ended at x 603 against a right margin of 544.3
// (off the 595.3 pt paper), on the Classic, Modern, Minimal and Executive headers and on the
// cover letter's letterhead alike. In the Sidebar's 38 % column even the default 19 pt ran from
// the column across the main one (x 146 → 502 of a column ending at 216). The name now prints at
// the largest size its widest word fits its row in (fitFontSize) — and a name that fits keeps its
// size. Found by W2a-1 (fix2_W2a-1 new_bugs), task NB-3.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderCover, read, loadModule, MM, TEMPLATES } from './harness.mjs';
import { PNG_2X2 as PNG } from './extractors.mjs';

let BAND_PAD; // Modern's banner padding either side, pt
before(async () => {
  await setup();
  ({ MODERN_HEADER_PAD_X_PT: BAND_PAD } = await loadModule('/src/templates/pdf/shared/pdfUnits.js'));
});
after(teardown);

/** A 35-letter surname, and a 24-letter one: neither can break, both are real names. */
const LONG = 'Hubert Wolfeschlegelsteinhausenbergerdorff';
const WORD = 'Wolfeschlegelsteinhausenbergerdorff';
const INDIAN = 'Venkataramanasubramaniam Iyer';
const CONTACTS = { email: 'alexandra.johnson@example.com', phone: '+1 555 0100', location: 'San Francisco, CA' };

/** The text runs that print outside the page's left and right margins (marginH mm). */
function outside(page, marginH) {
  const left = marginH * MM;
  const right = page.W - left;
  return page.items
    .filter((t) => t.x < left - 0.5 || t.x + t.w > right + 0.5)
    .map((t) => `${t.str} (x ${t.x.toFixed(1)}…${(t.x + t.w).toFixed(1)}, margins ${left.toFixed(1)}…${right.toFixed(1)})`);
}

/** The run holding `word`, or undefined when it was split across runs (or cut). */
const run = (page, word) => page.items.find((t) => t.str.includes(word));

/** A name printed smaller than asked is the LARGEST that holds it: it spans its row to the right edge. */
function fills(item, size, right, at) {
  if (item.h > size - 0.5) return;
  assert.ok(item.x + item.w >= right - 2.5,
    `${at}: shrunk to ${item.h.toFixed(1)} pt but ends at x ${(item.x + item.w).toFixed(1)}, its row at ${right.toFixed(1)}`);
}

const SIZES = [19, 28, 36]; // Design → Font sizes → Full Name (base 11 + delta)

describe('a name word wider than the header (résumé)', () => {
  it('stays whole inside the margins, in every template, at every Full Name size', async () => {
    for (const template of TEMPLATES) {
      for (const size of SIZES) {
        for (const photo of [PNG, '']) {
          const at = `${template}, ${size} pt, ${photo ? 'photo' : 'no photo'}`;
          const r = resume({
            template,
            settings: { fontSizeNameDelta: size - 11 },
            personal: { name: LONG, title: 'Engineer', photo, ...CONTACTS },
          });
          const [page] = await read(await render(r));
          assert.deepEqual(outside(page, 18), [], `${at}: outside the margins`);
          const name = run(page, WORD);
          assert.ok(name, `${at}: the surname printed whole`);
          assert.ok(name.h >= 8, `${at}: the name printed at ${name.h.toFixed(1)} pt, smaller than it needs`);
          const right = template === 'sidebar' ? page.W * 0.38 - 10
            : page.W - 18 * MM - (template === 'modern' ? BAND_PAD : 0);
          assert.ok(name.x + name.w <= right + 0.5, `${at}: the name ends at x ${(name.x + name.w).toFixed(1)}, its row at ${right.toFixed(1)}`);
          fills(name, size, right, at);
        }
      }
    }
  });

  it('a centred or inline header, wide margins and US Letter paper keep it inside too', async () => {
    const cases = [];
    for (const template of ['classic', 'minimal', 'executive']) {
      for (const marginH of [18, 30]) {
        for (const headerLayout of ['stack', 'inline']) {
          for (const headerAlign of ['center', 'left']) cases.push({ template, marginH, headerLayout, headerAlign });
        }
      }
    }
    cases.push({ template: 'classic', marginH: 18, pageSize: 'LETTER' }, { template: 'modern', marginH: 40, pageSize: 'LETTER' });
    for (const { template, marginH, ...settings } of cases) {
      const at = `${template}, ${marginH} mm, ${JSON.stringify(settings)}`;
      const r = resume({
        template,
        settings: { fontSizeNameDelta: 25, marginH, ...settings },
        personal: { name: LONG, title: 'Engineer', photo: PNG, ...CONTACTS },
      });
      const [page] = await read(await render(r));
      assert.deepEqual(outside(page, marginH), [], `${at}: outside the margins`);
      const name = run(page, WORD);
      assert.ok(name, `${at}: the surname printed whole`);
      assert.ok(name.h < 36, `${at}: the name kept 36 pt, wider than its row`);
    }
  });

  it('the Sidebar keeps the name inside its own column, at any margin', async () => {
    // The dark column is 38 % of the paper, less the page margin and its 10 pt right padding. At
    // 40 mm the 35-letter surname needs about 5.4 pt: no floor lets it out over the main column.
    // Before, the 24-letter one at the default 19 pt ran x 111 → 392 over the main column, and
    // even "Johnson-Whitfield" ended at x 220.6, past the column's 216.2.
    const names = [[LONG, WORD], [INDIAN, 'Venkataramanasubramaniam'], ['Alexandra Johnson-Whitfield', 'Johnson-Whitfield']];
    for (const [name, word] of names) {
      for (const size of [19, 28]) {
        for (const marginH of [18, 40]) {
          const at = `${word}, ${size} pt, ${marginH} mm`;
          const r = resume({
            template: 'sidebar',
            settings: { fontSizeNameDelta: size - 11, marginH },
            personal: { name, title: 'Engineer', photo: PNG, ...CONTACTS },
          });
          const [page] = await read(await render(r));
          const column = page.W * 0.38 - 10;
          const item = run(page, word);
          assert.ok(item, `${at}: the surname printed whole`);
          assert.ok(item.x >= marginH * MM - 0.5 && item.x + item.w <= column + 0.5,
            `${at}: the name runs x ${item.x.toFixed(1)}…${(item.x + item.w).toFixed(1)}, column ${(marginH * MM).toFixed(1)}…${column.toFixed(1)}`);
          fills(item, size, column, at);
        }
      }
    }
  });

  it('a name that fits keeps its size (guard)', async () => {
    for (const template of TEMPLATES) {
      // The Sidebar's column holds "Alexandra" up to 28 pt; "Johnson-Whitfield" not even at 19.
      const [name, sizes] = template === 'sidebar' ? ['Alexandra Johnson', [19, 28]] : ['Alexandra Johnson-Whitfield', [19, 28, 36]];
      for (const size of sizes) {
        const r = resume({
          template,
          settings: { fontSizeNameDelta: size - 11 },
          personal: { name, title: 'Engineer', photo: PNG, ...CONTACTS },
        });
        const [page] = await read(await render(r));
        const item = run(page, 'Alexandra');
        assert.ok(item, `${template} ${size} pt: the name printed`);
        assert.ok(Math.abs(item.h - size) < 0.5, `${template} ${size} pt: printed at ${item.h.toFixed(1)} pt`);
      }
    }
  });
});

describe('a name word wider than the letterhead (cover letter)', () => {
  it('stays whole inside the margins, in every look, at every Full Name size', async () => {
    for (const template of TEMPLATES) {
      for (const size of SIZES) {
        for (const fieldsPosition of ['right', 'below-name', 'below-all']) {
          for (const contacts of [CONTACTS, {}]) {
            const at = `${template}, ${size} pt, ${fieldsPosition}, ${contacts.email ? 'contacts' : 'no contacts'}`;
            const r = resume({
              template,
              settings: { fontSizeNameDelta: size - 11 },
              personal: { name: LONG, title: 'Engineer', photo: PNG, email: '', phone: '', location: '', ...contacts },
              coverLetter: { body: '<p>Hello</p>', fieldsPosition },
            });
            const [page] = await read(await renderCover(r));
            assert.deepEqual(outside(page, 18), [], `${at}: outside the margins`);
            const name = run(page, WORD);
            assert.ok(name, `${at}: the surname printed whole`);
            fills(name, size, page.W - 18 * MM - (template === 'modern' ? BAND_PAD : 0), at);
          }
        }
      }
    }
  });

  it('a centred letterhead and wide margins keep it inside too', async () => {
    for (const marginH of [18, 40]) {
      const at = `${marginH} mm`;
      const r = resume({
        settings: { fontSizeNameDelta: 25, marginH, headerAlign: 'center' },
        personal: { name: LONG, title: 'Engineer', photo: PNG, ...CONTACTS },
        coverLetter: { body: '<p>Hello</p>' },
      });
      const [page] = await read(await renderCover(r));
      assert.deepEqual(outside(page, marginH), [], `${at}: outside the margins`);
      const name = run(page, WORD);
      assert.ok(name, `${at}: the surname printed whole`);
      // Centred, the photo sits above the name: the name has the letterhead's whole width.
      assert.ok(name.w >= page.W - 2 * marginH * MM - 2.5, `${at}: ${name.w.toFixed(1)} pt wide, shrunk for a photo beside it`);
    }
  });

  it('a name that fits keeps its size (guard)', async () => {
    for (const template of TEMPLATES) {
      for (const fieldsPosition of ['right', 'below-name', 'below-all']) {
        const r = resume({
          template,
          settings: { fontSizeNameDelta: 17 },
          personal: { name: 'Alexandra Johnson-Whitfield', title: 'Engineer', photo: PNG, ...CONTACTS },
          coverLetter: { body: '<p>Hello</p>', fieldsPosition },
        });
        const [page] = await read(await renderCover(r));
        const item = run(page, 'Alexandra');
        assert.ok(item, `${template} ${fieldsPosition}: the name printed`);
        assert.ok(Math.abs(item.h - 28) < 0.5, `${template} ${fieldsPosition}: printed at ${item.h.toFixed(1)} pt`);
      }
    }
  });
});
