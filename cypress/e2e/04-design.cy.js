/** Resume the store marks active. */
const active = (s) => s.resumes.find((r) => r.id === s.activeId);
const settingsOf = (s) => active(s).settings;

/** Open the Design tab, and optionally one of its collapsible sections by title. */
const openDesign = (section) => {
  cy.get('button[title="Design & Customize"]').click();
  if (section) cy.contains('button', new RegExp(`^${section}$`, 'i')).click();
};

/** Text of the PDF preview — the PDF's own glyphs, so upper-casing shows as real capitals. */
const renderedText = () => cy.preview().invoke('text');

const squash = (s) => s.replace(/\s+/g, '').toLowerCase();

describe('design — templates', () => {
  it('switching to Sidebar applies its heading defaults and reaches the PDF', () => {
    cy.visitEditor('classic');
    openDesign();
    cy.contains('button', 'Colored left sidebar layout').click();
    cy.store().should((s) => {
      expect(active(s).template).to.eq('sidebar');
      expect(settingsOf(s).headingStyle).to.eq('plain');
      expect(settingsOf(s).sectionTitleCase).to.eq('upper');
    });
    cy.exportPdf().then((pdf) => {
      // Sidebar is the one template that labels its contact block ("CONTACT", "EMAIL", …).
      expect(squash(pdf.runs.map((r) => r.str).join(''))).to.contain('contactemail');
    });
  });

  it('switching to Executive switches section titles to normal case on canvas and in the PDF', () => {
    cy.visitEditor('classic');
    renderedText().should('contain', 'PROFESSIONAL EXPERIENCE');
    openDesign();
    cy.contains('button', 'Clean accent headings').click();
    cy.store().should((s) => {
      expect(active(s).template).to.eq('executive');
      expect(settingsOf(s).sectionTitleCase).to.eq('normal');
    });
    renderedText().should('contain', 'Professional Experience').and('not.contain', 'PROFESSIONAL EXPERIENCE');
    cy.exportPdf().then((pdf) => {
      const text = pdf.runs.map((r) => r.str).join('');
      expect(text.replace(/\s+/g, '')).to.contain('ProfessionalExperience');
    });
  });

  it('the selected template is marked in the template list', () => {
    cy.visitEditor('minimal');
    openDesign();
    cy.contains('button', 'Clean & whitespace-first').should('have.class', 'border-blue-500');
    cy.contains('button', 'Two-column header').should('not.have.class', 'border-blue-500');
  });
});

describe('design — settings', () => {
  beforeEach(() => cy.visitEditor('classic'));

  it('an accent swatch recolours the canvas and the PDF', () => {
    openDesign('Colors');
    cy.get('button[title="Rose"]').first().click();
    cy.store().should((s) => expect(settingsOf(s).accentColor).to.eq('#e11d48'));
    cy.previewReady();
    // Classic prints the job title in the accent colour (the preview is this same PDF).
    cy.exportPdf().then((pdf) => {
      const title = pdf.runs.find((r) => r.str.includes('Full Stack Engineer'));
      expect(title, 'job title run').to.exist;
      expect(title.colorHex).to.eq('#e11d48');
    });
  });

  it('title case "Abc" keeps section titles as typed, "ABC" upper-cases them', () => {
    openDesign('Section Headings');
    cy.contains('button', /^Abc$/).click();
    cy.store().should((s) => expect(settingsOf(s).sectionTitleCase).to.eq('normal'));
    renderedText().should('contain', 'Professional Experience');
    cy.contains('button', /^ABC$/).click();
    renderedText().should('contain', 'PROFESSIONAL EXPERIENCE');
  });

  it('heading style buttons store the chosen style', () => {
    openDesign('Section Headings');
    ['Boxed', 'Left bar', 'Underline', 'Plain', 'Line after', 'Ruled'].forEach((label) => {
      cy.contains('button', label).click();
    });
    cy.store().should((s) => expect(settingsOf(s).headingStyle).to.eq('ruled'));
  });

  it('spacing steppers change the stored values within their limits', () => {
    openDesign('Spacing');
    cy.contains('span', 'Between Sections').parent().as('gap');
    cy.get('@gap').contains('button', '+').click().click();
    cy.store().should((s) => expect(settingsOf(s).sectionGap).to.eq(18));
    cy.get('@gap').find('input').clear().type('999{enter}');
    cy.store().should((s) => expect(settingsOf(s).sectionGap).to.eq(60)); // clamped to max
    cy.get('@gap').find('input').should('have.value', '60px');
  });

  it('Reset asks for confirmation, Cancel keeps settings, Yes resets them', () => {
    openDesign('Colors');
    cy.get('button[title="Teal"]').first().click();
    cy.store().should((s) => expect(settingsOf(s).accentColor).to.eq('#0d9488'));

    cy.contains('button', /^Reset$/).click();
    cy.contains('This will reset all design settings').should('be.visible');
    cy.contains('button', 'Cancel').click();
    cy.store().should((s) => expect(settingsOf(s).accentColor).to.eq('#0d9488'));

    cy.contains('button', /^Reset$/).click();
    cy.contains('button', 'Yes, Reset').click();
    cy.store().should((s) => expect(settingsOf(s).accentColor).to.eq('#374151')); // ATS_DEFAULTS.accentColor
  });
});
