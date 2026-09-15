// The owner's login (a demo account, useDemoSeed) always has its ORIGINAL résumés — the ones
// marked "Keep as my original" — and never the fictional samples it got until 2026-09-15 (user:
// "i want to see my original resume data instead of sample one"). An e2e build (`vite build
// --mode e2e`) signs in the fake account these specs put in localStorage and runs that page
// without Firebase, so this is the local-only path; the cloud side (flags, the latest copy from
// another device) runs in tests/pdf/18-cloud-sync-*.test.mjs, the rules in tests/unit/demo-seed.
import { STORAGE_KEY } from '../../tests/helpers.js';
import { CARD } from '../support/selectors.js';
import { dashboardState } from '../support/state.js';

const OWNER = { uid: 'e2e-owner', email: 'sairamgudiputi8@gmail.com', displayName: 'Owner' };
const OTHER = { uid: 'e2e-other', email: 'someone@example.com', displayName: 'Someone' };

/** The header's account button: it shows the signed-in user's first name, as after a Google sign-in. */
const accountButton = (user) => cy.contains('button', user.displayName.split(' ')[0]);

/**
 * Open the dashboard signed in as `user` (null = signed out) with `state` as the résumé store,
 * and check the header shows that account: the tests below claim what happens to a signed-in
 * user, so each proves the fake sign-in happened (R4-9) — a broken seam leaves the page signed out.
 */
function visitAs(user, state = null) {
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
function stateWith(...list) {
  const base = dashboardState(['classic']).resumes[0];
  const resumes = list.map(([name, { keep = false, id = `resume_${name.replace(/\W+/g, '_').toLowerCase()}` } = {}]) => (
    { ...base, id, name, ...(keep ? { keep: true } : {}) }
  ));
  return { ...dashboardState(['classic']), resumes, activeId: resumes[0].id };
}

const okEveryConfirm = () => cy.window().then((win) => { cy.stub(win, 'confirm').returns(true); });
const deleteCard = (name) => cy.contains(CARD, name).contains('button', 'Delete').click();
const openCard = (name) => cy.contains(CARD, name).contains('button', 'Edit').click();
const backToDashboard = () => cy.get('button[title="Back to dashboard"]').click();
/** Assert the card names, in dashboard order (retries until the dashboard settles). */
const expectCards = (names) => cy.get(CARD).should(($cards) => {
  expect([...$cards].map((c) => c.querySelector('.group\\/name p')?.textContent)).to.deep.equal(names);
});
/**
 * A restore runs as soon as the account's list is known, or right after the last original goes.
 * "Nothing came back" checked at once could run before it; checked after making a résumé in the
 * editor and coming back, the list is exactly what the account made — a restore would have put
 * the originals, or before 2026-09-15 the five samples, in it by then.
 */
const newResumeAndBack = () => {
  cy.contains('button', 'New Resume').click();
  cy.contains('button', 'Export').should('be.visible');
  backToDashboard();
};

describe('demo account — the owner\'s originals come back, never the samples', () => {
  it('an empty account stays empty: no sample résumé appears', () => {
    visitAs(OWNER);
    cy.contains('No resumes yet').should('be.visible');
    newResumeAndBack();
    expectCards(['Untitled Resume']); // before: the five "Sample · …" résumés
  });

  it('deleting every résumé brings the original back, with its latest edits — and no sample', () => {
    visitAs(OWNER, stateWith(['My CV', { keep: true }], ['Classic CV']));
    openCard('My CV');
    cy.contains('label', 'Full Name').parent().next('input').clear().type('Sam Owner');
    backToDashboard();
    okEveryConfirm();
    deleteCard('Classic CV');
    deleteCard('My CV');
    expectCards(['My CV']);
    cy.store().should((s) => {
      expect(s.resumes).to.have.length(1);
      expect(s.resumes[0].personal.name).to.eq('Sam Owner');
      expect(s.resumes[0].keep).to.eq(true);
      expect(s.deletedIds).to.deep.eq(['resume_classic_cv'], 'the original is not deleted any more');
    });
    cy.reload();
    expectCards(['My CV']);
  });

  it('only samples left: the original comes back next to them; a deleted sample stays deleted', () => {
    visitAs(OWNER, stateWith(['My CV', { keep: true }], ['Sample · Classic', { id: 'demo_classic' }], ['Sample · Modern', { id: 'demo_modern' }]));
    okEveryConfirm();
    deleteCard('Sample · Modern');
    cy.get(CARD).should('have.length', 2);
    deleteCard('My CV');
    expectCards(['Sample · Classic', 'My CV']);
    cy.reload();
    expectCards(['Sample · Classic', 'My CV']); // before: every sample came back once none was left
  });

  it('an original deleted while another remains stays deleted; with the last one, both come back', () => {
    visitAs(OWNER, stateWith(['First', { keep: true }], ['Second', { keep: true }], ['Other']));
    okEveryConfirm();
    deleteCard('First');
    expectCards(['Second', 'Other']);
    deleteCard('Second');
    expectCards(['Other', 'First', 'Second']);
  });

  it('a résumé not kept as an original does not come back', () => {
    visitAs(OWNER, stateWith(['Classic CV']));
    okEveryConfirm();
    deleteCard('Classic CV');
    cy.contains('No resumes yet').should('be.visible');
    newResumeAndBack();
    expectCards(['Untitled Resume']);
  });
});

// Guards: other accounts never got anything back, before 2026-09-15 or since.
describe('demo account — nobody else gets anything back', () => {
  it('another account starts empty', () => {
    visitAs(OTHER);
    cy.contains('No resumes yet').should('be.visible');
    newResumeAndBack();
    expectCards(['Untitled Resume']);
  });

  it('another account stays empty after deleting its last résumé, even one marked as an original', () => {
    // Marked in the owner's account, it reached this one through a shared browser.
    visitAs(OTHER, stateWith(['My CV', { keep: true }]));
    okEveryConfirm();
    deleteCard('My CV');
    cy.contains('No resumes yet').should('be.visible');
    newResumeAndBack();
    expectCards(['Untitled Resume']);
    cy.store().its('resumes').should('have.length', 1);
  });

  it('a signed-out visitor starts empty (a guard: no account, so nothing to restore)', () => {
    visitAs(null);
    cy.contains('No resumes yet').should('be.visible');
    newResumeAndBack();
    expectCards(['Untitled Resume']);
  });
});
