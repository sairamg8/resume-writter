// R5-JOB-07 (Overview Field; 811a282 was filed as R5-JOB-06, which is the List Summary row): an open click-to-edit value on the job Overview reset its draft to
// the job's value on every change of it, even mid-edit, so another tab's save or a sync replaced
// what the user was typing, and the blur then wrote nothing. Now the draft belongs to the person
// typing while the field is open: their text is saved on Enter or blur (the last write wins, as
// every store write), an untouched field writes nothing, so the other tab's newer value stays, and
// Escape shows the value as it is now.
// On the real Field (tests/pdf/fake-dom.mjs, loaded through Vite for the `@/` aliases).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const ev = (props = {}) => ({ preventDefault() {}, stopPropagation() {}, ...props });

async function field(value) {
  const dom = await import('./fake-dom.mjs');
  const { Field } = await loadModule('/src/components/job/Field.jsx');
  const writes = [];
  const props = { label: 'Company', value, onChange: (v) => writes.push(v) };
  const view = dom.mount(Field, props);
  const all = () => [...dom.elements(view.container)];
  const input = () => all().find((el) => el.tagName === 'INPUT');
  const fire = (el, name, e = ev()) => view.act(() => dom.reactProps(el)[name](e));
  return {
    writes,
    open: () => fire(all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Edit'), 'onClick'),
    type: (text) => fire(input(), 'onChange', ev({ target: { value: text } })),
    /** The value React last rendered into the open input. */
    draft: () => dom.reactProps(input()).value,
    isOpen: () => Boolean(input()),
    blur: () => fire(input(), 'onBlur'),
    key: (key) => fire(input(), 'onKeyDown', ev({ key })),
    /** The job's value changes under the field, as another tab's save reaching the store does. */
    changeTo: (next) => view.update({ ...props, value: next }),
    text: () => view.container.textContent,
    close: () => view.unmount(),
  };
}

it('R5-JOB-07: another tab\'s change keeps what is being typed, and the typed text is saved on blur', async () => {
  const f = await field('Acme');
  try {
    f.open();
    f.type('Acme Robotics');
    f.changeTo('Other Tab Inc');
    assert.equal(f.draft(), 'Acme Robotics', 'the draft is not replaced mid-edit');
    f.blur();
    assert.deepEqual(f.writes, ['Acme Robotics'], 'the typed value is written');
  } finally {
    await f.close();
  }
});

it('R5-JOB-07: the typed text survives a change, and Enter saves it', async () => {
  const f = await field('Acme');
  try {
    f.open();
    f.type('Acme Two');
    f.changeTo('Other Tab Inc');
    f.key('Enter');
    assert.deepEqual(f.writes, ['Acme Two']);
  } finally {
    await f.close();
  }
});

it('R5-JOB-07: an untouched open field writes nothing when another tab changed the job, and shows the new value', async () => {
  const f = await field('Acme');
  try {
    f.open();
    f.changeTo('Other Tab Inc');
    f.blur();
    assert.deepEqual(f.writes, [], 'the other tab\'s newer value stays');
    assert.equal(f.isOpen(), false);
    assert.match(f.text(), /Other Tab Inc/);
  } finally {
    await f.close();
  }
});

it('R5-JOB-07: Escape drops the draft and shows the value as it is now', async () => {
  const f = await field('Acme');
  try {
    f.open();
    f.type('Acme Robotics');
    f.changeTo('Other Tab Inc');
    f.key('Escape');
    assert.deepEqual(f.writes, []);
    assert.match(f.text(), /Other Tab Inc/);
    f.open();
    assert.equal(f.draft(), 'Other Tab Inc', 'reopened from the current value');
  } finally {
    await f.close();
  }
});
