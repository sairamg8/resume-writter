// The demo-account specs' steps (11-demo-account*.cy.js): the owner's login and another one,
// signed in through the e2e build's fake sign-in (docs/knowledge/08-testing.md), a store of named
// résumés, and the dashboard's and editor's clicks.
import { STORAGE_KEY } from '../../tests/helpers.js';
import { CARD, IMPORT_INPUT } from './selectors.js';
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
  cy.contains('h1', 'My Resumes').should('be.visible');
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

/** Pick `resume` as a file in the page's Import JSON input (a menu item opened it). */
export function chooseFile(resume) {
  cy.get(IMPORT_INPUT).selectFile({
    contents: Cypress.Buffer.from(JSON.stringify(resume)), fileName: 'mine.json', mimeType: 'application/json',
  }, { force: true });
}

/** Import `resume` from the dashboard, as the account's original or as a plain import. */
export function importFile(resume, { asOriginal }) {
  cy.contains('button', /^\s*Import\s*$/).click();
  cy.contains('button', asOriginal ? 'Import as my original' : 'Import JSON').click();
  chooseFile(resume);
  cy.contains('button', 'Export').should('be.visible'); // the editor opens it
}

export const okEveryConfirm = () => cy.window().then((win) => { cy.stub(win, 'confirm').returns(true); });
/** The Delete button of the card named `name`. */
export const deleteButton = (name) => cy.contains(CARD, name).contains('button', 'Delete');
export const deleteCard = (name) => deleteButton(name).click();
export const openCard = (name) => cy.contains(CARD, name).contains('button', 'Edit').click();
export const stopKeeping = (name) => cy.contains(CARD, name).contains('button', 'Stop keeping').click();
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
