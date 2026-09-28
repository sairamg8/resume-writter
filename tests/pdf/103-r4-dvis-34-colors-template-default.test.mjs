// R4-DVIS-34: Design → Colors → Name & Title Colors. With no colour picked — the state every résumé
// starts in — the Name color and Job title color rows name what the PDF prints, "Template default",
// but the label was a fixed 64 px (w-16) and truncated: 16 characters of 11 px monospace need about
// 106 px, so at every width it read "Templat…". It is now capped at 112 px (max-w-28) instead: the
// default is read in full, a picked #rrggbb still takes only its own width, and anything longer is
// still cut to one line (truncate). The real panel is mounted (react-dom/client over
// tests/pdf/fake-dom.mjs) with Colors open; fake-dom has no layout, so the label's class tokens are checked.
// Run: node --test tests/pdf/103-r4-dvis-34-colors-template-default.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/** The class tokens of `el`, as a set. */
const tokens = (el) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));

it('R4-DVIS-34: Name color and Job title color show "Template default" in full, not "Templat…"', async () => {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  const view = mount(DesignPanel, {
    resume: resume({ template: 'classic', personal: { name: 'Morgan Ashby', email: 'morgan@example.com' } }),
    updateSetting: () => {},
    setTemplate: () => {},
    resetSettings: () => {},
  });
  try {
    const all = () => [...elements(view.container)];
    const colors = all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Colors');
    assert.ok(colors, 'the Colors section is on the Design tab');
    view.act(() => reactProps(colors).onClick());

    for (const label of ['Name color', 'Job title color']) {
      const swatch = all().find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === label);
      assert.ok(swatch, `the ${label} row is open`);
      const shown = [...swatch.parentNode.childNodes].find((el) => el.tagName === 'SPAN');
      assert.equal(shown?.textContent, 'Template default', `${label}: no colour picked names the template's`);
      const got = tokens(shown);
      assert.equal(got.has('w-16'), false, `${label}: a fixed 64 px cuts "Template default" to "Templat…"`);
      assert.ok(got.has('max-w-28'), `${label}: up to 112 px, room for the 16 characters of "Template default"`);
      assert.ok(got.has('truncate'), `${label}: anything longer is still one line`);
    }
  } finally {
    await view.unmount();
  }
});
