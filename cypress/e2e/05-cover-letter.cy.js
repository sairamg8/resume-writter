/** Resume the store marks active. */
const active = (s) => s.resumes.find((r) => r.id === s.activeId);

const letter = () => cy.get('#cover-letter-preview');
const field = (label) => cy.contains('label', label).next('input');
const squash = (s) => s.replace(/\s+/g, '').toLowerCase();

/** The eye toggle beside a contact field in the "Visible Contact Fields" list. */
const contactToggle = (label) =>
  cy.contains('p', 'Visible Contact Fields').next().contains('span', label).siblings('button');

describe('cover letter', () => {
  beforeEach(() => cy.visitEditor('classic', { tab: 'coverletter' }));

  it('shows the letter body, closing and signature from the resume data', () => {
    letter()
      .should('contain.text', 'I am excited to apply for the Senior Engineer position')
      .and('contain.text', 'Sincerely')
      .and('contain.text', 'Alex Johnson');
  });

  it('body, closing phrase and signature edits reach the preview and the store', () => {
    cy.get('[data-placeholder^="Dear Hiring Manager"]').click().type('{moveToEnd}{enter}Happy to talk any time.');
    field('Closing Phrase').clear().type('Kind regards');
    field('Signature Designation').clear().type('Staff Engineer');
    letter()
      .should('contain.text', 'Happy to talk any time.')
      .and('contain.text', 'Kind regards')
      .and('contain.text', 'Staff Engineer');
    cy.store().should((s) => {
      const cl = active(s).coverLetter;
      expect(cl.closing).to.eq('Kind regards');
      expect(cl.signatureDesignation).to.eq('Staff Engineer');
      expect(cl.body).to.contain('Happy to talk any time.');
    });
  });

  it('hiding a contact field removes it from the letter and its PDF', () => {
    letter().should('contain.text', 'alex@example.com');
    contactToggle('Email').click();
    letter().should('not.contain.text', 'alex@example.com');
    cy.store().should((s) => expect(active(s).coverLetter.hiddenFields).to.include('email'));
    cy.exportPdf().then((pdf) => {
      const text = squash(pdf.runs.map((r) => r.str).join(''));
      expect(text).not.to.contain('alex@example.com');
      expect(text).to.contain(squash('+1 555 0100'));
    });
  });

  it('the exported cover letter carries the edited closing and signature', () => {
    field('Closing Phrase').clear().type('Warm regards');
    field('Signature Name').clear().type('A. Johnson');
    cy.exportPdf().then((pdf) => {
      const text = squash(pdf.runs.map((r) => r.str).join(''));
      expect(text).to.contain('warmregards');
      expect(text).to.contain('a.johnson');
    });
  });

  it('prints the date, recipient and subject from the data above the body (FIDB-49)', () => {
    letter().should(($el) => {
      const text = $el.text();
      const at = ['15 January 2026', 'Sarah Smith', 'Engineering Manager', 'Globex Corp',
        'Application for Senior Engineer role', 'Dear Sarah'].map((s) => text.indexOf(s));
      at.forEach((i) => expect(i, text).to.be.greaterThan(-1));
      expect(at, 'letter order').to.deep.eq([...at].sort((a, b) => a - b));
    });
  });

  it('date, recipient and subject inputs reach the store, the preview and the PDF in letter order (FIDB-49)', () => {
    const typed = ['2 March 2026', 'Maria Garcia', 'Head of Talent', 'Initech', 'Re: Platform Engineer'];
    ['Date', 'Recipient Name', 'Recipient Title', 'Company', 'Subject']
      .forEach((label, i) => field(label).clear().type(typed[i]));
    cy.store().should((s) => {
      expect(active(s).coverLetter).to.include({
        date: '2 March 2026', recipientName: 'Maria Garcia', recipientTitle: 'Head of Talent',
        company: 'Initech', subject: 'Re: Platform Engineer',
      });
    });
    const inOrder = (text) => {
      const at = [...typed, 'Dear Sarah'].map((s) => text.indexOf(squash(s)));
      at.forEach((i) => expect(i, text).to.be.greaterThan(-1));
      expect(at, 'letter order').to.deep.eq([...at].sort((a, b) => a - b));
    };
    letter().should(($el) => inOrder(squash($el.text())));
    cy.exportPdf().then((pdf) => inOrder(squash(pdf.runs.map((r) => r.str).join(''))));
  });

  it('"Today" writes today\'s date out in full', () => {
    cy.clock(new Date(2026, 8, 4, 10).getTime(), ['Date']);
    field('Date').clear();
    cy.contains('button', 'Today').click();
    field('Date').should('have.value', '4 September 2026');
    letter().should('contain.text', '4 September 2026');
  });

  it('Export Word on the Cover Letter tab downloads the letter, not the resume (FIDB-50)', () => {
    cy.exportDocx().then((docx) => {
      expect(docx.file.split(/[\\/]/).pop()).to.eq('Alex_Johnson_Full_Stack_Engineer_cover_letter.docx');
      const text = squash(docx.paragraphs.join(' '));
      ['15 January 2026', 'Sarah Smith', 'Globex Corp', 'Application for Senior Engineer role',
        'I am excited to apply for the Senior Engineer position', 'Sincerely,', 'alex@example.com']
        .forEach((s) => expect(text, s).to.contain(squash(s)));
      ['Professional Experience', 'Acme Corp', 'Employee of the Year']
        .forEach((s) => expect(text, `the résumé's "${s}"`).not.to.contain(squash(s)));
    });
  });

  it('cover letter edits do not leak into the resume preview', () => {
    field('Closing Phrase').clear().type('Only in the letter');
    cy.contains('button', 'Resume').click();
    cy.preview().should('not.contain.text', 'Only in the letter');
  });
});
