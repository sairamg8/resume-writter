import { buildTestState } from '../../tests/helpers.js';

const TEMPLATES = ['classic', 'modern', 'minimal', 'sidebar', 'executive'];

/** One value from every section of tests/helpers.js ALL_SECTION_TYPES, plus the header. */
const CONTENT = [
  'Alex Johnson', 'Full Stack Engineer', 'alex@example.com',
  'Acme Corp', 'Senior Dev', 'MIT', 'BSc Computer Science', 'Frontend', 'TypeScript',
  'My App', 'English', 'AWS Solutions Architect', 'Employee of the Year', 'Red Cross',
  'Jane Doe', 'Hiking', 'React Performance Patterns',
];

/**
 * Whitespace-free, lower-cased text: a word split across PDF text runs still matches, and a
 * template that upper-cases labels (Sidebar's skill categories) is not a content failure.
 */
const squash = (s) => s.replace(/\s+/g, '').toLowerCase();
const pdfText = (pdf) => squash(pdf.runs.map((r) => r.str).join(''));
const basename = (file) => file.split(/[\\/]/).pop();

const A4 = { width: 595.28, height: 841.89 };

describe('export — PDF per template', () => {
  TEMPLATES.forEach((template) => {
    it(`${template}: an A4 PDF with every section, named after the person`, () => {
      cy.visitEditor(template);
      cy.exportPdf().then((pdf) => {
        expect(basename(pdf.file)).to.eq('Alex_Johnson_Full_Stack_Engineer.pdf');
        expect(pdf.width).to.be.closeTo(A4.width, 0.5);
        expect(pdf.height).to.be.closeTo(A4.height, 0.5);
        const text = pdfText(pdf);
        CONTENT.forEach((needle) => expect(text, needle).to.contain(squash(needle)));
        expect(pdf.info.Title).to.eq('Alex Johnson Resume');
        expect(pdf.info.Creator).to.eq('CPWT-CV');
      });
    });
  });

  it('a hidden section is left out of the PDF as well as the canvas', () => {
    const state = buildTestState('classic');
    state.resumes[0].sections.find((s) => s.type === 'awards').visible = false;
    state.resumes[0].personal.hiddenFields = ['email'];
    cy.visitEditor('classic', { state });
    cy.preview().should('not.contain.text', 'Employee of the Year').and('not.contain.text', 'alex@example.com');
    cy.exportPdf().then((pdf) => {
      const text = pdfText(pdf);
      expect(text).not.to.contain(squash('Employee of the Year'));
      expect(text).not.to.contain('alex@example.com');
      expect(text).to.contain(squash('Red Cross'));
    });
  });

  it('edits made in the editor are in the next export', () => {
    cy.visitEditor('modern');
    cy.contains('label', 'Full Name').parent().next('input').clear().type('Priya Raman');
    cy.preview().should('contain.text', 'Priya Raman');
    cy.exportPdf().then((pdf) => {
      expect(basename(pdf.file)).to.eq('Priya_Raman_Full_Stack_Engineer.pdf');
      // name + title as the header prints them ('alexjohnson' alone also matches alexjohnson.dev)
      expect(pdfText(pdf)).to.contain('priyaramanfullstackengineer').and.not.contain('alexjohnsonfullstackengineer');
    });
  });

  it('the cover letter exports its own PDF with the letter body and signature', () => {
    cy.visitEditor('classic', { tab: 'coverletter' });
    cy.exportPdf().then((pdf) => {
      expect(basename(pdf.file)).to.eq('Alex_Johnson_Full_Stack_Engineer_cover_letter.pdf');
      const text = pdfText(pdf);
      expect(text).to.contain(squash('I am excited to apply for the Senior Engineer position'));
      expect(text).to.contain('sincerely');
      expect(text).not.to.contain(squash('Employee of the Year')); // not the resume
    });
  });
});

describe('export — Word and JSON', () => {
  beforeEach(() => cy.visitEditor('classic'));

  it('Export Word downloads a .docx carrying the resume content', () => {
    cy.exportDocx().then((docx) => {
      expect(basename(docx.file)).to.eq('Alex_Johnson_Full_Stack_Engineer.docx');
      expect(docx.bytes).to.be.greaterThan(2_000);
      const text = squash(docx.paragraphs.join(' '));
      CONTENT.forEach((needle) => expect(text, needle).to.contain(squash(needle)));
    });
  });

  it('Export JSON downloads exactly the resume in the store', () => {
    cy.exportFile('Export JSON', '.json').then((file) => {
      expect(basename(file)).to.eq('Alex_Johnson_Full_Stack_Engineer.json');
      cy.task('readTextFile', file).then((raw) => {
        cy.store().then((s) => {
          expect(JSON.parse(raw)).to.deep.eq(s.resumes.find((r) => r.id === s.activeId));
        });
      });
    });
  });

  it('Import JSON from the editor opens the imported resume', () => {
    const resume = buildTestState('executive').resumes[0];
    cy.openExportMenu();
    cy.get('input[type="file"][accept=".json"]').selectFile({
      contents: Cypress.Buffer.from(JSON.stringify({ ...resume, name: 'From the editor' })),
      fileName: 'from-editor.json',
    }, { force: true });
    cy.location('hash').should('match', /^#\/resume\/resume_\d+$/);
    cy.contains('button', 'From the editor').should('be.visible');
    cy.store().should((s) => expect(s.resumes).to.have.length(2));
  });
});
