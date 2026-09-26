// R4-LO-08: the Markdown export left "&" and "|" as typed. A description "Built &copy; notices" showed
// "Built © notices" in a Markdown viewer (an entity), and a "|" in user text could start a table
// cell. They are escaped now (an "&" only where it would read as an entity), the export's own " | "
// separators are not, and the Markdown import reads the escapes back off. A certificate's description
// printed in the Markdown export alone (the PDF, Word and the ATS text print none, and the editor has
// no box for it): the exporters agree now, and the Markdown prints none either.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';
import { generateAtsPlainText } from '../../src/utils/atsPlainText.js';
import { markdownLines } from '../../src/utils/importText.js';

const md = (sections, personal = {}) => generateMarkdownResume({
  personal: { name: 'Robin Sample', ...personal },
  sections: sections.map((s, i) => ({ id: `s${i}`, visible: true, ...s })),
});

test('an "&" that reads as an entity and a typed "|" are escaped; a plain "&" is not', () => {
  const out = md([{ type: 'experience', title: 'Tools & Stack', items: [{ id: 'e', company: 'A|B Labs', role: 'Dev',
    location: 'Leeds', startDate: '2020', description: '<p>Built &amp;copy; notices &amp; the a | b table &amp;#169;.</p>' }] }]);
  assert.ok(out.includes('Built \\&copy; notices & the a \\| b table \\&#169;.'), out);
  assert.ok(out.includes('## Tools & Stack'), out);
  assert.ok(out.includes('### **A\\|B Labs** — *Dev*'), out);
  // The export's own separator between the date and the place is not escaped.
  assert.match(out, /^\*2020 \| Leeds\*$/m, out);
});

test('the Markdown import reads them back as typed', () => {
  const out = md([{ type: 'experience', title: 'Experience', items: [{ id: 'e', company: 'Acme', role: 'Dev',
    description: '<p>Built &amp;copy; notices and a | b.</p>' }] }]);
  const texts = markdownLines(out).map((l) => l.text);
  assert.ok(texts.includes('Built &copy; notices and a | b.'), texts.join(' / '));
});

test('a certificate\'s description prints in no export', () => {
  const cert = { type: 'certifications', title: 'Certifications', items: [{ id: 'c', name: 'AWS Certified Developer',
    issuer: 'Amazon', date: '2022', description: '<p>Hidden legacy note.</p>' }] };
  const out = md([cert]);
  assert.ok(out.includes('AWS Certified Developer'), out);
  assert.ok(!out.includes('Hidden legacy note'), out);
  const ats = generateAtsPlainText({ personal: { name: 'Robin Sample' }, sections: [{ id: 's0', visible: true, ...cert }] });
  assert.ok(!ats.includes('Hidden legacy note'), ats);
});
