// R4-DVIS-24: ATS Check in the editor's split panel on a desktop or tablet (360 px by default, 240-640
// dragged). Its rows went side by side on the window's width (sm:, 640 px), so in the 360 px panel the
// score card's title and its score badge ("B · Good - Minor Tweaks Needed") were set in one row that
// needed about 370 px of the 286 px inside the card: the badge ran out of the card and was cut at the
// panel's edge, the title squeezed to about 107 px; the plain-text card and the job scanner's header
// were squeezed the same way. The tab now lays out by its own width: its root is a container
// (@container) and those rows go side by side from a 448 px tab (@md:), where they fit — stacked in the
// 360 px panel and on a phone, as on a phone before; side by side in a wide panel or the full-width
// editor, as before. The "N% Match" pill no longer shrinks onto two lines beside the scanner's title.
// The real panel is mounted (react-dom/client over tests/pdf/fake-dom.mjs) over an in-memory
// sessionStorage; fake-dom has no layout or container queries, so the rows' class tokens are checked.
// Run: node --test tests/pdf/103-r4-dvis-24-ats-rows-by-panel-width.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

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

/** The class tokens of `el`, as a set. */
const tokens = (el) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));

/** The first element at or above `el` whose class has `token`. */
function upTo(el, token) {
  for (let n = el; n && n.nodeType === 1; n = n.parentNode) if (tokens(n).has(token)) return n;
  return null;
}

/** The row holding `el`'s heading and what sits beside it: set side by side by the tab's width, not the window's. */
function assertRowByTabWidth(row, name) {
  assert.ok(row, `${name}'s row is on the tab`);
  const got = tokens(row);
  assert.ok(got.has('flex-col'), `${name}: stacked in a narrow tab`);
  assert.ok(got.has('@md:flex-row'), `${name}: side by side from a 448 px tab`);
  assert.equal(got.has('sm:flex-row'), false, `${name}: not side by side on the window's width — in the 360 px panel it does not fit`);
  assert.equal([...got].some((t) => t.startsWith('sm:')), false, `${name}: no window-width variant left on the row`);
}

it('R4-DVIS-24: the score card, the plain-text card and the scanner\'s header go side by side on the tab\'s width, not the window\'s', async () => {
  globalThis.sessionStorage = memoryStorage();
  const r = {
    ...resume({ template: 'classic', sections: [{ ...section('skills', [{ category: 'Tools', skills: 'Terraform' }]), id: 'sk' }] }),
    id: 'res-dvis-24',
  };
  const { default: AtsCheckerPanel } = await loadModule('/src/components/AtsCheckerPanel.jsx');
  const view = mount(() => createElement(AtsCheckerPanel, { resume: r, store }), {});
  try {
    const all = () => [...elements(view.container)];
    const heading = (tag, text) => all().find((el) => el.tagName === tag && el.textContent.trim().startsWith(text));

    const root = view.container.childNodes[0];
    assert.ok(tokens(root).has('@container'), 'the tab is a container its rows measure');

    const title = heading('H2', 'ATS Score & Parser Checker');
    assert.ok(title, 'the score card is on the tab');
    assertRowByTabWidth(upTo(title, 'justify-between'), 'the score card');
    assert.ok(tokens(title).has('@md:text-base') && !tokens(title).has('sm:text-base'), 'the title grows with the tab, not the window');

    const outOf = all().find((el) => el.tagName === 'SPAN' && el.textContent === '/100');
    assert.ok(outOf, 'the score badge is on the tab');
    const badge = upTo(outOf, 'rounded-2xl');
    assert.ok(tokens(badge).has('self-stretch') && tokens(badge).has('@md:self-auto'), 'the badge spans the stacked card, and sits beside the title from @md');
    assert.equal(tokens(badge).has('sm:self-auto'), false, 'not on the window\'s width');

    assertRowByTabWidth(upTo(heading('H3', 'ATS Plain Text'), 'justify-between'), 'the plain-text card');
    assertRowByTabWidth(upTo(heading('H3', 'Target Job Description Scanner'), 'justify-between'), 'the scanner\'s header');

    // A posting with keywords shows its match beside the scanner's title: kept on one line.
    const box = all().find((el) => el.tagName === 'TEXTAREA');
    view.act(() => reactProps(box).onChange({ target: { value: 'Kubernetes Kubernetes Terraform' } }));
    const pill = all().find((el) => el.tagName === 'DIV' && /^\d+% Match$/.test(el.textContent.trim()));
    assert.ok(pill, 'the % Match pill shows');
    assert.ok(tokens(pill).has('shrink-0'), 'the pill keeps its width beside the title, not squeezed onto two lines');
    assert.ok(tokens(pill).has('@md:self-auto') && !tokens(pill).has('sm:self-auto'), 'and follows the tab\'s width');
  } finally {
    await view.unmount();
  }
});
