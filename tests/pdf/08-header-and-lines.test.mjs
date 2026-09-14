// Header contact lines and line breaking.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, read, allItems, allText } from './harness.mjs';

before(setup);
after(teardown);

const PERSONAL = {
  email: 'firstname.lastname@example.com', phone: '+1 555 0100', location: 'San Francisco, California',
  website: 'https://www.example.com/', linkedin: 'linkedin.com/in/firstname-lastname', github: 'github.com/firstname',
};

describe('header contacts', () => {
  for (const template of ['classic', 'minimal', 'executive']) {
    it(`${template}: contact lines are links (FIDA-26)`, async () => {
      const pages = await read(await render(resume({ template, personal: PERSONAL })));
      const urls = pages[0].links.map((l) => l.url);
      for (const u of ['mailto:firstname.lastname@example.com', 'tel:+15550100', 'https://www.example.com/', 'https://linkedin.com/in/firstname-lastname', 'https://github.com/firstname']) {
        assert.ok(urls.includes(u), `${u} in ${urls.join(', ')}`);
      }
      assert.ok(allText(pages).includes('example.com'), 'a website prints without https://www.');
      assert.ok(!allText(pages).includes('https://'), allText(pages));
    });
  }

  for (const contactStyle of ['bar', 'bullet']) {
    it(`${contactStyle} style: a wrapped contact line never starts with a separator (FIDA-10)`, async () => {
      for (const size of [10, 11, 12, 13, 14]) {
        const pages = await read(await render(resume({ settings: { contactStyle, fontSizeBase: size }, personal: PERSONAL })));
        const lines = new Map();
        for (const t of allItems(pages).filter((it) => it.y > pages[0].H - 140)) {
          const key = Math.round(t.y);
          lines.set(key, [...(lines.get(key) || []), t].sort((a, b) => a.x - b.x));
        }
        for (const [, items] of lines) {
          assert.ok(!/^[|•]/.test(items[0].str.trim()), `size ${size}: a line starts with "${items[0].str}"`);
        }
        assert.ok(allText(pages).includes('San Francisco, California'), 'a value is never split');
      }
    });
  }
});

describe('line breaking', () => {
  it('no hyphen appears where formatting changes inside a word (FIDB-56)', async () => {
    for (let n = 0; n < 24; n += 1) {
      const lead = Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
      const pages = await read(await render(resume({ sections: [experience([{ description: `<p>${lead} live pre<strong>view</strong> and PDF/<em>Word</em> export ${lead}</p>` }])] })));
      const text = allItems(pages).map((t) => t.str).join('\n');
      assert.ok(!/-\n|pre-|PDF\/-/.test(text), `lead ${n}: a hyphen was inserted:\n${text}`);
    }
  });
});
