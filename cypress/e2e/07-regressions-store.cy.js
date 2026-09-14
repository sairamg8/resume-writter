// Regression tests for resume-store bugs (audit main-loop notes M1–M3, M15).
import { buildTestState, STORAGE_KEY } from '../../tests/helpers.js';
import { CARD, IMPORT_INPUT } from '../support/selectors.js';
import { dashboardState } from '../support/state.js';

const visitWithRawStore = (raw) =>
  cy.visit('/#/', {
    onBeforeLoad(win) {
      win.localStorage.clear();
      win.localStorage.setItem(STORAGE_KEY, raw);
    },
  });

describe('regressions — resume store', () => {
  it('M1: creating, duplicating or importing a resume keeps the deleted-ids list', () => {
    cy.visitDashboard(dashboardState());
    cy.contains(CARD, 'Minimal CV').contains('button', 'Delete').click();
    cy.store().its('deletedIds').should('have.length', 1);

    cy.contains('button', 'New Resume').click();
    cy.store().its('deletedIds').should('have.length', 1);

    cy.get('button[title="Back to dashboard"]').click();
    cy.contains(CARD, 'Modern CV').contains('button', 'Copy').click();
    cy.store().its('deletedIds').should('have.length', 1);

    cy.get('button[title="Back to dashboard"]').click();
    cy.get('input[type="file"][accept=".json"]').selectFile({
      contents: Cypress.Buffer.from(JSON.stringify(buildTestState('classic').resumes[0])),
      fileName: 'r.json',
    }, { force: true });
    cy.location('hash').should('match', /^#\/resume\//);
    cy.store().its('deletedIds').should('have.length', 1);
  });

  it('M2: resumes saved under an older data version are kept, not replaced by the demo seed', () => {
    const state = buildTestState('minimal');
    state.dataVersion = 5;
    state.resumes[0].name = 'My Real CV';
    visitWithRawStore(JSON.stringify(state));
    cy.get(CARD).should('have.length', 1).and('contain.text', 'My Real CV');
    cy.store().should((s) => {
      expect(s.dataVersion).to.eq(6);
      expect(s.resumes.map((r) => r.name)).to.deep.eq(['My Real CV']);
    });
  });

  it('M2: an unreadable store is backed up before the app starts empty', () => {
    visitWithRawStore('{ this is not json');
    cy.contains('No resumes yet').should('be.visible');
    cy.window().then((win) => {
      const backups = Object.keys(win.localStorage).filter((k) => k.startsWith(`${STORAGE_KEY}_backup_`));
      expect(backups).to.have.length(1);
      expect(win.localStorage.getItem(backups[0])).to.eq('{ this is not json');
    });
  });

  it('M3: a full localStorage does not crash the editor and says the change was not saved', () => {
    cy.visitEditor('classic');
    cy.window().then((win) => {
      const original = win.Storage.prototype.setItem;
      cy.stub(win.Storage.prototype, 'setItem').callsFake(function setItem(key, value) {
        if (key === STORAGE_KEY) throw new win.DOMException('The quota has been exceeded.', 'QuotaExceededError');
        return original.call(this, key, value);
      });
    });
    cy.contains('label', 'Full Name').parent().next('input').clear().type('Still Editing');
    cy.preview().should('contain.text', 'Still Editing');
    cy.contains('[role="alert"]', 'Not saved').should('be.visible');
  });

  /** The Design panel's template list shows Classic, and only Classic, selected. */
  const classicSelected = () => {
    cy.get('button[title="Design & Customize"]').click();
    ['Clean accent headings', 'Two-column header', 'Full-width layout', 'whitespace-first', 'Colored left sidebar']
      .forEach((desc) => cy.contains('button', desc)
        .should(desc === 'Two-column header' ? 'have.class' : 'not.have.class', 'border-blue-500'));
  };

  it('M15: a saved résumé with a template the app does not offer (the old seed\'s "dark") opens as Classic, selected', () => {
    const state = buildTestState('classic');
    state.resumes[0].template = 'dark';
    cy.visitEditor('classic', { state });
    cy.store().should((s) => expect(s.resumes[0].template).to.eq('classic'));
    cy.preview().should('contain.text', 'Alex Johnson');
    classicSelected();
  });

  it('M15: importing a résumé with an unknown template opens it as Classic, selected', () => {
    cy.visitDashboard(dashboardState());
    cy.get(IMPORT_INPUT).selectFile({
      contents: Cypress.Buffer.from(JSON.stringify({ ...buildTestState('classic').resumes[0], template: 'aurora', name: 'Aurora CV' })),
      fileName: 'aurora.json',
    }, { force: true });
    cy.location('hash').should('match', /^#\/resume\//);
    cy.store().should((s) => expect(s.resumes.find((r) => r.name === 'Aurora CV').template).to.eq('classic'));
    classicSelected();
  });
});

const JOBS_KEY = 'cpwtcv_jobs_v1';

const visitJobsWithRaw = (raw) =>
  cy.visit('/#/jobs', {
    onBeforeLoad(win) {
      win.localStorage.clear();
      win.localStorage.setItem(JOBS_KEY, raw);
    },
  });

/** The job-store backups in localStorage, as { key: value }. */
const jobBackups = (win) => Object.fromEntries(Object.keys(win.localStorage)
  .filter((k) => k.startsWith(`${JOBS_KEY}_backup_`))
  .map((k) => [k, win.localStorage.getItem(k)]));

describe('regressions — job store', () => {
  it('NEW-5: an unreadable job list is backed up, and the tracker says so before starting empty', () => {
    visitJobsWithRaw('{ this is not json');
    cy.contains('[role="alert"]', 'could not be read').should('be.visible');
    cy.contains('span', /^Total$/).prev('span').should('have.text', '0');
    cy.window().then((win) => {
      const backups = jobBackups(win);
      expect(Object.values(backups)).to.deep.eq(['{ this is not json']);
      cy.contains('[role="alert"]', Object.keys(backups)[0]).should('be.visible');
    });
    // The next save replaces the unreadable value; the backup stays.
    cy.jobStore().its('jobs').should('deep.eq', []);
    cy.window().then((win) => expect(Object.keys(jobBackups(win))).to.have.length(1));
    cy.contains('[role="alert"]', 'could not be read').contains('button', 'Dismiss').click();
    cy.contains('[role="alert"]', 'could not be read').should('not.exist');
  });

  // Version 1 goes through the demo-job migration, version 2 (current) does not.
  [1, 2].forEach((dataVersion) => {
    it(`NEW-5: one broken entry does not throw the whole saved list away (data version ${dataVersion})`, () => {
      const acme = { id: 'job_1', company: 'Acme', role: 'Dev', status: 'applied', todos: [] };
      const raw = JSON.stringify({ dataVersion, jobs: [null, 'junk', acme] });
      visitJobsWithRaw(raw);
      cy.contains('Acme').should('be.visible');
      cy.contains('[role="alert"]', 'could not be read').should('be.visible');
      cy.jobStore().should((s) => expect(s.jobs.map((j) => j.company)).to.include('Acme'));
      cy.window().then((win) => expect(Object.values(jobBackups(win))).to.deep.eq([raw]));
    });
  });

  it('M3: a full localStorage does not crash the job tracker and says so', () => {
    cy.seedAndVisit('/#/jobs', null);
    cy.window().then((win) => {
      const original = win.Storage.prototype.setItem;
      cy.stub(win.Storage.prototype, 'setItem').callsFake(function setItem(key, value) {
        if (key === 'cpwtcv_jobs_v1') throw new win.DOMException('The quota has been exceeded.', 'QuotaExceededError');
        return original.call(this, key, value);
      });
    });
    cy.on('window:confirm', () => true);
    cy.get('button[title="Clear all job data"]').click();
    cy.contains('span', /^Total$/).prev('span').should('have.text', '0');
    cy.contains('[role="alert"]', 'not being saved').should('be.visible');
  });
});
