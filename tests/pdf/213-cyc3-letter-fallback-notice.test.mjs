// New Cover with the picker's code unreachable still makes the letter from the first résumé (178-ui-b1-lazy-fallbacks),
// and now says which résumé it was made from, so a person with several is not left with a letter carrying the wrong
// name, contacts and photo without a hint. The notice is the Dashboard's own notice line.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume } from './harness.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { dashboard, text, until } from './cyc3-dashboard.mjs';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const cv = (id, name, updatedAt) => ({ ...resume({ personal: { name: `${name} Person` } }), id, name, updatedAt });

it('picker unreachable, two résumés: the letter is made from the first and the notice names it', async () => {
  const page = await dashboard([cv('resume_a', 'Older CV', 1000), cv('resume_b', 'Newest CV', 3000)],
    { letter: () => Promise.reject(new TypeError('Failed to fetch dynamically imported module')) });
  try {
    page.press('New Cover');
    await until(() => page.made.length > 0, 'a letter made');
    assert.deepEqual(page.made, ['resume_b'], 'from the most recently edited résumé');
    await until(() => page.all().some((el) => text(el).includes('Made from Newest CV: the picker could not load.')), 'the notice');
  } finally { await page.close(); }
});
