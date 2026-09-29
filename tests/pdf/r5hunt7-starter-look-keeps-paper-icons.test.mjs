// R5-HUNT7-DASH-STARTER-DROPS-PAPER-AND-ICONS: /new's own-details role starter on any look — the
// store's createResume runs starterFrom, then withLook for the look picked — kept the starter's own
// settings, so a US Letter user's new résumé printed on A4 (595.28 × 841.89 pt) with stock contact
// icons. Now it stays on US Letter with the icons the user uploaded, on every look, as picking the
// look card itself (resumeFrom, then withLook) always kept them.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const ICON = 'data:image/png;base64,iVBORw0KGgo=';

describe('A role starter from the user’s own details keeps their paper and icons (R5-HUNT7-DASH)', () => {
  it('prints on US Letter with the uploaded LinkedIn icon on the starter’s own look and every card’s', async () => {
    const { buildResumeFromStarter } = await loadModule('/src/utils/starterTemplates.js');
    const { starterFrom } = await loadModule('/src/utils/newResume.js');
    const { withLook } = await loadModule('/src/utils/templateSwitch.js');
    const { pickerCards } = await loadModule('/src/utils/templatePicker.js');
    const { cardLook } = await loadModule('/src/components/TemplateThumb.jsx');
    const { pageBoxPt } = await loadModule('/src/constants/pageSize.js');
    const source = {
      id: 'r_mine', name: 'Mine', updatedAt: 5,
      personal: { name: 'Pat Example', linkedin: 'linkedin.com/in/pat-example', hiddenFields: [] },
      settings: { pageSize: 'LETTER', customContactIcons: { linkedin: ICON } },
      sections: [],
    };
    const own = starterFrom(buildResumeFromStarter('software-engineer', 'resume_new'), source);
    const cards = pickerCards({});
    assert.ok(cards.length > 5);
    for (const [label, made] of [['own', own], ...cards.map((c) => [c.testid, withLook(own, cardLook(c))])]) {
      assert.deepEqual(pageBoxPt(made.settings), { width: 612, height: 792 }, `${label}: US Letter`);
      assert.equal(made.settings.customContactIcons?.linkedin, ICON, `${label}: the uploaded icon`);
    }
  });
});
