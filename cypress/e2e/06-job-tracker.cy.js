/** The number shown beside a stat label ("Total", "Active", "Interviews", "Offers"). */
const stat = (label) => cy.contains('span', new RegExp(`^${label}$`)).prev('span');
const search = () => cy.get('input[placeholder^="Search company"]');
const formField = (label) => cy.contains('label', label).parent().find('input, select, textarea').first();

describe('job tracker', () => {
  beforeEach(() => {
    cy.seedAndVisit('/#/jobs', null);
    cy.contains('h1', 'Job Tracker').should('be.visible');
  });

  it('seeds one demo application with matching stats', () => {
    stat('Total').should('have.text', '1');
    stat('Interviews').should('have.text', '1');
    stat('Offers').should('have.text', '0');
    cy.contains('Google').should('be.visible');
    cy.jobStore().its('jobs').should('have.length', 1);
  });

  it('adds a job through the form; Add Job needs a company or a role', () => {
    cy.contains('button', /^Add job$/).click(); // the page header's (the top bar's reads "Add job" twice, for phones)
    cy.location('hash').should('eq', '#/jobs/new');
    cy.contains('button', /^Add Job$/).should('be.disabled');
    formField('Company').type('Stripe');
    formField('Role / Position').type('Backend Engineer');
    formField('Application Status').select('offer');
    cy.contains('button', /^Add Job$/).click();
    cy.location('hash').should('match', /^#\/jobs\/job_[\w-]+$/);
    cy.contains('h1', 'Stripe').should('be.visible');
    cy.jobStore().should((s) => {
      expect(s.jobs).to.have.length(2);
      const job = s.jobs.find((j) => j.company === 'Stripe');
      expect(job.role).to.eq('Backend Engineer');
      expect(job.status).to.eq('offer');
      expect(job.statusHistory.map((h) => h.status)).to.deep.eq(['offer']);
    });
    cy.visit('/#/jobs');
    stat('Offers').should('have.text', '1');
    stat('Total').should('have.text', '2');
  });

  it('search filters by company, role and location', () => {
    search().type('mountain view');
    cy.contains('1 result').should('be.visible');
    search().clear().type('no such company');
    cy.contains('0 results').should('be.visible');
    cy.contains('Google').should('not.exist');
  });

  it('a status chip filters the board and toggles off again', () => {
    cy.contains('button', /^Interview 1$/).click();
    cy.contains('1 result').should('be.visible');
    cy.contains('button', /^Interview 1$/).click();
    cy.contains(/\d+ results?/).should('not.exist');
  });

  it('list view shows the same applications', () => {
    cy.get('button[title="List view"]:visible').click(); // one toggle for phones, one from md up
    cy.get('table').should('contain.text', 'Google').and('contain.text', 'Senior Frontend Engineer');
  });

  it('opening a card shows its detail page; editing keeps the status history', () => {
    cy.contains('Senior Frontend Engineer').click();
    cy.location('hash').should('eq', '#/jobs/demo_1');
    cy.get('button[title="Edit job"]').click();
    cy.location('hash').should('eq', '#/jobs/demo_1/edit');
    formField('Role / Position').clear().type('Staff Frontend Engineer');
    cy.contains('button', 'Save Changes').first().click();
    cy.location('hash').should('eq', '#/jobs/demo_1');
    cy.contains('Staff Frontend Engineer').should('be.visible');
    cy.jobStore().should((s) => {
      const job = s.jobs.find((j) => j.id === 'demo_1');
      expect(job.role).to.eq('Staff Frontend Engineer');
      expect(job.statusHistory).to.have.length(4);
    });
  });

  it('deleting from the detail page asks first, then removes the job — and Undo brings it back', () => {
    const del = () => {
      cy.get('button[aria-label="Job actions"]').click();
      cy.contains('[role="menuitem"]', 'Delete').click();
    };
    cy.visit('/#/jobs/demo_1');
    del();
    cy.contains('[role="alertdialog"] button', 'Cancel').click();
    cy.location('hash').should('eq', '#/jobs/demo_1');
    cy.jobStore().its('jobs').should('have.length', 1);

    del();
    cy.contains('[role="alertdialog"] button', /^Delete$/).click();
    cy.location('hash').should('eq', '#/jobs');
    cy.jobStore().its('jobs').should('have.length', 0);
    cy.contains('button', 'Undo').click();
    cy.jobStore().its('jobs').should('have.length', 1);
  });

  it('Clear all jobs empties the tracker only after confirmation', () => {
    const clear = () => {
      cy.get('button[aria-label="More job actions"]').click();
      cy.contains('[role="menuitem"]', 'Clear all jobs').click();
    };
    clear();
    cy.contains('[role="alertdialog"] button', 'Cancel').click();
    stat('Total').should('have.text', '1');
    clear();
    cy.contains('[role="alertdialog"] button', 'Clear all jobs').click();
    stat('Total').should('have.text', '0');
  });

  // Import merges (J-04, src/utils/jobImport.js mergeImport): a job already in the tracker is
  // skipped, never duplicated; one whose id is not here is added under that id; one with an id that
  // is here, different, and no time to tell which is newer is added as a copy under a fresh id —
  // nothing is dropped.
  it('Export JSON downloads the jobs as JSON; importing it back adds nothing, other jobs are added', () => {
    cy.task('clearDownloads');
    cy.contains('button', /^\s*Export JSON\s*$/).click(); // beside Export CSV (29-exports-imports)
    cy.task('waitForDownload', { ext: '.json' }).then((file) => {
      expect(file).to.match(/job_applications\.json$/);
      cy.task('readTextFile', file).then((raw) => {
        const exported = JSON.parse(raw);
        cy.jobStore().then((s) => expect(exported).to.deep.eq(s.jobs));
        const importJobs = (jobs, fileName) => cy.get('input[type="file"][accept=".json"]').selectFile({
          contents: Cypress.Buffer.from(JSON.stringify(jobs)), fileName,
        }, { force: true });

        importJobs(exported, 'job_applications.json');
        cy.contains('Nothing new: the job application in that file is already in the tracker.').should('be.visible');
        cy.jobStore().its('jobs').should('have.length', 1);

        const [google] = exported;
        importJobs([
          { ...google, id: 'job_from_elsewhere', company: 'Initech' },
          // The same id as the job here, and no createdAt / updatedAt (JSON leaves undefined out).
          { ...google, company: 'Hooli', createdAt: undefined, updatedAt: undefined },
        ], 'other.json');
        cy.contains('Imported 2 job applications.').should('be.visible');
        cy.jobStore().should((s) => {
          expect(s.jobs.map((j) => j.company)).to.deep.eq(['Google', 'Initech', 'Hooli']);
          const [here, elsewhere, copy] = s.jobs.map((j) => j.id);
          expect(here).to.eq(google.id);
          expect(elsewhere, 'an id not here yet is kept').to.eq('job_from_elsewhere');
          expect(copy, 'the copy has an id of its own').to.match(/^job_./).and.not.eq(google.id);
        });
        stat('Total').should('have.text', '3');
      });
    });
  });

  it('the brand returns to the résumés dashboard', () => {
    cy.get('a[aria-label="CPWT-CV — résumés"]').first().click(); // the brand, at the top left of the workspace
    cy.location('hash').should('eq', '#/');
  });
});
