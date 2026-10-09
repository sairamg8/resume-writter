// PROBE: cover letter pagination sweep. Is the closing or signature left alone on the last page?
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, renderCover, read, resume, TEMPLATES, bodyItems } from './harness.mjs';

before(setup);
after(teardown);

const para = (i) => `<p>Paragraph ${i}: I would welcome the chance to discuss how my background in platform engineering, mentoring and delivery could help your team reach its goals this year, and I have attached details of recent projects for your review.</p>`;

describe('probe 13', () => {
  it('letters', async () => {
    const hits = [];
    let renders = 0;
    for (const template of TEMPLATES) {
      for (let n = 6; n <= 20; n += 1) {
        renders += 1;
        try {
          const r = resume({
            template,
            personal: { name: 'Jordan Rivera', title: 'Engineer', email: 'a@b.co', phone: '+1 555 0100', location: 'Austin' },
            coverLetter: { body: Array.from({ length: n }, (_, i) => para(i)).join(''), recipientName: 'Sam Lee', company: 'Acme', subject: 'Application', closing: 'Sincerely', date: '2026-10-01' },
          });
          const pages = await read(await renderCover(r));
          if (pages.length > 1) {
            const last = pages[pages.length - 1];
            const items = bodyItems(last, pages.length - 1);
            const lines = new Set(items.map((t) => Math.round(t.y))).size;
            const first = items.slice().sort((a, b) => b.y - a.y)[0]?.str || '';
            if (lines <= 4) hits.push(`${template}/n${n}: last page ${lines} lines starting "${first.slice(0, 20)}"`);
            if (/^Sincerely/.test(first)) hits.push(`${template}/n${n}: CLOSING-ALONE`);
          }
        } catch (e) { hits.push(`${template}/n${n} THROW ${String(e.message).slice(0, 80)}`); }
      }
    }
    assert.fail(`PROBE13 renders=${renders} hits=${hits.length}: ${hits.slice(0, 40).join(' ¦ ')}`);
  });
});
