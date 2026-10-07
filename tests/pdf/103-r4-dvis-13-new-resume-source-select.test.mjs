// R4-DVIS-13: New Resume's "Your details from" picker was a hand-rolled <select> at 14 px, so on a phone
// or a tablet iOS zoomed the page into it when it was tapped, and it looked unlike the kit Chips right
// below it; the page was also narrower than the Dashboard it opens from (max-w-6xl against max-w-7xl; since the UI rebuild both are the Documents page's max-w-[1160px]),
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

it('the page is as wide as the Documents page (max-w-[1160px]), its Back link and its body in one column', async () => {
  const { view, byTestId } = await newResumePage();
  try {
    const page = byTestId('new-resume-page');
    assert.ok(page, 'the New Resume page');
    for (const old of ['max-w-6xl', 'max-w-7xl']) {
      const stale = [...elements(page)].filter((el) => tokens(el).includes(old));
      assert.equal(stale.length, 0, `no row at ${old}: the Documents page is 1160 px wide`);
    }
    assert.equal(page.childNodes.length, 1, 'one centred column: no full-width header row of its own');
    const column = page.childNodes[0];
    assert.ok(tokens(column).includes('max-w-[1160px]') && tokens(column).includes('mx-auto'), `the column is centred at the Documents page's width: ${tokens(column).join(' ')}`);
    const back = column.childNodes.find((el) => el.tagName === 'BUTTON');
    assert.ok(back, 'the Back link is the column\'s first element, inside it');
    assert.equal(back.getAttribute('aria-label'), 'Back');
    assert.equal(back.getAttribute('title'), 'Back');
    assert.equal(back.textContent.trim(), 'Documents');
    assert.equal(column.childNodes.indexOf(back), 0, 'above the heading');
  } finally { await view.unmount(); }
});
