// R2-148: Import took JSON alone. A résumé in PDF, Word, Markdown or plain text is now read into a new
// résumé — src/utils/importText.js reads the text, src/utils/importFile.js gets the text out of the
// file. These pin the reading on text written the ways people and the app's exporters write it: the
// header (name, job title, every contact), the sections by their headings (the app's titles and the
// ATS aliases; an unknown heading a custom section), entries found by their dates with their fields,
// and that nothing is lost. The round trip through the app's own four exports: tests/pdf/99-*.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { resumeFromText, readDateRange, headingType, markdownLines } from '../../src/utils/importText.js';
import { docxLines, docxXmlLines, pdfPageLines, pdfLinesOfPages } from '../../src/utils/importFile.js';

// A fictional person, as the ATS text export lays a résumé out.
const ATS = `AVERY QUINN
Senior Data Engineer
avery.quinn@example.com | +1 555 0142 | Portland, OR | linkedin.com/in/avery-quinn-sample | averyquinn.example.com | github.com/avery-quinn-sample

PROFESSIONAL SUMMARY
----------------------------------------
Data engineer with nine years of building reliable pipelines for analytics teams.

PROFESSIONAL EXPERIENCE
----------------------------------------
Northwind Analytics - Senior Data Engineer
Mar 2021 - Present | Portland, OR
* Built the streaming pipeline that feeds every dashboard.
* Cut warehouse costs by a third.

Contoso Freight - Data Engineer
06/2017 - 02/2021 | Remote
* Moved nightly batch jobs to Airflow.

EDUCATION
----------------------------------------
B.S. - in Computer Science - Lakeside University
2013 - 2017 | Seattle, WA | GPA: 3.8

SKILLS
----------------------------------------
Programming: Python, SQL, Scala
Platforms: Spark, Airflow, AWS

LANGUAGES
----------------------------------------
English: Native
Spanish: Professional

CERTIFICATIONS
----------------------------------------
AWS Certified Data Engineer - Amazon Web Services - Jun 2022
Expires: Jun 2025 | ID: DEA-12345

MENTORING LOG
----------------------------------------
Coached three bootcamp students through their first SQL projects.`;

const byType = (r, type) => r.sections.filter((s) => s.type === type);
const words = (s) => String(s).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];

describe('resumeFromText: a plain-text résumé', () => {
  const r = resumeFromText(ATS);

  test('the header: the name (out of capitals), the job title and every contact', () => {
    assert.equal(r.personal.name, 'Avery Quinn');
    assert.equal(r.personal.title, 'Senior Data Engineer');
    assert.equal(r.personal.email, 'avery.quinn@example.com');
    assert.equal(r.personal.phone, '+1 555 0142');
    assert.equal(r.personal.location, 'Portland, OR');
    assert.equal(r.personal.linkedin, 'linkedin.com/in/avery-quinn-sample');
    assert.equal(r.personal.website, 'averyquinn.example.com');
    assert.equal(r.personal.github, 'github.com/avery-quinn-sample');
    assert.match(r.personal.summary, /^<p>Data engineer with nine years/);
    assert.equal(r.name, 'Avery Quinn Resume');
  });

  test('a section per heading, of the type it names, titled as written; an unknown heading a custom section', () => {
    assert.deepEqual(r.sections.map((s) => [s.type, s.title]), [
      ['experience', 'Professional Experience'], ['education', 'Education'], ['skills', 'Skills'],
      ['languages', 'Languages'], ['certifications', 'Certifications'], ['custom', 'Mentoring Log'],
    ]);
    assert.match(byType(r, 'custom')[0].items[0].description, /Coached three bootcamp students/);
  });

  test('jobs: company, role, dates (a current one), location and the list', () => {
    const [a, b] = byType(r, 'experience')[0].items;
    assert.deepEqual([a.company, a.role, a.startDate, a.endDate, a.current, a.location], ['Northwind Analytics', 'Senior Data Engineer', 'Mar 2021', '', true, 'Portland, OR']);
    assert.equal(a.description, '<ul><li>Built the streaming pipeline that feeds every dashboard.</li><li>Cut warehouse costs by a third.</li></ul>');
    assert.deepEqual([b.company, b.role, b.startDate, b.endDate, b.current, b.location], ['Contoso Freight', 'Data Engineer', '06/2017', '02/2021', false, 'Remote']);
    assert.equal(b.description, '<ul><li>Moved nightly batch jobs to Airflow.</li></ul>');
  });

  test('education, skills, languages and a certificate, field by field', () => {
    const [ed] = byType(r, 'education')[0].items;
    assert.deepEqual([ed.degree, ed.fieldOfStudy, ed.institution, ed.startDate, ed.endDate, ed.location, ed.gpa],
      ['B.S.', 'Computer Science', 'Lakeside University', '2013', '2017', 'Seattle, WA', '3.8']);
    assert.deepEqual(byType(r, 'skills')[0].items.map((i) => [i.category, i.skills]), [['Programming', 'Python, SQL, Scala'], ['Platforms', 'Spark, Airflow, AWS']]);
    assert.deepEqual(byType(r, 'languages')[0].items.map((i) => [i.language, i.proficiency]), [['English', 'Native'], ['Spanish', 'Professional']]);
    const [c] = byType(r, 'certifications')[0].items;
    assert.deepEqual([c.name, c.issuer, c.date, c.expiry, c.credentialId], ['AWS Certified Data Engineer', 'Amazon Web Services', 'Jun 2022', 'Jun 2025', 'DEA-12345']);
  });

  test('nothing is lost: every word of the file is in the résumé (the summary\'s heading, "Present" and "Expires:" aside, read as fields)', () => {
    const kept = new Set(words(JSON.stringify(r)));
    const lost = [...new Set(words(ATS))].filter((w) => !kept.has(w) && !['present', 'summary', 'expires'].includes(w));
    assert.deepEqual(lost, []);
  });

  test('the shape every résumé has: ids, the editor\'s blank fields, Classic', () => {
    assert.equal(r.template, 'classic');
    assert.ok(r.id && r.sections.every((s) => s.id && s.visible && s.settings && s.items.every((i) => i.id)));
    const [job] = byType(r, 'experience')[0].items;
    assert.ok(Array.isArray(job.bullets), 'the blank entry\'s fields come with it');
    assert.equal(r.coverLetter.closing, 'Sincerely');
  });
});

