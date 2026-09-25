// The month picker's writes, through to the exports (R2-171). 30-date-editor pins what the picker
// shows for a stored date and 88-month-picker what blanking one half stores; this drives the real
// MonthPicker and the Experience card over the fake DOM and pins what they write: a month then a
// year (or a year then a month) is "Apr 2019", the form every build reads, which the PDF, Word,
// Markdown and ATS text print in the résumé's Date format; the × clears it to ''; and "Currently
// working here" clears the End Date and disables its picker, the entry then printing "<start> –
// Present" everywhere — never a stale End Date left under the flag.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { setup, teardown, resume, section, render, read, allText, renderDocx, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const all = (view) => [...elements(view.container)];
const selects = (view) => all(view).filter((el) => el.tagName === 'SELECT');
const byLabel = (view, label) => {
  const el = selects(view).find((s) => s.getAttribute('aria-label') === label);
  assert.ok(el, `a select labelled "${label}": ${selects(view).map((s) => s.getAttribute('aria-label'))}`);
  return el;
};
/** The picker's × — the button beside its two selects — or undefined when it shows none. */
const clearOf = (select) => select.parentNode.childNodes.find((el) => el.tagName === 'BUTTON');
const choose = (view, select, value) => view.act(() => reactProps(select).onChange({ target: { value } }));

/** A lone MonthPicker, re-rendered with each value it writes, as its card re-renders it. */
async function picker(value, steps) {
  const { MonthPicker } = await loadModule('/src/components/SectionEditorShared.jsx');
  const written = [];
  let props;
  const onChange = (v) => { written.push(v); props = { ...props, value: v }; };
  props = { label: 'Start Date', value, onChange };
  const view = mount(MonthPicker, props);
  try {
    for (const step of steps) {
      step(view);
      view.update(props);
    }
    return { written, view: { clear: clearOf(byLabel(view, 'Start Date month')), month: reactProps(byLabel(view, 'Start Date month')).value, year: reactProps(byLabel(view, 'Start Date year')).value } };
  } finally { await view.unmount(); }
}
const month = (m) => (view) => choose(view, byLabel(view, 'Start Date month'), m);
const year = (y) => (view) => choose(view, byLabel(view, 'Start Date year'), y);
const clear = (view) => view.act(() => reactProps(clearOf(byLabel(view, 'Start Date month'))).onClick());

describe('what the month picker writes (R2-171)', () => {
  it('a month, then a year: "Apr", then "Apr 2019"', async () => {
    const { written, view } = await picker('', [month('Apr'), year('2019')]);
    assert.deepEqual(written, ['Apr', 'Apr 2019']);
    assert.deepEqual([view.month, view.year], ['Apr', '2019'], 'the selects show what was written');
  });

  it('a year, then a month: "2019", then "Apr 2019"', async () => {
    const { written } = await picker('', [year('2019'), month('Apr')]);
    assert.deepEqual(written, ['2019', 'Apr 2019']);
  });

  it('an imported "05/2023" re-picked writes the picker\'s own form', async () => {
    const { written } = await picker('05/2023', [year('2024')]);
    assert.deepEqual(written, ['May 2024']);
  });

  it('the × writes "" and then shows no ×; an empty picker shows none', async () => {
    const { written, view } = await picker('Apr 2019', [clear]);
    assert.deepEqual(written, ['']);
    assert.deepEqual([view.month, view.year, view.clear], ['', '', undefined]);
  });

  it('every date the picker writes reads back as the month and year picked', async () => {
    const { parseMonthYear } = await loadModule('/src/utils/dates.js');
    const { MONTHS } = await loadModule('/src/components/SectionEditorShared.jsx');
    for (const [i, m] of MONTHS.entries()) {
      const { written } = await picker('', [month(m), year('2021')]);
      assert.deepEqual(parseMonthYear(written.at(-1)), { y: 2021, m: i + 1 }, written.at(-1));
    }
  });
});

/** The Experience card for `item`, opened; each onUpdate is kept and rendered back into the card. */
async function card(item) {
  const { ExperienceItem } = await loadModule('/src/components/SectionEditorEntryItems.jsx');
  const updates = [];
  let props;
  props = { item, onUpdate: (u) => { updates.push(u); props = { ...props, item: u }; }, onRemove() {} };
  const view = mount(ExperienceItem, props);
  view.act(() => reactProps(all(view).find((el) => el.tagName === 'DIV' && reactProps(el)?.onClick)).onClick());
  const step = (fn) => { fn(); view.update(props); };
  return {
    view,
    updates,
    get item() { return props.item; },
    pick: (label, value) => step(() => choose(view, byLabel(view, label), value)),
    current: (checked) => step(() => view.act(() => reactProps(all(view).find((el) => el.tagName === 'INPUT' && el.type === 'checkbox')).onChange({ target: { checked } }))),
    /** The End Date picker: its selects' values, whether it is greyed out and shows a ×. */
    end: () => {
      const m = byLabel(view, 'End Date month');
      return { month: reactProps(m).value, year: reactProps(byLabel(view, 'End Date year')).value, disabled: m.parentNode.parentNode.className.includes('pointer-events-none'), clear: Boolean(clearOf(m)) };
    },
  };
}

