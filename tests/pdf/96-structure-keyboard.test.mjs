// Sections and entries reorder from the keyboard, and nothing tested it (R2-158; an entry's grip
// reaches the tab order since R2-115): with a grip focused, Space lifts the card, the arrow keys
// move it past its neighbours, Space drops it there and Escape puts it back. Driven through
// dnd-kit's own KeyboardSensor and sortableKeyboardCoordinates on the real Résumé tab and store
// (resume-tab.mjs): the grip's onKeyDown as React set it, then keys on the document, where the
// sensor listens. fake-dom has no layout, so each element is given a box one row below its previous
// sibling — a list, which is all the sensor measures. What the drop leaves is what the store keeps
// and the PDF prints.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allText } from './harness.mjs';
import { reactProps } from './fake-dom.mjs';
import { resumeTab, settle } from './resume-tab.mjs';

before(setup);
after(teardown);

const sample = () => resume({
  personal: { name: 'Wren Calloway', title: 'Harbor Pilot' },
  sections: [
    section('experience', [
      { role: 'Lamplighter', company: 'Brightwater Light' },
      { role: 'Ferry Pilot', company: 'Saltmarsh Line' },
    ]),
    section('projects', [{ name: 'Tidewatch' }]),
    section('skills', [{ category: 'Seamanship', skills: 'Knots, Charts' }]),
  ],
});

const printed = async (r) => allText(await read(await render(r)));

