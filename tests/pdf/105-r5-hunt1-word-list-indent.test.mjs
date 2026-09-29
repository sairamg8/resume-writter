// R5-HUNT1-word-list-indent-360-vs-720: in the Word export a list's numbered items and the further
// paragraphs of a list item sat on a 360-twip step while its bullets sit on docx's 720 (the glyph
// hanging 360), so a numbered list nested in a bullet printed its "1." in the bullet's glyph column
// and its text flush with the bullet's text (no nesting), and a second paragraph of a bulleted item
// started under the glyph. Now every item of level n has its text at 720 × (n + 1), its marker hanging
// 360, and a paragraph inside an item starts at that item's text — as the PDF (PdfRichText) prints them.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, renderDocx } from './harness.mjs';

before(setup);
after(teardown);

const para = (doc, text) => doc.paragraphs.find((p) => p.text.includes(text));
const ind = (p) => {
  const attrs = /<w:ind ([^>]*)\/>/.exec(p.xml)?.[1] || '';
  return { left: Number(/w:left="(\d+)"/.exec(attrs)?.[1] || 0), hanging: Number(/w:hanging="(\d+)"/.exec(attrs)?.[1] || 0) };
};
const docOf = (description) => renderDocx(resume({ sections: [experience([{ company: 'Acme', role: 'Lead', description }])] }));

describe('Word export: lists share one indent per level (R5-HUNT1-word-list-indent-360-vs-720)', () => {
  it('a numbered list nested in a bullet is indented beyond the bullet\'s text', async () => {
    const doc = await docOf('<ul><li>Led the platform team<ol><li>Hired 5 engineers</li><li>Cut costs 20%</li></ol></li></ul>');
    const parent = para(doc, 'Led the platform team');
    assert.match(parent.xml, /<w:ilvl w:val="0"\/>/, 'the parent is a top-level bullet (text at 720, glyph at 360)');
    for (const text of ['Hired 5 engineers', 'Cut costs 20%']) {
      const p = para(doc, text);
      assert.deepEqual(ind(p), { left: 1440, hanging: 360 }, `${text}: its marker at 1080, past the bullet's text at 720`);
      assert.match(p.xml, /<w:tab w:val="left" w:pos="1440"\/>/, `${text}: the tab takes its text to 1440`);
    }
  });

  it('a top-level numbered list sits where top-level bullets do', async () => {
    const doc = await docOf('<ol><li>First</li></ol>');
    assert.deepEqual(ind(para(doc, 'First')), { left: 720, hanging: 360 });
  });

  it('a further paragraph of a bulleted item starts at the item\'s text, not under its glyph', async () => {
    const doc = await docOf('<ul><li><p>First point</p><p>More detail on it</p></li></ul>');
    assert.deepEqual(ind(para(doc, 'More detail on it')), { left: 720, hanging: 0 });
  });
});
