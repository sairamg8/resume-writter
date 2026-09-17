// Unit tests for the page margins' range (src/constants/pageMargins.js): the Design panel's Top /
// Bottom and Left / Right inputs take their bounds from MARGIN_MM, and normalizeResume() brings a
// stored margin into it (withSpacingNumbers, src/constants/spacingNumbers.js), so what the panel
// shows is what the PDF prints (VF2-3.2-NB1; the PDFs are checked in
// tests/pdf/16-saved-data-margins.test.mjs). A margin that is not a number: spacing-numbers.unit.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MARGIN_MM, pageMargins } from '../../src/constants/pageMargins.js';
import { withSpacingNumbers } from '../../src/constants/spacingNumbers.js';

const withMargins = (settings) => ({ id: 'r1', template: 'sidebar', updatedAt: 5, settings: { font: 'Inter', ...settings } });

test('MARGIN_MM: 0 to 40 mm, the range every deployed build offered; the Design panel reads its bounds from it', () => {
  assert.deepEqual(MARGIN_MM, { min: 0, max: 40 });
  const panel = fs.readFileSync(new URL('../../src/components/DesignPanel.jsx', import.meta.url), 'utf8');
  for (const key of ['marginV', 'marginH']) {
    assert.match(panel, new RegExp(`updateSetting\\('${key}', v\\)\\} min=\\{MARGIN_MM\\.min\\} max=\\{MARGIN_MM\\.max\\}`), key);
  }
});

test('withSpacingNumbers: a margin past either end is that end; text the PDF reads as a number is that number', () => {
  const cases = [[41, 40], [60, 40], [1e9, 40], [-1, 0], [-0.5, 0], ['60', 40], [' 75 ', 40], ['12', 12], ['12.5', 12.5], ['-3', 0]];
  for (const [stored, kept] of cases) {
    const r = withSpacingNumbers(withMargins({ marginV: stored, marginH: stored }));
    assert.deepEqual([r.settings.marginV, r.settings.marginH], [kept, kept], JSON.stringify(stored));
    assert.equal(r.settings.font, 'Inter', 'the other settings kept');
    assert.equal(r.updatedAt, 5, 'not an edit');
  }
  const one = withSpacingNumbers(withMargins({ marginV: 14, marginH: 90 }));
  assert.deepEqual([one.settings.marginV, one.settings.marginH], [14, 40], 'each margin on its own');
});

test('withSpacingNumbers: the same object for margins the editor can set, or none', () => {
  for (const settings of [{ marginV: 0, marginH: 40 }, { marginV: 14, marginH: 18 }, { marginV: 12.5, marginH: 39.9 }, {}, { marginV: null, marginH: undefined }]) {
    const r = withMargins(settings);
    assert.equal(withSpacingNumbers(r), r, JSON.stringify(settings));
  }
  for (const r of [null, undefined, {}, { settings: null }, { settings: 'junk' }]) assert.equal(withSpacingNumbers(r), r, JSON.stringify(r));
});

test('pageMargins: defaults to 14 mm top/bottom, 18 mm left/right when unset', () => {
  assert.deepEqual(pageMargins({}), { v: 14, h: 18 });
  assert.deepEqual(pageMargins(null), { v: 14, h: 18 });
  assert.deepEqual(pageMargins({ marginV: 20, marginH: 25 }), { v: 20, h: 25 });
});

test('drift guard: no raw margin[VH] ?? fallbacks in src/templates', () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(full) : e.name.endsWith('.js') || e.name.endsWith('.jsx') ? [full] : [];
  });
  const files = walk(new URL('../../src/templates', import.meta.url).pathname);
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    assert.ok(!/margin[VH]\s*\?\?/.test(content), `${f} has raw margin fallback: use pageMargins()`);
  }
});

