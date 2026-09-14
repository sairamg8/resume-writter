// The Sidebar template: links, fields, spacing, colours and styles of its two columns.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allText, itemsWith } from './harness.mjs';

before(setup);
after(teardown);

const sidebar = (sections, extra = {}) => resume({ template: 'sidebar', sections, ...extra });
const linksOf = (pages) => pages.flatMap((p) => p.links.map((l) => l.url));

describe('Sidebar entry links (FIDB-14)', () => {
  it('project and certificate URLs are links; the certificate prints its link label', async () => {
    const pages = await read(await render(sidebar([
      section('projects', [{ name: 'Proj', url: 'github.com/me/proj' }]),
      section('certifications', [{ name: 'AWS Dev', url: 'https://credential.example.com/abc', urlLabel: 'View Certificate' }]),
    ])));
    const urls = linksOf(pages);
    assert.ok(urls.includes('https://github.com/me/proj'), urls.join(', '));
    assert.ok(urls.includes('https://credential.example.com/abc'), urls.join(', '));
    const text = allText(pages);
    assert.ok(text.includes('github.com/me/proj') && text.includes('View Certificate'), text);
    // Only the words are clickable, not the rest of the line.
    for (const [needle, url] of [['View Certificate', 'https://credential.example.com/abc'], ['github.com/me/proj', 'https://github.com/me/proj']]) {
      const t = itemsWith(pages, needle)[0];
      const [x1, y1, x2, y2] = pages[0].links.find((l) => l.url === url).rect;
      assert.ok(Math.abs(x1 - t.x) < 2 && Math.abs(x2 - (t.x + t.w)) < 2 && y1 < t.y && y2 > t.y, `${needle}: link ${[x1, y1, x2, y2]} vs text x=${t.x} w=${t.w} y=${t.y}`);
    }
  });

  it('a URL that is not safe to link prints as text, not as a link', async () => {
    const pages = await read(await render(sidebar([
      section('projects', [{ name: 'Proj', url: 'javascript:alert(1)' }]),
      section('certifications', [{ name: 'Cert', url: 'javascript:alert(2)' }]),
    ])));
    assert.deepEqual(linksOf(pages), []);
    assert.ok(allText(pages).includes('javascript:alert(1)'), allText(pages));
  });
});

describe('Sidebar dark-column spacing (FIDB-38)', () => {
  /** Baseline-to-baseline distance between the first two skill groups of the dark column. */
  async function skillGap(settings) {
    const pages = await read(await render(sidebar([
      section('skills', [{ category: 'Alpha', skills: 'One' }, { category: 'Beta', skills: 'Two' }], settings),
    ])));
    const [a, b] = ['ALPHA', 'BETA'].map((s) => itemsWith(pages, s)[0]);
    return a.y - b.y;
  }

  it('the section\'s spacing preset sets the gap between items, as in the main column', async () => {
    const compact = await skillGap({ spacing: 'compact' });
    const relaxed = await skillGap({ spacing: 'relaxed' });
    assert.ok(Math.abs(relaxed - compact - (14 - 4) * 0.75) < 0.2, `compact ${compact}, relaxed ${relaxed}`);
    const override = await skillGap({ spacing: 'compact', itemGap: 20 });
    assert.ok(Math.abs(override - compact - (20 - 4) * 0.75) < 0.2, `an Item gap override wins: ${override}`);
  });
});
