// R4-DSN-02: a résumé on a custom Google font (Typography → Add a Google Font: customFont 'Poppins',
// font '') switched to a design or a template that brings a font — Harbor's IBM Plex Sans, Academic's
// Source Serif, Chronicle's PT Serif, Linen's Lato — prints that font, as Reset on it and a font button
// do. The switch wrote `font` but kept `customFont`, which the PDF prefers, so the page stayed in
// Poppins while the card claimed its own face. A template that brings no font keeps the custom one, and
// the picker's cards draw what the switch makes.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const CUSTOM = { customFont: 'Poppins', font: '', accentColor: '#374151' };
const cv = () => ({ id: 'resume_a', template: 'classic', settings: { ...CUSTOM }, sections: [] });

describe('A design or template that brings a font, over a custom Google font (R4-DSN-02)', () => {
  it('the switch prints the font it brings: the custom font gives way', async () => {
    const { withTemplate } = await loadModule('/src/utils/templateSwitch.js');
    for (const [template, preset, font] of [['classic', 'harbor', 'ibmplexsans'], ['academic', '', 'sourceserif'], ['chronicle', '', 'ptserif'], ['linen', '', 'lato']]) {
      const s = withTemplate(cv(), template, preset).settings;
      assert.equal(s.font, font, `${template}/${preset}`);
      assert.equal(s.customFont, '', `${template}/${preset}: Poppins no longer printed`);
    }
  });

  it('matches Reset on the same design', async () => {
    const { withTemplate } = await loadModule('/src/utils/templateSwitch.js');
    const { resetDesignSettings } = await loadModule('/src/utils/defaultData.js');
    const r = withTemplate(cv(), 'classic', 'harbor');
    const reset = resetDesignSettings(r.settings, r.template);
    assert.equal(r.settings.customFont, reset.customFont);
    assert.equal(r.settings.font, reset.font);
  });

  it('a template that brings no font keeps the custom one', async () => {
    const { withTemplate } = await loadModule('/src/utils/templateSwitch.js');
    const s = withTemplate(cv(), 'modern').settings;
    assert.equal(s.customFont, 'Poppins');
  });

  it('a saved design brings its own custom font', async () => {
    const { withLook } = await loadModule('/src/utils/templateSwitch.js');
    const design = { label: 'Mine', engine: 'minimal', settings: { font: '', customFont: 'Raleway', accentColor: '#0e7490' } };
    const s = withLook(cv(), { engine: 'minimal', preset: 'design_x', design }).settings;
    assert.equal(s.customFont, 'Raleway');
  });

  it('the picker\'s cards draw the page the pick makes: Harbor and Academic without the custom font', async () => {
    const { pickerCards } = await loadModule('/src/utils/templatePicker.js');
    const cards = pickerCards(CUSTOM);
    const by = (id) => cards.find((c) => c.testid === id);
    assert.equal(by('preset-harbor').look.customFont, '');
    assert.equal(by('template-academic').look.customFont, '');
    assert.equal(by('template-academic').serif, true);
    assert.equal(by('template-modern').look.customFont, 'Poppins');
  });
});
