describe('smoke', () => {
  it('a first visit shows an empty dashboard', () => {
    cy.visitDashboard();
    cy.contains('No resumes yet').should('be.visible');
    cy.store().its('resumes').should('have.length', 0);
  });

  it('editor renders the preview and exports a PDF', () => {
    cy.visitEditor('classic');
    cy.preview().should('contain.text', 'Alex Johnson');
    cy.exportPdf().then((pdf) => {
      expect(pdf.numPages).to.be.at.least(1);
      expect(pdf.runs.map((r) => r.str).join(' ')).to.contain('Alex Johnson');
    });
  });
});
