import { buildTestState } from '../../tests/helpers.js';
import { CARD, CARD_RENAME, IMPORT_INPUT } from '../support/selectors.js';
import { dashboardState } from '../support/state.js';

const NAMES = ['Classic CV', 'Modern CV', 'Minimal CV'];

/** Resume the store marks active, or undefined. */
const active = (s) => s.resumes.find((r) => r.id === s.activeId);

describe('dashboard — first visit', () => {
  beforeEach(() => cy.visitDashboard());

  it('is blank: no résumés and nobody else\'s data', () => {
    cy.get(CARD).should('have.length', 0);
    cy.contains('No resumes yet').should('be.visible');
    cy.contains('h1', 'My Resumes').next().should('have.text', '0 resumes');
    cy.contains('Your Name').should('be.visible'); // career panel placeholder
  });

  // Create Resume and New Resume ask first: a blank résumé or one of the role starters.
  it('Create Resume → Start from Scratch opens a blank résumé in the editor', () => {
    cy.contains('button', 'Create Resume').click();
    cy.contains('h2', 'Choose a Resume Starter').should('be.visible');
    cy.contains('button', 'Start from Scratch (Blank)').click();
    cy.location('hash').should('match', /^#\/resume\/resume_[\w-]+$/);
    cy.contains('button', 'Export').should('be.visible');
    cy.get('input[placeholder="John Doe"]').should('have.value', '');
    cy.store().should((s) => {
      expect(s.resumes).to.have.length(1);
      const r = active(s);
      expect(r.name).to.eq('Untitled Resume');
      expect(Object.values(r.personal).filter((v) => typeof v === 'string' && v)).to.deep.eq([]);
      expect(r.sections.map((x) => x.type)).to.deep.eq(['experience', 'education', 'skills']);
      expect(r.sections.every((x) => x.items.length === 0)).to.eq(true);
    });
  });
});

describe('dashboard — with résumés', () => {
  beforeEach(() => cy.visitDashboard(dashboardState()));

  it('lists every stored résumé', () => {
    cy.get(CARD).should('have.length', NAMES.length);
    NAMES.forEach((name) => cy.contains(CARD, name).should('be.visible'));
    cy.contains('h1', 'My Resumes').next().should('have.text', '3 resumes');
  });

  it('New Resume → Start from Scratch creates an untitled blank résumé and opens it', () => {
    cy.contains('button', 'New Resume').click();
    cy.contains('button', 'Start from Scratch (Blank)').click();
    cy.location('hash').should('match', /^#\/resume\/resume_[\w-]+$/);
    cy.contains('button', 'Export').should('be.visible');
    cy.store().should((s) => {
      expect(s.resumes).to.have.length(4);
      expect(active(s).name).to.eq('Untitled Resume');
      expect(active(s).personal.name).to.eq('');
    });
  });

  it('New Cover creates a résumé and opens its cover-letter tab', () => {
    cy.contains('button', 'New Cover').click();
    cy.location('hash').should('match', /^#\/resume\/resume_[\w-]+\?tab=coverletter$/);
    cy.store().should((s) => expect(active(s).name).to.eq('Cover Letter'));
  });

  it('Copy duplicates a résumé as "<name> (Copy)" and opens the copy', () => {
    cy.contains(CARD, 'Modern CV').contains('button', 'Copy').click();
    cy.location('hash').should('match', /^#\/resume\/resume_[\w-]+$/);
    cy.store().should((s) => {
      expect(s.resumes).to.have.length(4);
      const copy = active(s);
      const source = s.resumes.find((r) => r.name === 'Modern CV');
      expect(copy.name).to.eq('Modern CV (Copy)');
      expect(copy.id).not.to.eq(source.id);
      expect(copy.template).to.eq(source.template);
      expect(copy.sections).to.deep.eq(source.sections);
    });
  });

  it('rename: Enter commits, Escape cancels, a blank name reverts', () => {
    // By position: once the name moves into the rename <input>, a text query no longer matches.
    cy.get(CARD).eq(NAMES.indexOf('Minimal CV')).as('card').should('contain.text', 'Minimal CV');

    cy.get('@card').find(CARD_RENAME).click({ force: true });
    cy.get('@card').find('input').clear().type('Minimal — Frontend{enter}');
    cy.get(CARD).should('contain.text', 'Minimal — Frontend');
    cy.store().its('resumes').should((rs) => expect(rs.map((r) => r.name)).to.include('Minimal — Frontend'));

    cy.get('@card').find(CARD_RENAME).click({ force: true });
    cy.get('@card').find('input').clear().type('Thrown away{esc}');
    cy.get(CARD).should('contain.text', 'Minimal — Frontend').and('not.contain.text', 'Thrown away');

    cy.get('@card').find(CARD_RENAME).click({ force: true });
    cy.get('@card').find('input').clear().type('   {enter}');
    cy.get(CARD).should('contain.text', 'Minimal — Frontend');
  });

  it('Delete removes the card and records the id — and the version deleted — for cloud sync (R8-0)', () => {
    cy.store().then((s) => {
      const modern = s.resumes.find((r) => r.name === 'Modern CV');
      cy.contains(CARD, 'Modern CV').contains('button', 'Delete').click();
      cy.get(CARD).should('have.length', 2).and('not.contain.text', 'Modern CV');
      const recorded = (after) => {
        expect(after.resumes.map((r) => r.id)).not.to.include(modern.id);
        expect(after.deletedIds).to.include(modern.id);
        // The first sync sends it only if the account's copy is not newer than this one.
        expect(after.deletedInfo[modern.id].version).to.eq(modern.updatedAt);
      };
      cy.store().should(recorded);
      cy.reload();
      cy.get(CARD).should('have.length', 2);
      cy.store().should(recorded);
    });
  });

  it('deleting every résumé leaves the empty dashboard', () => {
    NAMES.forEach(() => cy.get(CARD).first().contains('button', 'Delete').click());
    cy.contains('No resumes yet').should('be.visible');
    cy.store().should((s) => {
      expect(s.resumes).to.have.length(0);
      expect(s.activeId).to.eq(null);
      expect(s.deletedIds).to.have.length(3);
    });
  });

  it('Import opens a valid résumé JSON in the editor', () => {
    const resume = buildTestState('sidebar').resumes[0];
    cy.get(IMPORT_INPUT).selectFile({
      contents: Cypress.Buffer.from(JSON.stringify({ ...resume, name: 'Imported CV' })),
      fileName: 'imported.json',
      mimeType: 'application/json',
    }, { force: true });
    cy.location('hash').should('match', /^#\/resume\/resume_[\w-]+$/);
    cy.preview().should('contain.text', 'Alex Johnson');
    cy.store().should((s) => {
      expect(s.resumes).to.have.length(4);
      expect(active(s).name).to.eq('Imported CV');
      expect(active(s).template).to.eq('sidebar');
    });
  });

  it('Import rejects a JSON file that is not a résumé, and unparseable files', () => {
    cy.get(IMPORT_INPUT).selectFile({
      contents: Cypress.Buffer.from(JSON.stringify({ hello: 'world' })),
      fileName: 'not-a-resume.json',
    }, { force: true });
    cy.contains('Invalid resume file').should('be.visible');
    cy.location('hash').should('eq', '#/');

    cy.get(IMPORT_INPUT).selectFile({
      contents: Cypress.Buffer.from('{ this is not json'),
      fileName: 'broken.json',
    }, { force: true });
    cy.contains('Could not parse file').should('be.visible');
    cy.store().its('resumes').should('have.length', 3);
  });

  it('header and footer links reach the job tracker, terms and privacy pages', () => {
    cy.contains('button', 'Job Tracker').click();
    cy.location('hash').should('eq', '#/jobs');
    cy.go('back');
    cy.contains('button', 'Terms').click();
    cy.location('hash').should('eq', '#/terms');
    cy.go('back');
    cy.contains('button', 'Privacy Policy').click();
    cy.location('hash').should('eq', '#/privacy');
  });

  it('an unknown route redirects to the dashboard', () => {
    cy.visit('/#/definitely/not/a/page');
    cy.location('hash').should('eq', '#/');
    cy.get(CARD).should('have.length', 3);
  });
});
