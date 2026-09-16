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

  /** Set the colour input labelled `label` to `color`, as its picker does (React reads the input event). */
  const pickColor = (label, color) => cy.get(`input[aria-label="${label}"]`).then(($input) => {
    const input = $input[0];
    const win = input.ownerDocument.defaultView;
    Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set.call(input, color);
    input.dispatchEvent(new win.Event('input', { bubbles: true }));
  });

  it('NB-1: a white Name color picked for the Sidebar column goes back to Classic\'s own when Classic is picked, and the name prints', () => {
    cy.visitEditor('sidebar');
    openDesign('Colors');
    pickColor('Name color', '#ffffff');
    cy.store().should((s) => expect(settingsOf(s).nameColor).to.eq('#ffffff'));
    cy.contains('button', 'Two-column header').click();
    cy.store().should((s) => expect([active(s).template, settingsOf(s).nameColor]).to.deep.eq(['classic', '']));
    cy.get('input[aria-label="Name color"]').parent().should('contain.text', 'Template default');
    cy.previewReady();
    cy.exportPdf().then((pdf) => {
      // Classic prints the name in the Text colour; it was drawn #ffffff on the white page.
      expect(pdf.runs.find((r) => r.str.includes('Alex')).colorHex).to.eq('#111111');
    });
  });

  it('NB-1: an ink Name color picked on Classic goes back to the Sidebar\'s own on its dark column', () => {
    cy.visitEditor('classic', { settings: { nameColor: '#1a1a1a' } });
    openDesign();
    cy.contains('button', 'Colored left sidebar layout').click();
    cy.store().should((s) => expect([active(s).template, settingsOf(s).nameColor]).to.deep.eq(['sidebar', '']));
    cy.exportPdf().then((pdf) => {
      // The header text colour on the navy column; #1a1a1a vanished there (1.2:1).
      expect(pdf.runs.find((r) => r.str.includes('Alex')).colorHex).to.eq('#ffffff');
    });
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

  // The PDF prints Border thickness as points (tests/pdf/10-section-headings), and the box says
  // so — it said px, so an "8 px" rule came out 10.7 px (VM3-3, as the header rule did in R3-7).
  it('Border thickness says the unit it prints in, pt, and its stepper stores the value', () => {
    openDesign('Section Headings');
    cy.contains('span', 'Border thickness').parent().as('thickness');
    cy.get('@thickness').contains('span', /^pt$/).should('be.visible');
    cy.get('@thickness').contains('span', /^px$/).should('not.exist');
    cy.get('@thickness').find('input[aria-label="Section border thickness (pt)"]').should('have.value', '1');
    cy.get('@thickness').contains('button', '+').click().click();
    cy.store().should((s) => expect(settingsOf(s).sectionBorderWidth).to.eq(3));
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

  // The icons uploaded under Personal Info → Fields live in settings; Reset deleted them (R5-6).
  it('Reset keeps the contact icons the user uploaded', () => {
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    cy.visitEditor('classic', { settings: { accentColor: '#0d9488', iconSet: 'bold', customContactIcons: { email: PNG } } });
    openDesign();
    cy.contains('button', /^Reset$/).click();
    cy.contains('Resume content and uploaded contact icons are kept.').should('be.visible');
    cy.contains('button', 'Yes, Reset').click();
    cy.store().should((s) => {
      expect(settingsOf(s)).to.include({ accentColor: '#374151', iconSet: 'filled' });
      expect(settingsOf(s).customContactIcons).to.deep.eq({ email: PNG });
    });
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

describe('design — Title case shows what the PDF prints (V2W2b-5)', () => {
  // An imported file may store a Title case the panel does not offer ('title', 'lower'). Every
  // column prints such titles as typed, so the panel marks "Abc"; it used to mark neither.
  it('a stored "title" marks "Abc", and the PDF prints the titles as typed', () => {
    cy.visitEditor('classic', { settings: { sectionTitleCase: 'title' } });
    renderedText().should('contain', 'Professional Experience').and('not.contain', 'PROFESSIONAL EXPERIENCE');
    openDesign('Section Headings');
    cy.contains('button', /^Abc$/).should('have.class', 'bg-blue-600');
    cy.contains('button', /^ABC$/).should('not.have.class', 'bg-blue-600');
  });
});

describe('design — Typography on Sidebar (V2W2b-3)', () => {
  // Section Title and Base size the main column only; the side column keeps its own small type.
  const NOTE = 'the side column\'s sections keep their own small type (8.5 pt headings, 9 pt text)';

  it('on Sidebar, Typography says what the side column keeps', () => {
    cy.visitEditor('sidebar');
    openDesign('Typography');
    cy.contains(NOTE).scrollIntoView().should('be.visible'); // the section is taller than the panel
  });

  it('on Classic, Typography has no Sidebar note', () => {
    cy.visitEditor('classic');
    openDesign('Typography');
    cy.contains('Section Title').scrollIntoView().should('be.visible');
    cy.contains(NOTE).should('not.exist');
  });
});

describe('design — Section Headings shows what the PDF prints (R5-3)', () => {
  // With no heading style or title case stored (an import, older data) the PDF prints the
  // template's own fallback — Classic 'line', Executive normal case. The panel used to mark
  // "Ruled" and "ABC" for every template, so clicking the marked chip changed the PDF.
  const UNSET = { settings: { headingStyle: '', sectionTitleCase: '' } };

  for (const [template, label] of [['classic', 'Line after'], ['modern', 'Line after'],
    ['minimal', 'Underline'], ['executive', 'Underline'], ['sidebar', 'Plain']]) {
    it(`${template}: with no stored heading style the panel marks ${label}, not Ruled`, () => {
      cy.visitEditor(template, UNSET);
      openDesign('Section Headings');
      cy.contains('button', label).should('have.class', 'border-blue-500');
      cy.contains('button', 'Ruled').should('not.have.class', 'border-blue-500');
    });
  }

  it('classic: the marked "Line after" is the style the PDF prints — an accent section title', () => {
    cy.visitEditor('classic', { settings: { headingStyle: '', sectionTitleCase: '', accentColor: '#e11d48' } });
    openDesign('Section Headings');
    cy.contains('button', 'Line after').should('have.class', 'border-blue-500');
    // 'line' prints the title in the accent colour; 'ruled' prints it neutral grey (#374151).
    cy.exportPdf().then((pdf) => {
      const title = pdf.runs.find((r) => r.str.includes('ROFESSIONAL'));
      expect(title && title.colorHex, 'the section title\'s colour').to.eq('#e11d48');
    });
  });

  it('executive: with no stored title case the panel marks "Abc", and the PDF prints titles as typed', () => {
    cy.visitEditor('executive', UNSET);
    renderedText().should('contain', 'Professional Experience').and('not.contain', 'PROFESSIONAL EXPERIENCE');
    openDesign('Section Headings');
    cy.contains('button', /^Abc$/).should('have.class', 'bg-blue-600');
    cy.contains('button', /^ABC$/).should('not.have.class', 'bg-blue-600');
  });

  it('classic: with no stored title case the panel keeps "ABC", as the PDF upper-cases', () => {
    cy.visitEditor('classic', UNSET);
    renderedText().should('contain', 'PROFESSIONAL EXPERIENCE');
    openDesign('Section Headings');
    cy.contains('button', /^ABC$/).should('have.class', 'bg-blue-600');
  });
});
