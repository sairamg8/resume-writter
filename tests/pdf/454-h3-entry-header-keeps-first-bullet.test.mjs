// H3-454: an entry's header is kept with two lines of what follows it (headerKeep), and that held for a
// description whose first bullet is a line or two long. A bullet of three or four lines is kept whole
// (PdfRichText's list items never split, and a paragraph of fewer than four lines cannot either), so when
// the room left under the header was two lines and the bullet needed three or four, the bullet went to the
// next page and the header stayed alone at the foot of this one: 33 of 532 renders in a sweep of every
// template, with bullets of three and four lines. The header now keeps the height of that first block
// (firstChunkKeep), and the section title keeps it too.
// Each case below is a page break the sweep found (and the sweep around it): the last line of a page that
// has another after it is never an entry's header.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, render, read, resume, section, experience, bodyItems } from './harness.mjs';

before(setup);
after(teardown);

const WORDS = 'delivered measurable improvements across the platform while coordinating with several partner teams and documenting every decision for later review';
const text = (chars, i) => `Item ${i} ${WORDS} ${WORDS} ${WORDS}`.slice(0, chars).trim();
const list = (k, chars) => `<ul>${Array.from({ length: k }, (_, i) => `<li>${text(chars, i)}</li>`).join('')}</ul>`;
const PERSON = { name: 'Jordan Rivera', title: 'Engineer', email: 'a@b.co', phone: '+1 555 0100', location: 'Austin', summary: '<p>Short summary.</p>' };
const eduSection = () => section('education', [{ institution: 'University', degree: 'BSc', fieldOfStudy: 'CS', location: 'X', startDate: '2010', endDate: '2014', description: '' }]);

/** The first line of text of every page but the last that ends with an entry's header: the page's lowest line. */
async function orphans(r, header) {
  const pages = await read(await render(r));
  const found = [];
  pages.forEach((p, i) => {
    if (i === pages.length - 1) return;
    const items = bodyItems(p, i);
    if (!items.length) return;
    const lowest = Math.min(...items.map((t) => t.y));
    const last = items.filter((t) => Math.abs(t.y - lowest) < 2).map((t) => t.str).join(' ').trim();
    if (header.test(last)) found.push(`page ${i + 1} ends "${last}"`);
  });
  return found;
}

describe('an entry header never ends a page with its first bullet on the next', () => {
  // [template, characters of a bullet, bullets in the first job]: the sweep's hits, and the counts next to each.
  const HITS = [
    ['classic', 330, [4, 8]], ['modern', 330, [4]], ['modern', 240, [10]], ['minimal', 330, [8]],
    ['sidebar', 240, [4, 7, 13]], ['sidebar', 330, [5, 11, 15]], ['banner', 330, [4]], ['banner', 240, [10]],
    ['academic', 240, [8, 12]], ['academic', 330, [9]], ['gridline', 330, [4]], ['registry', 330, [4]],
    ['bookend', 330, [4]], ['bookend', 240, [10]], ['lectern', 330, [4]], ['chronicle', 330, [4]],
    ['keystone', 330, [4, 8]], ['banded', 330, [4]], ['keel', 240, [7]], ['keel', 330, [8]],
    ['linen', 240, [7]], ['linen', 330, [8]], ['broadsheet', 330, [4]],
    // Templates with a header of their own that the sweep did not catch: the same room around a page break.
    ['timeline', 330, [4, 5, 6, 7, 8, 9]], ['executive', 330, [4, 5, 6, 7, 8, 9]], ['compact', 330, [4, 5, 6, 7, 8, 9]],
  ];
  const CASES = HITS.map(([template, chars, counts]) => [template, chars, [...new Set(counts.flatMap((n) => [n - 1, n, n + 1]))].sort((x, y) => x - y)]);
  for (const [template, chars, counts] of CASES) {
    it(`${template}, bullets of ${chars} characters`, async () => {
      const bad = [];
      for (const n of counts) {
        const r = resume({
          template,
          personal: PERSON,
          sections: [experience([{ description: list(n, chars) }, { description: list(3, chars) }, { description: list(3, chars) }]), eduSection()],
        });
        for (const found of await orphans(r, /^(Company \d+|Role \d+)\b/)) bad.push(`n=${n}: ${found}`);
      }
      assert.deepEqual(bad, []);
    });
  }

  it('the same holds for education, projects and custom entries', async () => {
    const bad = [];
    for (const template of ['classic', 'sidebar', 'bookend']) {
      for (let n = 3; n <= 10; n += 1) {
        const edu = (k, bullets) => ({ institution: `School ${k}`, degree: 'BSc', fieldOfStudy: 'CS', location: 'X', startDate: '2010', endDate: '2014', description: list(bullets, 330) });
        const proj = (k, bullets) => ({ name: `Project ${k}`, technologies: 'Rust', description: list(bullets, 330) });
        const custom = (k, bullets) => ({ title: `Entry ${k}`, subtitle: 'Sub', date: '2020', description: list(bullets, 330) });
        for (const [kind, make, header] of [['education', edu, /^School \d/], ['projects', proj, /^Project \d/], ['custom', custom, /^Entry \d/]]) {
          const r = resume({
            template,
            personal: PERSON,
            sections: [section(kind, [make(1, n), ...[2, 3, 4, 5, 6].map((k) => make(k, 3))])],
          });
          for (const found of await orphans(r, header)) bad.push(`${template}/${kind}/n=${n}: ${found}`);
        }
      }
    }
    assert.deepEqual(bad, []);
  });
});
