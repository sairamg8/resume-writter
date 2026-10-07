// UI rebuild B5b: the New page (NewResume.jsx) drawn with the design tokens keeps every function: back-or-home,
// every look selectable (templates, designs, saved designs), the live category chips only, a pick makes one
// résumé once, Your details from, the role starters and Start blank.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

let NewResume;
before(async () => {
  patchFakeDom();
  await setup();
  ({ NewResume } = await loadModule('/src/pages/NewResume.jsx'));
});
after(teardown);

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const cv = (id, name, updatedAt) => Object.assign(resume({ personal: { name: `${name} Person`, title: 'Analyst' } }), { id, name, updatedAt });

function page(resumes = []) {
  const created = [];
  const store = {
    appState: { resumes, deletedIds: [], activeId: resumes[0]?.id ?? null, jobs: [] },
    persistError: null, recovery: null,
    createResume: (...args) => { created.push(args); return `resume_new_${created.length}`; },
  };
  const view = mount(() => createElement(MemoryRouter, { initialEntries: ['/dashboard-before', '/new'], initialIndex: 1 }, createElement(NewResume, { store })), {});
  const all = () => [...elements(view.container)];
  const ev = () => ({ preventDefault() {}, stopPropagation() {}, target: {}, currentTarget: {} });
  return {
    view, created, all,
    byTestid: (id) => all().find((el) => el.getAttribute('data-testid') === id),
    looks: () => all().filter((el) => /^new-/.test(el.getAttribute('data-testid') ?? '') && el.tagName === 'BUTTON'),
    press: (el) => view.act(() => reactProps(el).onClick(ev())),
  };
}

it('the page is drawn with the tokens: the ground colour, the 1160 px column, a back link named Documents', async () => {
  const p = page();
  try {
    const root = p.byTestid('new-resume-page');
    assert.match(String(root.getAttribute('class') ?? root.className), /bg-cv-ground/);
    assert.ok(p.all().some((el) => /max-w-\[1160px\]/.test(String(el.getAttribute('class') ?? ''))), 'the Documents page\'s width, so the edge stays put');
    const back = p.all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Back');
    assert.ok(back && /Documents/.test(text(back)), 'a back button reading Documents');
    assert.ok(p.all().some((el) => el.tagName === 'H1' && text(el) === 'Pick a look to start'));
  } finally { await p.view.unmount(); }
});

it('every look the picker has is a button on the page: templates, designs and saved designs, none fewer', async () => {
  const { pickerCards } = await loadModule('/src/utils/templatePicker.js');
  const { savedDesigns } = await loadModule('/src/constants/templatePresets.js');
  const p = page([cv('resume_a', 'A CV', 1000)]);
  try {
    const expected = pickerCards({}, savedDesigns([cv('resume_a', 'A CV', 1000)])).length;
    assert.ok(expected >= 28, `the picker has at least 28 looks (${expected})`);
    assert.equal(p.looks().length, expected, 'one button per look');
  } finally { await p.view.unmount(); }
});

it('only the live category chips show (All and each category the looks have), not One column / Two columns / ATS-safe filters', async () => {
  const p = page();
  try {
    const chips = [...elements(p.byTestid('new-resume-categories'))].filter((el) => el.tagName === 'BUTTON').map(text);
    assert.equal(chips[0], 'All');
    assert.ok(chips.length >= 2);
    for (const parked of ['One column', 'Two columns', 'ATS-safe']) assert.ok(!chips.includes(parked), `${parked} is parked (D-11)`);
  } finally { await p.view.unmount(); }
});

it('a pick makes one résumé, once, even on a double-click; with résumés it starts from the most recent one', async () => {
  const p = page([cv('resume_a', 'Older CV', 1000), cv('resume_b', 'Newest CV', 3000)]);
  try {
    const first = p.looks()[0];
    p.press(first);
    p.press(first);
    assert.equal(p.created.length, 1, 'once');
    assert.equal(p.created[0][3], 'resume_b', 'from the most recently edited résumé');
  } finally { await p.view.unmount(); }
});

it('Your details from lists the résumés, and the pick starts from the one chosen', async () => {
  const p = page([cv('resume_a', 'Older CV', 1000), cv('resume_b', 'Newest CV', 3000)]);
  try {
    const select = p.byTestid('new-resume-source');
    assert.ok(select, 'the select shows with several résumés');
    view_change(p, select, 'resume_a');
    p.press(p.looks()[0]);
    assert.equal(p.created[0][3], 'resume_a');
  } finally { await p.view.unmount(); }
});
function view_change(p, el, value) { p.view.act(() => reactProps(el).onChange({ target: { value }, currentTarget: { value } })); }

it('Start blank and each role starter are there and make one résumé', async () => {
  const { STARTER_TEMPLATES } = await loadModule('/src/utils/starterTemplates.js');
  const p = page();
  try {
    const chooser = p.byTestid('starter-chooser');
    const names = [...elements(chooser)].filter((el) => el.tagName === 'H3').map(text);
    assert.ok(names.some((n) => /Start from Scratch/.test(n)), 'Start blank');
    for (const s of STARTER_TEMPLATES) assert.ok(names.includes(s.name), s.name);
    assert.equal(STARTER_TEMPLATES.length, 5, 'all five role starters');
    const starter = [...elements(chooser)].find((el) => el.tagName === 'H3' && text(el) === STARTER_TEMPLATES[0].name);
    let button = starter; while (button.tagName !== 'BUTTON') button = button.parentNode;
    p.press(button);
    p.press(button);
    assert.equal(p.created.length, 1, 'once');
  } finally { await p.view.unmount(); }
});
