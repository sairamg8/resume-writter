// The two writing helpers end to end (R2-161): the STAR bullet optimiser in the rich-text toolbar,
// and the cover-letter generator on the Cover Letter tab. Each opens, shows its verdict or its
// draft, and what Apply writes reaches the store and the printed PDF. Smoke level: the rules are
// in tests/unit/bullet-optimizer.unit.mjs and cover-letter-generator.unit.mjs, and the optimiser's
// caret and selection handling in tests/playwright/bullet-optimizer.spec.mjs.
import { ENTRY_HEADER } from '../support/selectors.js';

const BULLETS = '<ul><li>Was responsible for the payments team of 5</li><li>Built the ledger service</li></ul>';
const SECTIONS = [{
  id: 'exp', type: 'experience', title: 'Experience', visible: true, settings: { spacing: 'normal' },
  items: [{ id: 'e1', company: 'Acme', role: 'Staff Engineer', startDate: 'Jan 2020', endDate: 'Dec 2021', description: BULLETS }],
}];

const active = (s) => s.resumes.find((r) => r.id === s.activeId);
/** The PDF preview's text, waiting as long as a rebuild of it can take. */
const previewText = (id = '#resume-preview') => cy.get(id, { timeout: 30_000 });

describe('STAR bullet optimiser', () => {
  beforeEach(() => {
    cy.visitEditor('classic', { sections: SECTIONS });
    cy.contains(ENTRY_HEADER, 'Staff Engineer').click();
    cy.contains('[contenteditable="true"]', 'payments team').as('editor').scrollIntoView();
    cy.get('@editor').should('be.visible');
  });

  it('opens on the selected bullet, scores it, fixes its weak phrase, and Apply puts the result in its place', () => {
    // Select the first bullet, as a user would before pressing the toolbar button.
    cy.get('@editor').find('li').first().then(($li) => {
      $li[0].closest('[contenteditable]').focus();
      $li[0].ownerDocument.getSelection().selectAllChildren($li[0]);
    });
    cy.get('@editor').parent().find('button[title="Bullet Optimizer & STAR Formula Helper"]').click();

    cy.contains('h2', 'Bullet Optimizer & STAR Formula').should('be.visible');
    cy.get('textarea[placeholder^="e.g. Engineered distributed cache"]').as('statement')
      .should('have.value', 'Was responsible for the payments team of 5');
    cy.contains(/^\s*Quality: \d+\/100$/).should('be.visible');
    cy.contains('Detected weak phrase').should('contain.text', 'responsible for');

    cy.contains('button', 'Auto-Fix').click();
    cy.get('@statement').should('have.value', 'Led the payments team of 5');
    cy.contains('No Weak Words').should('be.visible');
    // A power verb from the list replaces the first word; a metric chip is appended.
    cy.contains('button', /^Leadership$/).click();
    cy.contains('button', /^Spearheaded$/).click();
    cy.get('@statement').should('have.value', 'Spearheaded the payments team of 5');
    cy.contains('Strong Action Verb').should('be.visible');
    cy.contains('button', '+ by 35%').click();
    cy.get('@statement').should('have.value', 'Spearheaded the payments team of 5 by 35%');
    cy.contains('Quantifiable Metric').should('be.visible');
    cy.contains(/^\s*Quality: 100\/100$/).should('be.visible');

    cy.contains('button', 'Apply to Resume').click();
    cy.contains('h2', 'Bullet Optimizer & STAR Formula').should('not.exist');
    cy.get('@editor').find('li').then(($li) => {
      expect([...$li].map((li) => li.textContent)).to.deep.eq(['Spearheaded the payments team of 5 by 35%', 'Built the ledger service']);
    });
    cy.store().should((s) => expect(active(s).sections[0].items[0].description).to.contain('<li>Spearheaded the payments team of 5 by 35%</li>'));
    previewText().should('contain.text', 'Spearheaded the payments team of 5 by 35%').and('not.contain.text', 'Was responsible');
  });

  it('Cancel leaves the bullet as it was', () => {
    cy.get('@editor').parent().find('button[title="Bullet Optimizer & STAR Formula Helper"]').click();
    cy.get('textarea[placeholder^="e.g. Engineered distributed cache"]').type('Anything at all', { delay: 0 });
    cy.contains('button', /^Cancel$/).click();
    cy.contains('h2', 'Bullet Optimizer & STAR Formula').should('not.exist');
    cy.store().should((s) => expect(active(s).sections[0].items[0].description).to.eq(BULLETS));
  });
});

describe('cover-letter generator', () => {
  /** The generator's dialog: its fields are looked up in it, not among the letter's own. */
  const dialog = () => cy.contains('h2', 'Smart Cover Letter Generator').parents('.rounded-2xl').first();

  beforeEach(() => {
    cy.visitEditor('classic', { tab: 'coverletter' });
    cy.contains('button', 'Auto-Generate from Resume').click();
    cy.contains('h2', 'Smart Cover Letter Generator').should('be.visible');
  });

  it('drafts a letter from the résumé for the company and role typed, and Apply fills the letter', () => {
    dialog().find('input[placeholder="e.g. Google, Stripe"]').type('Northwind Traders', { delay: 0 });
    dialog().find('input[placeholder="Full Stack Engineer"]').type('Platform Engineer', { delay: 0 }); // the résumé's title as its hint
    dialog().find('input[placeholder="e.g. Hiring Manager"]').clear().type('Dana Reyes', { delay: 0 });
    dialog().contains('button', 'Strategic & Leadership').click();

    cy.contains('Subject: Application for Platform Engineer — Alex Johnson').should('be.visible');
    cy.contains('Live Letter Preview').parent().next()
      .should('contain.text', 'Dear Dana Reyes,')
      .and('contain.text', 'Northwind Traders')
      .and('contain.text', 'Acme Corp'); // from the résumé's experience

    cy.contains('button', 'Apply to Cover Letter').click();
    cy.contains('h2', 'Smart Cover Letter Generator').should('not.exist');
    cy.store().should((s) => {
      const cl = active(s).coverLetter;
      expect(cl.company).to.eq('Northwind Traders');
      expect(cl.recipientName).to.eq('Dana Reyes');
      expect(cl.subject).to.eq('Application for Platform Engineer — Alex Johnson');
      expect(cl.body).to.contain('Northwind Traders').and.contain('<p>Dear Dana Reyes,</p>');
    });
    previewText('#cover-letter-preview').should('contain.text', 'Northwind Traders').and('contain.text', 'Dana Reyes');
  });

  it('Cancel changes nothing', () => {
    cy.store().then((before) => {
      dialog().find('input[placeholder="e.g. Google, Stripe"]').type('Nobody Inc', { delay: 0 });
      cy.contains('button', /^Cancel$/).click();
      cy.contains('h2', 'Smart Cover Letter Generator').should('not.exist');
      cy.store().should((s) => expect(active(s).coverLetter).to.deep.eq(active(before).coverLetter));
    });
  });
});
