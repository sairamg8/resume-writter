// The Smart Cover Letter Generator wrote résumé fields and the typed company / role / recipient
// straight into its letter HTML (`<p>${p}</p>`), and the modal previewed that HTML with
// dangerouslySetInnerHTML. A résumé imported from a crafted .json or JSON Resume file — a name like
// `<img src=x onerror=…>` — ran script in the app's origin, where the Firebase session lives, the
// moment the generator opened. Every value is now escaped as text before it is wrapped, and the
// preview sanitises what it inserts. Escaping is also what keeps ordinary text intact: `R&D <b>Labs</b>`
// used to lose its tags' text in the PDF and print bold; it now prints as typed, with no `&amp;`, in
// the preview, the PDF and the .docx.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, section, experience, renderCover, read, allText, loadModule, readDocx } from './harness.mjs';

before(setup);
after(teardown);

const NAME = 'Ada <img src=x onerror=alert(1)> Lovelace';
const TITLE = 'Engineer <script>alert(2)</script>';
const ROLE = '<svg onload=alert(3)>Lead';
const COMPANY = 'R&D <b>Labs</b>';
const SKILL = '<iframe src=javascript:alert(4)>';

const hostile = () => resume({
  template: 'classic',
  personal: { name: NAME, title: TITLE, email: 'ada@example.com' },
  sections: [
    experience([{ role: ROLE, company: COMPANY, description: '' }]),
    section('skills', [{ category: 'Tools', skills: `${SKILL}, SQL` }]),
  ],
});

/** The tags in an HTML string, lower-cased, e.g. ['<p>', '</p>']. */
const tags = (html) => (html.match(/<[^>]*>/g) || []).map((t) => t.toLowerCase());

/** The generated letter, applied to the résumé the way CoverLetterPanel's Apply does. */
async function applied(opts = {}) {
  const { generateCoverLetter } = await loadModule('/src/utils/coverLetterGenerator.js');
  const r = hostile();
  const gen = generateCoverLetter({ resume: r, company: 'Acme & Sons', ...opts });
  r.coverLetter = { ...r.coverLetter, ...gen };
  return r;
}

describe('the cover letter generator escapes what it writes (HTML injection)', () => {
  it('the modal\'s live preview inserts no element from the résumé — only <p>, with the markup shown as text', async () => {
    const { default: Modal } = await loadModule('/src/components/CoverLetterGeneratorModal.jsx');
    const html = renderToString(createElement(Modal, { isOpen: true, onClose: () => {}, onApply: () => {}, resume: hostile() }));
    const preview = /class="prose[^"]*"[^>]*>(.*?)<\/div>/s.exec(html);
    assert.ok(preview, 'the preview is rendered');
    const inner = preview[1];
    assert.ok(inner.length > 200, 'the preview holds the letter');
    assert.deepEqual([...new Set(tags(inner))].sort(), ['</p>', '<p>'], inner);
    for (const bad of ['<img', '<script', '<svg', '<iframe', '<b>']) assert.ok(!inner.toLowerCase().includes(bad), `no ${bad} in: ${inner}`);
    assert.ok(inner.includes('Engineer &lt;script&gt;alert(2)&lt;/script&gt;'), 'the title\'s markup is shown as text');
    assert.ok(inner.includes('&lt;svg onload=alert(3)&gt;Lead'), 'the role\'s markup is shown as text');
    assert.ok(inner.includes('R&amp;D &lt;b&gt;Labs&lt;/b&gt;'), 'the company is escaped once, not twice');
    assert.ok(!inner.includes('&amp;amp;') && !inner.includes('&amp;lt;'), 'no double escaping');
  });

  it('the applied letter prints the résumé\'s text as typed in the PDF — no markup lost, no entities', async () => {
    const r = await applied();
    const text = allText(await read(await renderCover(r))).replace(/\s+/g, ' ');
    for (const s of ['Engineer <script>alert(2)</script>', '<svg onload=alert(3)>Lead', 'R&D <b>Labs</b>', SKILL, 'Acme & Sons']) {
      assert.ok(text.includes(s), `"${s}" in: ${text}`);
    }
    assert.ok(!/&(amp|lt|gt|quot);/.test(text), `no entity printed: ${text}`);
  });

  it('the applied letter prints the same text in the .docx', async () => {
    const r = await applied();
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    const doc = readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
    const text = doc.texts.join(' | ');
    for (const s of ['<svg onload=alert(3)>Lead', 'R&D <b>Labs</b>', SKILL, 'Acme & Sons']) assert.ok(text.includes(s), `"${s}" in: ${text}`);
    assert.ok(!/&(amp|lt|gt|quot);/.test(text), `no entity printed: ${text}`);
  });
});
