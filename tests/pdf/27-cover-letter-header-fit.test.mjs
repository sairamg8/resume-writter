// The letterhead's name and contacts side by side (Fields Position "Right of Name", the default).
// The name side had a fixed 60 % of the header and the contacts the rest, whatever either held:
// a name word wider than its 60 % printed over the contacts (VM3-0), a contact wider than its 40 %
// ran past the right margin and a 2 Grid e-mail over the phone (VM3-1), and a photo the PDF cannot
// draw still took its room from the title (VM3-7). With no contacts the name side had no bound.
// The 2 Grid beside the name (VM3-1, VM3-2, W2a-4.1-NB2): 27-cover-letter-grid-fit.test.mjs.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, renderCover, read, MM, TEMPLATES } from './harness.mjs';
import { drawing } from './extractors.mjs';
import { CONTACTS, letterhead, overprints, pastMargin, hyphens, crowded, PNG } from './letterhead-runs.mjs';

before(setup);
after(teardown);

const T72 = 'Senior Software Engineer, Platform Infrastructure & Developer Experience';
const EMAIL42 = 'alexandra.johnson-smith@examplecompany.com';
const WEBP = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';

describe('a long name word beside the contacts (VM3-0)', () => {
  // Default settings and a photo: "Venkataramanasubramaniam" ran from x 99 to 380 over the
  // e-mail and phone; a 35-letter surname over the website. The name side kept its 60 % and the
  // word, which textkit cannot break, ran out of it. Now a word the name side cannot hold beside
  // the contacts' widest item moves the contacts under the name (as Below Name prints them).
  const NAMES = [
    // [name, Full Name size (base 11 + delta)] — each name's longest word fits the header
    ['Venkataramanasubramaniam Iyer', 19], ['Somchai Chaiyawatthanaphong', 19], ['Hubert Wolfeschlegelsteinhausenbergerdorff', 19],
    ['Venkataramanasubramaniam Iyer', 28], ['Somchai Chaiyawatthanaphong', 28], ['Somchai Chaiyawatthanaphong', 36],
  ];

  it('the name never overprints the contacts, stays whole, and nothing runs past the margin', async () => {
    for (const [name, size] of NAMES) {
      for (const photo of [PNG, '']) {
        for (const contactStyle of ['icon', 'bar']) {
          const at = `${name} at ${size} pt, ${photo ? 'photo' : 'no photo'}, ${contactStyle}`;
          const h = await letterhead({ name, title: 'Engineer', photo, settings: { contactStyle, fontSizeNameDelta: size - 11 } });
          assert.deepEqual(overprints(h), [], `${at}: the name over the contacts`);
          assert.deepEqual(pastMargin(h), [], `${at}: past the right margin`);
          assert.deepEqual(hyphens(h), [], `${at}: a drawn hyphen`);
          for (const word of name.split(' ')) assert.ok(h.name.some((t) => t.str.includes(word)), `${at}: "${word}" printed whole`);
          assert.ok(h.contacts.some((t) => t.str.includes(CONTACTS.email)), `${at}: the e-mail printed whole`);
        }
      }
    }
  });

  it('a word wider than the whole header still never overprints the contacts', async () => {
    // A 35-letter surname at 28 and 36 pt is wider than the header: react-pdf cuts it at the
    // paper's edge in every header (reported separately). The contacts still keep clear of it.
    for (const size of [28, 36]) {
      const h = await letterhead({ name: 'Hubert Wolfeschlegelsteinhausenbergerdorff', title: 'Engineer', settings: { fontSizeNameDelta: size - 11 } });
      assert.deepEqual(overprints(h), [], `${size} pt`);
    }
  });

  it('a name that fits keeps the contacts on its right, level with it (guard)', async () => {
    for (const name of ['Alexandra Johnson', 'Maximilian Oberhollenzer']) {
      const h = await letterhead({ name, title: 'Senior Software Engineer' });
      const nameRight = Math.max(...h.name.map((t) => t.x + t.w));
      assert.ok(h.contacts.every((t) => t.x >= nameRight + 12 - 0.5), `${name}: every contact right of the name, past the 12 pt gap`);
      assert.ok(Math.max(...h.contacts.map((t) => t.y)) >= Math.max(...h.name.map((t) => t.y)), `${name}: the contacts start level with the name`);
    }
  });
});

