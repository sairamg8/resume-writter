// PROBE: a long word in a Grids cell (3 and 4 columns): where does it print, against its cell and the page?
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, render, read, resume, section, experience, allItems, MM } from './harness.mjs';

before(setup);
after(teardown);

const WORDS = { de: 'Softwareentwicklungsingenieur', long: 'Internationalization-Infrastructure', url: 'https://example.com/a/very/long/path/segment' };

describe('probe 14', () => {
  it('grids long word', async () => {
    const out = [];
    for (const [wk, w] of Object.entries(WORDS)) {
      for (const cols of [2, 3, 4]) {
        const r = resume({
          template: 'classic',
          settings: { pageSize: 'A4', marginH: 15 },
          personal: { name: 'Jordan Rivera', title: 'Engineer', email: 'a@b.co', phone: '+1 555 0100', location: 'Austin', summary: '<p>Short.</p>' },
          sections: [
            experience(Array.from({ length: 4 }, (_, i) => ({ company: `Co${i}`, role: w, location: 'X', startDate: '2020', endDate: '2021', description: `<ul><li>Did ${w} things with ${w}.</li></ul>` })), { columns: cols }),
            section('projects', Array.from({ length: 4 }, (_, i) => ({ name: w, technologies: w, description: `<p>${w} ${w}</p>` })), { columns: cols }),
          ],
        });
        const pages = await read(await render(r));
        const items = allItems(pages);
        const over = items.filter((t) => t.x + t.w > pages[t.page - 1].W - 15 * MM + 1);
        out.push(`${wk}/c${cols}: pages=${pages.length} past-right-margin=${over.length} ${over.slice(0, 3).map((t) => `${t.str.slice(0, 16)}@${Math.round(t.x)}+${Math.round(t.w)}`).join(',')}`);
      }
    }
    assert.fail(`PROBE14 ${out.join(' ## ')}`);
  });
});
