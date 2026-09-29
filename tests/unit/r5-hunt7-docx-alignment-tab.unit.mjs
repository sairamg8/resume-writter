// R5-HUNT7-DOCX-ALIGNMENT-TAB-DROPPED: Word's alignment tab (Insert Alignment Tab, saved as <w:ptab .../>),
// a common way to push a date to the right margin, was skipped by the Word import, so the text on each side
// ran together: "Acme CorpJan 2020 – Present", no dates read and the company garbled. It is a tab now, as
// <w:tab/> is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';
import { docxXmlLines } from '../../src/utils/importFile.js';

const PTAB = '<w:ptab w:relativeTo="margin" w:alignment="right" w:leader="none"/>';
const p = (runs, props = '') => `<w:p><w:pPr>${props}</w:pPr><w:r>${runs}</w:r></w:p>`;
const t = (text) => `<w:t xml:space="preserve">${text}</w:t>`;
const doc = (...paras) => `<w:document><w:body>${paras.join('')}</w:body></w:document>`;

test('an alignment tab reads as a tab', () => {
  const lines = docxXmlLines(`<w:body><w:p><w:r><w:t>Acme Corp</w:t></w:r><w:r>${PTAB}<w:t>Jan 2020 – Present</w:t></w:r></w:p></w:body>`);
  assert.deepEqual(lines.map((l) => l.text), ['Acme Corp\tJan 2020 – Present']);
});

test('a date pushed right with an alignment tab gives the entry its dates and keeps the company', () => {
  const r = resumeFromText(docxXmlLines(doc(
    p(t('Sam Lee')),
    p(t('sam@example.com')),
    p(t('Experience'), '<w:pStyle w:val="Heading1"/>'),
    p(`${t('Acme Corp')}${PTAB}${t('Jan 2020 – Present')}`),
    p(t('Engineer')),
  )));
  const [job] = r.sections.find((s) => s.type === 'experience').items;
  assert.deepEqual([job.company, job.role, job.startDate, job.current], ['Acme Corp', 'Engineer', 'Jan 2020', true]);
});