/** Each export's text for one job holding `item`, printed in Date format `dateFormat`. */
async function printedAs(item, dateFormat = 'asEntered') {
  const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
  const { generateAtsPlainText } = await loadModule('/src/utils/atsPlainText.js');
  const r = resume({ settings: { dateFormat }, sections: [section('experience', [item])] });
  return {
    pdf: allText(await read(await render(r))),
    word: (await renderDocx(r)).texts.join('\n'),
    markdown: generateMarkdownResume(r),
    ats: generateAtsPlainText(r),
  };
}
/** Each export prints `range` (the ATS text joins with a hyphen, the others with an en dash). */
function printsRange(out, range) {
  for (const k of ['pdf', 'word', 'markdown']) assert.ok(out[k].includes(range), `${k} prints "${range}": ${out[k]}`);
  assert.ok(out.ats.includes(range.replace(' – ', ' - ')), `ATS text prints "${range}": ${out.ats}`);
}
const JOB = { company: 'Quillmark', role: 'Kilnwright', location: 'Porthaven', startDate: '', endDate: '', current: false };

describe('the Experience card\'s dates, as every export prints them (R2-171)', () => {
  it('Start and End picked month-first and year-first print as the range, in each Date format', async () => {
    const c = await card({ ...JOB, id: 'exp_a' });
    try {
      c.pick('Start Date month', 'Apr');
      c.pick('Start Date year', '2019');
      c.pick('End Date year', '2022');
      c.pick('End Date month', 'Oct');
      assert.deepEqual(c.updates.map((u) => [u.startDate, u.endDate]), [['Apr', ''], ['Apr 2019', ''], ['Apr 2019', '2022'], ['Apr 2019', 'Oct 2022']]);
      assert.equal(c.item.company, 'Quillmark', 'the rest of the entry is kept');
    } finally { await c.view.unmount(); }
    printsRange(await printedAs(c.item), 'Apr 2019 – Oct 2022');
    printsRange(await printedAs(c.item, 'MM/YYYY'), '04/2019 – 10/2022');
    printsRange(await printedAs(c.item, 'MMMM YYYY'), 'April 2019 – October 2022');
  });

  it('the Start Date\'s × clears it: the entry prints its end alone, "– Oct 2022"', async () => {
    const c = await card({ ...JOB, id: 'exp_b', startDate: 'Apr 2019', endDate: 'Oct 2022' });
    try {
      c.view.act(() => reactProps(clearOf(byLabel(c.view, 'Start Date month'))).onClick());
      c.view.update({ item: c.updates.at(-1), onUpdate() {}, onRemove() {} });
      assert.deepEqual([c.updates.at(-1).startDate, c.updates.at(-1).endDate], ['', 'Oct 2022']);
      assert.equal(clearOf(byLabel(c.view, 'Start Date month')), undefined, 'the cleared picker shows no ×');
    } finally { await c.view.unmount(); }
    const out = await printedAs(c.updates.at(-1));
    for (const k of ['pdf', 'word', 'markdown']) assert.ok(out[k].includes('– Oct 2022') && !out[k].includes('Apr 2019'), `${k}: ${out[k]}`);
    assert.ok(!out.ats.includes('Apr 2019') && out.ats.includes('Oct 2022'), out.ats);
  });

  it('"Currently working here" clears the End Date and disables its picker; every export prints Present', async () => {
    const c = await card({ ...JOB, id: 'exp_c', startDate: 'Apr 2019', endDate: 'Oct 2022' });
    try {
      assert.deepEqual(c.end(), { month: 'Oct', year: '2022', disabled: false, clear: true });
      c.current(true);
      assert.deepEqual([c.item.current, c.item.endDate, c.item.startDate], [true, '', 'Apr 2019']);
      assert.deepEqual(c.end(), { month: '', year: '', disabled: true, clear: false });
    } finally { await c.view.unmount(); }
    const out = await printedAs(c.item);
    printsRange(out, 'Apr 2019 – Present');
    for (const [k, text] of Object.entries(out)) assert.ok(!text.includes('Oct 2022'), `${k} prints no end date`);
    printsRange(await printedAs(c.item, 'MM/YYYY'), '04/2019 – Present');
  });

  it('unchecked again, the End Date stays empty (the old one is not restored) and can be picked', async () => {
    const c = await card({ ...JOB, id: 'exp_d', startDate: 'Apr 2019', endDate: 'Oct 2022' });
    let unchecked;
    try {
      c.current(true);
      c.current(false);
      unchecked = c.item;
      assert.deepEqual([unchecked.current, unchecked.endDate], [false, '']);
      assert.deepEqual(c.end(), { month: '', year: '', disabled: false, clear: false });
      c.pick('End Date month', 'Jan');
      c.pick('End Date year', '2024');
      assert.deepEqual([c.item.current, c.item.endDate], [false, 'Jan 2024']);
    } finally { await c.view.unmount(); }
    // Printed once the card is gone: the fake page's window must not be there while react-pdf renders.
    for (const [k, text] of Object.entries(await printedAs(unchecked))) {
      assert.ok(text.includes('Apr 2019') && !text.includes('Present') && !text.includes('Oct 2022'), `${k} prints the start alone: ${text}`);
    }
    printsRange(await printedAs(c.item), 'Apr 2019 – Jan 2024');
  });

  it('a current entry holding a stale End Date (an import): the picker shows none, every export prints Present', async () => {
    const stale = { ...JOB, id: 'exp_e', startDate: 'Apr 2019', endDate: 'Oct 2022', current: true };
    const c = await card(stale);
    try {
      assert.deepEqual(c.end(), { month: '', year: '', disabled: true, clear: false });
    } finally { await c.view.unmount(); }
    const out = await printedAs(stale);
    printsRange(out, 'Apr 2019 – Present');
    for (const [k, text] of Object.entries(out)) assert.ok(!text.includes('Oct 2022'), `${k} prints no stale end date`);
  });
});
