// Every control the app shows has an accessible name (audit main-loop notes M8, M9): each field a
// label or an aria name — never just a placeholder — and each <label> names its control. The
// pages are opened with every optional control showing: a photo, a custom contact icon, open
// entries and options, custom fonts, a filtered job board, a job with tasks.
import { buildTestState, STORAGE_KEY } from '../../tests/helpers.js';
import { CARD, CARD_RENAME, ENTRY_HEADER } from '../support/selectors.js';
import { dashboardState } from '../support/state.js';
import { unlabelledFields } from '../support/a11y.js';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** Open `url` with this résumé store, job list, custom interview stages and custom fonts. */
function visitWith(url, { state = null, jobs = null, stages = null, fonts = null } = {}) {
  cy.visit(url, {
    onBeforeLoad(win) {
      win.localStorage.clear();
      if (state) win.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (jobs) win.localStorage.setItem('cpwtcv_jobs_v1', JSON.stringify({ dataVersion: 2, jobs }));
      if (stages) win.localStorage.setItem('cpwtcv_job_stages_v1', JSON.stringify(stages));
      if (fonts) win.localStorage.setItem('cpwtcv_custom_fonts', JSON.stringify(fonts));
    },
  });
}

/** A résumé that shows every optional control: photos, a custom icon, colours set, inline header. */
function richState(template = 'classic') {
  const state = buildTestState(template, {
    headerLayout: 'inline', customContactIcons: { email: PNG }, sectionBorderColor: '#123456',
    nameColor: '#222222', jobTitleColor: '#333333', headerTextColor: '#eeeeee', sidebarBg: '#0f2744',
  });
  const resume = state.resumes[0];
  resume.personal = { ...resume.personal, photo: PNG };
  resume.coverLetter = { ...resume.coverLetter, clPhoto: PNG };
  return state;
}

const ACME = {
  id: 'job_acme', company: 'Acme', role: 'Engineer', status: 'applied', stage: 'Phone Screen',
  url: 'https://acme.example.com/jobs/1', location: 'Remote', salary: '$150k', contact: 'Sam',
  resumeId: 'test_classic', notes: '<p>Call back</p>', appliedDate: '2026-09-01', deadline: '2026-12-01',
  todos: [{ id: 't1', text: 'Prepare', done: false }, { id: 't2', text: 'Apply', done: true }],
  statusHistory: [{ status: 'applied', changedAt: 1757000000000 }], createdAt: 1757000000000, updatedAt: 1757000000000,
};

/** Each page in the state that shows the most controls. */
const PAGES = {
  'dashboard'() {
    cy.visitDashboard(dashboardState());
  },
  'dashboard, renaming a résumé'() {
    cy.visitDashboard(dashboardState());
    cy.get(CARD).first().find(CARD_RENAME).click({ force: true });
    cy.get(CARD).first().find('input').should('be.visible');
  },
  'editor, Resume tab with every entry and option open'() {
    const state = richState();
    visitWith(`/#/resume/${state.activeId}`, { state });
    cy.previewReady();
    cy.contains('button', 'Header Customization').click();
    cy.contains('button', /^Photo/).click();
    cy.get(ENTRY_HEADER).click({ multiple: true });
    cy.get('input[value="Professional Experience"]').parent().find('button[title="Section options"]').click();
    cy.contains('button', 'Customize layout').click();
    cy.contains('button', 'Add Section').click();
    cy.contains('p', 'Section Options').should('exist');
    // Opened: entry fields, month pickers, rich text, header steppers, the options' own fields.
    ['Institution', 'Start Date', 'Description', 'Before', 'Company'].forEach((l) => cy.contains('label', l).should('exist'));
    cy.get('input[type="number"]').should('have.length.at.least', 4);
  },
  'editor header: Export menu, then renaming'() {
    cy.visitEditor('classic');
    cy.contains('button', 'Export').click();
    cy.contains('button', 'Import JSON').should('be.visible');
    cy.get('button[title="Rename resume"]').click();
    cy.focused().should('have.prop', 'tagName', 'INPUT');
  },
  'editor, Design tab with every section open (Sidebar, custom fonts)'() {
    const state = richState('sidebar');
    visitWith(`/#/resume/${state.activeId}?tab=design`, { state, fonts: ['Nunito'] });
    ['Colors', 'Typography', 'Spacing', 'Section Headings'].forEach((title) => cy.contains('button', new RegExp(`^${title}$`)).click());
    cy.contains('Sidebar Background').should('exist');
    cy.contains('span', 'Between Sections').should('exist');
    cy.contains('button', 'Nunito').should('exist');
  },
  'editor, Cover Letter tab'() {
    const state = richState();
    visitWith(`/#/resume/${state.activeId}?tab=coverletter`, { state });
    cy.contains('p', 'Letter Body').should('exist');
  },
  'job tracker, filtered board'() {
    visitWith('/#/jobs', { state: buildTestState('classic'), jobs: [ACME] });
    cy.get('input[placeholder^="Search company"]').type('acme');
    cy.contains('button', /^Applied 1$/).click();
    cy.contains('1 result').should('be.visible');
  },
  'job tracker, list view'() {
    visitWith('/#/jobs', { state: buildTestState('classic'), jobs: [ACME] });
    cy.get('button[title="List view"]:visible').click(); // one toggle for phones, one from md up
    cy.get('table').should('contain.text', 'Acme');
  },
  'Add Job form with custom stages'() {
    visitWith('/#/jobs/new', { state: buildTestState('classic'), stages: ['Culture Round'] });
    cy.contains('button', 'Culture Round').should('be.visible');
  },
  'job detail: tasks, overview with a field being edited, notes'() {
    visitWith('/#/jobs/job_acme', { state: buildTestState('classic'), jobs: [ACME] });
    cy.contains('Prepare').should('be.visible');
  },
};

/** The job detail's other tabs, checked after its Tasks tab. */
function jobDetailTabs(check) {
  cy.contains('button', 'Overview').click();
  cy.contains('p', /^Company$/).parent().find('button').click({ force: true });
  cy.focused().should('have.prop', 'tagName', 'INPUT');
  check('job detail, Overview');
  cy.contains('button', 'Notes').click();
  cy.get('[contenteditable]').should('exist');
  check('job detail, Notes');
}

describe('M8 — every field has a name, every label names a field', () => {
  const check = (where) => cy.document().should((doc) => {
    expect(unlabelledFields(doc), `${where}: unlabelled fields and labels that name nothing`).to.deep.eq([]);
  });

  Object.entries(PAGES).forEach(([where, open]) => {
    it(where, () => {
      open();
      check(where);
      if (where.startsWith('job detail')) jobDetailTabs(check);
    });
  });

  it('a label click focuses its field (Cover Letter)', () => {
    PAGES['editor, Cover Letter tab']();
    ['Date', 'Recipient Name', 'Company', 'Subject', 'Closing Phrase', 'Signature Designation'].forEach((label) => {
      cy.contains('label', new RegExp(`^${label}$`)).click();
      cy.focused().should('have.prop', 'tagName', 'INPUT').and('have.attr', 'id');
      cy.contains('label', new RegExp(`^${label}$`)).invoke('attr', 'for').then((id) => cy.focused().should('have.attr', 'id', id));
    });
  });
});
