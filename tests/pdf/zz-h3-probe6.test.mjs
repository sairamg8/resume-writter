// PROBE: orphaned entry headers with longer first bullets.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, render, read, resume, section, experience, TEMPLATES, bodyItems } from './harness.mjs';

before(setup);
after(teardown);

const WORDS = 'delivered measurable improvements across the platform while coordinating with several partner teams and documenting every decision for later review';
const text = (chars, i) => `Item ${i} ${WORDS} ${WORDS} ${WORDS}`.slice(0, chars).trim();
const HEAD = /^(Company \d+|Role \d+|Professional Experience|PROFESSIONAL EXPERIENCE)\b/;

function build(template, n, chars) {
  const mk = (k) => `<ul>${Array.from({ length: k }, (_, i) => `<li>${text(chars, i)}</li>`).join('')}</ul>`;
  return resume({
    template,
    personal: { name: 'Jordan Rivera', title: 'Engineer', email: 'a@b.co', phone: '+1 555 0100', location: 'Austin', summary: '<p>Short summary.</p>' },
    sections: [
      experience([{ description: mk(n) }, { description: mk(3) }, { description: mk(3) }]),
      section('education', [{ institution: 'University', degree: 'BSc', fieldOfStudy: 'CS', location: 'X', startDate: '2010', endDate: '2014', description: '' }]),
    ],
  });
}

describe('probe 6', () => {
  it('sweep', async () => {
    const hits = [];
    let renders = 0;
    for (const template of TEMPLATES) {
      for (const chars of [240, 330]) {
        for (let n = 3; n <= 16; n += 1) {
          renders += 1;
          try {
            const pages = await read(await render(build(template, n, chars)));
            pages.forEach((p, i) => {
              if (i === pages.length - 1) return;
              const items = bodyItems(p, i);
              if (!items.length) return;
              const lowest = Math.min(...items.map((t) => t.y));
              const text = items.filter((t) => Math.abs(t.y - lowest) < 2).map((t) => t.str).join(' ').trim();
              if (HEAD.test(text)) hits.push(`${template}/c${chars}/n${n}/p${i + 1}`);
            });
          } catch (e) { hits.push(`${template}/c${chars}/n${n} THROW ${String(e.message).slice(0, 80)}`); }
        }
      }
    }
    assert.fail(`PROBE6 renders=${renders} hits=${hits.length}: ${hits.slice(0, 60).join(' ')}`);
  });
});