describe('resumeFromText: what lands where it cannot be placed', () => {
  test('header text that is no contact: a sentence to the summary, the rest to "Additional Information"', () => {
    const r = resumeFromText('Robin Vale\nProduct Designer\nrobin@example.org\nOpen to relocation\nI design calm, accessible tools for people who work with data all day.\n\nEXPERIENCE\nFabrikam Studio — Lead Designer\n2019 – 2023');
    assert.equal(r.personal.email, 'robin@example.org');
    assert.match(r.personal.summary, /calm, accessible tools/);
    const extra = r.sections.find((s) => s.title === 'Additional Information');
    assert.match(extra?.items[0].description || '', /Open to relocation/);
    const [job] = byType(r, 'experience')[0].items;
    assert.deepEqual([job.company, job.role, job.startDate, job.endDate], ['Fabrikam Studio', 'Lead Designer', '2019', '2023']);
  });

  test('a section with no dates keeps its lines: an entry per block, its list under it', () => {
    const r = resumeFromText('Kai Moreno\n\nPROJECTS\nLantern\n- A tiny static site generator\n\nOrbit Notes\n- Markdown notes that sync');
    assert.deepEqual(byType(r, 'projects')[0].items.map((i) => [i.name, i.description]), [
      ['Lantern', '<ul><li>A tiny static site generator</li></ul>'],
      ['Orbit Notes', '<ul><li>Markdown notes that sync</li></ul>'],
    ]);
  });

  test('a text with no headings at all: the name, and the rest kept', () => {
    const r = resumeFromText('Sam Lee\nsam@example.net\nLikes building things.');
    assert.equal(r.personal.name, 'Sam Lee');
    assert.equal(r.personal.email, 'sam@example.net');
    assert.match(r.personal.summary, /Likes building things/);
  });
});

