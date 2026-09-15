// A URL or e-mail too long for its line breaks after / . - _ @ … (breakLongWords) and never gains
// a hyphen there (R4-10). Read back with pdf.js: the characters of each address, in order,
// with nothing added — the line breaks and zero-width break marks taken out.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, teardown, resume, section, experience, render, renderCover, read, allItems, loadModule, TEMPLATES,
} from './harness.mjs';

before(setup);
after(teardown);

/** The document's text with spaces, line breaks and U+FEFF break marks taken out. */
const flat = (pages) => allItems(pages).map((t) => t.str).join('').replace(/[\s\ufeff]/g, '');

/** What `text` holds where `address` should end, for a failure message. */
const near = (text, address) => {
  const at = text.lastIndexOf(address.slice(-8));
  return `${address} → ${at < 0 ? '(its end not found)' : text.slice(Math.max(0, at - address.length - 4), at + 8)}`;
};

const REPO = 'github.com/some-owner/a-rather-long-repository-name-with-many-hyphens/tree/main/packages/ui-kit';
const SITE = 'example-portfolio-site-with-a-long-name.example.com/projects/2026/case-studies/checkout';
const MAIL = 'a.really.long.address.for.testing.line-breaks@example-company-domain.com';

describe('long URLs break without a hyphen (R4-10)', () => {
  it('the sample résumés print their second project URL as typed, in every template', async () => {
    // 50 characters: above breakLongWords' 48. Before: "…/a11y--" / "check- action" in Classic,
    // Modern and Executive, "…sample/-" in Minimal.
    const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
    const url = 'github.com/jordan-rivera-sample/a11y-check-action';
    const wrong = [];
    for (const r of DEMO_RESUMES) {
      const text = flat(await read(await render(r)));
      if (!text.includes(url)) wrong.push(`${r.template}: ${near(text, url)}`);
    }
    assert.deepEqual(wrong, []);
  });

  // Just over 48 characters, after words on the same line: the line has room to break inside it.
  const PROJECT = 'github.com/some-owner/a-long-repository-name/issues/1234';
  const CREDENTIAL = 'credentials.example.org/verify/abc-def-ghi-jkl-mno/2026';
  for (const template of TEMPLATES) {
    it(`${template}: a URL after words on its line — a project's, a certificate's — prints as typed, wherever the line ends`, async () => {
      const wrong = [];
      for (let n = 0; n < 10; n += 1) {
        const lead = Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
        const pages = await read(await render(resume({
          template,
          sections: [
            section('projects', [{ name: `Kit ${lead}`, technologies: 'React, TypeScript', url: PROJECT }]),
            section('certifications', [{ name: `Cert ${lead}`, issuer: 'Org', url: CREDENTIAL }]),
          ],
        })));
        const text = flat(pages);
        wrong.push(...[PROJECT, CREDENTIAL].filter((a) => !text.includes(a)).map((a) => `${n} words before: ${near(text, a)}`));
      }
      assert.deepEqual(wrong, []);
    });

    it(`${template}: an address longer than its line, wherever one prints, breaks with nothing added (a guard)`, async () => {
      const r = resume({
        template,
        personal: { website: SITE, email: MAIL },
        sections: [
          section('projects', [{ name: 'UI kit', technologies: 'React, TypeScript', url: REPO }]),
          experience([{ description: `<p>Docs at ${REPO}/docs and more.</p>` }]),
        ],
      });
      const pages = await read(await render(r));
      const text = flat(pages);
      const wrong = [REPO, `${REPO}/docs`, SITE, MAIL].filter((a) => !text.includes(a)).map((a) => near(text, a));
      assert.deepEqual(wrong, []);
      const whole = allItems(pages).filter((t) => t.str.replace(/\ufeff/g, '').includes(REPO));
      assert.ok(whole.length < 2, `${REPO.length} characters had to break at least once (else this proves nothing)`);
    });
  }

  it('the cover letter: a long address in its contacts breaks with nothing added', async () => {
    const r = resume({ personal: { website: SITE, email: MAIL } });
    const text = flat(await read(await renderCover(r)));
    assert.deepEqual([SITE, MAIL].filter((a) => !text.includes(a)).map((a) => near(text, a)), []);
  });
});
