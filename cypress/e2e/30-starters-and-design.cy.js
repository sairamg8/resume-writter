// Three newer editor features end to end (R2-161): the role starters behind New Resume, the Smart
// Page Fit spacing presets in Design → Spacing, and the header icon picker in Personal Info. Each
// opens, is used once, and its result shows in the store, the controls and the printed PDF.
// Smoke level: the starters' content is pinned in tests/unit/starter-templates.unit.mjs and
// tests/pdf/16-saved-data-starter-skills.test.mjs, the icons in tests/unit/contact-icon-paths.unit.mjs
// and — the shape a picked icon prints as in the PDF — tests/pdf/09-contact-icons.test.mjs.
// That 1-Page Fit then measures the page count and tightens further is R2-149's, tests/pdf/91-page-fit.test.mjs.
import { buildTestState } from '../../tests/helpers.js';
import { STARTER_TEMPLATES } from '../../src/utils/starterTemplates.js';
import { CARD } from '../support/selectors.js';

const active = (s) => s.resumes.find((r) => r.id === s.activeId);
const MM = 72 / 25.4; // PDF points per millimetre

describe('New Resume → role starters', () => {
  beforeEach(() => {
    cy.visitDashboard(buildTestState('classic'));
    cy.contains('button', 'New Resume').click();
    cy.contains('h2', 'Choose a Resume Starter').should('be.visible');
  });

  it('offers a blank résumé and every role starter (STARTER_TEMPLATES); closing it creates nothing', () => {
    const picker = () => cy.contains('h2', 'Choose a Resume Starter').parents('.rounded-2xl').first();
    // One button per starter, and the blank one: a starter added to the list is offered too.
    picker().find('button h3').should('have.length', STARTER_TEMPLATES.length + 1);
    cy.contains('button', 'Start from Scratch (Blank)').should('be.visible');
    STARTER_TEMPLATES.forEach(({ name }) => {
      cy.contains('button h3', name).scrollIntoView().should('be.visible');
    });
    picker().find('.border-b button').click();
    cy.contains('h2', 'Choose a Resume Starter').should('not.exist');
    // Still the dashboard, with its one résumé: the page first, as a store read straight after the
    // close can be one taken before a write lands.
    cy.get(CARD).should('have.length', 1).and('contain.text', 'Test Classic');
    cy.store().its('resumes').should('have.length', 1);
  });

  it('a starter opens as a new, filled-in résumé in the editor, printed in the PDF', () => {
    cy.contains('button', 'Product Manager').click();
    cy.location('hash').should('match', /^#\/resume\/resume_[\w-]+$/);
    cy.get('input[placeholder="John Doe"]').should('have.value', 'Sarah Chen');
    cy.store().should((s) => {
      expect(s.resumes).to.have.length(2);
      const r = active(s);
      expect(r.name).to.eq('Product Manager');
      expect(r.personal).to.include({ name: 'Sarah Chen', title: 'Lead Product Manager' });
      expect(r.sections.map((x) => x.type)).to.include.members(['experience', 'skills', 'education']);
      expect(r.sections.find((x) => x.type === 'experience').items.length).to.be.greaterThan(0);
    });
    cy.previewReady();
    cy.preview().should('contain.text', 'Sarah Chen').and('contain.text', 'Lead Product Manager');
  });
});

describe('Design → Spacing → Smart Page Fit presets', () => {
  const spacingField = (label) => cy.contains('span', new RegExp(`^${label}$`)).parent().find('input');
  /** Left edge of the leftmost text on page 1 of the exported PDF, in points. */
  const leftEdge = (pdf) => Math.min(...pdf.runs.filter((r) => r.page === 1 && r.str.trim()).map((r) => r.x));

  beforeEach(() => {
    cy.visitEditor('classic');
    cy.get('button[title="Design & Customize"]').click();
    cy.contains('button', /^Spacing$/i).click();
    cy.contains('Smart Page Fit Presets').should('be.visible');
  });

  it('1-Page Fit tightens margins, gaps and line height; the controls and the PDF follow', () => {
    cy.get('button[title^="Fit more onto 1 page"]').click();
    cy.store().should((s) => {
      expect(active(s).settings).to.include({ marginV: 10, marginH: 14, sectionGap: 10, itemGap: 5, lineHeightValue: 1.35 });
    });
    spacingField('Top / Bottom margin').should('have.value', '10mm');
    spacingField('Left / Right margin').should('have.value', '14mm');
    spacingField('Between Sections').should('have.value', '10px');
    spacingField('Between Items').should('have.value', '5px');
    cy.exportPdf().then((pdf) => {
      expect(leftEdge(pdf), 'the text starts at the 14 mm margin').to.be.closeTo(14 * MM, 1.5);
    });
  });

  it('Spacious and Balanced write their own sets, and the PDF margin moves with them', () => {
    cy.get('button[title^="Generous spacing"]').click();
    cy.store().should((s) => {
      expect(active(s).settings).to.include({ marginV: 20, marginH: 22, sectionGap: 22, itemGap: 12, lineHeightValue: 1.65 });
    });
    spacingField('Left / Right margin').should('have.value', '22mm');
    cy.exportPdf().then((pdf) => {
      expect(leftEdge(pdf), 'the text starts at the 22 mm margin').to.be.closeTo(22 * MM, 1.5);
    });

    cy.get('button[title^="Standard ATS-optimized"]').click();
    cy.store().should((s) => {
      expect(active(s).settings).to.include({ marginV: 14, marginH: 18, sectionGap: 16, itemGap: 8, lineHeightValue: 1.5 });
    });
    spacingField('Left / Right margin').should('have.value', '18mm');
  });
});

describe('Personal Info → header icon picker', () => {
  const chooseIcon = (n = 0) => cy.get('button[title="Select from header icon library"]').eq(n);

  beforeEach(() => {
    cy.visitEditor('classic');
    chooseIcon().should('be.visible');
  });

  it('picks an icon for a contact field from the library; Reset to Default takes it off again', () => {
    chooseIcon().click();
    cy.contains('h3', 'Select Header Icon').should('be.visible');
    cy.contains('Choose a vector icon for').should('contain.text', 'Email');
    cy.contains('button', /^Recommended \(\d+\)$/).should('be.visible');
    cy.contains('span', 'Using default template icon').should('be.visible');

    // Search reaches the whole library, not just the recommended few.
    cy.get('input[placeholder^="Search icons"]').type('star', { delay: 0 });
    cy.contains('button', /^Star$/).click();
    cy.contains('h3', 'Select Header Icon').should('not.exist');
    cy.store().should((s) => expect(active(s).settings.customContactIcons?.email).to.eq('icon:star'));
    cy.get('button[title="Remove custom icon"]').should('have.length', 1);

    // The PDF still exports with the address beside the icon, and draws no picture for it: the pick is
    // a vector icon, not an image address. Which shape it prints is not checked here (09-contact-icons).
    cy.exportPdf().then((pdf) => {
      expect(pdf.runs.map((r) => r.str).join(' ')).to.contain('alex@example.com');
      expect(pdf.images).to.eq(0);
    });

    chooseIcon().click();
    cy.contains('button', 'Reset to Default').click();
    cy.store().should((s) => expect(active(s).settings.customContactIcons?.email ?? null).to.eq(null));
    cy.get('button[title="Remove custom icon"]').should('not.exist');
  });

  it('Style Packs sets one of the five packs for the field', () => {
    chooseIcon().click();
    cy.contains('button', 'Style Packs (5)').click();
    ['Classic Outline', 'Modern Refined', 'Solid Filled', 'Minimalist', 'Bold Outline'].forEach((label) => cy.contains('button', label).should('be.visible'));
    cy.contains('button', 'Solid Filled').click();
    cy.store().should((s) => expect(active(s).settings.customContactIcons?.email).to.eq('pack:filled'));
  });
});
