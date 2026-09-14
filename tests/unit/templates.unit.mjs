// Unit tests for the template table (src/constants/templates.js). Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEMPLATE_IDS, templateId, withKnownTemplate, hasHeaderControls, headerBorderOn, templateStyleDefaults,
  SIDEBAR_COLUMN_TYPES, inSidebarColumn, drawsContactIcons, photoTextAlignItems,
} from '../../src/constants/templates.js';

test('templateId: the five templates stay; any other id reads as Classic (M15)', () => {
  for (const id of TEMPLATE_IDS) assert.equal(templateId(id), id);
  assert.deepEqual(TEMPLATE_IDS.toSorted(), ['classic', 'executive', 'minimal', 'modern', 'sidebar']);
  for (const id of ['dark', 'Modern', 'aurora', '', null, undefined, 42, {}]) assert.equal(templateId(id), 'classic', String(id));
});

test('withKnownTemplate: an unknown or missing id becomes Classic, nothing else changes (M15)', () => {
  const dark = { id: 'resume_dark', name: 'Dark', template: 'dark', updatedAt: 5, settings: { accentColor: '#0f172a' } };
  const fixed = withKnownTemplate(dark);
  assert.deepEqual(fixed, { ...dark, template: 'classic' });
  assert.equal(dark.template, 'dark', 'the input is not mutated');
  assert.equal(fixed.updatedAt, 5, 'not a user edit: updatedAt is kept');
  assert.equal(withKnownTemplate({ id: 'r' }).template, 'classic');

  const sidebar = { id: 'r2', template: 'sidebar' };
  assert.equal(withKnownTemplate(sidebar), sidebar, 'a known template: the same object');
  assert.equal(withKnownTemplate(null), null);
});

test('header helpers read an unknown id as Classic (M15)', () => {
  assert.equal(hasHeaderControls('dark'), true);
  assert.equal(headerBorderOn({}, 'dark'), true, 'Classic draws the rule when the setting is unset');
  assert.equal(headerBorderOn({ showHeaderBorder: false }, 'dark'), false);
  assert.equal(hasHeaderControls('modern'), false);
  assert.equal(headerBorderOn({}, 'executive'), false);
});

test('templateStyleDefaults: each template\'s heading style and title case; an unknown id gets Classic\'s (M16)', () => {
  assert.deepEqual(
    Object.fromEntries(TEMPLATE_IDS.map((t) => [t, templateStyleDefaults(t)])),
    {
      classic: { headingStyle: 'ruled', sectionTitleCase: 'upper' },
      modern: { headingStyle: 'line', sectionTitleCase: 'upper' },
      minimal: { headingStyle: 'underline', sectionTitleCase: 'upper' },
      executive: { headingStyle: 'underline', sectionTitleCase: 'normal' },
      sidebar: { headingStyle: 'plain', sectionTitleCase: 'upper' },
    },
  );
  assert.deepEqual(templateStyleDefaults('dark'), templateStyleDefaults('classic'));
  templateStyleDefaults('executive').headingStyle = 'box';
  assert.equal(templateStyleDefaults('executive').headingStyle, 'underline', 'callers get a copy');
});

test('inSidebarColumn: Sidebar prints skills, education, languages, certifications, interests and references in its side column (FIDB-75)', () => {
  assert.deepEqual(SIDEBAR_COLUMN_TYPES.toSorted(), ['certifications', 'education', 'interests', 'languages', 'references', 'skills']);
  for (const type of SIDEBAR_COLUMN_TYPES) {
    assert.equal(inSidebarColumn('sidebar', type), true, type);
    for (const other of ['classic', 'modern', 'minimal', 'executive', 'dark']) assert.equal(inSidebarColumn(other, type), false, `${other} ${type}`);
  }
  for (const type of ['experience', 'projects', 'awards', 'volunteering', 'custom']) assert.equal(inSidebarColumn('sidebar', type), false, type);
});

test('drawsContactIcons: Modern and Sidebar always draw icons; the others with Contact Style "Icon" (R1-2)', () => {
  for (const style of [undefined, '', 'icon', 'bullet', 'bar']) {
    assert.equal(drawsContactIcons('modern', { contactStyle: style }), true, `modern ${style}`);
    assert.equal(drawsContactIcons('sidebar', { contactStyle: style }), true, `sidebar ${style}`);
    for (const t of ['classic', 'minimal', 'executive', 'dark']) {
      assert.equal(drawsContactIcons(t, { contactStyle: style }), !style || style === 'icon', `${t} ${style}`);
    }
  }
  assert.equal(drawsContactIcons('classic', undefined), true, 'no settings: the default style, Icon');
});

test('photoTextAlignItems: Top / Center / Bottom as a flex alignment, Center when unset (R3-0)', () => {
  assert.deepEqual(['top', 'center', 'bottom', undefined, 'junk'].map((photoTextAlign) => photoTextAlignItems({ photoTextAlign })),
    ['flex-start', 'center', 'flex-end', 'center', 'center']);
  assert.equal(photoTextAlignItems(undefined), 'center');
});
