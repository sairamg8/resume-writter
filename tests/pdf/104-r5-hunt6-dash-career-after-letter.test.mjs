// R5-HUNT6-DASH-CAREER-AFTER-LETTER: opening a cover letter makes it the store's open record, and the
// Dashboard gives Career History only the résumés. The panel then fell back to the first in the list —
// the oldest — so after a letter, Career History switched from the résumé being worked on to another
// one's name and jobs. Now it falls back to the résumé edited last (letterSources' order); the open
// résumé, when it is one, is still the one shown. The real panel, rendered to a string.
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
  const html = renderToString(createElement(MemoryRouter, null, createElement(CareerHistoryPanel, { resumes, activeId })));
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const job = (company) => ({ type: 'experience', items: [{ id: company, company, role: 'Dev', startDate: 'Jan 2018', endDate: 'Jan 2020' }] });
const older = { id: 'resume_1', name: 'Resume 1', updatedAt: 100, personal: { name: 'Ada Older' }, sections: [job('Initech')] };
const newer = { id: 'resume_2', name: 'Resume 2', updatedAt: 200, personal: { name: 'Grace Newer' }, sections: [job('Globex')] };

it('with a letter open, Career History shows the résumé edited last, not the oldest', async () => {
  const text = await panel([older, newer], 'resume_letter');
  assert.ok(text.includes('Grace Newer') && text.includes('Globex'), text);
  assert.ok(!text.includes('Ada Older') && !text.includes('Initech'), text);
});

it('the open résumé is still the one shown', async () => {
  const text = await panel([older, newer], 'resume_1');
  assert.ok(text.includes('Ada Older') && text.includes('Initech'), text);
});
