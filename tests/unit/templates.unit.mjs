// Unit tests for the template table (src/constants/templates.js). Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
// A namespace import, not named ones: on older code a helper that is missing is undefined and
// fails only its own test, where a missing named import stops the whole file loading (R2-8, R9-11).
import * as templates from '../../src/constants/templates.js';
import { buildTestState } from '../helpers.js';

const {
  TEMPLATE_IDS, templateId, withKnownTemplate, hasHeaderControls, headerBorderOn, templateStyleDefaults,
  SIDEBAR_COLUMN_TYPES, inSidebarColumn, drawsContactIcons, photoTextAlignItems, headerControlTemplateLabels,
  headingBorderControls, anyDrawsContactIcons, contactIconHint,
} = templates;

test('templateId: the five templates stay, however an imported file cases or spaces them; any other id reads as Classic (M15, R5-5)', () => {
  for (const id of TEMPLATE_IDS) assert.equal(templateId(id), id);
  assert.deepEqual(TEMPLATE_IDS.toSorted(), ['classic', 'executive', 'minimal', 'modern', 'sidebar']);
  for (const [written, id] of [['Modern', 'modern'], [' sidebar ', 'sidebar'], ['EXECUTIVE', 'executive'], ['Minimal\n', 'minimal'], ['Classic', 'classic']]) {
    assert.equal(templateId(written), id, JSON.stringify(written));
  }
  for (const id of ['dark', 'Dark', 'aurora', '', '  ', null, undefined, 42, {}, ['modern']]) assert.equal(templateId(id), 'classic', String(id));
});

