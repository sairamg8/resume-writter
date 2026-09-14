// The cover letter PDF: the business-letter block (date, recipient, subject).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, renderCover, read, allItems, allText } from './harness.mjs';

before(setup);
after(teardown);

const LETTER = {
  date: '2026-01-15',
  recipientName: 'Sarah Smith',
  recipientTitle: 'Engineering Manager',
  company: 'Globex Corp',
  subject: 'Application for the Senior Engineer role',
  body: '<p>Dear Sarah,</p><p>I am excited to apply.</p>',
};

/** The one text item that is exactly `str`. */
function item(pages, str) {
  const hits = allItems(pages).filter((t) => t.str.trim() === str);
  assert.equal(hits.length, 1, `one "${str}" in: ${allText(pages)}`);
  return hits[0];
}

/** The letterhead's name (the signature repeats it lower down). */
const letterhead = (pages) => allItems(pages).filter((t) => t.str === 'Test Person').sort((a, b) => b.y - a.y)[0];

describe('cover letter — date, recipient and subject (FIDB-49)', () => {
  it('prints date → recipient name, title, company → subject between the letterhead and the body', async () => {
    const pages = await read(await renderCover(resume({ coverLetter: LETTER })));
    const order = [letterhead(pages), ...['15 January 2026', 'Sarah Smith', 'Engineering Manager', 'Globex Corp',
      'Application for the Senior Engineer role', 'Dear Sarah,'].map((s) => item(pages, s))];
    for (let i = 1; i < order.length; i += 1) {
      assert.ok(order[i].y < order[i - 1].y, `"${order[i].str}" (y ${order[i].y}) prints below "${order[i - 1].str}" (y ${order[i - 1].y})`);
    }
    const body = item(pages, 'Dear Sarah,');
    for (const t of order.slice(1)) assert.ok(Math.abs(t.x - body.x) < 0.5, `"${t.str}" starts at the body's margin`);
    assert.match(item(pages, 'Sarah Smith').font, /Bold/, 'the recipient name is bold');
    assert.match(item(pages, 'Application for the Senior Engineer role').font, /Bold/, 'the subject is bold');
  });

  it('an ISO date prints as a written date; anything else prints as typed', async () => {
    const iso = await read(await renderCover(resume({ coverLetter: { date: '2026-03-01' } })));
    assert.ok(allText(iso).includes('1 March 2026'), allText(iso));
    assert.ok(!allText(iso).includes('2026-03-01'));
    const typed = await read(await renderCover(resume({ coverLetter: { date: 'March 1st, 2026' } })));
    assert.ok(allText(typed).includes('March 1st, 2026'), allText(typed));
  });

  it('prints each line only when it is filled — a new letter prints none of them', async () => {
    const some = await read(await renderCover(resume({ coverLetter: { company: 'Globex Corp', subject: 'Re: the role', body: '<p>Hello</p>' } })));
    const text = allText(some);
    assert.ok(text.includes('Globex Corp') && text.includes('Re: the role'), text);
    assert.ok(!text.includes('Hiring Manager'), `no recipient title the user did not type: ${text}`);

    const blank = await read(await renderCover(resume({ coverLetter: { body: '<p>Hello</p>' } })));
    const bare = await read(await renderCover(resume({ coverLetter: {
      body: '<p>Hello</p>', date: ' ', recipientName: '', recipientTitle: '', company: '', subject: '',
    } })));
    assert.equal(allText(blank), 'Test Person Engineer Hello Sincerely, Test Person Engineer');
    assert.equal(item(bare, 'Hello').y, item(blank, 'Hello').y, 'blank fields leave no gap');
  });
});
