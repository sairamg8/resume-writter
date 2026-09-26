// Word résumé: interests print as the PDF prints them (R4-EXP-04).
// Word printed each interests entry as typed, so "Chess,Hiking," printed with its stray comma,
// "Chess ,  Go" with its spaces, and an entry of spaces alone added an empty ", ," part; the PDF (and
// the ATS text and the Markdown) split each entry at its commas and trim it. Word now does the same.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, renderDocx } from './harness.mjs';

before(setup);
after(teardown);

describe('Word interests (R4-EXP-04)', () => {
  it('splits and trims each entry, leaving blank parts out', async () => {
    const docx = await renderDocx(resume({
      personal: { name: 'Robin Sample' },
      sections: [section('interests', [{ interests: 'Chess,Hiking,' }, { interests: 'Chess ,  Go' }, { interests: '   ' }])],
    }));
    assert.ok(docx.texts.includes('Chess, Hiking, Chess, Go'), docx.texts.join(' | '));
    assert.ok(!docx.texts.some((t) => /,\s*,|\s,|,$/.test(t) && /Chess/.test(t)), docx.texts.join(' | '));
  });
});
