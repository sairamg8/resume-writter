// Defect: a résumé record with no edit time (`updatedAt` missing or not a number: a record an older build or a
// hand-edited file left, which the store keeps as it is) showed "Classic · NaNd ago" on its Documents card, because
// timeAgo did arithmetic on undefined. The New Cover picker already leaves the age out for such a record
// (NewLetterModal). Pins: the card of a record with no edit time shows the template alone; one with a time still
// reads "template · age".
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { elements } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { cv, dashboard, text } from './182-ui-b5a-mount.mjs';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const meta = (card) => text([...elements(card)].find((el) => el.tagName === 'P' && /^Classic/.test(text(el))));

it('a card whose résumé has no edit time reads the template alone, never NaN', async () => {
  const page = await dashboard([cv('resume_a', 'No Time CV', undefined), cv('resume_b', 'Word Time CV', 'yesterday'), cv('resume_c', 'Timed CV', Date.now())]);
  try {
    const [none, word, timed] = page.cards().map(meta);
    assert.equal(none, 'Classic');
    assert.equal(word, 'Classic', 'a time that is not a number is no time either');
    assert.match(timed, /^Classic · Just now$/, 'a record with a time keeps its age');
  } finally { await page.close(); }
});
