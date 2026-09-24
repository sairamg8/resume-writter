// Regression tests: a job from an imported file (another tool's, a hand-made one) or from an older
// build's save lacks what the job pages address it by — a to-do's id (VM4-2), a status the board
// has a column for (VM4-4). Its to-dos used to share one identity, so ticking or deleting one
// ticked or deleted them all; the job itself was on no column of the board.
const JOBS_KEY = 'cpwtcv_jobs_v1';

const stat = (label) => cy.contains('span', new RegExp(`^${label}$`)).prev('span');
/** In-app navigation: a hash change, no reload — the pages keep whatever the app holds in memory. */
const goTo = (hash) => cy.window().then((win) => { win.location.hash = hash; });
const visitWithJobs = (jobs) => cy.visit('/#/jobs', {
  onBeforeLoad(win) {
    win.localStorage.clear();
    win.localStorage.setItem(JOBS_KEY, JSON.stringify({ dataVersion: 2, jobs }));
  },
});
const importFile = (list) => cy.get('input[type="file"][accept=".json"]').selectFile({
  contents: Cypress.Buffer.from(JSON.stringify(list)), fileName: 'jobs.json',
}, { force: true });
/** The rows of the Tasks tab's "To Do" list; a row is [tick button, text, delete button]. */
const pendingRows = () => cy.contains('p', /^To Do$/).next().children();
const todoRow = (text) => pendingRows().filter((i, el) => el.textContent === text);
const backups = (win) => Object.keys(win.localStorage).filter((k) => k.startsWith(`${JOBS_KEY}_backup_`));

describe('regressions — to-dos with no id, a shared id or no text (VM4-2)', () => {
  it('imported to-dos with no ids: ticking or deleting one leaves the others; nothing is said to be lost', () => {
    visitWithJobs([]);
    importFile([{ company: 'Acme', role: 'Dev', status: 'applied', todos: [{ text: 'Call A' }, { text: 'Email B', done: true }, { text: 'Send CV' }] }]);
    stat('Total').should('have.text', '1');
    cy.contains('p', /^Acme$/).should('be.visible');
    cy.contains('[role="alert"]', 'left out').should('not.exist'); // the ids are made, not lost
    cy.jobStore().then((s) => goTo(`#/jobs/${s.jobs[0].id}`));
    cy.contains('h1', 'Acme').should('be.visible');

    // Before: every to-do's id was undefined, so ticking one ticked all three.
    todoRow('Send CV').find('button').first().click();
    cy.contains('2 / 3 complete').should('be.visible');
    pendingRows().should('have.length', 1).and('have.text', 'Call A');
    // Before: deleting one deleted every to-do.
    todoRow('Call A').find('button').last().click({ force: true });
    cy.contains('2 / 2 complete').should('be.visible');
    cy.jobStore().should((s) => {
      const todos = s.jobs[0].todos;
      expect(todos.map((t) => t.text)).to.deep.eq(['Email B', 'Send CV']);
      todos.forEach((t) => expect(t.id).to.match(/^td_./));
      expect(new Set(todos.map((t) => t.id)).size).to.eq(2);
    });
  });

  it('saved to-dos sharing one id each stay their own — given an id, which loses nothing, so nothing is reported', () => {
    const acme = {
      id: 'job_a', company: 'Acme', role: 'Dev', status: 'applied',
      todos: [{ id: 't1', text: 'Call A' }, { id: 't1', text: 'Email B' }, { id: 't2', text: 'Ring C' }],
    };
    visitWithJobs([acme]);
    stat('Total').should('have.text', '1');
    cy.contains('[role="alert"]', 'could not be read').should('not.exist');
    cy.window().then((win) => expect(backups(win)).to.deep.eq([]));
    goTo('#/jobs/job_a');
    cy.contains('h1', 'Acme').should('be.visible');
    // Before: deleting 'Call A' deleted 'Email B' too (both t1).
    todoRow('Call A').find('button').last().click({ force: true });
    pendingRows().should('have.length', 2);
    cy.jobStore().should((s) => {
      const todos = s.jobs[0].todos;
      expect(todos.map((t) => t.text)).to.deep.eq(['Email B', 'Ring C']);
      expect(todos[1].id).to.eq('t2', 'an id no earlier to-do has is kept');
      expect(todos[0].id).to.match(/^td_./);
    });
  });

  it('a saved to-do with no text is left out, and the notice says so — it showed as a blank row that threw on edit', () => {
    visitWithJobs([{ id: 'job_a', company: 'Acme', role: 'Dev', status: 'applied', todos: [{ id: 't1', text: 'Call A' }, { id: 't2', done: false }] }]);
    cy.contains('[role="alert"]', 'job list could not be read').should('be.visible');
    goTo('#/jobs/job_a');
    cy.contains('h1', 'Acme').should('be.visible');
    // Before: a second, blank row (text undefined); leaving its edit box threw "reading 'trim'".
    pendingRows().should('have.length', 1).and('have.text', 'Call A');
    cy.jobStore().its('jobs.0.todos').should('deep.eq', [{ id: 't1', text: 'Call A' }]);
  });
});

describe('regressions — a status the board has no column for (VM4-4)', () => {
  it('saved jobs whose status is in another case, unknown or missing are on the board', () => {
    visitWithJobs([
      { id: 'job_a', company: 'Delta', role: 'Dev', status: 'Applied' },
      { id: 'job_b', company: 'Echo', role: 'QA', status: 'Phone Screen' },
      { id: 'job_c', company: 'Foxtrot', role: 'PM', status: 'ghosted' },
      { id: 'job_d', company: 'Golf', role: 'Ops' }, // imported with no status by a build before this one
    ]);
    // Before: Total 4, and the board showed none of them.
    stat('Total').should('have.text', '4');
    cy.contains('#kanban-col-applied', 'Delta').should('be.visible');
    cy.contains('#kanban-col-phone_screen', 'Echo').should('be.visible');
    cy.contains('#kanban-col-saved', 'Foxtrot').should('be.visible');
    cy.contains('#kanban-col-saved', 'Golf').should('be.visible');
    cy.jobStore().should((s) => {
      expect(s.jobs.map((j) => j.status)).to.deep.eq(['applied', 'phone_screen', 'saved', 'saved']);
    });
    // 'ghosted' was replaced: said, and the original kept.
    cy.contains('[role="alert"]', 'job list could not be read').should('be.visible');
    cy.window().then((win) => expect(backups(win)).to.have.length(1));
  });

  it('an imported job with a status in another case goes to its column; an unknown one to Saved, and the import says so', () => {
    visitWithJobs([]);
    importFile([{ company: 'Hotel', status: 'OFFER' }, { company: 'India', status: 'On Hold' }]);
    stat('Total').should('have.text', '2');
    cy.contains('#kanban-col-offer', 'Hotel').scrollIntoView().should('be.visible'); // past the first columns
    cy.contains('#kanban-col-on_hold', 'India').scrollIntoView().should('be.visible'); // the board scrolls sideways
    cy.contains('[role="alert"]', 'left out').should('not.exist');
    importFile([{ company: 'Juliet', status: 'ghosted' }]);
    stat('Total').should('have.text', '3');
    cy.contains('#kanban-col-saved', 'Juliet').scrollIntoView().should('be.visible');
    cy.contains('[role="alert"]', 'Imported 1 job application; what could not be read in the file was left out').should('be.visible');
  });
});
