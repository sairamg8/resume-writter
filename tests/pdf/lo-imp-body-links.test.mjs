// R4-LO-05: the round trip of a link inside body text. A fictional résumé whose summary and job bullet
// each hold a link is exported by the app's own PDF, Word and Markdown code and read back: the link
// comes back as a link in the rich text, <a href="…">label</a>. Before, it came back as plain text,
// "label (https://…)".
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, loadModule } from './harness.mjs';
import { pdfLines, docxLines } from '../../src/utils/importFile.js';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';

let ctx;
const read = {};

before(async () => {
  ctx = await setup();
  const fixture = resume({
    personal: {
      name: 'Robin Vale', title: 'Platform Engineer', email: 'robin.vale@example.com',
      summary: '<p>Maintainer of <a href="https://github.com/robin-vale-sample/tidewater">Tidewater</a>, a change-data-capture tool.</p>',
    },
    sections: [experience([{ company: 'Acme', role: 'Engineer', location: 'Austin, TX', startDate: 'Mar 2021', endDate: '', current: true,
      description: '<ul><li>Wrote the <a href="https://docs.example.com/api">partner API docs</a> used by forty teams.</li><li>Shipped the billing service.</li></ul>' }])],
  });
  const { renderResumeDocx } = await loadModule('/src/utils/wordExport.js');
  const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
  const lines = {
    PDF: await pdfLines(await render(fixture), ctx.pdfjs),
    Word: await docxLines(new Uint8Array(await (await renderResumeDocx(fixture)).arrayBuffer())),
    Markdown: markdownLines(generateMarkdownResume(fixture)),
  };
  for (const [kind, l] of Object.entries(lines)) read[kind] = { resume: resumeFromText(l), seen: l.map((x) => x.text).join('\n') };
}, { timeout: 120_000 });
after(teardown);

describe('a link in body text comes back as a link', () => {
  for (const kind of ['PDF', 'Word', 'Markdown']) {
    it(kind, () => {
      const { resume: r, seen } = read[kind];
      const job = r.sections.find((s) => s.type === 'experience')?.items[0];
      const why = `\n--- ${kind} read as ---\n${seen}\n--- imported ---\n${JSON.stringify({ summary: r.personal.summary, job }, null, 1)}`;
      assert.match(job?.description || '', /Wrote the <a href="https:\/\/docs\.example\.com\/api">partner API docs<\/a> used by forty teams\./, why);
      assert.match(r.personal.summary, /Maintainer of <a href="https:\/\/github\.com\/robin-vale-sample\/tidewater">Tidewater<\/a>, a change-data-capture tool\./, why);
    });
  }
});
