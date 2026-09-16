// Unit tests for Design → Spacing's numbers as saved data carries them (src/constants/spacingNumbers.js):
// normalizeResume() stores each as a number or drops it (withSpacingNumbers), so a value that is
// not a number no longer crashes the editor's Spacing section or prints broken; the default prints
// and the panel shows it (VF2-3.2-NB1-NB1; the panel and the PDFs: tests/pdf/16-saved-data-spacing.test.mjs).
// The margins' range: page-margins.unit.mjs. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withSpacingNumbers } from '../../src/constants/spacingNumbers.js';

const KEYS = ['lineHeightValue', 'marginV', 'marginH', 'sectionGap', 'itemGap'];
const withSettings = (settings) => ({ id: 'r1', template: 'classic', updatedAt: 5, settings: { font: 'Inter', ...settings } });

test('every number row in the Design panel\'s Spacing section is one withSpacingNumbers keeps a number', () => {
  const panel = fs.readFileSync(new URL('../../src/components/DesignPanel.jsx', import.meta.url), 'utf8');
  const rows = [...panel.matchAll(/<NumberRow [^\n]*?updateSetting\('(\w+)', v\)/g)].map((m) => m[1]);
  assert.deepEqual(rows.toSorted(), KEYS.toSorted());
  for (const key of rows) assert.ok(!(key in withSpacingNumbers(withSettings({ [key]: 'abc' })).settings), key);
});

test('withSpacingNumbers: a value that is no number at all is dropped, so the default prints', () => {
  const notNumbers = ['abc', '', '   ', '12px', 'Infinity', '1e999', true, false, {}, [], [12], NaN, Infinity, -Infinity];
  for (const key of KEYS) {
    for (const stored of notNumbers) {
      const r = withSpacingNumbers(withSettings({ [key]: stored, lineHeightValue: key === 'lineHeightValue' ? stored : 1.8 }));
      const at = `${key} ${String(stored)}`;
      assert.ok(!(key in r.settings), `${at}: dropped, not stored as undefined`);
      assert.equal(r.settings.font, 'Inter', `${at}: the other settings kept`);
      if (key !== 'lineHeightValue') assert.equal(r.settings.lineHeightValue, 1.8, `${at}: the other numbers kept`);
      assert.equal(r.updatedAt, 5, `${at}: not an edit`);
    }
  }
  const all = withSpacingNumbers(withSettings(Object.fromEntries(KEYS.map((k) => [k, 'abc']))));
  assert.deepEqual(Object.keys(all.settings), ['font'], 'all five at once');
});

test('withSpacingNumbers: text that is a number is that number, clamped to its control\'s range (VF2-3.2-NB1-NB1-NB2)', () => {
  const cases = [
    ['lineHeightValue', '1.8', 1.8], ['lineHeightValue', ' 2 ', 2], ['lineHeightValue', '50', 3], ['lineHeightValue', 0.5, 1],
    ['sectionGap', '20', 20], ['sectionGap', '-3', 0], ['sectionGap', 999, 60],
    ['itemGap', '0', 0], ['itemGap', '12.5', 12.5], ['itemGap', '90', 40], ['itemGap', -4, 0], ['marginH', '12', 12], ['marginV', '60', 40],
  ];
  for (const [key, stored, kept] of cases) {
    assert.equal(withSpacingNumbers(withSettings({ [key]: stored })).settings[key], kept, `${key} ${JSON.stringify(stored)}`);
  }
});

test('withSpacingNumbers: the same object for numbers in range, none stored, null, or settings that are not an object', () => {
  const numbers = [{ lineHeightValue: 1.5, marginV: 14, marginH: 18, sectionGap: 16, itemGap: 8 }, { lineHeightValue: 3, sectionGap: 60, itemGap: 0 }, {}, { lineHeightValue: null, sectionGap: undefined, itemGap: null }];
  for (const settings of numbers) {
    const r = withSettings(settings);
    assert.equal(withSpacingNumbers(r), r, JSON.stringify(settings));
  }
  for (const r of [null, undefined, {}, { settings: null }, { settings: 'junk' }]) assert.equal(withSpacingNumbers(r), r, JSON.stringify(r));
});
