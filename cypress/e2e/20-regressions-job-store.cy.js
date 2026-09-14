// Regression tests: the job pages share the app's one résumé store and one job store (audit
// main-loop note M14). Each page used to create its own copy of both, read from localStorage
// when it opened, so a page only knew what storage held at that moment.
import { buildTestState, DATA_VERSION, STORAGE_KEY } from '../../tests/helpers.js';

const JOBS_KEY = 'cpwtcv_jobs_v1';
const OWNER = { uid: 'e2e-owner', email: 'sairamgudiputi8@gmail.com', displayName: 'Owner' };
const SAMPLES = ['Sample · Classic', 'Sample · Modern', 'Sample · Minimal', 'Sample · Sidebar', 'Sample · Executive'];

const job = (id, company, role, status = 'applied') => ({
  id, company, role, status, url: '', location: '', salary: '', contact: '', resumeId: '', notes: '',
  appliedDate: '2026-09-01', deadline: '', todos: [],
  statusHistory: [{ status, changedAt: 1757000000000 }], createdAt: 1757000000000, updatedAt: 1757000000000,
});

const formField = (label) => cy.contains('label', label).parent().find('input, select, textarea').first();
const stat = (label) => cy.contains('span', new RegExp(`^${label}$`)).prev('span');
/** In-app navigation: a hash change, no reload — the pages keep whatever the app holds in memory. */
const goTo = (hash) => cy.window().then((win) => { win.location.hash = hash; });
/** Make every write of the job list fail the way a full localStorage does. */
const fillStorage = () => cy.window().then((win) => {
  const original = win.Storage.prototype.setItem;
  cy.stub(win.Storage.prototype, 'setItem').callsFake(function setItem(key, value) {
    if (key === JOBS_KEY) throw new win.DOMException('The quota has been exceeded.', 'QuotaExceededError');
    return original.call(this, key, value);
  });
});

