// The letterhead's name and contacts side by side (Fields Position "Right of Name", the default).
// The name side had a fixed 60 % of the header and the contacts the rest, whatever either held:
// a name word wider than its 60 % printed over the contacts (VM3-0), a contact wider than its 40 %
// ran past the right margin and a 2 Grid e-mail over the phone (VM3-1), and a photo the PDF cannot
// draw still took its room from the title (VM3-7).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, renderCover, read, overlaps, MM } from './harness.mjs';
import { drawing, PNG_2X2 as PNG } from './extractors.mjs';

before(setup);
after(teardown);

const T72 = 'Senior Software Engineer, Platform Infrastructure & Developer Experience';
const EMAIL42 = 'alexandra.johnson-smith@examplecompany.com';
const CONTACTS = { email: 'alexandra.johnson@example.com', phone: '+1 555 0100', location: 'San Francisco, CA', website: 'alexjohnson.dev', linkedin: 'linkedin.com/in/alexj' };
const WEBP = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
/** An icon (11 px = 8.25 pt) and the 2 pt gap before its value: where an icon contact starts. */
const ICON = 8.25 + 2;

/**
 * The letterhead as printed: `contacts` the runs above the body ("Hello") made of the contact
 * values and separators, each widened to the left by its icon when the contacts have icons;
 * `name` the others — the name and title, also a word cut off at the paper's edge.
 */
async function letterhead({ name, title, photo = PNG, settings = {}, personal = {}, coverLetter = {} }) {
  const p = { name, title, photo, ...CONTACTS, ...personal };
  const [page] = await read(await renderCover(resume({ settings, personal: p, coverLetter: { body: '<p>Hello</p>', ...coverLetter } })));
  const body = page.items.find((t) => t.str === 'Hello');
  const head = page.items.filter((t) => t.y > body.y + 5);
  const values = `${Object.keys(CONTACTS).map((k) => p[k]).join(' ')} | •`;
  const isContact = (t) => t.str.split(/\s+/).every((w) => values.includes(w.replace(/-$/, '')));
  const icons = (settings.contactStyle || 'icon') === 'icon';
  return {
    page,
    right: page.W - (settings.marginH ?? 18) * MM,
    values: Object.keys(CONTACTS).map((k) => p[k]).filter(Boolean),
    name: head.filter((t) => !isContact(t)),
    contacts: head.filter(isContact).map((t) => (icons ? { ...t, x: t.x - ICON, w: t.w + ICON } : t)),
  };
}

/** "a" over "b" for each name run that overprints a contact run (icon included). */
const overprints = (h) => overlaps({ items: [...h.name, ...h.contacts] })
  .filter(([a, b]) => h.name.some((t) => t.str === a) !== h.name.some((t) => t.str === b));
const pastMargin = (h) => [...h.name, ...h.contacts].filter((t) => t.x + t.w > h.right + 0.5).map((t) => `${t.str} (to x ${(t.x + t.w).toFixed(1)}, margin ${h.right.toFixed(1)})`);
/**
 * Contacts printed over one another, where each value is a text of its own (not Bar or Bullet on
 * one line): two runs over each other, or one run holding two values — pdf.js reads a value drawn
 * over the next as one run.
 */
const crowded = (h) => [
  ...overlaps({ items: h.contacts }).map(([a, b]) => `${a} over ${b}`),
  ...h.contacts.filter((t) => h.values.filter((v) => t.str.includes(v)).length > 1).map((t) => t.str),
];
/** Runs ending in a hyphen none of the letterhead's texts has: textkit's break inside a glued token. */
const hyphens = (h) => [...h.name, ...h.contacts].filter((t) => t.str.endsWith('-')).map((t) => t.str);

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
            // 2 Grid: the test below (a value wider than a 46 % cell of the whole header still crowds).
            if (headerLayout !== '2grid' && (headerStyle === 'icon' || headerLayout !== 'justify')) assert.deepEqual(crowded(h), [], `${at}: a contact over another`);
            assert.ok(h.contacts.some((t) => t.str.includes(email)), `${at}: the e-mail printed whole`);
          }
        }
      }
    }
  });
});

describe('2 Grid beside the name (VM3-1)', () => {
  // A 2 Grid cell is 46 % of the contacts' column. Beside the name that column held two cells of
  // about 113 pt, and a 29-character e-mail (165 pt) printed over the phone in the next cell. Now
  // the grid is as wide as its widest item needs, or it goes under the name. Still open, in every
  // 2 Grid (the résumé's too): a value wider than 46 % of the whole header — a 42-character e-mail,
  // or 40 mm margins — crowds its neighbour (PdfContactRow's fixed cells, reported separately).
  it('no contact prints over the next, none past the margin', async () => {
    for (const marginH of [18, 30]) {
      for (const photo of [PNG, '']) {
        for (const style of ['icon', 'bullet', 'bar']) {
          const at = `${marginH} mm, ${photo ? 'photo' : 'no photo'}, ${style}`;
          const h = await letterhead({ name: 'Alexandra Johnson', title: 'Senior Software Engineer', photo, settings: { marginH, contactStyle: style }, coverLetter: { headerStyle: style, headerLayout: '2grid' } });
          assert.deepEqual(crowded(h), [], `${at}: a contact over another`);
          assert.deepEqual(overprints(h), [], `${at}: the name over the contacts`);
          assert.deepEqual(pastMargin(h), [], `${at}: past the right margin`);
        }
      }
    }
  });

  it('a grid that fits beside the name stays there (guard)', async () => {
    const h = await letterhead({ name: 'Alexandra Johnson', title: 'Product Designer', personal: { email: 'maria@studio.io' }, coverLetter: { headerLayout: '2grid' } });
    const nameRight = Math.max(...h.name.map((t) => t.x + t.w));
    assert.ok(h.contacts.every((t) => t.x >= nameRight + 12 - 0.5), 'every contact right of the name');
    assert.deepEqual(crowded(h), []);
  });
});

describe('a photo the PDF cannot draw takes no room (VM3-7)', () => {
  // A WebP saved before uploads were converted prints no picture (PdfPhoto), but the name side
  // still lost the photo's 48 pt: the title wrapped earlier than on a letter with no photo.
  it('a letter with an old WebP photo prints exactly as one with no photo', async () => {
    for (const title of [T72, 'Senior Software Engineer']) {
      const page = async (photo) => drawing(await renderCover(resume({
        personal: { name: 'Alexandra Johnson', title, photo, ...CONTACTS }, coverLetter: { body: '<p>Hello</p>' },
      })));
      assert.equal(await page(WEBP), await page(''), title);
    }
  });
});
