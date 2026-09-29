// R5-IMP-01b: the round trip of a three-level list through the app's own PDF (Classic, the default
// Bullet style: '•', '–', '·'). The third level's '·' was no list marker to the PDF import: its item came
// back glued onto its parent ("… · Cut pages by half") or as a paragraph "· Cut pages by half" outside
// the list. Each level's item now comes back as a list item of its own, with no stray '·'.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render } from './harness.mjs';
import { pdfLines } from '../../src/utils/importFile.js';
import { resumeFromText } from '../../src/utils/importText.js';

let ctx;
let lines;

before(async () => {
  ctx = await setup();
  const fixture = resume({
    personal: { name: 'Robin Vale', title: 'Platform Engineer', email: 'robin.vale@example.com' },
    sections: [experience([{ company: 'Acme', role: 'Engineer', location: 'Austin, TX', startDate: 'Mar 2021', endDate: '', current: true,
      description: '<ul><li>Led the platform team<ul><li>Ran the on-call rota<ul><li>Cut pages by half</li></ul></li></ul></li><li>Shipped the billing service</li></ul>' }])],
  });
  lines = await pdfLines(await render(fixture), ctx.pdfjs);
}, { timeout: 120_000 });
after(teardown);

it('a third-level item comes back as a list item of its own', () => {
  const seen = lines.map((l) => l.text).join('\n');
  const job = resumeFromText(lines).sections.find((s) => s.type === 'experience')?.items[0];
  const why = `\n--- read as ---\n${seen}\n--- description ---\n${job?.description}`;
  for (const text of ['Led the platform team', 'Ran the on-call rota', 'Cut pages by half', 'Shipped the billing service']) {
    assert.match(job?.description || '', new RegExp(`<li>${text}</li>`), why);
  }
  assert.doesNotMatch(job?.description || '', /·/, why);
});
