// A section whose entries are all hidden (each entry's eye) or all deleted printed a bare heading in
// the PDF and the preview, while Word, Markdown and ATS text left the section out (R2-057, and its
// duplicates R2-069, R2-127). The PDF now leaves it out too, on every template: a section prints
// only when at least one of its entries does.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, section, render, read, allText, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const text = async (r) => allText(await read(await render(r))).toLowerCase();

describe('a section with no visible entries prints no heading (R2-057)', () => {
  for (const template of TEMPLATES) {
    it(`${template}: all-hidden and empty sections leave no heading; a shown entry still prints`, async () => {
      const r = resume({
        template,
        sections: [
          experience([{ role: 'Quillwright' }]),
          { ...section('awards', [{ title: 'Hidden Prize', visible: false }]), title: 'Zephyr Honours' },
          { ...section('custom', []), title: 'Nimbus Extras' },
          { ...section('skills', [{ category: 'Gone', skills: 'Nothing', visible: false }]), title: 'Obsidian Skills' },
        ],
      });
      const t = await text(r);
      assert.ok(t.includes('quillwright'), 'the shown entry prints');
      for (const title of ['zephyr honours', 'nimbus extras', 'obsidian skills']) {
        assert.ok(!t.includes(title), `${template}: "${title}" heading is left out`);
      }
      r.sections[1].items[0].visible = true;
      assert.ok((await text(r)).includes('zephyr honours'), `${template}: showing the entry brings its heading back`);
    });
  }
});
