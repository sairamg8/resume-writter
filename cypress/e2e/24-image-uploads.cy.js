// Uploaded images — the profile photo, the letter's photo, a contact field's icon — in the real
// browser: what a file is comes from its bytes, never its name (R7-3). src/utils/imageUpload.js;
// tests/unit/image-upload.unit.mjs runs the same rules against a stand-in browser.
import { buildTestState } from '../../tests/helpers.js';

/** Resume the store marks active. */
const active = (s) => s.resumes.find((r) => r.id === s.activeId);
/** A 2×2 PNG and a 1×1 WebP: the browser shows both, react-pdf decodes only the PNG. */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==';
const WEBP = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
/** A selectFile file; the browser labels a file by its name, as `mimeType` does here. */
const file = (b64, fileName, mimeType) => ({ contents: Cypress.Buffer.from(b64, 'base64'), fileName, mimeType });
const inputNear = (label) => cy.contains('p', label).parent().parent().find('input[type=file]');
const iconInput = () => cy.contains('span', 'Resume icon').first().parent().find('input[type=file]');

describe('an upload is stored as what its bytes are, whatever its name says (R7-3)', () => {
  it('profile photo: a WebP named .jpg is converted to a real JPEG; a PNG named .jpg is kept as the PNG it is', () => {
    cy.visitEditor('classic', { state: buildTestState('classic') });
    cy.contains('button', /^Photo/).click();
    inputNear('Profile Photo').selectFile(file(WEBP, 'me.jpg', 'image/jpeg'), { force: true });
    cy.store().should((s) => expect(active(s).personal.photo).to.match(/^data:image\/jpeg;base64,\/9j\//));
    inputNear('Profile Photo').selectFile(file(PNG, 'me-too.jpg', 'image/jpeg'), { force: true });
    cy.store().should((s) => expect(active(s).personal.photo).to.equal(`data:image/png;base64,${PNG}`));
  });

  it('contact icon: a WebP named .png is converted to a real PNG', () => {
    cy.visitEditor('classic', { state: buildTestState('classic') });
    iconInput().selectFile(file(WEBP, 'mail.png', 'image/png'), { force: true });
    cy.store().should((s) => {
      const icons = Object.values(active(s).settings.customContactIcons || {});
      expect(icons).to.have.length(1);
      expect(icons[0]).to.match(/^data:image\/png;base64,iVBORw0KGgo/);
    });
  });

  it('letter photo: a WebP named .png is converted to a real JPEG', () => {
    cy.visitEditor('classic', { state: buildTestState('classic'), tab: 'coverletter' });
    inputNear('Cover Letter Photo').selectFile(file(WEBP, 'me.png', 'image/png'), { force: true });
    cy.store().should((s) => expect(active(s).coverLetter.clPhoto).to.match(/^data:image\/jpeg;base64,\/9j\//));
  });
});
