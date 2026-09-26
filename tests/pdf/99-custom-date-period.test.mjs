// R4-ED-03: a Custom entry's 'Date / Period' was always the month picker. An import stores a whole
// period there ('Jan 2020 – Mar 2021', '2019 – 2021'), which the PDF prints as stored, but the picker
// showed only its first month and year (or blanks, with the × still there), and any pick wrote
// 'Jan 2021' over the whole period without warning. Now a stored date the picker cannot hold is
// edited as text, showing what prints; a month and year, a year or nothing keeps the picker.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/** A Custom entry's card, open, holding `date`; re-rendered with each update, as the section does. */
async function custom(date) {
  const { CustomItem } = await loadModule('/src/components/SectionEditorEntryItems.jsx');
  const writes = [];
  let item = { id: 'cust_1', title: 'Club President', subtitle: 'Chess Club', date, location: '', description: '' };
  const props = () => ({ item, defaultOpen: true, onRemove() {}, onUpdate: (u) => { writes.push(u.date); item = u; } });
  const view = mount(CustomItem, props());
  const all = () => [...elements(view.container)];
  const dateBox = () => all().find((el) => el.tagName === 'INPUT' && el.getAttribute('id')
    && all().some((l) => l.tagName === 'LABEL' && l.getAttribute('for') === el.getAttribute('id') && l.textContent === 'Date / Period'));
  const yearSelect = () => all().find((el) => el.tagName === 'SELECT' && /year$/i.test(el.getAttribute('aria-label') || ''));
  const act = (el, handler, event) => { view.act(() => reactProps(el)[handler](event)); view.update(props()); };
  return { view, writes, dateBox, yearSelect, act };
}

describe('a Custom entry\'s Date / Period shows and keeps what prints (R4-ED-03)', () => {
  for (const period of ['Jan 2020 – Mar 2021', '2019 – 2021', 'Summer 2020']) {
    it(`'${period}' is shown whole, as text, and editing it keeps the rest of it`, async () => {
      const { view, writes, dateBox, yearSelect, act } = await custom(period);
      try {
        assert.equal(yearSelect(), undefined, 'no month picker, which cannot hold it');
        const box = dateBox();
        assert.ok(box, 'a Date / Period text box');
        assert.equal(box.value, period);
        const edited = `${period} (renewed)`;
        act(box, 'onChange', { target: { value: edited } });
        assert.deepEqual(writes, [edited]);
      } finally { await view.unmount(); }
    });
  }

  it('a period retyped stays a text box when it passes through a year the picker reads', async () => {
    const { view, writes, dateBox, yearSelect, act } = await custom('2019 – 2021');
    try {
      for (const typed of ['2', '2019', '2019 – 2022']) act(dateBox(), 'onChange', { target: { value: typed } });
      assert.deepEqual(writes, ['2', '2019', '2019 – 2022']);
      assert.equal(yearSelect(), undefined);
      assert.equal(dateBox().value, '2019 – 2022');
    } finally { await view.unmount(); }
  });

  for (const date of ['Jan 2020', '2020', 'Mar', '']) {
    it(`'${date}' keeps the month picker`, async () => {
      const { view, dateBox, yearSelect } = await custom(date);
      try {
        assert.ok(yearSelect(), 'the month picker');
        assert.equal(dateBox(), undefined);
      } finally { await view.unmount(); }
    });
  }
});
