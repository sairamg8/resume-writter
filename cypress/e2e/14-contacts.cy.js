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

/**
 * A seeded résumé hiding `resumeHidden`, whose letter has `coverLetter` merged over the test letter.
 * It is data this build saved (buildTestState stamps DATA_VERSION); a letter list saved before
 * e0e243c is migrated on load (22-regressions-letters, R5-0).
 */
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
    cy.exportLetterPdf().then((pdf) => expect(pdfText(pdf)).to.contain(PHONE));
    cy.exportLetterDocx().then((docx) => expect(squash(docx.paragraphs.join(' '))).to.contain(PHONE));
  });

  // Guard / selector note: hiding on the letter already worked before e0e243c; this test fails
  // on ffb7cfd only at selector level because the title attribute was added in e0e243c.
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
    cy.exportLetterPdf().then((pdf) => {
      expect(pdfText(pdf)).not.to.contain(PHONE);
      expect(pdfText(pdf)).to.contain(EMAIL);
    });
    cy.contains('button', 'Resume').click();
    cy.previewReady();
    cy.preview().invoke('text').should((t) => expect(squash(t)).to.contain(PHONE).and.to.contain(EMAIL));
  });

  // Guard / selector note: following the résumé's list already worked before e0e243c; this test
  // fails on ffb7cfd only at selector level because the title attribute was added in e0e243c.
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
  /** Design → Contact icons, opened: its hint (a <p>), then the list of packs. */
  const iconSection = () => cy.contains('button', /^Contact icons$/).parent().next();
  /** The option buttons of Design → Contact icons. */
  const packs = () => iconSection().children('.space-y-2').children('button');

  it('previews five distinct packs, and picking one reaches the store', () => {
    cy.visitEditor('classic');
    cy.get('button[title="Design & Customize"]').click();
    packs().should('have.length', 5).each(($b) => {
      expect($b.find('svg')).to.have.length(6);
      $b.find('svg').each((_, svg) => expect(svg.querySelectorAll('path, rect, circle').length).to.be.greaterThan(0));
    });
    // The phone (second icon) is a handset in Filled, Classic and Bold, a smartphone in Modern and Minimal.
    const phone = (label) => packs().filter(`:contains("${label}")`).find('svg').eq(1);
    phone('Filled').find('path').first().should('have.attr', 'd').and('match', /^M7\.05 2\.6/);
    phone('Classic').find('path').first().should('have.attr', 'd').and('match', /^M13\.832 16\.568/);
    phone('Modern').find('rect').should('have.attr', 'x', '7');
    phone('Minimal').find('path').first().should('have.attr', 'd').and('match', /^M7 3\.5h10/);
    phone('Bold').find('path').first().should('have.attr', 'stroke-width', '2.6');

    // All five packs' phone icons render pairwise distinct SVG markup (W3-5.3)
    packs().then(($buttons) => {
      const phones = [...$buttons].map((b) => b.querySelectorAll('svg')[1].innerHTML);
      expect(new Set(phones).size).to.eq(5);
    });

    packs().filter(':contains("Minimal")').click();
    cy.store().should((s) => expect(active(s).settings.iconSet).to.eq('minimal'));
    packs().filter(':contains("Minimal")').should('contain.text', 'Selected');
  });

  // R9-4: Modern and Sidebar draw the pack whatever Contact style says, so a pick there leaves the
  // style alone. Their Header Customization shows no Style chips, yet the letter follows that
  // style (PDF = preview, and Word), and so does a later switch to Classic, Minimal or Executive.
  const hint = () => iconSection().children('p').first();
  const pickMinimal = () => {
    cy.get('button[title="Design & Customize"]').click();
    packs().filter(':contains("Minimal")').click();
  };
  /** The email, then `mark` (the style's separator), then the phone — in a text with no spaces. */
  const contactsWith = (mark) => (t) => expect(squash(t)).to.contain(`${EMAIL}${mark}${PHONE}`);

  it('Modern: picking a pack keeps Contact style Bar — the letter and a switch to Classic still print | (R9-4)', () => {
    cy.visitEditor('modern', { settings: { contactStyle: 'bar' } });
    pickMinimal();
    cy.store().should((s) => expect(active(s).settings).to.include({ iconSet: 'minimal', contactStyle: 'bar' }));
    cy.contains('button', 'Cover Letter').click();
    cy.previewReady();
    letter().invoke('text').should(contactsWith('|'));
    cy.get('button[title="Design & Customize"]').click();
    cy.contains('button', 'Two-column header').click();
    cy.store().should((s) => {
      expect(active(s).template).to.eq('classic');
      expect(active(s).settings.contactStyle).to.eq('bar');
    });
    cy.preview().invoke('text').should(contactsWith('|'));
  });

  it('Sidebar: picking a pack keeps Contact style Bullet — the letter still prints •, in the PDF and in Word (R9-4)', () => {
    cy.visitEditor('sidebar', { settings: { contactStyle: 'bullet' } });
    pickMinimal();
    cy.store().should((s) => expect(active(s).settings).to.include({ iconSet: 'minimal', contactStyle: 'bullet' }));
    cy.contains('button', 'Cover Letter').click();
    cy.previewReady();
    letter().invoke('text').should(contactsWith('•'));
    cy.exportLetterDocx().then((docx) => contactsWith('•')(docx.paragraphs.join(' ')));
  });

  it('Classic draws the pack only with the Icon style: its hint says a pick switches Bar to Icon, and a pick does (R9-4)', () => {
    cy.visitEditor('classic', { settings: { contactStyle: 'bar' } });
    cy.get('button[title="Design & Customize"]').click();
    hint().should('contain.text', 'Picking a pack switches the résumé to Icon');
    packs().filter(':contains("Minimal")').click();
    cy.store().should((s) => expect(active(s).settings).to.include({ iconSet: 'minimal', contactStyle: 'icon' }));
    hint().should('not.contain.text', 'switches');
  });
});

