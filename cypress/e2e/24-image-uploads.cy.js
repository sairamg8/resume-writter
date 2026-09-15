// Uploaded images — the profile photo, the letter's photo, a contact field's icon — in the real
// browser: what a file is comes from its bytes, never its name (R7-3), and every upload is scaled
// to what the PDF prints (R7-4). src/utils/imageUpload.js; tests/unit/image-upload.unit.mjs runs
// the same rules against a stand-in browser.
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

// ── Images drawn in the page, as a camera or an editor would save them ─────────────────────────

/** `paint(ctx, w, h)` drawn on a `w`×`h` canvas and saved as `type`: the file's bytes. */
const drawnFile = (w, h, type, paint) => cy.window().then((win) => new Cypress.Promise((resolve) => {
  const canvas = win.document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  paint(canvas.getContext('2d'), w, h);
  canvas.toBlob((blob) => blob.arrayBuffer().then((buf) => resolve(Cypress.Buffer.from(buf))), type, 0.95);
}));
/** A smooth picture: a gradient and a disc. */
const smooth = (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#1d4ed8');
  g.addColorStop(1, '#f59e0b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, Math.min(w, h) / 3, 0, 2 * Math.PI);
  ctx.fill();
};
/** Every pixel random: the most bytes a JPEG can take. */
const noise = (ctx, w, h) => {
  const img = ctx.createImageData(w, h);
  const words = new Uint32Array(img.data.buffer);
  for (let i = 0; i < words.length; i += 1) words[i] = (Math.random() * 0x1000000) | 0xff000000;
  ctx.putImageData(img, 0, 0);
};
/** A disc on a see-through ground: a cut-out portrait. */
const cutOut = (ctx, w, h) => {
  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, Math.min(w, h) / 3, 0, 2 * Math.PI);
  ctx.fill();
};
/** The stored image decoded by the page: its size, and the alpha of its top-left pixel. */
const decoded = (src) => cy.window().then((win) => new Cypress.Promise((resolve, reject) => {
  const img = new win.Image();
  img.onload = () => {
    const canvas = win.document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    resolve({ width: img.naturalWidth, height: img.naturalHeight, cornerAlpha: ctx.getImageData(0, 0, 1, 1).data[3] });
  };
  img.onerror = reject;
  img.src = src;
}));
/** Bytes a data URL holds. */
const bytesOf = (url) => Math.floor((url.length - url.indexOf(',') - 1) * 3 / 4);
const photoOf = (s) => active(s).personal.photo;

describe('every upload is scaled to what the PDF prints (R7-4)', () => {
  beforeEach(() => {
    cy.visitEditor('classic', { state: buildTestState('classic') });
    cy.contains('button', /^Photo/).click();
  });

  it('a 3840×2160 camera photo is stored at 1024×576', () => {
    drawnFile(3840, 2160, 'image/jpeg', smooth)
      .then((contents) => inputNear('Profile Photo').selectFile({ contents, fileName: 'camera.jpg', mimeType: 'image/jpeg' }, { force: true }));
    cy.store().should((s) => expect(photoOf(s)).to.match(/^data:image\/jpeg;base64,\/9j\//));
    cy.store().then((s) => decoded(photoOf(s))).should((img) => expect([img.width, img.height]).to.deep.equal([1024, 576]));
  });

  it('a detailed 2000×1500 photo of several MB is saved under 300 KB, within 1024 px, and exports small', () => {
    drawnFile(2000, 1500, 'image/jpeg', noise).then((contents) => {
      expect(contents.length, 'the upload').to.be.above(2_000_000);
      inputNear('Profile Photo').selectFile({ contents, fileName: 'detailed.jpg', mimeType: 'image/jpeg' }, { force: true });
    });
    cy.store().should((s) => expect(photoOf(s)).to.match(/^data:image\/jpeg;base64,/));
    cy.store().then((s) => {
      expect(bytesOf(photoOf(s))).to.be.at.most(300_000);
      return decoded(photoOf(s));
    }).should((img) => expect(Math.max(img.width, img.height)).to.be.at.most(1024));
    cy.exportPdf().then((pdf) => expect(pdf.bytes, 'the PDF carries the stored photo, not the upload').to.be.below(1_000_000));
  });

  it('a big PNG photo: a cut-out stays a PNG that shows through, an opaque one becomes a JPEG', () => {
    drawnFile(2000, 2000, 'image/png', cutOut)
      .then((contents) => inputNear('Profile Photo').selectFile({ contents, fileName: 'cut-out.png', mimeType: 'image/png' }, { force: true }));
    cy.store().should((s) => expect(photoOf(s)).to.match(/^data:image\/png;base64,/));
    cy.store().then((s) => decoded(photoOf(s))).should((img) => {
      expect([img.width, img.height]).to.deep.equal([1024, 1024]);
      expect(img.cornerAlpha, 'the corner shows through').to.equal(0);
    });
    drawnFile(2000, 2000, 'image/png', smooth)
      .then((contents) => inputNear('Profile Photo').selectFile({ contents, fileName: 'opaque.png', mimeType: 'image/png' }, { force: true }));
    cy.store().should((s) => expect(photoOf(s)).to.match(/^data:image\/jpeg;base64,/));
    cy.store().then((s) => decoded(photoOf(s))).should((img) => expect([img.width, img.height]).to.deep.equal([1024, 1024]));
  });

  it('a 1000 px PNG contact icon is stored at 256 px', () => {
    drawnFile(1000, 1000, 'image/png', cutOut)
      .then((contents) => iconInput().selectFile({ contents, fileName: 'mail.png', mimeType: 'image/png' }, { force: true }));
    cy.store().should((s) => expect(Object.values(active(s).settings.customContactIcons || {})).to.have.length(1));
    cy.store().then((s) => decoded(Object.values(active(s).settings.customContactIcons)[0]))
      .should((img) => expect([img.width, img.height]).to.deep.equal([256, 256]));
  });
});
