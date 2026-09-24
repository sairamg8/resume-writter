// Contact icon size: every step the panel offers changes the page, and every control says the unit it
// stores (R2-123). The size is stored in CSS px and printed in pt; the Sidebar and Modern rounded it
// to whole points, so on the Sidebar 10 → 11 px (7.5 and 8.25 pt, both 8) printed the same page, and
// the other templates' 7 pt floor made 8 and 9 px (6 and 6.75 pt) both 7 pt. Typography's Contact
// Icons row called the same number "pt" that Contact icons and Header Customization call "px".
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, render, loadModule, TEMPLATES } from './harness.mjs';
import { snapshot } from './parity/measure.mjs';
import { iconBefore } from './parity/marks.mjs';

before(setup);
after(teardown);

const EMAIL = 'pat@example.com';

/** The e-mail icon's size, pt, on `template` at Contact icons `iconSize`. */
async function iconPt(template, iconSize, settings = {}) {
  const r = resume({ template, settings: { contactStyle: 'icon', iconSize, ...settings }, personal: { name: 'Pat Sample', email: EMAIL, phone: '+1 555 0100' } });
  return iconBefore(await snapshot(await render(r)), EMAIL)?.size;
}

describe('every Contact icon size step changes the page (R2-123)', () => {
  const layouts = [...TEMPLATES.map((t) => [t, {}]), ['sidebar', { sidebarSingleColumn: true }]];
  for (const [template, settings] of layouts) {
    it(`${template}${settings.sidebarSingleColumn ? ' · Single' : ''}: each step from the least to the most offered prints a larger icon`, async () => {
      const { ICON_SIZE: range } = await loadModule('/src/constants/designNumbers.js');
      const flat = [];
      let prev = null;
      for (let px = range.min; px <= range.max; px += 1) {
        const size = await iconPt(template, px, settings);
        assert.ok(size, `${template} ${px}px: an icon before the e-mail`);
        if (prev && !(size > prev.size + 0.01)) flat.push(`${prev.px} → ${px}px: ${prev.size.toFixed(2)} → ${size.toFixed(2)} pt`);
        prev = { px, size };
      }
      assert.deepEqual(flat, []);
    });
  }
});

describe('the icon size is labelled px everywhere (R2-123)', () => {
  it('Typography → Contact Icons says px, as Contact icons does', async () => {
    const { TypographySection } = await loadModule('/src/components/DesignPanelTypography.jsx');
    const { SizeRow } = await loadModule('/src/components/DesignPanelShared.jsx');
    let row = null;
    function Capture() {
      const walk = (n) => {
        if (Array.isArray(n)) return n.forEach(walk);
        if (!n || typeof n !== 'object' || !n.props) return;
        if (n.type === SizeRow && n.props.label === 'Contact Icons') row = n;
        walk(n.props.children);
        if (typeof n.type === 'function' && n.type !== SizeRow && !row) walk(n.type(n.props));
      };
      walk(TypographySection({ settings: { iconSize: 12 }, template: 'classic', updateSetting: () => {}, onReset: () => {} }));
      return null;
    }
    renderToString(createElement(Capture));
    assert.ok(row, 'the Contact Icons row');
    const html = renderToString(row);
    assert.match(html, /value="12px"/, `Contact Icons reads 12px: ${html}`);
  });
});
