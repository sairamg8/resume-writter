// R5-HUNT12-CAREER-HISTORY-SHOWS-HIDDEN: the Career History panel (Dashboard, Job Tracker Summary)
// listed and counted a job's company, role and dates that the user hid with their eyes, or with the
// section's Show dates off, which the PDF does not print. Now careerItems gives each entry only what
// the PDF prints, so the timeline and the "N yrs … total · N companies" header follow the résumé.
// Run: node --test tests/unit/r5-hunt12-career-hidden-fields.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { careerItems, careerMonths, companyCount } from '../../src/utils/careerHistory.js';

const NOW = new Date(2026, 8, 23);
const acme = (extra = {}) => ({ id: 'a', company: 'Acme Corp', role: 'Engineer', startDate: 'Jan 2015', endDate: 'Dec 2016', ...extra });
const other = { id: 'b', company: 'Initech', role: 'Lead', startDate: 'Jan 2020', endDate: 'Jan 2021' };
const cv = (items, settings) => ({ sections: [{ type: 'experience', items, ...(settings ? { settings } : {}) }] });

test('a company, role and dates hidden by their eyes are neither listed nor counted', () => {
  const items = careerItems(cv([acme({ hiddenFields: ['company', 'role', 'startDate', 'endDate'] }), other]));
  assert.deepEqual([items[0].company, items[0].role, items[0].startDate, items[0].endDate], ['', '', '', '']);
  assert.equal(companyCount(items), 1, 'Acme is not counted');
  assert.equal(careerMonths(items, NOW), 12, 'its 23 months are not counted');
});

test("a hidden end hides a current job's Present, as the PDF does", () => {
  const [item] = careerItems(cv([acme({ current: true, endDate: '', hiddenFields: ['endDate'] })]));
  assert.equal(item.current, false);
  assert.equal(item.startDate, 'Jan 2015');
  assert.equal(careerMonths([item], NOW), 0, 'the PDF prints its start alone: no length');
});

test("Section Options → Show dates off: no dates listed or counted; company and role still are", () => {
  const items = careerItems(cv([acme(), other], { showDates: false }));
  assert.deepEqual(items.map((i) => [i.startDate, i.endDate]), [['', ''], ['', '']]);
  assert.equal(careerMonths(items, NOW), 0);
  assert.equal(companyCount(items), 2);
});

test('an entry that hides none of them is the same object', () => {
  const a = acme({ hiddenFields: ['location'] });
  assert.equal(careerItems(cv([a]))[0], a);
});
