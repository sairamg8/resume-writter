// Importing a résumé PDF from another tool, end to end: a real PDF handed to the dashboard's Import is
// read by pdf.js in the browser, opens as a new résumé in the editor with the best-effort notice, and its
// name, contacts, jobs, school and skills are in the store and on the preview. The fixtures are small PDFs
// laid out as other tools do (tests/fixtures/foreign-pdfs; the reading itself is pinned, field by field, in
// tests/pdf/530-foreign-pdf-import.test.mjs): a Word-style page, a LaTeX page, a coloured side column on
// either side, a CV table with a date column, and a page from LibreOffice with table rows.
import { buildTestState } from '../../tests/helpers.js';
import { CARD, IMPORT_INPUT } from '../support/selectors.js';

const FIXTURES = 'tests/fixtures/foreign-pdfs';
const active = (s) => s.resumes.find((r) => r.id === s.activeId);
/** The editor's best-effort notice: a status region among others (the drag-and-drop live regions have the role too). */
const NOTICE = '[role="status"]';
const section = (r, type) => r.sections.find((x) => x.type === type);

/** Open the dashboard on a seeded résumé, hand the PDF `name` to Import, and wait for the new résumé's editor. */
function importPdf(name) {
  cy.visitDashboard(buildTestState('classic'));
  cy.get(IMPORT_INPUT).selectFile(`${FIXTURES}/${name}`, { force: true });
  cy.location('hash', { timeout: 30_000 }).should('match', /^#\/resume\/resume_[\w-]+$/);
  cy.previewReady();
}

describe('PDF import: résumés made by other tools', () => {
  it('a Word-style PDF opens as a new résumé with the best-effort notice and its fields in place', () => {
    importPdf('01-classic-word.pdf');
    cy.contains(NOTICE, 'Imported from your file as best we could read it').should('be.visible');
    cy.get('input[placeholder="John Doe"]').should('have.value', 'Jane Doe');
    cy.store().should((s) => {
      expect(s.resumes, 'the résumé already there is kept').to.have.length(2);
      const r = active(s);
      expect(r.id).not.to.eq('test_classic');
      expect(r.personal).to.include({ name: 'Jane Doe', email: 'jane.doe@example.com', phone: '+1 (555) 123-4567', location: 'San Francisco, CA' });
      expect(r.personal.linkedin).to.eq('linkedin.com/in/janedoe');
      expect(section(r, 'experience').items.map((i) => [i.company, i.role, i.startDate, i.endDate, i.current])).to.deep.eq([
        ['Acme Corp', 'Senior Software Engineer', 'Jan 2020', '', true],
        ['Globex Inc', 'Software Engineer', 'Jun 2016', 'Dec 2019', false],
      ]);
      expect(section(r, 'skills').items.map((i) => i.category)).to.deep.eq(['Languages', 'Frameworks', 'Tools']);
    });
    cy.preview()
      .should('contain.text', 'Acme Corp')
      .and('contain.text', 'Globex Inc')
      .and('contain.text', 'University of Texas at Austin')
      .and('contain.text', 'FastAPI');
  });

  it('the notice goes with Dismiss, and the new résumé is on the dashboard beside the old one', () => {
    importPdf('01-classic-word.pdf');
    cy.contains(NOTICE, 'Imported from your file').contains('button', 'Dismiss').click();
    cy.contains(NOTICE, 'Imported from your file').should('not.exist'); // other live regions (drag and drop) share the role
    cy.get('button[title="Back to dashboard"]').click();
    cy.get(CARD).should('have.length', 2);
  });

  it('a side-column PDF keeps its contacts, skills and school out of the main column', () => {
    importPdf('06-sidebar-left.pdf');
    cy.store().should((s) => {
      const r = active(s);
      expect(r.personal).to.include({ name: 'Jane Doe', title: 'Senior Software Engineer', location: 'San Francisco, CA' });
      expect(r.personal.linkedin).to.eq('linkedin.com/in/janedoe');
      expect(r.personal.github).to.eq('github.com/janedoe');
      expect(section(r, 'skills').items.map((i) => [i.category, i.skills])).to.deep.eq([
        ['Languages', 'Python, JavaScript, TypeScript, Go, SQL'],
        ['Frameworks', 'React, Node.js, Django, FastAPI'],
        ['Tools', 'AWS, Docker, Kubernetes, Git, Terraform'],
      ]);
      const school = section(r, 'education').items[0];
      expect([school.institution, school.degree]).to.deep.eq(['University of Texas at Austin', 'B.S. Computer Science']);
      expect(r.sections.map((x) => x.type), 'no left-overs section').not.to.include('custom');
    });
  });

  it('the same page with the side column on the right reads the same', () => {
    importPdf('07-sidebar-right.pdf');
    cy.store().should((s) => {
      const r = active(s);
      expect(r.personal).to.include({ name: 'Jane Doe', location: 'San Francisco, CA' });
      expect(section(r, 'experience').items.map((i) => i.company)).to.deep.eq(['Acme Corp', 'Globex Inc']);
      expect(section(r, 'skills').items).to.have.length(3);
    });
  });

  it('a CV table with a date column gives each job its company, role, place and dates', () => {
    importPdf('08-timeline-datecol.pdf');
    cy.store().should((s) => {
      expect(section(active(s), 'experience').items.map((i) => [i.company, i.role, i.location, i.startDate, i.endDate])).to.deep.eq([
        ['Acme Corp', 'Senior Software Engineer', 'San Francisco, CA', 'Jan 2020', ''],
        ['Globex Inc', 'Software Engineer', 'Austin, TX', 'Jun 2016', 'Dec 2019'],
      ]);
    });
  });

  it('a LaTeX page (role and dates over company and place) keeps each job whole', () => {
    importPdf('05-latex-jake.pdf');
    cy.store().should((s) => {
      const jobs = section(active(s), 'experience').items;
      expect(jobs.map((i) => [i.company, i.role, i.location])).to.deep.eq([
        ['Acme Corp', 'Senior Software Engineer', 'San Francisco, CA'],
        ['Globex Inc', 'Software Engineer', 'Austin, TX'],
      ]);
    });
  });

  it('a page with table-row spacing is two jobs and one school, not half entries', () => {
    importPdf('10-word-table-rows.pdf');
    cy.store().should((s) => {
      const r = active(s);
      expect(section(r, 'experience').items.map((i) => [i.company, i.role])).to.deep.eq([
        ['Acme Corp', 'Senior Software Engineer'],
        ['Globex Inc', 'Software Engineer'],
      ]);
      expect(section(r, 'education').items).to.have.length(1);
    });
    cy.preview().should('contain.text', 'Led a team of 6 engineers');
  });

  it('a file that is not a readable PDF says so on the dashboard and adds no résumé', () => {
    cy.visitDashboard(buildTestState('classic'));
    cy.get(IMPORT_INPUT).selectFile({ contents: Cypress.Buffer.from('this is not a pdf'), fileName: 'broken.pdf', mimeType: 'application/pdf' }, { force: true });
    cy.contains('Could not import broken.pdf', { timeout: 30_000 }).should('be.visible');
    cy.location('hash').should('eq', '#/');
    cy.store().its('resumes').should('have.length', 1);
  });
});
