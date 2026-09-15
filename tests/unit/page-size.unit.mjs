// Unit tests for the page size table and how a stored value is read (PAR-01): the PDF, the
// preview and Word all read the size through pageSizeOf(), so a value it reads as A4 prints A4
// everywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_SIZES, PAGE_SIZE_IDS, DEFAULT_PAGE_SIZE, pageSizeOf, pageBoxPt } from '../../src/constants/pageSize.js';

test('pageSizeOf: US Letter in any case; A4 for none, A4 and anything else (PAR-01)', () => {
  for (const pageSize of ['LETTER', 'letter', 'Letter']) assert.equal(pageSizeOf({ pageSize }), 'LETTER', pageSize);
  for (const pageSize of [undefined, null, '', 'A4', 'a4', 'Legal', 'LETTER ', 'constructor', 5, true, {}, ['LETTER']]) {
    assert.equal(pageSizeOf({ pageSize }), 'A4', JSON.stringify(pageSize));
  }
  for (const settings of [undefined, null, {}]) assert.equal(pageSizeOf(settings), 'A4', JSON.stringify(settings));
  assert.equal(DEFAULT_PAGE_SIZE, 'A4');
});

test('PAGE_SIZES: react-pdf\'s boxes in pt, Word\'s in twips (1/20 pt), portrait (PAR-01)', () => {
  assert.deepEqual(PAGE_SIZE_IDS, ['A4', 'LETTER']);
  assert.deepEqual(PAGE_SIZES.A4.pt, { width: 595.28, height: 841.89 });
  assert.deepEqual(PAGE_SIZES.LETTER.pt, { width: 612, height: 792 }); // 8.5 × 11 in
  assert.deepEqual(PAGE_SIZES.A4.twips, { width: 11906, height: 16838 }); // docx's default page
  assert.deepEqual(PAGE_SIZES.LETTER.twips, { width: 12240, height: 15840 });
  for (const id of PAGE_SIZE_IDS) {
    const { pt, twips } = PAGE_SIZES[id];
    assert.deepEqual(twips, { width: Math.round(pt.width * 20), height: Math.round(pt.height * 20) }, id);
    assert.ok(pt.height > pt.width, `${id} is portrait`);
  }
  assert.equal(pageBoxPt({ pageSize: 'letter' }), PAGE_SIZES.LETTER.pt);
  assert.equal(pageBoxPt({}), PAGE_SIZES.A4.pt);
});
