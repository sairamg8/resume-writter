// R2-146: Design → Typography → Title Spacing reaches the Sidebar's side-column titles (Contact,
// Languages, Skills …), which kept their own 1.2 pt (capped at 6 % of their 8.5 pt) whatever it said.
// Unset they print as before; set, they take the same % of their size as the main column's titles.
// Word prints its side-column titles at the main titles' size, so their run carries the main titles'
// spacing — none while unset, as before.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allItems, renderDocx } from './harness.mjs';

before(setup);
after(teardown);

const TITLE = /^LANGUAGES$/;
const sidebar = (settings = {}) => resume({
  template: 'sidebar',
  settings,
  sections: [section('languages', [{ language: 'Telugu', proficiency: 'Native' }], {}, { title: 'Languages' })],
});
const titleOf = async (r) => allItems(await read(await render(r))).find((t) => TITLE.test(t.str.trim()));
const runSpacing = (docx) => {
  const p = docx.paragraphs.find((x) => TITLE.test(x.text.trim()));
  assert.ok(p, 'Word prints the Languages title');
  const m = p.xml.match(/<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*?<w:spacing w:val="(-?\d+)"\/>/);
  return m ? Number(m[1]) : null;
};

describe('the Sidebar\'s side-column titles take Title Spacing (R2-146)', () => {
  it('unset prints the column\'s own spacing; each % sets the title\'s letters apart by that % of 8.5 pt', async () => {
    const plain = await titleOf(sidebar());
    assert.ok(plain, 'the side title prints');
    const gaps = 'LANGUAGES'.length - 1;
    const own = Math.min(1.2, 8.5 * 0.06);
    for (const pct of [-4, 0, 3]) {
      const t = await titleOf(sidebar({ sectionLetterSpacing: pct }));
      const want = plain.w + gaps * ((8.5 * pct) / 100 - own);
      assert.ok(Math.abs(t.w - want) < 0.8, `${pct} %: ${t.w.toFixed(2)} pt wide, ${want.toFixed(2)} expected (unset ${plain.w.toFixed(2)})`);
    }
  });

  it('the Contact title over the column\'s contacts follows it too', async () => {
    const contact = async (settings) => allItems(await read(await render(resume({ template: 'sidebar', settings, personal: { email: 'robin@example.com' } }))))
      .find((t) => /^CONTACT$/.test(t.str.trim()));
    const [a, b] = [await contact({}), await contact({ sectionLetterSpacing: -4 })];
    assert.ok(a && b && b.w < a.w - 3, `Contact: ${a?.w} → ${b?.w}`);
  });
});

describe('Word\'s side-column titles carry it too (R2-146)', () => {
  it('none while unset; set, the main titles\' spacing in twips', async () => {
    assert.equal(runSpacing(await renderDocx(sidebar())), null, 'unset: as before');
    assert.equal(runSpacing(await renderDocx(sidebar({ sectionLetterSpacing: 6 }))), Math.round(0.72 * 20));
    assert.equal(runSpacing(await renderDocx(sidebar({ sectionLetterSpacing: -4 }))), Math.round(-0.48 * 20));
  });
});
