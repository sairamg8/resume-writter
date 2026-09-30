// R5-HUNT11-REV-1: a saved design from an imported .json whose settings hold what is not a look
// (templatePresets NOT_A_LOOK: the paper, contact icons, design bookkeeping) or a value that is not a
// plain one. Picking the design stores it through designLook first (withLook), but Design → Reset and a
// switch to another template read it as stored: "pageSize": "LETTER" put an A4 résumé on US Letter at
// Reset and took a US Letter résumé's paper away on a switch, and an object "headingStyle" went onto
// the résumé at Reset. Now ownDesign reads a saved design as designLook keeps it. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, experience, render, read } from './harness.mjs';

before(setup);
after(teardown);

const onDesign = (design, own = {}) => resume({
  personal: { name: 'Ann Vale', email: 'ann@example.com' },
  sections: [experience([{ company: 'Harbor Works', role: 'Pilot' }])],
  settings: { ...own, templatePreset: 'd1', myDesigns: { d1: { label: 'Mine', engine: 'classic', settings: design } } },
});

const imported = async (r) => (await loadModule('/src/utils/normalizeResume.js')).normalizeResume(r);

describe('a saved design holding what is not a look', () => {
  it('Reset returns an A4 résumé to its design without the design\'s paper or an object heading style', async () => {
    const { settingsAfterReset } = await loadModule('/src/utils/defaultData.js');
    const { pageSizeOf } = await loadModule('/src/constants/pageSize.js');
    const r = await imported(onDesign({ accentColor: '#123456', pageSize: 'LETTER', headingStyle: { x: 1 } }));
    const settings = settingsAfterReset(r);
    assert.equal(settings.templatePreset, 'd1', 'still on the design');
    assert.equal(settings.accentColor, '#123456', 'the design\'s look');
    assert.equal(pageSizeOf(settings), 'A4', `before: the design's paper (${settings.pageSize}) came with Reset`);
    assert.notEqual(typeof settings.headingStyle, 'object', 'before: an object heading style came with Reset');
    const [page] = await read(await render({ ...r, settings }));
    assert.ok(page.text.includes('Ann Vale') && page.text.includes('Harbor Works'), page.text);
  });

  it('a switch to another template keeps a US Letter résumé on US Letter', async () => {
    const { withTemplate } = await loadModule('/src/utils/templateSwitch.js');
    const { pageSizeOf } = await loadModule('/src/constants/pageSize.js');
    const r = await imported(onDesign({ accentColor: '#123456', pageSize: 'LETTER' }, { pageSize: 'LETTER', accentColor: '#123456' }));
    const out = withTemplate(r, 'modern');
    assert.equal(out.template, 'modern');
    assert.equal(pageSizeOf(out.settings), 'LETTER', 'before: the switch took the paper away with the design');
  });

  it('a design the app saved is read as it is stored, the same object', async () => {
    const { ownDesign, designLook } = await loadModule('/src/constants/templatePresets.js');
    const settings = designLook({ font: 'inter', fontSizeBase: 12, accentColor: '#6d28d9', fontSizeTitleDelta: null, pageSize: 'LETTER' });
    assert.equal(Object.hasOwn(settings, 'pageSize'), false);
    assert.equal(ownDesign({ myDesigns: { d1: { label: 'Mine', engine: 'classic', settings } } }, 'd1').settings, settings);
  });
});
