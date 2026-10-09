// PROBE: geometry of a long link in a 3-column Grid after the cell break.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, render, read, resume, section, experience, overlaps, MM } from './harness.mjs';

before(setup);
after(teardown);

const word = 'https://example.com/a/very/long/path/segment';

describe('probe 15', () => {
  it('geometry', async () => {
    const r = resume({
      template: 'classic',
      settings: { pageSize: 'A4', marginH: 15 },
      personal: { name: 'Jordan Rivera', title: 'Engineer', email: 'a@b.co', phone: '+1 555 0100', location: 'Austin', summary: '<p>Short.</p>' },
      sections: [
        experience(Array.from({ length: 3 }, (_, i) => ({ company: `Co${i}`, role: word, location: 'X', startDate: '2020', endDate: '2021', description: `<ul><li>Did ${word} things.</li></ul>` })), { columns: 3 }),
        section('projects', Array.from({ length: 3 }, () => ({ name: word, technologies: word, description: `<p>${word}</p>` })), { columns: 3 }),
      ],
    });
    const pages = await read(await render(r));
    const p = pages[0];
    const rows = p.items.filter((t) => t.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x).map((t) => `${t.str.slice(0, 22)}@${Math.round(t.x)}+${Math.round(t.w)}y${Math.round(t.y)}`);
    const ov = overlaps(p).map((o) => `${o[0].slice(0, 14)}|${o[1].slice(0, 14)}`);
    assert.fail(`PROBE15 W=${Math.round(p.W)} margin=${Math.round(15 * MM)} OV=${ov.join(',')} ITEMS=${rows.slice(0, 70).join(' ¦ ')}`);
  });
});
