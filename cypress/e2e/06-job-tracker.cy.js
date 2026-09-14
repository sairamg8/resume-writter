/** The number shown beside a stat label ("Total", "Active", "Interviews", "Offers"). */
const stat = (label) => cy.contains('span', new RegExp(`^${label}$`)).prev('span');
const search = () => cy.get('input[placeholder^="Search company"]');
const formField = (label) => cy.contains('label', label).parent().find('input, select, textarea').first();

describe('job tracker', () => {
  beforeEach(() => {
    cy.seedAndVisit('/#/jobs', null);
    cy.contains('span', 'Job Tracker').should('be.visible');
  });

  it('seeds one demo application with matching stats', () => {
    stat('Total').should('have.text', '1');
    stat('Interviews').should('have.text', '1');
    stat('Offers').should('have.text', '0');
    cy.contains('Google').should('be.visible');
    cy.jobStore().its('jobs').should('have.length', 1);
  });

  it('adds a job through the form; Add Job needs a company or a role', () => {
    cy.contains('button', 'Add Job').click();
    cy.location('hash').should('eq', '#/jobs/new');
    cy.contains('button', /^Add Job$/).should('be.disabled');
    formField('Company').type('Stripe');
    formField('Role / Position').type('Backend Engineer');
    formField('Application Status').select('offer');
    cy.contains('button', /^Add Job$/).click();
    cy.location('hash').should('match', /^#\/jobs\/job_\d+$/);
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
    cy.get('button[title="List view"]').click();
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

  it('deleting from the detail page asks first, then removes the job', () => {
    let answer = false; // Cypress keeps every window:confirm listener, so flip one answer instead
    cy.on('window:confirm', () => answer);
    cy.visit('/#/jobs/demo_1');
    cy.get('button[title="Delete"]').click();
    cy.location('hash').should('eq', '#/jobs/demo_1');
    cy.jobStore().its('jobs').should('have.length', 1);

    cy.then(() => { answer = true; });
    cy.get('button[title="Delete"]').click();
    cy.location('hash').should('eq', '#/jobs');
    cy.jobStore().its('jobs').should('have.length', 0);
  });

  it('Clear empties the tracker only after confirmation', () => {
    let answer = false;
    cy.on('window:confirm', () => answer);
    cy.get('button[title="Clear all job data"]').click();
    stat('Total').should('have.text', '1');
    cy.then(() => { answer = true; });
    cy.get('button[title="Clear all job data"]').click();
    stat('Total').should('have.text', '0');
  });

  it('Export downloads the jobs as JSON; Import adds them back with fresh ids', () => {
    cy.task('clearDownloads');
    cy.contains('button', /^\s*Export\s*$/).click();
    cy.task('waitForDownload', { ext: '.json' }).then((file) => {
      expect(file).to.match(/job_applications\.json$/);
      cy.task('readTextFile', file).then((raw) => {
        const exported = JSON.parse(raw);
        cy.jobStore().then((s) => expect(exported).to.deep.eq(s.jobs));
        cy.get('input[type="file"][accept=".json"]').selectFile({
          contents: Cypress.Buffer.from(raw), fileName: 'job_applications.json',
        }, { force: true });
        cy.jobStore().should((s) => {
          expect(s.jobs).to.have.length(2);
          expect(new Set(s.jobs.map((j) => j.id)).size).to.eq(2);
        });
        stat('Total').should('have.text', '2');
      });
    });
  });

  it('the back arrow returns to the dashboard', () => {
    cy.get('button[title="Back to dashboard"]').click();
    cy.location('hash').should('eq', '#/');
  });
});
