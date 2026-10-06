// R2-142, the PDF build of a huge field. A PLAIN text field — a company, a skills line, a name — of 100 000
// characters took 4-14 s to build on CI, and 200 000 more than the PDF worker's 20 s: textkit lays one paragraph
// out in time that grows with its square, and the cut that stops that for rich text (typing-freeze 7b,
// splitHugeBlock.js, tests/pdf/164) never saw plain text. Text (PdfText.jsx), which every template draws its
// strings with, now cuts a string of more than 12 000 characters into lines of a few thousand, and the running
// header (a render prop, which Text's cut does not see) cuts its line the same way.
//
// How it is pinned (work, never time): V8's call counts of textkit's line breaker (call-counts.mjs: `computeCost`
// runs once for every pair of a break and a still-open earlier break, which is what grows with the square of a
// paragraph) for a field of 50 000 characters against one of 200 000 — linear work is 4 times as much, squared
// 16 — in a company, a skills line... and the name that every page repeats in its header. And that nothing
// changes for ordinary text: the props Text hands react-pdf, and the pages of typical résumés in every template,
// with the cut and with it taken out (_setHugeTextCutForTest).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, section, experience, render, renderCover, read, allText, TEMPLATES } from './harness.mjs';
import { count, stopCounting } from './call-counts.mjs';

let PdfText;
let breakHugeText;
before(async () => {
  await setup();
  PdfText = await loadModule('/src/templates/pdf/shared/PdfText.jsx');
  ({ breakHugeText } = await loadModule('/src/templates/pdf/shared/splitHugeBlock.js'));
});
after(async () => {
  PdfText._setHugeTextCutForTest?.(null);
  stopCounting();
  await teardown();
});

function words(n, seed = 7) {
  let a = seed;
  const rand = () => { a = (Math.imul(a, 1103515245) + 12345) & 0x7fffffff; return a / 0x7fffffff; };
  let out = '';
  while (out.length < n) {
    let w = '';
    for (let i = 2 + Math.floor(rand() * 9); i > 0; i -= 1) w += String.fromCharCode(97 + Math.floor(rand() * 26));
    out += `${w} `;
  }
  return out.slice(0, n).trim();
}

const TEXTKIT = '/@react-pdf/textkit/lib/textkit.js';
/** How many times textkit's line breaker priced a break while `build` ran. */
async function priced(build) {
  const calls = await count(build, { file: TEXTKIT, names: ['computeCost'] });
  assert.ok(calls.computeCost > 0, 'the counter found textkit\'s computeCost (a textkit that renamed it fails here, not on a zero)');
  return calls.computeCost;
}

/** `work(200 000)` against `work(50 000)`: 4 times as much for work that follows its text, 16 for work that follows its square. */
async function growth(build, label) {
  const small = await priced(() => build(50_000));
  const big = await priced(() => build(200_000));
  console.log(`175 ${label}: ${small} breaks priced for 50 000 characters, ${big} for 200 000 (${(big / small).toFixed(2)} times as many)`);
  return { small, big, ratio: big / small };
}

describe('a plain text field of 200 000 characters costs about four times one of 50 000 (R2-142)', () => {
  const fields = {
    'a company (an entry\'s header)': (text) => resume({ sections: [section('experience', [{ company: text }])] }),
    'a skills line': (text) => resume({ sections: [section('skills', [{ category: 'Languages', skills: text }])] }),
    'interests, which flow over the pages': (text) => resume({ sections: [section('interests', [{ interests: text }])] }),
    'a language': (text) => resume({ sections: [section('languages', [{ language: text }])] }),
  };
  for (const [label, make] of Object.entries(fields)) {
    it(label, async () => {
      const { small, big, ratio } = await growth((n) => render(make(words(n))), label);
      assert.ok(ratio < 6, `${small} breaks priced for 50 000 characters, ${big} for 200 000: ${ratio.toFixed(1)} times as many (4 is linear, 16 squared)`);
    });
  }

  it('the name, which every page after the first repeats in its running header', async () => {
    // 30 000 characters of description make the pages the header is drawn on; the name is what grows.
    const { small, big, ratio } = await growth((n) => render(resume({
      personal: { name: words(n, 3) },
      sections: [experience([{ description: `<p>${words(30_000, 5)}</p>` }])],
    })), 'a name');
    assert.ok(ratio < 6, `${small} breaks priced for a name of 50 000 characters, ${big} for 200 000: ${ratio.toFixed(1)} times as many`);
  });

  it('a cover letter\'s recipient', async () => {
    const { small, big, ratio } = await growth((n) => renderCover(resume({ coverLetter: { recipientName: words(n, 4) } })), 'a cover letter\'s recipient');
    assert.ok(ratio < 6, `${small} breaks priced for 50 000 characters, ${big} for 200 000: ${ratio.toFixed(1)} times as many`);
  });
});

