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

test('HEADER_ICONS defines rich selectable icons with pure vector tags', () => {
  const { HEADER_ICONS, getSelectableIcons } = contactIconPaths;
  assert.ok(Object.keys(HEADER_ICONS).length >= 25);
  
  // Verify all shapes use supported SVG tags: path, rect, circle
  const allowedTags = new Set(['path', 'rect', 'circle']);
  for (const [id, icon] of Object.entries(HEADER_ICONS)) {
    assert.ok(icon.label, `Icon ${id} has label`);
    assert.ok(Array.isArray(icon.shapes) && icon.shapes.length > 0, `Icon ${id} has shapes`);
    for (const [tag] of icon.shapes) {
      assert.ok(allowedTags.has(tag), `Icon ${id} uses allowed tag: ${tag}`);
    }
  }

  // Test getSelectableIcons for email
  const emailIcons = getSelectableIcons('email');
  assert.ok(emailIcons.recommended.length >= 3);
  assert.ok(emailIcons.recommended.some(i => i.id === 'mail'));
  assert.ok(emailIcons.recommended.some(i => i.id === 'send'));
});

test('iconShapes resolves custom selected icons (icon:send, pack:filled)', () => {
  const { iconShapes } = contactIconPaths;

  // Custom icon by id
  const customSend = iconShapes('lucide', 'email', { custom: 'icon:send', color: '#123456' });
  assert.ok(Array.isArray(customSend) && customSend.length > 0);
  assert.equal(customSend[0].props.stroke, '#123456');

  // Custom icon by pack override
  const customPack = iconShapes('lucide', 'phone', { custom: 'pack:filled', color: '#654321' });
  assert.ok(Array.isArray(customPack) && customPack.length > 0);
  assert.equal(customPack[0].props.fill, '#654321');
});

test('getSelectableIcons provides recommended icons for all six contact fields', () => {
  const { getSelectableIcons } = contactIconPaths;
  const fields = ['email', 'phone', 'location', 'website', 'linkedin', 'github'];
  for (const field of fields) {
    const { recommended, others, all } = getSelectableIcons(field);
    assert.ok(recommended.length >= 2, `${field} should have at least 2 recommended icons`);
    assert.ok(all.length >= 25, 'all icons should have full library');
    assert.equal(recommended.length + others.length, all.length);
  }
});


