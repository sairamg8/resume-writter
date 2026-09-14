// Header contacts: the cover letter's own contact visibility (FIDB-44), style and layout, and
// the icon packs the Design panel offers, drawn from the table the PDF draws from too
// (FIDA-39, FIDB-07).
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

describe('cover letter contact style and layout: the panel shows what the letter prints', () => {
  /** A chip of one row ("Contact Style" / "Contact Layout") in the Cover Letter panel. */
  const chip = (row, label) => cy.contains('p', row).next().contains('button', label);
  const on = (row, label) => chip(row, label).should('have.class', 'bg-blue-600');
  const off = (row, label) => chip(row, label).should('not.have.class', 'bg-blue-600');

  it('a letter with no style or layout of its own shows and prints the résumé\'s, until a chip sets its own', () => {
    cy.visitEditor('classic', { settings: { contactStyle: 'bullet', contactLayout: 'single' }, tab: 'coverletter' });
    on('Contact Style', 'Bullet');
    off('Contact Style', 'Bar');
    on('Contact Layout', 'Single');
    off('Contact Layout', 'Justify');
    letter().invoke('text').should('contain', '•');

    chip('Contact Style', 'Bar').click();
    on('Contact Style', 'Bar');
    letter().invoke('text').should('not.contain', '•');
    chip('Contact Layout', 'Justify').click();
    on('Contact Layout', 'Justify');
    letter().invoke('text').should('contain', '|');
    cy.store().should((s) => {
      expect(active(s).coverLetter).to.include({ headerStyle: 'bar', headerLayout: 'justify' });
      expect(active(s).settings).to.include({ contactStyle: 'bullet', contactLayout: 'single' });
    });
  });
});

describe('contact icon packs in the Design panel (FIDA-39, FIDB-07)', () => {
  /** The option buttons of Design → Contact icons. */
  const packs = () => cy.contains('p', 'Global icon style for the whole resume').next().children('button');

  it('previews five distinct packs, and picking one reaches the store', () => {
    cy.visitEditor('classic');
    cy.get('button[title="Design & Customize"]').click();
    packs().should('have.length', 5).each(($b) => {
      expect($b.find('svg')).to.have.length(6);
      $b.find('svg').each((_, svg) => expect(svg.querySelectorAll('path, rect, circle').length).to.be.greaterThan(0));
    });
    // The phone (second icon) is a handset in Classic and Bold, a smartphone in Modern and Minimal.
    const phone = (label) => packs().filter(`:contains("${label}")`).find('svg').eq(1);
    phone('Classic').find('path').first().should('have.attr', 'd').and('match', /^M13\.832 16\.568/);
    phone('Modern').find('rect').should('have.attr', 'x', '7');
    phone('Minimal').find('path').first().should('have.attr', 'd').and('match', /^M7 3\.5h10/);
    phone('Bold').find('path').first().should('have.attr', 'stroke-width', '2.6');
    packs().filter(':contains("Minimal")').click();
    cy.store().should((s) => expect(active(s).settings.iconSet).to.eq('minimal'));
    packs().filter(':contains("Minimal")').should('contain.text', 'Selected');
  });
});
