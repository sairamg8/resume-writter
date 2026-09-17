// Unit tests for contact icon pack definitions and shapes (src/utils/contactIconPaths.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as contactIconPaths from '../../src/utils/contactIconPaths.js';

const { ICON_PACKS, getIconSetId, getCustomContactIcon, iconShapes } = contactIconPaths;

const FIELDS = ['email', 'phone', 'location', 'website', 'linkedin', 'github'];
const PACK_IDS = ['filled', 'lucide', 'refined', 'minimal', 'bold'];

test('ICON_PACKS offers five packs with correct paint mode', () => {
  assert.deepEqual(Object.keys(ICON_PACKS), PACK_IDS);
  assert.equal(ICON_PACKS.filled.paint, 'fill');
  assert.equal(ICON_PACKS.lucide.paint, 'stroke');
  assert.equal(ICON_PACKS.refined.paint, 'stroke');
  assert.equal(ICON_PACKS.minimal.paint, 'stroke');
  assert.equal(ICON_PACKS.bold.paint, 'stroke');
});

test('Filled pack phone icon is pinned to its solid handset path (W3-5.3)', () => {
  const filledPhone = ICON_PACKS.filled.icons.phone;
  assert.ok(Array.isArray(filledPhone) && filledPhone.length > 0);
  assert.equal(filledPhone[0][0], 'path');
  assert.match(filledPhone[0][1].d, /^M7\.05 2\.6/);
});

test('Every pack defines shapes for all six contact fields', () => {
  for (const packId of PACK_IDS) {
    for (const field of FIELDS) {
      const shapes = iconShapes(packId, field, { color: '#000000' });
      assert.ok(Array.isArray(shapes) && shapes.length > 0, `${packId} ${field} has shapes`);
      for (const shape of shapes) {
        assert.ok(typeof shape.tag === 'string', `${packId} ${field} shape has tag`);
        assert.ok(typeof shape.props === 'object', `${packId} ${field} shape has props`);
      }
    }
  }
});

test('All five packs produce pairwise distinct shapes for phone and every contact field (W3-5.3)', () => {
  for (const field of FIELDS) {
    const serialized = PACK_IDS.map((p) => JSON.stringify(iconShapes(p, field, { color: '#111827' })));
    const unique = new Set(serialized);
    assert.equal(unique.size, 5, `field ${field} produces 5 distinct shape definitions across packs`);
  }
});

test('Underlying icon sets (Filled, Classic, Modern, Minimal) have pairwise distinct path data (W3-5.3)', () => {
  const distinctIconSets = ['filled', 'lucide', 'refined', 'minimal'];
  for (const field of FIELDS) {
    const serialized = distinctIconSets.map((p) => JSON.stringify(ICON_PACKS[p].icons[field]));
    const unique = new Set(serialized);
    assert.equal(unique.size, 4, `field ${field} has pairwise distinct raw icon definitions`);
  }
});

test('getIconSetId returns known pack id or falls back to lucide', () => {
  assert.equal(getIconSetId({ iconSet: 'filled' }), 'filled');
  assert.equal(getIconSetId({ iconSet: 'lucide' }), 'lucide');
  assert.equal(getIconSetId({ iconSet: 'refined' }), 'refined');
  assert.equal(getIconSetId({ iconSet: 'minimal' }), 'minimal');
  assert.equal(getIconSetId({ iconSet: 'bold' }), 'bold');
  assert.equal(getIconSetId({ iconSet: 'unknown' }), 'lucide');
  assert.equal(getIconSetId(null), 'lucide');
  assert.equal(getIconSetId({}), 'lucide');
});

test('getCustomContactIcon extracts custom URL or returns null', () => {
  assert.equal(getCustomContactIcon('phone', { customContactIcons: { phone: 'data:image/png;base64,abc' } }), 'data:image/png;base64,abc');
  assert.equal(getCustomContactIcon('email', { customContactIcons: { phone: 'data:image/png;base64,abc' } }), null);
  assert.equal(getCustomContactIcon('phone', { customContactIcons: { phone: '   ' } }), null);
  assert.equal(getCustomContactIcon('phone', null), null);
});
