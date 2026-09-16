// Header Customization → Name & Title Layout "Inline" reaches the cover letter's letterhead
// (V2FIDB-51-3). A Classic, Minimal or Executive résumé whose header prints "Pat Sample  Staff
// Engineer" on one line was paired with a letter that stacked the title under the name — in the
// PDF and in Word — while its centring, colours and rules followed the résumé (letterheadLook).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderCover, read, allItems, allText, overlaps, loadModule, readDocx, MM } from './harness.mjs';
import { drawing, PNG_2X2 as PNG } from './extractors.mjs';

before(setup);
after(teardown);

const ACCENT = '#e11d48';
const CONTACTS = { email: 'pat@example.com', phone: '+1 555 0100', location: 'Berlin, Germany' };
/** The templates whose header offers Name & Title Layout (hasHeaderControls). */
const STACKED = ['classic', 'minimal', 'executive'];
const POSITIONS = ['right', 'below-name', 'below-all'];
const LONG_TITLE = 'Principal Distinguished Staff Engineer, Platform Infrastructure and Developer Tooling';

const make = (template, { settings, personal, coverLetter } = {}) => resume({
  template,
  settings: { accentColor: ACCENT, ...settings },
  personal: { name: 'Pat Sample', title: 'Staff Engineer', ...CONTACTS, hiddenFields: [], ...personal },
  coverLetter: { body: '<p>Dear Sarah,</p>', date: '2026-01-15', ...coverLetter },
});
const inline = (settings) => ({ headerLayout: 'inline', ...settings });

/**
 * The header's first name and title runs, and where the title sits against the name: `dx` from the
 * name's end to the title, `dy` from the name's baseline down to the title's, `mid` the centre of
 * the line they make.
 */
