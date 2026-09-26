// R4-DUX-13: 'Auto-Generate from Resume' on a Blank letter (no experience, no skills, no title)
// silently previewed generic filler — "the open opportunity at [Company Name]", "utilizing modern
// best practices" — as if it were tailored. The open generator now says, above the preview, that
// the letter has no résumé details to draw on; a letter with any experience, skill or title does
// not show it.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, section, experience, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const NOTICE = 'This letter has no résumé details to draw on';

/** The open generator over `r`, as text. */
async function opened(r) {
  const { default: Modal } = await loadModule('/src/components/CoverLetterGeneratorModal.jsx');
  const html = renderToString(createElement(Modal, { isOpen: true, onClose: () => {}, onApply: () => {}, resume: r, coverLetter: r.coverLetter }));
  return html.replace(/<[^>]*>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
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
