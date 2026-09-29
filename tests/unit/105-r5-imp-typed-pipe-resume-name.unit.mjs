// IMP-REV-3 (R4-SW-I-05 review): a "|" typed in the person's name came back right in personal.name,
// but the résumé's own name (the Dashboard's and the editor's title) was built before the typed-pipe
// placeholder was put back, so it held the noncharacter U+FDD0: "Pat <U+FDD0> Sample Resume".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

test('a typed "|" in the name: the résumé\'s name holds it as "|", no placeholder stored', () => {
  const md = generateMarkdownResume({ personal: { name: 'Pat | Sample', email: 'pat@example.com' }, sections: [] });
  const r = resumeFromText(markdownLines(md));
  assert.equal(r.personal.name, 'Pat | Sample', md);
  assert.equal(r.name, 'Pat | Sample Resume', md);
  assert.ok(!JSON.stringify(r).includes('\uFDD0'), 'no placeholder is stored');
});
