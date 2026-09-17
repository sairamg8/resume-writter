// Unit tests for the page size table and how a stored value is read (PAR-01): the PDF, the
// preview and Word all read the size through pageSizeOf(), so a value it reads as A4 prints A4
// everywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_SIZES, PAGE_SIZE_IDS, DEFAULT_PAGE_SIZE, pageSizeOf, pageBoxPt, previewBox } from '../../src/constants/pageSize.js';

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

test('previewBox: 100% width and placeholder ratio match page size (ONB-9-NB1)', () => {
  // A4 defaults to 794 px width (210 mm at 96 dpi) and exactly 1.4142 ratio
  for (const settings of [undefined, null, {}, { pageSize: 'A4' }, { pageSize: 'a4' }, { pageSize: 'other' }]) {
    assert.deepEqual(previewBox(settings), { widthPx: 794, ratio: 1.4142 }, JSON.stringify(settings));
  }
  // Handles resume object with settings property
  assert.deepEqual(previewBox({ settings: { pageSize: 'A4' } }), { widthPx: 794, ratio: 1.4142 });

  // Letter: 8.5 in at 96 dpi = 816 px, aspect ratio 11 / 8.5 = 792 / 612 (~1.2941)
  const letterBox = previewBox({ pageSize: 'LETTER' });
  assert.equal(letterBox.widthPx, 816);
  assert.ok(Math.abs(letterBox.ratio - 1.2941) < 0.001);
  assert.equal(letterBox.ratio, 792 / 612);

  // Resume object for Letter
  const letterResumeBox = previewBox({ settings: { pageSize: 'letter' } });
  assert.equal(letterResumeBox.widthPx, 816);
  assert.equal(letterResumeBox.ratio, 792 / 612);
});
