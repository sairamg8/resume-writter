// Design panel → Typography: fonts come from the same place as the PDF, a custom font is
// checked before it is kept, and the quick size buttons change the PDF.
const active = (s) => s.resumes.find((r) => r.id === s.activeId);
const META = 'https://cdn.jsdelivr.net/npm/@fontsource/*@5/metadata.json';

const openTypography = () => {
  cy.get('button[title="Design & Customize"]').click();
  cy.contains('button', /^Typography$/i).click();
};

describe('typography regressions', () => {
  it('the picker never calls Google Fonts; previews come from the PDF\'s font source (M18)', () => {
    let google = 0;
    cy.intercept('https://fonts.googleapis.com/**', () => { google += 1; });
    cy.intercept('https://fonts.gstatic.com/**', () => { google += 1; });
    cy.visitEditor('classic');
    openTypography();
    cy.contains('button', 'Literata').click();
    cy.store().its('resumes.0.settings.font').should('eq', 'literata');
    cy.previewReady();
    cy.wrap(null).then(() => expect(google, 'requests to Google Fonts').to.eq(0));
  });

  it('a name that is not a Google Font is refused with a message and not saved', () => {
    cy.intercept('GET', META, { statusCode: 404, body: 'Not found' });
    cy.visitEditor('classic');
    openTypography();
    cy.get('#custom-font-input').type('No Such Font Xyz{enter}');
    cy.get('#custom-font-error').should('contain', 'was not found on Google Fonts');
    cy.store().its('resumes.0.settings.customFont').should('not.eq', 'No Such Font Xyz');
    cy.window().then((win) => expect(win.localStorage.getItem('cpwtcv_custom_fonts') || '[]').not.to.contain('No Such Font'));
  });

  it('a custom font is saved under its real name, and the PDF still renders if its files fail (NEW-1)', () => {
    cy.intercept('GET', META, {
      body: { id: 'bebas-neue', family: 'Bebas Neue', subsets: ['latin'], weights: [400], styles: ['normal'], defSubset: 'latin' },
    });
    cy.intercept('GET', 'https://cdn.jsdelivr.net/npm/@fontsource/bebas-neue@5/files/**', { statusCode: 503 });
    cy.visitEditor('classic');
    openTypography();
    cy.get('#custom-font-input').type('bebas neue{enter}');
    cy.store().its('resumes.0.settings.customFont').should('eq', 'Bebas Neue');
    cy.contains('button', 'Bebas Neue').should('be.visible');
    cy.get('[data-preview-status="ready"]', { timeout: 30_000 });
    cy.contains('Preview failed').should('not.exist');
  });

  it('Small / Normal / Large set the base size the PDF uses (NEW-6)', () => {
    cy.visitEditor('classic');
    openTypography();
    cy.contains('button', /^Large$/).click();
    cy.store().should((s) => expect(active(s).settings.fontSizeBase).to.eq(12));
    cy.contains('button', /^Large$/).should('have.class', 'bg-blue-600');
    cy.contains('button', /^Small$/).click();
    cy.store().should((s) => expect(active(s).settings.fontSizeBase).to.eq(10));
    cy.exportPdf().then((pdf) => {
      const body = pdf.runs.find((r) => /Developed|Built|Led|Designed|experience/i.test(r.str) && r.fontSize < 12);
      expect(body, 'a body text run').to.exist;
      expect(body.fontSize).to.be.closeTo(10, 0.6);
    });
  });
});
