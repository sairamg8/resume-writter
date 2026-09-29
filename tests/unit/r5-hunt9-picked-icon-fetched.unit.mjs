// R5-HUNT9-PICKED-ICON-FETCHED-AS-IMAGE: a contact icon picked in Select Header Icon is stored as
// 'icon:<id>' or 'pack:<id>' — a vector shape PdfContactIcon draws, not an image. withPrintablePhotos
// fetched it as a URL on every build (fetch('icon:mail') throws, taken as a passing failure), so the
// retry stayed pending and the dashboard card picture of that résumé was never kept (pageImage.js
// printedIncomplete). Pinned: a picker choice is left as it is and never fetched; an image icon still is.
// Run: yarn test:unit
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { imageRetryPendingFor, withPrintablePhotos } from '../../src/utils/printableImage.js';

const fetched = [];
let saved;
before(() => {
  saved = globalThis.fetch;
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    throw new TypeError(`URL scheme "${String(url).split(':')[0]}" is not supported.`);
  };
});
after(() => {
  if (saved === undefined) delete globalThis.fetch;
  else globalThis.fetch = saved;
});

it('picked icons (icon:/pack:) are not fetched and leave no retry pending', async () => {
  const resume = { settings: { customContactIcons: { email: 'icon:mail', phone: 'pack:filled' } } };
  const out = await withPrintablePhotos(resume);
  assert.equal(out, resume, 'the résumé comes back unchanged');
  assert.deepEqual(fetched, [], 'nothing is fetched for a picker choice');
  assert.equal(imageRetryPendingFor('icon:mail', { kind: 'icon' }), false);
  assert.equal(imageRetryPendingFor('pack:filled', { kind: 'icon' }), false);
});

it('an image icon given as a URL is still fetched', async () => {
  await withPrintablePhotos({ settings: { customContactIcons: { email: 'https://example.test/mail.png' } } });
  assert.ok(fetched.includes('https://example.test/mail.png'));
});
