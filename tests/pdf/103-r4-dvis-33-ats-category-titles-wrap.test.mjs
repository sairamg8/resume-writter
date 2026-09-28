// R4-DVIS-33: ATS Check's six category headers. Each title was one truncated line (truncate) beside its
// "N / M pts" badge and chevron (about 100 px), leaving it about 170 px in the editor's 360 px panel and on
// a phone: "Contact & Header Information", "ATS Standard Section Headings", "Work Experience & Action
// Verbs" and "ATS Layout & Parser Safety" were cut to an ellipsis, with no title to read them by. The
// title now wraps onto a second line (leading-snug) inside its min-w-0 column, kept clear of the points
// by the header's gap; the status dot beside it keeps its round shape (shrink-0) as the title wraps.
// The real panel is mounted (react-dom/client over tests/pdf/fake-dom.mjs) over an in-memory
// sessionStorage; fake-dom has no layout, so the titles' class tokens are checked.
// Run: node --test tests/pdf/103-r4-dvis-33-ats-category-titles-wrap.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount, elements } from './fake-dom.mjs';

before(setup);
after(() => { delete globalThis.sessionStorage; return teardown(); });

function memoryStorage() {
  const map = new Map();
  return {
    get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k),
  };
}

const store = { updateSections() {}, updateSetting() {}, setTemplate() {} };

/** The six categories, as the checker names them (atsChecker.js), written out rather than read from it. */
const CATEGORIES = [
  'Contact & Header Information', 'ATS Standard Section Headings', 'Work Experience & Action Verbs',
  'Education & Credentials', 'Skills & Keyword Density', 'ATS Layout & Parser Safety',
];

/** The class tokens of `el`, as a set. */
const tokens = (el) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));

/** Tokens that keep text on one cut line. */
const ONE_LINE = ['truncate', 'whitespace-nowrap', 'text-ellipsis', 'overflow-hidden', 'line-clamp-1'];

it('R4-DVIS-33: every ATS category title wraps instead of being cut to an ellipsis', async () => {
  globalThis.sessionStorage = memoryStorage();
  const r = {
    ...resume({ template: 'classic', sections: [{ ...section('skills', [{ category: 'Tools', skills: 'Terraform' }]), id: 'sk' }] }),
    id: 'res-dvis-33',
  };
  const { default: AtsCheckerPanel } = await loadModule('/src/components/AtsCheckerPanel.jsx');
  const view = mount(() => createElement(AtsCheckerPanel, { resume: r, store }), {});
  try {
    const all = [...elements(view.container)];
    for (const label of CATEGORIES) {
      const title = all.find((el) => el.tagName === 'SPAN' && el.textContent === label && el.parentNode?.parentNode?.tagName === 'BUTTON');
      assert.ok(title, `the ${label} header is on the tab`);
      const got = tokens(title);
      for (const t of ONE_LINE) assert.equal(got.has(t), false, `${label}: "${t}" cuts the title to one line`);
      assert.ok(got.has('leading-snug'), `${label}: a wrapped title keeps its two lines close`);

      const column = title.parentNode;
      assert.ok(tokens(column).has('min-w-0'), `${label}: its column can narrow, so the title wraps within the header`);
      const dot = column.childNodes.find((el) => el !== title && el.nodeType === 1);
      assert.ok(tokens(dot).has('shrink-0'), `${label}: the status dot stays round beside a wrapped title`);

      const header = column.parentNode;
      assert.equal(header.tagName, 'BUTTON', `${label}: the title is in its category's header button`);
      assert.ok([...tokens(header)].some((t) => t.startsWith('gap-')), `${label}: a wrapped title keeps clear of the points beside it`);
    }
  } finally {
    await view.unmount();
  }
});
