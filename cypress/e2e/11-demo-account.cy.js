// The owner's login (a demo account, useDemoSeed) always has its ORIGINAL résumés — the ones
// marked "Keep as my original" — and never the fictional samples it got until 2026-09-15 (user:
// "i want to see my original resume data instead of sample one"). An e2e build (`vite build
// --mode e2e`) signs in the fake account these specs put in localStorage and runs that page
// without Firebase, so this is the local-only path; the cloud side (flags, the latest copy from
// another device) runs in tests/pdf/18-cloud-sync-*.test.mjs, the rules in tests/unit/demo-seed.
// Marking one — the cards' and the Import menus' controls: 11-demo-account-keep.cy.js.
import {
  OWNER, OTHER, visitAs, stateWith, okEveryConfirm, deleteCard, openCard, backToDashboard, expectCards, newResumeAndBack,
} from '../support/demoAccount.js';
import { CARD } from '../support/selectors.js';

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
    // A deletion is the signed-in account's, even before its first sync (V2W1a-3).
    cy.store().its('deletedInfo.resume_my_cv.owner').should('eq', OTHER.uid);
    newResumeAndBack();
    expectCards(['Untitled Resume']);
    cy.store().its('resumes').should('have.length', 1);
  });

  it('another account and a signed-out visitor get no keep controls, and the plain Import', () => {
    [OTHER, null].forEach((user) => {
      visitAs(user, stateWith(['My CV', { keep: true }]));
      cy.contains(CARD, 'My CV').should('not.contain.text', 'Original').and('not.contain.text', 'Keep as my original');
      cy.contains('button', /^\s*Import\s*$/).should('not.have.attr', 'aria-expanded');
    });
  });

  it('a signed-out visitor starts empty (a guard: no account, so nothing to restore)', () => {
    visitAs(null);
    cy.contains('No resumes yet').should('be.visible');
    newResumeAndBack();
    expectCards(['Untitled Resume']);
  });
});
