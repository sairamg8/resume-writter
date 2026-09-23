// The editor reads an entry's dates as the PDF does (src/utils/dates.js). The month picker shows
// every month and year the PDF prints — an imported "05/2023", "2019-05" or 2019 too — and the
// Career History timeline (Dashboard, Job Tracker) prints them in the résumé's Date format and
// measures the picker's "Jan 2020". A year imported as a number threw in both; with no error
// boundary in the app, a throw in a render blanks the whole page.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const NOW = new Date().getFullYear();

/** The month and the year a MonthPicker holding `value` shows selected. */
async function picked(value) {
  const { MonthPicker } = await loadModule('/src/components/SectionEditorShared.jsx');
  const html = renderToString(createElement(MonthPicker, { label: 'Start Date', value, onChange() {} }));
  return [...html.matchAll(/<option value="([^"]*)" selected="">/g)].map((m) => m[1]);
}

describe('the month picker shows every stored month and year', () => {
  const CASES = [
    // [stored, [month, year] selected]
    ['Jan 2024', ['Jan', '2024']],
    ['Jan', ['Jan', '']], // the picker's own month before a year is chosen
    ['', ['', '']],
    [undefined, ['', '']],
    ['Summer 2020', ['', '2020']], // free text: as the picker always read it
    ['05/2023', ['May', '2023']],
    ['2019-05', ['May', '2019']],
    ['January 2020', ['Jan', '2020']],
    ['2019', ['', '2019']],
    [2019, ['', '2019']],
    // AUD-28: a year outside the list's window (5 ahead, 49 back) showed blank; the PDF prints it.
    ['Jan 1975', ['Jan', '1975']],
    [1975, ['', '1975']],
    ['05/1970', ['May', '1970']],
    ['Summer 1975', ['', '1975']], // as 'Summer 2020' reads
    [`Jun ${NOW + 10}`, ['Jun', String(NOW + 10)]], // a certificate that expires in ten years
  ];
  for (const [stored, want] of CASES) {
    it(`${JSON.stringify(stored)} shows ${JSON.stringify(want)}`, async () => {
      assert.deepEqual(await picked(stored), want);
    });
  }
});

/** The year select's choices, in order, for a MonthPicker holding `value`. */
async function yearsOffered(value) {
  const { MonthPicker } = await loadModule('/src/components/SectionEditorShared.jsx');
  const html = renderToString(createElement(MonthPicker, { label: 'Start Date', value, onChange() {} }));
  return [...html.slice(html.lastIndexOf('<select')).matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
}

describe('the year list (AUD-28)', () => {
  const WINDOW = Array.from({ length: 55 }, (_, i) => String(NOW + 5 - i));

  it('a year in the window, or none: five years ahead down to 49 back, as before', async () => {
    for (const v of ['Jan 2024', '', 'Q1 FY24']) assert.deepEqual(await yearsOffered(v), WINDOW, v);
  });

  it('a stored year outside the window is added in its place, newest first', async () => {
    assert.deepEqual(await yearsOffered('Jan 1975'), [...WINDOW, '1975']);
    assert.deepEqual(await yearsOffered(`Jun ${NOW + 10}`), [String(NOW + 10), ...WINDOW]);
  });

  it('counts from the year it is rendered in, not the year the page loaded', async () => {
    const { yearOptions } = await loadModule('/src/components/SectionEditorShared.jsx');
    assert.deepEqual([yearOptions('', 2030).at(0), yearOptions('', 2030).at(-1)], ['2035', '1981']);
    assert.deepEqual(yearOptions('1980', 2030).slice(-2), ['1981', '1980']);
  });
});

/** The Career History panel's text for one résumé holding `items` as its experience. */
async function timeline(items, settings) {
  const { CareerHistoryPanel } = await loadModule('/src/components/CareerHistoryPanel.jsx');
  const resumes = [{ id: 'r', personal: { name: 'Sam' }, settings, sections: [{ type: 'experience', items }] }];
  const html = renderToString(createElement(MemoryRouter, null, createElement(CareerHistoryPanel, { resumes, activeId: 'r' })));
  return html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

describe('the Career History timeline', () => {
  const PICKED = { id: 'a', company: 'Initech', role: 'Lead', startDate: 'Jan 2020', endDate: 'Mar 2023' };

  it('measures the picker\'s dates: "Jan 2020 – Mar 2023" is 3yr 2mo', async () => {
    const text = await timeline([PICKED]);
    assert.match(text, /Initech Lead 3yr 2mo Jan 2020 – Mar 2023/);
    // AUD-29: the total ends where the job does, and one company is "1 company".
    assert.ok(text.includes('3 yrs 2 mos total · 1 company'), `the career total: ${text}`);
  });

  it('a year imported as a number prints and measures like one typed', async () => {
    const text = await timeline([{ id: 'n', company: 'Globex', role: 'Dev', startDate: 2019, endDate: 2021 }]);
    assert.match(text, /Globex Dev 2yr 2019 – 2021/);
  });

  it('prints each date in the résumé\'s Date format, "Present" for a current job', async () => {
    const items = [PICKED, { id: 'b', company: 'Globex', role: 'Dev', startDate: '05/2023', endDate: '', current: true }];
    const text = await timeline(items, { dateFormat: 'MMMM YYYY' });
    assert.ok(text.includes('January 2020 – March 2023'), text);
    assert.ok(text.includes('May 2023 – Present'), text);
    assert.ok((await timeline(items, { dateFormat: 'YYYY' })).includes('2020 – 2023'));
  });

  it('no format stored: each date as stored; an end alone as "– end", as the PDF prints it', async () => {
    const text = await timeline([{ ...PICKED, startDate: '01/2020' }, { id: 'e', company: 'Umbrella', role: 'Ops', startDate: '', endDate: 'Jun 2019' }]);
    assert.ok(text.includes('01/2020 – Mar 2023'), text);
    assert.ok(text.includes('Umbrella Ops – Jun 2019'), text);
  });
});
