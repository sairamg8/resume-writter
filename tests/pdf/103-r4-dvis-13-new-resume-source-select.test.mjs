// R4-DVIS-13: New Resume's "Your details from" picker was a hand-rolled <select> at 14 px, so on a phone
// or a tablet iOS zoomed the page into it when it was tapped, and it looked unlike the kit Chips right
// below it; the page was also narrower than the Dashboard it opens from (max-w-6xl against max-w-7xl),
// so the content edge jumped 64 px in on a wide screen. The picker is now the kit's Select (16 px on a
// touch screen, pointer-coarse:text-base, as tests/pdf/81-job-inputs-touch-text.test.mjs checks the
// tracker's fields), and both of the page's rows are max-w-7xl. The fake DOM has no layout, so this
// pins the classes that make it on the real NewResume page, mounted with react-dom/client over
// tests/pdf/fake-dom.mjs with two fictional résumés. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

/** New Resume on /new over a store of two résumés (the newer one, Lighthouse CV, is picked first). */
async function newResumePage() {
  const { NewResume } = await loadModule('/src/pages/NewResume.jsx');
  const resumes = [
    Object.assign(resume({ personal: { name: 'Wren Calloway' } }), { name: 'Harbor Pilot CV', updatedAt: 1000 }),
    Object.assign(resume({ personal: { name: 'Idris Vane' } }), { name: 'Lighthouse CV', updatedAt: 2000 }),
  ];
  const store = { appState: { resumes, activeId: resumes[0].id }, createResume: () => 'resume_new' };
  function Page() {
    return createElement(MemoryRouter, { initialEntries: ['/new'] }, createElement(NewResume, { store }));
  }
  const view = mount(Page, {});
  const byTestId = (id) => [...elements(view.container)].find((el) => el.getAttribute('data-testid') === id);
  return { view, resumes, byTestId };
}

it('"Your details from" is 16 px on a touch screen, so iOS does not zoom the page into it', async () => {
  const { view, resumes, byTestId } = await newResumePage();
  try {
    const select = byTestId('new-resume-source');
    assert.ok(select, 'two résumés: a choice of whose details');
    assert.equal(select.tagName, 'SELECT');
    assert.match(select.getAttribute('class') ?? '', /(^|\s)pointer-coarse:text-base(\s|$)/, 'under 16 px on touch: iOS zooms in on focus');
    assert.ok(tokens(select).includes('appearance-none'), 'the kit\'s select (its own chevron), not a hand-rolled one');
    assert.deepEqual(select.options.map((o) => o.textContent), ['Lighthouse CV', 'Harbor Pilot CV'], 'every résumé, the newest first');
    assert.equal(reactProps(select).value, resumes[1].id, 'the newest is picked');
    assert.equal(typeof reactProps(select).onChange, 'function', 'a pick still changes whose details are drawn');
  } finally { await view.unmount(); }
});

it('the page is as wide as the Dashboard (max-w-7xl), header and body alike', async () => {
  const { view, byTestId } = await newResumePage();
  try {
    const page = byTestId('new-resume-page');
    assert.ok(page, 'the New Resume page');
    const narrow = [...elements(page)].filter((el) => tokens(el).includes('max-w-6xl'));
    assert.equal(narrow.length, 0, 'no row narrower than the Dashboard');
    const [header, body] = page.childNodes;
    const headerRow = header.childNodes[0];
    for (const [name, row] of [['header', headerRow], ['body', body]]) {
      assert.ok(tokens(row).includes('max-w-7xl') && tokens(row).includes('mx-auto'), `the ${name} row is centred at the Dashboard's max-w-7xl`);
    }
  } finally { await view.unmount(); }
});
