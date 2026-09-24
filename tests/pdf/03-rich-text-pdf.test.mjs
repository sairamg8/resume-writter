// Rich text as it prints: every fix is checked on a real PDF rendered by the app's own code.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, teardown, resume, experience, render, read, itemsWith, allItems, drawState, TEMPLATES,
} from './harness.mjs';

before(setup);
after(teardown);

const renderDesc = async (description, opts = {}) => {
  const bytes = await render(resume({ ...opts, sections: [experience([{ description }])] }));
  return { bytes, pages: await read(bytes) };
};
const first = (pages, needle) => {
  const hit = itemsWith(pages, needle)[0];
  assert.ok(hit, `"${needle}" is printed`);
  return hit;
};

describe('lines', () => {
  it('lines typed with Enter (<div>) print on their own lines (FIDA-27 / FIDB-66)', async () => {
    const { pages } = await renderDesc('First line<div>Second line</div><div>Third line</div>');
    assert.equal(itemsWith(pages, 'First lineSecond').length, 0, 'no run-on line');
    const [a, b, c] = ['First line', 'Second line', 'Third line'].map((s) => first(pages, s));
    assert.ok(a.y > b.y && b.y > c.y, 'each on a lower line');
    assert.ok(Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5, 'same left edge');
  });

  it('a blank line (<p><br></p>) keeps its height (FIDB-78)', async () => {
    const { pages: kept } = await renderDesc('<p>Para one</p><p><br></p><p>Para three</p>');
    const { pages: plain } = await renderDesc('<p>Para one</p><p>Para three</p>');
    const gap = (pages) => first(pages, 'Para one').y - first(pages, 'Para three').y;
    assert.ok(gap(kept) > gap(plain) * 1.8, `blank line adds a line: ${gap(kept)} vs ${gap(plain)}`);
  });

  it('the description\'s top margin applies once, not above every paragraph (FIDA-06)', async () => {
    const { pages } = await renderDesc('<p>Alpha</p><p>Beta</p><p>Gamma</p>');
    const [a, b, c] = ['Alpha', 'Beta', 'Gamma'].map((s) => first(pages, s));
    const line = 11 * 1.5;
    assert.ok(Math.abs((a.y - b.y) - (line + 2)) < 0.6, `paragraph pitch ${a.y - b.y}`);
    assert.ok(Math.abs((a.y - b.y) - (b.y - c.y)) < 0.1, 'even pitch');
  });
});

describe('pasted text', () => {
  it('text pasted from Google Docs prints in the template colour, fully opaque (FIDA-30)', async () => {
    const span = (bg) => `<span style="font-size:11pt;font-family:Arial;color:#000000;background-color:${bg};font-weight:400;">Pasted ${bg}</span>`;
    for (const bg of ['transparent', '#ffffff']) {
      const { bytes } = await renderDesc(`<p>${span(bg)}</p>`);
      const [hit] = await drawState(bytes, `Pasted ${bg}`);
      assert.ok(hit, 'drawn');
      assert.equal(hit.alpha, 1, 'not transparent');
      assert.equal(hit.fill, '#333333', 'the description colour');
    }
  });

  it('white text pasted from a dark page is still visible', async () => {
    const { bytes } = await renderDesc('<p><span style="color:#ffffff">Was white</span></p>');
    const [hit] = await drawState(bytes, 'Was white');
    assert.notEqual(hit.fill.toLowerCase(), '#ffffff');
  });
});

