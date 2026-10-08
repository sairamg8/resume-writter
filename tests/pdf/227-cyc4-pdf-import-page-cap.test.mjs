// A PDF someone sent can list any number of pages (a few MB hold the page tree of hundreds of thousands),
// and the import read every one, one after the other, with the tab busy for minutes. It now stops before
// the first page of a file with more than 200 (MAX_PDF_PAGES) and says why; a short one reads as before.
// pdf.js is stood in for: the import takes it as an argument (pdfLines' `lib`).
// Run: node --test tests/pdf/227-cyc4-pdf-import-page-cap.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

let pdfLines;
before(async () => {
  await setup();
  ({ pdfLines } = await loadModule('/src/utils/importFile.js'));
});
after(teardown);

/** A pdf.js stand-in whose document has `numPages` pages, each holding one line `Jane Doe`; `log.pages` counts the pages asked for. */
function fakeLib(numPages, log) {
  const page = {
    getTextContent: async () => ({ items: [{ str: 'Jane Doe', transform: [1, 0, 0, 1, 72, 700], width: 60, height: 12 }] }),
    getAnnotations: async () => [],
  };
  const doc = { numPages, getPage: async () => { log.pages += 1; return page; } };
  return { getDocument: () => ({ promise: Promise.resolve(doc), destroy: async () => { log.destroyed = true; } }) };
}

it("a PDF of up to 200 pages is read page by page as before", async () => {
  const log = { pages: 0 };
  await pdfLines(new Uint8Array(8), fakeLib(1, log));
  assert.equal(log.pages, 1, 'the one page was read');
  await pdfLines(new Uint8Array(8), fakeLib(200, log));
  assert.equal(log.pages, 201, 'a file of exactly 200 pages is read in full');
});

it('a PDF of more than 200 pages is refused before any page is read, and its task is let go', async () => {
  const log = { pages: 0, destroyed: false };
  await assert.rejects(pdfLines(new Uint8Array(8), fakeLib(100000, log)), /more than 200 pages/);
  assert.equal(log.pages, 0, 'no page was read');
  assert.equal(log.destroyed, true);
});
