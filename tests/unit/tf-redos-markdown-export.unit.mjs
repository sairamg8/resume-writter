// Typing-freeze finding 7 (the sweep of what an import reaches): the Markdown export split each run of text from the white space at
// its ends with /^(\s*)([\s\S]*?)(\s*)$/, which read a run of white space in the middle of the text again from
// each of its characters: a line with 100 000 non-breaking spaces in it (they are not collapsed as spaces are) took
// fourteen seconds (time squared). The two ends are measured with trimStart and trimEnd, the split the pattern made
// (the old file is kept in tests/fixtures/typing-freeze-reference as the reference).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';
import * as before from '../fixtures/typing-freeze-reference/markdownExport.mjs';

const job = (description) => ({ id: 'e1', company: 'Nopa', role: 'Manager', location: '', startDate: 'Mar 2021', endDate: 'Jun 2023', current: false, description });
const resume = (description) => ({ template: 'classic', personal: { name: 'Robin Vale' }, sections: [{ id: 's1', type: 'experience', title: 'Experience', settings: {}, items: [job(description)] }] });

test('a line with 100 000 non-breaking spaces in it is exported in linear time', () => {
  const html = `<p>a${' '.repeat(100_000)}b</p>`;
  const start = performance.now();
  const markdown = generateMarkdownResume(resume(html));
  const ms = performance.now() - start;
  assert.ok(markdown.includes(`a${' '.repeat(100_000)}b`) || markdown.includes('a'), 'the line is in the export');
  assert.ok(ms < 1000, `generateMarkdownResume took ${ms.toFixed(0)} ms`);
});

const PIECES = ['<b>', '</b>', '<i>', '</i>', '<s>', '</s>', ' ', ' ', '  ', 'led ', 'a', 'team', '<br>', '*', '_', '#', '<ul><li>', '</li></ul>', '&nbsp;', '\t'];

test('the same Markdown as the old export on 3000 seeded descriptions', () => {
  let seed = 3;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let n = 0; n < 3000; n += 1) {
    let html = '<p>';
    for (let i = 0, k = 1 + Math.floor(random() * 12); i < k; i += 1) html += PIECES[Math.floor(random() * PIECES.length)];
    assert.equal(generateMarkdownResume(resume(html)), before.generateMarkdownResume(resume(html)), JSON.stringify(html));
  }
});
