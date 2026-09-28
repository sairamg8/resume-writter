// R4-DVIS-18: the Job Tracker list's Contact cell. It was <td class="max-w-[140px] truncate">, but
// the table lays out automatically and a browser ignores max-width on such a cell, so a long
// contact ("Jane Doe <jane.doe@…>") kept its one line (truncate's nowrap) and widened the column
// instead of ending in an ellipsis. The 140px and the ellipsis now sit on a block inside the cell,
// which does honour max-width, and its title holds the whole contact to read on hover. The fake DOM
// has no layout: this pins where the classes are, on the real ListView (tests/pdf/fake-dom.mjs,
// loaded through Vite). Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { acme, render } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

const tokens = (el) => (el?.getAttribute('class') || '').split(/\s+/).filter(Boolean);
const kids = (el) => el.childNodes.filter((n) => n.nodeType === 1);
const contact = 'Jane Doe <jane.doe@very-long-company-domain.example>';

it('R4-DVIS-18: a long contact is cut at 140px by a block inside its cell, not by the cell', async () => {
  const { ListView } = await loadModule('/src/components/job/ListView.jsx');
  const page = await render(ListView, { jobs: [{ ...acme, contact }], resumes: [], onNavigate: () => {}, onDelete: () => {} });
  try {
    const cell = page.all().find((el) => el.tagName === 'TD' && el.textContent === contact);
    assert.ok(cell, 'the row shows the contact in a cell of its own');
    const own = tokens(cell);
    for (const t of ['max-w-[140px]', 'truncate']) assert.ok(!own.includes(t), `the cell no longer carries ${t}, which a table cell ignores: ${own.join(' ')}`);
    assert.ok(own.includes('px-3'), `the cell keeps its padding: ${own.join(' ')}`);

    const [inner] = kids(cell);
    assert.equal(inner?.tagName, 'DIV', 'a block inside the cell holds the contact');
    const got = tokens(inner);
    for (const t of ['max-w-[140px]', 'truncate']) assert.ok(got.includes(t), `the block is 140px at most and ends in an ellipsis (${t}): ${got.join(' ')}`);
    assert.equal(inner.textContent, contact);
    assert.equal(inner.getAttribute('title'), contact, 'the whole contact can be read on hover');
  } finally {
    await page.view.unmount();
  }
});

it('R4-DVIS-18: a job with no contact still shows its dash, in the same block, with no title', async () => {
  const { ListView } = await loadModule('/src/components/job/ListView.jsx');
  const page = await render(ListView, { jobs: [{ ...acme, contact: '' }], resumes: [], onNavigate: () => {}, onDelete: () => {} });
  try {
    const row = page.all().find((el) => el.tagName === 'TR' && el.getAttribute('class')?.includes('cursor-pointer'));
    assert.ok(row, 'the job\'s row');
    // Company, Role, Status, Location, Salary, Applied, Deadline, Contact: the eighth cell.
    const cell = kids(row).filter((el) => el.tagName === 'TD')[7];
    const [inner] = kids(cell);
    assert.equal(inner?.tagName, 'DIV');
    assert.equal(inner.textContent, '—');
    assert.equal(inner.getAttribute('title'), null, 'no empty tooltip');
  } finally {
    await page.view.unmount();
  }
});
