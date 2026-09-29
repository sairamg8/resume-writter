// R5-HUNT7-ROLE-AT-COMPANY: a job header written "Role at Company" or "Role @ Company" (LinkedIn's and
// many AI tools' phrasing) was not split: the whole line became the role and the company was empty.
// It is the role, then the company now, as "Role, Company" and "Role — Company" are.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText, markdownLines } from '../../src/utils/importText.js';

const jobs = (r) => r.sections.find((s) => s.type === 'experience').items.map((j) => [j.role, j.company, j.startDate]);

test('text: "Role at Company" and "Role @ Company" beside the dates', () => {
  const r = resumeFromText('Jane Doe\njane@x.com\n\nExperience\nSoftware Engineer at Acme Corp\tJan 2020 – Present\n• Built things\n\nData Analyst @ Globex\t2017 – 2019\n• Did stuff');
  assert.deepEqual(jobs(r), [['Software Engineer', 'Acme Corp', 'Jan 2020'], ['Data Analyst', 'Globex', '2017']]);
});

test('Markdown: "### Role at Company" over its dates', () => {
  const r = resumeFromText(markdownLines('# Jane Doe\n\njane@x.com\n\n## Experience\n\n### Software Engineer at Acme Corp\n*January 2020 - Present*\n\n- Built things'));
  assert.deepEqual(jobs(r).map((j) => j.slice(0, 2)), [['Software Engineer', 'Acme Corp']]);
});

test('with a place after it, and with a comma in the role', () => {
  const r = resumeFromText('Jane Doe\njane@x.com\n\nExperience\nSoftware Engineer at Acme Corp | Austin, TX\tJan 2020 – Present\nProduct Manager, Payments at Globex\t2017 – 2019');
  const items = r.sections.find((s) => s.type === 'experience').items;
  assert.deepEqual([items[0].role, items[0].company, items[0].location], ['Software Engineer', 'Acme Corp', 'Austin, TX']);
  assert.deepEqual([items[1].role, items[1].company], ['Product Manager, Payments', 'Globex']);
});

test('a company with "at" in its name and no role word before it stays whole', () => {
  const r = resumeFromText('Jane Doe\njane@x.com\n\nExperience\nMade at Home Bakery\tJan 2020 – Present\nBaker');
  const [job] = r.sections.find((s) => s.type === 'experience').items;
  assert.equal(job.company, 'Made at Home Bakery');
});
