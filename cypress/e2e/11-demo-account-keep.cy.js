// A demo account's controls for its originals (useDemoSeed): "Keep as my original" / "Stop
// keeping" on a card, "Import as my original", and what Delete does to an original. What comes
// back, and to whom: 11-demo-account.cy.js. The e2e build's fake sign-in, no Firebase.
import {
  OWNER, visitAs, stateWith, file, importFile, okEveryConfirm, deleteCard, backToDashboard, expectCards, newResumeAndBack,
} from '../support/demoAccount.js';
import { CARD } from '../support/selectors.js';

describe('demo account — "Keep as my original" and "Import as my original"', () => {
  it('imported as the original, the file comes back after deleting everything, with its latest edits', () => {
    visitAs(OWNER, stateWith(['Classic CV']));
    importFile(file('My real CV'), { asOriginal: true });
    cy.contains('label', 'Full Name').parent().next('input').clear().type('Sam Owner');
    backToDashboard();
    cy.contains(CARD, 'My real CV').should('contain.text', 'Original').and('contain.text', 'Stop keeping');
    okEveryConfirm();
    deleteCard('Classic CV');
    deleteCard('My real CV');
    expectCards(['My real CV']);
    cy.store().should((s) => {
      expect(s.resumes[0].personal.name).to.eq('Sam Owner');
      expect(s.resumes[0].keep).to.eq(true);
      expect(s.resumes[0].id).to.match(/^resume_/);
    });
  });

  it('a plain import is not an original, even from a file that says it is', () => {
    visitAs(OWNER);
    importFile(file('Exported CV', { keep: true }), { asOriginal: false });
    backToDashboard();
    cy.contains(CARD, 'Exported CV').should('not.contain.text', 'Stop keeping').contains('button', 'Keep as my original');
    cy.store().should((s) => expect(s.resumes[0]).not.to.have.property('keep'));
  });

  it('"Keep as my original" on a card brings it back; after "Stop keeping" it stays deleted', () => {
    visitAs(OWNER, stateWith(['Classic CV'], ['Other CV']));
    cy.contains(CARD, 'Classic CV').contains('button', 'Keep as my original').click();
    cy.contains(CARD, 'Classic CV').should('contain.text', 'Original');
    okEveryConfirm();
    deleteCard('Classic CV');
    deleteCard('Other CV');
    expectCards(['Classic CV']);
    cy.contains(CARD, 'Classic CV').contains('button', 'Stop keeping').click();
    cy.contains(CARD, 'Classic CV').contains('button', 'Keep as my original');
    deleteCard('Classic CV');
    cy.contains('No resumes yet').should('be.visible');
    newResumeAndBack();
    expectCards(['Untitled Resume']);
  });

  it('Delete says an original comes back, and how to delete it for good', () => {
    visitAs(OWNER, stateWith(['My CV', { keep: true }], ['Classic CV']));
    cy.window().then((win) => { cy.stub(win, 'confirm').as('confirm').returns(false); });
    deleteCard('My CV');
    cy.get('@confirm').should('have.been.calledWithMatch', /kept as your original, so it comes back .* choose "Stop keeping" first/);
    deleteCard('Classic CV');
    cy.get('@confirm').should('have.been.calledWith', 'Delete "Classic CV"? This cannot be undone.');
    expectCards(['My CV', 'Classic CV']);
  });

  it('a résumé whose data says keep: "yes" is no original anywhere: no badge, the plain prompt, and it can be marked (V2OWNER-DATA-10)', () => {
    const state = stateWith(['Odd CV'], ['Other CV']);
    state.resumes[0].keep = 'yes'; // a hand-edited file or cloud document: the restore ignores it
    visitAs(OWNER, state);
    cy.contains(CARD, 'Odd CV').should('not.contain.text', 'Stop keeping'); // before: the Original badge
    cy.window().then((win) => { cy.stub(win, 'confirm').as('confirm').returns(false); });
    deleteCard('Odd CV');
    cy.get('@confirm').should('have.been.calledWith', 'Delete "Odd CV"? This cannot be undone.');
    cy.contains(CARD, 'Odd CV').contains('button', 'Keep as my original').click();
    cy.contains(CARD, 'Odd CV').should('contain.text', 'Stop keeping');
    cy.store().should((s) => expect(s.resumes[0].keep).to.eq(true));
  });

  it('a copy of an original is a new résumé, not an original', () => {
    visitAs(OWNER, stateWith(['My CV', { keep: true }]));
    cy.contains(CARD, 'My CV').contains('button', 'Copy').click();
    cy.contains('button', 'Export').should('be.visible');
    backToDashboard();
    cy.contains(CARD, 'My CV (Copy)').contains('button', 'Keep as my original');
  });
});
