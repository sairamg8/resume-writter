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



test('isContactIconImage: uploads are images; header icon picker choices are not', () => {
  const { isContactIconImage } = contactIconPaths;
  for (const src of ['data:image/png;base64,AAAA', 'data:image/svg+xml;base64,AAAA', 'https://example.com/i.png', 'http://example.com/i.png']) {
    assert.equal(isContactIconImage(src), true, src);
  }
  for (const src of ['icon:send', 'pack:filled', 'send', 'filled', '', null, undefined, 42, { src: 'data:image/png' }]) {
    assert.equal(isContactIconImage(src), false, String(src));
  }
});

test('a picked icon resolves to its own shapes, a picked pack to that pack\'s field icon', () => {
  const send = iconShapes('lucide', 'email', { color: '#000000', custom: 'icon:send' });
  assert.deepEqual(send.map((s) => s.props.d), ['m22 2-7 20-4-9-9-4Z', 'M22 2 11 13']);
  const phone = iconShapes('lucide', 'phone', { color: '#000000', custom: 'pack:filled' });
  assert.deepEqual(phone, iconShapes('filled', 'phone', { color: '#000000' }));
});

// The header icon picker offers every HEADER_ICONS icon for every field (All Icons) and every pack
// (Style Packs). Each choice must resolve to its own shapes whatever the field and the global pack.
const { HEADER_ICONS, getSelectableIcons, isContactIconImage } = contactIconPaths;

test('every picker icon, on every field and over every pack, resolves to its own shapes and paint', () => {
  for (const [id, item] of Object.entries(HEADER_ICONS)) {
    for (const field of FIELDS) {
      for (const setId of PACK_IDS) {
        const shapes = iconShapes(setId, field, { color: '#123456', custom: `icon:${id}` });
        assert.equal(shapes?.length, item.shapes.length, `${id} on ${field} over ${setId}`);
        shapes.forEach((s, i) => {
          const [tag, attrs] = item.shapes[i];
          assert.equal(s.tag, tag, `${id} shape ${i} tag`);
          for (const [k, v] of Object.entries(attrs)) assert.equal(s.props[k], v, `${id} shape ${i} ${k}`);
          if ((item.paint || 'stroke') === 'fill') {
            assert.equal(s.props.fill, '#123456'); assert.equal(s.props.stroke, 'none');
          } else {
            assert.equal(s.props.stroke, '#123456'); assert.equal(s.props.fill, 'none');
            assert.equal(s.props.strokeWidth, item.strokeWidth ?? 2, `${id} stroke width`);
          }
        });
      }
    }
  }
});

test('every Style Packs choice, on every field, is that pack\'s icon for the field', () => {
  for (const packId of PACK_IDS) {
    for (const field of FIELDS) {
      for (const setId of PACK_IDS) {
        assert.deepEqual(
          iconShapes(setId, field, { color: '#000000', custom: `pack:${packId}` }),
          iconShapes(packId, field, { color: '#000000' }),
          `pack:${packId} on ${field} over ${setId}`,
        );
      }
    }
  }
});

test('a pick the app no longer knows falls back to the global pack icon, never to nothing', () => {
  for (const custom of ['icon:removed-icon', 'pack:removed-pack', 'removed', 'icon:', 'pack:']) {
    for (const field of FIELDS) {
      assert.deepEqual(iconShapes('bold', field, { color: '#000000', custom }), iconShapes('bold', field, { color: '#000000' }), `${custom} on ${field}`);
    }
  }
});

test('the picker catalogue: unique ids, only shapes both renderers draw, known fields, recommendations for every field', () => {
  const DRAWN = new Set(['path', 'rect', 'circle']); // PdfIcons.jsx SHAPES; the editor draws the same tags as <svg> children
  for (const [id, item] of Object.entries(HEADER_ICONS)) {
    assert.equal(item.id, id);
    assert.ok(item.label, `${id} has a label`);
    assert.ok(item.shapes.length > 0, `${id} has shapes`);
    for (const [tag] of item.shapes) assert.ok(DRAWN.has(tag), `${id}: <${tag}> is not drawn by the PDF`);
    for (const f of item.fields || []) assert.ok(FIELDS.includes(f), `${id}: unknown field ${f}`);
    assert.equal(isContactIconImage(`icon:${id}`), false);
  }
  for (const field of FIELDS) assert.ok(getSelectableIcons(field).recommended.length > 0, `${field} has recommended icons`);
  assert.equal(getSelectableIcons().all.length, Object.keys(HEADER_ICONS).length);
});
