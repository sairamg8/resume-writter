// Undo on 'Template: …' or 'Spacing: …' (R5-HUNT4-design-undo-wipes-icons-and-paper): it put the whole
// settings snapshot back, so a contact icon uploaded (Personal Info → Resume icon) and a Page size chosen
// while the notice was up were lost. They are not a look (NOT_A_LOOK; Reset keeps them, R5-6/R2-136):
// Undo now restores the look and keeps the icons, the paper and the saved designs as they are now.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const cv = () => resume({
  template: 'modern',
  settings: { accentColor: '#9f1239', font: 'lato', lineHeightValue: 1.4 },
  personal: { name: 'Robin Sample', title: 'Product Designer', email: 'robin@example.com' },
  sections: [experience([{ company: 'Acme Corp', role: 'Lead Designer', startDate: '2021-01', endDate: '', current: true, description: '<p>Led.</p>' }])],
});
const ICON = 'data:image/png;base64,iVBORw0KGgo=';

describe('Design Undo keeps what is not a look (R5-HUNT4)', () => {
  it('a template switch, then an icon uploaded, then Undo: the template is back and the icon stays', async () => {
    const { designSnapshot, withTemplate, withDesignSnapshot } = await loadModule('/src/utils/templateSwitch.js');
    const start = cv();
    const snap = designSnapshot(start);
    const switched = withTemplate(start, 'classic');
    const uploaded = { ...switched, settings: { ...switched.settings, customContactIcons: { email: ICON } } };
    const undone = withDesignSnapshot(uploaded, snap);
    assert.equal(undone.template, 'modern');
    assert.deepEqual(undone.settings.customContactIcons, { email: ICON }, 'the uploaded icon survives Undo');
    assert.equal(undone.settings.accentColor, '#9f1239', 'the look is back');
  });

  it('a spacing preset, then US Letter, then Undo: the spacing is back and the page stays Letter', async () => {
    const { designSnapshot, withDesignSnapshot } = await loadModule('/src/utils/templateSwitch.js');
    const start = cv();
    const snap = designSnapshot(start);
    const later = { ...start, settings: { ...start.settings, lineHeightValue: 1.6, pageSize: 'LETTER' } };
    const undone = withDesignSnapshot(later, snap);
    assert.equal(undone.settings.lineHeightValue, 1.4, 'the spacing is undone');
    assert.equal(undone.settings.pageSize, 'LETTER', 'the paper chosen since is kept');
  });

  it('an icon removed and the paper set back to A4 since stay removed — no key left undefined', async () => {
    const { designSnapshot, withDesignSnapshot } = await loadModule('/src/utils/templateSwitch.js');
    const start = { ...cv(), settings: { ...cv().settings, customContactIcons: { email: ICON }, pageSize: 'LETTER' } };
    const snap = designSnapshot(start);
    const { pageSize: _p, customContactIcons: _c, ...rest } = start.settings;
    const undone = withDesignSnapshot({ ...start, settings: { ...rest, lineHeightValue: 1.6 } }, snap);
    assert.equal(Object.hasOwn(undone.settings, 'pageSize'), false);
    assert.equal(Object.hasOwn(undone.settings, 'customContactIcons'), false);
    assert.equal(undone.settings.lineHeightValue, 1.4);
  });
});
