// Unit tests for the page margins' range (src/constants/pageMargins.js): the Design panel's Top /
// Bottom and Left / Right inputs take their bounds from MARGIN_MM, and normalizeResume() brings a
// stored margin into it (withMarginsInRange), so what the panel shows is what the PDF prints
// (VF2-3.2-NB1; the PDFs are checked in tests/pdf/16-saved-data-margins.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MARGIN_MM, withMarginsInRange } from '../../src/constants/pageMargins.js';

const withMargins = (settings) => ({ id: 'r1', template: 'sidebar', updatedAt: 5, settings: { font: 'Inter', ...settings } });

test('MARGIN_MM: 0 to 40 mm, the range every deployed build offered; the Design panel reads its bounds from it', () => {
  assert.deepEqual(MARGIN_MM, { min: 0, max: 40 });
  const panel = fs.readFileSync(new URL('../../src/components/DesignPanel.jsx', import.meta.url), 'utf8');
  for (const key of ['marginV', 'marginH']) {
    assert.match(panel, new RegExp(`updateSetting\\('${key}', v\\)\\} min=\\{MARGIN_MM\\.min\\} max=\\{MARGIN_MM\\.max\\}`), key);
  }
});

test('withMarginsInRange: a number past either end is that end; text the PDF reads as a number is that number', () => {
  const cases = [[41, 40], [60, 40], [1e9, 40], [-1, 0], [-0.5, 0], ['60', 40], [' 75 ', 40], ['12', 12], ['12.5', 12.5], ['-3', 0]];
  for (const [stored, kept] of cases) {
    const r = withMarginsInRange(withMargins({ marginV: stored, marginH: stored }));
    assert.deepEqual([r.settings.marginV, r.settings.marginH], [kept, kept], JSON.stringify(stored));
    assert.equal(r.settings.font, 'Inter', 'the other settings kept');
    assert.equal(r.updatedAt, 5, 'not an edit');
  }
  const one = withMarginsInRange(withMargins({ marginV: 14, marginH: 90 }));
  assert.deepEqual([one.settings.marginV, one.settings.marginH], [14, 40], 'each margin on its own');
});

test('withMarginsInRange: the same object for margins the editor can set, none, or a value that is not a number', () => {
  for (const settings of [{ marginV: 0, marginH: 40 }, { marginV: 14, marginH: 18 }, { marginV: 12.5, marginH: 39.9 }, {}, { marginV: null, marginH: undefined }, { marginH: 'abc' }, { marginH: '' }, { marginV: true }, { marginH: {} }, { marginH: NaN }, { marginV: Infinity }]) {
    const r = withMargins(settings);
    assert.equal(withMarginsInRange(r), r, JSON.stringify(settings));
  }
  for (const r of [null, undefined, {}, { settings: null }, { settings: 'junk' }]) assert.equal(withMarginsInRange(r), r, JSON.stringify(r));
});
