// Regression tests: destructive deletes ask first (audit main-loop note M5).
import { CARD } from '../support/selectors.js';

/** Answer every window.confirm with `answer`, and expose the stub as @confirm. */
const answerConfirm = (answer) =>
  cy.window().then((win) => { cy.stub(win, 'confirm').returns(answer).as('confirm'); });

const sectionCard = (title) =>
  cy.get('input[type="text"]').filter((_, el) => el.value === title).closest('.rounded-xl');

describe('regressions — deletes ask first', () => {
  it('dashboard: cancelling the confirm keeps the resume', () => {
    cy.visitDashboard();
    answerConfirm(false);
    cy.contains(CARD, 'Dark').contains('button', 'Delete').click();
    cy.get('@confirm').should('have.been.calledOnceWith', 'Delete "Dark"? This cannot be undone.');
    cy.get(CARD).should('have.length', 6);
  });

  it('editor: cancelling keeps a section and an entry that has content', () => {
    cy.visitEditor('classic');
    answerConfirm(false);
    sectionCard('Volunteering').find('button[title="Section options"]').click();
    cy.contains('button', 'Delete section').click();
    cy.get('@confirm').should('have.been.calledWith', 'Delete the "Volunteering" section and its 1 entry?');
    cy.preview().should('contain.text', 'Red Cross');

    sectionCard('References').find('button[title="Delete entry"]').click();
    cy.get('@confirm').should('have.been.calledWith', 'Delete this entry?');
    cy.preview().should('contain.text', 'Jane Doe');
  });

  it('editor: an untouched new entry is removed without asking', () => {
    cy.visitEditor('classic');
    answerConfirm(false);
    sectionCard('Awards & Honors').within(() => {
      cy.contains('button', 'Add Award').click();
      cy.get('button[title="Delete entry"]').should('have.length', 2).last().click();
      cy.get('button[title="Delete entry"]').should('have.length', 1);
    });
    cy.get('@confirm').should('not.have.been.called');
  });

  it('job tracker: kanban and list deletes ask first', () => {
    cy.seedAndVisit('/#/jobs', null);
    answerConfirm(false);
    cy.get('button[title="Delete application"]').first().click({ force: true });
    cy.get('@confirm').should('have.been.calledWith', 'Delete Google?');
    cy.jobStore().its('jobs').should('have.length', 1);

    cy.get('button[title="List view"]').click();
    cy.get('button[title="Delete application"]').first().click({ force: true });
    cy.jobStore().its('jobs').should('have.length', 1);
  });
});
