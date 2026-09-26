// Word résumé: a reference's phone and e-mail link as the PDF links them (R4-EXP-06).
// Word linked a reference's phone as "tel:" plus its digits whatever it held, so "Available on request"
// became a link to an empty "tel:"; the PDF links through contactHref, which leaves a phone with under
// three digits as text. Word now links what the PDF links, through contactHref.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, renderDocx } from './harness.mjs';

before(setup);
after(teardown);

describe('Word reference links (R4-EXP-06)', () => {
  const refs = (item) => renderDocx(resume({
    personal: { name: 'Robin Sample' },
    sections: [section('references', [{ name: 'Pat Referee', ...item }])],
  }));

  it('prints a phone the PDF does not link as text, with no tel: link', async () => {
    const docx = await refs({ phone: 'Available on request' });
    assert.ok(docx.texts.some((t) => t.includes('Available on request')), docx.texts.join(' | '));
    assert.deepEqual(docx.links.filter((l) => /^tel:/i.test(l || '')), []);
  });

  it('still links a dialable phone and an e-mail address', async () => {
    const docx = await refs({ phone: '+44 20 7946 0000', email: 'pat@example.com' });
    assert.ok(docx.links.includes('tel:+442079460000'), docx.links.join(' '));
    assert.ok(docx.links.includes('mailto:pat@example.com'), docx.links.join(' '));
  });
});
