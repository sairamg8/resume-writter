// The preview's caption names the paper the preview prints on (PAR-01, ONB-9). Above the PDF the
// editor says "Résumé · A4" or "Cover Letter · A4"; it said A4 whatever the résumé stored, so a
// résumé on US Letter (an imported .json's `settings.pageSize: 'LETTER'`) showed a Letter page
// captioned A4. The caption reads the size the PDF reads — pageSizeOf(settings) — so it names US
// Letter for 'LETTER' in any case, and A4 for no size (every résumé saved before the setting), "A4"
// and a size this build does not offer; each checked against the page box the PDF really prints.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, resume, render, renderCover, read, loadModule } from './harness.mjs';

before(setup);
after(teardown);

/** Each stored value, the paper's name as the caption must print it (written out, not read from PAGE_SIZES) and its page box in pt. */
const LETTER = { label: 'US Letter', box: [612, 792] };
const A4 = { label: 'A4', box: [595.28, 841.89] };
const STORED = [
  ['"LETTER"', 'LETTER', LETTER],
  ['"letter"', 'letter', LETTER],
  ['"Letter"', 'Letter', LETTER],
  ['no page size (saved data)', undefined, A4],
  ['"A4"', 'A4', A4],
  ['"Legal" (not offered)', 'Legal', A4],
  ['a number', 5, A4],
  ['null', null, A4],
];

const make = (pageSize) => {
  const r = resume({ template: 'classic', personal: { name: 'Pat Sample', email: 'pat@example.com' } });
  if (pageSize === undefined) delete r.settings.pageSize;
  else r.settings.pageSize = pageSize;
  return r;
};

/** The caption beside the layout toggle, as the editor renders the preview column on `activeTab`. */
async function caption(r, activeTab) {
  const { EditorPreviewPane } = await loadModule('/src/components/EditorPreviewPane.jsx');
  const html = renderToString(createElement(MemoryRouter, null, createElement(EditorPreviewPane, {
    resume: r, activeTab, layoutMode: 'split', setLayoutMode: () => {}, previewZoom: 1, setPreviewZoom: () => {}, persistError: null,
  })));
  const text = html.replace(/<!-- -->/g, '').replace(/<[^>]*>/g, '\n').replace(/&#x27;/g, '\'');
  const found = text.split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => / · /.test(s));
  assert.equal(found.length, 1, `one caption: ${JSON.stringify(found)}`);
  return found[0];
}

/** The first page's [width, height] in pt, to 0.01 pt. */
const box = async (bytes) => {
  const [page] = await read(bytes);
  return [page.W, page.H].map((n) => Math.round(n * 100) / 100);
};

describe('the preview\'s caption names the paper its PDF prints on (PAR-01, ONB-9)', () => {
  for (const [label, pageSize, paper] of STORED) {
    it(`${label}: "Résumé · ${paper.label}" over the résumé (Résumé and Design tabs), "Cover Letter · ${paper.label}" over the letter`, async () => {
      const r = make(pageSize);
      assert.equal(await caption(r, 'resume'), `Résumé · ${paper.label}`);
      assert.equal(await caption(r, 'design'), `Résumé · ${paper.label}`);
      assert.equal(await caption(r, 'coverletter'), `Cover Letter · ${paper.label}`);
      // The paper the caption names is the one the preview shows.
      assert.deepEqual(await box(await render(r)), paper.box, 'the résumé PDF');
      assert.deepEqual(await box(await renderCover(r, { preview: true })), paper.box, 'the letter PDF');
    });
  }
});
