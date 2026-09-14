import { ALL_SECTION_TYPES } from '../../tests/helpers.js';

/** Resume the store marks active. */
const active = (s) => s.resumes.find((r) => r.id === s.activeId);

/** The collapsible Personal Info panel in the editor. */
const personal = () => cy.contains('span', 'Personal Info').closest('.rounded-xl');

/** A Personal Info text input, found through the label rendered above it. */
const field = (label) => personal().contains('label', label).parent().next('input');

/** A section's editor card, found through the value of its title input. */
const sectionCard = (title) =>
  cy.get('input[type="text"]').filter((_, el) => el.value === title).closest('.rounded-xl');

describe('editor — content', () => {
  beforeEach(() => cy.visitEditor('classic'));

  it('typing personal details updates the preview and the saved resume', () => {
    field('Full Name').clear().type('Priya Raman');
    field('Job Title').clear().type('Staff Engineer');
    cy.preview()
      .should('contain.text', 'Priya Raman')
      .and('contain.text', 'Staff Engineer')
      .and('not.contain.text', 'Alex Johnson');
    cy.store().should((s) => {
      expect(active(s).personal.name).to.eq('Priya Raman');
      expect(active(s).personal.title).to.eq('Staff Engineer');
    });
  });

  it('the eye toggle hides a contact field from the preview and brings it back', () => {
    cy.preview().should('contain.text', 'alex@example.com');
    personal().contains('label', 'Email').siblings('button[title="Hide on resume"]').click();
    cy.preview().should('not.contain.text', 'alex@example.com');
    cy.store().should((s) => expect(active(s).personal.hiddenFields).to.include('email'));
    personal().contains('label', 'Email').siblings('button[title="Show on resume"]').click();
    cy.preview().should('contain.text', 'alex@example.com');
  });

  it('summary rich text reaches the preview, and hiding the summary removes it', () => {
    cy.get('[data-placeholder^="Brief professional summary"]').click().type('{moveToEnd} Ships accessible UIs.');
    cy.preview().should('contain.text', 'Ships accessible UIs.');
    cy.get('button[title="Hide summary from resume"]').click();
    cy.preview().should('not.contain.text', 'experienced full stack engineer');
  });

  it('renames the resume from the editor header', () => {
    cy.get('button[title="Rename resume"]').click();
    cy.focused().clear().type('Classic for Globex{enter}');
    cy.contains('button', 'Classic for Globex').should('be.visible');
    cy.store().should((s) => expect(active(s).name).to.eq('Classic for Globex'));
  });

  it('Add Section appends a section of the chosen type', () => {
    cy.contains('button', 'Add Section').click();
    cy.contains('button', 'Custom Section').click();
    cy.store().should((s) => {
      const sections = active(s).sections;
      expect(sections).to.have.length(ALL_SECTION_TYPES.length + 1);
      expect(sections.at(-1).type).to.eq('custom');
    });
    cy.contains('button', 'Custom Section').should('not.exist'); // picker closes
  });

  it('a new experience entry, once filled in, shows in the preview', () => {
    sectionCard('Professional Experience').within(() => {
      cy.contains('button', 'Add Experience').click();
      cy.contains('span', 'New Entry').click();
      cy.get('input[placeholder="Company Name"]').last().type('Globex');
      cy.get('input[placeholder="Software Engineer"]').last().type('Platform Lead');
    });
    cy.preview().should('contain.text', 'Globex').and('contain.text', 'Platform Lead');
    cy.store().should((s) => {
      const exp = active(s).sections.find((x) => x.type === 'experience');
      expect(exp.items.map((i) => i.company)).to.deep.eq(['Acme Corp', 'Globex']);
    });
  });

  it('renaming a section updates its heading in the preview', () => {
    sectionCard('Publications').find('input[type="text"]').first().clear().type('Writing');
    cy.preview().invoke('text').should('match', /writing/i);
    cy.store().should((s) => expect(active(s).sections.map((x) => x.title)).to.include('Writing'));
  });

  it('hiding a section removes it from the preview; showing restores it', () => {
    sectionCard('Awards & Honors').find('button[title="Hide section from resume"]').click();
    cy.preview().should('not.contain.text', 'Employee of the Year');
    sectionCard('Awards & Honors').should('contain.text', 'Hidden');
    sectionCard('Awards & Honors').find('button[title="Show section on resume"]').click();
    cy.preview().should('contain.text', 'Employee of the Year');
  });

  it('hiding a single entry removes only that entry', () => {
    sectionCard('References').find('button[title="Hide entry"]').click();
    cy.preview().should('not.contain.text', 'Jane Doe').and('contain.text', 'Employee of the Year');
  });

  it('removing an entry deletes it from the preview and the store', () => {
    sectionCard('References').contains('span', 'Jane Doe').parent().find('button').last().click();
    cy.preview().should('not.contain.text', 'Jane Doe');
    cy.store().should((s) => {
      expect(active(s).sections.find((x) => x.type === 'references').items).to.have.length(0);
    });
  });

  it('deleting a section removes it from the editor, the preview and the store', () => {
    sectionCard('Volunteering').find('button[title="Section options"]').click();
    cy.contains('button', 'Delete section').click();
    cy.preview().should('not.contain.text', 'Red Cross');
    cy.store().should((s) => expect(active(s).sections.map((x) => x.type)).not.to.include('volunteering'));
  });

  it('Collapse All folds every panel and Expand All reopens them', () => {
    cy.contains('button', 'Collapse All').click();
    cy.get('input[placeholder="John Doe"]').should('not.exist');
    cy.contains('button', 'Add Experience').should('not.exist');
    cy.contains('button', 'Expand All').click();
    cy.get('input[placeholder="John Doe"]').should('be.visible');
    cy.contains('button', 'Add Experience').should('exist');
  });
});

