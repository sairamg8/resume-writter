// Word résumé: a reference prints one field per line, as the PDF's card does (R4-DOUT-12).
// Word joined the job title and company as "CTO, Acme" and the e-mail and phone as
// "jo@example.com  |  555 0100"; the PDF card prints the title, the company, the e-mail and the
// phone each on its own line, with no separators. Word now gives each its own paragraph, the
// e-mail and phone still linked.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, renderDocx } from './harness.mjs';

before(setup);
after(teardown);

describe('Word references: one line per field, as the PDF card (R4-DOUT-12)', () => {
  it('prints job title, company, e-mail and phone each in its own paragraph, with no separators', async () => {
    const doc = await renderDocx(resume({
      personal: { name: 'Robin Sample' },
      sections: [section('references', [{ name: 'Jo Lark', jobTitle: 'CTO', company: 'Acme', relationship: 'Manager', email: 'jo@example.com', phone: '555 0100' }])],
    }));
    const all = doc.texts.join(' || ');
    assert.ok(!doc.texts.some((t) => t.includes('CTO, Acme')), `title and company not joined: ${all}`);
    assert.ok(!doc.texts.some((t) => t.includes(' | ')), `no bar between e-mail and phone: ${all}`);
    for (const value of ['Jo Lark', 'CTO', 'Acme', 'Manager', 'jo@example.com', '555 0100']) {
      assert.ok(doc.texts.some((t) => t.trim() === value), `${value} in a paragraph of its own: ${all}`);
    }
    assert.ok(doc.links.includes('mailto:jo@example.com'), doc.links.join(' '));
    assert.ok(doc.links.includes('tel:5550100'), doc.links.join(' '));
  });
});
