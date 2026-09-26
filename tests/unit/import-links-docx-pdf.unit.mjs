// R4-IMP-10: a contact shown in a PDF or a Word file as its Display label ("LinkedIn", "Code") lost its
// URL on import: the PDF reader read only the text layer, never the page's Link annotations, and the
// Word reader only <w:t> text, never a hyperlink's target in document.xml.rels. The piece "LinkedIn"
// was then dropped as a bare label. The link's address is now read, and fills the contact's field.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Document, ExternalHyperlink, Packer, Paragraph, TextRun } from 'docx';
import { docxLines, pdfLines } from '../../src/utils/importFile.js';
import { resumeFromText } from '../../src/utils/importText.js';

test('Word: a hyperlink shown as a label reads with its target, and fills the contact', async () => {
  const link = (text, url) => new ExternalHyperlink({ link: url, children: [new TextRun(text)] });
  const doc = new Document({ sections: [{ children: [
    new Paragraph('Robin Vale'),
    new Paragraph({ children: [
      link('robin.vale@example.com', 'mailto:robin.vale@example.com'), new TextRun(' | '),
      link('LinkedIn', 'https://www.linkedin.com/in/robin-vale-sample'), new TextRun(' | '),
      link('Code', 'https://github.com/robin-vale-sample'), new TextRun(' | '),
      link('robinvale.example.com', 'https://robinvale.example.com'),
    ] }),
  ] }] });
  const lines = await docxLines(new Uint8Array(await Packer.toBuffer(doc)));
  assert.equal(lines[1].text, 'robin.vale@example.com | LinkedIn (https://www.linkedin.com/in/robin-vale-sample) | Code (https://github.com/robin-vale-sample) | robinvale.example.com');
  const p = resumeFromText(lines).personal;
  assert.equal(p.email, 'robin.vale@example.com');
  assert.equal(p.linkedin, 'https://www.linkedin.com/in/robin-vale-sample');
  assert.equal(p.github, 'https://github.com/robin-vale-sample');
  assert.equal(p.website, 'robinvale.example.com');
  assert.deepEqual([p.linkedinLabel, p.githubLabel], ['LinkedIn', 'Code']);
});

/** pdf.js, as far as pdfLines uses it: one page of `items` ({ str, x, y, w, h }) and its `links`. */
const pdfjsOf = (items, links) => ({
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({
        getTextContent: async () => ({ items: items.map((it) => ({ str: it.str, transform: [it.h, 0, 0, it.h, it.x, it.y], width: it.w, height: it.h })) }),
        getAnnotations: async () => links.map(([rect, url]) => ({ subtype: 'Link', rect, url })),
      }),
    }),
    destroy: async () => {},
  }),
});

test('PDF: the text under a Link annotation reads with its address when it is a label, as it was when it is the address', async () => {
  const items = [
    { str: 'Robin Vale', x: 50, y: 760, w: 90, h: 20 },
    { str: 'robin.vale@example.com', x: 50, y: 735, w: 110, h: 10 },
    { str: 'LinkedIn', x: 190, y: 735, w: 40, h: 10 },
    { str: 'Code', x: 260, y: 735, w: 22, h: 10 },
    { str: 'robinvale.example.com', x: 310, y: 735, w: 100, h: 10 },
  ];
  const links = [
    [[49, 732, 161, 745], 'mailto:robin.vale@example.com'],
    [[189, 732, 231, 745], 'https://www.linkedin.com/in/robin-vale-sample'],
    [[259, 732, 283, 745], 'https://github.com/robin-vale-sample'],
    [[309, 732, 411, 745], 'https://robinvale.example.com'],
  ];
  const lines = await pdfLines(new Uint8Array([1]), pdfjsOf(items, links));
  const p = resumeFromText(lines).personal;
  assert.equal(p.name, 'Robin Vale');
  assert.equal(p.email, 'robin.vale@example.com');
  assert.equal(p.linkedin, 'https://www.linkedin.com/in/robin-vale-sample', JSON.stringify(lines));
  assert.equal(p.github, 'https://github.com/robin-vale-sample', JSON.stringify(lines));
  assert.equal(p.website, 'robinvale.example.com', JSON.stringify(lines));
  assert.deepEqual([p.linkedinLabel, p.githubLabel], ['LinkedIn', 'Code']);
});

// The review of R4-IMP-10: Design → Contact style Bar or Bullet sets the contact line as one run of
// text, which pdf.js reads as one item. Each link gives it only the letters its box holds.
test('PDF: a contact line read as one item: each link\'s address after its own label, the others as they were', async () => {
  // 6 pt a letter: every piece's box is its letters' share of the line.
  const line = 'robin.vale@example.com | LinkedIn | Code | robinvale.example.com';
  const at = (piece) => 50 + line.indexOf(piece) * 6;
  const box = (piece) => [at(piece) - 0.5, 732, at(piece) + piece.length * 6 + 0.5, 745];
  const items = [
    { str: 'Robin Vale', x: 50, y: 760, w: 90, h: 20 },
    { str: line, x: 50, y: 735, w: line.length * 6, h: 10 },
  ];
  const links = [
    [box('robin.vale@example.com'), 'mailto:robin.vale@example.com'],
    [box('LinkedIn'), 'https://www.linkedin.com/in/robin-vale-sample'],
    [box('Code'), 'https://github.com/robin-vale-sample'],
    [box('robinvale.example.com'), 'https://robinvale.example.com'],
  ];
  const lines = await pdfLines(new Uint8Array([1]), pdfjsOf(items, links));
  assert.equal(lines[1].text, 'robin.vale@example.com | LinkedIn (https://www.linkedin.com/in/robin-vale-sample) | Code (https://github.com/robin-vale-sample) | robinvale.example.com');
  const p = resumeFromText(lines).personal;
  assert.deepEqual([p.email, p.linkedin, p.github, p.website], ['robin.vale@example.com', 'https://www.linkedin.com/in/robin-vale-sample', 'https://github.com/robin-vale-sample', 'robinvale.example.com']);
  assert.deepEqual([p.linkedinLabel, p.githubLabel], ['LinkedIn', 'Code']);
});
