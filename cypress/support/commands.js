import { buildTestState, STORAGE_KEY } from '../../tests/helpers.js';
import { CARD } from './selectors.js';

/** Visit `url` with localStorage replaced by `state` (or emptied when state is null). */
Cypress.Commands.add('seedAndVisit', (url, state) => {
  cy.visit(url, {
    onBeforeLoad(win) {
      win.localStorage.clear();
      if (state) win.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
  });
});

/**
 * Open the editor on a seeded test resume.
 * opts: { settings, sections, state, tab }  — see tests/helpers.js buildTestState.
 */
Cypress.Commands.add('visitEditor', (template = 'classic', opts = {}) => {
  const state = opts.state || buildTestState(template, opts.settings || {}, opts.sections || null);
  const q = opts.tab ? `?tab=${opts.tab}` : '';
  cy.seedAndVisit(`/#/resume/${state.activeId}${q}`, state);
  cy.contains('button', 'Export').should('be.visible');
  cy.document().then((doc) => doc.fonts?.ready);
  return cy.wrap(state, { log: false });
});

Cypress.Commands.add('visitDashboard', (state = null) => {
  cy.seedAndVisit('/#/', state);
  cy.get(CARD).should('have.length.at.least', 1);
});

/** The off-screen single-flow preview (source of truth for canvas text). */
Cypress.Commands.add('preview', () => cy.get('#resume-preview'));

/** The visible paginated A4 pages. */
Cypress.Commands.add('previewPages', () => cy.get('div.bg-white.shadow-2xl'));

/**
 * Parsed app store from localStorage. A query, so `cy.store().its(...).should(...)` retries
 * until the app's persist effect has written the assertion's state.
 */
Cypress.Commands.addQuery('store', function store() {
  return () => JSON.parse(cy.state('window').localStorage.getItem(STORAGE_KEY) || 'null');
});

/** Parsed job-tracker store (`cpwtcv_jobs_v1`). A retrying query, like `store`. */
Cypress.Commands.addQuery('jobStore', function jobStore() {
  return () => JSON.parse(cy.state('window').localStorage.getItem('cpwtcv_jobs_v1') || 'null');
});

Cypress.Commands.add('openExportMenu', () => {
  cy.contains('button', 'Export').click();
});

/** Click an export menu entry and resolve with the downloaded file's path. */
Cypress.Commands.add('exportFile', (label, ext) => {
  cy.task('clearDownloads');
  cy.openExportMenu();
  cy.contains('button', new RegExp(`^\\s*${label.replace(/[()]/g, '\\$&')}\\s*$`)).click();
  return cy.task('waitForDownload', { ext }, { timeout: 60_000 }).then((file) => {
    expect(file, `a ${ext} file was downloaded`).to.be.a('string');
    return file;
  });
});

/** Export a PDF and resolve with it parsed: { numPages, width, height, info, runs, bytes, file }. */
Cypress.Commands.add('exportPdf', (label = 'Export PDF') =>
  cy.exportFile(label, '.pdf').then((file) =>
    cy.task('readPdf', file, { timeout: 60_000 }).then((pdf) => ({ ...pdf, file }))));

/** Export Word and resolve with { paragraphs, bytes, file }. */
Cypress.Commands.add('exportDocx', () =>
  cy.exportFile('Export Word', '.docx').then((file) =>
    cy.task('readDocx', file).then((docx) => ({ ...docx, file }))));
