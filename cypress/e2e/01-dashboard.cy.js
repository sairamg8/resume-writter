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

  // Create Resume and New Resume open New Resume's page (R3-012): the looks, then a blank résumé or
  // one of the role starters below them.
  it('Create Resume → Start from Scratch opens a blank résumé in the editor', () => {
    cy.contains('button', 'Create Resume').click();
    cy.location('hash').should('eq', '#/new');
    cy.contains('h1', 'Pick a look to start').should('be.visible');
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

  // R2-135: with no résumé to take a name and contacts from, the letter starts blank — and is a letter.
  it('New Cover with no résumé yet opens a blank letter, listed with the letters, not the résumés', () => {
    cy.contains('button', 'New Cover').click();
    cy.location('hash').should('match', /^#\/resume\/resume_[\w-]+\?tab=coverletter$/);
    cy.store().should((s) => {
      expect(s.resumes).to.have.length(1);
      expect(active(s).kind).to.eq('letter');
      expect(active(s).personal.name).to.eq('');
    });
    cy.go('back');
    cy.contains('h1', 'My Resumes').next().should('have.text', '0 resumes');
    cy.contains('No resumes yet').should('be.visible');
    cy.contains('h2', 'Cover Letters').next().should('have.text', '1 letter');
    cy.contains('section', 'Cover Letters').find(CARD).should('have.length', 1).and('contain.text', 'Cover Letter');
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

  // R2-135: it made a blank résumé named 'Cover Letter' — no name, no contacts — listed as a résumé.
  it('New Cover asks which résumé heads the letter, opens it on its tab, and lists it as a letter', () => {
    cy.contains('button', 'New Cover').click();
    cy.get('[role="dialog"]').should('be.visible').within(() => {
      cy.contains('h2', 'New Cover Letter').should('be.visible');
      NAMES.forEach((name) => cy.contains('button', name).should('be.visible'));
      cy.contains('button', 'Blank letter').should('be.visible');
      cy.contains('button', 'Modern CV').click();
    });
    cy.location('hash').should('match', /^#\/resume\/resume_[\w-]+\?tab=coverletter$/);
    cy.get('#cover-letter-preview').should('contain.text', 'Alex Johnson').and('contain.text', 'alex@example.com');
    cy.store().should((s) => {
      const letter = active(s);
      const modern = s.resumes.find((r) => r.name === 'Modern CV');
      expect(letter.kind).to.eq('letter');
      expect(letter.name).to.eq('Cover Letter');
      expect(letter.personal).to.deep.eq(modern.personal);
      expect(letter.template).to.eq('modern');
      expect(letter.coverLetter.body).to.eq('');
      expect(modern.kind).to.eq(undefined);
    });
    cy.go('back');
    cy.contains('h1', 'My Resumes').next().should('have.text', '3 resumes');
    cy.contains('h2', 'Cover Letters').next().should('have.text', '1 letter');
    cy.contains('section', 'Cover Letters').find(CARD).should('have.length', 1).and('contain.text', 'Cover Letter');
    cy.get(CARD).should('have.length', NAMES.length + 1);
  });

  it('a letter card opens on its letter, and its Copy is a letter too', () => {
    cy.contains('button', 'New Cover Letter').click();
    cy.get('[role="dialog"]').contains('button', 'Classic CV').click();
    cy.location('hash').should('match', /\?tab=coverletter$/);
    cy.go('back');
    cy.contains('section', 'Cover Letters').find(CARD).contains('button', 'Edit').click();
    cy.location('hash').should('match', /^#\/resume\/resume_[\w-]+\?tab=coverletter$/);
    cy.go('back');
    cy.contains('section', 'Cover Letters').find(CARD).contains('button', 'Copy').click();
    cy.location('hash').should('match', /\?tab=coverletter$/);
    cy.store().should((s) => {
      expect(active(s).name).to.eq('Cover Letter (Copy)');
      expect(active(s).kind).to.eq('letter');
    });
    cy.go('back');
    cy.contains('h2', 'Cover Letters').next().should('have.text', '2 letters');
    cy.contains('h1', 'My Resumes').next().should('have.text', '3 resumes');
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
