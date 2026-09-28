// R5-JOB-01: a click-to-edit value on the job Overview (Company, Role, Location, Salary, URL, the
// dates, Contact) opened into a box of its own — an indigo-300 border, rounded-md corners, a 2 px
// ring, no hover tint, ~38 px tall — and dropped its row's icon, so it jumped left. The selects and
// the deadline beside it use the kit's box (controlClass, 36 px, 44 on touch). Now the opened value
// is that same box, in its row after its icon, as the Overview's selects sit.
// On the real Field (tests/pdf/fake-dom.mjs, loaded through Vite for the `@/` aliases).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const ev = (props = {}) => ({ preventDefault() {}, stopPropagation() {}, ...props });

it('R5-JOB-01: an opened Overview value is the kit box, in its row after its icon', async () => {
  const dom = await import('./fake-dom.mjs');
  const { createElement: h } = await import('react');
  const { Field } = await loadModule('/src/components/job/Field.jsx');
  const { controlClass } = await loadModule('/src/components/ui/Field.jsx');
  const Pin = ({ className }) => h('i', { 'data-probe': 'icon', className });
  const view = dom.mount(Field, { label: 'Location', value: 'Berlin', icon: Pin, onChange() {} });
  try {
    const all = () => [...dom.elements(view.container)];
    const edit = all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Edit');
    view.act(() => dom.reactProps(edit).onClick(ev()));
    const input = all().find((el) => el.tagName === 'INPUT');
    assert.ok(input, 'the pencil opens an input');
    const classes = new Set((input.getAttribute('class') || '').split(/\s+/));
    for (const c of controlClass().split(/\s+/)) assert.ok(classes.has(c), `the kit's ${c}`);
    for (const c of ['h-9', 'pointer-coarse:h-11', 'min-w-0', 'flex-1', 'px-3']) assert.ok(classes.has(c), `the Overview's box: ${c}`);
    for (const c of ['border-indigo-300', 'rounded-md', 'focus:ring-2', 'py-2']) assert.ok(!classes.has(c), `not its own box: ${c}`);

    const row = input.parentNode;
    const rowClasses = (row.getAttribute('class') || '').split(/\s+/);
    for (const c of ['flex', 'items-center', 'gap-2', 'px-3']) assert.ok(rowClasses.includes(c), `in the selects' row: ${c}`);
    const icon = row.childNodes.find((el) => el.getAttribute?.('data-probe') === 'icon');
    assert.ok(icon, 'the row keeps its icon while open');
    assert.ok(row.childNodes.indexOf(icon) < row.childNodes.indexOf(input), 'the icon comes first');
  } finally {
    await view.unmount();
  }
});
