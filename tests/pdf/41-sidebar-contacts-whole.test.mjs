// A résumé parser finds a LinkedIn or GitHub link, an e-mail address or a website by matching the
// text as one token. The Sidebar's dark column is narrow, and a contact value wider than it was
// broken at a hyphen or slash — extracted as "linkedin.com/in/jordan-rivera- sample", a profile link
// that no longer matches. Every value that can fit the column at a readable size now prints whole,
// on one line, at the largest size that holds it (WHOLE_VALUE_MIN_PT is the floor); only a value
// too long even for that wraps inside the column, as before.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, read, allText } from './harness.mjs';
import { hasPdftotext, pdftotext } from './extractors.mjs';

before(setup);
after(teardown);

// Each fits the column at 6 pt or more with the default margins on A4 and on US Letter.
const VALUES = {
  linkedin: 'linkedin.com/in/alexandra-johnson-smith-senior',
  github: 'github.com/alexandra-johnson-smith-engineering',
  email: 'alexandra.johnson-smith@examplecompany.com',
  website: 'alexandra-johnson-smith-portfolio.example.com',
};
const doc = (settings = {}) => resume({
  template: 'sidebar',
  settings,
  personal: { name: 'Alexandra Johnson-Smith', title: 'Senior Engineer', phone: '+1 555 0142', location: 'Austin, TX', ...VALUES },
  sections: [experience([{}])],
});

describe('Sidebar contact values print whole', () => {
  for (const pageSize of ['A4', 'LETTER']) {
    it(`every long value is one unbroken run on one line, ${pageSize}`, async () => {
      const pages = await read(await render(doc({ pageSize })));
      const text = allText(pages);
      const items = pages[0].items;
      for (const [field, value] of Object.entries(VALUES)) {
        assert.ok(text.includes(value), `${field} is not whole in the text: ${text.slice(0, 400)}`);
        // The pieces of one value share a baseline: none of them wrapped onto a line of its own.
        const pieces = items.filter((t) => value.includes(t.str.trim()) && t.str.trim().length > 3);
        const baselines = new Set(pieces.map((t) => Math.round(t.y)));
        assert.equal(baselines.size, 1, `${field} printed on ${baselines.size} lines`);
        assert.ok(Math.min(...pieces.map((t) => t.h)) >= 5.5, `${field} shrank below the readable floor`);
      }
    });
  }

  it('Poppler reads each value as one token in reading order and in -layout', async (t) => {
    if (!hasPdftotext) { t.skip('pdftotext not installed'); return; }
    const readers = pdftotext(await render(doc()));
    for (const [name, text] of readers.filter(([n]) => !n.includes('-raw'))) {
      for (const [field, value] of Object.entries(VALUES)) {
        assert.ok(text.split('\n').some((line) => line.includes(value)), `${name}: ${field} is split across lines`);
      }
    }
  });

  it('a value too long for the floor still stays inside the column', async () => {
    const long = 'linkedin.com/in/' + 'a-very-long-profile-name-'.repeat(4);
    const pages = await read(await render(resume({ template: 'sidebar', personal: { name: 'Pat Lee', title: 'Engineer', linkedin: long }, sections: [experience([{}])] })));
    const w = pages[0].W;
    const column = w * 0.38; // SIDE_COL: the dark column's share of the paper
    const pieces = pages[0].items.filter((t) => long.includes(t.str.trim()) && t.str.trim().length > 3);
    assert.ok(pieces.length >= 2, 'it wraps (too long for one line at any readable size)');
    for (const p of pieces) assert.ok(p.x + p.w <= column + 1, `a piece runs out of the column: ${p.str} ends at ${p.x + p.w}, column ${column}`);
  });
});
