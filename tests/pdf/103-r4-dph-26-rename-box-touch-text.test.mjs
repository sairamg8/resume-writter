// R4-DPH-26: a résumé card's Rename (the pencil beside its name, always shown on a touch screen: the
// no-hover variant) opened a 14 px name box (text-sm, nothing larger on touch), so iOS Safari zoomed the
// dashboard in on focus and stayed zoomed after the rename. The box is now 16 px on a touch screen
// (pointer-coarse:text-base), as the kit's fields and the tracker's are (tests/pdf/81-job-inputs-touch-text.test.mjs),
// and stays 14 px with a mouse. The fake DOM has no layout, so this pins the class on the real
// ResumeCard, mounted with react-dom/client over tests/pdf/fake-dom.mjs, with a fictional résumé.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

/**
 * The fields under `container` that would be under 16 px on a phone or a tablet, as 81-job-inputs-touch-text
 * reads them: a field passes with `pointer-coarse:text-base`, or an unprefixed `text-base` no breakpoint shrinks.
 */
function under16OnTouch(container) {
  const fields = [...elements(container)].filter((el) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)
    && !['file', 'hidden', 'checkbox', 'radio'].includes(el.getAttribute('type') ?? el.type));
  assert.ok(fields.length > 0, 'there are fields to check');
  return fields.filter((el) => {
    const cls = el.getAttribute('class') ?? '';
    if (/(^|\s)pointer-coarse:text-base(\s|$)/.test(cls)) return false;
    return !(/(^|\s)text-base(\s|$)/.test(cls) && !/(^|\s)(sm|md|lg|xl|2xl):text-(xs|sm|\[)/.test(cls));
  }).map((el) => el.getAttribute('aria-label') || el.tagName);
}

it('a card\'s rename box is 16 px on a touch screen, so iOS does not zoom the dashboard into it', async () => {
  const { ResumeCard } = await loadModule('/src/components/ResumeCard.jsx');
  const renames = [];
  const cv = { id: 'resume_x', name: 'Harbor Pilot CV', updatedAt: 1, settings: {}, sections: [], personal: { name: 'Wren Calloway' } };
  const view = mount(ResumeCard, { resume: cv, onOpen() {}, onDuplicate() {}, onDelete() {}, onRename: (id, n) => renames.push([id, n]) });
  try {
    const all = () => [...elements(view.container)];
    const rename = all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Rename');
    assert.ok(rename, 'the card\'s Rename');
    view.act(() => reactProps(rename).onClick({ preventDefault() {}, stopPropagation() {} }));
    const box = all().find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === 'Résumé name');
    assert.ok(box, 'Rename opens the name box');
    assert.ok(tokens(box).includes('pointer-coarse:text-base'), `16 px on touch: ${tokens(box).join(' ')}`);
    assert.ok(tokens(box).includes('text-sm'), 'still 14 px with a mouse, as the name it replaces');
    assert.deepEqual(under16OnTouch(view.container), [], 'no field of the card is under 16 px on touch');

    view.act(() => reactProps(box).onChange({ target: { value: 'Harbor Pilot CV 2' } }));
    view.act(() => reactProps(box).onKeyDown({ key: 'Enter', nativeEvent: {} }));
    assert.deepEqual(renames, [['resume_x', 'Harbor Pilot CV 2']], 'Enter still renames');
  } finally { await view.unmount(); }
});
