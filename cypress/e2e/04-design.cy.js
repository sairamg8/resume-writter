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

  it('on Classic, Section Headings has no Sidebar side-column note', () => {
    openDesign('Section Headings');
    cy.contains('button', /^Abc$/).should('be.visible');
    cy.contains('The side column keeps its own').should('not.exist');
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

describe('design — colours show what the PDF prints', () => {
  // With no Text colour stored (an import, older data) the PDF prints the template's own default.
  for (const [template, color] of [['modern', '#1f2937'], ['minimal', '#111111'], ['classic', '#1a1a1a']]) {
    it(`${template}: with no stored Text colour the panel shows ${color}, the template's default (R9-7)`, () => {
      cy.visitEditor(template, { settings: { textColor: '' } });
      openDesign('Colors');
      cy.get('input[aria-label="Custom text color"]').should('have.value', color);
      cy.get('button[title="Near Black"]').should(color === '#1a1a1a' ? 'have.class' : 'not.have.class', 'border-blue-500');
    });
  }
});

describe('design — reset returns to the template\'s defaults (M16)', () => {
  it('Reset keeps an Executive résumé\'s heading style and normal-case titles', () => {
    cy.visitEditor('executive', { settings: { headingStyle: 'box', sectionTitleCase: 'upper', accentColor: '#0d9488' } });
    renderedText().should('contain', 'PROFESSIONAL EXPERIENCE');
    openDesign();
    cy.contains('button', /^Reset$/).click();
    cy.contains('button', 'Yes, Reset').click();
    cy.store().should((s) => {
      expect(active(s).template).to.eq('executive');
      expect(settingsOf(s)).to.include({ headingStyle: 'underline', sectionTitleCase: 'normal', accentColor: '#374151' });
    });
    renderedText().should('contain', 'Professional Experience').and('not.contain', 'PROFESSIONAL EXPERIENCE');
  });

  it('on Sidebar, Section Headings says what the side column keeps, and Title case reaches it (R6-4)', () => {
    cy.visitEditor('sidebar');
    renderedText().should('contain', 'CONTACT');
    openDesign('Section Headings');
    cy.contains('The side column keeps its own small headings and rule; only Title case applies there.').should('be.visible');
    cy.contains('button', /^Abc$/).click();
    cy.store().should((s) => expect(settingsOf(s).sectionTitleCase).to.eq('normal'));
    renderedText().should('contain', 'Contact').and('not.contain', 'CONTACT');
  });

  it('Section Headings\' reset gives a Sidebar résumé Sidebar\'s plain headings', () => {
    cy.visitEditor('sidebar', { settings: { headingStyle: 'box', sectionTitleCase: 'normal', sectionBorderWidth: 4 } });
    openDesign();
    cy.get('button[title="Reset Section Headings to defaults"]').click();
    cy.store().should((s) => {
      expect(settingsOf(s)).to.include({ headingStyle: 'plain', sectionTitleCase: 'upper', sectionBorderWidth: 1 });
    });
  });
});
