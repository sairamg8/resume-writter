// Header contacts: the cover letter's own contact visibility (FIDB-44).
import { buildTestState } from '../../tests/helpers.js';

/** Resume the store marks active. */
const active = (s) => s.resumes.find((r) => r.id === s.activeId);
const squash = (s) => s.replace(/\s+/g, '').toLowerCase();
const PHONE = squash('+1 555 0100');
const EMAIL = 'alex@example.com';

const letter = () => cy.get('#cover-letter-preview');
const pdfText = (pdf) => squash(pdf.runs.map((r) => r.str).join(''));

/** A seeded résumé hiding `resumeHidden`, whose letter has `coverLetter` merged over the test letter. */
function seeded(resumeHidden, coverLetter) {
  const state = buildTestState('classic');
  const r = active(state);
  r.personal = { ...r.personal, hiddenFields: resumeHidden };
  r.coverLetter = { ...r.coverLetter, ...coverLetter };
  return state;
}

describe('cover letter contacts follow the letter\'s own visibility (FIDB-44)', () => {
  it('a phone hidden on the résumé prints on a letter that shows it — preview, PDF and Word', () => {
    cy.visitEditor('classic', { state: seeded(['phone'], { hiddenFields: [] }), tab: 'coverletter' });
    letter().invoke('text').should((t) => expect(squash(t)).to.contain(PHONE));
    cy.get('button[title="Hide Phone from the cover letter"]').should('exist');
    cy.exportPdf().then((pdf) => expect(pdfText(pdf)).to.contain(PHONE));
    cy.exportDocx().then((docx) => expect(squash(docx.paragraphs.join(' '))).to.contain(PHONE));
  });

  it('hiding it on the letter hides it there only; the résumé keeps printing it', () => {
    cy.visitEditor('classic', { state: seeded([], { hiddenFields: [] }), tab: 'coverletter' });
    letter().invoke('text').should((t) => expect(squash(t)).to.contain(PHONE));
    cy.get('button[title="Hide Phone from the cover letter"]').click();
    letter().invoke('text').should((t) => {
      expect(squash(t)).not.to.contain(PHONE);
      expect(squash(t)).to.contain(EMAIL);
    });
    cy.store().should((s) => {
      expect(active(s).coverLetter.hiddenFields).to.deep.eq(['phone']);
      expect(active(s).personal.hiddenFields).to.deep.eq([]);
    });
    cy.exportPdf().then((pdf) => {
      expect(pdfText(pdf)).not.to.contain(PHONE);
      expect(pdfText(pdf)).to.contain(EMAIL);
    });
    cy.contains('button', 'Resume').click();
    cy.previewReady();
    cy.preview().invoke('text').should((t) => expect(squash(t)).to.contain(PHONE).and.to.contain(EMAIL));
  });

  it('a letter with no list of its own shows the résumé\'s hidden fields, and its first toggle makes it its own', () => {
    cy.visitEditor('classic', { state: seeded(['phone'], { hiddenFields: undefined }), tab: 'coverletter' });
    cy.get('button[title="Show Phone on the cover letter"]').should('exist');
    letter().invoke('text').should((t) => {
      expect(squash(t)).not.to.contain(PHONE);
      expect(squash(t)).to.contain(EMAIL);
    });
    cy.get('button[title="Show Phone on the cover letter"]').click();
    letter().invoke('text').should((t) => expect(squash(t)).to.contain(PHONE));
    cy.store().should((s) => {
      expect(active(s).coverLetter.hiddenFields).to.deep.eq([]);
      expect(active(s).personal.hiddenFields).to.deep.eq(['phone']);
    });
  });
});
