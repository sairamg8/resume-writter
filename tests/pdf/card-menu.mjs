// A résumé card's actions over the fake DOM (tests/pdf/fake-dom.mjs). Edit, Rename, Copy, Keep as my original /
// Stop keeping and Delete are in the card's "More" (⋯) menu (src/components/CardMenu.jsx, the kit's Menu): the
// menu's code is a lazy chunk (lazyPiece.jsx), so the ⋯ button is pressed and the item is polled for with a
// bounded loop — never a fixed number of ticks. The menu's list is drawn in a portal at the end of <body>.
// When the chunk cannot be had the card shows plain Edit / Copy / Keep… / Delete buttons: `plainAction`.
import assert from 'node:assert/strict';
import { elements, reactProps } from './fake-dom.mjs';

// The kit's menu is placed by useFloating, which asks for animation frames.
globalThis.requestAnimationFrame ??= (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);

export const MORE_TESTID = 'resume-card-more';
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const click = () => ({ preventDefault() {}, stopPropagation() {}, detail: 1, nativeEvent: {} });
const items = (view) => [...elements(view.document.body)].filter((el) => el.getAttribute('role') === 'menuitem');
const menu = (view) => [...elements(view.document.body)].find((el) => el.getAttribute('role') === 'menu');

/** The ⋯ button inside `card`, or undefined (the menu's code failed to load: the plain buttons are shown). */
export const moreButton = (card) => [...elements(card)].find((el) => el.tagName === 'BUTTON' && el.getAttribute('data-testid') === MORE_TESTID);

/** The labels of the open menu's items (the label only: an item's hint is its own line). */
const labelOf = (el) => ([...elements(el)].find((c) => c.tagName === 'SPAN' && c.getAttribute('class')?.includes('truncate')) ?? el).textContent.trim();
export const menuLabels = (view) => items(view).map(labelOf);

/**
 * Opens `card`'s menu (if it is not open) and returns its item `label` once it is there. The press made before the
 * menu's chunk has arrived opens the menu on arrival, so polling is by what is on the page, not by a clock.
 */
export async function cardMenuItem(view, card, label) {
  if (!menu(view)) {
    const more = moreButton(card);
    assert.ok(more, `no "More" button on the card: ${card.textContent.slice(0, 80)}`);
    view.act(() => reactProps(more).onClick(click()));
  }
  const find = () => items(view).find((el) => labelOf(el) === label);
  for (let i = 0; i < 500 && !find(); i += 1) {
    await sleep(10);
    view.act(() => {});
  }
  const item = find();
  assert.ok(item, `no menu item "${label}": the menu has ${menuLabels(view).join(' | ') || 'nothing'}`);
  return item;
}

/** Closes the open menu, if any, as Escape does. */
export function closeCardMenu(view) {
  const open = menu(view);
  if (open) view.act(() => reactProps(open).onKeyDown({ key: 'Escape', preventDefault() {}, stopPropagation() {} }));
}

/** Whether menu item `item` is disabled (the kit's aria-disabled). */
export const itemDisabled = (item) => item.getAttribute('aria-disabled') === 'true';

/** Presses `label` in `card`'s menu. Returns the item it pressed. */
export async function cardAction(view, card, label) {
  const item = await cardMenuItem(view, card, label);
  view.act(() => reactProps(item).onClick(click()));
  return item;
}

/** The plain button `label` of a card whose menu could not load. */
export function plainButton(card, label) {
  const found = [...elements(card)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === label);
  assert.ok(found, `no plain button "${label}"`);
  return found;
}
