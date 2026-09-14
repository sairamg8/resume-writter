import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, read, allText } from './harness.mjs';

before(setup);
after(teardown);

// Every render in a session shares react-pdf's font objects, so the order below matters: the
// first document embeds composite glyphs ("·" is built from the period, "é" from "e") before
// the second one ever lays out their components.
it('text copies out intact after composite glyphs were embedded earlier in the session', async () => {
  await render(resume({ personal: { title: 'Role · City' }, sections: [experience([{ description: '<p>Café résumé</p>' }])] }));
  const pages = await read(await render(resume({
    personal: { email: 'me@example.com' },
    sections: [experience([{ description: '<p>Ends with a period. Then more.</p>' }])],
  })));
  const text = allText(pages);
  assert.ok(text.includes('me@example.com'), text);
  assert.ok(text.includes('Ends with a period. Then more.'), text);
});
