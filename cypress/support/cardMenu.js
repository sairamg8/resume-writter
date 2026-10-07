// A dashboard card's actions. Edit, Rename, Copy, Keep as my original / Stop keeping and Delete are in the card's
// ⋯ (More) menu; the menu's code is a lazy chunk, so every step below retries until it is there. The menu is drawn
// in a portal at the end of <body>, not inside the card.
import { CARD, MORE, MENU_ITEM } from './selectors.js';

/** Opens the menu of the first card whose text contains `name`. */
export const openMenu = (name) => cy.contains(CARD, name).find(MORE).click();

/** Opens `name`'s menu and yields its item `label` (starting with it: an item's hint follows its label). */
export const menuItem = (name, label) => {
  openMenu(name);
  return cy.contains(MENU_ITEM, new RegExp(`^\\s*${label}`));
};

/** Closes the open menu with Escape. */
export const closeMenu = () => {
  cy.get('[role="menu"]').type('{esc}');
  cy.get('[role="menu"]').should('not.exist');
};

/** Presses `label` in `name`'s menu. */
export const cardAction = (name, label) => menuItem(name, label).click();

/** Checks that `name`'s menu offers `label` (and that it is enabled unless `enabled` is false), then closes it. */
export const offers = (name, label, { enabled = true } = {}) => {
  if (enabled) menuItem(name, label).should('not.have.attr', 'aria-disabled');
  else menuItem(name, label).should('have.attr', 'aria-disabled', 'true');
  closeMenu();
};

/** Checks that `name`'s menu has no "Keep as my original" / "Stop keeping" (only a demo account's cards have them). */
export const offersNoKeep = (name) => {
  openMenu(name);
  cy.contains(MENU_ITEM, /^\s*Edit/).should('exist'); // the menu's code has arrived
  cy.contains(MENU_ITEM, /^\s*(Keep as my original|Stop keeping)/).should('not.exist');
  closeMenu();
};
