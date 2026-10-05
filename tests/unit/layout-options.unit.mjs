// R2-147-col — the Sidebar's column layout as one module (src/constants/layoutOptions.js): the choices the
// panel offers and the PDF and Word draw, what a stored value prints as, the layout the Sidebar prints
// (sidebarLayout: none for Single · ATS-safe or another template), how a résumé coming in is cleaned
// (withLayoutSettings) and what a JSON Resume export carries (layoutMeta / layoutFromMeta).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LAYOUT_OPTIONS, LAYOUT_DEFAULTS, SIDE_WIDTH_PCT, layoutOption, sideWidthOf, columnsOf, sidebarLayout, withLayoutSettings,
  layoutMeta, layoutFromMeta,
} from '../../src/constants/layoutOptions.js';

test('every choice has a label per option and a default it offers; the width\'s range holds its default', () => {
  assert.deepEqual(LAYOUT_OPTIONS.layoutColumns.map((o) => o.val), ['two', 'mixed']);
  assert.deepEqual(LAYOUT_OPTIONS.layoutDetails.map((o) => o.val), ['left', 'right', 'top']);
  for (const [key, options] of Object.entries(LAYOUT_OPTIONS)) {
    for (const o of options) assert.ok(o.val && o.label, `${key}: every option has a val and a label`);
    assert.ok(options.some((o) => o.val === LAYOUT_DEFAULTS[key]), `${key}: its default is one of its options`);
  }
  assert.deepEqual(SIDE_WIDTH_PCT, { min: 24, max: 45, step: 1, default: 38 });
});

test('a stored choice prints as itself when offered, else as its default; a width on the step inside the range', () => {
  assert.equal(layoutOption('layoutDetails', 'right'), 'right');
  assert.equal(layoutOption('layoutDetails', 'bottom'), 'left');
  assert.equal(layoutOption('layoutColumns', undefined), 'two');
  assert.equal(layoutOption('layoutColumns', { mixed: true }), 'two');
  for (const [stored, prints] of [[30, 30], [30.4, 30], [30.6, 31], ['33', 33], [99, 45], [10, 24], ['abc', 38], [undefined, 38], [null, 38], [true, 38]]) {
    assert.equal(sideWidthOf(stored), prints, `${JSON.stringify(stored)} prints ${prints} %`);
  }
});

test('the Sidebar prints a layout on its two columns only; Single · ATS-safe wins; Mixed has its details on top', () => {
  assert.deepEqual(sidebarLayout('sidebar', {}), { columns: 'two', details: 'left', widthPct: 38 });
  assert.deepEqual(sidebarLayout('sidebar', { layoutDetails: 'right', layoutSideWidth: 30 }), { columns: 'two', details: 'right', widthPct: 30 });
  assert.deepEqual(sidebarLayout('sidebar', { layoutColumns: 'mixed', layoutDetails: 'right' }), { columns: 'mixed', details: 'top', widthPct: 38 });
  assert.equal(sidebarLayout('sidebar', { sidebarSingleColumn: true, layoutColumns: 'mixed' }), null);
  assert.equal(sidebarLayout('classic', { layoutColumns: 'mixed' }), null);
  assert.equal(columnsOf({ sidebarSingleColumn: true }), 'one');
  assert.equal(columnsOf({ layoutColumns: 'mixed' }), 'mixed');
  assert.equal(columnsOf(undefined), 'two');
});

test('a résumé coming in keeps offered choices and a width in range; anything else is dropped, never stored as undefined', () => {
  const same = { settings: { layoutColumns: 'mixed', layoutDetails: 'top', layoutSideWidth: 30 } };
  assert.equal(withLayoutSettings(same), same, 'nothing to change: the same object');
  const none = { settings: { accentColor: '#123456' } };
  assert.equal(withLayoutSettings(none), none);
  const cleaned = withLayoutSettings({ settings: { layoutColumns: 'grid', layoutDetails: 'bottom', layoutSideWidth: '99', accentColor: '#123456' } });
  assert.deepEqual(cleaned.settings, { layoutSideWidth: 45, accentColor: '#123456' });
  const dropped = withLayoutSettings({ settings: { layoutSideWidth: 'wide' } });
  assert.deepEqual(dropped.settings, {});
  assert.equal(Object.values(cleaned.settings).includes(undefined), false, 'no undefined (Firestore refuses one)');
  assert.equal(withLayoutSettings({ settings: 'x' }).settings, 'x', 'settings that are no object are left');
  assert.equal(withLayoutSettings(null), null);
});

test('JSON Resume carries the layout only where it is not the default page; the import reads back what is offered', () => {
  assert.equal(layoutMeta('sidebar', {}), null, 'the default page: nothing');
  assert.equal(layoutMeta('sidebar', { layoutColumns: 'two', layoutDetails: 'left', layoutSideWidth: 38 }), null);
  assert.equal(layoutMeta('sidebar', { sidebarSingleColumn: true, layoutColumns: 'mixed' }), null, 'Single · ATS-safe: its own meta.layout');
  assert.equal(layoutMeta('classic', { layoutColumns: 'mixed' }), null);
  assert.deepEqual(layoutMeta('sidebar', { layoutDetails: 'top' }), { columns: 'two', details: 'top', width: 38 });
  assert.deepEqual(layoutMeta('sidebar', { layoutColumns: 'mixed', layoutSideWidth: '31' }), { columns: 'mixed', details: 'left', width: 31 });
  assert.deepEqual(layoutFromMeta({ columns: 'mixed', details: 'right', width: 30 }), { layoutColumns: 'mixed', layoutDetails: 'right', layoutSideWidth: 30 });
  assert.deepEqual(layoutFromMeta({ columns: 'grid', details: 'bottom', width: 99 }), { layoutSideWidth: 45 });
  assert.deepEqual(layoutFromMeta({ width: 'wide' }), {});
  for (const meta of [null, undefined, 'mixed', 3]) assert.deepEqual(layoutFromMeta(meta), {}, JSON.stringify(meta));
});
