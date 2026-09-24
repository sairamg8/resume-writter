// R2-105: a project URL of 33–48 characters in a 2-column Projects grid ran out of its card, over the
// card beside it. The registered break callback (breakLongWords) marks only tokens past 48
// characters, and a half-width card is narrower than a shorter URL. Now a grid card's link may break
// after / . - _ @ … (at a break mark, so it reads as typed wherever it sits on one line, R4-10) when
// it does not fit its line. The Sidebar's main-column card, and the other templates' Projects and
// Certifications grids.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allItems, overlaps } from './harness.mjs';

before(setup);
after(teardown);

const URL43 = 'github.com/jordanrivera/checkout-experience'; // 43 characters: under breakLongWords' 48
const URL46 = 'credentials.example.org/verify/abcdefghijklmn'; // 45

/** The document's text with spaces and line breaks taken out. */
const flat = (pages) => allItems(pages).map((t) => t.str).join('').replace(/\s/g, '');

/** Runs of one grid cell printing past the middle of the page into the other: a run that starts in the left half and ends past its right edge. */
function crossings(page, gutter) {
  return page.items.filter((t) => t.x < gutter.left && t.x + t.w > gutter.right).map((t) => `${t.str} (x ${t.x.toFixed(1)}…${(t.x + t.w).toFixed(1)})`);
}

/** The grid's gutter on `page`: between the right end of the left cells' runs and the left start of the right cells' runs, from `leftWord` and `rightWord`. */
function gutterOf(page, leftWord, rightWord) {
  const l = page.items.find((t) => t.str.includes(leftWord));
  const r = page.items.find((t) => t.str.includes(rightWord));
  assert.ok(l && r, page.items.map((t) => t.str).join(' | '));
  return { left: r.x - 1, right: r.x + 1 };
}

async function assertInCard(r, leftWord, rightWord, urls) {
  const pages = await read(await render(r));
  const gutter = gutterOf(pages[0], leftWord, rightWord);
  assert.deepEqual(crossings(pages[0], gutter), [], 'no run crosses into the card beside it');
  assert.deepEqual(pages.flatMap((p) => overlaps(p)), [], 'no run prints over another');
  const text = flat(pages);
  for (const url of urls) assert.ok(text.includes(url), `${url} reads whole in: ${text}`);
}

const projects = (settings = {}) => section('projects', [
  { name: 'Checkout', technologies: 'React', url: URL43, startDate: '02/2022', endDate: '08/2022' },
  { name: 'Queuebird', technologies: 'Go', url: 'queuebird.dev', startDate: '02/2022', endDate: '08/2022' },
], { columns: 2, ...settings });

describe('a grid card\'s link breaks inside its card (R2-105)', () => {
  it('Sidebar, main column, Projects in 2 columns', async () => {
    await assertInCard(resume({ template: 'sidebar', sections: [projects()] }), 'Checkout', 'Queuebird', [URL43]);
  });

  it('Classic, Projects and Certifications in 2 columns', async () => {
    await assertInCard(resume({ settings: { fontSizeBase: 13 }, sections: [projects(), section('certifications', [
      { name: 'Cloud', issuer: 'AWS', url: URL46, date: '02/2022' },
      { name: 'Kube', issuer: 'CNCF', date: '02/2022' },
    ], { columns: 2 })] }), 'Checkout', 'Queuebird', [URL43, URL46]);
  });

  it('a link that fits its card prints on one line, as typed (unchanged)', async () => {
    const pages = await read(await render(resume({ template: 'sidebar', sections: [projects({ columns: 1 })] })));
    assert.ok(pages[0].items.some((t) => t.str === URL43), pages[0].items.map((t) => t.str).join(' | '));
  });
});
