// R4-SW-I-01: the round trip of a nested list through the app's own PDF (Classic). The PDF prints a
// nested item's marker where its parent's text starts; the PDF import read every item as level 0. Each
// item's line now carries the level it was printed at, as the Word and Markdown imports' lines do.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render } from './harness.mjs';
import { pdfLines } from '../../src/utils/importFile.js';

let ctx;
let lines;

before(async () => {
  ctx = await setup();
  const fixture = resume({
    personal: { name: 'Robin Vale', title: 'Platform Engineer', email: 'robin.vale@example.com' },
    sections: [experience([{ company: 'Acme', role: 'Engineer', location: 'Austin, TX', startDate: 'Mar 2021', endDate: '', current: true,
      description: '<ul><li>Led the platform team<ul><li>Ran the on-call rota<ul><li>Cut pages by half</li></ul></li><li>Wrote the runbooks</li></ul></li><li>Shipped the billing service</li></ul>' }])],
  });
  lines = await pdfLines(await render(fixture), ctx.pdfjs);
}, { timeout: 120_000 });
after(teardown);

it('each list item\'s line carries the level it was printed at', () => {
  const seen = lines.map((l) => `${l.depth || 0} ${l.text}`).join('\n');
  const depthOf = (text) => lines.find((l) => l.text.endsWith(text))?.depth || 0;
  assert.deepEqual(
    ['Led the platform team', 'Ran the on-call rota', 'Cut pages by half', 'Wrote the runbooks', 'Shipped the billing service'].map(depthOf),
    [0, 1, 2, 1, 0],
    `\n--- read as ---\n${seen}`,
  );
});
