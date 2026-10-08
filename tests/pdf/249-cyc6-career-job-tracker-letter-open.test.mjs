// CYC6 Career History on the Job Tracker: the Job Tracker hands the panel every record, letters included
// (the Dashboard hands it the résumés only). With a cover letter as the open record the panel looked the
// open id up among all of them and drew the LETTER: a copy of a résumé made when the letter was started,
// so its name and jobs were that moment's, not the résumé's as it is now. Now a letter is never the one
// drawn: the open id is looked up among the résumés, and a letter open shows the résumé edited last.
// The real panel, rendered to a string, as 104-r5-hunt6-dash-career-after-letter does.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

async function panel(resumes, activeId) {
  const { CareerHistoryPanel } = await loadModule('/src/components/CareerHistoryPanel.jsx');
  const html = renderToString(createElement(MemoryRouter, null, createElement(CareerHistoryPanel, { resumes, activeId, showJobTrackerLink: false, variant: 'workspace' })));
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const job = (company) => ({ type: 'experience', items: [{ id: company, company, role: 'Dev', startDate: 'Jan 2018', endDate: 'Jan 2020' }] });
const older = { id: 'resume_1', name: 'Resume 1', updatedAt: 100, personal: { name: 'Ada Older' }, sections: [job('Initech')] };
const newer = { id: 'resume_2', name: 'Resume 2', updatedAt: 200, personal: { name: 'Grace Newer' }, sections: [job('Globex'), job('Hooli')] };
// The letter was copied from `newer` before Hooli was added to it.
const letter = { id: 'resume_letter', kind: 'letter', name: 'Cover Letter', updatedAt: 300, personal: { name: 'Grace Newer' }, sections: [job('Globex')] };

it('with a letter open on the Job Tracker, the résumé edited last is drawn, not the letter\'s copy', async () => {
  const text = await panel([older, newer, letter], 'resume_letter');
  assert.ok(text.includes('Hooli'), text);
  assert.ok(!text.includes('Ada Older') && !text.includes('Initech'), text);
});

it('the open résumé is still the one shown, letters in the list or not', async () => {
  const text = await panel([older, newer, letter], 'resume_1');
  assert.ok(text.includes('Ada Older') && text.includes('Initech'), text);
  assert.ok(!text.includes('Grace Newer'), text);
});

it('a list of letters only still draws something', async () => {
  const text = await panel([letter], 'resume_letter');
  assert.ok(text.includes('Grace Newer') && text.includes('Globex'), text);
});
