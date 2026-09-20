// Design → Font sizes → Entry Header resizes the résumé header's job title and the cover letter
// letterhead's job title to match (FIDB-51-VF4-NB2).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderCover, renderDocx, read, itemsWith, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const TITLE = 'Staff Engineer';
const cv = (template, settings = {}) => resume({
  template,
  settings: { accentColor: '#2563eb', ...settings },
  personal: { name: 'Pat Sample', title: TITLE, email: 'pat@example.com' },
  coverLetter: { body: '<p>Dear Sarah,</p>' },
});

describe('Design → Font sizes → Entry Header resizes letterhead title (FIDB-51-VF4-NB2)', () => {
  it('PDF: for each template, fontSizeEntryDelta 4 prints the letter title at the résumé title size (15 pt)', async () => {
    for (const template of Object.keys(TEMPLATES)) {
      const r = cv(template, { fontSizeBase: 11, fontSizeEntryDelta: 4 });
      const [cvPage] = await read(await render(r));
      const [clPage] = await read(await renderCover(r));
      const cvTitle = itemsWith([cvPage], TITLE)[0];
      const clTitle = itemsWith([clPage], TITLE)[0];
      assert.ok(cvTitle, `${template}: résumé title rendered`);
      assert.ok(clTitle, `${template}: cover letter title rendered`);
      assert.equal(cvTitle.h, 15, `${template}: résumé title is 15 pt`);
      assert.equal(clTitle.h, cvTitle.h, `${template}: letter title matches résumé title (${cvTitle.h} pt)`);
    }
  });

  it('PDF: fontSizeEntryDelta 0 leaves the letter title at the base size (guard)', async () => {
    for (const template of Object.keys(TEMPLATES)) {
      const r = cv(template, { fontSizeBase: 11, fontSizeEntryDelta: 0 });
      const [clPage] = await read(await renderCover(r));
      const clTitle = itemsWith([clPage], TITLE)[0];
      assert.equal(clTitle.h, 11, `${template}: letter title is 11 pt at delta 0`);
    }
  });

  it('Word: the letter\'s title run size equals the résumé header\'s title run size', async () => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    const { readDocx } = await import('./harness.mjs');
    for (const delta of [0, 4]) {
      const r = cv('classic', { fontSizeBase: 11, fontSizeEntryDelta: delta });
      const cvDoc = await renderDocx(r);
      const clDoc = readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
      const cvRun = cvDoc.paragraphs.flatMap((p) => p.xml.split('</w:r>')).find((x) => x.includes(`>${TITLE}<`));
      const clRun = clDoc.paragraphs.flatMap((p) => p.xml.split('</w:r>')).find((x) => x.includes(`>${TITLE}<`));
      const cvSz = cvRun?.match(/<w:sz w:val="(\d+)"/)?.[1];
      const clSz = clRun?.match(/<w:sz w:val="(\d+)"/)?.[1];
      assert.ok(cvSz && clSz, `title run size found (delta ${delta})`);
      assert.equal(clSz, cvSz, `delta ${delta}: letter title size (${clSz}) matches résumé title size (${cvSz})`);
      assert.equal(clSz, String((11 + delta) * 2), `delta ${delta}: title size in half-points is ${(11 + delta) * 2}`);
    }
  });
});
