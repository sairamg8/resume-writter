// R5-HUNT11-NAME-FONT-OBJECT-CRASHES-DESIGN: a native .json whose settings.nameFont or headingFont is
// not text. Dashboard → Import runs only normalizeResume on it, which never checked those keys, so an
// object ({ "family": "Lora" }) stayed in the store and the cloud copy. Design → Typography's Name Font
// and Heading Font rows put it in their option list and React threw ("Objects are not valid as a React
// child"): "Something went wrong" in place of the editor each time Typography opened, on every synced
// device; the PDF printed the font '[object Object]' (Noto Sans in its place). Now normalizeResume
// drops a value that is not text, so the row reads "Same as text" and the PDF prints Font Family's.
// Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, experience, render, read, allText } from './harness.mjs';

before(setup);
after(teardown);

async function imported(r) {
  const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
  return normalizeResume(r);
}

const base = (settings) => resume({
  personal: { name: 'Ann Vale', email: 'ann@example.com' },
  sections: [experience([{ company: 'Harbor Works', role: 'Pilot' }])],
  settings,
});

describe('Name Font and Heading Font that are not text', () => {
  for (const key of ['nameFont', 'headingFont']) {
    for (const bad of [{ family: 'Lora' }, ['Lora'], 5, true]) {
      it(`${key} ${JSON.stringify(bad)} is dropped on the way in, and the PDF renders`, async () => {
        const r = await imported(base({ [key]: bad }));
        assert.equal(Object.hasOwn(r.settings, key), false, `before: ${JSON.stringify(bad)} stayed in settings.${key}`);
        const text = allText(await read(await render(r)));
        assert.ok(text.includes('Ann Vale') && text.includes('Harbor Works'), text);
      });
    }
  }

  it('text is kept as it is: a picker id, a custom font, and "Same as text"', async () => {
    const r = await imported(base({ nameFont: 'georgia', headingFont: 'Lora' }));
    assert.equal(r.settings.nameFont, 'georgia');
    assert.equal(r.settings.headingFont, 'Lora');
    const blank = await imported(base({ nameFont: '' }));
    assert.equal(blank.settings.nameFont, '');
  });
});
