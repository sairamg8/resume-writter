// R5-OUT-01: the main column's reference card (PdfSectionsThree.jsx ReferencesSection) prints the
// e-mail 2 pt below the line above it (marginTop 2); Word's buildReferences gave every card line the
// same spacing, so in the .docx the e-mail sat 2 pt closer to the job title, company or relationship.
// Word now gives the e-mail paragraph 40 twips (2 pt) before it in the main column, and none in the
// Sidebar's side column, whose PDF (SideReferences) prints the e-mail flush. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, renderDocx } from './harness.mjs';

before(setup);
after(teardown);

const REF = { name: 'Ana Ruiz', jobTitle: 'Staff Engineer', company: 'Acme', email: 'ana@example.com', phone: '555 0100' };

/** The <w:spacing> attributes of the paragraph whose whole text is `text`. */
function spacingOf(doc, text) {
  const p = doc.paragraphs.find((q) => q.text.trim() === text);
  assert.ok(p, `"${text}" in a paragraph of its own: ${doc.texts.join(' || ')}`);
  const own = p.xml.slice(Math.max(p.xml.lastIndexOf('<w:p>'), p.xml.lastIndexOf('<w:p ')));
  const tag = own.match(/<w:spacing\b[^>]*\/>/)?.[0] || '';
  const at = (name) => Number(tag.match(new RegExp(`w:${name}="(\\d+)"`))?.[1] ?? 0);
  return { before: at('before'), after: at('after') };
}

describe('Word references: the e-mail keeps the PDF card\'s 2 pt above it (R5-OUT-01)', () => {
  it('main column (Classic): 40 twips before the e-mail, none before the other lines', async () => {
    const doc = await renderDocx(resume({ template: 'classic', sections: [section('references', [REF])] }));
    assert.equal(spacingOf(doc, 'ana@example.com').before, 40);
    for (const text of ['Ana Ruiz', 'Staff Engineer', 'Acme', '555 0100']) assert.equal(spacingOf(doc, text).before, 0, text);
  });

  it('the Sidebar\'s side column: the e-mail flush, as its PDF prints it', async () => {
    const doc = await renderDocx(resume({ template: 'sidebar', sections: [section('references', [REF])] }));
    assert.equal(spacingOf(doc, 'ana@example.com').before, 0);
  });
});
