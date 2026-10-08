// R5-HUNT5-TYPOGRAPHY-CUSTOM-FONT-NOT-SHOWN-WHEN-NOT-IN-LOCAL-LIST: Design → Typography's Font Family
// marks the font the résumé prints in even when this browser's saved list of custom fonts lacks it
// (removed here while another résumé still uses it, or a résumé synced or restored from another
// device). The résumé's settings.customFont shows as a selected chip, as Name Font and Heading Font
// already offer a stored value missing from the list; picking it again or removing it works as for
// any chip, and a font already in the list is not shown twice.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

// The font CDN is offline: Word's stand-in check (wordFonts.js) must not reach the network.
const realFetch = globalThis.fetch;
before(async () => {
  await setup();
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('cdn.jsdelivr.net')) throw new TypeError('fetch failed');
    return realFetch(url, opts);
  };
});
after(async () => { globalThis.fetch = realFetch; await teardown(); });

/** Mounts the panel with this browser's saved list `saved`, opens Typography, and hands the view over. */
async function withPanel(saved, settings, fn) {
  const store = { cpwtcv_custom_fonts: JSON.stringify(saved) };
  const prev = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    value: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    configurable: true, writable: true,
  });
  try {
    const { TypographySection } = await loadModule('/src/components/DesignPanelTypography.jsx');
    const writes = [];
    const view = mount(TypographySection, { settings, template: 'classic', resumeId: 'r1', updateSetting: (k, v) => writes.push([k, v]), onReset: () => {} });
    try {
      const open = [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Typography');
      view.act(() => reactProps(open).onClick());
      await fn(view, writes, store);
    } finally {
      await view.unmount();
    }
  } finally {
    if (prev) Object.defineProperty(globalThis, 'localStorage', prev);
    else delete globalThis.localStorage;
  }
}

const chipButtons = (view, name) => [...elements(view.container)]
  .filter((el) => el.tagName === 'BUTTON' && el.textContent.trim() === name);
const isSelected = (el) => /(^|\s)border-cv-brand-soft-border(\s|$)/.test(el.parentNode.getAttribute('class') || '');

describe('Font Family marks the résumé\'s custom font missing from this browser\'s list (R5-HUNT5)', () => {
  it('shows it as the selected chip', async () => {
    await withPanel([], { font: '', customFont: 'Nunito' }, async (view) => {
      const chips = chipButtons(view, 'Nunito');
      assert.equal(chips.length, 1, 'a chip for the font the résumé prints in');
      assert.ok(isSelected(chips[0]), 'and it is the selected one');
      assert.ok(view.container.textContent.includes('Your custom fonts'));
    });
  });

  it('beside the saved ones, once, and Name Font lists it too', async () => {
    await withPanel(['Raleway'], { font: '', customFont: 'Nunito' }, async (view) => {
      assert.equal(chipButtons(view, 'Raleway').length, 1);
      assert.ok(!isSelected(chipButtons(view, 'Raleway')[0]));
      assert.equal(chipButtons(view, 'Nunito').length, 1);
      assert.ok(isSelected(chipButtons(view, 'Nunito')[0]));
      const options = [...elements(view.container)].filter((el) => el.tagName === 'OPTION' && el.getAttribute('value') === 'Nunito');
      assert.equal(options.length, 2, 'Name Font and Heading Font offer it once each');
    });
    await withPanel(['Nunito'], { font: '', customFont: 'Nunito' }, async (view) => {
      assert.equal(chipButtons(view, 'Nunito').length, 1, 'a font in the list is not shown twice');
    });
  });

  it('picking it again or removing it works as for any chip', async () => {
    await withPanel([], { font: '', customFont: 'Nunito' }, async (view, writes) => {
      view.act(() => reactProps(chipButtons(view, 'Nunito')[0]).onClick());
      assert.deepEqual(writes.splice(0), [['customFont', 'Nunito'], ['font', '']]);
      const remove = [...elements(view.container)].find((el) => el.getAttribute('aria-label') === 'Remove Nunito');
      view.act(() => reactProps(remove).onClick());
      assert.deepEqual(writes, [['customFont', '']]);
    });
  });

  it('no custom font: no chips, as before', async () => {
    await withPanel([], { font: 'inter', customFont: '' }, async (view) => {
      assert.ok(!view.container.textContent.includes('Your custom fonts'));
    });
  });

  // Review: the panel reads customFont as the PDF does (pdfFontLoader.js: String(customFont || '').trim()).
  it('a blank stored value shows no chip and marks the picker font the PDF prints in', async () => {
    await withPanel([], { font: 'inter', customFont: '   ' }, async (view) => {
      assert.ok(!view.container.textContent.includes('Your custom fonts'), 'no blank chip');
      const inter = [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Inter');
      assert.match(inter.getAttribute('class') || '', /(^|\s)border-cv-brand-soft-border(\s|$)/, 'Inter, which the PDF prints, is selected');
    });
  });

  it('a padded stored name is the saved chip, selected, not a second one', async () => {
    await withPanel(['Nunito'], { font: '', customFont: ' Nunito ' }, async (view, writes) => {
      const chips = chipButtons(view, 'Nunito');
      assert.equal(chips.length, 1, 'one Nunito chip');
      assert.ok(isSelected(chips[0]), 'and it is selected');
      const remove = [...elements(view.container)].find((el) => el.getAttribute('aria-label') === 'Remove Nunito');
      view.act(() => reactProps(remove).onClick());
      assert.deepEqual(writes, [['customFont', '']], 'removing it clears the résumé\'s font');
    });
  });

  it('a non-string stored value (a hand-edited backup) does not break the panel', async () => {
    await withPanel([], { font: '', customFont: { name: 'Nunito' } }, async (view) => {
      assert.ok(view.container.textContent.includes('Font Family'), 'the panel still renders');
      assert.equal(chipButtons(view, '[object Object]').length, 1, 'the name the PDF tries, as a chip');
    });
  });
});
