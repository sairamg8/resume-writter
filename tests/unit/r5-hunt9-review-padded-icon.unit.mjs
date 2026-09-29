// R5-HUNT9-REVIEW-PADDED-ICON: PdfContactIcon and the editor read a field's icon trimmed
// (getCustomContactIcon), so an image icon saved with spaces around it (' https://…', ' data:image/webp…',
// as an imported file may hold it) is an image to both: the editor shows it and the PDF prints the copy
// withPrintablePhotos makes of it. The picked-icon check (R5-HUNT9-PICKED-ICON-FETCHED-AS-IMAGE) asked
// it of the untrimmed value, so no copy was made and the PDF printed the pack's icon instead.
// Pinned: a padded image icon is still copied (fetched); a padded picker choice still is not.
// Run: yarn test:unit
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { withPrintablePhotos } from '../../src/utils/printableImage.js';

const fetched = [];
let saved;
before(() => {
  saved = globalThis.fetch;
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    throw new TypeError('offline');
  };
});
after(() => {
  if (saved === undefined) delete globalThis.fetch;
  else globalThis.fetch = saved;
});

it('an image icon saved with spaces around it is still copied for the PDF', async () => {
  await withPrintablePhotos({ settings: { customContactIcons: { email: '  https://example.test/padded.png ' } } });
  assert.ok(fetched.some((u) => u.trim() === 'https://example.test/padded.png'), `fetched: ${JSON.stringify(fetched)}`);
});

it('a picker choice saved with spaces around it is still never fetched', async () => {
  fetched.length = 0;
  const resume = { settings: { customContactIcons: { phone: ' icon:phone ', email: ' pack:filled' } } };
  const out = await withPrintablePhotos(resume);
  assert.equal(out, resume);
  assert.deepEqual(fetched, []);
});
