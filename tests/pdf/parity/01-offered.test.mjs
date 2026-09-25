// A control is offered exactly where the page prints what it styles (R2-082, R3-001). The parity matrix
// fails a control that is offered and changes nothing; this is the other half — a control the PDF
// honours but the panel does not offer. What each template prints comes from the PDF code's own
// tables (letterheadLook's band, headerTemplateId, hasHeaderControls); what each panel offers comes
// from the walk (walker.mjs: a control's own write, in the state the panel opens in — not a Reset's).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from '../harness.mjs';
import { walks } from './walk-cache.mjs';

const W = await walks();
let look = null;
before(async () => {
  await setup();
  const [letterhead, templates, spacing] = await Promise.all([
    loadModule('/src/templates/pdf/shared/letterhead.js'),
    loadModule('/src/constants/templates.js'),
    loadModule('/src/constants/headerSpacing.js'),
  ]);
  look = {
    band: (v) => Boolean(letterhead.letterheadLook(v.template, v.settings).band),
    // The page prints header gap `key`: its header's template has one (the walk's résumé has a summary).
    gap: (v, key) => spacing.templateGapPt(templates.headerTemplateId(v.template, v.settings), key) != null,
    ...templates,
  };
});
after(teardown);

/** Does `variant`'s Design or Personal Info panel offer a control writing setting `key` on its own? */
const offers = (variant, key) => {
  const w = W.walks[variant.id];
  return [...w.design, ...w.personal].some((a) => !a.context.length && a.writes.length === 1
    && a.writes[0].kind === 'setting' && a.writes[0].key === key);
};

/** [key, what the page must print for it to be offered, in words]. */
const WHERE = [
  ['headerTextColor', (v) => look.band(v), 'the header prints on a band or a column (letterheadLook band)'],
  ['sidebarBg', (v) => look.headerTemplateId(v.template, v.settings) === 'sidebar', 'the page prints the Sidebar column'],
  ['headerAlign', (v) => look.hasHeaderControls(v.template, v.settings), 'the header takes Header Customization'],
  ['showHeaderBorder', (v) => look.hasHeaderControls(v.template, v.settings), 'the header takes Header Customization'],
  // Header spacing's rows under the contacts (R2-137); Text ↔ Border shows once the border is on, one step deep.
  ['summaryGap', (v) => look.gap(v, 'summaryGap'), 'the header prints a gap above its summary'],
  ['headerPadY', (v) => look.gap(v, 'headerPadY'), 'the header is a padded banner (Modern, Banner)'],
  ['headerPadX', (v) => look.gap(v, 'headerPadX'), 'the banner is padded at its sides (Modern)'],
  ['headerGapBelow', (v) => look.gap(v, 'headerGapBelow'), 'the header has a gap under it (every one)'],
];

describe('each control is offered where the PDF prints what it styles, and only there', () => {
  for (const variant of W.variants) {
    it(variant.id, () => {
      const wrong = WHERE.filter(([key, prints]) => offers(variant, key) !== prints(variant))
        .map(([key, , why]) => `${key}: ${offers(variant, key) ? 'offered, but not' : 'not offered, but'} ${why}`);
      assert.deepEqual(wrong, []);
    });
  }
});