async function nameLine(bytes) {
  const pages = await read(bytes);
  const items = allItems(pages);
  const name = items.find((t) => t.str.includes('Pat'));
  const title = items.find((t) => t.str.includes('Staff'));
  return { page: pages[0], name, title, dx: title.x - (name.x + name.w), dy: name.y - title.y, mid: (name.x + title.x + title.w) / 2 };
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;
/** A run's font without its per-document subset prefix ("ABCDEF+NotoSans-Medium" → "NotoSans-Medium"). */
const face = (t) => t.font.replace(/^[A-Z]{6}\+/, '');
/** The runs printed past the left or right page margin (18 mm). */
const outside = (page) => page.items.filter((t) => t.x < 18 * MM - 0.5 || t.x + t.w > page.W - 18 * MM + 0.5).map((t) => t.str);

describe('Name & Title Layout "Inline" reaches the letterhead (V2FIDB-51-3)', () => {
  for (const template of STACKED) {
    it(`${template}: the letter prints the title on the name's line exactly as the résumé does — left and centred, every Fields Position, with and without a photo`, async () => {
      for (const headerAlign of ['left', 'center']) {
        const cv = await nameLine(await render(make(template, { settings: inline({ headerAlign }) })));
        assert.ok(cv.dy < 3 && cv.dx > 0, `${headerAlign}: the résumé's header is one line (dy ${cv.dy.toFixed(1)}, dx ${cv.dx.toFixed(1)})`);
        for (const fieldsPosition of POSITIONS) {
          for (const photo of [PNG, '']) {
            const at = `${headerAlign}, ${fieldsPosition}, ${photo ? 'photo' : 'no photo'}`;
            const cl = await nameLine(await renderCover(make(template, { settings: inline({ headerAlign }), personal: { photo }, coverLetter: { fieldsPosition } })));
            assert.ok(near(cl.dy, cv.dy, 0.05) && near(cl.dx, cv.dx, 0.05),
              `${at}: the title ${cl.dx.toFixed(2)} pt after the name, ${cl.dy.toFixed(2)} pt below its baseline — the résumé's ${cv.dx.toFixed(2)}, ${cv.dy.toFixed(2)}`);
            assert.equal(face(cl.title), face(cv.title), `${at}: the title's weight`);
            if (headerAlign === 'center') assert.ok(near(cl.mid, cl.page.W / 2, 0.5), `${at}: the line centred at ${cl.mid.toFixed(1)}`);
            else assert.ok(near(cl.name.x, 18 * MM, 0.6) || photo, `${at}: the name at the margin`);
            assert.deepEqual(overlaps(cl.page), [], `${at}: overlapping text`);
            assert.deepEqual(outside(cl.page), [], `${at}: text past the margins`);
          }
        }
      }
    });
  }

  it('Name & Title Spacing moves the letter\'s title exactly as it moves the résumé\'s', async () => {
    for (const template of STACKED) {
      const dx = {};
      for (const headerInlineGap of [2, 16, 24, 48]) {
        const settings = inline({ headerInlineGap });
        const cv = await nameLine(await render(make(template, { settings })));
        const cl = await nameLine(await renderCover(make(template, { settings })));
        assert.ok(near(cl.dx, cv.dx, 0.05), `${template} ${headerInlineGap} px: the letter's ${cl.dx.toFixed(2)} pt, the résumé's ${cv.dx.toFixed(2)}`);
        dx[headerInlineGap] = cl.dx;
      }
      assert.ok(near(dx[24] - dx[16], 6, 0.02), `${template}: 8 px more moves the title ${(dx[24] - dx[16]).toFixed(2)} pt, want 6`);
    }
  });

  it('a long title wraps inside the letterhead\'s room beside the name, never over the contacts or past the margin', async () => {
    for (const template of STACKED) {
      for (const fieldsPosition of POSITIONS) {
        for (const photo of [PNG, '']) {
          const at = `${template}, ${fieldsPosition}, ${photo ? 'photo' : 'no photo'}`;
          const bytes = await renderCover(make(template, { settings: inline(), personal: { photo, title: LONG_TITLE }, coverLetter: { fieldsPosition } }))
            .catch((e) => assert.fail(`${at}: ${e.message}`));
          const [page] = await read(bytes);
          assert.ok(allText([page]).replace(/\s+/g, '').includes(LONG_TITLE.replace(/\s+/g, '')), `${at}: the whole title prints`);
          assert.deepEqual(overlaps(page), [], `${at}: overlapping text`);
          assert.deepEqual(outside(page), [], `${at}: text past the margins`);
        }
      }
    }
  });

  it('a stored spacing outside its range prints at the range\'s end; one that is not a number prints 8 px — and the letter always prints', async () => {
    const page = async (template, headerInlineGap) => drawing(await renderCover(make(template, { settings: inline({ headerInlineGap }) })));
    for (const template of STACKED) {
      assert.equal(await page(template, 1000), await page(template, 48), `${template}: 1000 px prints as 48`);
      assert.equal(await page(template, -5), await page(template, 2), `${template}: -5 px prints as 2`);
      const own = await page(template, 8);
      assert.notEqual(await page(template, 48), own, `${template}: 48 px is not 8`);
      for (const junk of ['abc', {}, null]) assert.equal(await page(template, junk), own, `${template}: ${JSON.stringify(junk)} prints as 8 px`);
    }
  });

  // Guard: Stack prints the letterhead every letter printed; Modern's banner and the Sidebar's
  // column take no Name & Title Layout (Header Customization hides it), so neither does their letter.
  it('Stack, an unset or unknown layout, and Modern and Sidebar letters keep the stacked letterhead', async () => {
    const page = async (template, settings) => drawing(await renderCover(make(template, { settings })));
    for (const template of [...STACKED, 'modern', 'sidebar']) {
      const stack = await page(template, { headerLayout: 'stack' });
      for (const headerLayout of [undefined, 'Inline', 'row']) assert.equal(await page(template, { headerLayout }), stack, `${template}: ${headerLayout}`);
      const offered = STACKED.includes(template);
      assert.equal(await page(template, inline()) !== stack, offered, `${template}: Inline ${offered ? 'changes' : 'does not change'} the letter`);
    }
  });
});

describe('Word\'s letterhead follows Name & Title Layout "Inline" too (V2FIDB-51-3)', () => {
  const coverDocx = async (r) => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    return readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
  };
  /** The colour of the run that prints `text`. */
  const colourOf = (xml, text) => (xml.split('</w:r>').find((run) => run.includes(`>${text}<`)) || '').match(/<w:color w:val="([0-9a-fA-F]{6})"/)?.[1]?.toLowerCase();
  /** The character spacing (twips) of the run between the name and the title. */
  const gapOf = (xml) => Number(/<w:spacing w:val="(-?\d+)"\/>(?:(?!<\/w:r>).)*<w:t xml:space="preserve"> <\/w:t>/s.exec(xml)?.[1]);

  it('Classic, Minimal and Executive: name and title are one line, in their colours, left or centred, the rule still under the contacts', async () => {
    for (const template of STACKED) {
      for (const headerAlign of ['left', 'center']) {
        const at = `${template}, ${headerAlign}`;
        // Header Bottom Border on: Classic's letter draws the résumé header's rule, and only then.
        const doc = await coverDocx(make(template, { settings: inline({ headerAlign, nameColor: '#7c3aed', jobTitleColor: '#0d9488', showHeaderBorder: true }) }));
        assert.deepEqual(doc.texts.slice(0, 3), ['Pat Sample Staff Engineer', 'pat@example.com  |  +1 555 0100  |  Berlin, Germany', '15 January 2026'], at);
        const [head, contacts] = doc.paragraphs.map((p) => p.xml);
        assert.deepEqual([colourOf(head, 'Pat Sample'), colourOf(head, 'Staff Engineer')], ['7c3aed', '0d9488'], `${at}: colours`);
        assert.equal(/<w:jc w:val="center"\/>/.test(head), headerAlign === 'center', `${at}: alignment`);
        assert.doesNotMatch(head, /<w:bottom /, `${at}: no rule under the name line`);
        assert.match(contacts, /<w:bottom /, `${at}: the rule under the contacts`);
      }
    }
  });

  it('Name & Title Spacing widens the space between them by exactly its step', async () => {
    for (const template of STACKED) {
      const gap = async (headerInlineGap) => gapOf((await coverDocx(make(template, { settings: inline({ headerInlineGap }) }))).paragraphs[0].xml);
      const [lo, hi] = [await gap(16), await gap(24)];
      assert.ok(Number.isFinite(lo), `${template}: a spaced run between name and title`);
      assert.equal(hi - lo, 120, `${template}: 8 px (6 pt) more is 120 twips, got ${hi - lo}`);
      assert.equal(await gap(1000), await gap(48), `${template}: clamped as in the PDF`);
    }
  });

  it('Stack, Modern and Sidebar keep name and title on lines of their own; no title leaves the name alone', async () => {
    for (const template of [...STACKED, 'modern', 'sidebar']) {
      const settings = STACKED.includes(template) ? { headerLayout: 'stack' } : inline();
      assert.deepEqual((await coverDocx(make(template, { settings }))).texts.slice(0, 2), ['Pat Sample', 'Staff Engineer'], template);
    }
    for (const template of STACKED) {
      const doc = await coverDocx(make(template, { settings: inline(), personal: { title: '' } }));
      assert.equal(doc.texts[0], 'Pat Sample', `${template}: no title`);
      assert.doesNotMatch(doc.paragraphs[0].xml, /<w:t xml:space="preserve"> <\/w:t>/, `${template}: no trailing space`);
    }
  });
});

describe('a résumé saved with Inline by an older build (V2FIDB-51-3)', () => {
  it('loads, and its letter prints name and title on one line in the PDF and in Word', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    for (const template of STACKED) {
      // 4bc56fe stored no dataVersion; every résumé since ATS_DEFAULTS carries headerInlineGap: 8.
      const saved = make(template, { settings: inline({ headerInlineGap: 8 }) });
      delete saved.dataVersion;
      const r = normalizeResume({ ...saved, updatedAt: Date.UTC(2026, 7, 20) });
      const cv = await nameLine(await render(r));
      const cl = await nameLine(await renderCover(r));
      assert.ok(near(cl.dy, cv.dy, 0.05) && near(cl.dx, cv.dx, 0.05), `${template}: the letter's line is the résumé's`);
      const doc = readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
      assert.equal(doc.texts[0], 'Pat Sample Staff Engineer', `${template}: Word`);
    }
  });
});
