describe('smoke', () => {
  it('dashboard seeds demo resumes on first visit', () => {
    cy.visitDashboard();
    cy.store().its('resumes').should('have.length.at.least', 1);
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
