import { buildTestState, STORAGE_KEY } from '../../tests/helpers.js';

// Stored XSS: an imported résumé or job file (or a synced one) must never run script, and
// pasted content must reach the editor as plain formatting only.
const PAYLOAD = '<img src="x" onerror="window.__xss = (window.__xss || 0) + 1">';

const job = (over) => ({
  id: `job_${Math.random().toString(36).slice(2)}`, company: 'Acme', role: 'Engineer', status: 'applied',
  url: '', location: '', salary: '', appliedDate: '2026-09-01', deadline: '', contact: '', notes: '',
  todos: [], statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt: 1, ...over,
});

function visitJobs(jobs) {
  cy.visit('/#/jobs', {
    onBeforeLoad(win) {
      win.localStorage.clear();
      win.localStorage.setItem('cpwtcv_jobs_v1', JSON.stringify({ jobs, dataVersion: 2 }));
    },
  });
  cy.contains('span', 'Job Tracker').should('be.visible');
}

describe('security regressions', () => {
  it('a résumé whose rich text carries an <img onerror> does not run it in the editor', () => {
    const state = buildTestState('classic');
    const resume = state.resumes[0];
    resume.personal.summary = `<p>Summary text</p>${PAYLOAD}`;
    resume.sections[0].items[0].description = `<p>Duties</p>${PAYLOAD}<script>window.__xss = 99</script>`;
    cy.seedAndVisit(`/#/resume/${state.activeId}`, state);
    cy.previewReady();
    cy.contains('[contenteditable]', 'Summary text').scrollIntoView().should('be.visible');
    cy.get('[contenteditable] img').should('not.exist');
    cy.window().its('__xss').should('be.undefined');
    cy.window().then((win) => {
      expect(JSON.parse(win.localStorage.getItem(STORAGE_KEY)).resumes[0].personal.summary).to.contain('Summary text');
    });
  });

  it('job notes print as text on the board and in the notes editor', () => {
    const j = job({ company: 'NotesCo', notes: `<p>Call recruiter</p>${PAYLOAD}` });
    visitJobs([j]);
    cy.contains('NotesCo').should('be.visible');
    cy.contains('Call recruiter').should('be.visible');
    cy.get('img[src="x"]').should('not.exist');
    cy.visit(`/#/jobs/${j.id}`);
    cy.contains('button', 'Notes').click();
    cy.contains('[contenteditable]', 'Call recruiter').should('be.visible');
    cy.get('[contenteditable] img').should('not.exist');
    cy.window().its('__xss').should('be.undefined');
  });

  it('job links: bare domains open https, script URLs are not links', () => {
    visitJobs([
      job({ company: 'BareCo', url: 'linkedin.com/jobs/view/1' }),
      job({ company: 'ScriptCo', url: 'javascript:window.__xss=1' }),
    ]);
    cy.get('a[href="https://linkedin.com/jobs/view/1"]').should('exist');
    cy.get('a[href^="javascript:"]').should('not.exist');
  });

  it('pasting from Google Docs keeps bold but drops colours, fonts and backgrounds', () => {
    const state = buildTestState('classic');
    state.resumes[0].personal.summary = '';
    cy.seedAndVisit(`/#/resume/${state.activeId}`, state);
    cy.previewReady();
    cy.get('[contenteditable]').first().as('summary').click().then(($el) => {
      const dt = new DataTransfer();
      dt.setData('text/html', '<b style="font-weight:normal" id="docs-internal-guid-1"><span style="color:#ffffff;background-color:#000000;font-family:Arial">White on black </span><span style="font-weight:700">bold</span></b>');
      dt.setData('text/plain', 'White on black bold');
      $el[0].dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    cy.get('@summary').should('contain.text', 'White on black bold');
    cy.get('@summary').invoke('html').should((html) => {
      expect(html).not.to.match(/style=|color|font-family|<span|<b /);
      expect(html).to.match(/<strong>bold<\/strong>/);
    });
    cy.store().its('resumes.0.personal.summary').should('contain', '<strong>bold</strong>').and('not.contain', 'color');
  });
});
