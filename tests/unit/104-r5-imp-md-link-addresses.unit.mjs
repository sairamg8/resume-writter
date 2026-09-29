// R5-IMP-01: the Markdown import took bold and italic marks off a whole line, addresses and all: a
// link to "https://x.com/_foo_" printed "(https://x.com/foo)" beside its label, a wrong address as
// visible text, and a written-out "https://x.com/*a*/b" became "https://x.com/a/b". An address — a
// link's, an <autolink> or one written out — is never Markdown to format: it comes back as written,
// and a description link exported to Markdown imports with the same address it had.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

const job = (r) => r.sections.find((s) => s.type === 'experience').items[0];
const description = (bullets) => job(resumeFromText(markdownLines([
  '# Pat Sample', '', '## Experience', '### **Acme** — *Engineer*', '*Mar 2021 – Present*', '', ...bullets,
].join('\n')))).description;

test('a link\'s address keeps its underscores and asterisks in the line', () => {
  assert.equal(markdownLines('- See [docs](https://x.com/_foo_) now')[0].text, '• See docs (https://x.com/_foo_) now');
  assert.equal(markdownLines('[p](https://x.com/a__b__c) and <https://x.com/*a*/b>')[0].text, 'p (https://x.com/a__b__c) and https://x.com/*a*/b');
  assert.equal(markdownLines('see https://x.com/*a*/b and **www.x.com/_u_** too')[0].text, 'see https://x.com/*a*/b and www.x.com/_u_ too');
});

test('the description links the address, with no altered address left as text', () => {
  assert.equal(description(['- See [docs](https://x.com/_foo_) now']), '<ul><li>See <a href="https://x.com/_foo_">docs</a> now</li></ul>');
  assert.equal(description(['- Notes at https://x.com/*a*/b']), '<ul><li>Notes at <a href="https://x.com/*a*/b">https://x.com/*a*/b</a></li></ul>');
});

test('a header link keeps its address', () => {
  const r = resumeFromText(markdownLines('# Pat Sample\n\n[X profile](https://x.com/_pat_) | pat@example.com\n'));
  assert.equal(r.personal.website, 'https://x.com/_pat_');
});

test('the export\'s own Markdown: a description link and an address typed as text come back as they were', () => {
  const md = generateMarkdownResume({
    personal: { name: 'Pat Sample' },
    sections: [{ id: 's1', type: 'experience', title: 'Experience', settings: {}, items: [{
      id: 'e1', company: 'Acme', role: 'Engineer', startDate: 'Mar 2021', current: true,
      description: '<ul><li>Wrote <a href="https://x.com/_foo_/a__b__c">the guide</a></li><li>Mirror at https://x.com/_bar_ now</li></ul>',
    }] }],
  });
  const r = resumeFromText(markdownLines(md));
  assert.equal(job(r).description,
    '<ul><li>Wrote <a href="https://x.com/_foo_/a__b__c">the guide</a></li><li>Mirror at <a href="https://x.com/_bar_">https://x.com/_bar_</a> now</li></ul>');
});

// An address in a code span took its closing backtick into the kept address, so the code pass found one
// backtick and left both: "See `<a href=\"https://x.com/a`\">…`</a> now". Both backticks come off again.
test('an address in a code span loses both its backticks, not only the opening one', () => {
  assert.equal(markdownLines('- See `https://x.com/a` now')[0].text, '• See https://x.com/a now');
  assert.equal(description(['- See `https://x.com/a` now']), '<ul><li>See <a href="https://x.com/a">https://x.com/a</a> now</li></ul>');
  assert.equal(description(['- `https://code.com/_x_` in code']), '<ul><li><a href="https://code.com/_x_">https://code.com/_x_</a> in code</li></ul>');
});
