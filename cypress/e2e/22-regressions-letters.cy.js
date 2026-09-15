// Regression tests for letters saved by earlier builds (reviews R1-0, R5-0), moved out of
// 07-regressions-store.cy.js when it passed 300 lines. Each test sets the old data version
// itself: the shared fixture résumé carries the current one (tests/helpers.js).
import { buildTestState, DATA_VERSION } from '../../tests/helpers.js';
import { IMPORT_INPUT } from '../support/selectors.js';
import { dashboardState } from '../support/state.js';

describe('regressions — letters saved with the old "Hiring Manager" default (R1-0)', () => {
  // Every résumé created before bf0467f saved this block: a recipient title nobody typed (there
  // was no input for it) and nothing else.
  const OLD_LETTER = {
    recipientName: '', recipientTitle: 'Hiring Manager', company: '', date: '', subject: '',
    body: '<p>I would love to join the team.</p>', closing: 'Sincerely',
  };
  // When 4bc56fe went live, the first deployed build that printed the title and showed its input.
  // It stamped no data version: a letter last edited before then never showed the title (R7-2).
  const LIVE = Date.UTC(2026, 8, 14, 16, 9, 53);
  const BEFORE = LIVE - 86_400_000;
  const letter = () => cy.get('#cover-letter-preview');
  const titleInput = () => cy.contains('label', 'Recipient Title').next('input');
  const v6State = (updatedAt = BEFORE) => {
    const state = buildTestState('classic');
    state.dataVersion = 6;
    state.resumes[0].dataVersion = 6; // saved under data version 6: the v7 migration is due
    state.resumes[0].coverLetter = { ...OLD_LETTER };
    state.resumes[0].updatedAt = updatedAt;
    return state;
  };
  /** Import `resume` as a file an older build exported, and open its letter. */
  const importLetter = (resume) => {
    cy.visitDashboard(dashboardState());
    cy.get(IMPORT_INPUT).selectFile({ contents: Cypress.Buffer.from(JSON.stringify(resume)), fileName: 'old.json' }, { force: true });
    cy.location('hash').should('match', /^#\/resume\//);
    // Wait for the editor: the dashboard has a "Cover Letter" button of its own (a new letter).
    cy.preview().should('contain.text', 'Alex Johnson');
    cy.contains('button', 'Cover Letter').click();
    cy.previewReady();
  };
  // Exported by a build that stamped no data version on its résumés.
  const { dataVersion: _current, ...fixture } = buildTestState('classic').resumes[0];
  const printsNoTitle = () => {
    letter().should('contain.text', 'I would love to join the team.').and('not.contain.text', 'Hiring Manager');
    titleInput().should('have.value', '').and('have.attr', 'placeholder', 'Hiring Manager');
  };

  it('a letter saved under data version 6 prints no "Hiring Manager" line, and the store is migrated', () => {
    cy.visitEditor('classic', { state: v6State(), tab: 'coverletter' });
    printsNoTitle();
    cy.store().should((s) => {
      expect(s.dataVersion).to.eq(DATA_VERSION);
      expect(s.resumes[0].dataVersion).to.eq(DATA_VERSION);
      expect(s.resumes[0].coverLetter).to.deep.eq({ ...OLD_LETTER, recipientTitle: '' });
    });
  });

  it('an imported file saved with the old default prints no "Hiring Manager" line', () => {
    // Made current by the file's own date, before the import stamps it as a new résumé.
    importLetter({ ...fixture, name: 'Old Letter CV', coverLetter: OLD_LETTER, updatedAt: BEFORE });
    printsNoTitle();
    cy.store().should((s) => expect(s.resumes.find((r) => r.name === 'Old Letter CV').coverLetter.recipientTitle).to.eq(''));
  });

  it('R7-2: a letter last edited on 4bc56fe after it went live keeps the title it printed — saved here or imported', () => {
    const keepsTitle = () => {
      letter().should('contain.text', 'Hiring Manager');
      titleInput().should('have.value', 'Hiring Manager');
    };
    cy.visitEditor('classic', { state: v6State(LIVE + 60_000), tab: 'coverletter' });
    keepsTitle();
    cy.store().its('resumes.0.coverLetter.recipientTitle').should('eq', 'Hiring Manager');
    importLetter({ ...fixture, name: 'Seen Letter CV', coverLetter: OLD_LETTER, updatedAt: LIVE + 60_000 });
    keepsTitle();
  });

  it('a "Hiring Manager" the user types afterwards is theirs: it survives a reload', () => {
    cy.visitEditor('classic', { state: v6State(), tab: 'coverletter' });
    printsNoTitle();
    titleInput().type('Hiring Manager');
    letter().should('contain.text', 'Hiring Manager');
    cy.store().its('resumes.0.coverLetter.recipientTitle').should('eq', 'Hiring Manager');
    cy.reload();
    cy.previewReady();
    titleInput().should('have.value', 'Hiring Manager');
    letter().should('contain.text', 'Hiring Manager');
  });
});

describe('regressions — a letter saved with its own hidden contacts before they were its own alone (R5-0, FIDB-44)', () => {
  // Until e0e243c, first deployed in 4bc56fe, the letter printed the résumé's hidden contacts as
  // well as the list its panel wrote. It stamped no data version on a résumé.
  const LIVE = Date.UTC(2026, 8, 14, 16, 9, 53);
  const squash = (s) => s.replace(/\s+/g, '').toLowerCase();
  const PHONE = squash('+1 555 0100');
  const letter = () => cy.get('#cover-letter-preview');
  /** The résumé hides its phone; one eye click on the letter hid its GitHub. */
  const saved = (updatedAt) => {
    const state = buildTestState('classic');
    const r = state.resumes[0];
    delete r.dataVersion;
    r.updatedAt = updatedAt;
    r.personal = { ...r.personal, hiddenFields: ['phone'] };
    r.coverLetter = { ...r.coverLetter, hiddenFields: ['github'] };
    return state;
  };

  it('last edited before then: the phone the résumé hides stays off the letter, and its panel shows it hidden', () => {
    cy.visitEditor('classic', { state: saved(LIVE - 86_400_000), tab: 'coverletter' });
    letter().invoke('text').should((t) => {
      expect(squash(t)).not.to.contain(PHONE);
      expect(squash(t)).to.contain('alex@example.com');
    });
    cy.get('button[title="Show Phone on the cover letter"]').should('exist');
    cy.store().should((s) => {
      expect(s.resumes[0].coverLetter.hiddenFields).to.deep.eq(['github', 'phone']);
      expect(s.resumes[0].personal.hiddenFields).to.deep.eq(['phone']);
    });
  });

  // Guard: a letter edited since then printed its own list alone, and keeps it.
  it('edited since then: the letter keeps printing the phone its own list shows', () => {
    cy.visitEditor('classic', { state: saved(LIVE + 60_000), tab: 'coverletter' });
    letter().invoke('text').should((t) => expect(squash(t)).to.contain(PHONE));
    cy.store().should((s) => expect(s.resumes[0].coverLetter.hiddenFields).to.deep.eq(['github']));
  });
});
