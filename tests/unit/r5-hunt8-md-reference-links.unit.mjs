// R5-HUNT8-MD-REFERENCE-LINKS: the Markdown import read only inline links. Reference-style ones
// ("[LinkedIn][li]" with a "[li]: https://…" line, CommonMark's, as pandoc and many editors write them)
// lost their addresses: the contacts went to "Additional Information" with their brackets, a project was
// named "[Resume Builder][rb]" with no URL, and the definition lines printed in the last entry's
// description. Each reference now reads as the inline link it stands for, its definition as no text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';

const fromMd = (md) => resumeFromText(markdownLines(md));
const types = (r) => r.sections.map((s) => s.type);

test('reference links on the contact line and in an entry title give their addresses', () => {
  const r = fromMd([
    '# Jane Doe',
    'jane@x.com · [LinkedIn][li] · [Portfolio][site]',
    '',
    '## Projects',
    '',
    '### [Resume Builder][RB]',
    '- Built a résumé app with [React]',
    '',
    '[li]: https://linkedin.com/in/jane',
    '[site]: <https://jane.dev> "My site"',
    '[rb]: https://github.com/jane/rb',
    '[react]: https://react.dev',
  ].join('\n'));
  assert.equal(r.personal.email, 'jane@x.com');
  assert.equal(r.personal.linkedin, 'https://linkedin.com/in/jane');
  assert.equal(r.personal.website, 'https://jane.dev');
  assert.deepEqual(types(r), ['projects'], 'no "Additional Information"');
  const [p] = r.sections[0].items;
  assert.equal(p.name, 'Resume Builder');
  assert.equal(p.url, 'https://github.com/jane/rb');
  assert.doesNotMatch(p.description, /\[(?:li|site|rb)\]/i, 'no definition line in the description');
  assert.match(p.description, /<a href="https:\/\/react\.dev">React<\/a>/, 'a shortcut reference in body text is a link');
});

test('a definition line under an education section is no entry', () => {
  const r = fromMd('# Jane Doe\njane@x.com | [GitHub][gh]\n\n## Education\n### MIT — B.S.\n*2012 – 2016*\n\n[gh]: https://github.com/jane');
  assert.equal(r.personal.github, 'https://github.com/jane');
  const edu = r.sections.find((s) => s.type === 'education').items;
  assert.equal(edu.length, 1);
  assert.equal(edu[0].institution, 'MIT');
});

test('a bracketed label with no definition, or text that only looks like one, stays as written', () => {
  const r = fromMd('# Jane Doe\n\n## Projects\n### Tool\n- Rewrote the [legacy] parser\n\n[Note]: kept for the reader');
  const d = r.sections.find((s) => s.type === 'projects').items[0].description;
  assert.match(d, /\[legacy\]/);
  assert.match(d, /\[Note\]: kept for the reader/);
});