describe('uploads in formats the PDF cannot draw are converted (R1-1)', () => {
  // 1×1 WebP and GIF: the browser shows them, react-pdf cannot decode them.
  const WEBP = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
  const GIF = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const file = (b64, fileName, mimeType) => ({ contents: Cypress.Buffer.from(b64, 'base64'), fileName, mimeType });
  const inputNear = (label) => cy.contains('p', label).parent().parent().find('input[type=file]');

  it('a WebP profile photo is stored as JPEG, a GIF contact icon as PNG', () => {
    cy.visitEditor('classic', { state: buildTestState('classic') });
    cy.contains('button', /^Photo/).click();
    inputNear('Profile Photo').selectFile(file(WEBP, 'me.webp', 'image/webp'), { force: true });
    cy.store().should((s) => expect(active(s).personal.photo).to.match(/^data:image\/jpeg;base64,/));
    cy.contains('span', 'Resume icon').first().parent().find('input[type=file]')
      .selectFile(file(GIF, 'mail.gif', 'image/gif'), { force: true });
    cy.store().should((s) => {
      const icons = Object.values(active(s).settings.customContactIcons || {});
      expect(icons).to.have.length(1);
      expect(icons[0]).to.match(/^data:image\/png;base64,/);
    });
  });

  it('a WebP cover-letter photo is stored as JPEG; a file the browser cannot decode is refused with a message', () => {
    cy.visitEditor('classic', { state: buildTestState('classic'), tab: 'coverletter' });
    inputNear('Cover Letter Photo').selectFile(file(WEBP, 'me.webp', 'image/webp'), { force: true });
    cy.store().should((s) => expect(active(s).coverLetter.clPhoto).to.match(/^data:image\/jpeg;base64,/));
    const alerted = cy.stub().as('alert');
    cy.on('window:alert', alerted);
    inputNear('Cover Letter Photo').selectFile(file('bm90IGFuIGltYWdl', 'broken.webp', 'image/webp'), { force: true });
    cy.get('@alert').should('have.been.calledWithMatch', /could not be read/);
    cy.store().should((s) => expect(active(s).coverLetter.clPhoto).to.match(/^data:image\/jpeg;base64,/));
  });
});

describe('per-field contact icons in the editor (R1-2, R1-4)', () => {
  const iconRows = () => cy.get('body').find('span:contains("Resume icon")');
  const withStyle = (template, contactStyle, iconSet) => {
    const state = buildTestState(template);
    active(state).settings = { ...active(state).settings, contactStyle, iconSet };
    return state;
  };

  for (const template of ['modern', 'sidebar']) {
    it(`${template} offers the upload with any contact style — it always draws icons`, () => {
      cy.visitEditor(template, { state: withStyle(template, 'bar') });
      iconRows().should('have.length.at.least', 1);
    });
  }

  it('Classic offers it only with the Icon style', () => {
    cy.visitEditor('classic', { state: withStyle('classic', 'bar') });
    cy.contains('label', 'Email').should('exist');
    iconRows().should('have.length', 0);
  });

  // The letter draws the pack and the uploads with its own Contact Style "Icon", whatever the
  // résumé's; the upload was offered only where the résumé drew icons, so an icon the letter
  // printed could not be replaced or cleared under a Bar or Bullet résumé (R9-5).
  it('Classic with Bar: once its letter takes the Icon style, the upload is offered as the cover letter\'s, and Clear removes it', () => {
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const state = withStyle('classic', 'bar');
    active(state).settings.customContactIcons = { email: PNG };
    const letterRows = () => cy.get('body').find('span:contains("Cover letter icon")');
    cy.visitEditor('classic', { state });
    cy.contains('label', 'Email').should('exist');
    letterRows().should('have.length', 0); // the letter follows the résumé's Bar: no icon anywhere
    cy.contains('button', 'Cover Letter').click();
    cy.contains('p', 'Contact Style').next().contains('button', 'Icon').click();
    cy.store().should((s) => expect(active(s).coverLetter.headerStyle).to.eq('icon'));
    cy.contains('button', 'Resume').click();
    iconRows().should('have.length', 0);
    letterRows().should('have.length', 6);
    letterRows().first().parent().contains('button', 'Clear').click();
    cy.store().should((s) => expect(active(s).settings.customContactIcons).to.deep.eq({}));
  });

  it('the "Resume icon" chip draws the pack with its own stroke width, as the PDF does', () => {
    cy.visitEditor('classic', { state: withStyle('classic', 'icon', 'minimal') });
    cy.contains('span', 'Resume icon').first().next().find('svg [stroke-width]').first()
      .should('have.attr', 'stroke-width', '1.5');
  });

  it('ONB-8: Design -> Contact icons hint accurately reflects whether icons are shown', () => {
    // Classic with Bar: neither draws icons
    cy.visitEditor('classic', { state: withStyle('classic', 'bar') });
    cy.get('button[title="Design & Customize"]').click();
    cy.contains('p', 'Contact style must be Icon').should('not.exist');
    cy.contains('p', 'while icons are shown').scrollIntoView().should('be.visible');

    // Switch letter to Icon: custom images appear
    cy.contains('button', 'Cover Letter').click();
    cy.contains('p', 'Contact Style').next().contains('button', 'Icon').click();
    cy.get('button[title="Design & Customize"]').click();
    cy.contains('p', 'while icons are shown').should('not.exist');
    cy.contains('p', 'Custom images per field appear under Personal Info → Fields.').scrollIntoView().should('be.visible');
  });
});

