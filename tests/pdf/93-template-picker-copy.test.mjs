// Design → Template's words (R2-139, A6 and A5): each card's line says what its engine draws, never an ATS
// claim of its own — the badge says that, from atsRating — so Classic no longer claims a "Two-column
// header" the ATS Check warns about, Executive names the role-first one-line entries that set it apart, and
// the Sidebar's card says which page its Layout prints. Under the cards, one line says what a switch keeps
// and what it changes, and it is true: every setting a switch changes is one that line names.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const noop = () => {};

/** The Design panel's HTML for a résumé on `template` with `settings`. */
async function panel(template, settings = {}) {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  return renderToString(createElement(DesignPanel, { resume: resume({ template, settings }), updateSetting: noop, setTemplate: noop, resetSettings: noop }));
}

/** Each template card's description, by template id (the cards carry data-testid="template-<id>"). */
async function descriptions(template, settings) {
  const html = await panel(template, settings);
  const out = {};
  for (const id of TEMPLATES) {
    const card = html.split(`data-testid="template-${id}"`)[1]?.split('</button>')[0];
    out[id] = /<p class="text-\[10px\][^"]*">([^<]*)<\/p>/.exec(card || '')?.[1]?.replace(/&#x27;/g, "'");
  }
  return out;
}

describe('the template cards describe what each engine draws (A6)', () => {
  it('every card has a description, and none makes an ATS claim the badge does not derive', async () => {
    const d = await descriptions('classic');
    for (const id of TEMPLATES) {
      assert.ok(d[id], `${id}: a description`);
      assert.doesNotMatch(d[id], /ATS/, `${id}: "${d[id]}" — the ATS verdict is the badge's, from atsRating`);
    }
  });

  it('Classic does not claim a two-column header: its contacts print in one justified row', async () => {
    assert.doesNotMatch((await descriptions('classic')).classic, /two-column/i);
  });

  it('a template whose jobs print role-first on one line says so (Executive)', async () => {
    const { TEMPLATE_SECTION_DEFAULTS } = await loadModule('/src/templates/pdf/shared/templateSectionDefaults.js');
    const d = await descriptions('classic');
    const inline = TEMPLATES.filter((id) => TEMPLATE_SECTION_DEFAULTS[id]?.experience?.titleStyle === 'inline' && TEMPLATE_SECTION_DEFAULTS[id]?.experience?.titleOrder === 'role');
    assert.ok(inline.includes('executive'));
    for (const id of inline) assert.match(d[id], /role-first/i, `${id}: "${d[id]}"`);
  });

  it('the Sidebar card says which page its Layout prints: the side column, or Classic\'s single column', async () => {
    assert.match((await descriptions('sidebar', { sidebarSingleColumn: false })).sidebar, /side column/);
    const single = (await descriptions('sidebar', { sidebarSingleColumn: true })).sidebar;
    assert.match(single, /Single · ATS-safe/);
    assert.match(single, /one column/);
  });
});

describe('what a template switch keeps and changes (A5)', () => {
  it('the panel says it under the cards, naming the templates that bring their own type and spacing', async () => {
    const html = (await panel('classic')).replace(/&#x27;/g, "'");
    assert.match(html, /Switching template keeps your content and the colours, font and spacing you set/);
    assert.match(html, /changes the heading style and title case/);
    assert.match(html, /Academic and Compact also bring their own type and spacing/);
    assert.match(html, /Name or Job title colour that would not read on its header goes back/);
  });

  it('is true: a switch changes only the settings the line names', async () => {
    const { styleOnSwitch } = await loadModule('/src/utils/defaultData.js');
    const { headerColorsOnSwitch } = await loadModule('/src/templates/pdf/shared/headerColors.js');
    const { templatesBringingType, templateLabel, templateStyleDefaults } = await loadModule('/src/constants/templates.js');
    const bring = templatesBringingType();
    const named = ['headingStyle', 'sectionTitleCase', 'nameColor', 'jobTitleColor'];
    // A résumé with colours, a font and spacing of the user's own — and a white name only the dark column reads.
    const mine = { accentColor: '#9f1239', textColor: '#1f2937', font: 'lato', lineHeightValue: 1.4, sectionGap: 20, marginH: 16, nameColor: '#ffffff', jobTitleColor: '#0f766e' };
    const wrong = [];
    for (const from of TEMPLATES) {
      for (const to of TEMPLATES) {
        if (from === to) continue;
        const before = { ...templateStyleDefaults(from), ...mine };
        const afterSwitch = headerColorsOnSwitch(styleOnSwitch(before, from, to), from, to);
        const allowed = new Set([...named,
          ...(bring.includes(templateLabel(to)) ? Object.keys(templateStyleDefaults(to)) : []),
          ...(bring.includes(templateLabel(from)) ? Object.keys(templateStyleDefaults(from)) : [])]);
        for (const k of new Set([...Object.keys(before), ...Object.keys(afterSwitch)])) {
          if (before[k] !== afterSwitch[k] && !allowed.has(k)) wrong.push(`${from} → ${to}: ${k} ${before[k]} → ${afterSwitch[k]}`);
        }
      }
    }
    assert.deepEqual(wrong, []);
  });
});
