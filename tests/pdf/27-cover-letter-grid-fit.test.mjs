// A 2 Grid beside the letterhead's name (Fields Position "Right of Name"). Its cells were 46 % of a
// fixed 40 % column, and a 29-character e-mail printed over the phone (VM3-1); sized to 2.2 times
// its widest item, it wrapped a title beside two short contacts (VM3-2); folded to one column to
// keep them on their lines, or in a row too narrow for two cells and the gap, it printed as Single
// (W2a-4.1-NB2). Split from 27-cover-letter-header-fit.test.mjs.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, TEMPLATES } from './harness.mjs';
import { PNG_2X2 as PNG } from './extractors.mjs';
import { letterhead, overprints, pastMargin, crowded, hyphens } from './letterhead-runs.mjs';

before(setup);
after(teardown);

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
  /** The grid's first two values side by side on one line: two columns, not Single. */
  const twoColumns = (h) => {
    const [a, b] = h.values.map((v) => h.contacts.find((t) => t.str.includes(v)));
    return Math.abs(a.y - b.y) < 0.5 && b.x > a.x + a.w;
  };

  it("the finding's title beside one short e-mail keeps its line, in every look (guard)", async () => {
    for (const template of TEMPLATES) {
      const h = await letterhead({ name: 'Alexandra Johnson', title: T49, settings: { photoSize: 'lg' }, personal: { ...NONE, email: 'a@b.co' }, coverLetter: {}, template });
      assert.ok(oneLine(h, T49), `${template}: the title on one line`);
    }
  });

  it('a name and title that fit beside a short 2 Grid keep their lines, the grid in two columns beside or under them', async () => {
    // Each wrapped before: the title, or at 30 mm with a large photo (Modern: 18 mm, medium) the
    // name. Where the grid's two columns do not fit beside them it goes under the name
    // (W2a-4.1-NB2) — no longer folded to one column beside them.
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
        const titleY = h.name.find((t) => t.str === title).y;
        const beside = h.contacts.every((t) => t.x >= nameRight + 12 - 0.5);
        const under = h.contacts.every((t) => t.y < titleY - 5);
        assert.ok(beside || under, `${at}: every contact right of the title, or every one under it`);
        assert.ok(twoColumns(h), `${at}: two columns`);
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

  it('a 2 Grid beside or under a title on its line prints two columns, every value whole, clear of the others, inside the margin', async () => {
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
                assert.ok(oneLine(h, title), `${at}: the title on one line`);
                assert.ok(twoColumns(h), `${at}: two columns`);
              }
            }
          }
        }
      }
    }
  });
});

describe('Right of Name + 2 Grid prints two columns (W2a-4.1-NB2)', () => {
  // Two 46 % cells and the 18 pt gap need a row of 225 pt, but the grid beside the name was sized
  // to its widest item / 0.46 (198 pt for these two), or folded to one column to keep the title on
  // its line: e-mail over phone, as Single prints them (Modern, 30 mm, large photo: both at x 284.2,
  // y 773.0 and 756.2, and the name wrapped). Two cells that do not fit beside the name go under it.
  const TWO = { email: 'maria@studio.io', phone: '+1 555 0100', location: '', website: '', linkedin: '' };
  it("the finding's letter, in every look: e-mail and phone side by side, the name and title each on one line", async () => {
    for (const template of TEMPLATES) {
      for (const [marginH, photoSize] of [[30, 'lg'], [40, 'lg'], [18, 'md']]) {
        const at = `${template}, ${marginH} mm, ${photoSize} photo`;
        const h = await letterhead({ template, name: 'Maria Garcia', title: 'Senior Software Engineer', personal: TWO, settings: { marginH, photoSize }, coverLetter: { headerLayout: '2grid' } });
        const [email, phone] = ['maria@studio.io', '+1 555 0100'].map((v) => h.contacts.find((t) => t.str.includes(v)));
        assert.ok(Math.abs(email.y - phone.y) < 0.5 && phone.x > email.x + email.w, `${at}: the phone beside the e-mail (e-mail y ${email.y.toFixed(1)}, phone y ${phone.y.toFixed(1)})`);
        assert.ok(h.name.some((t) => t.str === 'Maria Garcia'), `${at}: the name on one line`);
        assert.ok(h.name.some((t) => t.str === 'Senior Software Engineer'), `${at}: the title on one line`);
        assert.deepEqual(pastMargin(h), [], `${at}: past the margin`);
      }
    }
  });
});
