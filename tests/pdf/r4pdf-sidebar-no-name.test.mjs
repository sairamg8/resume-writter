// R4-PDF-04: a Sidebar résumé with no Full Name prints 'Your Name' at the top of its column, as every
// other template, the Sidebar's Word export and its letterhead do. It printed an empty line there (with
// its margin), a blank gap under the photo.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, read, allText, itemsWith } from './harness.mjs';

before(setup);
after(teardown);

describe('The Sidebar with no name (R4-PDF-04)', () => {
  it('prints "Your Name" in its column, as Classic does', async () => {
    for (const template of ['sidebar', 'classic']) {
      const pages = await read(await render(resume({ template, personal: { name: '', title: 'Engineer' } })));
      assert.match(allText(pages), /Your Name/, template);
    }
  });

  it('in the column, above the job title', async () => {
    const pages = await read(await render(resume({ template: 'sidebar', personal: { name: '', title: 'Engineer' } })));
    const [name] = itemsWith(pages, 'Your');
    const [title] = itemsWith(pages, 'Engineer');
    assert.ok(name && title);
    assert.ok(name.x < pages[0].W * 0.4, 'in the side column');
    assert.ok(name.y > title.y + 1, 'on a line of its own, above the title');
  });
});
