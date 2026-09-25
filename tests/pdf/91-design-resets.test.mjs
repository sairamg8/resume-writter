// Design → each section's ↺ (R2-157): DesignPanel's resetSection writes that section's keys — and
// only those — back to what the résumé's template brings (sectionReset over defaultSettings). No test
// in the gate clicked them: 86-icon-reset-keeps-contact-style pins only that Contact icons' ↺ leaves
// the Contact Style alone, and 15-design-defaults calls sectionReset itself, never the panel. A key
// dropped from a section's list, a key from another section, or the ATS defaults written where the
// template has its own (Academic's spacing, Compact's 9 pt base, Sidebar's plain headings) would pass.
// The real panel is mounted over the fake DOM with a spy store; each ↺ is clicked as a person does.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/** A résumé on `template` with every setting a ↺ resets moved off its default, and three it must not touch. */
const customised = (template) => resume({
  template,
  settings: {
    accentColor: '#e11d48', textColor: '#0f172a', sidebarBg: '#14532d', headerTextColor: '#fef3c7', nameColor: '#7c3aed', jobTitleColor: '#0d9488',
    iconSet: 'bold', iconSize: 17,
    font: 'lato', fontSize: 'large', fontSizeBase: 13, fontSizeNameDelta: 12, fontSizeSectionDelta: 3, fontSizeEntryDelta: 2, customFont: 'Fictional Grotesk',
    sectionLetterSpacing: 12, fontSizeTitleDelta: 5,
    lineHeightValue: 1.8, marginV: 25, marginH: 30, sectionGap: 28, itemGap: 15,
    headingStyle: 'box', sectionTitleCase: 'normal', sectionBorderWidth: 4, sectionBorderColor: '#ea580c',
    dateFormat: 'YYYY-MM',
    bulletStyle: 'dash',
    pageNumbers: true,
    // None of these is any ↺'s: Header Customization's style, the paper, the uploads.
    contactStyle: 'bar', pageSize: 'LETTER', customContactIcons: { email: 'icon:send' },
  },
  personal: { name: 'Robin Quill', email: 'robin@example.com' },
});

/**
 * The Design panel for `r`, as the editor mounts it, with a spy updateSetting: `reset(title)` clicks
 * that section's ↺ and returns the [key, value] writes it made, in order; `unmount`.
 */
async function panel(r) {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  const writes = [];
  const view = mount(DesignPanel, { resume: r, updateSetting: (key, value) => writes.push([key, value]), setTemplate: () => {}, resetSettings: () => {} });
  return {
    reset(title) {
      const button = [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === `Reset ${title} to defaults`);
      assert.ok(button, `the ${title} ↺`);
      writes.length = 0;
      let stopped = false;
      view.act(() => reactProps(button).onClick({ stopPropagation: () => { stopped = true; } }));
      assert.ok(stopped, `${title}: the ↺ keeps its click from the section header`);
      return [...writes];
    },
    unmount: () => view.unmount(),
  };
}

/** Classic's (and every template's) own values for each section's keys, written out, in the order the ↺ writes them. */
const CLASSIC = {
  Colors: [['accentColor', '#374151'], ['textColor', '#111111'], ['sidebarBg', '#1e293b'], ['headerTextColor', '#ffffff'], ['nameColor', ''], ['jobTitleColor', '']],
  'Contact icons': [['iconSet', 'filled'], ['iconSize', 11]],
  Typography: [['font', 'notosans'], ['fontSize', 'normal'], ['fontSizeBase', 11], ['fontSizeNameDelta', 8], ['fontSizeSectionDelta', 1], ['fontSizeEntryDelta', 0], ['customFont', ''], ['iconSize', 11],
    // Title Spacing and Job Title (R2-146): unset, each follows its template's own look.
    ['sectionLetterSpacing', null], ['fontSizeTitleDelta', null]],
  Spacing: [['lineHeightValue', 1.5], ['marginV', 14], ['marginH', 18], ['sectionGap', 16], ['itemGap', 8]],
  'Section Headings': [['headingStyle', 'ruled'], ['sectionTitleCase', 'upper'], ['sectionBorderWidth', 1], ['sectionBorderColor', '']],
  Dates: [['dateFormat', 'asEntered']],
  Lists: [['bulletStyle', 'bullet']],
  // Page numbers (R2-147): off, as every résumé storing none prints.
  'Page numbers': [['pageNumbers', false]],
};

/** `CLASSIC` with a template's own values over it: [section, key, value] each. */
const over = (changes) => {
  const out = Object.fromEntries(Object.entries(CLASSIC).map(([s, w]) => [s, w.map(([k, v]) => [k, v])]));
  for (const [s, key, value] of changes) out[s].find((w) => w[0] === key)[1] = value;
  return out;
};

describe('Design → a section\'s ↺ writes its own keys back to the template\'s values, and nothing else (R2-157)', () => {
  it('Classic: each of the eight ↺s writes exactly its section\'s keys, at Classic\'s values', async () => {
    const view = await panel(customised('classic'));
    try {
      for (const [title, expected] of Object.entries(CLASSIC)) {
        assert.deepEqual(view.reset(title), expected, title);
      }
    } finally { await view.unmount(); }
  });

  it('the template\'s own values, not the ATS defaults: Academic, Compact, Sidebar and Executive', async () => {
    const cases = {
      academic: over([
        ['Typography', 'font', 'sourceserif'], ['Typography', 'fontSizeSectionDelta', 0],
        ['Spacing', 'lineHeightValue', 1.35], ['Spacing', 'sectionGap', 12], ['Spacing', 'itemGap', 6],
      ]),
      compact: over([
        ['Typography', 'fontSizeBase', 9],
        ['Spacing', 'lineHeightValue', 1.3], ['Spacing', 'marginV', 10], ['Spacing', 'marginH', 12], ['Spacing', 'sectionGap', 10], ['Spacing', 'itemGap', 5],
        ['Section Headings', 'headingStyle', 'line'],
      ]),
      sidebar: over([['Section Headings', 'headingStyle', 'plain']]),
      executive: over([['Section Headings', 'headingStyle', 'underline'], ['Section Headings', 'sectionTitleCase', 'normal']]),
    };
    for (const [template, sections] of Object.entries(cases)) {
      const view = await panel(customised(template));
      try {
        for (const [title, expected] of Object.entries(sections)) {
          assert.deepEqual(view.reset(title), expected, `${template}: ${title}`);
        }
      } finally { await view.unmount(); }
    }
  });

  it('no ↺ writes the Contact Style, the paper, the Sidebar\'s Layout or the uploaded icons', async () => {
    const r = customised('sidebar');
    r.settings.sidebarSingleColumn = true;
    const view = await panel(r);
    try {
      const written = new Set(Object.keys(CLASSIC).flatMap((title) => view.reset(title).map(([key]) => key)));
      for (const key of ['contactStyle', 'pageSize', 'sidebarSingleColumn', 'customContactIcons']) {
        assert.equal(written.has(key), false, `${key} written by a ↺`);
      }
    } finally { await view.unmount(); }
  });
});
