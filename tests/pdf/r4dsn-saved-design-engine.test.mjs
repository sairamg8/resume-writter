// R4-DSN-01: a saved design whose engine a file stores in another case ("Modern", " sidebar ") — an
// imported .json — is read as the template the app writes ("modern"). ownDesign accepted it (offersTemplate
// takes any case, R5-5) but passed the raw value on, so the picker's `TEMPLATES['Modern'].label` threw and
// the editor and /new, which list every résumé's saved designs, crashed for every résumé.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const withDesign = (engine) => ({
  id: 'resume_imported', template: 'modern',
  settings: { templatePreset: 'd1', myDesigns: { d1: { label: 'Mine', engine, settings: { accentColor: '#6d28d9' } } } },
});

describe('A saved design stored with its engine in another case (R4-DSN-01)', () => {
  for (const engine of ['Modern', ' modern ', 'MODERN']) {
    it(`"${engine}" lists as a card of Modern, and the résumé on it is marked`, async () => {
      const { savedDesigns, ownDesign, presetOf } = await loadModule('/src/constants/templatePresets.js');
      const { pickerCards, cardSelected } = await loadModule('/src/utils/templatePicker.js');
      const r = withDesign(engine);
      assert.equal(ownDesign(r.settings, 'd1').engine, 'modern');
      const mine = savedDesigns([r, { id: 'resume_other', template: 'classic', settings: {} }]);
      assert.deepEqual(mine.map((d) => [d.id, d.engine]), [['d1', 'modern']]);
      const cards = pickerCards({}, mine);
      const card = cards.find((c) => c.testid === 'design-d1');
      assert.equal(card.desc, 'Your design · Modern');
      assert.equal(card.engine, 'modern');
      assert.equal(presetOf(r.settings, r.template)?.id, 'd1');
      assert.equal(cardSelected(card, r.template, 'd1', r.settings), true);
    });
  }
});
