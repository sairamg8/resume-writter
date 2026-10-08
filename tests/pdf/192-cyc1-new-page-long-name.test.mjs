// Editor hunt (cycle 1): the New page says whose details its pages show ("Each page is your résumé "<name>" in that look").
// A résumé is often named like the file it came from (Jane_Doe_Product_Manager_CV_2026_final): one long word. The line sat in a
// flex item that would not shrink below that word, and the sentence had no break-words, so on a 360 px phone the page ran past the
// screen and scrolled sideways. fake-dom has no layout: the classes the line and the box around it carry are read.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { elements, mount } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

let NewResume;
before(async () => {
  patchFakeDom();
  await setup();
  ({ NewResume } = await loadModule('/src/pages/NewResume.jsx'));
});
after(teardown);

const NAME = 'Alexander_Hamilton_Senior_Product_Manager_CV_2026_final';
const classes = (el) => String(el.getAttribute('class') ?? el.className ?? '').split(/\s+/);

it('a résumé with a long one-word name: its sentence breaks inside the word and its box can shrink', async () => {
  const cv = Object.assign(resume({ personal: { name: 'Alexander Hamilton', title: 'Product Manager' } }), { id: 'resume_long', name: NAME, updatedAt: 1000 });
  const store = {
    appState: { resumes: [cv], deletedIds: [], activeId: cv.id, jobs: [] },
    persistError: null, recovery: null,
    createResume: () => 'resume_new_1',
  };
  const view = mount(() => createElement(MemoryRouter, { initialEntries: ['/new'] }, createElement(NewResume, { store })), {});
  try {
    const line = [...elements(view.container)].find((el) => el.getAttribute('data-testid') === 'new-resume-from');
    assert.ok(line, 'the sentence is on the page');
    assert.ok(line.textContent.includes(NAME), 'it names the résumé');
    assert.ok(classes(line).includes('break-words'), `the sentence breaks inside a long word (${classes(line).join(' ')})`);
    assert.ok(classes(line.parentNode).includes('min-w-0'), `its box can shrink below the word (${classes(line.parentNode).join(' ')})`);
  } finally { await view.unmount(); }
});
