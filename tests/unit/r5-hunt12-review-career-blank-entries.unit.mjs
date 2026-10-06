// R5-HUNT12-REVIEW (second look at R5-HUNT12-CAREER-HISTORY-SHOWS-HIDDEN): the Career History panel
// listed an entry the PDF leaves out because it prints nothing — a blank entry (a section just added),
// or one whose company, role and dates are all hidden with their eyes — as an empty row with its dot
// on the timeline. The PDF's renderers draw printedEntries only (entryPrints); careerItems now lists
// the same entries. Fictional data only.
// Run: node --test tests/unit/r5-hunt12-review-career-blank-entries.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { careerItems, companyCount } from '../../src/utils/careerHistory.js';

const cv = (items) => ({ sections: [{ type: 'experience', items }] });

test('a blank entry is not listed', () => {
  const items = careerItems(cv([{ id: 'blank', company: '', role: '', startDate: '', endDate: '', description: '', bullets: [] }, { id: 'b', company: 'Initech', role: 'Lead' }]));
  assert.deepEqual(items.map((i) => i.id), ['b']);
});

test('an entry with company, role and dates all hidden is not listed', () => {
  const hidden = { id: 'h', company: 'Acme Corp', role: 'Engineer', startDate: 'Jan 2015', endDate: 'Dec 2016', hiddenFields: ['company', 'role', 'startDate', 'endDate'] };
  const items = careerItems(cv([hidden, { id: 'b', company: 'Initech', role: 'Lead' }]));
  assert.deepEqual(items.map((i) => i.id), ['b']);
  assert.equal(companyCount(items), 1);
});

test('an entry whose company is hidden but whose role prints is still listed, with no company', () => {
  const [item] = careerItems(cv([{ id: 'r', company: 'Acme Corp', role: 'Engineer', hiddenFields: ['company'] }]));
  assert.equal(item.role, 'Engineer');
  assert.equal(item.company, '');
});
