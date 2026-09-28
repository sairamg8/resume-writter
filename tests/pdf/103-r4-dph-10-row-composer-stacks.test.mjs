// R4-DPH-10: a backlog section's "+ Create issue" composer (InlineCreate, variant 'row') on a phone.
// The row variant set the summary field beside a 128px type picker and the Create button at every
// width, so at 375px the field was left about 100px, narrower than its own "What needs to be done?"
// placeholder. Below sm it now stacks: the field on top, the picker and Create under it (the base
// flex-col); from sm up they sit side by side as before. The column variant (a board column, the
// Epic panel) always stacked and still does. Mounted with react-dom/client over fake-dom
// (tests/pdf/fake-dom.mjs); fake-dom has no layout, so the composer's class tokens are checked.
// Run: node --test tests/pdf/103-r4-dph-10-row-composer-stacks.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev } from '../unit/ui-dom-harness.mjs';

let InlineCreate;
before(async () => {
  await setup();
  patchFakeDom(); // the type picker's menu queries the document
  ({ InlineCreate } = await loadModule('/src/components/board/InlineCreate.jsx'));
});
after(teardown);

/** The class tokens of `el`, as a set. */
const tokens = (el) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));

/** Mounts the composer, opens it from its "+ Create issue" button, and hands back the box around the field. */
function openComposer(props = {}) {
  const view = mount(InlineCreate, { onCreate: () => {}, ...props });
  const all = () => [...elements(view.container)];
  const button = all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Create issue');
  assert.ok(button, 'the "+ Create issue" button is shown');
  view.act(() => reactProps(button).onClick(ev()));
  const field = all().find((el) => el.tagName === 'TEXTAREA' && el.getAttribute('aria-label') === 'Summary of the new issue');
  assert.ok(field, 'the button did not open the composer');
  return { view, box: field.parentNode };
}

it('R4-DPH-10: the row composer stacks the field over the type and Create on a phone, side by side from sm', async () => {
  const { view, box } = openComposer({ variant: 'row' });
  try {
    const got = tokens(box);
    assert.ok(got.has('flex') && got.has('flex-col'), 'below sm the field stacks above the picker and Create');
    assert.ok(got.has('sm:flex-row'), 'from sm up the field sits beside the picker and Create again');
    assert.ok(got.has('sm:items-center'), 'from sm up the row is centred as before');
    assert.equal(got.has('flex-row'), false, 'a bare flex-row squeezes the field to about 100px on a phone');
    assert.equal(got.has('items-center'), false, 'a bare items-center belongs to the side-by-side row only');
  } finally {
    await view.unmount();
  }
});

it('R4-DPH-10: the column composer (a board column, the Epic panel) still stacks at every width', async () => {
  const { view, box } = openComposer();
  try {
    const got = tokens(box);
    assert.ok(got.has('flex-col'));
    assert.equal(got.has('sm:flex-row'), false, 'only the row variant goes side by side');
    assert.equal(got.has('flex-row'), false);
  } finally {
    await view.unmount();
  }
});
