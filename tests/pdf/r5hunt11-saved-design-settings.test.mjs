// R5-HUNT11-SAVED-DESIGN-SETTINGS-UNCHECKED: a saved design ("Your design") from an imported .json whose
// settings carry what the Design panel never writes. normalizeResume checks a résumé's own settings,
// not the ones inside settings.myDesigns, and picking the design (Design → Template → My designs, or its
// card on /new) copied them onto the résumé unchecked: fontSizeBase "12" printed the name at 128 pt
// ("12" + 8) and the headings at "121", "abc" dropped the text, and the /new and dashboard card pictures
// showed the same page. Now ownDesign hands every reader the design's settings with the checks a
// résumé's get (numbers in range, colours as '#rrggbb', Name Font and Heading Font as text).
// Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, experience, render, read } from './harness.mjs';

before(setup);
after(teardown);

const withDesign = (design) => resume({
  personal: { name: 'Ann Vale', email: 'ann@example.com' },
  sections: [experience([{ company: 'Harbor Works', role: 'Pilot' }])],
  settings: { myDesigns: { d1: { label: 'Mine', engine: 'classic', settings: design } } },
});

/** The file imported (normalizeResume), then its saved design picked as the store does (applyDesign). */
async function picked(design) {
  const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
  const { savedDesigns } = await loadModule('/src/constants/templatePresets.js');
  const { withLook } = await loadModule('/src/utils/templateSwitch.js');
  const r = normalizeResume(withDesign(design));
  const [mine] = savedDesigns([r]);
  assert.equal(mine?.id, 'd1', 'the design is listed');
  return { r: withLook(r, { engine: mine.engine, preset: mine.id, design: mine }), mine };
}

describe('a saved design whose settings the panel never writes', () => {
  it('fontSizeBase "12" is picked as 12: the name prints at 20 pt, not 128', async () => {
    const { r, mine } = await picked({ fontSizeBase: '12' });
    assert.equal(mine.settings.fontSizeBase, 12, 'the card picture reads 12');
    assert.equal(r.settings.fontSizeBase, 12, `before: ${JSON.stringify(r.settings.fontSizeBase)} went onto the résumé`);
    assert.equal(r.settings.templatePreset, 'd1');
    const [page] = await read(await render(r));
    const name = page.items.find((it) => it.str.includes('Ann Vale'));
    assert.ok(name, page.text);
    assert.ok(name.h > 15 && name.h < 30, `the name at ${name.h} pt`);
  });

  it('"abc", a bad colour and an object font are dropped, so the résumé keeps its own', async () => {
    const { r } = await picked({ fontSizeBase: 'abc', accentColor: 'banana', textColor: 'red', nameFont: { family: 'Lora' } });
    assert.equal(r.settings.fontSizeBase, 11, 'the base the résumé had');
    assert.equal(r.settings.textColor, '#ff0000');
    assert.notEqual(r.settings.accentColor, 'banana');
    assert.equal(typeof (r.settings.nameFont ?? ''), 'string');
    const [page] = await read(await render(r));
    assert.ok(page.text.includes('Ann Vale') && page.text.includes('Harbor Works'), page.text);
  });

  it('a design the app saved is read as it is stored', async () => {
    const { ownDesign } = await loadModule('/src/constants/templatePresets.js');
    const settings = { font: 'inter', fontSizeBase: 12, accentColor: '#6d28d9' };
    const s = { myDesigns: { d1: { label: 'Mine', engine: 'classic', settings } } };
    assert.equal(ownDesign(s, 'd1').settings, settings, 'the same object: nothing to change');
  });
});
