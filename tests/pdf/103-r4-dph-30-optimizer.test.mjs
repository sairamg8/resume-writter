// R4-DPH-30 (and R4-DPH-36, the same field): the STAR / Bullet Optimizer's statement box — its only
// field — was text-xs sm:text-sm, 12 px on a phone and 14 px on a tablet, and iOS Safari zooms the page
// into any field under 16 px it focuses, so every tap on the statement zoomed the page. It is 16 px on a
// touch screen now (pointer-coarse:text-base, as the kit's controls and the rich-text editor are); a
// mouse keeps its 12 / 14 px. The rule is tests/pdf/81-job-inputs-touch-text.test.mjs's under16OnTouch,
// on the real modal (103-r4-optimizer-helpers.mjs).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { optimizer, classes } from './103-r4-optimizer-helpers.mjs';

before(setup);
after(teardown);

/**
 * The text fields on the page that would be under 16 px on a touch screen: a field passes with
 * `pointer-coarse:text-base`, or with an unprefixed `text-base` that no breakpoint shrinks.
 */
function under16OnTouch(fields) {
  return fields.filter((el) => {
    const cls = el.getAttribute('class') ?? '';
    if (/(^|\s)pointer-coarse:text-base(\s|$)/.test(cls)) return false;
    return !(/(^|\s)text-base(\s|$)/.test(cls) && !/(^|\s)(sm|md|lg|xl|2xl):text-(xs|sm|\[)/.test(cls));
  }).map((el) => el.getAttribute('placeholder') || el.tagName);
}

it('R4-DPH-30: the optimizer\'s statement box is 16 px on a touch screen, so iOS does not zoom into it', async () => {
  const o = await optimizer('Led a team of five');
  try {
    const fields = o.all().filter((el) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)
      && !['file', 'hidden', 'checkbox', 'radio'].includes(el.getAttribute('type') ?? el.type));
    assert.ok(fields.some((el) => el.tagName === 'TEXTAREA'), 'the statement box is on the page');
    assert.deepEqual(under16OnTouch(fields), []);
    // A mouse keeps the size it had.
    const statement = classes(fields.find((el) => el.tagName === 'TEXTAREA'));
    assert.ok(statement.includes('text-xs') && statement.includes('sm:text-sm'), `12 / 14 px with a mouse: ${statement.join(' ')}`);
  } finally {
    await o.unmount();
  }
});
