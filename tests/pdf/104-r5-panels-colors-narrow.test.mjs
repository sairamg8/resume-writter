// R4-DVIS-34 (follow-up, R5 panels review): Design → Colors → Name & Title Colors in an editor panel
// dragged to usePanelResize's 240 px least. The value label ("Template default", max-w-28 truncate) sat
// in a group (flex, gap-2) with no min-w-0, so the group could not narrow below its full min-content:
// the 40 px swatch, the gap and all ~106 px of "Template default". With the row label wrapped to "color"
// the row needed about 184 px of the ~174 px inside the section, so it ran past the section's edge and,
// with a classic scrollbar, was cut mid-letter with no ellipsis: truncate never engaged. The group now
// narrows (min-w-0), so the value text shortens with an ellipsis ("Template d…"); the swatch and the ↺
// reset keep their size (shrink-0), and the row keeps a gap between its label and the group. At the
// usual 360 px "Template default" still shows in full (max-w-28 is unchanged). The real panel is mounted
// (react-dom/client over tests/pdf/fake-dom.mjs); fake-dom has no layout, so the class tokens are checked.
// Run: node --test tests/pdf/104-r5-panels-colors-narrow.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/** The class tokens of `el`, as a set. */
const tokens = (el) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));

/** The Design panel for a Classic résumé with `settings`, Colors open. */
async function colorsOpen(settings = {}) {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  const view = mount(DesignPanel, {
    resume: resume({ template: 'classic', settings, personal: { name: 'Morgan Ashby', email: 'morgan@example.com' } }),
    updateSetting: () => {},
    setTemplate: () => {},
    resetSettings: () => {},
  });
  const all = () => [...elements(view.container)];
  const colors = all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Colors');
  assert.ok(colors, 'the Colors section is on the Design tab');
  view.act(() => reactProps(colors).onClick());
  return { view, all };
}

it('R4-DVIS-34: at a 240 px panel the Name/Job title color value shortens with an ellipsis, it does not push the row out', async () => {
  const { view, all } = await colorsOpen();
  try {
    for (const label of ['Name color', 'Job title color']) {
      const swatch = all().find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === label);
      assert.ok(swatch, `the ${label} row is open`);
      const group = swatch.parentNode;
      const shown = [...group.childNodes].find((el) => el.tagName === 'SPAN');
      assert.equal(shown?.textContent, 'Template default', `${label}: no colour picked names the template's`);
      assert.ok(tokens(group).has('min-w-0'),
        `${label}: the swatch-and-value group narrows below the full "Template default" (min-w-0), so its truncate can engage`);
      assert.ok(tokens(swatch).has('shrink-0'), `${label}: the swatch keeps its 40 px`);
      assert.ok(tokens(shown).has('truncate'), `${label}: the value gives way with an ellipsis`);
      assert.ok(tokens(shown).has('max-w-28'), `${label}: at the usual width "Template default" is still read in full`);
      const row = group.parentNode;
      assert.ok(tokens(row).has('gap-2'), `${label}: the row label and the swatch never touch`);
    }
  } finally {
    await view.unmount();
  }
});

it('R4-DVIS-34: with a colour picked, the ↺ reset keeps its size beside the shortened value', async () => {
  const { view, all } = await colorsOpen({ nameColor: '#1f4e79', jobTitleColor: '#2e7d32' });
  try {
    for (const label of ['Name color', 'Job title color']) {
      const swatch = all().find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === label);
      assert.ok(swatch, `the ${label} row is open`);
      const group = swatch.parentNode;
      assert.ok(tokens(group).has('min-w-0'), `${label}: the group narrows (min-w-0)`);
      const reset = [...group.childNodes].find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Reset to template default');
      assert.ok(reset, `${label}: a picked colour shows the ↺ reset`);
      assert.ok(tokens(reset).has('shrink-0'), `${label}: the ↺ reset keeps its size`);
    }
  } finally {
    await view.unmount();
  }
});
