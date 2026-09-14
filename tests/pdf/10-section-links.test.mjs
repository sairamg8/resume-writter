// Entry links in the main-column sections: a URL or e-mail printed in an entry is clickable.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allText, drawState } from './harness.mjs';

before(setup);
after(teardown);

// Sidebar prints projects, certifications and references through its own components.
const MAIN_COLUMN = ['classic', 'modern', 'minimal', 'executive'];

const sections = () => [
  section('projects', [
    { name: 'My App', url: 'github.com/user/app', technologies: 'React' },
    { name: 'Bad Link', url: 'javascript:alert(1)' },
  ]),
  section('certifications', [
    { name: 'AWS Architect', issuer: 'Amazon', date: '2023', url: 'https://aws.example.com/cert/123', urlLabel: 'Verify' },
  ]),
  section('references', [{ name: 'Jane Doe', jobTitle: 'CTO', email: 'jane@acme.com', phone: '+1 555 0100' }]),
];

describe('entry links (FIDB-14)', () => {
  for (const template of MAIN_COLUMN) {
    it(`${template}: project and certificate URLs, reference e-mail and phone are links`, async () => {
      const bytes = await render(resume({ template, sections: sections() }));
      const pages = await read(bytes);
      const urls = pages.flatMap((p) => p.links.map((l) => l.url));
      for (const u of ['https://github.com/user/app', 'https://aws.example.com/cert/123', 'mailto:jane@acme.com', 'tel:+15550100']) {
        assert.ok(urls.includes(u), `${u} in [${urls.join(', ')}]`);
      }
      assert.ok(!urls.some((u) => /javascript/i.test(u || '')), 'an unsafe URL is never a link');
      const text = allText(pages);
      for (const s of ['github.com/user/app', 'Verify', 'jane@acme.com', 'javascript:alert(1)']) assert.ok(text.includes(s), `"${s}" printed`);
      // A link keeps its colour: react-pdf paints links blue unless told otherwise.
      const [hit] = await drawState(bytes, 'github.com/user/app');
      assert.notEqual(hit.fill.toLowerCase(), '#0000ff');
    });
  }
});
