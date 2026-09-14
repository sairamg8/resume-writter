// Header contact lines and line breaking.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, teardown, resume, experience, render, renderCover, read, allItems, allText, TEMPLATES,
} from './harness.mjs';

before(setup);
after(teardown);

const PERSONAL = {
  email: 'firstname.lastname@example.com', phone: '+1 555 0100', location: 'San Francisco, California',
  website: 'https://www.example.com/', linkedin: 'linkedin.com/in/firstname-lastname', github: 'github.com/firstname',
};

/** Every document with a contact header: the five résumé templates and the cover letter. */
const DOCUMENTS = [
  ...TEMPLATES.map((template) => [template, (personal) => render(resume({ template, personal }))]),
  ['cover letter', (personal) => renderCover(resume({ personal }))],
];

describe('header contacts', () => {
  for (const [name, make] of DOCUMENTS) {
    it(`${name}: contact lines are links (FIDA-26, FIDB-14)`, async () => {
      const pages = await read(await make(PERSONAL));
      const urls = pages[0].links.map((l) => l.url);
      for (const u of ['mailto:firstname.lastname@example.com', 'tel:+15550100', 'https://www.example.com/', 'https://linkedin.com/in/firstname-lastname', 'https://github.com/firstname']) {
        assert.ok(urls.includes(u), `${u} in ${urls.join(', ')}`);
      }
      assert.ok(allText(pages).includes('example.com'), 'a website prints without https://www.');
      assert.ok(!allText(pages).includes('https://'), allText(pages));
    });

    it(`${name}: a contact prints its display label and links to its Link URL`, async () => {
      const pages = await read(await make({ ...PERSONAL, linkedinLabel: 'My LinkedIn', linkedinUrl: 'https://www.linkedin.com/in/other/' }));
      assert.ok(pages[0].links.some((l) => l.url === 'https://www.linkedin.com/in/other/'), pages[0].links.map((l) => l.url).join(', '));
      assert.ok(allText(pages).includes('My LinkedIn'), allText(pages));
      assert.ok(!allText(pages).includes('linkedin.com/in/firstname-lastname'), allText(pages));
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

describe('cover letter contact visibility (FIDB-44)', () => {
  /** Text of the letter and of the résumé for one résumé / letter hidden-fields pair. */
  const both = async (resumeHidden, coverLetter) => {
    const r = resume({ personal: { ...PERSONAL, hiddenFields: resumeHidden }, coverLetter });
    return { letter: allText(await read(await renderCover(r))), cv: allText(await read(await render(r))) };
  };

  it('the letter\'s own list decides, both ways; the résumé keeps its own', async () => {
    const shown = await both(['phone', 'github'], { hiddenFields: [] });
    assert.ok(shown.letter.includes('+1 555 0100'), `hidden on the résumé, shown on the letter: ${shown.letter}`);
    assert.ok(shown.letter.includes('github.com/firstname'), `hidden on the résumé, shown on the letter: ${shown.letter}`);
    assert.ok(!shown.cv.includes('+1 555 0100') && !shown.cv.includes('github.com/firstname'), `the résumé keeps hiding them: ${shown.cv}`);

    const hidden = await both([], { hiddenFields: ['phone'] });
    assert.ok(!hidden.letter.includes('+1 555 0100'), `shown on the résumé, hidden on the letter: ${hidden.letter}`);
    assert.ok(hidden.letter.includes('github.com/firstname'), hidden.letter);
    assert.ok(hidden.cv.includes('+1 555 0100'), `the résumé keeps showing it: ${hidden.cv}`);
  });

  it('a letter that never set its own list follows the résumé\'s (older data; the panel shows the same)', async () => {
    const { letter } = await both(['phone'], {});
    assert.ok(!letter.includes('+1 555 0100'), letter);
    assert.ok(letter.includes('github.com/firstname'), letter);
  });
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
