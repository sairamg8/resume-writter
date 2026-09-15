// Regression tests for resume-store bugs (audit main-loop notes M1–M3, M15; reviews R4, R5, R8).
// Letters saved with the old "Hiring Manager" default (R1-0): 22-regressions-letters.cy.js.
import { buildTestState, DATA_VERSION, STORAGE_KEY } from '../../tests/helpers.js';
import { CARD, IMPORT_INPUT } from '../support/selectors.js';
import { dashboardState } from '../support/state.js';

/** The résumé-store backups in localStorage, as { key: value }. */
const resumeBackups = (win) => Object.fromEntries(Object.keys(win.localStorage)
  .filter((k) => k.startsWith(`${STORAGE_KEY}_backup_`))
  .map((k) => [k, win.localStorage.getItem(k)]));

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
      expect(s.dataVersion).to.eq(DATA_VERSION);
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

  it('R4-6: a résumé that cannot be read is backed up, and the dashboard says so — after a reload, until dismissed', () => {
    const state = buildTestState('minimal');
    state.resumes[0].name = 'My Real CV';
    state.resumes = [null, { name: 'Saved without an id' }, ...state.resumes];
    const raw = JSON.stringify(state);
    visitWithRawStore(raw);
    cy.get(CARD).should('have.length', 1).and('contain.text', 'My Real CV');
    cy.contains('[role="alert"]', 'résumés could not be read').should('be.visible');
    cy.window().then((win) => {
      const backups = resumeBackups(win);
      expect(Object.values(backups)).to.deep.eq([raw], 'the whole original, the dropped entries included');
      cy.contains('[role="alert"]', Object.keys(backups)[0]).should('be.visible');
    });
    cy.store().its('resumes').should('have.length', 1); // the repaired store replaced the original
    cy.reload();
    cy.contains('[role="alert"]', 'résumés could not be read').contains('button', 'Dismiss').click();
    cy.contains('[role="alert"]', 'could not be read').should('not.exist');
    cy.reload();
    cy.get(CARD).should('have.length', 1);
    cy.contains('[role="alert"]', 'could not be read').should('not.exist');
    cy.window().then((win) => expect(Object.keys(resumeBackups(win))).to.have.length(1, 'one backup, made once'));
  });

  it('R4-8: the notice saves the backed-up original as a file', () => {
    cy.task('clearDownloads');
    visitWithRawStore('{ this is not json');
    cy.contains('[role="alert"]', 'résumés could not be read').contains('button', 'Download the copy').click();
    cy.task('waitForDownload', { ext: '.json' }).then((file) => {
      expect(file).to.match(new RegExp(`${STORAGE_KEY}_backup_\\d+\\.json$`));
      cy.task('readTextFile', file).should('eq', '{ this is not json');
    });
  });

  it('R8-10: repaired again before the notice is dismissed, the notice still names the first copy, and downloads it', () => {
    cy.task('clearDownloads');
    visitWithRawStore('{ first bad value');
    cy.contains('[role="alert"]', 'résumés could not be read').should('be.visible');
    cy.window().then((win) => {
      const [first] = Object.keys(resumeBackups(win));
      win.localStorage.setItem(STORAGE_KEY, '{ second bad value'); // broken again; the notice is still up
      cy.reload();
      cy.contains('[role="alert"]', 'could not be read').should('be.visible'); // read (and repaired) again
      cy.window().then((again) => {
        const second = Object.keys(resumeBackups(again)).find((k) => k !== first);
        expect(second, 'a second backup').to.be.a('string');
        cy.contains('[role="alert"]', second).should('be.visible');
        cy.contains('[role="alert"]', first).should('be.visible'); // before: only the second was named
        cy.contains('[role="alert"]', 'could not be read').contains('button', 'Download the earlier copy').click();
        cy.task('waitForDownload', { ext: '.json' }).then((file) => {
          expect(file).to.match(new RegExp(`${first}\\.json$`));
          cy.task('readTextFile', file).should('eq', '{ first bad value');
        });
      });
    });
  });

  it('V2W1a-9: an earlier copy removed to make room is said to be gone, not left out without a word', () => {
    cy.visit('/#/', {
      onBeforeLoad(win) {
        win.localStorage.clear();
        win.localStorage.setItem(`${STORAGE_KEY}_backup_3000`, '{ the latest bad value');
        win.localStorage.setItem(`${STORAGE_KEY}_backup_2000`, '{ an earlier one');
        // A notice still up after four repairs: the oldest backup was pruned (BACKUPS_KEPT).
        win.localStorage.setItem(`${STORAGE_KEY}_recovery`, JSON.stringify({
          backupKey: `${STORAGE_KEY}_backup_3000`, earlier: [`${STORAGE_KEY}_backup_1000`, `${STORAGE_KEY}_backup_2000`],
        }));
      },
    });
    cy.contains('[role="alert"]', 'could not be read').should('contain.text', `${STORAGE_KEY}_backup_2000`)
      .and('contain.text', 'An earlier copy was later removed to make room'); // before: not a word about it
  });

  it('R4-8: when a save does not fit, old backups make room, oldest first, instead of "Not saved"', () => {
    cy.visitEditor('classic');
    cy.window().then((win) => {
      win.localStorage.setItem(`${STORAGE_KEY}_backup_1000`, 'an old copy');
      win.localStorage.setItem(`${STORAGE_KEY}_backup_2000`, 'a newer copy');
      const original = win.Storage.prototype.setItem;
      // Storage is "full" while the older backup is kept: the store fits once it is gone.
      cy.stub(win.Storage.prototype, 'setItem').callsFake(function setItem(key, value) {
        if (key === STORAGE_KEY && this.getItem(`${STORAGE_KEY}_backup_1000`) !== null) {
          throw new win.DOMException('The quota has been exceeded.', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      });
    });
    cy.contains('label', 'Full Name').parent().next('input').clear().type('Still Saved');
    cy.store().its('resumes.0.personal.name').should('eq', 'Still Saved');
    cy.contains('[role="alert"]', 'Not saved').should('not.exist');
    cy.window().then((win) => {
      expect(win.localStorage.getItem(`${STORAGE_KEY}_backup_1000`)).to.eq(null, 'the oldest backup made room');
      expect(win.localStorage.getItem(`${STORAGE_KEY}_backup_2000`)).to.eq('a newer copy', 'the newer one was not needed');
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

  /** The Design panel's template list shows the one described `picked` ("Two-column header": Classic), and only it, selected. */
  const selected = (picked = 'Two-column header') => {
    cy.get('button[title="Design & Customize"]').click();
    ['Clean accent headings', 'Two-column header', 'Full-width layout', 'whitespace-first', 'Colored left sidebar']
      .forEach((desc) => cy.contains('button', desc).should(desc === picked ? 'have.class' : 'not.have.class', 'border-blue-500'));
  };
  const importAs = (template, name) => {
    cy.visitDashboard(dashboardState());
    cy.get(IMPORT_INPUT).selectFile({
      contents: Cypress.Buffer.from(JSON.stringify({ ...buildTestState('classic').resumes[0], template, name })),
      fileName: 'imported.json',
    }, { force: true });
    cy.location('hash').should('match', /^#\/resume\//);
  };

  it('M15, R5-5: a saved résumé with a template the app does not offer (the old seed\'s "dark") opens as Classic, selected, its white name back to the template\'s', () => {
    const state = buildTestState('classic');
    state.resumes[0].template = 'dark';
    Object.assign(state.resumes[0].settings, { nameColor: '#ffffff', jobTitleColor: '#cbd5e1' });
    cy.visitEditor('classic', { state });
    cy.store().should((s) => expect([s.resumes[0].template, s.resumes[0].settings.nameColor, s.resumes[0].settings.jobTitleColor]).to.deep.eq(['classic', '', '']));
    cy.preview().should('contain.text', 'Alex Johnson');
    selected();
  });

  it('M15: importing a résumé with an unknown template opens it as Classic, selected', () => {
    importAs('aurora', 'Aurora CV');
    cy.store().should((s) => expect(s.resumes.find((r) => r.name === 'Aurora CV').template).to.eq('classic'));
    selected();
  });

  it('R5-5: importing a résumé whose template is written "Modern " opens it as Modern, selected', () => {
    importAs('Modern ', 'Imported Modern');
    cy.store().should((s) => expect(s.resumes.find((r) => r.name === 'Imported Modern').template).to.eq('modern'));
    selected('Full-width layout');
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

  it('R4-0: a list first read on a job page is repaired there, and the tracker still says so — after a reload, until dismissed', () => {
    cy.visit('/#/jobs/new', {
      onBeforeLoad(win) {
        win.localStorage.clear();
        win.localStorage.setItem(JOBS_KEY, '{ this is not json');
      },
    });
    cy.contains('h1', 'Add Job Application').should('be.visible'); // the form page read (and repaired) the list
    cy.window().then((win) => expect(Object.values(jobBackups(win))).to.deep.eq(['{ this is not json']));
    cy.reload(); // what refreshing the form does: the stored list is already the repaired one
    cy.visit('/#/jobs');
    cy.contains('[role="alert"]', 'could not be read').should('be.visible');
    cy.window().then((win) => cy.contains('[role="alert"]', Object.keys(jobBackups(win))[0]).should('be.visible'));
    cy.contains('[role="alert"]', 'could not be read').contains('button', 'Dismiss').click();
    cy.reload();
    cy.contains('span', /^Total$/).should('be.visible');
    cy.contains('[role="alert"]', 'could not be read').should('not.exist');
    cy.window().then((win) => expect(Object.keys(jobBackups(win))).to.have.length(1, 'one backup, made once'));
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
