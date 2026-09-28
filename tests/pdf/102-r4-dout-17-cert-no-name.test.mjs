// R4-DOUT-17: a certification with no name printed its line as ' — Amazon Web Services · ID: ABC123' in
// the PDF (and '· ID: ABC123' with no issuer either): the separators were unconditional. Now each
// separator prints only between two fields that print, so the line starts at its first field.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allItems } from './harness.mjs';

before(setup);
after(teardown);

/** The runs printed on the same line as the run containing `needle`, left to right. */
function lineOf(pages, needle) {
  const items = allItems(pages);
  const hit = items.find((t) => t.str.includes(needle));
  assert.ok(hit, `${needle} prints in: ${items.map((t) => t.str).join(' | ')}`);
  return items.filter((t) => t.page === hit.page && Math.abs(t.y - hit.y) < 1).sort((a, b) => a.x - b.x);
}

/** The line's text with its spaces taken out, so how the reader splits runs at a space does not matter. */
const text = (runs) => runs.map((t) => t.str).join('').replace(/\s/g, '');

async function certLine(template, item, needle) {
  const pages = await read(await render(resume({ template, sections: [section('certifications', [item])] })));
  return lineOf(pages, needle);
}

describe('a certification with no name starts its line at its first field (R4-DOUT-17)', () => {
  for (const template of ['classic', 'timeline']) {
    it(`${template}: no name → "Amazon Web Services · ID: ABC123"`, async () => {
      const runs = await certLine(template, { name: '', issuer: 'Amazon Web Services', credentialId: 'ABC123' }, 'Amazon Web Services');
      assert.ok(!/^[—·]/.test(runs[0].str.trim()), `the line starts at the issuer: ${text(runs)}`);
      assert.equal(text(runs), 'AmazonWebServices·ID:ABC123');
    });
  }

  it('classic: neither name nor issuer → "ID: ABC123"', async () => {
    const runs = await certLine('classic', { name: '', issuer: '', credentialId: 'ABC123' }, 'ABC123');
    assert.ok(!/^[—·]/.test(runs[0].str.trim()), `the line starts at the ID: ${text(runs)}`);
    assert.equal(text(runs), 'ID:ABC123');
  });

  it('classic: a named certification keeps its separators (unchanged)', async () => {
    const runs = await certLine('classic', { name: 'Cloud Architect', issuer: 'Amazon Web Services', credentialId: 'ABC123' }, 'Cloud Architect');
    assert.equal(text(runs), 'CloudArchitect—AmazonWebServices·ID:ABC123');
  });
});