function printsInOrder(text, words) {
  const at = words.map((w) => text.indexOf(w));
  assert.ok(at.every((i) => i >= 0), `each of ${words.join(', ')} prints: ${text}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, `${words.join(' → ')} in this order: ${text}`);
}

/** A key press as dnd-kit reads it: its `code`, the element it is aimed at, preventDefault. */
class KeyboardEvent {
  constructor(type, { code, target }) {
    Object.assign(this, { type, code, key: code === 'Space' ? ' ' : code, target, defaultPrevented: false });
  }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() {}
}

/**
 * What dnd-kit asks of the page: every element a box 80 tall, 100 below its previous sibling (the
 * cards of one list stack), no scrolling, and the window's classes it checks nodes and events
 * against. Returns the undo.
 */
function layOut(view) {
  const proto = Object.getPrototypeOf(view.container);
  proto.getBoundingClientRect = function box() {
    const top = (this.parentNode ? this.parentNode.childNodes.indexOf(this) : 0) * 100;
    return { top, left: 0, width: 400, height: 80, bottom: top + 80, right: 400, x: 0, y: top };
  };
  Object.assign(view.window, {
    Document: Object.getPrototypeOf(view.document).constructor,
    HTMLElement: proto.constructor,
    SVGElement: class SVGElement {},
    KeyboardEvent,
    innerWidth: 1280,
    innerHeight: 100000,
    getComputedStyle: () => ({ position: 'static', overflow: 'visible', overflowX: 'visible', overflowY: 'visible', transform: '', transformOrigin: '' }),
  });
  return () => { delete proto.getBoundingClientRect; };
}

/** Tab to `grip` and press Space on it: its own onKeyDown lifts the card. */
async function lift(tab, grip) {
  tab.view.document.activeElement = grip;
  const nativeEvent = new KeyboardEvent('keydown', { code: 'Space', target: grip });
  tab.view.act(() => reactProps(grip).onKeyDown({
    nativeEvent, target: grip, currentTarget: grip, code: 'Space', key: ' ',
    preventDefault: () => nativeEvent.preventDefault(), stopPropagation() {},
  }));
  await settle();
}

/** Press `codes` in turn while a card is lifted: the sensor listens on the document. */
async function press(tab, grip, ...codes) {
  for (const code of codes) {
    tab.view.act(() => tab.view.document.dispatchEvent(new KeyboardEvent('keydown', { code, target: grip })));
    await settle();
  }
}

/** The Résumé tab over `sample()`, laid out; `close()` undoes both. */
async function openTab() {
  const tab = await resumeTab(sample());
  const undo = layOut(tab.view);
  const close = tab.close;
  return Object.assign(tab, { async close() { undo(); await close(); } });
}

const entryGrips = (tab, card) => tab.all(card).filter((el) => el.getAttribute('aria-label') === 'Reorder entry');
const sectionGrip = (tab, title) => tab.all(tab.card(title)).find((el) => el.getAttribute('aria-roledescription') === 'sortable');

describe('entries reorder from the keyboard (R2-158)', () => {
  it('Space lifts an entry, ArrowDown moves it below the next, Space drops it there; the PDF prints it there', async () => {
    const tab = await openTab();
    let moved;
    try {
      const exp = tab.card('Professional Experience');
      const grip = entryGrips(tab, exp)[0];
      await lift(tab, grip);
      await press(tab, grip, 'ArrowDown', 'Space');
      moved = tab.saved();
      assert.deepEqual(moved.sections[0].items.map((i) => i.role), ['Ferry Pilot', 'Lamplighter']);
      assert.deepEqual(tab.entries(exp), ['Ferry Pilot', 'Lamplighter']);
      assert.deepEqual(moved.sections.map((s) => s.type), ['experience', 'projects', 'skills'], 'the sections stay');
    } finally { await tab.close(); }
    printsInOrder(await printed(moved), ['Ferry Pilot', 'Lamplighter', 'Tidewatch']);
  });

  it('Escape puts a lifted entry back, and one at the top pressed up stays: nothing changes; the next Space, ArrowDown, Space still moves it', async () => {
    const tab = await openTab();
    try {
      const exp = tab.card('Professional Experience');
      const before = tab.saved();
      const grip = entryGrips(tab, exp)[0];
      await lift(tab, grip);
      await press(tab, grip, 'ArrowDown', 'Escape');
      assert.equal(tab.saved(), before, 'Escape: no change, no edit');
      await lift(tab, grip);
      await press(tab, grip, 'ArrowUp', 'Space');
      assert.equal(tab.saved(), before, 'nothing above the first entry: it stays');
      await lift(tab, grip);
      await press(tab, grip, 'ArrowDown', 'Space');
      assert.deepEqual(tab.saved().sections[0].items.map((i) => i.role), ['Ferry Pilot', 'Lamplighter']);
    } finally { await tab.close(); }
  });
});

describe('sections reorder from the keyboard (R2-158)', () => {
  it("Space lifts a section by its grip, ArrowDown moves it below the next, Space drops it there; the PDF prints it there", async () => {
    const tab = await openTab();
    let moved;
    try {
      const grip = sectionGrip(tab, 'Professional Experience');
      await lift(tab, grip);
      await press(tab, grip, 'ArrowDown', 'Space');
      moved = tab.saved();
      assert.deepEqual(moved.sections.map((s) => s.type), ['projects', 'experience', 'skills']);
      assert.deepEqual(tab.titles(), ['Projects', 'Professional Experience', 'Skills']);
      assert.deepEqual(moved.sections[1].items.map((i) => i.role), ['Lamplighter', 'Ferry Pilot'], 'its entries go with it, in order');
    } finally { await tab.close(); }
    printsInOrder(await printed(moved), ['Tidewatch', 'Lamplighter', 'Ferry Pilot', 'Seamanship']);
  });

  it('ArrowUp twice takes the last section to the top', async () => {
    const tab = await openTab();
    try {
      const grip = sectionGrip(tab, 'Skills');
      await lift(tab, grip);
      await press(tab, grip, 'ArrowUp', 'ArrowUp', 'Space');
      assert.deepEqual(tab.saved().sections.map((s) => s.type), ['skills', 'experience', 'projects']);
      assert.deepEqual(tab.titles(), ['Skills', 'Professional Experience', 'Projects']);
    } finally { await tab.close(); }
  });
});
