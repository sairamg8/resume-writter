// R4-DVIS-12: in a narrow split panel (240–360 px wide) the editor's Resume | Cover Letter | ATS Check
// tabs kept their full no-wrap width — a flex item's min-width is its content — so they spilled past
// their rounded group and slid under the Design button, which hid ATS Check and part of Cover Letter.
// From sm up the tabs now share the group's width (flex-1 with sm:min-w-0) and each label is a span that
// truncates; a phone still keeps each tab and the group whole (min-w-max) and scrolls the row. The fake DOM has no
// layout, so this pins the classes that make it on the real EditorModeBar, mounted with
// react-dom/client over tests/pdf/fake-dom.mjs.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount } from './fake-dom.mjs';

before(setup);
after(teardown);

const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
const LABELS = ['Resume', 'Cover Letter', 'ATS Check'];

it('each tab shrinks with its group and truncates its label, instead of spilling under the Design button', async () => {
  const { EditorModeBar } = await loadModule('/src/components/EditorHeader.jsx');
  for (const activeTab of ['resume', 'coverletter', 'ats', 'design']) {
    const view = mount(EditorModeBar, { activeTab, setActiveTab() {} });
    try {
      const all = [...elements(view.container)];
      for (const label of LABELS) {
        const tab = all.find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === label);
        assert.ok(tab, `${activeTab}: the ${label} tab`);
        assert.ok(tokens(tab).includes('flex-1'), `${label}: the tabs share the group's width`);
        assert.ok(tokens(tab).includes('sm:min-w-0'), `${label}: without sm:min-w-0 the tab keeps its full no-wrap width and overflows the group`);
        // On a phone each tab stays whole: a bare min-w-0 there splits a 375 px row into equal thirds,
        // too narrow for "Cover Letter", which was cut to "Cover Le…" where it used to fit.
        assert.ok(tokens(tab).includes('min-w-max'), `${label}: a phone keeps the tab at its full width`);
        assert.ok(!tokens(tab).includes('min-w-0'), `${label}: no min-w-0 below sm, where the row scrolls instead`);
        const text = [...elements(tab)].find((el) => el.tagName === 'SPAN' && el.textContent === label);
        assert.ok(text, `${label}: its label is a span that can truncate, not a bare text node`);
        for (const t of ['min-w-0', 'truncate']) assert.ok(tokens(text).includes(t), `${label}: the label span has ${t}`);
        const group = tab.parentNode;
        assert.ok(tokens(group).includes('sm:min-w-0'), 'from sm up the group shrinks with the row');
        assert.ok(tokens(group).includes('min-w-max'), 'a phone keeps the tabs whole and scrolls the row');
      }
      const design = all.find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Design & Customize');
      assert.ok(design && tokens(design).includes('shrink-0'), 'the Design button keeps its size beside the tabs');
    } finally { await view.unmount(); }
  }
});
