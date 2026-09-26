// Unit guards for what the cover letter's letterhead takes from the résumé template (FIDB-51):
// the template's name the Cover Letter panel shows, and when the letterhead is centred. Their
// own file, so the template table's older tests still load on code without these helpers.
// Guards of the helpers' tables, not fail-before evidence: the helpers came with FIDB-51, so on
// older code this file dies at import (V2FIDB-51-5). The behaviours they stand for are proved
// through the Cover Letter panel, the PDF and the Word letter by
// tests/pdf/21-cover-letter-looks-panel.test.mjs, which fails on them at 0b83cb1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATE_IDS, templateLabel, letterheadCentered } from '../../src/constants/templates.js';

test('templateLabel: each template\'s name as the editor shows it; an unknown id is Classic (FIDB-51)', () => {
  assert.deepEqual(TEMPLATE_IDS.map(templateLabel), [
    'Classic', 'Modern', 'Minimal', 'Executive', 'Sidebar', 'Timeline', 'Banner', 'Academic', 'Compact',
    'Gridline', 'Registry', 'Bookend', 'Lectern', 'Chronicle', 'Keystone', 'Banded', 'Keel', 'Linen', 'Broadsheet',
  ]);
  for (const id of ['dark', '', undefined]) assert.equal(templateLabel(id), 'Classic', String(id));
});

test('letterheadCentered: the letter centres its letterhead exactly where the résumé centres its header (FIDB-51)', () => {
  for (const t of ['classic', 'minimal', 'executive', 'dark']) {
    assert.equal(letterheadCentered({ headerAlign: 'center' }, t), true, t);
    for (const headerAlign of ['left', undefined]) assert.equal(letterheadCentered({ headerAlign }, t), false, `${t} ${headerAlign}`);
  }
  for (const t of ['modern', 'sidebar']) assert.equal(letterheadCentered({ headerAlign: 'center' }, t), false, `${t} takes no alignment`);
  assert.equal(letterheadCentered(undefined, 'classic'), false);
});
