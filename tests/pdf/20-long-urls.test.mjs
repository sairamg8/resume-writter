// A URL or e-mail too long for its line breaks after / . - _ @ … (breakLongWords) and never gains
// a hyphen there (R4-10). Read back with pdf.js: the characters of each address, in order,
// with nothing added — the line breaks taken out. And where an address sits on one line, pdf.js
// and pdftotext read it exactly as typed: the break marks leave nothing in the text.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, teardown, resume, section, experience, render, renderCover, read, allItems, allText, loadModule, TEMPLATES,
} from './harness.mjs';
import { hasPdftotext, pdftotext } from './extractors.mjs';

before(setup);
after(teardown);

/** The document's text with spaces and line breaks taken out. */
const flat = (pages) => allItems(pages).map((t) => t.str).join('').replace(/\s/g, '');

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
      const whole = allItems(pages).filter((t) => t.str.includes(REPO));
      assert.ok(whole.length < 2, `${REPO.length} characters had to break at least once (else this proves nothing)`);
    });
  }

  // A contact's Display label can put words before a long URL on one line. react-pdf wraps a
  // contact's bare Link in a paragraph of its own, which no Text setting reaches (VM4-1).
  for (const template of TEMPLATES) {
    it(`${template}: a labelled contact with words before a long URL prints the URL as typed, wherever the line ends`, async () => {
      const url = 'github.com/jordan-rivera-sample/a11y-check-action';
      const wrong = [];
      for (const contactStyle of ['icon', 'bullet']) {
        for (let n = 1; n <= 11; n += 1) {
          const words = Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
          const r = resume({ template, settings: { contactStyle }, personal: { website: `https://${url}`, websiteLabel: `${words} ${url}` } });
          const text = flat(await read(await render(r)));
          if (!text.includes(url)) wrong.push(`${contactStyle}, ${n} words: ${near(text, url)}`);
        }
      }
      assert.deepEqual(wrong, []);
    });
  }

  it('the cover letter, in every template\'s look: a labelled contact with words before a long URL prints it as typed (VM4-1)', async () => {
    const url = 'github.com/jordan-rivera-sample/a11y-check-action';
    const wrong = [];
    for (const template of TEMPLATES) {
      for (let n = 1; n <= 11; n += 1) {
        const words = Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
        const r = resume({ template, personal: { website: `https://${url}`, websiteLabel: `${words} ${url}` } });
        const text = flat(await read(await renderCover(r)));
        if (!text.includes(url)) wrong.push(`${template}, ${n} words: ${near(text, url)}`);
      }
    }
    assert.deepEqual(wrong, []);
  });

  it('the cover letter: a long address in its contacts breaks with nothing added', async () => {
    const r = resume({ personal: { website: SITE, email: MAIL } });
    const text = flat(await read(await renderCover(r)));
    assert.deepEqual([SITE, MAIL].filter((a) => !text.includes(a)).map((a) => near(text, a)), []);
  });
});

describe('a long address reads as typed in text extraction (ATS)', () => {
  // A break mark must leave nothing in the text. The old U+FEFF mark is drawn as a zero-width
  // space glyph, and pdf.js — what pdf-parse and other ATS pipelines run — read each one as a
  // space: "github. com/ jordan- rivera- sample/ …" in the sample résumé (fix_M4 new_bugs[0]);
  // Poppler read it intact. Addresses over breakLongWords' 48 characters, each where it fits on
  // its line, so no line break comes into it.
  const PROJECT_URL = 'github.com/jordan-rivera-sample/a11y-check-action';
  const DOC_URL = 'https://docs.example-company.com/guides/setup-and-run';
  const MAIL_50 = 'jordan.rivera.sample.for-testing@example-mail.com';

  for (const template of TEMPLATES) {
    it(`${template}: pdf.js and every pdftotext mode read each address with nothing added`, async (t) => {
      if (!hasPdftotext) t.diagnostic('pdftotext not installed: pdf.js only');
      // The Sidebar prints contacts in its narrow column, where a 50-character e-mail wraps.
      const addresses = [PROJECT_URL, DOC_URL, ...(template === 'sidebar' ? [] : [MAIL_50])];
      const bytes = await render(resume({
        template,
        personal: { email: MAIL_50 },
        sections: [
          section('projects', [{ name: 'Kit', url: PROJECT_URL }]),
          experience([{ description: `<p>${DOC_URL}</p>` }]),
        ],
      }));
      const readers = [['pdf.js', allText(await read(bytes))], ...pdftotext(bytes)];
      /** What `text` holds from where `address` starts, for a failure message. */
      const from = (text, address) => text.slice(text.indexOf(address.slice(0, 6)), text.indexOf(address.slice(0, 6)) + address.length + 12);
      const wrong = readers.flatMap(([name, text]) => addresses.filter((a) => !text.includes(a))
        .map((a) => `${name}: ${a} → ${from(text.replace(/\s+/g, ' '), a)}`));
      assert.deepEqual(wrong, []);
    });
  }

  // The mark still keeps the optimal line breaker off it: an address that fits on the next line
  // moves there whole, as with U+FEFF, rather than splitting to fill the line (an empty-string
  // mark would split 14 of these 20 in each template).
  const PROJECT = 'github.com/some-owner/a-long-repository-name/issues/1234';
  const CREDENTIAL = 'credentials.example.org/verify/abc-def-ghi-jkl-mno/2026';
  for (const template of ['classic', 'modern', 'minimal', 'executive']) {
    it(`${template}: an address after words on its line is never split to fill the line, and reads as typed`, async () => {
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
        const lines = allItems(pages).map((t) => t.str);
        wrong.push(...[PROJECT, CREDENTIAL].filter((a) => !lines.some((l) => l.includes(a)))
          .map((a) => `${n} words before: ${a} → ${JSON.stringify(lines.filter((l) => /github|credentials|issues|verify/.test(l)))}`));
      }
      assert.deepEqual(wrong, []);
    });
  }
});
