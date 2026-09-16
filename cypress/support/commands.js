import { buildTestState, STORAGE_KEY } from '../../tests/helpers.js';

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
  cy.previewReady();
  return cy.wrap(state, { log: false });
});

/** Open the dashboard with `state` in localStorage (null = a first visit: empty store). */
Cypress.Commands.add('visitDashboard', (state = null) => {
  cy.seedAndVisit('/#/', state);
  cy.contains('h1', 'My Resumes').should('be.visible');
});

/** Wait until the PDF preview has painted (it renders the exported PDF with pdf.js). */
Cypress.Commands.add('previewReady', () =>
  cy.get('[data-preview-status="ready"]', { timeout: 30_000 }));

/**
 * Text of the PDF preview's pages (hidden text node filled from pdf.js). It is the exported
 * PDF's own text, so it reflects real casing and only what the PDF prints.
 */
Cypress.Commands.add('preview', () => cy.get('#resume-preview'));

/** The visible preview pages (one canvas per PDF page). */
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

/**
 * Export a PDF and resolve with it parsed (cypress.config.js readPdf): { numPages, width, height,
 * info, runs, strokes, images, bytes, file } — strokes are the distinct stroke colours page 1
 * draws with, images the count of pictures it draws.
 */
Cypress.Commands.add('exportPdf', (label = 'Export PDF') =>
  cy.exportFile(label, '.pdf').then((file) =>
    cy.task('readPdf', file, { timeout: 60_000 }).then((pdf) => ({ ...pdf, file }))));

/** Export Word and resolve with { paragraphs, aligns, bytes, file } (aligns[i]: paragraph i's alignment or null). */
Cypress.Commands.add('exportDocx', () =>
  cy.exportFile('Export Word', '.docx').then((file) =>
    cy.task('readDocx', file).then((docx) => ({ ...docx, file }))));
