// R4-IMP-10: the round trip of contacts shown as a Display label. A fictional résumé whose LinkedIn and
// GitHub print as "LinkedIn" and "Code" is exported by the app's own PDF and Word code and read back:
// each contact's URL comes back from the link under its label (the PDF's Link annotation, the Word
// hyperlink's target), with the label as its Display label. Before, both URLs were lost.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, loadModule } from './harness.mjs';
import { pdfLines, docxLines } from '../../src/utils/importFile.js';
import { resumeFromText } from '../../src/utils/importText.js';

let ctx;
const read = {};

before(async () => {
  ctx = await setup();
  const fixture = resume({
    personal: {
      name: 'Robin Vale', title: 'Product Designer', email: 'robin.vale@example.com', phone: '+1 555 0199', location: 'Austin, TX',
      linkedin: 'linkedin.com/in/robin-vale-sample', linkedinLabel: 'LinkedIn',
      github: 'github.com/robin-vale-sample', githubLabel: 'Code',
      summary: '<p>Product designer who ships design systems.</p>',
    },
  });
  const { renderResumeDocx } = await loadModule('/src/utils/wordExport.js');
  const lines = {
    PDF: await pdfLines(await render(fixture), ctx.pdfjs),
    Word: await docxLines(new Uint8Array(await (await renderResumeDocx(fixture)).arrayBuffer())),
  };
  for (const [kind, l] of Object.entries(lines)) read[kind] = { personal: resumeFromText(l).personal, seen: l.map((x) => x.text).join('\n') };
}, { timeout: 120_000 });
after(teardown);

describe('a contact shown as its Display label keeps its URL through the app\'s own exports', () => {
  for (const kind of ['PDF', 'Word']) {
    it(kind, () => {
      const { personal: p, seen } = read[kind];
      const why = `\n--- ${kind} read as ---\n${seen}\n--- personal ---\n${JSON.stringify(p, null, 1)}`;
      assert.match(p.linkedin, /linkedin\.com\/in\/robin-vale-sample$/, why);
      assert.match(p.github, /github\.com\/robin-vale-sample$/, why);
      assert.deepEqual([p.linkedinLabel, p.githubLabel], ['LinkedIn', 'Code'], why);
      assert.equal(p.email, 'robin.vale@example.com', why);
      assert.equal(p.phone, '+1 555 0199', why);
    });
  }
});
