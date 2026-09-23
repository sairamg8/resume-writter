// The Career History panel (Dashboard, Job Tracker) sums the experience the résumé prints (AUD-29).
// It measured from the oldest start to today, so a gap, an end date and an ended career all counted
// as time worked; a past job with no end date ran to today although the PDF prints its start alone;
// "N companies" counted entries, so a promotion was two companies; and it read the first experience
// section only, hidden entries and hidden sections included. Every case here is built from ended
// jobs, so none depends on today's date (tests/unit/career-history.unit.mjs covers current jobs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

/** The Career History panel's text for one résumé holding `sections`. */
async function panel(sections) {
  const { CareerHistoryPanel } = await loadModule('/src/components/CareerHistoryPanel.jsx');
  const resumes = [{ id: 'r', personal: { name: 'Sam' }, sections }];
  const html = renderToString(createElement(MemoryRouter, null, createElement(CareerHistoryPanel, { resumes, activeId: 'r' })));
  return html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

const job = (id, company, startDate, endDate, extra = {}) => ({ id, company, role: 'Dev', startDate, endDate, ...extra });
const exp = (...items) => ({ type: 'experience', items });

describe('Career History total and count (AUD-29)', () => {
  it('a past job with no end date has no length and adds nothing: the PDF prints its start alone', async () => {
    const text = await panel([exp(job('a', 'Initech', 'Jan 2020', '', { current: false }), job('b', 'Globex', 'Jan 2010', 'Jan 2012'))]);
    assert.match(text, /Initech Dev Jan 2020 /, text);
    assert.ok(text.includes('2 years total · 2 companies'), text);
  });

  it('a promotion at one company is one company, whatever its spacing or case', async () => {
    const text = await panel([exp(job('a', 'Initech', 'Jan 2018', 'Jan 2020'), job('b', ' initech ', 'Jan 2020', 'Jan 2022'))]);
    assert.ok(text.includes('4 years total · 1 company'), text);
  });

  it('a gap between jobs is not career time', async () => {
    const text = await panel([exp(job('a', 'A', 'Jan 2010', 'Jan 2012'), job('b', 'B', 'Jan 2020', 'Jan 2022'))]);
    assert.ok(text.includes('4 years total'), text);
  });

  it('two jobs at once count their months once', async () => {
    const text = await panel([exp(job('a', 'A', 'Jan 2018', 'Jan 2022'), job('b', 'B', 'Jan 2020', 'Jan 2021'))]);
    assert.ok(text.includes('4 years total'), text);
  });

  it('a hidden entry and a hidden section are neither listed nor counted, as the PDF leaves them out', async () => {
    const text = await panel([
      exp(job('a', 'Old', 'Jan 2000', 'Jan 2001', { visible: false }), job('b', 'Initech', 'Jan 2020', 'Jan 2022')),
      { ...exp(job('c', 'Secret', 'Jan 1990', 'Jan 1999')), visible: false },
    ]);
    assert.ok(text.includes('2 years total · 1 company'), text);
    assert.ok(!text.includes('Old') && !text.includes('Secret'), text);
  });

  it('reads every experience section, not the first alone', async () => {
    const text = await panel([exp(job('a', 'A', 'Jan 2010', 'Jan 2012')), exp(job('b', 'B', 'Jan 2020', 'Jan 2022'))]);
    assert.ok(text.includes('4 years total · 2 companies'), text);
    assert.match(text, /A Dev 2yr Jan 2010 – Jan 2012/, text);
  });
});
