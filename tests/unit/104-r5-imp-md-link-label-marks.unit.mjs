// R4-SW-I-04: a Markdown link whose label is bold, italic or code — "[**Bold**](https://x.com)" — lost
// its link on import: the label was kept with its marks ("**Bold**") while the line lost them, so the
// rich text never found it, and the description showed "Bold (https://x.com)" as plain text. The marks
// are formatting, not the label: it now links "Bold" to its address, as a plain [Bold](url) does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';

const description = (bullets) => {
  const r = resumeFromText(markdownLines([
    '# Pat Sample',
    '',
    '## Experience',
    '### **Acme** — *Engineer*',
    '*Mar 2021 – Present*',
    '',
    ...bullets,
  ].join('\n')));
  return r.sections.find((s) => s.type === 'experience').items[0].description;
};

test('a bold label is the link\'s label, its marks off', () => {
  const [line] = markdownLines('- [**Bold**](https://x.com) here');
  assert.equal(line.text, '• Bold (https://x.com) here');
  assert.deepEqual(line.links, [{ label: 'Bold', url: 'https://x.com' }]);
});

test('bold, italic, underscore and code labels all import as links, no bracketed address left', () => {
  assert.equal(
    description(['- [**Bold**](https://x.com) here', '- [plain](https://y.com) there']),
    '<ul><li><a href="https://x.com">Bold</a> here</li><li><a href="https://y.com">plain</a> there</li></ul>',
  );
  for (const [label, shown] of [['*it*', 'it'], ['_it_', 'it'], ['__bd__', 'bd'], ['`code`', 'code'], ['**Two words**', 'Two words']]) {
    assert.equal(description([`- See [${label}](https://x.com/p) now`]), `<ul><li>See <a href="https://x.com/p">${shown}</a> now</li></ul>`, label);
  }
});

test('an escaped label still links as it did', () => {
  assert.equal(description(['- [v\\_2 notes](https://x.com) here']), '<ul><li><a href="https://x.com">v_2 notes</a> here</li></ul>');
});
