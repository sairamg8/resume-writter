// R4-IMP-04: Word saves every text box twice — the drawing in <mc:Choice> (wps:txbx) and a VML copy
// in <mc:Fallback> (v:textbox), each with the same <w:txbxContent> — and the reader split the whole
// body at </w:p> without skipping the copy: each line of a designed résumé's header or side column
// came out twice (the name twice, the contacts again in "Additional Information", every section
// doubled). The anchoring paragraph's own text after the box was dropped too. Each is read once now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docxXmlLines } from '../../src/utils/importFile.js';
import { resumeFromText } from '../../src/utils/importText.js';

const para = (text, style) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const box = (paras) => `<w:txbxContent>${paras.join('')}</w:txbxContent>`;

/** A paragraph anchoring a text box, as Word saves one: the box in Choice, and again in Fallback. */
const anchored = (paras, before = '', after = '') => '<w:p><w:r>'
  + (before ? `<w:t xml:space="preserve">${before}</w:t>` : '')
  + '<mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor><a:graphic><a:graphicData><wps:wsp><wps:txbx>'
  + box(paras)
  + '</wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice>'
  + '<mc:Fallback><w:pict><v:rect><v:textbox>' + box(paras) + '</v:textbox></v:rect></w:pict></mc:Fallback>'
  + '</mc:AlternateContent></w:r>'
  + (after ? `<w:r><w:t xml:space="preserve">${after}</w:t></w:r>` : '')
  + '</w:p>';

// A fictional person, the header in a text box as Word's designed templates set it.
const XML = '<w:document><w:body>'
  + anchored([para('Robin Vale', 'Title'), para('Product Designer'), para('robin.vale@example.com | +1 555 0199 | Austin, TX')])
  + para('EXPERIENCE', 'Heading1')
  + para('Juniper Labs — Senior Product Designer\tJan 2020 – Present')
  + '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Led the design system.</w:t></w:r></w:p>'
  + '<w:sectPr/></w:body></w:document>';

test('a text box\'s lines are read once: the Fallback copy is not read', () => {
  const texts = docxXmlLines(XML).map((l) => l.text).filter(Boolean);
  assert.deepEqual(texts, [
    'Robin Vale', 'Product Designer', 'robin.vale@example.com | +1 555 0199 | Austin, TX',
    'EXPERIENCE', 'Juniper Labs — Senior Product Designer\tJan 2020 – Present', '• Led the design system.',
  ]);
});

test('the résumé: one name, the contacts in the header, nothing doubled into "Additional Information"', () => {
  const r = resumeFromText(docxXmlLines(XML));
  assert.equal(r.personal.name, 'Robin Vale');
  assert.equal(r.personal.title, 'Product Designer');
  assert.deepEqual([r.personal.email, r.personal.phone, r.personal.location], ['robin.vale@example.com', '+1 555 0199', 'Austin, TX']);
  assert.deepEqual(r.sections.map((s) => s.type), ['experience']);
  assert.equal(r.sections[0].items.length, 1);
});

test('the anchoring paragraph\'s own text, before and after the box, is kept, and read before the box', () => {
  const xml = `<w:body>${anchored([para('In the box')], 'Before it ', 'after it')}</w:body>`;
  const texts = docxXmlLines(xml).map((l) => l.text);
  assert.deepEqual(texts, ['Before it after it', 'In the box']);
});

test('a side column in a box anchored to the name: the name first, then the column', () => {
  const xml = '<w:body>'
    + anchored([para('CONTACT'), para('robin.vale@example.com'), para('SKILLS'), para('Figma, prototyping')], 'Robin Vale')
    + para('EXPERIENCE') + '</w:body>';
  assert.deepEqual(docxXmlLines(xml).map((l) => l.text), ['Robin Vale', 'CONTACT', 'robin.vale@example.com', 'SKILLS', 'Figma, prototyping', 'EXPERIENCE']);
  assert.equal(resumeFromText(docxXmlLines(xml)).personal.name, 'Robin Vale');
});

test('a Fallback copy holding another text box is skipped whole; a self-closing Fallback skips nothing', () => {
  const inner = `<mc:AlternateContent><mc:Choice Requires="wps">${box([para('Deep')])}</mc:Choice><mc:Fallback>${box([para('Deep')])}</mc:Fallback></mc:AlternateContent>`;
  const nested = '<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps">' + box([para('Outer'), `<w:p><w:r>${inner}</w:r></w:p>`])
    + '</mc:Choice><mc:Fallback>' + box([para('Outer'), `<w:p><w:r>${inner}</w:r></w:p>`]) + '</mc:Fallback></mc:AlternateContent></w:r></w:p>';
  assert.deepEqual(docxXmlLines(`<w:body>${nested}${para('After')}</w:body>`).map((l) => l.text).filter(Boolean), ['Outer', 'Deep', 'After']);
  const empty = `<w:body><w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps">${box([para('Boxed')])}</mc:Choice><mc:Fallback/></mc:AlternateContent></w:r></w:p>${para('Kept')}<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps">${box([para('Second')])}</mc:Choice><mc:Fallback>${box([para('Second')])}</mc:Fallback></mc:AlternateContent></w:r></w:p></w:body>`;
  assert.deepEqual(docxXmlLines(empty).map((l) => l.text).filter(Boolean), ['Boxed', 'Kept', 'Second']);
});

test('an empty <w:p/> still gives no line, and a table\'s cells a line each, as before', () => {
  const xml = `<w:body><w:p/>${para('A')}<w:tbl><w:tr><w:tc>${para('B')}</w:tc><w:tc>${para('C')}</w:tc></w:tr></w:tbl></w:body>`;
  assert.deepEqual(docxXmlLines(xml).map((l) => l.text), ['A', 'B', 'C']);
});
