// The letterhead's name and contacts side by side (Fields Position "Right of Name", the default).
// The name side had a fixed 60 % of the header and the contacts the rest, whatever either held:
// a name word wider than its 60 % printed over the contacts (VM3-0), a contact wider than its 40 %
// ran past the right margin and a 2 Grid e-mail over the phone (VM3-1), and a photo the PDF cannot
// draw still took its room from the title (VM3-7). With no contacts the name side had no bound.
// A 2 Grid asked 2.2 times its widest item, and wrapped a title beside two short contacts (VM3-2).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, renderCover, read, overlaps, MM, TEMPLATES } from './harness.mjs';
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
async function letterhead({ name, title, photo = PNG, settings = {}, personal = {}, coverLetter = {}, template }) {
  const p = { name, title, photo, ...CONTACTS, ...personal };
  const [page] = await read(await renderCover(resume({ template, settings, personal: p, coverLetter: { body: '<p>Hello</p>', ...coverLetter } })));
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
            // Bar and Bullet, Justify: the values print as one line of text, one run of several.
            if (headerStyle === 'icon' || headerLayout !== 'justify') assert.deepEqual(crowded(h), [], `${at}: a contact over another`);
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
  // the grid is as wide as its widest item needs, or it goes under the name — where a value wider
  // than its cell takes the whole row (28-contact-grid, W2a-1).
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

describe('a title beside contacts that need little room (VM3-2)', () => {
  // 089d03c gave the name side a fixed 60 %: a 49-character title beside one short e-mail wrapped
  // though it had fitted (x 109-363.7 at 01e9118). dcec50d sized the split to the contacts'
  // widest item, but a 2 Grid asked 2.2 times it (a cell is 46 % of the row) — also where the
  // grid, folded to one column, fits beside the title on its line, as it printed before 089d03c.
  // Beside two short contacts the title wrapped, and at 30 mm with a large photo even the name.
  const T24 = 'Senior Software Engineer';
  const T49 = 'Senior Software Engineer, Platform Infrastructure';
  const T57 = 'Principal Engineer, Payments Platform and Developer Tools';
  const NONE = { email: '', phone: '', location: '', website: '', linkedin: '' };
  const TWO = { ...NONE, email: 'maria@studio.io', phone: '+1 555 0100' };
  const WEB = { ...NONE, website: 'alexjohnson.dev', linkedin: 'linkedin.com/in/alexj' };
  const LOC = { ...TWO, location: 'San Francisco, CA' };
  /** Modern's band pads its content 18 pt (24 px) on each side. */
  const inner = (h, template) => h.right - (template === 'modern' ? 18 : 0);
  const pastEdge = (h, template) => [...h.name, ...h.contacts].filter((t) => t.x + t.w > inner(h, template) + 0.5).map((t) => t.str);
  const oneLine = (h, text) => h.name.some((t) => t.str === text);

  it("the finding's title beside one short e-mail keeps its line, in every look (guard)", async () => {
    for (const template of TEMPLATES) {
      const h = await letterhead({ name: 'Alexandra Johnson', title: T49, settings: { photoSize: 'lg' }, personal: { ...NONE, email: 'a@b.co' }, coverLetter: {}, template });
      assert.ok(oneLine(h, T49), `${template}: the title on one line`);
    }
  });

  it('a name and title that fit beside a short 2 Grid keep their lines, the grid beside them', async () => {
    // Each wrapped before: the title, or at 30 mm with a large photo (Modern: 18 mm, medium) the
    // name. Modern's band takes 36 pt of the row, so there a phone — which can wrap, and so
    // needs its whole cell — leaves the title the room only without a photo.
    const FLAT = TEMPLATES.filter((t) => t !== 'modern');
    const cases = [
      [TEMPLATES, 18, '', T57, WEB, 'icon'],
      [FLAT, 18, 'md', T49, TWO, 'icon'], [FLAT, 18, 'md', T49, TWO, 'bullet'], [FLAT, 30, 'lg', T24, TWO, 'icon'],
      [['modern'], 18, '', T49, TWO, 'icon'], [['modern'], 18, 'md', T24, WEB, 'icon'],
    ];
    for (const [looks, marginH, photoSize, title, personal, style] of cases) {
      for (const template of looks) {
        const at = `${template}, ${marginH} mm, ${photoSize || 'no'} photo, ${title.length} characters, ${Object.keys(personal).filter((k) => personal[k]).join('+')}, ${style}`;
        const h = await letterhead({
          template, name: 'Alexandra Johnson', title, photo: photoSize ? PNG : '', personal,
          settings: { marginH, ...(photoSize ? { photoSize } : {}), contactStyle: style }, coverLetter: { headerStyle: style, headerLayout: '2grid' },
        });
        assert.ok(oneLine(h, 'Alexandra Johnson'), `${at}: the name on one line`);
        assert.ok(oneLine(h, title), `${at}: the title on one line`);
        const nameRight = Math.max(...h.name.map((t) => t.x + t.w));
        assert.ok(h.contacts.every((t) => t.x >= nameRight + 12 - 0.5), `${at}: every contact right of the title`);
        assert.deepEqual(crowded(h), [], `${at}: a contact over another`);
        assert.deepEqual(pastEdge(h, template), [], `${at}: past the margin`);
      }
    }
  });

  it('a 2 Grid with room for its cells beside the title keeps its two columns (guard)', async () => {
    // It folds only where its cells would wrap the name or the title.
    for (const template of TEMPLATES) {
      const h = await letterhead({ template, name: 'Alexandra Johnson', title: T24, photo: '', personal: TWO, coverLetter: { headerLayout: '2grid' } });
      const [email, phone] = ['maria@studio.io', '+1 555 0100'].map((v) => h.contacts.find((t) => t.str.includes(v)));
      assert.ok(oneLine(h, T24), `${template}: the title on one line`);
      assert.ok(Math.abs(email.y - phone.y) < 0.5 && phone.x > email.x + email.w, `${template}: the phone beside the e-mail`);
    }
  });

  it('a 2 Grid folded beside a title on its line prints every value whole, clear of the others, inside the margin (guard)', async () => {
    for (const template of ['classic', 'modern']) {
      for (const marginH of [18, 30]) {
        for (const photo of [PNG, '']) {
          for (const [set, personal] of Object.entries({ TWO, WEB, LOC })) {
            for (const title of [T49, T57]) {
              for (const style of ['icon', 'bullet']) {
                const at = `${template}, ${marginH} mm, ${photo ? 'photo' : 'no photo'}, ${set}, ${title.length} characters, ${style}`;
                const h = await letterhead({
                  template, name: 'Alexandra Johnson', title, photo, personal,
                  settings: { marginH, photoSize: 'lg', contactStyle: style }, coverLetter: { headerStyle: style, headerLayout: '2grid' },
                });
                assert.deepEqual(crowded(h), [], `${at}: a contact over another`);
                assert.deepEqual(overprints(h), [], `${at}: the title over the contacts`);
                assert.deepEqual(pastEdge(h, template), [], `${at}: past the margin`);
                assert.deepEqual(hyphens(h), [], `${at}: a drawn hyphen`);
                for (const v of h.values) assert.ok(h.contacts.some((t) => t.str.includes(v)), `${at}: "${v}" whole on its line`);
              }
            }
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
