// Personal Info → Header Customization → Header spacing → Photo ↔ Text (header_spacing_spec.md). The
// engine had `photoTextGap` since the spec for Classic, Minimal and Executive, but no control set it,
// and Modern (its 12 pt), the Sidebar (10 pt above the name) and the letter (10 beside / 6 above)
// ignored it. Each value moves the text beside (or under) the photo by exactly the change, and the
// photo not at all; unset prints the template's own gap; the letter follows a set value.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, render, renderCover, renderDocx, read, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PERSONAL = { name: 'Jordan Rivera', title: 'Staff Engineer', email: 'jordan@example.com', phone: '+1 555 0100', photo: PHOTO };
/** The templates' own Photo ↔ Text, pt (TEMPLATES' headerGaps.photoTextGap). */
const OWN = { classic: 10, minimal: 10, executive: 10, modern: 12, sidebar: 10, timeline: 10, banner: 10, academic: 10, compact: 10, gridline: 10, registry: 10, bookend: 10, lectern: 10, chronicle: 10, keystone: 10, banded: 10, keel: 10, linen: 10, broadsheet: 10 };
/** Where the text sits against the photo: beside it (x), or under it (y) — the Sidebar column's photo is above the name. */
// Academic's header is centred where it is picked (T8): its photo stands above the text.
const AXIS = { classic: 'x', minimal: 'x', executive: 'x', modern: 'x', sidebar: 'y', timeline: 'x', banner: 'x', academic: 'y', compact: 'x' };
const near = (a, b, at) => assert.ok(Math.abs(a - b) < 0.01, `${at}: ${a} vs ${b}`);

/** Page 1's name, title and first contact: x from the left, y down from the top, pt. */
async function header(bytes) {
  const [page] = await read(bytes);
  const at = (s) => { const t = page.items.find((i) => i.str.includes(s)); return t && { x: t.x, y: page.H - t.y }; };
  return { name: at('Jordan Rivera'), title: at('Staff Engineer'), contact: at('jordan@example.com') };
}
const cv = (template, settings = {}, personal = PERSONAL) => resume({ template, settings, personal });

describe('Photo ↔ Text in the résumé PDF', () => {
  it('pins the templates\' own gaps the row starts from', async () => {
    const { templateGapPt } = await loadModule('/src/constants/headerSpacing.js');
    for (const t of TEMPLATES) assert.equal(templateGapPt(t, 'photoTextGap'), OWN[t], t);
  });

  for (const template of TEMPLATES) {
    const axis = AXIS[template];
    it(`${template}: each value moves the name, the title and the contacts by exactly its change (${axis === 'x' ? 'beside' : 'under'} the photo)`, async () => {
      const unset = await header(await render(cv(template)));
      for (const px of [0, 12, 48]) {
        const set = await header(await render(cv(template, { photoTextGap: px })));
        const delta = px * 0.75 - OWN[template];
        for (const k of ['name', 'title', 'contact']) near(set[k][axis] - unset[k][axis], delta, `${template} ${px}px: ${k} ${axis}`);
      }
    });

    it(`${template}: a stored value out of range is clamped, and one that is not a number prints as unset`, async () => {
      const at = async (v) => (await header(await render(cv(template, { photoTextGap: v })))).name[axis];
      near(await at(100), await at(48), `${template}: 100 → 48`);
      near(await at(-5), await at(0), `${template}: -5 → 0`);
      near(await at('abc'), (await header(await render(cv(template)))).name[axis], `${template}: 'abc' → unset`);
    });

    it(`${template}: with no photo, or the photo hidden, the gap changes nothing`, async () => {
      for (const personal of [{ ...PERSONAL, photo: '' }, { ...PERSONAL, hiddenFields: ['photo'] }]) {
        const unset = await header(await render(cv(template, {}, personal)));
        const set = await header(await render(cv(template, { photoTextGap: 40 }, personal)));
        assert.deepEqual(set, unset, `${template} ${personal.photo ? 'hidden' : 'no photo'}`);
      }
    });
  }

  for (const template of ['classic', 'minimal', 'executive', 'timeline', 'banner', 'academic', 'compact', 'gridline', 'registry', 'bookend', 'lectern', 'chronicle', 'keystone', 'banded', 'keel', 'linen', 'broadsheet']) {
    it(`${template}: a centred header stacks the photo above the text, and the gap moves the text down`, async () => {
      const unset = await header(await render(cv(template, { headerAlign: 'center' })));
      const set = await header(await render(cv(template, { headerAlign: 'center', photoTextGap: 40 })));
      for (const k of ['name', 'contact']) near(set[k].y - unset[k].y, 30 - OWN[template], `${template}: ${k}`);
      near(set.name.x, unset.name.x, `${template}: centred, the name stays on the centre line`);
    });
  }
});

