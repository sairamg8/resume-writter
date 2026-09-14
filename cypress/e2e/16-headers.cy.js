// Header Customization per template: the controls a template's PDF honours are shown, and
// only those (audit FIDA-50).
const active = (s) => s.resumes.find((r) => r.id === s.activeId);
const openHeader = () => cy.contains('button', 'Header Customization').click();

describe('header customization', () => {
  it('FIDA-50: Executive shows its header controls, not a "fixed banner" message, and they reach the PDF', () => {
    cy.visitEditor('executive');
    openHeader();
    cy.contains('fixed banner header').should('not.exist');
    ['Text Alignment', 'Name & Title Layout', 'Header Bottom Border', 'Contact Details'].forEach((label) => {
      cy.contains('p', label).should('be.visible');
    });

    // The Executive design has no header rule: an unset setting shows as off, one click turns it on.
    cy.get('button[title="Show border"]').click();
    cy.store().should((s) => expect(active(s).settings.showHeaderBorder).to.eq(true));
    cy.get('button[title="Hide border"]').should('be.visible');
    cy.contains('span', 'Thickness').should('be.visible');

    cy.contains('button', /^Center$/).click();
    cy.store().should((s) => expect(active(s).settings.headerAlign).to.eq('center'));
    cy.previewReady();
    cy.exportPdf().then((pdf) => {
      const name = pdf.runs.find((r) => r.str.includes('Alex Johnson'));
      expect(name, 'name run').to.exist;
      expect(name.x, 'the name is centred, not at the 18 mm margin').to.be.greaterThan(150);
    });
  });

  it('FIDA-50: Modern keeps its banner note and shows no header controls', () => {
    cy.visitEditor('modern');
    openHeader();
    cy.contains('fixed banner header').should('be.visible');
    cy.contains('p', 'Text Alignment').should('not.exist');
  });
});

describe('photo text position (R3-0)', () => {
  const openPhoto = () => cy.contains('button', /^Photo/).click();
  const chip = (label) => cy.contains('button', label);
  const note = () => cy.get('[data-testid="photo-text-position-note"]');

  for (const template of ['classic', 'modern']) {
    it(`${template} offers Top / Center / Bottom and stores the choice`, () => {
      cy.visitEditor(template);
      openPhoto();
      note().should('not.exist');
      chip('↓ Bottom').click();
      cy.store().should((s) => expect(active(s).settings.photoTextAlign).to.eq('bottom'));
    });
  }

  it('Sidebar explains that the photo sits above the name instead of offering chips that do nothing', () => {
    cy.visitEditor('sidebar');
    openPhoto();
    note().should('contain.text', 'Sidebar template prints the photo above your name');
    chip('↑ Top').should('not.exist');
  });

  it('a centred header hides the chips until the header is aligned left again', () => {
    cy.visitEditor('classic');
    openHeader();
    cy.contains('button', /^Center$/).click();
    openPhoto();
    note().should('contain.text', 'centered header');
    chip('↑ Top').should('not.exist');
    cy.contains('button', /^Left$/).click();
    note().should('not.exist');
    chip('↑ Top').scrollIntoView().should('be.visible');
  });
});
