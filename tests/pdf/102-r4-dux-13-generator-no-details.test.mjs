// R4-DUX-13: 'Auto-Generate from Resume' on a Blank letter (no experience, no skills, no title)
// silently previewed generic filler — "the open opportunity at [Company Name]", "utilizing modern
// best practices" — as if it were tailored. The open generator now says, above the preview, that
// the letter has no résumé details to draw on; a letter with any experience, skill or title does
// not show it.
//
// The generator is the kit's Dialog now (R4-DVIS-25): it renders in a portal at the end of <body>, which
// the server renderer does not draw, so the open modal is mounted over the fake DOM and its page read
// (104-r5-dlg-helpers.mjs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience } from './harness.mjs';
import { openModal } from './104-r5-dlg-helpers.mjs';

before(setup);
after(teardown);

const NOTICE = 'This letter has no résumé details to draw on';

/** The open generator over `r`, as text. */
async function opened(r) {
  const g = await openModal('/src/components/CoverLetterGeneratorModal.jsx', { onApply: () => {}, resume: r, coverLetter: r.coverLetter });
  const dialog = g.dialog();
  const text = dialog ? dialog.textContent.replace(/\s+/g, ' ') : '';
  await g.unmount();
  return text;
}

describe('the generator says when there is nothing to write the letter from (R4-DUX-13)', () => {
  it('a Blank letter (no experience, skills or title) shows the notice above the preview', async () => {
    const text = await opened(resume({ personal: { name: '', title: '' }, sections: [] }));
    assert.ok(text.includes(NOTICE), text);
    assert.ok(text.indexOf(NOTICE) < text.indexOf('Live Letter Preview'), 'the notice sits above the preview');
    assert.ok(text.includes('add experience and skills on the Resume tab'), text);
  });

  it('a new Experience section\'s one blank entry and an empty skills group still leave nothing to draw on', async () => {
    const text = await opened(resume({
      personal: { name: 'Sam Example', title: '' },
      sections: [experience([{ role: '', company: '' }]), section('skills', [{ category: '', skills: '' }])],
    }));
    assert.ok(text.includes(NOTICE), text);
  });

  it('a letter with a title, an experience or a skill shows no notice', async () => {
    const cases = {
      title: resume({ personal: { title: 'Data Analyst' }, sections: [] }),
      experience: resume({ personal: { title: '' }, sections: [experience([{ role: 'Analyst', company: 'Initech' }])] }),
      skills: resume({ personal: { title: '' }, sections: [section('skills', [{ category: 'Tools', skills: 'SQL, Python' }])] }),
    };
    for (const [name, r] of Object.entries(cases)) {
      const text = await opened(r);
      assert.ok(!text.includes(NOTICE), `${name}: ${text}`);
    }
  });
});
