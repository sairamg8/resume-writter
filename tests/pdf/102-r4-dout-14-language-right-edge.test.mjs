// R4-DOUT-14: Languages in the PDF (left-aligned, not Compact). Each cell was 'space-between' with a
// 12 pt right padding, so the right column's proficiency (and every one in a single column) ended 12 pt
// short of the right margin, out of line with the right-aligned dates above it. Now the proficiency
// ends at its cell's edge: flush with the right margin, as a job's date is.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, read, itemsWith } from './harness.mjs';

before(setup);
after(teardown);

const LANGS = [{ language: 'English', proficiency: 'Native' }, { language: 'Spanish', proficiency: 'Fluent' }];

const first = (pages, needle) => {
  const hit = itemsWith(pages, needle)[0];
  assert.ok(hit, `"${needle}" is printed`);
  return hit;
};
const rightEdge = (t) => t.x + t.w;

describe('Languages: the proficiency is flush with the right margin, like the dates (R4-DOUT-14)', () => {
  for (const columns of [2, 1]) {
    it(`Classic, ${columns} column${columns === 1 ? '' : 's'}: the right-hand proficiency ends where a job's date ends`, async () => {
      const pages = await read(await render(resume({
        template: 'classic',
        sections: [
          experience([{ startDate: '01/2020', endDate: '12/2021' }]),
          section('languages', LANGS, { columns }),
        ],
      })));
      const date = rightEdge(first(pages, '2021'));
      const fluent = rightEdge(first(pages, 'Fluent'));
      assert.ok(Math.abs(fluent - date) < 1, `${columns} col: "Fluent" ends at ${fluent.toFixed(1)}, the date at ${date.toFixed(1)}`);
      if (columns === 1) {
        const native = rightEdge(first(pages, 'Native'));
        assert.ok(Math.abs(native - date) < 1, `1 col: "Native" ends at ${native.toFixed(1)}, the date at ${date.toFixed(1)}`);
      } else {
        // The left column's proficiency stays inside its cell, clear of the right column's language.
        assert.ok(rightEdge(first(pages, 'Native')) < first(pages, 'Spanish').x, 'the two columns do not touch');
      }
    });
  }
});
