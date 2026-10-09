// H3-458: the Word letter's closing and signature keep together (keepNext), but nothing kept them with the
// paragraph above, nor with the empty paragraph that spaces them from it: a letter whose body ended at
// the foot of a page began the next page with "Sincerely," and the name, and no word of the letter (the PDF's
// twin is H3-457). The body's last paragraph and the gap under it now keep with the closing; the paragraphs
// before it are free to break wherever Word breaks them, so a long letter is not pushed whole to a new page.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, loadModule, readDocx } from './harness.mjs';

before(setup);
after(teardown);

const para = (i) => `<p>Paragraph ${i}: I would welcome the chance to discuss how my background could help your team.</p>`;

async function letterXml(body) {
  const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
  const r = resume({
    template: 'classic',
    personal: { name: 'Jordan Rivera', title: 'Engineer', email: 'a@b.co' },
    coverLetter: { body, recipientName: 'Sam Lee', company: 'Acme', subject: 'Application', closing: 'Sincerely', date: '2026-10-01' },
  });
  const { xml } = readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
  return xml.split('</w:p>');
}

describe('H3-458 Word letter: the last paragraph keeps with the closing', () => {
  it('a paragraph body', async () => {
    const paras = await letterXml([0, 1, 2].map(para).join(''));
    const at = (needle) => paras.findIndex((p) => p.includes(needle));
    const last = at('Paragraph 2:');
    assert.ok(last > 0);
    assert.match(paras[last], /<w:keepNext\/>/, 'the last paragraph keeps with what follows');
    assert.match(paras[last + 1], /<w:keepNext\/>/, 'so does the gap under it');
    assert.ok(paras[last + 2].includes('Sincerely'), 'the closing follows the gap');
    assert.doesNotMatch(paras[at('Paragraph 0:')], /<w:keepNext\/>/, 'an earlier paragraph is free to break');
    assert.doesNotMatch(paras[at('Paragraph 1:')], /<w:keepNext\/>/, 'so is the next');
  });

  it('a list body: the last item keeps with the closing', async () => {
    const paras = await letterXml('<p>Intro line.</p><ul><li>First point</li><li>Last point</li></ul>');
    const last = paras.findIndex((p) => p.includes('Last point'));
    assert.match(paras[last], /<w:keepNext\/>/);
    assert.doesNotMatch(paras[paras.findIndex((p) => p.includes('First point'))], /<w:keepNext\/>/);
  });
});