describe('Photo ↔ Text in the cover letter', () => {
  for (const template of TEMPLATES) {
    it(`${template}: the letterhead follows the résumé's set value, else its own 10 pt beside the name`, async () => {
      // Left-aligned (Academic's own header is centred, T8; the centred letterhead is tested below).
      const unset = await header(await renderCover(cv(template, { headerAlign: 'left' })));
      const set = await header(await renderCover(cv(template, { headerAlign: 'left', photoTextGap: 20 })));
      near(set.name.x - unset.name.x, 20 * 0.75 - 10, `${template}: name x`);
      near(set.name.y, unset.name.y, `${template}: name y`);
    });
  }

  it('a centred letterhead: the gap above the name, else its own 6 pt', async () => {
    const unset = await header(await renderCover(cv('classic', { headerAlign: 'center' })));
    const set = await header(await renderCover(cv('classic', { headerAlign: 'center', photoTextGap: 20 })));
    near(set.name.y - unset.name.y, 20 * 0.75 - 6, 'name y');
  });

  it('a letter without the photo ignores the gap', async () => {
    const r = (s) => ({ ...cv('classic', s), coverLetter: { showPhoto: false } });
    assert.deepEqual(await header(await renderCover(r({ photoTextGap: 40 }))), await header(await renderCover(r())));
  });
});

describe('Photo ↔ Text in Word', () => {
  // Word prints the photo now (R2-126): it no longer ignores the gap, it moves the text as the PDF does.
  it('each value moves the text beside the photo (its cell) or under it (the space after it) by exactly its change, on the PDF\'s axis', async () => {
    /** Where Word's text starts against the photo, pt: the photo cell's width, or the space under the photo. */
    const offset = async (t, s) => {
      const { xml } = await renderDocx(cv(t, s));
      const cell = /<w:gridCol w:w="(\d+)"\/>/.exec(xml.split('Jordan Rivera')[0])?.[1];
      const under = /w:after="(\d+)"/.exec(xml.split('</w:p>').find((p) => p.includes('<w:drawing>')))?.[1];
      return cell ? { axis: 'x', pt: Number(cell) / 20 } : { axis: 'y', pt: Number(under) / 20 };
    };
    for (const t of TEMPLATES) {
      const unset = await offset(t, {});
      assert.equal(unset.axis, AXIS[t], `${t}: the photo ${AXIS[t] === 'x' ? 'beside' : 'above'} the text, as in the PDF`);
      for (const px of [0, 12, 48]) near((await offset(t, { photoTextGap: px })).pt - unset.pt, px * 0.75 - OWN[t], `${t} ${px}px`);
    }
  });

  it('with no photo, or the photo hidden, the gap changes nothing', async () => {
    for (const t of TEMPLATES) {
      for (const personal of [{ ...PERSONAL, photo: '' }, { ...PERSONAL, hiddenFields: ['photo'] }]) {
        // A hyperlink's relationship id is random per export.
        const xml = async (s) => (await renderDocx(cv(t, s, personal))).xml.replace(/r:id="[^"]*"/g, '');
        assert.equal(await xml({ photoTextGap: 40 }), await xml(), t);
      }
    }
  });
});

describe('the Photo ↔ Text row (Personal Info → Header Customization → Header spacing)', () => {
  it('is offered first, where a photo prints, starting from the template\'s own', async () => {
    const { headerGapRows } = await loadModule('/src/utils/headerSpacingRows.js');
    for (const t of TEMPLATES) {
      const [r] = headerGapRows(t, {}, PERSONAL);
      assert.deepEqual([r.key, r.label, r.set, r.min, r.max], ['photoTextGap', 'Photo ↔ Text', false, 0, 48], t);
      near(r.valuePx, OWN[t] / 0.75, `${t}: the template's own`);
      const [s] = headerGapRows(t, { photoTextGap: 20 }, PERSONAL);
      assert.deepEqual([s.key, s.valuePx, s.set], ['photoTextGap', 20, true], `${t}: set`);
      assert.equal(headerGapRows(t, { photoTextGap: 100 }, PERSONAL)[0].valuePx, 48, `${t}: clamped`);
      const keys = (personal) => headerGapRows(t, {}, personal).map((row) => row.key);
      assert.ok(!keys({ ...PERSONAL, photo: '' }).includes('photoTextGap'), `${t}: no photo`);
      assert.ok(!keys({ ...PERSONAL, hiddenFields: ['photo'] }).includes('photoTextGap'), `${t}: photo hidden`);
      assert.ok(!keys({ ...PERSONAL, photo: 'data:image/png;base64,AAAA' }).includes('photoTextGap'), `${t}: a photo the PDF cannot draw prints nothing`);
    }
  });

  it('the panel shows it with the template\'s own value, and still says why Name ↔ Title is missing', async () => {
    const { HeaderCustomization } = await loadModule('/src/components/PersonalInfoEditorHeader.jsx');
    const html = (template, personal) => renderToString(createElement(HeaderCustomization, {
      s: {}, set() {}, clear() {}, personal, template, templateLabel: template, open: true, onToggle() {},
    }));
    for (const t of TEMPLATES) {
      const out = html(t, PERSONAL);
      assert.match(out, /data-gap="photoTextGap"/, t);
      assert.match(out, /aria-label="Photo to text spacing \(px\)"/, t);
      assert.match(out, new RegExp(`data-gap="photoTextGap"[\\s\\S]*?value="${Math.round((OWN[t] / 0.75) * 10) / 10}"`), `${t}: the template's own`);
      const noTitle = html(t, { ...PERSONAL, title: '' });
      assert.match(noTitle, /data-gap="photoTextGap"/, `${t}: no title`);
      assert.match(noTitle, /Add a job title to set the space between your name and title/, `${t}: no title`);
    }
  });
});