describe('editor — shell', () => {
  beforeEach(() => cy.visitEditor('classic'));

  it('Resume, Cover Letter and Design tabs swap both the panel and the preview', () => {
    cy.contains('Résumé · A4').should('be.visible');
    cy.contains('button', 'Cover Letter').click();
    cy.get('#cover-letter-preview').should('contain.text', 'I am excited to apply');
    cy.contains('Cover Letter · A4').should('be.visible');
    cy.get('button[title="Design & Customize"]').click();
    cy.contains('button', 'Template').should('be.visible');
    cy.contains('Résumé · A4').should('be.visible');
    cy.get('button[title="Design & Customize"]').click();
    cy.contains('span', 'Personal Info').should('be.visible');
  });

  it('layout toggle: editor-only hides the preview, preview-only hides the editor', () => {
    cy.get('button[title="Editor only"]').filter(':visible').first().click();
    cy.previewPages().should('not.be.visible');
    cy.contains('span', 'Personal Info').should('be.visible');

    cy.get('button[title="Preview only"]').filter(':visible').first().click();
    cy.previewPages().first().should('be.visible');
    cy.contains('span', 'Personal Info').should('not.be.visible');

    cy.get('button[title="Split view"]').filter(':visible').first().click();
    cy.previewPages().first().should('be.visible');
    cy.contains('span', 'Personal Info').should('be.visible');
  });

  it('preview zoom steps by 25% and is clamped to 50–150%', () => {
    const zoomIn = () => cy.contains('button', /^\+$/);
    const zoomOut = () => cy.contains('button', /^−$/);
    zoomIn().prev('span').as('zoom').should('have.text', '100%');

    zoomIn().click();
    cy.get('@zoom').should('have.text', '125%');
    zoomIn().click();
    cy.get('@zoom').should('have.text', '150%');
    zoomIn().should('be.disabled');

    for (let i = 0; i < 4; i += 1) zoomOut().click();
    cy.get('@zoom').should('have.text', '50%');
    zoomOut().should('be.disabled');
  });

  it('the back arrow returns to the dashboard', () => {
    cy.get('button[title="Back to dashboard"]').click();
    cy.location('hash').should('eq', '#/');
  });

  it('an unknown resume id redirects to the dashboard', () => {
    cy.visit('/#/resume/does_not_exist');
    cy.location('hash').should('eq', '#/');
  });
});

describe('editor — deep links', () => {
  it('?tab=coverletter opens straight onto the cover letter', () => {
    cy.visitEditor('classic', { tab: 'coverletter' });
    cy.get('#cover-letter-preview').should('contain.text', 'I am excited to apply');
  });

  it('the header keeps the resume name visible at the default panel width', () => {
    cy.visitEditor('classic');
    cy.get('button[title="Rename resume"]').should('be.visible').and('have.text', 'Test Classic')
      .invoke('outerWidth').should('be.gt', 60);
  });
});
