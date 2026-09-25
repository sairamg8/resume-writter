// R2-147 (part 2) — Section Options → Separator offers Pipe for Skills: "Languages | JavaScript, Go" in
// the PDF (= the preview), the main column's and the Sidebar's side column's, and in Word, Inline and
// Bullet alike. Colon (and a section storing none) and Dash print as before. There were only Colon and
// Dash.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allText, renderDocx, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const cv = (template, separator, skillsStyle = 'inline') => resume({
  template,
  sections: [section('skills', [{ category: 'Languages', skills: 'JavaScript, Go' }], { skillsStyle, ...(separator ? { separator } : {}) })],
});
const PRINTS = { pipe: /languages \| javascript/i, colon: /languages: javascript/i, dash: /languages – javascript/i };

describe('Skills: Separator → Pipe prints "Category | skills" (R2-147)', () => {
  it('every template, Inline and Bullet: the PDF prints "Languages | JavaScript"', async () => {
    const wrong = [];
    for (const template of TEMPLATES) {
      for (const style of ['inline', 'bullet']) {
        const text = allText(await read(await render(cv(template, 'pipe', style)))).replace(/\s+/g, ' ');
        if (!PRINTS.pipe.test(text) || PRINTS.colon.test(text)) wrong.push(`${template} ${style}: ${text.slice(0, 160)}`);
      }
    }
    assert.deepEqual(wrong, []);
  });

  it('Word prints "Languages | JavaScript" too', async () => {
    for (const template of ['classic', 'sidebar']) {
      const { texts } = await renderDocx(cv(template, 'pipe'));
      assert.ok(texts.some((t) => PRINTS.pipe.test(t)), `${template}: ${texts.join(' / ')}`);
    }
  });

  it('Colon, a section storing none or one this build does not know (an import\'s "constructor"), and Dash print as before', async () => {
    for (const [separator, re] of [[undefined, PRINTS.colon], ['colon', PRINTS.colon], ['constructor', PRINTS.colon], ['toString', PRINTS.colon], ['dash', PRINTS.dash]]) {
      assert.match(allText(await read(await render(cv('classic', separator)))).replace(/\s+/g, ' '), re, String(separator));
    }
  });
});