describe('a long contact beside a long title (VM3-1)', () => {
  // With a long title filling its 60 %, the contacts' 40 % (185 pt at 18 mm margins) could not
  // hold a 42-character e-mail: it ended at x 558.7 with a photo, 580.9 without, against a margin
  // at 544.3; at 40 mm margins even a 29-character e-mail ran 6 pt past. The name side now gets
  // what the contacts' widest item leaves, so the title wraps there instead.
  it('every contact fits inside the margin: 18, 30 and 40 mm, every contact style and layout', async () => {
    const formats = [['icon', 'justify'], ['icon', 'single'], ['icon', '2grid'], ['bar', 'justify'], ['bullet', 'justify'], ['bullet', 'single']];
    for (const marginH of [18, 30, 40]) {
      for (const photo of [PNG, '']) {
        for (const [headerStyle, headerLayout] of formats) {
          for (const email of [EMAIL42, CONTACTS.email]) {
            const at = `${marginH} mm, ${photo ? 'photo' : 'no photo'}, ${headerStyle} ${headerLayout}, ${email}`;
            const h = await letterhead({
              name: 'Alexandra Johnson', title: T72, photo, settings: { marginH, contactStyle: headerStyle }, personal: { email }, coverLetter: { headerStyle, headerLayout },
            });
            assert.deepEqual(pastMargin(h), [], `${at}: past the right margin`);
            assert.deepEqual(overprints(h), [], `${at}: the title over the contacts`);
            assert.deepEqual(hyphens(h), [], `${at}: a drawn hyphen`);
            // Bar and Bullet, Justify: the values print as one line of text, one run of several.
            if (headerStyle === 'icon' || headerLayout !== 'justify') assert.deepEqual(crowded(h), [], `${at}: a contact over another`);
            assert.ok(h.contacts.some((t) => t.str.includes(email)), `${at}: the e-mail printed whole`);
          }
        }
      }
    }
  });
});

describe('a photo the PDF cannot draw takes no room (VM3-7)', () => {
  // A WebP saved before uploads were converted prints no picture (PdfPhoto), but the name side
  // still lost the photo's 48 pt: the title wrapped earlier than on a letter with no photo.
  // Nothing here decodes a WebP, so none is converted (R7-7): this is the guard for a photo no
  // copy can be made of, which still prints nothing.
  it('a letter with an old WebP photo prints exactly as one with no photo', async () => {
    for (const title of [T72, 'Senior Software Engineer']) {
      const page = async (photo) => drawing(await renderCover(resume({
        personal: { name: 'Alexandra Johnson', title, photo, ...CONTACTS }, coverLetter: { body: '<p>Hello</p>' },
      })));
      assert.equal(await page(WEBP), await page(''), title);
    }
  });
});

describe('a letter with no contacts (found with VM3-1)', () => {
  // With no contact to show, the name block beside the photo had no cap at all: react-pdf laid
  // the title out at the header's full width, so beside a photo a long title ran past the right
  // margin by the photo's width (x 585.9 against 544.3 at 18 mm; a 72-character one at 30 mm).
  const NONE = { email: '', phone: '', location: '', website: '', linkedin: '' };
  const T123 = `${T72}: Payments, Risk and Fraud Detection Platform Group`;

  it('a long title wraps beside the photo, inside the margin, in every look', async () => {
    for (const template of TEMPLATES) {
      for (const [title, marginH] of [[T123, 18], [T72, 30]]) {
        for (const photo of [PNG, '']) {
          const at = `${template}, ${title.length} characters, ${marginH} mm, ${photo ? 'photo' : 'no photo'}`;
          const r = resume({ template, settings: { marginH }, personal: { name: 'Alexandra Johnson', title, photo, ...NONE }, coverLetter: { body: '<p>Hello</p>' } });
          const [page] = await read(await renderCover(r));
          const right = page.W - marginH * MM;
          assert.deepEqual(page.items.filter((t) => t.x + t.w > right + 0.5).map((t) => t.str), [], `${at}: past the margin`);
          assert.ok(page.text.replace(/\s+/g, '').includes(title.replace(/\s+/g, '')), `${at}: the whole title`);
        }
      }
    }
  });

  it('a title that fits keeps its one line (guard)', async () => {
    const r = resume({ personal: { name: 'Alexandra Johnson', title: T72, photo: PNG, ...NONE }, coverLetter: { body: '<p>Hello</p>' } });
    const [page] = await read(await renderCover(r));
    assert.ok(page.items.some((t) => t.str === T72), 'one line');
  });
});
