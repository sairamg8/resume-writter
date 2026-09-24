// Markdown prints the contact line as the PDF does (R2-129): a website, LinkedIn or GitHub shows
// its Display label when it has one (it printed "LinkedIn" / "GitHub" whatever the label), and
// links to its Link URL only through the PDF's safeHref — a `javascript:` override became a live
// link, and a bare "example.com/me" override a relative one. A hidden field stays out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

const contactLine = (personal) => generateMarkdownResume({ personal: { name: 'Pat Sample', ...personal }, sections: [] })
  .split('\n').filter(Boolean)[1] || '';

test('a Display label prints as the link text, the Link URL as its target', () => {
  const line = contactLine({
    linkedin: 'linkedin.com/in/pat', linkedinLabel: 'Pat on LI', linkedinUrl: 'https://li.example/pat',
    github: 'github.com/pat', githubLabel: 'pat-code',
    website: 'pat.example', websiteLabel: 'Portfolio',
  });
  assert.ok(line.includes('[Pat on LI](https://li.example/pat)'), line);
  assert.ok(line.includes('[pat-code](https://github.com/pat)'), line);
  assert.ok(line.includes('[Portfolio](https://pat.example)'), line);
});

test('with no label a link field prints its address as the PDF does, without the scheme', () => {
  const line = contactLine({ linkedin: 'https://www.linkedin.com/in/pat/', github: 'github.com/pat' });
  assert.ok(line.includes('[linkedin.com/in/pat](https://www.linkedin.com/in/pat/)'), line);
  assert.ok(line.includes('[github.com/pat](https://github.com/pat)'), line);
});

test('a Link URL the PDF would not follow is no link; a bare-domain one links https://', () => {
  const bad = contactLine({ linkedin: 'linkedin.com/in/pat', linkedinUrl: 'javascript:alert(1)' });
  assert.ok(!bad.includes('javascript:'), bad);
  assert.ok(bad.includes('linkedin.com/in/pat'), bad);
  const bare = contactLine({ github: 'github.com/pat', githubUrl: 'code.example/pat' });
  assert.ok(bare.includes('(https://code.example/pat)'), bare);
});

test('e-mail links mailto:, and a hidden field stays out', () => {
  const line = contactLine({ email: 'pat@example.com', phone: '+1 555 0100', location: 'Berlin', github: 'github.com/pat', githubLabel: 'pat-code', hiddenFields: ['github', 'phone'] });
  assert.ok(line.includes('[pat@example.com](mailto:pat@example.com)'), line);
  assert.ok(line.includes('Berlin'), line);
  assert.ok(!line.includes('pat-code') && !line.includes('555'), line);
});
