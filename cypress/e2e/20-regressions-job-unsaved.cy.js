// Regression test: a job that storage refused, when another tab saves the job list (R6-2). The
// job store took the other tab's list as it was, so the job this tab could not save was gone —
// "Job not found." on its own page — while the alert still said the changes were not saved.
const JOBS_KEY = 'cpwtcv_jobs_v1';

const job = (id, company, role, status = 'applied') => ({
  id, company, role, status, url: '', location: '', salary: '', contact: '', resumeId: '', notes: '',
  appliedDate: '2026-09-01', deadline: '', todos: [],
  statusHistory: [{ status, changedAt: 1757000000000 }], createdAt: 1757000000000, updatedAt: 1757000000000,
});
const formField = (label) => cy.contains('label', label).parent().find('input, select, textarea').first();
const stat = (label) => cy.contains('span', new RegExp(`^${label}$`)).prev('span');
/** In-app navigation: a hash change, no reload — the pages keep whatever the app holds in memory. */
const goTo = (hash) => cy.window().then((win) => { win.location.hash = hash; });

describe('regressions — a job storage refused, when another tab saves (R6-2)', () => {
  it('R6-2: a list another tab saves keeps the job this tab could not save, which is saved once there is room', () => {
    cy.seedAndVisit('/#/jobs', null);
    stat('Total').should('have.text', '1');
    // The demo job saved first: the board can show it before the store's first write, and storage
    // made full before that write refuses it too — then there is no list for the other tab to read.
    cy.jobStore().its('jobs').should('have.length', 1);
    const storage = { full: true };
    cy.window().then((win) => {
      const original = win.Storage.prototype.setItem;
      cy.stub(win.Storage.prototype, 'setItem').callsFake(function setItem(key, value) {
        if (key === JOBS_KEY && storage.full) throw new win.DOMException('The quota has been exceeded.', 'QuotaExceededError');
        return original.call(this, key, value);
      });
      // The other tab's write fits (it adds little, or deletes), and fires a storage event here.
      storage.otherTab = (change) => {
        const value = JSON.stringify({ dataVersion: 2, jobs: change(JSON.parse(win.localStorage.getItem(JOBS_KEY)).jobs) });
        original.call(win.localStorage, JOBS_KEY, value);
        win.dispatchEvent(new win.StorageEvent('storage', { key: JOBS_KEY, newValue: value }));
      };
    });
    cy.contains('button', /^Add job$/).click(); // the page header's (the top bar's reads "Add job" twice, for phones)
    formField('Company').type('Stripe');
    cy.contains('button', /^Add Job$/).click();
    cy.contains('h1', 'Stripe').should('be.visible');

    cy.then(() => storage.otherTab((jobs) => [...jobs, job('job_other', 'Other Tab Inc', 'Engineer')]));
    cy.contains('span', /^Apps$/).prev('span').should('have.text', '3'); // before: 2, the list taken as it was
    cy.contains('h1', 'Stripe').should('be.visible'); // before: "Job not found."
    cy.contains('[role="alert"]', 'not being saved').should('be.visible');
    goTo('#/jobs');
    stat('Total').should('have.text', '3');

    // Room again: the other tab deletes the demo job; this one takes that, and saves Stripe with it.
    cy.then(() => { storage.full = false; storage.otherTab((jobs) => jobs.filter((j) => j.id !== 'demo_1')); });
    stat('Total').should('have.text', '2');
    cy.contains('[role="alert"]', 'not being saved').should('not.exist');
    cy.jobStore().its('jobs').should((jobs) => expect(jobs.map((j) => j.company)).to.deep.eq(['Other Tab Inc', 'Stripe']));
  });
});
