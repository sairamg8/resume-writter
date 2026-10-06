// UI rebuild B3 (cluster frame, review): where the bar's parts sit at each window width. The bar is a flex row of
// independent leaves placed by `order`; from xl (1280 px) it is one row, below it it wraps to two (the header's two
// ends, then the switch, the ATS button, the save chip and Design) and on a phone the save chip has a row of its
// own between them. Without that the name had no room: at 390 px, signed in, Back with its word, the 88 px chip
// and Export with the account left the résumé's name about 16 px (rename is reached by tapping it, EDIT-142), and
// from 768 to about 950 px the name and the red "Not saved" went the same way. A node mirror of the browser's
// flex wrapping over the real bar's classes: each Tailwind variant (max-md, md, xl, max-xl) is evaluated at a
// window width, the visible children are sorted by `order`, and a child that takes the whole width (basis-full)
// is a row of its own, so a class moved to another breakpoint fails here. The real browser's geometry is B4's.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepare, finish, openEditor, attr, elements, text } from './180-ui-b3-editor-mount.mjs';

before(prepare);
after(finish);

const BREAKPOINT = { md: 768, xl: 1280 };

/** The utilities of `classes` in force at window width `width`, a variant's after the unprefixed ones as the stylesheet orders them. */
function activeAt(classes, width) {
  const base = [];
  const variant = [];
  for (const token of classes.split(/\s+/).filter(Boolean)) {
    const m = token.match(/^(max-)?(md|xl):(.+)$/);
    if (!m) { base.push(token); continue; }
    const holds = m[1] ? width < BREAKPOINT[m[2]] : width >= BREAKPOINT[m[2]];
    if (holds) variant.push(m[3]);
  }
  return [...base, ...variant];
}

/** The last of the utilities in force that `pick` matches. */
const last = (tokens, pick) => tokens.filter(pick).at(-1);

/** The bar's children, named by what is in them. */
function parts(t) {
  const bar = t.byTid('editor-bar');
  const kids = bar.childNodes.filter((n) => n.nodeType === 1);
  const has = (kid, test) => [kid, ...elements(kid)].some(test);
  const tid = (id) => (el) => attr(el, 'data-testid') === id;
  const name = (kid) => {
    if (has(kid, (el) => attr(el, 'title') === 'Back to dashboard')) return 'left';
    if (has(kid, (el) => el.tagName === 'BUTTON' && text(el) === 'Export')) return 'right';
    if (has(kid, tid('doc-switch-resume'))) return 'switch';
    if (has(kid, tid('ats-chip'))) return 'ats';
    if (has(kid, tid('design-button'))) return 'design';
    if (has(kid, tid('save-status'))) return 'save';
    return 'break';
  };
  return { bar, kids: kids.map((kid) => ({ name: name(kid), classes: attr(kid, 'class') })) };
}

/** The rows the bar lays out at `width`: the visible children by `order` (DOM order between equals), a full-width one alone in its row. The empty break between rows is not a part. */
function rows(t, width) {
  const { bar, kids } = parts(t);
  const wraps = activeAt(attr(bar, 'class'), width).includes('flex-wrap');
  const visible = kids
    .map((kid, at) => {
      const on = activeAt(kid.classes, width);
      const display = last(on, (c) => c === 'hidden' || c === 'block' || c === 'flex');
      const order = Number(last(on, (c) => /^order-\d+$/.test(c))?.slice(6) ?? 0);
      return { ...kid, at, order, hidden: display === 'hidden', full: on.includes('basis-full') };
    })
    .filter((kid) => !kid.hidden)
    .sort((a, b) => a.order - b.order || a.at - b.at);
  if (!wraps) return [visible.filter((kid) => kid.name !== 'break').map((kid) => kid.name)];
  const out = [];
  let row = [];
  for (const kid of visible) {
    if (kid.full) {
      if (row.length) out.push(row);
      out.push(kid.name === 'break' ? [] : [kid.name]);
      row = [];
    } else row.push(kid.name);
  }
  if (row.length) out.push(row);
  return out.filter((r) => r.length);
}

describe('the bar at each window width', () => {
  it('a phone (390 px): the header with the name and the account, the save chip on its own row, then the switch and the ATS button; Design is the pill\'s', async () => {
    const t = await openEditor({ signedIn: true });
    try {
      // The Design button is hidden by the Editor's phone flag (the pill's own), so the window is made a phone's first (H2-14).
      t.goPhone();
      for (const width of [360, 390, 767]) {
        assert.deepEqual(rows(t, width), [['left', 'right'], ['save'], ['switch', 'ats']], `${width} px`);
      }
    } finally { await t.close(); }
  });

  it('a tablet or a small laptop (768 to 1279 px): two rows, the header\'s two ends, then the switch, the ATS button, the save chip and Design', async () => {
    const t = await openEditor({ signedIn: true });
    try {
      for (const width of [768, 900, 1024, 1279]) {
        assert.deepEqual(rows(t, width), [['left', 'right'], ['switch', 'ats', 'save', 'design']], `${width} px`);
      }
    } finally { await t.close(); }
  });

  it('a desktop (1280 px and up): one row, back and the name, the switch, ATS, the save chip, Design, then Export, Share and the account', async () => {
    const t = await openEditor({ signedIn: true });
    try {
      for (const width of [1280, 1440, 1920]) {
        assert.deepEqual(rows(t, width), [['left', 'switch', 'ats', 'save', 'design', 'right']], `${width} px`);
      }
    } finally { await t.close(); }
  });

  it('the name is never in a row with the save chip on a phone, and the chip keeps its words (no 88 px cap)', async () => {
    const t = await openEditor();
    try {
      t.goPhone();
      const phone = rows(t, 390);
      assert.ok(!phone.some((row) => row.includes('left') && row.includes('save')));
      const chip = parts(t).kids.find((kid) => kid.name === 'save');
      assert.ok(!/max-w-\[88px\]/.test(chip.classes), 'a chip that fills its row needs no cap');
    } finally { await t.close(); }
  });
});

describe('the bar above the dock', () => {
  it('the bar is a layer above the dock, so the Export menu it opens over the row is not under the overlay (below 1100 px, a phone\'s sheet)', async () => {
    const t = await openEditor();
    try {
      const layer = (classes) => Number(classes.split(/\s+/).find((c) => /^z-\d+$/.test(c))?.slice(2) ?? 0);
      const bar = attr(t.byTid('editor-bar'), 'class');
      assert.ok(/\brelative\b/.test(bar), 'positioned, so its z-index counts');
      const dock = fs.readFileSync(new URL('../../src/components/EditorDock.jsx', import.meta.url), 'utf8').match(/max-\[1099px\]:z-(\d+)/);
      assert.ok(dock, 'the dock\'s overlay layer is in its classes');
      assert.ok(layer(bar) > Number(dock[1]), `the bar's z-${layer(bar)} is over the dock's z-${dock[1]}`);
    } finally { await t.close(); }
  });
});