describe('lists (FIDA-31)', () => {
  it('a list with attributes prints one bulleted line per item', async () => {
    const { pages } = await renderDesc('<ul class="list"><li>Alpha item</li><li>Beta item</li></ul>');
    assert.equal(itemsWith(pages, 'Alpha itemBeta').length, 0);
    assert.equal(itemsWith(pages, '•').length, 2);
    assert.ok(first(pages, 'Alpha item').y > first(pages, 'Beta item').y);
  });

  it('an ordered list honours start, and 9. / 10. share a text column', async () => {
    // Equal-width texts ("Row 08" … "Row 11", tabular digits) end at the same x only if they
    // start at the same x. (pdf.js merges a marker and its text into one item when they are
    // close, so the start of the text itself is not always its own item.)
    const lis = ['08', '09', '10', '11'].map((n) => `<li>Row ${n}</li>`).join('');
    const { pages } = await renderDesc(`<ol start="8">${lis}</ol>`);
    for (const n of ['8.', '9.', '10.', '11.']) assert.ok(itemsWith(pages, n).length, `${n} printed`);
    const ends = ['Row 08', 'Row 09', 'Row 10', 'Row 11'].map((s) => { const t = first(pages, s); return t.x + t.w; });
    assert.ok(Math.max(...ends) - Math.min(...ends) < 0.5, `text column ends ${ends}`);
  });

  it('a nested item is indented under its parent, and the next sibling keeps its bullet', async () => {
    const { pages } = await renderDesc('<ul><li>Parent<ul><li>Child</li></ul></li><li>Sibling</li></ul>');
    assert.ok(first(pages, 'Child').x > first(pages, 'Parent').x + 5);
    assert.ok(Math.abs(first(pages, 'Sibling').x - first(pages, 'Parent').x) < 0.5);
    const markers = allItems(pages).map((t) => t.str.trim()[0]).filter((c) => '•–·'.includes(c));
    assert.deepEqual(markers, ['•', '–', '•']);
  });
});

describe('formatting', () => {
  it('bold inside italic and italic inside bold keep both marks (FIDA-29 / FIDB-77)', async () => {
    const { pages } = await renderDesc('<p><strong><em>BoldItalicA</em></strong> and <em>x <strong>BoldItalicB</strong></em></p>');
    for (const s of ['BoldItalicA', 'BoldItalicB']) assert.match(first(pages, s).font, /BoldItalic/, s);
  });

  it('editor alignment reaches the PDF (FIDA-28 / FIDB-67)', async () => {
    const { pages } = await renderDesc('<p>Left para</p><div style="text-align: center;">Centered div</div><p style="text-align: right;">Right para</p>');
    const l = first(pages, 'Left'); const c = first(pages, 'Centered'); const r = first(pages, 'Right');
    const right = pages[0].W - 18 * 72 / 25.4;
    assert.ok(c.x > l.x + 100, 'centred');
    assert.ok(Math.abs((c.x + c.w / 2) - (l.x + right) / 2) < 2, 'centred on the text column');
    assert.ok(Math.abs(r.x + r.w - right) < 1.5, 'right-aligned to the margin');
  });

  it('a link in a description is clickable and keeps the text colour (FIDA-26)', async () => {
    const { bytes, pages } = await renderDesc('<p>See <a href="https://example.com/x">my project</a> and <a href="javascript:alert(1)">bad</a>.</p>');
    const links = pages.flatMap((p) => p.links);
    assert.deepEqual(links.map((l) => l.url), ['https://example.com/x']);
    const [hit] = await drawState(bytes, 'my project');
    assert.equal(hit.fill, '#333333');
  });
});

describe('page breaks', () => {
  // Shift where the page break falls (0–7 lead-in lines) so that some break lands after the
  // first line of a two-line bullet — the case that used to leave the bullet behind. Long enough to
  // wrap in Compact's 9 pt type across its 12 mm margins too (T9), where the shorter one fit a line.
  for (const template of TEMPLATES) {
    it(`${template}: a bullet never stays behind at the bottom of a page (FIDA-13 / FIDB-04)`, async () => {
      const lis = Array.from({ length: 50 }, (_, i) => `<li>Bullet number ${i + 1} with enough words to wrap onto a second line in a narrow column of text, and in the small type of a wide page as well</li>`).join('');
      for (let lead = 0; lead < 8; lead += 1) {
        const intro = Array.from({ length: lead }, (_, i) => `<p>Lead line ${i + 1}</p>`).join('');
        const { pages } = await renderDesc(`${intro}<ul>${lis}</ul>`, { template });
        assert.ok(pages.length > 1, 'crosses a page');
        pages.slice(0, -1).forEach((p, i) => {
          const lowest = Math.min(...p.items.map((t) => t.y));
          const lastLine = p.items.filter((t) => Math.abs(t.y - lowest) < 1);
          assert.ok(!lastLine.every((t) => /^\s*[•–·]\s*$/.test(t.str)), `lead ${lead}: page ${i + 1} ends with a lone bullet`);
        });
        const printed = new Set(allItems(pages).map((t) => (t.str.match(/Bullet number (\d+)/) || [])[1]).filter(Boolean));
        assert.equal(printed.size, 50, `lead ${lead}: every bullet printed`);
      }
    });
  }
});
