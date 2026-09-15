/** Resume the store marks active. */
const active = (s) => s.resumes.find((r) => r.id === s.activeId);

const letter = () => cy.get('#cover-letter-preview');
const field = (label) => cy.contains('label', label).next('input');
const squash = (s) => s.replace(/\s+/g, '').toLowerCase();

/** The eye toggle beside a contact field in the "Visible Contact Fields" list. */
const contactToggle = (label) =>
  cy.contains('p', 'Visible Contact Fields').next().contains('span', label).siblings('button');

/** The letter preview's page 1: the canvas pdf.js paints the exported PDF into. */
const letterPage = () => cy.get('[role="img"][aria-label^="Cover letter page 1"] canvas');

/** One row of the painted page, `mm` from its top, as [r, g, b] pixels. */
function pixelRow(canvas, mm) {
  const y = Math.round((canvas.height * mm) / 297);
  const { data } = canvas.getContext('2d').getImageData(0, y, canvas.width, 1);
  return Array.from({ length: canvas.width }, (_, i) => [data[4 * i], data[4 * i + 1], data[4 * i + 2]]);
}

/** The share of a painted row, `mm` from the page's top, in the colour `hex`. */
function shareOf(canvas, mm, hex) {
  const want = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const row = pixelRow(canvas, mm);
  return row.filter((px) => px.every((v, i) => Math.abs(v - want[i]) < 8)).length / row.length;
}

/** Pick a template in the Design tab (by its description), then go back to the Cover Letter tab. */
function pickTemplate(description) {
  cy.get('button[title="Design & Customize"]').click();
  cy.contains('p', "The cover letter's header takes the template's look too.").should('be.visible');
  cy.contains('button', description).click();
  cy.contains('button', 'Cover Letter').click();
}

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

  it('the letterhead takes the résumé template\'s look: the panel names it, and a template switch restyles the preview (FIDB-51)', () => {
    const note = () => cy.contains('p', 'Header style follows your résumé template');
    // 16 mm: 2 mm into Modern's band, above its text; 7 mm: the top margin, where the Sidebar band bleeds.
    note().should('contain.text', 'Classic');
    letterPage().should(($c) => {
      expect(shareOf($c[0], 16, '#2563eb'), 'Classic: no accent band').to.be.below(0.05);
      expect(shareOf($c[0], 7, '#1e293b'), 'Classic: no dark band').to.be.below(0.05);
    });

    pickTemplate('Bold accent header');
    note().should('contain.text', 'Modern');
    cy.previewReady();
    letterPage().should(($c) => expect(shareOf($c[0], 16, '#2563eb'), 'Modern: the accent band').to.be.above(0.6));
    cy.store().should((s) => expect(active(s).template).to.eq('modern'));

    pickTemplate('Colored left sidebar layout');
    note().should('contain.text', 'Sidebar');
    cy.previewReady();
    letterPage().should(($c) => {
      expect(shareOf($c[0], 7, '#1e293b'), 'Sidebar: the panel colour to the edges').to.be.above(0.95);
      expect(shareOf($c[0], 16, '#2563eb'), 'Sidebar: no accent band').to.be.below(0.05);
    });
  });

  it('a centred résumé header centres the letterhead; the panel says so instead of offering Fields Position (FIDB-51)', () => {
    cy.contains('p', 'Fields Position').should('be.visible');
    cy.contains('p', 'Centred like your résumé').should('not.exist');
    // Resume → Personal Info → Header Customization → Text Alignment: Center.
    cy.contains('button', 'Resume').click();
    cy.contains('button', 'Header Customization').click();
    cy.contains('button', /^Center$/).click();
    cy.store().should((s) => expect(active(s).settings.headerAlign).to.eq('center'));
    cy.contains('button', 'Cover Letter').click();
    cy.contains('p', 'Header style follows your résumé template').should('contain.text', 'Classic');
    cy.contains('p', 'Centred like your résumé').should('be.visible');
    cy.contains('p', 'Fields Position').should('not.exist');
    cy.previewReady();
    // The name's ink, 19 mm from the top (through its lower-case letters), is centred on the page.
    letterPage().should(($c) => {
      const row = pixelRow($c[0], 19);
      const ink = row.flatMap((px, x) => (px.every((v) => v < 120) ? [x] : []));
      expect(ink.length, 'the name is painted there').to.be.above(10);
      const centre = (ink[0] + ink.at(-1)) / 2;
      expect(Math.abs(centre - row.length / 2) / row.length, 'the name is centred').to.be.below(0.02);
    });
  });
});
