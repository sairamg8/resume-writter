// R2-094, R2-095: the Personal Info panels showed an imported file's unknown value as no one of their
// chips, or as a control the PDF ignores, while the PDF printed something else.
// - R2-094: Photo → Height showed (Portrait active) for an imported shape such as 'oval', which the
//   PDF draws as a Circle, and a circle takes no Height: clicking a chip changed nothing it printed.
//   Height now shows only for the shape the PDF draws, as Shape's own chips do (photoOption).
// - R2-095: Header Customization showed no Contact Style or Layout chip active for a value such as
//   'dots' or 'grid'; the PDF and Word print an unknown style as Bar and an unknown layout as
//   Justify (PdfContact, wordExportContacts), and those chips are now the active ones. A blank style
//   is still Icon (R9-10).
// The panels are rendered on the server and their chips read back.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, loadModule, resume, render } from './harness.mjs';
import { drawing } from './extractors.mjs';

before(setup);
after(teardown);

const ACTIVE = 'bg-blue-600';

/** Each chip in `html` under the label `after`, up to the next label: [its text, active?]. */
function chipsAfter(html, label) {
  const from = html.indexOf(`>${label}</p>`);
  if (from < 0) return null;
  const rest = html.slice(from + label.length + 5);
  const end = rest.search(/<p[\s>]/);
  const part = end < 0 ? rest : rest.slice(0, end);
  return [...part.matchAll(/<button[^>]*class="([^"]*)"[^>]*>(.*?)<\/button>/g)]
    .map(([, cls, text]) => [text.replace(/<!-- -->/g, ''), cls.includes(ACTIVE)]);
}
const activeChip = (html, label) => chipsAfter(html, label)?.filter(([, on]) => on).map(([text]) => text);

describe('R2-094: Photo → Height, for a shape the PDF draws as a circle', () => {
  const panel = async (s) => {
    const { PhotoSection } = await loadModule('/src/components/PersonalInfoEditorPhoto.jsx');
    return renderToString(createElement(PhotoSection, {
      personal: { photo: null }, updatePersonal: () => {}, toggleFieldVisibility: () => {}, hidden: new Set(), s, set: () => {},
      template: 'classic', open: true, onToggle: () => {},
    }));
  };

  it('is not offered for an imported unknown shape, nor none; Shape shows Circle', async () => {
    for (const photoShape of ['oval', 'hexagon', 42, undefined, '', 'circle']) {
      const html = await panel({ photoShape, photoHeight: 'taller' });
      assert.equal(chipsAfter(html, 'Height'), null, String(photoShape));
      assert.deepEqual(activeChip(html, 'Shape'), ['Circle'], String(photoShape));
    }
  });

  it('is offered for a shape the PDF draws with a height', async () => {
    for (const photoShape of ['rounded', 'square']) {
      assert.deepEqual(activeChip(await panel({ photoShape, photoHeight: 'taller' }), 'Height'), ['Portrait'], photoShape);
    }
  });

  it('the PDF draws an unknown shape as a circle, whatever its Height', async () => {
    const { getPdfPhotoStyle } = await loadModule('/src/templates/pdf/shared/pdfPhoto.js');
    const circle = getPdfPhotoStyle({ photoShape: 'circle' });
    for (const photoHeight of ['match', 'tall', 'taller']) assert.deepEqual(getPdfPhotoStyle({ photoShape: 'oval', photoHeight }), circle, photoHeight);
  });
});

describe('R2-095: Header Customization → Contact Details, for an imported unknown value', () => {
  const panel = async (settings) => {
    const { HeaderCustomization } = await loadModule('/src/components/PersonalInfoEditorHeader.jsx');
    return renderToString(createElement(HeaderCustomization, {
      s: { headerAlign: 'left', ...settings }, set: () => {}, clear: () => {}, personal: { name: 'A' }, template: 'classic', templateLabel: 'Classic', open: true, onToggle: () => {},
    }));
  };

  it('Style shows the chip the PDF prints: Bar for an unknown style, Icon for none', async () => {
    const cases = [['dots', '| Bar'], ['Icons', '| Bar'], [7, '| Bar'], ['', '⊕ Icon'], [null, '⊕ Icon'], [undefined, '⊕ Icon'], ['bullet', '• Bullet'], ['bar', '| Bar'], ['icon', '⊕ Icon']];
    for (const [contactStyle, want] of cases) {
      const html = await panel({ contactStyle });
      assert.deepEqual(activeChip(html, 'Style'), [want], JSON.stringify(contactStyle));
      assert.equal(html.includes('>Icon set</p>'), want === '⊕ Icon', `${JSON.stringify(contactStyle)}: the icon controls show where icons print`);
    }
  });

  it('Layout shows the chip the PDF prints: Justify for an unknown layout', async () => {
    for (const [contactLayout, want] of [['grid', 'Justify'], ['2-grid', 'Justify'], [null, 'Justify'], ['single', 'Single'], ['2grid', '2 Grid']]) {
      assert.deepEqual(activeChip(await panel({ contactLayout }), 'Layout'), [want], JSON.stringify(contactLayout));
    }
  });

  it('the PDF prints them so: an unknown style as Bar, an unknown layout as Justify', async () => {
    const page = async (settings) => drawing(await render(resume({ settings: { headerAlign: 'left', ...settings }, personal: { email: 'a@example.com', phone: '+1 555 0100', location: 'Town' } })));
    assert.ok(await page({ contactStyle: 'dots' }) === await page({ contactStyle: 'bar' }), 'style');
    assert.ok(await page({ contactStyle: 'dots' }) !== await page({ contactStyle: 'icon' }), 'not Icon');
    assert.ok(await page({ contactLayout: 'grid' }) === await page({ contactLayout: 'justify' }), 'layout');
  });
});
