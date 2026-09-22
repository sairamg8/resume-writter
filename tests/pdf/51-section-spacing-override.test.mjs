// Section ⋯ → Customize layout → Spacing Override (Before, After, Item gap) offers 0–80 px, but a
// stored value was printed as it came (MISSED A1/A2, bug audit 2026-09-22): Before -500 pulled
// Experience over the header and pushed Skills off page 1, an Item gap of -30 printed an entry's
// title above the previous entry's sub-line, and 'abc' made the panel log a React error. The PDF
// now reads each override clamped into the inputs' range (sectionOverridePx), and the panel stores
// and shows it that way.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, section, experience, render, read, allItems, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

/** Every printed run with its page and baseline — two PDFs that print alike give the same list. */
const layout = (pages) => allItems(pages).map((t) => `${t.page}:${t.str}@${t.y.toFixed(1)}`);

function withOverride(template, key, value) {
  const settings = value === undefined ? {} : { [key]: value };
  return resume({ template, sections: [
    experience([{ description: '<ul><li>Built the thing</li></ul>' }, { description: '<ul><li>Ran the thing</li></ul>' }], settings),
    section('skills', [{ category: 'Languages', skills: 'Go, Rust' }]),
  ] });
}

const printed = async (template, key, value) => layout(await read(await render(withOverride(template, key, value))));

describe('Spacing Override values outside 0–80 px print as the nearest end of the range', () => {
  it('sectionOverridePx: clamps numbers, reads numeric text, and is none for anything else', async () => {
    const { sectionOverridePx } = await loadModule('/src/constants/spacingNumbers.js');
    assert.deepEqual([-500, -30, 0, 12, 80, 9999, '24', ' 8 '].map(sectionOverridePx), [0, 0, 0, 12, 80, 80, 24, 8]);
    for (const v of ['abc', '', null, undefined, true, {}, NaN, Infinity]) assert.equal(sectionOverridePx(v), undefined, String(v));
  });

  for (const template of TEMPLATES) {
    it(`${template}: Before -500 prints as 0, 9999 as 80, 'abc' as none`, async () => {
      assert.deepEqual(await printed(template, 'spaceBefore', -500), await printed(template, 'spaceBefore', 0));
      assert.deepEqual(await printed(template, 'spaceBefore', 9999), await printed(template, 'spaceBefore', 80));
      assert.deepEqual(await printed(template, 'spaceBefore', 'abc'), await printed(template, 'spaceBefore', undefined));
    });

    it(`${template}: an Item gap of -30 prints as 0 — no entry over the one before it`, async () => {
      assert.deepEqual(await printed(template, 'itemGap', -30), await printed(template, 'itemGap', 0));
      assert.deepEqual(await printed(template, 'spaceAfter', -200), await printed(template, 'spaceAfter', 0));
    });
  }

  it('the panel shows a stored override as it prints — and "abc" as none, without an error', async () => {
    const { SectionCustomizer } = await loadModule('/src/components/SectionEditorCustomizer.jsx');
    const html = (settings) => renderToString(createElement(SectionCustomizer, {
      section: { id: 's', type: 'experience', settings }, template: 'classic', updateSectionSettings: () => {},
    }));
    const values = (settings) => [...html(settings).matchAll(/type="number"[^>]*?value="([^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(values({ spaceBefore: -500, spaceAfter: 9999, itemGap: 'abc' }), ['0', '80', '']);
  });
});
