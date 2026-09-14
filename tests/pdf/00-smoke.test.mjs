import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, teardown, resume, experience, render, renderCover, read, allText, TEMPLATES,
} from './harness.mjs';

before(setup);
after(teardown);

for (const template of TEMPLATES) {
  it(`${template}: prints the name, title and an entry`, async () => {
    const pages = await read(await render(resume({
      template,
      sections: [experience([{ company: 'Acme', role: 'Developer', description: '<p>Built things</p>' }])],
    })));
    const text = allText(pages);
    assert.equal(pages.length, 1);
    for (const s of ['Test Person', 'Engineer', 'Acme', 'Developer', 'Built things']) assert.ok(text.includes(s), `"${s}" in: ${text}`);
  });
}

it('cover letter: prints the body and the closing', async () => {
  const pages = await read(await renderCover(resume({
    coverLetter: { body: '<p>I would like to apply.</p>', closing: 'Kind regards' },
  })));
  const text = allText(pages);
  assert.ok(text.includes('I would like to apply.'), text);
  assert.ok(text.includes('Kind regards'), text);
});
