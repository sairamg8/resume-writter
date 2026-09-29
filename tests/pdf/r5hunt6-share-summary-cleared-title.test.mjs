// R5-HUNT6-SHARE-SUMMARY-CLEARED-TITLE-TYPE-ID: the share panel's "What is public" list names a
// section whose title the user cleared by its type's own name ("Custom Section", "Professional
// Experience"). It listed the internal type key ('custom: 2 entries'), and a title of only spaces
// as '   : 2 entries'.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const copy = (sections) => ({ personal: { name: 'Jo Doe' }, sections });
const sec = (type, title, n) => ({ id: `s-${type}`, type, title, visible: true, items: Array.from({ length: n }, (_, i) => ({ id: `${type}-${i}` })) });

describe('the share summary never names a section by its type key (R5-HUNT6-SHARE-SUMMARY-CLEARED-TITLE-TYPE-ID)', () => {
  it('a cleared Custom or Experience title is listed by the type\'s name', async () => {
    const { publicSummary } = await loadModule('/src/utils/publicLink.js');
    assert.deepEqual(publicSummary(copy([sec('custom', '', 2), sec('experience', '', 3)])), [
      'Name: Jo Doe', 'Custom Section: 2 entries', 'Professional Experience: 3 entries',
    ]);
  });

  it('a title of only spaces is a cleared one; a typed title is listed as typed', async () => {
    const { publicSummary } = await loadModule('/src/utils/publicLink.js');
    assert.deepEqual(publicSummary(copy([sec('custom', '   ', 2), sec('skills', 'Tools', 1)])), [
      'Name: Jo Doe', 'Custom Section: 2 entries', 'Tools: 1 entry',
    ]);
  });
});