describe('the pieces', () => {
  test('dates in the app\'s Date formats and as people type them', () => {
    assert.deepEqual(readDateRange('Mar 2021 – Present'), { start: 'Mar 2021', end: '', current: true, text: 'Mar 2021 – Present' });
    assert.deepEqual(readDateRange('03/2019 - 12/2020'), { start: '03/2019', end: '12/2020', current: false, text: '03/2019 - 12/2020' });
    assert.equal(readDateRange('2013-2017').end, '2017');
    assert.equal(readDateRange('2019-05').start, '2019-05', 'YYYY-MM is a month, not a range');
    assert.equal(readDateRange('September 2020 to June 2022').end, 'June 2022');
    assert.equal(readDateRange('– Present').current, true);
    for (const no of ['Portland, OR', 'Python 3', '+1 555 0142', 'Built 12 services']) assert.equal(readDateRange(no), null, no);
  });

  test('headings: the app\'s titles, the ATS aliases, any case or spacing', () => {
    assert.equal(headingType('PROFESSIONAL EXPERIENCE'), 'experience');
    assert.equal(headingType('Work History'), 'experience');
    assert.equal(headingType('Awards & Honors'), 'awards');
    assert.equal(headingType('AWARDS AND HONORS'), 'awards');
    assert.equal(headingType('Technical Skills:'), 'skills');
    assert.equal(headingType('Profile'), 'summary');
    assert.equal(headingType('Volunteering'), 'volunteering');
    assert.equal(headingType('Publications'), 'custom');
    assert.equal(headingType('Northwind Analytics'), null);
  });

  test('Markdown: # the name, ## headings, ### entries, lists and marks', () => {
    const lines = markdownLines('# Avery Quinn\n**Data Engineer**\n\n## Experience\n### **Northwind** — *Engineer*\n*Mar 2021 – Present | Portland, OR*\n\n- Built [the pipeline](https://example.com)');
    assert.deepEqual(lines, [
      { text: 'Avery Quinn', hint: 'name' }, { text: 'Data Engineer' }, { text: '' },
      { text: 'Experience', hint: 'heading' }, { text: 'Northwind — Engineer', hint: 'entry' },
      // A link keeps its address beside its text (R4-IMP-02).
      // …and its label and address, for the rich text to link (R4-LO-05).
      { text: 'Mar 2021 – Present | Portland, OR' }, { text: '' },
      { text: '• Built the pipeline (https://example.com)', links: [{ label: 'the pipeline', url: 'https://example.com' }] },
    ]);
    const r = resumeFromText(lines);
    const [job] = byType(r, 'experience')[0].items;
    assert.deepEqual([r.personal.title, job.company, job.role, job.current, job.location], ['Data Engineer', 'Northwind', 'Engineer', true, 'Portland, OR']);
  });

  test('Word: paragraphs as lines, a list paragraph behind "• ", Heading styles marked, tabs and breaks kept', async () => {
    const doc = new Document({ sections: [{ children: [
      new Paragraph({ children: [new TextRun('Avery Quinn')] }),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('EXPERIENCE')] }),
      new Paragraph({ children: [new TextRun('Northwind & Co'), new TextRun({ text: '\tMar 2021 – Present' }), new TextRun({ text: 'Engineer', break: 1 })] }),
      new Paragraph({ bullet: { level: 0 }, children: [new TextRun('Built <things>')] }),
    ] }] });
    const lines = await docxLines(new Uint8Array(await Packer.toBuffer(doc)));
    assert.deepEqual(lines.filter((l) => l.text), [
      { text: 'Avery Quinn', hint: undefined }, { text: 'EXPERIENCE', hint: 'heading' },
      { text: 'Northwind & Co\tMar 2021 – Present\nEngineer', hint: undefined }, { text: '• Built <things>', hint: undefined },
    ]);
    const [job] = byType(resumeFromText(lines), 'experience')[0].items;
    assert.deepEqual([job.company, job.role, job.startDate, job.description], ['Northwind & Co', 'Engineer', 'Mar 2021', '<ul><li>Built &lt;things&gt;</li></ul>']);
  });

  test('Word XML: a paragraph\'s tab stops are not tabs in its text', () => {
    const xml = '<w:body><w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="9000"/></w:tabs></w:pPr><w:r><w:t>A</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t xml:space="preserve">B &amp; C</w:t></w:r></w:p></w:body>';
    assert.deepEqual(docxXmlLines(xml), [{ text: 'A\tB & C', hint: undefined }]);
  });

  test('PDF: a line per baseline, a wide gap a tab, a marker joined, a wrapped line joined back', () => {
    const item = (str, x, y, w, h = 10) => ({ str, x, y, w, h });
    const page = [
      item('Mar 2021 – Present', 480, 700, 80, 9), item('Northwind', 40, 700, 50), item('Analytics', 93, 700, 45),
      item('•', 44, 687, 4), item('Built the pipeline that feeds every dashboard in the company and', 56, 687, 504),
      item('more', 56, 674, 22),
      item('•', 44, 661, 4), item('Cut costs.', 56, 661, 50),
    ];
    assert.deepEqual(pdfPageLines(page).map((l) => l.text), ['Northwind Analytics\tMar 2021 – Present', '• Built the pipeline that feeds every dashboard in the company and', 'more', '• Cut costs.']);
    assert.deepEqual(pdfLinesOfPages([page]).map((l) => l.text), ['Northwind Analytics\tMar 2021 – Present', '• Built the pipeline that feeds every dashboard in the company and more', '• Cut costs.', '']);
  });

  test('PDF: two fields the app sets 8 pt apart on one line (PdfItemHeader\'s fieldGap) are two fields, not one', () => {
    const item = (str, x, w) => ({ str, x, y: 700, w, h: 12 });
    assert.deepEqual(pdfPageLines([item('Senior Data Engineer', 40, 120), item('Northwind Analytics', 168, 110)]).map((l) => l.text), ['Senior Data Engineer\tNorthwind Analytics']);
    assert.deepEqual(pdfPageLines([item('Senior', 40, 38), item('Data', 81, 26)]).map((l) => l.text), ['Senior Data'], 'a word gap stays a space');
  });
});