describe('nothing changes for ordinary text', () => {
  const element = { $$typeof: Symbol.for('react.transitional.element'), type: 'span', props: { children: 'x' } };
  const ordinary = [
    { children: 'Pat Lee' },
    { children: ['Pat', ' ', 'Lee', null, 3, false] },
    { children: 'x'.repeat(12_000) },
    { children: [words(1000), ' ', words(1000)] }, // strings side by side, 9 779 characters together
    { children: [element, 'between', element] },
    { children: [words(8000), element, words(8000)] },
    { children: [[words(8000), element]] },
    { children: undefined },
    { style: { fontSize: 11, fontWeight: 'bold' }, children: 'Acme, Inc.', hyphenationPenalty: 5 },
    { fixed: true, render: ({ pageNumber }) => `Page ${pageNumber}`, style: { position: 'absolute' } },
    { hyphenationCallback: (word) => [word], children: words(1500) },
  ];

  it('Text hands react-pdf the very props it was given, plus its hyphenationPenalty, for text of 12 000 characters or fewer and for children with an element in them', () => {
    for (const props of ordinary) {
      const out = PdfText.Text(props);
      assert.deepEqual(out.props, { hyphenationPenalty: 10000, ...props });
      assert.ok(out.props.children === props.children, 'the children are the very same value');
    }
  });

  it('a string of more than 12 000 characters reaches react-pdf cut into lines, and nothing else about it changes', () => {
    const props = { style: { fontSize: 11 }, hyphenationCallback: (word) => [word], children: words(30_000) };
    const out = PdfText.Text(props);
    assert.deepEqual({ ...out.props, children: null }, { hyphenationPenalty: 10000, ...props, children: null });
    assert.equal(out.props.children, breakHugeText(props.children));
    assert.ok(out.props.children.includes('\n'));
  });

  /** A typical résumé, every kind of section, no text near the limit. */
  const typical = (template) => resume({
    template,
    personal: { name: 'Morgan Ellis', title: 'Principal Engineer', email: 'morgan@example.com', phone: '+1 555 0177', location: 'Denver, CO', website: 'morganellis.example.com', summary: `<p>${words(900, 2)}</p>` },
    sections: [
      experience([
        { company: 'Acme, Inc.', role: 'Principal Engineer', description: `<p>${words(600, 3)}</p><ul><li>${words(120, 4)}</li><li>${words(90, 5)}</li></ul>` },
        { company: 'Globex', role: 'Senior Engineer', description: `<ul><li>${words(150, 6)}</li></ul>` },
      ]),
      section('education', [{ institution: 'State University', degree: 'BSc', fieldOfStudy: 'Computer Science', gpa: '3.8', description: `<p>${words(200, 7)}</p>` }]),
      section('skills', [{ category: 'Languages', skills: 'TypeScript, JavaScript, Go, SQL' }, { category: 'Practice', skills: words(300, 8) }]),
      section('projects', [{ name: 'Atlas', url: 'github.com/morgan/atlas', technologies: 'React, Node.js', description: `<p>${words(300, 9)}</p>` }]),
      section('languages', [{ language: 'English', proficiency: 'Native' }, { language: 'German', proficiency: 'Professional' }]),
      section('certifications', [{ name: 'Certified Cloud Architect', issuer: 'Cloud Institute', credentialId: 'CCA-1234' }]),
      section('awards', [{ title: 'Engineering Excellence', issuer: 'Acme', description: `<p>${words(150, 10)}</p>` }]),
      section('interests', [{ interests: words(400, 11) }]),
      section('references', [{ name: 'Sam Rivera', jobTitle: 'Engineering Manager', company: 'Globex', email: 'sam@example.com' }]),
      section('custom', [{ title: 'Talks', subtitle: 'Conference', description: `<p>${words(250, 12)}</p>` }]),
    ],
  });
  /** What a page prints and where, as pdf.js reads it back. */
  const printed = (pages) => pages.map((p) => ({ W: p.W, H: p.H, items: p.items, links: p.links, strokes: [...p.strokes].sort(), fills: [...p.fills].sort() }));

  it('every template builds the same pages of a typical résumé with the cut as without it', async () => {
    for (const template of TEMPLATES) {
      PdfText._setHugeTextCutForTest?.((children) => children); // the old Text: nothing is cut
      const unbroken = printed(await read(await render(typical(template))));
      PdfText._setHugeTextCutForTest?.(null);
      const broken = printed(await read(await render(typical(template))));
      assert.ok(unbroken.length >= 1);
      assert.deepEqual(broken, unbroken, `${template}: the pages differ`);
    }
  });
});

describe('a huge plain field prints all of its text, and its first page as it was (R2-142)', () => {
  // Interests flow over the pages, so the whole of 40 000 characters is on paper.
  const interests = (text) => resume({ sections: [section('interests', [{ interests: text }])] });

  it('every word, in order', async () => {
    const text = words(40_000, 5);
    const pages = await read(await render(interests(text)));
    // The section title, the running header ("Test Person · Page 2") and the page numbers are no word of the text.
    const printed = allText(pages).split(/\s+/).filter((w) => /^[a-z]{2,10}$/.test(w));
    const pasted = text.split(' ');
    const at = printed.findIndex((w, i) => w !== pasted[i]);
    assert.equal(at, -1, `word ${at} printed as "${printed[at]}", written as "${pasted[at]}"`);
    assert.equal(printed.length, pasted.length, 'every word printed once');
  });

  it('the first page is what the unbroken text printed: the first cut falls past it', async () => {
    const text = words(40_000, 6);
    PdfText._setHugeTextCutForTest?.((children) => children);
    const whole = await read(await render(interests(text)));
    PdfText._setHugeTextCutForTest?.(null);
    const cut = await read(await render(interests(text)));
    assert.ok(cut.length > 3, `${cut.length} pages`);
    assert.deepEqual(cut[0].items, whole[0].items, 'page 1');
  });
});
