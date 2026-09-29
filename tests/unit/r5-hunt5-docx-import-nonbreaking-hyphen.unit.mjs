// R5-HUNT5-DOCX-IMPORT-DROPS-NONBREAKING-HYPHEN: Word saves a non-breaking hyphen (Ctrl+Shift+-, used to
// keep a date range or a phone number on one line) as <w:noBreakHyphen/>, which the Word import skipped:
// "2019‑2021" read "20192021" (no dates, the job title), "555‑0100" read "5550100". It is a hyphen now,
// and a soft hyphen (<w:softHyphen/>, an optional break) is nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';
import { docxXmlLines } from '../../src/utils/importFile.js';

const p = (runs, props = '') => `<w:p><w:pPr>${props}</w:pPr><w:r>${runs}</w:r></w:p>`;
const t = (text) => `<w:t xml:space="preserve">${text}</w:t>`;
const doc = (...paras) => `<w:document><w:body>${paras.join('')}</w:body></w:document>`;

test('a non-breaking hyphen is a hyphen, a soft hyphen nothing', () => {
  const lines = docxXmlLines(doc(p(`${t('Call 555')}<w:noBreakHyphen/>${t('0100')}`), p(`${t('Engi')}<w:softHyphen/>${t('neer')}`)));
  assert.deepEqual(lines.map((l) => l.text), ['Call 555-0100', 'Engineer']);
});

test('a date range typed with a non-breaking hyphen gives the entry its dates', () => {
  const r = resumeFromText(docxXmlLines(doc(
    p(t('Sam Lee')),
    p(t('sam@example.com')),
    p(t('Experience'), '<w:pStyle w:val="Heading1"/>'),
    p(`${t('Acme Corp')}<w:tab/>${t('2019')}<w:noBreakHyphen/>${t('2021')}`),
    p(t('Engineer')),
  )));
  const [job] = r.sections.find((s) => s.type === 'experience').items;
  assert.deepEqual([job.company, job.role, job.startDate, job.endDate], ['Acme Corp', 'Engineer', '2019', '2021']);
});
