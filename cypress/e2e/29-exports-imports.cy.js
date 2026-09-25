// The newer file formats end to end (R2-161): Markdown export, JSON Resume export and import (from
// the editor's Export menu and from the dashboard's Import), and the Job Tracker's CSV export. Each
// is a real download through the browser, read back from disk, or a real file handed to the page.
// Smoke level: the converters are pinned in tests/unit/markdown-export*.unit.mjs,
// json-resume*.unit.mjs and job-csv.unit.mjs; this checks the buttons reach them.
import { buildTestState, STORAGE_KEY } from '../../tests/helpers.js';
import { CARD, IMPORT_INPUT } from '../support/selectors.js';

const basename = (file) => file.split(/[\\/]/).pop();
const active = (s) => s.resumes.find((r) => r.id === s.activeId);
const TYPES = ['experience', 'education', 'skills', 'projects', 'languages', 'certifications', 'awards', 'volunteering', 'references', 'interests', 'custom'];

describe('résumé exports: Markdown and JSON Resume', () => {
  beforeEach(() => cy.visitEditor('classic'));

  it('Export Markdown (.md) downloads the résumé as Markdown, named after the person', () => {
    cy.exportFile('Export Markdown (.md)', '.md').then((file) => {
      expect(basename(file)).to.eq('Alex_Johnson_Full_Stack_Engineer.md');
      cy.task('readTextFile', file).then((md) => {
        const lines = md.split('\n');
        expect(lines[0]).to.eq('# Alex Johnson');
        expect(lines[1]).to.eq('**Full Stack Engineer**');
        expect(md).to.contain('[alex@example.com](mailto:alex@example.com)');
        ['## Professional Summary', '## Professional Experience', '## Education', '## Skills'].forEach((h) => expect(lines).to.include(h));
        // A job leads with the company, as Classic's PDF prints it with no Order set (R2-064).
        expect(md).to.contain('### **Acme Corp** — *Senior Dev*');
        expect(md).not.to.match(/<\/?(p|ul|li|strong|em)>/); // the rich text is Markdown, not HTML
      });
    });
  });

  it('Export JSON Resume (.json) downloads the jsonresume.org schema; Import JSON reads it back as a new résumé', () => {
    cy.exportFile('Export JSON Resume (.json)', '.json').then((file) => {
      expect(basename(file)).to.eq('Alex_Johnson_Full_Stack_Engineer_resume.json');
      cy.task('readTextFile', file).then((raw) => {
        const json = JSON.parse(raw);
        expect(json.$schema).to.match(/jsonresume\/resume-schema/);
        expect(json.basics).to.include({ name: 'Alex Johnson', label: 'Full Stack Engineer', email: 'alex@example.com' });
        expect(json.work[0]).to.include({ name: 'Acme Corp', position: 'Senior Dev' });
        expect(json.education[0].institution).to.eq('MIT');
        expect(json).not.to.have.property('sections'); // not the app's own backup shape

        // The same file, imported from the editor's Export menu.
        cy.openExportMenu();
        cy.get('input[type="file"][accept^=".json"]').selectFile({
          contents: Cypress.Buffer.from(raw), fileName: 'alex_resume.json', mimeType: 'application/json',
        }, { force: true });
        cy.location('hash').should('match', /^#\/resume\/resume_[\w-]+$/);
        cy.store().should((s) => {
          expect(s.resumes).to.have.length(2);
          const imported = active(s);
          expect(imported.id).not.to.eq('test_classic');
          expect(imported.personal).to.include({ name: 'Alex Johnson', title: 'Full Stack Engineer', email: 'alex@example.com' });
          expect(imported.sections.map((x) => x.type)).to.deep.eq(TYPES);
        });
        cy.get('#resume-preview', { timeout: 30_000 }).should('contain.text', 'Acme Corp').and('contain.text', 'MIT');
      });
    });
  });
});

describe('dashboard Import of a JSON Resume file', () => {
  const JSON_RESUME = {
    basics: { name: 'Jordan Rivers', label: 'Data Analyst', email: 'jordan@example.org', location: { city: 'Leeds', countryCode: 'GB' } },
    work: [{ name: 'Northwind', position: 'Analyst', startDate: '2021-03', highlights: ['Built the weekly sales dashboard'] }],
    education: [{ institution: 'University of Leeds', area: 'Statistics', studyType: 'BSc', startDate: '2017', endDate: '2020' }],
    skills: [{ name: 'Analysis', keywords: ['SQL', 'Python'] }],
  };

  it('opens it as a new résumé with its person, work, education and skills', () => {
    cy.visitDashboard(buildTestState('classic'));
    cy.get(IMPORT_INPUT).selectFile({
      contents: Cypress.Buffer.from(JSON.stringify(JSON_RESUME)), fileName: 'jordan.json', mimeType: 'application/json',
    }, { force: true });
    cy.location('hash').should('match', /^#\/resume\/resume_[\w-]+$/);
    cy.get('input[placeholder="John Doe"]').should('have.value', 'Jordan Rivers');
    cy.store().should((s) => {
      expect(s.resumes).to.have.length(2);
      const r = active(s);
      expect(r.personal).to.include({ name: 'Jordan Rivers', title: 'Data Analyst', email: 'jordan@example.org' });
      const types = r.sections.map((x) => x.type);
      expect(types).to.include.members(['experience', 'education', 'skills']);
    });
    cy.get('#resume-preview', { timeout: 30_000 })
      .should('contain.text', 'Northwind')
      .and('contain.text', 'University of Leeds')
      .and('contain.text', 'SQL');
    cy.get('button[title="Back to dashboard"]').click();
    cy.get(CARD).should('have.length', 2);
  });
});

describe('Job Tracker CSV export', () => {
  const JOBS_KEY = 'cpwtcv_jobs_v1';
  const job = (id, company, role, status, extra = {}) => ({
    id, company, role, status, url: '', location: '', salary: '', contact: '', resumeId: '', notes: '',
    appliedDate: '2026-09-01', deadline: '', todos: [],
    statusHistory: [{ status, changedAt: 1757000000000 }], createdAt: 1757000000000, updatedAt: 1757000000000, ...extra,
  });

  it('Export CSV downloads one row per job, with a header, ready for a spreadsheet', () => {
    cy.visit('/#/jobs', {
      onBeforeLoad(win) {
        win.localStorage.clear();
        win.localStorage.setItem(STORAGE_KEY, JSON.stringify(buildTestState('classic')));
        win.localStorage.setItem(JOBS_KEY, JSON.stringify({
          dataVersion: 2,
          jobs: [
            job('job_a', 'Acme', 'Developer', 'applied', { location: 'Leeds, UK' }),
            job('job_b', '=Beta "Labs"', 'Designer', 'offer'),
          ],
        }));
      },
    });
    cy.contains('span', 'Job Tracker').should('be.visible');
    cy.task('clearDownloads');
    cy.get('button[title="Export as spreadsheet CSV for Excel or Google Sheets"]').click();
    cy.task('waitForDownload', { ext: '.csv' }).then((file) => {
      expect(basename(file)).to.eq('job_applications.csv');
      cy.task('readTextFile', file).then((csv) => {
        expect(csv.charCodeAt(0), 'a byte-order mark for Excel').to.eq(0xfeff);
        const rows = csv.slice(1).split('\r\n');
        expect(rows).to.have.length(3);
        expect(rows[0]).to.match(/^"Company","Position","Status",/);
        expect(rows[1]).to.match(/^"Acme","Developer","Applied",/);
        expect(rows[1]).to.contain('"Leeds, UK"');
        // A company that starts with "=" stays text, and its quotes are doubled.
        expect(rows[2]).to.match(/^"'=Beta ""Labs""","Designer","Offer",/);
      });
    });
  });
});