describe('regressions — one résumé store and one job store (M14)', () => {
  it('M14: add and edit through the form, back to the tracker, reload — every change and every earlier save is kept', () => {
    const resumes = buildTestState('classic');
    cy.visit('/#/jobs', {
      onBeforeLoad(win) {
        win.localStorage.clear();
        win.localStorage.setItem(STORAGE_KEY, JSON.stringify(resumes));
        win.localStorage.setItem(JOBS_KEY, JSON.stringify({ dataVersion: 2, jobs: [job('job_a', 'Acme', 'Developer'), job('job_b', 'Beta', 'Designer')] }));
      },
    });
    stat('Total').should('have.text', '2');

    cy.contains('button', 'Add Job').click();
    formField('Company').type('Stripe');
    formField('Role / Position').type('Backend Engineer');
    formField('Resume Used').select(resumes.resumes[0].name);
    cy.contains('button', /^Add Job$/).click();
    cy.contains('h1', 'Stripe').should('be.visible');

    goTo('#/jobs/job_a/edit');
    formField('Role / Position').should('have.value', 'Developer').clear().type('Lead Developer');
    cy.contains('button', 'Save Changes').first().click();
    cy.location('hash').should('eq', '#/jobs/job_a');
    goTo('#/jobs');
    stat('Total').should('have.text', '3');

    cy.reload();
    stat('Total').should('have.text', '3');
    cy.contains('Lead Developer').should('be.visible');
    cy.contains('Stripe').should('be.visible');
    cy.contains('Beta').should('be.visible');
    cy.jobStore().should((s) => {
      expect(s.dataVersion).to.eq(2);
      expect(s.jobs.map((j) => j.company)).to.deep.eq(['Acme', 'Beta', 'Stripe']);
      expect(s.jobs[0].role).to.eq('Lead Developer');
      expect(s.jobs[1]).to.deep.eq(job('job_b', 'Beta', 'Designer'));
      expect(s.jobs[2].resumeId).to.eq(resumes.activeId);
    });
    // The résumés are untouched — only stamped with the data version they were loaded as.
    cy.store().should((s) => expect(s.resumes).to.deep.eq(resumes.resumes.map((r) => ({ ...r, dataVersion: DATA_VERSION }))));
  });

  it('M14: a job added or edited while storage is full stays in the tracker, which says it is not saved', () => {
    cy.seedAndVisit('/#/jobs', null);
    stat('Total').should('have.text', '1');
    fillStorage();

    cy.contains('button', 'Add Job').click();
    formField('Company').type('Stripe');
    cy.contains('button', /^Add Job$/).click();
    cy.contains('h1', 'Stripe').should('be.visible');

    goTo('#/jobs/demo_1/edit');
    formField('Role / Position').clear().type('Staff Frontend Engineer');
    cy.contains('button', 'Save Changes').first().click();
    cy.contains('Staff Frontend Engineer').should('be.visible');

    goTo('#/jobs');
    stat('Total').should('have.text', '2');
    cy.contains('Stripe').should('be.visible');
    cy.contains('Staff Frontend Engineer').should('be.visible');
    cy.contains('[role="alert"]', 'not being saved').should('be.visible');
    // Storage still holds the list from before: nothing half-written.
    cy.jobStore().its('jobs').should('have.length', 1);
  });

  it('M14: a list another tab saved is taken over, so a change here does not write over it', () => {
    cy.seedAndVisit('/#/jobs', null);
    stat('Total').should('have.text', '1');
    // The other tab adds a job: its write lands in storage and fires a storage event here.
    cy.jobStore().should('not.be.null').then((s) => cy.window().then((win) => {
      const value = JSON.stringify({ ...s, jobs: [...s.jobs, job('job_other', 'Other Tab Inc', 'Engineer')] });
      win.localStorage.setItem(JOBS_KEY, value);
      win.dispatchEvent(new win.StorageEvent('storage', { key: JOBS_KEY, newValue: value }));
    }));
    stat('Total').should('have.text', '2');
    cy.on('window:confirm', () => true);
    cy.contains('p', /^Google$/).closest('.rounded-xl').find('button[title="Delete application"]').click({ force: true });
    stat('Total').should('have.text', '1');
    cy.jobStore().its('jobs').should((jobs) => expect(jobs.map((j) => j.company)).to.deep.eq(['Other Tab Inc']));
  });

  it('M14: the job pages list the résumés the app holds, including ones it gets after the page opened', () => {
    // A demo account's samples arrive once its (local-only, in e2e) sync is known — after the page mounted.
    cy.visit('/#/jobs/new', {
      onBeforeLoad(win) {
        win.localStorage.clear();
        win.localStorage.setItem('cpwtcv_e2e_user', JSON.stringify(OWNER));
      },
    });
    cy.store().its('resumes').should('have.length', SAMPLES.length);
    formField('Resume Used').find('option').should(($o) => {
      expect([...$o].map((o) => o.textContent)).to.deep.eq(['— Not linked yet —', ...SAMPLES]);
    });

    cy.visit('/#/jobs', {
      onBeforeLoad(win) {
        win.localStorage.clear();
        win.localStorage.setItem('cpwtcv_e2e_user', JSON.stringify(OWNER));
      },
    });
    cy.contains('p', 'Career History').next().should('contain.text', 'Jordan Rivera');
  });
});

describe('regressions — the Add Job form and its saved interview stages', () => {
  const STAGES_KEY = 'cpwtcv_job_stages_v1';

  it('a full localStorage does not blank the form; a custom stage still applies to the job', () => {
    cy.visit('/#/jobs', {
      onBeforeLoad(win) {
        win.localStorage.clear();
        const original = win.Storage.prototype.setItem;
        win.Storage.prototype.setItem = function setItem(key, value) {
          if (key === STAGES_KEY) throw new win.DOMException('The quota has been exceeded.', 'QuotaExceededError');
          return original.call(this, key, value);
        };
      },
    });
    cy.contains('button', 'Add Job').click();
    cy.contains('h1', 'Add Job Application').should('be.visible');
    formField('Company').type('Stripe');
    cy.get('input[placeholder^="e.g."]').type('Culture Round');
    cy.contains('button', /^\s*Add$/).click();
    cy.contains('button', 'Culture Round').should('be.visible');
    cy.contains('button', /^Add Job$/).click();
    cy.contains('h1', 'Stripe').should('be.visible');
    cy.jobStore().should((s) => expect(s.jobs.find((j) => j.company === 'Stripe').stage).to.eq('Culture Round'));
  });

  it('an unreadable saved stage list does not blank the form', () => {
    cy.visit('/#/jobs/new', {
      onBeforeLoad(win) {
        win.localStorage.clear();
        win.localStorage.setItem(STAGES_KEY, '{"not":"a list"}');
      },
    });
    cy.contains('h1', 'Add Job Application').should('be.visible');
    cy.contains('No custom stages yet').should('be.visible');
  });
});
