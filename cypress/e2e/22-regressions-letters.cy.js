// Regression tests for letters saved by earlier builds (review R1-0), moved out of
// 07-regressions-store.cy.js when it passed 300 lines. Each test sets the old data version
// itself: the shared fixture résumé carries the current one (tests/helpers.js).
import { buildTestState, DATA_VERSION } from '../../tests/helpers.js';
import { IMPORT_INPUT } from '../support/selectors.js';
import { dashboardState } from '../support/state.js';

describe('regressions — letters saved with the old "Hiring Manager" default (R1-0)', () => {
  // Every résumé created before bf0467f saved this block: a recipient title nobody typed (there
  // was no input for it) and nothing else.
  const OLD_LETTER = {
    recipientName: '', recipientTitle: 'Hiring Manager', company: '', date: '', subject: '',
    body: '<p>I would love to join the team.</p>', closing: 'Sincerely',
  };
  const letter = () => cy.get('#cover-letter-preview');
  const titleInput = () => cy.contains('label', 'Recipient Title').next('input');
  const v6State = () => {
    const state = buildTestState('classic');
    state.dataVersion = 6;
    state.resumes[0].dataVersion = 6; // saved under data version 6: the v7 migration is due
    state.resumes[0].coverLetter = { ...OLD_LETTER };
    return state;
  };
  const printsNoTitle = () => {
    letter().should('contain.text', 'I would love to join the team.').and('not.contain.text', 'Hiring Manager');
    titleInput().should('have.value', '').and('have.attr', 'placeholder', 'Hiring Manager');
  };

  it('a letter saved under data version 6 prints no "Hiring Manager" line, and the store is migrated', () => {
    cy.visitEditor('classic', { state: v6State(), tab: 'coverletter' });
    printsNoTitle();
    cy.store().should((s) => {
      expect(s.dataVersion).to.eq(DATA_VERSION);
      expect(s.resumes[0].dataVersion).to.eq(DATA_VERSION);
      expect(s.resumes[0].coverLetter).to.deep.eq({ ...OLD_LETTER, recipientTitle: '' });
    });
  });

  it('an imported file saved with the old default prints no "Hiring Manager" line', () => {
    cy.visitDashboard(dashboardState());
    // Exported by a build that stamped no data version on its résumés.
    const { dataVersion: _current, ...fixture } = buildTestState('classic').resumes[0];
    const old = { ...fixture, name: 'Old Letter CV', coverLetter: OLD_LETTER };
    cy.get(IMPORT_INPUT).selectFile({ contents: Cypress.Buffer.from(JSON.stringify(old)), fileName: 'old.json' }, { force: true });
    cy.location('hash').should('match', /^#\/resume\//);
    // Wait for the editor: the dashboard has a "Cover Letter" button of its own (a new letter).
    cy.preview().should('contain.text', 'Alex Johnson');
    cy.contains('button', 'Cover Letter').click();
    cy.previewReady();
    printsNoTitle();
    cy.store().should((s) => expect(s.resumes.find((r) => r.name === 'Old Letter CV').coverLetter.recipientTitle).to.eq(''));
  });

  it('a "Hiring Manager" the user types afterwards is theirs: it survives a reload', () => {
    cy.visitEditor('classic', { state: v6State(), tab: 'coverletter' });
    printsNoTitle();
    titleInput().type('Hiring Manager');
    letter().should('contain.text', 'Hiring Manager');
    cy.store().its('resumes.0.coverLetter.recipientTitle').should('eq', 'Hiring Manager');
    cy.reload();
    cy.previewReady();
    titleInput().should('have.value', 'Hiring Manager');
    letter().should('contain.text', 'Hiring Manager');
  });
});
