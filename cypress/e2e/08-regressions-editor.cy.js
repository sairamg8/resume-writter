// Regression tests for editor state bugs (audit main-loop notes M4, M7).
import { buildTestState } from '../../tests/helpers.js';

const summaryEditor = () => cy.get('[data-placeholder^="Brief professional summary"]');
const active = (s) => s.resumes.find((r) => r.id === s.activeId);

describe('regressions — editor', () => {
  it('M4: after an in-editor import, rich-text editors show the imported resume, and typing does not bring the old text back', () => {
    cy.visitEditor('classic');
    summaryEditor().should('contain.text', 'experienced full stack engineer');

    const other = buildTestState('modern').resumes[0];
    other.personal = { ...other.personal, summary: '<p>Imported summary text.</p>' };
    cy.openExportMenu();
    cy.contains('button', 'Import JSON').click(); // closes the menu, as for a real user
    cy.get('input[type="file"][accept=".json"]').selectFile({
      contents: Cypress.Buffer.from(JSON.stringify(other)), fileName: 'other.json',
    }, { force: true });
    cy.location('hash').should('match', /^#\/resume\/resume_\d+$/);

    summaryEditor().should('contain.text', 'Imported summary text.').and('not.contain.text', 'experienced full stack');
    summaryEditor().click().type('{moveToEnd} More.');
    cy.store().should((s) => {
      expect(active(s).personal.summary).to.contain('Imported summary text.');
      expect(active(s).personal.summary).not.to.contain('experienced full stack');
    });
  });

  it('M7: opening a resume never renders or edits the previously active one', () => {
    const state = buildTestState('classic');
    const second = { ...JSON.parse(JSON.stringify(state.resumes[0])), id: 'second', name: 'Second CV' };
    second.personal.name = 'Blake Second';
    state.resumes.push(second);
    state.activeId = state.resumes[0].id; // the first resume is active in storage…
    cy.seedAndVisit('/#/resume/second', state); // …but the URL asks for the second
    cy.contains('button', 'Export').should('be.visible');
    cy.preview().should('contain.text', 'Blake Second');
    cy.contains('label', 'Full Name').parent().next('input').should('have.value', 'Blake Second')
      .clear().type('Blake Edited');
    cy.store().should((s) => {
      expect(s.activeId).to.eq('second');
      expect(s.resumes.find((r) => r.id === 'second').personal.name).to.eq('Blake Edited');
      expect(s.resumes[0].personal.name).to.eq('Alex Johnson');
    });
  });
});

describe('regressions — export failures', () => {
  it('M6: a failed PDF export says so and frees the Export button', () => {
    cy.intercept('GET', '**/assets/pdfExportReactPDF-*.js', { statusCode: 500, body: '' });
    cy.visitEditor('classic');
    cy.openExportMenu();
    cy.contains('button', /^\s*Export PDF\s*$/).click();
    cy.contains('[role="alert"]', 'PDF export failed').should('be.visible');
    cy.contains('button', /^\s*Export\s*$/).should('not.be.disabled');
    cy.contains('[role="alert"] button', 'Dismiss').click();
    cy.get('[role="alert"]').should('not.exist');
  });

  it('M6: a failed Word export says so', () => {
    cy.intercept('GET', '**/assets/wordExport-*.js', { statusCode: 500, body: '' });
    cy.visitEditor('classic');
    cy.openExportMenu();
    cy.contains('button', /^\s*Export Word\s*$/).click();
    cy.contains('[role="alert"]', 'Word export failed').should('be.visible');
  });
});
