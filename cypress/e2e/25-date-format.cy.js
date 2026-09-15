// Design → Date format (PAR-06): the choice is stored on the résumé, and the preview — the PDF
// itself — and the Word export print every date in it; a résumé storing none prints its dates as
// stored.

const active = (s) => s.resumes.find((r) => r.id === s.activeId);
const formatSelect = () => cy.contains('label', /^Date format$/).parent().find('select');
const previewText = () => cy.preview().invoke('text');

const openDates = () => {
  cy.get('button[title="Design & Customize"]').click();
  cy.contains('button', /^Dates$/).click();
};

describe('design — date format (PAR-06)', () => {
  it('a résumé storing no format shows As entered and prints its dates as stored', () => {
    cy.visitEditor('classic'); // the fixture stores no dateFormat, like every résumé saved before PAR-06
    cy.store().should((s) => expect(active(s).settings).not.to.have.property('dateFormat'));
    openDates();
    formatSelect().find('option:selected').should('have.text', 'As entered');
    previewText().should('contain', '09/2015 – 06/2019').and('contain', '01/2023 – Present');
  });

  it('picking "January 2024" stores it; the preview and Word print every date that way', () => {
    cy.visitEditor('sidebar'); // education in the side column, experience and projects as cards
    openDates();
    formatSelect().select('January 2024');
    cy.store().should((s) => expect(active(s).settings.dateFormat).to.eq('MMMM YYYY'));
    previewText()
      .should('contain', 'September 2015 – June 2019')
      .and('contain', 'January 2023 – Present')
      .and('contain', 'January 2022 – December 2022')
      .and('not.contain', '09/2015');
    cy.exportDocx().then(({ paragraphs }) => {
      const text = paragraphs.join(' | ');
      ['September 2015 – June 2019', 'January 2023 – Present', 'January 2023 – March 2023'].forEach((want) => expect(text).to.contain(want));
    });
  });

  it('the Dates reset returns As entered', () => {
    cy.visitEditor('classic', { settings: { dateFormat: 'YYYY' } });
    previewText().should('contain', '2015 – 2019');
    openDates();
    formatSelect().should('have.value', 'YYYY');
    cy.get('button[title="Reset Dates to defaults"]').click();
    cy.store().should((s) => expect(active(s).settings.dateFormat).to.eq('asEntered'));
    previewText().should('contain', '09/2015 – 06/2019');
  });
});
