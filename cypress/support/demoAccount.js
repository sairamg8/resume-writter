// The demo-account specs' steps (11-demo-account*.cy.js): the owner's login and another one,
// signed in through the e2e build's fake sign-in (docs/knowledge/08-testing.md), a store of named
// résumés, and the dashboard's and editor's clicks.
import { STORAGE_KEY } from '../../tests/helpers.js';
import { CARD, IMPORT_INPUT } from './selectors.js';
import { cardAction, menuItem } from './cardMenu.js';
import { dashboardState } from './state.js';

// Its e-mail is the e2e build's demo account (VITE_DEMO_ACCOUNTS in .env.e2e).
export const OWNER = { uid: 'e2e-owner', email: 'owner@example.com', displayName: 'Owner' };
export const OTHER = { uid: 'e2e-other', email: 'someone@example.com', displayName: 'Someone' };

/**
 * The header's account button: it shows the signed-in user's first name, as after a Google sign-in.
 * The one on screen — the dashboard has a compact header for phones and a full one from md up.
 */
const accountButton = (user) => cy.contains('button:visible', user.displayName.split(' ')[0]);

/**
 * Open the dashboard signed in as `user` (null = signed out) with `state` as the résumé store,
 * and check the header shows that account: the tests claim what happens to a signed-in user, so
 * each proves the fake sign-in happened (R4-9) — a broken seam leaves the page signed out.
 */
export function visitAs(user, state = null) {
  cy.visit('/#/', {
    onBeforeLoad(win) {
      win.localStorage.clear();
      if (state) win.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (user) win.localStorage.setItem('cpwtcv_e2e_user', JSON.stringify(user));
    },
  });
  cy.contains('h1', 'Documents').should('be.visible');
  if (user) accountButton(user).should('be.visible');
}

/**
 * A store with these résumés: [name, { keep, id }] — keep: marked "Keep as my original"; an id
 * starting demo_ is one of the samples the owner's account used to get.
 */
export function stateWith(...list) {
  const base = dashboardState(['classic']).resumes[0];
  const resumes = list.map(([name, { keep = false, id = `resume_${name.replace(/\W+/g, '_').toLowerCase()}` } = {}]) => (
    { ...base, id, name, ...(keep ? { keep: true } : {}) }
  ));
  return { ...dashboardState(['classic']), resumes, activeId: resumes[0].id };
}

/** A résumé file to import, named `name`. */
export const file = (name, extra = {}) => ({ ...dashboardState(['sidebar']).resumes[0], id: 'from_the_file', name, ...extra });

/** Pick `resume` as a file in the page's Import file input (a choice in the Import dialog started the picker). */
export function chooseFile(resume) {
  cy.get(IMPORT_INPUT).selectFile({
    contents: Cypress.Buffer.from(JSON.stringify(resume)), fileName: 'mine.json', mimeType: 'application/json',
  }, { force: true });
}

/** The Import dialog (the kit's Dialog, in a portal; its code is a lazy chunk, so Cypress retries until it is there). */
export const importDialog = () => cy.get('[role="dialog"]').contains('h2', 'Import a file').closest('[role="dialog"]');

/** Press the dashboard's Import and wait for its dialog. */
export function openImportDialog() {
  cy.contains('button', /^\s*Import\s*$/).click();
  return importDialog().should('be.visible');
}

/** Import `resume` from the dashboard, as the account's original ("Import as my original") or as a plain import ("Choose a file"). */
export function importFile(resume, { asOriginal }) {
  openImportDialog().contains('button', asOriginal ? 'Import as my original' : 'Choose a file').click();
  cy.get('[role="dialog"]').should('not.exist'); // choosing closes the dialog and starts the file picker
  chooseFile(resume);
  cy.contains('button', 'Export').should('be.visible'); // the editor opens it
}

export const okEveryConfirm = () => cy.window().then((win) => { cy.stub(win, 'confirm').returns(true); });
/**
 * The Delete item of the card named `name`: its ⋯ menu is opened, and left open (a disabled one has aria-disabled="true";
 * closeMenu in support/cardMenu.js closes it). The card's actions are in that menu since B5a.
 */
export const deleteButton = (name) => menuItem(name, 'Delete');
export const deleteCard = (name) => cardAction(name, 'Delete');
export const openCard = (name) => cardAction(name, 'Edit');
export const stopKeeping = (name) => cardAction(name, 'Stop keeping');
/** What the last original's card says, and its disabled Delete (V2OWNER-DATA-4). */
export const LAST_ORIGINAL_HINT = 'Your last original always comes back. To delete it, choose "Stop keeping" first.';
export const backToDashboard = () => cy.get('button[title="Back to dashboard"]').click();
/** Assert the card names, in dashboard order (retries until the dashboard settles). */
export const expectCards = (names) => cy.get(CARD).should(($cards) => {
  expect([...$cards].map((c) => c.querySelector('.group\\/name p')?.textContent)).to.deep.equal(names);
});
/**
 * A restore runs as soon as the account's list is known, or right after the last original goes.
 * "Nothing came back" checked at once could run before it; checked after making a résumé in the
 * editor and coming back, the list is exactly what the account made — a restore would have put
 * the originals, or before 2026-09-15 the five samples, in it by then.
 */
export const newResumeAndBack = () => {
  cy.contains('button', 'New Resume').click();
  cy.contains('button', 'Start from Scratch (Blank)').click(); // New Resume asks: blank or a role starter
  cy.contains('button', 'Export').should('be.visible');
  backToDashboard();
};