test('withKnownTemplate: an id in another case is the template it names; an unknown or missing id becomes Classic; nothing else changes (M15, R5-5)', () => {
  const dark = { id: 'resume_dark', name: 'Dark', template: 'dark', updatedAt: 5, settings: { accentColor: '#0f172a' } };
  const fixed = withKnownTemplate(dark);
  assert.deepEqual(fixed, { ...dark, template: 'classic' });
  assert.equal(dark.template, 'dark', 'the input is not mutated');
  assert.equal(fixed.updatedAt, 5, 'not a user edit: updatedAt is kept');
  assert.equal(withKnownTemplate({ id: 'r' }).template, 'classic');
  assert.deepEqual(withKnownTemplate({ ...dark, template: 'Modern ' }), { ...dark, template: 'modern' }, 'an import\'s "Modern " is Modern');

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

test('the header helpers give each template the answers of the separate tables they replaced (R3-6)', () => {
  // HEADER_CONTROL_TEMPLATES and HEADER_BORDER_WHEN_UNSET, as they were at 01e9118: a guard
  // that folding them into TEMPLATES changed no answer.
  const CONTROLS = { classic: true, modern: false, minimal: true, executive: true, sidebar: false };
  const RULE_WHEN_UNSET = { classic: true, modern: false, minimal: false, executive: false, sidebar: false };
  assert.deepEqual(TEMPLATE_IDS, ['classic', 'modern', 'minimal', 'executive', 'sidebar']);
  for (const template of [...TEMPLATE_IDS, 'dark', '', undefined]) {
    const t = templateId(template);
    assert.equal(hasHeaderControls(template), CONTROLS[t], `${template}: controls`);
    for (const settings of [undefined, {}, { showHeaderBorder: undefined }, { showHeaderBorder: null }, { showHeaderBorder: 'yes' }]) {
      assert.equal(headerBorderOn(settings, template), RULE_WHEN_UNSET[t], `${template} ${JSON.stringify(settings)}: the rule when unset`);
    }
    for (const showHeaderBorder of [true, false]) assert.equal(headerBorderOn({ showHeaderBorder }, template), showHeaderBorder);
  }
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

test('buildTestState: headingStyle and sectionTitleCase match templateStyleDefaults for all templates (NB-8)', () => {
  for (const t of TEMPLATE_IDS) {
    const r = buildTestState(t).resumes[0];
    const expected = templateStyleDefaults(t);
    assert.equal(r.settings.headingStyle, expected.headingStyle, `${t} headingStyle`);
    assert.equal(r.settings.sectionTitleCase, expected.sectionTitleCase, `${t} sectionTitleCase`);
  }
});

test('headerControlTemplateLabels: returns templates with headerControls in order (FIDB-51-VF7-NB1)', () => {
  assert.deepEqual(headerControlTemplateLabels(), ['Classic', 'Minimal', 'Executive']);

  // Custom table with extra template prevents drift when new templates are added
  const customTable = {
    classic: { label: 'Classic', headerControls: true },
    modern: { label: 'Modern', headerControls: false },
    minimal: { label: 'Minimal', headerControls: true },
    executive: { label: 'Executive', headerControls: true },
    sidebar: { label: 'Sidebar', headerControls: false },
    compact: { label: 'Compact', headerControls: true },
  };
  assert.deepEqual(headerControlTemplateLabels(customTable), ['Classic', 'Minimal', 'Executive', 'Compact']);
});

test('headingBorderControls: thickness and color applicability per heading style (ONB-13)', () => {
  for (const style of ['ruled', 'leftbar', 'line', 'underline']) {
    assert.deepEqual(headingBorderControls(style), { thickness: true, color: true }, style);
  }
  assert.deepEqual(headingBorderControls('box'), { thickness: false, color: true });
  assert.deepEqual(headingBorderControls('plain'), { thickness: false, color: false });
  for (const unknown of [undefined, null, '', 'unknown']) {
    assert.deepEqual(headingBorderControls(unknown), { thickness: false, color: false }, String(unknown));
  }
});

test('anyDrawsContactIcons: true if resume or letter draws icons (ONB-8)', () => {
  // Classic Bar + letter Bar: false
  assert.equal(anyDrawsContactIcons('classic', { contactStyle: 'bar' }, { headerStyle: 'bar' }), false);
  // Classic Bar + letter Icon: true
  assert.equal(anyDrawsContactIcons('classic', { contactStyle: 'bar' }, { headerStyle: 'icon' }), true);
  // Modern: true
  assert.equal(anyDrawsContactIcons('modern', { contactStyle: 'bar' }, { headerStyle: 'bar' }), true);
  // Sidebar: true
  assert.equal(anyDrawsContactIcons('sidebar', { contactStyle: 'bar' }, { headerStyle: 'bar' }), true);
  // Letter with no headerStyle inherits settings.contactStyle
  assert.equal(anyDrawsContactIcons('classic', { contactStyle: 'bar' }, {}), false);
  assert.equal(anyDrawsContactIcons('classic', { contactStyle: 'icon' }, {}), true);
});

test('contactIconHint: explains icon usage and when custom icon uploads appear (ONB-8)', () => {
  // When icons are not shown anywhere: notes "while icons are shown" and "Picking a pack switches"
  const hidden = contactIconHint('classic', { contactStyle: 'bar' }, { headerStyle: 'bar' });
  assert.match(hidden, /Used by the résumé when Contact style is Icon/);
  assert.match(hidden, /Picking a pack switches the résumé to Icon/);
  assert.match(hidden, /Custom images per field appear under Personal Info → Fields while icons are shown\./);

  // When letter draws icons: uploads ARE shown, so no "while icons are shown" qualifier
  const letterShows = contactIconHint('classic', { contactStyle: 'bar' }, { headerStyle: 'icon' });
  assert.match(letterShows, /Custom images per field appear under Personal Info → Fields\./);
  assert.doesNotMatch(letterShows, /while icons are shown/);

  // Modern / Sidebar: always shows them
  for (const t of ['modern', 'sidebar']) {
    const hint = contactIconHint(t, { contactStyle: 'bar' }, {});
    assert.match(hint, new RegExp(`${t === 'modern' ? 'Modern' : 'Sidebar'} template always shows them`));
    assert.match(hint, /Custom images per field appear under Personal Info → Fields\./);
    assert.doesNotMatch(hint, /while icons are shown/);
  }
});

test('AUD-17: Sidebar Single · ATS-safe mode enables header controls and disables side column', () => {
  const singleSettings = { sidebarSingleColumn: true };

  // hasHeaderControls is true in single column mode
  assert.equal(hasHeaderControls('sidebar', singleSettings), true);
  // headerBorderOn defaults to Classic's rule (true) in single column mode
  assert.equal(headerBorderOn(singleSettings, 'sidebar'), true);

  // inSidebarColumn is false in single column mode
  for (const type of SIDEBAR_COLUMN_TYPES) {
    assert.equal(inSidebarColumn('sidebar', type, singleSettings), false, `${type} in single column`);
  }
});
